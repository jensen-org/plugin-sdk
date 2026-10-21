import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { create, files, slug, write } from "../../src/cli/create.ts";
import { validatePackage } from "../../src/cli/validate.ts";

const answers = {
  directory: "demo",
  id: "dev.me.demo",
  name: "Demo Plugin",
  description: "A demo",
  author: "me",
  sdkVersion: "^0.1.0",
};

describe("jensen-plugin create", () => {
  test("makes a slug from any name", () => {
    expect(slug("Demo Plugin!")).toBe("demo-plugin");
    expect(slug("***")).toBe("my-plugin");
  });

  test("generates a package.json the SDK's own validator accepts", () => {
    const pkg = JSON.parse(files(answers)["package.json"] ?? "{}");
    expect(validatePackage(pkg)).toEqual([]);
    expect(pkg.dependencies["@jensen-org/plugin-sdk"]).toBe("^0.1.0");
    expect(pkg.jensen.permissions).toEqual({ workspace: true });
  });

  test("generates a plugin that registers a pane, a settings tab and a command", () => {
    const source = files(answers)["src/main.ts"] ?? "";
    expect(source).toContain("export default class DemoPlugin extends Plugin");
    expect(source).toContain("registerPane");
    expect(source).toContain("addSettingTab");
    expect(source).toContain("addCommand");
    expect(source).not.toContain("vault");
  });

  test("writes every file and refuses a directory that already has content", async () => {
    const root = mkdtempSync(join(tmpdir(), "jensen-create-"));
    const written = write(join(root, "demo"), files(answers));
    expect(written.sort()).toEqual([
      ".gitignore",
      "README.md",
      "package.json",
      "src/main.ts",
      "tsconfig.json",
    ]);
    expect(readFileSync(join(root, "demo/README.md"), "utf8")).toContain("# Demo Plugin");

    const previous = process.cwd();
    process.chdir(root);
    try {
      expect(await create(["demo", "--yes"])).toBe(1);
      expect(await create(["fresh", "--yes", "--name", "Fresh", "--id", "dev.me.fresh"])).toBe(0);
    } finally {
      process.chdir(previous);
    }
    expect(JSON.parse(readFileSync(join(root, "fresh/package.json"), "utf8")).jensen.id).toBe(
      "dev.me.fresh",
    );
  });
});

describe("create --backend", () => {
  test("scaffolds a rust backend, a viewer toolbar and a manifest that validates", () => {
    const answers = {
      directory: "x",
      id: "dev.me.pics",
      name: "Pics",
      description: "d",
      author: "me",
      sdkVersion: "^0.2.0",
      backend: true,
    };
    const out = files(answers);
    const pkg = JSON.parse(out["package.json"] ?? "{}");

    expect(Object.keys(out)).toContain("backend/src/lib.rs");
    expect(out["backend/Cargo.toml"]).toContain("jensen-plugin-backend");
    expect(out["src/main.ts"]).toContain("registerViewerToolbar");
    expect(pkg.jensen.backend).toBe("backend.wasm");
    expect(pkg.jensen.backendBuild).toContain("pics.wasm");
    expect(validatePackage(pkg)).toEqual([]);
  });
});
