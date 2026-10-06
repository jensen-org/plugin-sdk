import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { buildOnce } from "../../src/cli/build.ts";
import { TestHost } from "../../src/testing.ts";

const example = resolve(import.meta.dir, "../../examples/hello-pane");
const bundle = resolve(example, "main.js");

afterAll(() => rmSync(bundle, { force: true }));

describe("a plugin built with jensen-plugin build", () => {
  test("boots from the port Jensen hands it and registers everything the example declares", async () => {
    await buildOnce({ cwd: example, minify: false });
    expect(existsSync(bundle)).toBe(true);

    const host = new TestHost({
      asGlobalPort: true,
      respond: { "storage.load": () => ({ clicks: 3 }), "editor.active": () => null },
    });
    await import(`${bundle}?run=${Date.now()}`);
    await host.settle();
    await host.settle();

    const methods = host.calls.map((call) => call.method);
    expect(methods[0]).toBe("plugin.hello");
    expect(methods.at(-1)).toBe("plugin.ready");
    expect(host.callsTo("workspace.registerPane").map((p) => p.id)).toEqual(["dashboard", "clock"]);
    expect(host.callsTo("commands.register").map((c) => c.id)).toEqual(["open", "date"]);
    expect(host.callsTo("settings.registerTab")).toHaveLength(1);
    expect(host.callsTo("ui.registerMenu")).toHaveLength(1);

    const out = await host.request("pane.render", {
      paneId: "dashboard",
      instanceId: "i1",
      state: { filter: "" },
    });
    expect(JSON.stringify(out)).toContain("Hello, Jensen");
    expect(JSON.stringify(out)).toContain("Clicked 3 times");
    host.close();
  });
});
