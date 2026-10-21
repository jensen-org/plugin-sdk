import { describe, expect, test } from "bun:test";
import { wrapper } from "../../src/cli/build.ts";
import { validatePackage } from "../../src/cli/validate.ts";

const good = {
  name: "hello",
  version: "1.0.0",
  description: "d",
  author: "a",
  jensen: {
    id: "dev.me.hello",
    minAppVersion: "0.3.0",
    permissions: { workspace: true, editor: "write", fs: ["docs"] },
  },
};

describe("validatePackage", () => {
  test("accepts a complete package", () => {
    expect(validatePackage(good)).toEqual([]);
  });

  test("asks for what Jensen shows before an install", () => {
    const fields = validatePackage({ jensen: { minAppVersion: "0.3.0" } }).map((p) => p.field);
    expect(fields).toEqual(["name", "version", "description", "author"]);
  });

  test("explains the retired blocks instead of ignoring them", () => {
    const problems = validatePackage({
      ...good,
      jensen: { ...good.jensen, contributes: {}, activationEvents: ["onStartup"] },
    });
    expect(problems.map((p) => p.field)).toEqual(["jensen.contributes", "jensen.activationEvents"]);
  });

  test("rejects an unknown permission, a wrong type and an escaping fs scope", () => {
    const problems = validatePackage({
      ...good,
      jensen: {
        ...good.jensen,
        permissions: { telepathy: true, theme: "yes", editor: "all", fs: ["../secrets", "/etc"] },
      },
    });
    expect(problems.map((p) => p.field).sort()).toEqual([
      "jensen.permissions.editor",
      "jensen.permissions.fs",
      "jensen.permissions.fs",
      "jensen.permissions.telepathy",
      "jensen.permissions.theme",
    ]);
  });

  test("requires a block, an id in the right shape and a minimum app version", () => {
    expect(validatePackage({ ...good, jensen: undefined }).map((p) => p.field)).toEqual(["jensen"]);
    const bad = validatePackage({ ...good, jensen: { id: "Bad Id" } });
    expect(bad.map((p) => p.field)).toEqual(["jensen.id", "jensen.minAppVersion"]);
  });
});

describe("the bundle entry", () => {
  test("hands the plugin class to the SDK", () => {
    expect(wrapper("/p/src/main.ts")).toBe(
      'import Plugin from "/p/src/main.ts";\nimport { start } from "@jensen-org/plugin-sdk";\nstart(Plugin);\n',
    );
  });
});

describe("validatePackage for backends", () => {
  const base = {
    name: "x",
    version: "1.0.0",
    description: "d",
    author: "a",
  };
  const block = (extra: Record<string, unknown>) => ({
    ...base,
    jensen: { id: "dev.me.x", minAppVersion: "0.3.0", ...extra },
  });
  const fields = (extra: Record<string, unknown>) =>
    validatePackage(block(extra)).map((problem) => problem.field);

  test("accepts file type scopes and a dot for every file", () => {
    for (const scope of ["*.png", "*", ".", "src"]) {
      expect(fields({ permissions: { fs: [scope] } })).toEqual([]);
    }
    for (const scope of ["**", "*.", "src/*.png", "../x"]) {
      expect(fields({ permissions: { fs: [scope] } })).toContain("jensen.permissions.fs");
    }
  });

  test("ties the backend permission, the wasm path and the tools together", () => {
    expect(fields({ backend: "backend.wasm", permissions: { backend: true } })).toEqual([]);
    expect(fields({ backend: "backend.wasm" })).toContain("jensen.permissions.backend");
    expect(fields({ permissions: { backend: true } })).toContain("jensen.backend");
    expect(fields({ backend: "../b.wasm", permissions: { backend: true } })).toContain(
      "jensen.backend",
    );
    expect(fields({ tools: [], permissions: {} })).toEqual([]);
    expect(
      fields({
        tools: [{ name: "Bad", description: "", inputSchema: 1 }],
        backend: "b.wasm",
        permissions: { backend: true },
      }),
    ).toEqual([
      "jensen.tools[0].name",
      "jensen.tools[0].description",
      "jensen.tools[0].inputSchema",
    ]);
  });
});
