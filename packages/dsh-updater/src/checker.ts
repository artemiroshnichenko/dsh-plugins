import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { cleanVersion, isNewerVersion } from "./version.js";
import type {
  CheckUpdatesResult,
  PluginItemInfo,
  PluginsStatus,
  UpdaterConfig,
  VersionInfo,
} from "./types.js";

const execFileAsync = promisify(execFile);

export function expandHome(filePath: string): string {
  if (filePath.startsWith("~/") || filePath === "~") {
    return path.join(os.homedir(), filePath.slice(1));
  }
  return filePath;
}

export function getCurrentDshVersion(dshInstallPath: string): string {
  try {
    const fullPath = path.join(expandHome(dshInstallPath), "package.json");
    if (!fs.existsSync(fullPath)) return "unknown";
    const content = JSON.parse(fs.readFileSync(fullPath, "utf8"));
    const ver =
      content.dependencies?.["@deepseek-ai/dsh"] ||
      content.devDependencies?.["@deepseek-ai/dsh"] ||
      content.version;
    return ver ? cleanVersion(ver) : "unknown";
  } catch {
    return "unknown";
  }
}

export interface RegistryPackageData {
  latest: string;
  distTags: Record<string, string>;
  publishedAt?: string;
}

export async function fetchRemoteDshVersion(timeoutMs = 5000): Promise<RegistryPackageData> {
  try {
    const res = await fetch("https://registry.npmjs.org/@deepseek-ai%2fdsh", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      throw new Error(`Registry HTTP error: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as any;
    const distTags: Record<string, string> = data["dist-tags"] || {};
    const latest = distTags.latest || distTags.next || Object.values(distTags)[0] || "";
    const publishedAt = data.time ? data.time[latest] : undefined;
    return { latest: cleanVersion(latest), distTags, publishedAt };
  } catch {
    // Fallback using pnpm view
    try {
      const { stdout } = await execFileAsync("pnpm", ["view", "@deepseek-ai/dsh", "dist-tags", "--json"], {
        timeout: timeoutMs,
      });
      const distTags = JSON.parse(stdout.trim());
      const latest = distTags.latest || distTags.next || Object.values(distTags)[0] || "";
      return { latest: cleanVersion(latest), distTags };
    } catch (fallbackErr: any) {
      throw new Error(`Failed to check remote version: ${fallbackErr?.message || "network error"}`);
    }
  }
}

export async function checkPluginsStatus(repoPath: string): Promise<PluginsStatus> {
  const fullRepoPath = expandHome(repoPath);
  const result: PluginsStatus = {
    hasUpdates: false,
    repoPath: fullRepoPath,
    repoBehind: 0,
    repoBranch: "main",
    items: [],
  };

  const packagesDir = path.join(fullRepoPath, "packages");
  if (fs.existsSync(packagesDir)) {
    try {
      const entries = fs.readdirSync(packagesDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const pkgJsonPath = path.join(packagesDir, entry.name, "package.json");
        if (fs.existsSync(pkgJsonPath)) {
          try {
            const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
            result.items.push({
              name: pkg.name || entry.name,
              currentVersion: cleanVersion(pkg.version || "0.1.0"),
              latestVersion: cleanVersion(pkg.version || "0.1.0"),
              updateAvailable: false,
              location: path.join("packages", entry.name),
            });
          } catch {}
        }
      }
    } catch {}
  }

  // Check git status in the plugins repo if it is a git repo
  const gitDir = path.join(fullRepoPath, ".git");
  if (fs.existsSync(gitDir)) {
    try {
      const { stdout: branchOut } = await execFileAsync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
        cwd: fullRepoPath,
      });
      result.repoBranch = branchOut.trim();

      // Check if remote is configured
      const { stdout: remotesOut } = await execFileAsync("git", ["remote"], { cwd: fullRepoPath });
      if (remotesOut.trim().length > 0) {
        // Fetch quietly
        await execFileAsync("git", ["fetch", "-q"], { cwd: fullRepoPath, timeout: 6000 }).catch(() => {});
        // Check behind count
        const { stdout: countOut } = await execFileAsync(
          "git",
          ["rev-list", "--count", "HEAD..@{u}"],
          { cwd: fullRepoPath },
        ).catch(() => ({ stdout: "0" }));
        const behind = parseInt(countOut.trim(), 10) || 0;
        result.repoBehind = behind;
        if (behind > 0) {
          result.hasUpdates = true;
          for (const item of result.items) {
            item.updateAvailable = true;
          }
        }
      }
    } catch {}
  }

  return result;
}

export async function checkAllUpdates(config: UpdaterConfig = {}): Promise<CheckUpdatesResult> {
  const dshInstallPath = config.dshInstallPath || "~/.agents/tools/dsh";
  const pluginsRepoPath = config.pluginsRepoPath || "~/projects/dsh-plugins";

  const currentDshVer = getCurrentDshVersion(dshInstallPath);

  let remoteDsh: RegistryPackageData = { latest: currentDshVer, distTags: {} };
  try {
    remoteDsh = await fetchRemoteDshVersion();
  } catch (err: any) {
    // Keep current if fetch fails
  }

  const dshUpdateAvailable = isNewerVersion(currentDshVer, remoteDsh.latest);

  const dshInfo: VersionInfo = {
    current: currentDshVer,
    latest: remoteDsh.latest,
    updateAvailable: dshUpdateAvailable,
    publishedAt: remoteDsh.publishedAt,
    distTags: remoteDsh.distTags,
  };

  const pluginsInfo = await checkPluginsStatus(pluginsRepoPath);

  return {
    dsh: dshInfo,
    plugins: pluginsInfo,
    checkedAt: new Date().toISOString(),
    hasAnyUpdates: dshUpdateAvailable || pluginsInfo.hasUpdates,
  };
}
