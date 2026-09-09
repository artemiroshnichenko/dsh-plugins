import { describe, it, expect } from "vitest";
import { scopeOf, oneLine, summarizeSkill } from "../src/index.js";

describe("dsh-console", () => {
  describe("helpers", () => {
    it("classifies skill scope correctly", () => {
      expect(scopeOf("project:foo")).toBe("project");
      expect(scopeOf("user:bar")).toBe("user");
      expect(scopeOf("builtin")).toBe("builtin");
      expect(scopeOf(null)).toBe("other");
    });

    it("flattens multiline text to single line", () => {
      expect(oneLine("  hello\nworld\t  ")).toBe("hello world");
      expect(oneLine(null)).toBe("");
    });

    it("summarizes skill object", () => {
      const s = summarizeSkill({
        name: "test-skill",
        description: "A test\nskill description",
        source: "project:local",
        provider: "local",
        invocation: { modelInvocable: true, userInvocable: false },
        whenToUse: "When testing",
      });

      expect(s.name).toBe("test-skill");
      expect(s.description).toBe("A test skill description");
      expect(s.scope).toBe("project");
      expect(s.modelInvocable).toBe(true);
      expect(s.userInvocable).toBe(false);
      expect(s.whenToUse).toBe("When testing");
    });
  });
});
