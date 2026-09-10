import { describe, expect, it } from "vitest";
import { Config, NAMESPACE } from "../src/index.js";

describe("updater plugin config & schema", () => {
  it("has correct namespace and defaults", () => {
    expect(NAMESPACE).toBe("dshUpdater");
    const cfg = Config({});
    expect(cfg.autoCheckIntervalMinutes).toBe(60);
    expect(cfg.enableBadge).toBe(true);
    expect(cfg.enableCommands).toBe(true);
    expect(cfg.dshInstallPath).toBe("~/.agents/tools/dsh");
    expect(cfg.pluginsRepoPath).toBe("~/projects/dsh-plugins");
  });

  it("validates custom configuration values", () => {
    const cfg = Config({
      autoCheckIntervalMinutes: 30,
      enableBadge: false,
      enableCommands: false,
      dshInstallPath: "/custom/dsh",
    });
    expect(cfg.autoCheckIntervalMinutes).toBe(30);
    expect(cfg.enableBadge).toBe(false);
    expect(cfg.enableCommands).toBe(false);
    expect(cfg.dshInstallPath).toBe("/custom/dsh");
  });
});
