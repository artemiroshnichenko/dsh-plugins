import { describe, it, expect } from "vitest";
import { tokenize, parseDiff, langBadge, GRAMMARS } from "../src/editor-syntax.js";

describe("editor-syntax", () => {
  describe("langBadge", () => {
    it("returns correct badges for standard languages", () => {
      expect(langBadge("src/index.ts")).toBe("TS");
      expect(langBadge("src/App.tsx")).toBe("TSX");
      expect(langBadge("lib/index.js")).toBe("JS");
      expect(langBadge("components/Card.jsx")).toBe("JSX");
      expect(langBadge("script.py")).toBe("PYTHON");
      expect(langBadge("src/main.rs")).toBe("RUST");
      expect(langBadge("main.go")).toBe("GO");
      expect(langBadge("package.json")).toBe("JSON");
      expect(langBadge("config.yaml")).toBe("YAML");
      expect(langBadge("Cargo.toml")).toBe("TOML");
      expect(langBadge("README.md")).toBe("MARKDOWN");
      expect(langBadge("deploy.sh")).toBe("SHELL");
      expect(langBadge("index.html")).toBe("HTML");
      expect(langBadge("styles.css")).toBe("CSS");
      expect(langBadge("query.sql")).toBe("SQL");
      expect(langBadge("Dockerfile")).toBe("DOCKER");
      expect(langBadge("Makefile")).toBe("MAKE");
      expect(langBadge("notes.txt")).toBe("TXT");
    });
  });

  describe("tokenize", () => {
    it("tokenizes TypeScript code into keywords, strings, numbers, functions", () => {
      const code = `const count: number = 42;\nfunction greet(name: string) {\n  return "Hello " + name;\n}`;
      const tokens = tokenize(code, "typescript");
      expect(tokens.length).toBeGreaterThan(0);

      const kwTokens = tokens.filter((t: any) => t && t.type === "kw");
      expect(kwTokens.map((t: any) => t.content)).toContain("const");
      expect(kwTokens.map((t: any) => t.content)).toContain("function");
      expect(kwTokens.map((t: any) => t.content)).toContain("return");

      const strTokens = tokens.filter((t: any) => t && t.type === "str");
      expect(strTokens.map((t: any) => t.content)).toContain('"Hello "');

      const numTokens = tokens.filter((t: any) => t && t.type === "num");
      expect(numTokens.map((t: any) => t.content)).toContain("42");
    });

    it("tokenizes Python comments, strings, and keywords", () => {
      const pyCode = `# comment\ndef calculate(x):\n    return x * 2\n`;
      const tokens = tokenize(pyCode, "python");
      const comTokens = tokens.filter((t: any) => t && t.type === "com");
      expect(comTokens.length).toBe(1);
      expect(comTokens[0].content).toBe("# comment");

      const kwTokens = tokens.filter((t: any) => t && t.type === "kw");
      expect(kwTokens.map((t: any) => t.content)).toContain("def");
      expect(kwTokens.map((t: any) => t.content)).toContain("return");
    });

    it("handles empty or invalid inputs gracefully", () => {
      expect(tokenize("", "js")).toEqual([]);
      expect(tokenize(null as any, "js")).toEqual([]);
      expect(tokenize("plain text without tokens", "unknown-lang")).toBeDefined();
    });
  });

  describe("parseDiff", () => {
    it("parses unified diff hunks with old and new line numbers", () => {
      const diff = `diff --git a/file.ts b/file.ts
index 000..111 100644
--- a/file.ts
+++ b/file.ts
@@ -10,3 +10,4 @@
 unchanged line
-removed line
+added line
+second added line
 unchanged line 2
`;
      const res = parseDiff(diff);
      expect(res.addedCount).toBe(2);
      expect(res.deletedCount).toBe(1);

      // Check rows
      const hunkRow = res.rows.find((r: any) => r.kind === "hunk");
      expect(hunkRow).toBeDefined();

      const delRow = res.rows.find((r: any) => r.kind === "del");
      expect(delRow?.oldNum).toBe(11);
      expect(delRow?.newNum).toBe(null);
      expect(delRow?.text).toBe("removed line");

      const addRows = res.rows.filter((r: any) => r.kind === "add");
      expect(addRows.length).toBe(2);
      expect(addRows[0].newNum).toBe(11);
      expect(addRows[0].oldNum).toBe(null);
      expect(addRows[0].text).toBe("added line");
      expect(addRows[1].newNum).toBe(12);
      expect(addRows[1].text).toBe("second added line");
    });

    it("handles empty diff", () => {
      const res = parseDiff("");
      expect(res.rows.length).toBe(0);
      expect(res.addedCount).toBe(0);
      expect(res.deletedCount).toBe(0);
    });
  });
});
