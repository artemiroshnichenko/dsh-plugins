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

  it("exposes remote methods with valid SRC signatures without defaults or destructuring", async () => {
    const DshUpdater = (await import("../src/index.js")).default;
    const proto = DshUpdater.prototype as any;

    const parseParams = (fn: Function) => {
      const source = Function.prototype.toString.call(fn);
      const open = source.indexOf("(");
      const close = source.indexOf(")", open + 1);
      const body = source.slice(open + 1, close).trim();
      if (body.length === 0) return [];
      const parts = body.split(",").map((p) => p.trim());
      for (const part of parts) {
        if (!/^[$A-Z_a-z][$\w]*$/u.test(part)) {
          throw new Error(`Invalid parameter "${part}" in ${source}`);
        }
      }
      return parts;
    };

    expect(parseParams(proto.check)).toEqual(["force"]);
    expect(parseParams(proto.update)).toEqual(["target", "restart"]);
    expect(parseParams(proto.restart)).toEqual([]);
  });
});
