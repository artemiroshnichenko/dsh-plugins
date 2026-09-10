import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { expandHome, getCurrentDshVersion } from "../src/checker.js";

describe("checker helpers", () => {
  it("expands home directory correctly", () => {
    const home = os.homedir();
    expect(expandHome("~")).toBe(home);
    expect(expandHome("~/test/path")).toBe(path.join(home, "test/path"));
    expect(expandHome("/absolute/path")).toBe("/absolute/path");
  });

  it("reads current DSH version from package.json", () => {
    const tmpDir = path.join(os.tmpdir(), `dsh-test-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const pkgPath = path.join(tmpDir, "package.json");
    fs.writeFileSync(
      pkgPath,
      JSON.stringify({
        dependencies: {
          "@deepseek-ai/dsh": "^0.1.2-rc.1",
        },
      }),
    );

    const ver = getCurrentDshVersion(tmpDir);
    expect(ver).toBe("0.1.2-rc.1");

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("handles missing package.json safely", () => {
    const ver = getCurrentDshVersion("/nonexistent/directory/12345");
    expect(ver).toBe("unknown");
  });
});
