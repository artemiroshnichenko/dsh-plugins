import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { syncProfileSymlinks } from "../src/installer.js";

describe("installer helpers", () => {
  it("syncs profile symlinks correctly from virtual store", () => {
    const tmpBase = path.join(os.tmpdir(), `dsh-sync-test-${Date.now()}`);
    const dshInstallDir = path.join(tmpBase, "dsh-tool");
    const profilesDir = path.join(tmpBase, "profiles");
    const pnpmDir = path.join(dshInstallDir, "node_modules/.pnpm");

    const pkgDirInPnpm = path.join(
      pnpmDir,
      "@deepseek-ai+dsh-sample-pkg@0.1.5-rc.1_hash123/node_modules/@deepseek-ai/dsh-sample-pkg",
    );
    fs.mkdirSync(pkgDirInPnpm, { recursive: true });
    fs.writeFileSync(path.join(pkgDirInPnpm, "package.json"), JSON.stringify({ name: "dsh-sample-pkg" }));

    const res = syncProfileSymlinks(dshInstallDir, profilesDir);
    expect(res.created).toBe(1);

    const linkedPkg = path.join(profilesDir, "node_modules/@deepseek-ai/dsh-sample-pkg");
    expect(fs.existsSync(linkedPkg)).toBe(true);
    expect(fs.lstatSync(linkedPkg).isSymbolicLink()).toBe(true);
    expect(fs.readlinkSync(linkedPkg)).toBe(pkgDirInPnpm);

    // Clean up
    fs.rmSync(tmpBase, { recursive: true, force: true });
  });
});
