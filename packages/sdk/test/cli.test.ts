import { describe, expect, test } from "bun:test";
import { wrapper } from "../src/cli/build.ts";
import { validatePackage } from "../src/cli/validate.ts";

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
      'import Plugin from "/p/src/main.ts";\nimport { start } from "jensen-plugin-sdk";\nstart(Plugin);\n',
    );
  });
});
