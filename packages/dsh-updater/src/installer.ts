import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { expandHome } from "./checker.js";
import type {
  UpdateExecutionResult,
  UpdateOptions,
  UpdateStepResult,
  UpdaterConfig,
} from "./types.js";

const execFileAsync = promisify(execFile);

export function syncProfileSymlinks(
  dshInstallDir: string,
  profilesDir: string,
): { created: number; updated: number; removed: number } {
  const dshDir = expandHome(dshInstallDir);
  const pnpmDir = path.join(dshDir, "node_modules/.pnpm");
  const profNmDir = path.join(expandHome(profilesDir), "node_modules");
  const scopedDir = path.join(profNmDir, "@deepseek-ai");

  if (!fs.existsSync(pnpmDir)) {
    return { created: 0, updated: 0, removed: 0 };
  }

  fs.mkdirSync(scopedDir, { recursive: true });

  let created = 0;
  let updated = 0;
  let removed = 0;

  const pnpmEntries = fs.readdirSync(pnpmDir);
  const discoveredScoped = new Map<string, string>();
  const discoveredUnscoped = new Map<string, string>();

  for (const entry of pnpmEntries) {
    if (entry.startsWith("@deepseek-ai+")) {
      const withoutPrefix = entry.slice("@deepseek-ai+".length);
      const atIdx = withoutPrefix.indexOf("@");
      if (atIdx !== -1) {
        const pkgName = withoutPrefix.slice(0, atIdx);
        const target = path.join(pnpmDir, entry, "node_modules/@deepseek-ai", pkgName);
        if (fs.existsSync(target)) {
          discoveredScoped.set(pkgName, target);
        }
      }
    } else if (!entry.startsWith(".") && entry.includes("@")) {
      const atIdx = entry.indexOf("@");
      if (atIdx > 0) {
        const pkgName = entry.slice(0, atIdx);
        const target = path.join(pnpmDir, entry, "node_modules", pkgName);
        if (fs.existsSync(target)) {
          discoveredUnscoped.set(pkgName, target);
        }
      }
    }
  }

  // Update @deepseek-ai symlinks
  for (const [pkgName, target] of discoveredScoped) {
    const linkPath = path.join(scopedDir, pkgName);
    try {
      if (fs.existsSync(linkPath) || fs.lstatSync(linkPath).isSymbolicLink()) {
        const currentTarget = fs.readlinkSync(linkPath);
        if (currentTarget !== target) {
          fs.unlinkSync(linkPath);
          fs.symlinkSync(target, linkPath);
          updated++;
        }
      } else {
        fs.symlinkSync(target, linkPath);
        created++;
      }
    } catch {
      try {
        fs.unlinkSync(linkPath);
      } catch {}
      try {
        fs.symlinkSync(target, linkPath);
        created++;
      } catch {}
    }
  }

  // Clean up broken symlinks in scopedDir
  if (fs.existsSync(scopedDir)) {
    for (const item of fs.readdirSync(scopedDir)) {
      const itemPath = path.join(scopedDir, item);
      try {
        const stat = fs.lstatSync(itemPath);
        if (stat.isSymbolicLink()) {
          const target = fs.readlinkSync(itemPath);
          if (!fs.existsSync(target)) {
            // Check if we discovered a valid target
            const valid = discoveredScoped.get(item);
            if (valid) {
              fs.unlinkSync(itemPath);
              fs.symlinkSync(valid, itemPath);
              updated++;
            } else {
              fs.unlinkSync(itemPath);
              removed++;
            }
          }
        }
      } catch {}
    }
  }

  return { created, updated, removed };
}

