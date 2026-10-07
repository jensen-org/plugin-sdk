import { describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  assemble,
  createRelease,
  entryFile,
  openStorePr,
  type Runner,
  releaseArgs,
  sha256Hex,
  validateEntry,
} from "../../src/cli/publish.ts";
import type { PackageJson } from "../../src/cli/validate.ts";

const fixtures = resolve(import.meta.dir, "../../protocol/fixtures/publish");

function project(): { dir: string; pkg: PackageJson } {
  const dir = mkdtempSync(join(tmpdir(), "jensen-publish-"));
  cpSync(join(fixtures, "project"), dir, { recursive: true });
  return { dir, pkg: JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) };
}

function read(name: string): string {
  return readFileSync(join(fixtures, "expected", name), "utf8");
}

describe("assemble", () => {
  test("matches the golden manifest and store entry byte for byte", () => {
    const { dir, pkg } = project();
    try {
      const result = assemble(dir, pkg);
      expect(result.manifestJson).toBe(read("manifest.json"));
      expect(entryFile(result.entry)).toBe(read("entry.json"));
      expect(readFileSync(join(dir, "release", "manifest.json"), "utf8")).toBe(result.manifestJson);
      expect(result.entry.sha256).toBe(sha256Hex(result.manifestJson));
      expect(result.assets).toEqual(["manifest.json", "main.js", "README.md"]);
      expect(validateEntry(result.entry)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("derives the id from the name and omits the tag when none is set", () => {
    const { dir, pkg } = project();
    try {
      const block = { ...pkg.jensen, id: undefined, tag: undefined };
      const { entry } = assemble(dir, { ...pkg, name: "GCP Scanner!", jensen: block });
      expect(entry.id).toBe("plugin.gcp-scanner");
      expect("tag" in entry).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("refuses a project without a README or a built main.js", () => {
    const { dir, pkg } = project();
    try {
      rmSync(join(dir, "README.md"));
      expect(() => assemble(dir, pkg)).toThrow("no README.md");
      writeFileSync(join(dir, "README.md"), "# x\n");
      rmSync(join(dir, "main.js"));
      expect(() => assemble(dir, pkg)).toThrow("no built main.js");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("validateEntry", () => {
  const good = JSON.parse(read("entry.json"));

  test("names every field the store schema would reject", () => {
    const bad = {
      ...good,
      id: "nodots",
      category: "",
      repo: "no-slash",
      version: "1.0",
      tag: "a/b",
    };
    expect(validateEntry(bad).map((p) => p.field)).toEqual([
      "entry.id",
      "entry.category",
      "entry.version",
      "entry.repo",
      "entry.tag",
    ]);
  });
});

describe("GitHub steps", () => {
  const { dir, pkg } = project();
  const published = assemble(dir, pkg);
  rmSync(dir, { recursive: true, force: true });

  test("the release is tagged with the entry tag and uploads every asset", () => {
    const args = releaseArgs(published.entry, published);
    expect(args.slice(0, 3)).toEqual(["release", "create", "golden-hello-v1.2.0"]);
    expect(args.filter((a) => a.startsWith(published.releaseDir)).length).toBe(3);
    expect(args).toContain("ada/golden-hello");
  });

  test("falls back to the version when the entry has no tag", () => {
    const { tag: _tag, ...entry } = published.entry;
    expect(releaseArgs(entry, published)[2]).toBe("1.2.0");
  });

  test("the store PR adds entries/<id>.json on a fork branch", () => {
    const calls: string[][] = [];
    const exec: Runner = (command, args) => {
      calls.push([command, ...args]);
      return command === "gh" && args[0] === "api" ? "ada" : "https://example.test/pr/1";
    };
    createRelease(published.entry, published, exec);
    expect(openStorePr(published.entry, exec)).toBe("https://example.test/pr/1");
    const flat = calls.map((c) => c.join(" "));
    expect(flat.some((c) => c.startsWith("gh release create golden-hello-v1.2.0"))).toBe(true);
    expect(flat).toContain("git add entries/dev.ada.golden-hello.json");
    expect(flat.at(-1)).toContain(
      "--repo jensen-org/plugins-store --head ada:plugin/dev.ada.golden-hello-1.2.0",
    );
  });
});

describe("assemble with a backend", () => {
  test("stages the wasm, pins it in dist.assets and writes entry.backend and tools", () => {
    const { dir, pkg } = project();
    try {
      writeFileSync(join(dir, "backend.wasm"), new Uint8Array([0, 97, 115, 109]));
      const tool = {
        name: "resize",
        description: "Resize an image",
        inputSchema: { type: "object" },
      };
      const block = {
        ...pkg.jensen,
        backend: "backend.wasm",
        tools: [tool],
        permissions: { ...(pkg.jensen?.permissions as object), backend: true },
      };

      const result = assemble(dir, { ...pkg, jensen: block });
      const manifest = JSON.parse(result.manifestJson);

      expect(manifest.entry).toEqual({ main: "main.js", backend: "backend.wasm" });
      expect(manifest.permissions.backend).toBe(true);
      expect(manifest.tools).toEqual([tool]);
      expect(manifest.dist.assets).toEqual([
        { asset: "backend.wasm", sha256: sha256Hex(new Uint8Array([0, 97, 115, 109])) },
      ]);
      expect(result.assets).toContain("backend.wasm");
      expect(readFileSync(join(dir, "release", "backend.wasm")).length).toBe(4);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("refuses a backend that was never built", () => {
    const { dir, pkg } = project();
    try {
      const block = { ...pkg.jensen, backend: "backend.wasm" };
      expect(() => assemble(dir, { ...pkg, jensen: block })).toThrow("is not built");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("assemble with a display name", () => {
  test("uses jensen.displayName for the manifest and entry name", () => {
    const { dir, pkg } = project();
    try {
      const block = { ...pkg.jensen, displayName: "Pretty Name" };
      const result = assemble(dir, { ...pkg, jensen: block });
      expect(JSON.parse(result.manifestJson).name).toBe("Pretty Name");
      expect(result.entry.name).toBe("Pretty Name");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
