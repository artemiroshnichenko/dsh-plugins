#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const packagesDir = path.join(rootDir, "packages");

const dshHome = process.env.DSH_HOME || path.join(os.homedir(), ".dsh");
const profile = process.argv[2] || "web";
const profileDir = path.join(dshHome, "profiles", profile);
const profileNmDir = path.join(profileDir, "node_modules");

if (!fs.existsSync(profileDir)) {
  console.error(`Error: DSH profile directory not found: ${profileDir}`);
  console.error(`Make sure DeepSeek Harness is initialized, or specify a valid profile name.`);
  process.exit(1);
}

fs.mkdirSync(profileNmDir, { recursive: true });

const packages = fs.readdirSync(packagesDir).filter((pkg) => {
  const pkgJson = path.join(packagesDir, pkg, "package.json");
  return fs.existsSync(pkgJson);
});

console.log(`\n📦 Installing ${packages.length} dsh-plugins into profile "${profile}" (${profileNmDir}):\n`);

let linked = 0;
for (const pkg of packages) {
  const sourcePkg = path.join(packagesDir, pkg);
  const destLink = path.join(profileNmDir, pkg);

  try {
    let exists = false;
    let isSymlink = false;
    try {
      const stat = fs.lstatSync(destLink);
      exists = true;
      isSymlink = stat.isSymbolicLink();
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }

    if (exists) {
      if (isSymlink) {
        const currentTarget = fs.readlinkSync(destLink);
        if (currentTarget !== sourcePkg) {
          fs.unlinkSync(destLink);
          fs.symlinkSync(sourcePkg, destLink);
          console.log(`  🔄 Updated link: ${pkg} -> ${sourcePkg}`);
        } else {
          console.log(`  ✓ Already linked: ${pkg}`);
        }
      } else {
        console.log(`  ⚠️  Directory exists (not a symlink), skipping: ${pkg}`);
      }
    } else {
      fs.symlinkSync(sourcePkg, destLink);
      console.log(`  🔗 Linked: ${pkg} -> ${sourcePkg}`);
    }
    linked++;
  } catch (err) {
    console.error(`  ❌ Failed to link ${pkg}: ${err.message}`);
  }
}

console.log(`\n✨ Successfully linked ${linked} plugins.`);
console.log(`\nNext steps:`);
console.log(`1. Add the plugins you want to enable into ${path.join(profileDir, "cordis.patch.yml")}`);
console.log(`2. Start DeepSeek Harness: dsh web\n`);
