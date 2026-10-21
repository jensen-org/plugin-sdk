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
import { type PackageJson, validatePackage } from "../../src/cli/validate.ts";

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

describe("version rule", () => {
  const accepted = ["0.1.2", "1.0.0", "0.1.2-dev.5", "1.0.0-rc.1", "1.0.0-0.3.7", "1.0.0-x-y-z.--"];
  const refused = [
    "1.0",
    "01.0.0",
    "1.0.0+build",
    "1.0.0-dev.5+sha",
    "1.0.0-",
    "1.0.0-a..b",
    "1.0.0-01",
    "1.0.0foo",
    "v1.0.0",
  ];
  const entry = JSON.parse(read("entry.json"));
  const pkg = (version: string) => ({ name: "n", version, description: "d", author: "a" });

  test.each(accepted)("validate and publish both accept %s", (version) => {
    expect(validatePackage(pkg(version)).filter((p) => p.field === "version")).toEqual([]);
    expect(validateEntry({ ...entry, version }).filter((p) => p.field === "entry.version")).toEqual(
      [],
    );
  });

  test.each(refused)("validate and publish both refuse %s", (version) => {
    expect(validatePackage(pkg(version)).map((p) => p.field)).toContain("version");
    expect(validateEntry({ ...entry, version }).map((p) => p.field)).toContain("entry.version");
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

  test("a pre-release is marked as one on GitHub and a release is not", () => {
    expect(releaseArgs(published.entry, published)).not.toContain("--prerelease");
    const dev = { ...published.entry, version: "1.2.0-dev.5" };
    expect(releaseArgs(dev, published)).toContain("--prerelease");
  });

  test("the store PR refuses a pre-release before it runs anything", () => {
    const calls: string[][] = [];
    const exec: Runner = (command, args) => {
      calls.push([command, ...args]);
      return "";
    };
    const dev = { ...published.entry, version: "1.2.0-dev.5" };
    expect(() => openStorePr(dev, exec)).toThrow("pre-release");
    expect(calls).toEqual([]);
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