export async function updateDsh(
  version = "latest",
  dshInstallDir = "~/.agents/tools/dsh",
  profilesDir = "~/.dsh/profiles",
): Promise<UpdateStepResult[]> {
  const steps: UpdateStepResult[] = [];
  const fullDshDir = expandHome(dshInstallDir);

  const startInstall = Date.now();
  try {
    const targetSpec = version ? `@deepseek-ai/dsh@${version}` : "@deepseek-ai/dsh@latest";
    const { stdout, stderr } = await execFileAsync(
      "pnpm",
      ["add", targetSpec],
      { cwd: fullDshDir, timeout: 180000 },
    );
    steps.push({
      step: `Install DSH (${targetSpec})`,
      status: "success",
      output: (stdout + "\n" + stderr).trim(),
      durationMs: Date.now() - startInstall,
    });
  } catch (err: any) {
    steps.push({
      step: `Install DSH (${version})`,
      status: "failed",
      error: err?.message || String(err),
      durationMs: Date.now() - startInstall,
    });
    return steps;
  }

  const startSync = Date.now();
  try {
    const syncRes = syncProfileSymlinks(dshInstallDir, profilesDir);
    steps.push({
      step: "Repair Profile Symlinks",
      status: "success",
      output: `Symlinks sync: ${syncRes.created} created, ${syncRes.updated} updated, ${syncRes.removed} removed dead links`,
      durationMs: Date.now() - startSync,
    });
  } catch (err: any) {
    steps.push({
      step: "Repair Profile Symlinks",
      status: "failed",
      error: err?.message || String(err),
      durationMs: Date.now() - startSync,
    });
  }

  return steps;
}

export async function updatePlugins(
  pluginsRepoDir = "~/projects/dsh-plugins",
): Promise<UpdateStepResult[]> {
  const steps: UpdateStepResult[] = [];
  const fullRepoDir = expandHome(pluginsRepoDir);

  if (!fs.existsSync(fullRepoDir)) {
    steps.push({
      step: "Locate Plugins Repo",
      status: "failed",
      error: `Directory not found: ${fullRepoDir}`,
    });
    return steps;
  }

  // Git pull if git repo
  if (fs.existsSync(path.join(fullRepoDir, ".git"))) {
    const startPull = Date.now();
    try {
      const { stdout } = await execFileAsync("git", ["pull", "--ff-only"], {
        cwd: fullRepoDir,
        timeout: 30000,
      });
      steps.push({
        step: "Git Pull Plugins",
        status: "success",
        output: stdout.trim(),
        durationMs: Date.now() - startPull,
      });
    } catch (err: any) {
      steps.push({
        step: "Git Pull Plugins",
        status: "skipped",
        output: `Git pull skipped: ${err?.message || String(err)}`,
        durationMs: Date.now() - startPull,
      });
    }
  }

  // Build packages
  const startBuild = Date.now();
  try {
    const { stdout, stderr } = await execFileAsync("pnpm", ["build"], {
      cwd: fullRepoDir,
      timeout: 120000,
    });
    steps.push({
      step: "Build Plugins",
      status: "success",
      output: (stdout + "\n" + stderr).trim(),
      durationMs: Date.now() - startBuild,
    });
  } catch (err: any) {
    steps.push({
      step: "Build Plugins",
      status: "failed",
      error: err?.message || String(err),
      durationMs: Date.now() - startBuild,
    });
  }

  return steps;
}

export async function executeUpdate(
  options: UpdateOptions = {},
  config: UpdaterConfig = {},
): Promise<UpdateExecutionResult> {
  const target = options.target || "all";
  const dshInstallDir = config.dshInstallPath || "~/.agents/tools/dsh";
  const pluginsRepoDir = config.pluginsRepoPath || "~/projects/dsh-plugins";
  const profilesDir = config.profilesPath || "~/.dsh/profiles";

  const allSteps: UpdateStepResult[] = [];
  let ok = true;

  if (target === "all" || target === "dsh") {
    const dshSteps = await updateDsh(options.dshVersion || "latest", dshInstallDir, profilesDir);
    allSteps.push(...dshSteps);
    if (dshSteps.some((s) => s.status === "failed")) {
      ok = false;
    }
  }

  if (target === "all" || target === "plugins") {
    const pluginSteps = await updatePlugins(pluginsRepoDir);
    allSteps.push(...pluginSteps);
    if (pluginSteps.some((s) => s.status === "failed")) {
      ok = false;
    }
  }

  return {
    ok,
    target,
    steps: allSteps,
    restarting: Boolean(options.restart && ok),
  };
}
