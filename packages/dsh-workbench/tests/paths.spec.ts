import { describe, it, expect } from "vitest";
import { mkdtemp, rm, writeFile, mkdir, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  confine,
  languageOf,
  looksTextual,
  resolveRoot,
  versionOf,
} from "../src/paths.js";

describe("dsh-workbench paths", () => {
  describe("languageOf", () => {
    it("maps standard extensions to editor language modes", () => {
      expect(languageOf("index.ts")).toBe("typescript");
      expect(languageOf("main.rs")).toBe("rust");
      expect(languageOf("script.py")).toBe("python");
      expect(languageOf("run.sh")).toBe("bash");
      expect(languageOf("schema.sql")).toBe("sql");
      expect(languageOf("data.json")).toBe("json");
      expect(languageOf("README.md")).toBe("markdown");
      expect(languageOf("unknown.xyz")).toBe("");
    });

    it("handles exact filenames", () => {
      expect(languageOf("Dockerfile")).toBe("dockerfile");
      expect(languageOf("Makefile")).toBe("makefile");
      expect(languageOf("Justfile")).toBe("makefile");
    });
  });

  describe("looksTextual", () => {
    it("identifies textual code and config files", () => {
      expect(looksTextual("app.tsx")).toBe(true);
      expect(looksTextual("config.yaml")).toBe(true);
      expect(looksTextual(".gitignore")).toBe(true);
      expect(looksTextual("LICENSE")).toBe(true);
      expect(looksTextual(".env")).toBe(true);
      expect(looksTextual(".npmrc")).toBe(true);
    });

    it("rejects binary formats", () => {
      expect(looksTextual("image.png")).toBe(false);
      expect(looksTextual("photo.jpeg")).toBe(false);
      expect(looksTextual("document.pdf")).toBe(false);
      expect(looksTextual("archive.zip")).toBe(false);
      expect(looksTextual("binary.wasm")).toBe(false);
    });
  });

  describe("resolveRoot", () => {
    it("resolves valid directory to realpath", async () => {
      const tempDir = await mkdtemp(join(tmpdir(), "wb-root-"));
      try {
        const root = await resolveRoot(tempDir);
        const expected = await realpath(tempDir);
        expect(root).toBe(expected);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it("rejects empty or non-existent directories", async () => {
      await expect(resolveRoot("")).rejects.toThrow("no working directory specified");
      await expect(resolveRoot("/non/existent/path/xyz")).rejects.toThrow("does not exist");
    });

    it("rejects files when directory is required", async () => {
      const tempDir = await mkdtemp(join(tmpdir(), "wb-file-"));
      const filePath = join(tempDir, "file.txt");
      await writeFile(filePath, "hello");
      try {
        await expect(resolveRoot(filePath)).rejects.toThrow("not a directory");
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe("confine", () => {
    it("confines relative paths inside root", async () => {
      const rawTempDir = await mkdtemp(join(tmpdir(), "wb-confine-"));
      const tempDir = await realpath(rawTempDir);
      try {
        await mkdir(join(tempDir, "sub"));
        await writeFile(join(tempDir, "sub", "test.txt"), "content");

        const res = await confine(tempDir, "sub/test.txt");
        expect(res.exists).toBe(true);
        expect(res.rel).toBe("sub/test.txt");
      } finally {
        await rm(rawTempDir, { recursive: true, force: true });
      }
    });

    it("allows non-existent files targeted for creation", async () => {
      const rawTempDir = await mkdtemp(join(tmpdir(), "wb-new-"));
      const tempDir = await realpath(rawTempDir);
      try {
        const res = await confine(tempDir, "newfile.txt");
        expect(res.exists).toBe(false);
        expect(res.rel).toBe("newfile.txt");
      } finally {
        await rm(rawTempDir, { recursive: true, force: true });
      }
    });

    it("prevents directory traversal attacks", async () => {
      const rawTempDir = await mkdtemp(join(tmpdir(), "wb-trap-"));
      const tempDir = await realpath(rawTempDir);
      try {
        await expect(confine(tempDir, "../../etc/passwd")).rejects.toThrow("escapes working directory");
        await expect(confine(tempDir, "../sibling")).rejects.toThrow("escapes working directory");
      } finally {
        await rm(rawTempDir, { recursive: true, force: true });
      }
    });
  });

  describe("versionOf", () => {
    it("computes mtime and size composite stamp", () => {
      expect(versionOf({ mtimeMs: 1725500000000, size: 4096 })).toBe("1725500000000:4096");
    });
  });
});
