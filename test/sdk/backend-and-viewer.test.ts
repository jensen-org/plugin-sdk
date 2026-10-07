import { afterEach, describe, expect, test } from "bun:test";
import { Plugin, start, TestHost, ui } from "../../src/index.ts";

let host: TestHost;

afterEach(() => host?.close());

async function run(
  Ctor: new (app: never) => Plugin,
  options?: ConstructorParameters<typeof TestHost>[0],
) {
  host = new TestHost(options);
  return start(Ctor as never, { connection: host.connection });
}

class Empty extends Plugin {}

describe("binary files", () => {
  test("round trips bytes through base64, including values above 127", async () => {
    const plugin = await run(Empty, { respond: { "fs.readBytes": () => "AP8QgA==" } });

    const bytes = await plugin.app.files.readBytes("a/logo.png");
    expect([...bytes]).toEqual([0, 255, 16, 128]);

    await plugin.app.files.writeBytes("a/out.png", new Uint8Array([0, 255, 16, 128]));
    expect(host.callsTo("fs.writeBytes")).toEqual([{ path: "a/out.png", data: "AP8QgA==" }]);
  });

  test("moves an open tab to the file a conversion produced", async () => {
    const plugin = await run(Empty);

    await plugin.app.editor.retarget("a.png", "a.webp");

    expect(host.callsTo("editor.retarget")).toEqual([{ from: "a.png", to: "a.webp" }]);
  });
});

describe("the backend", () => {
  test("calls a method and returns its answer, or the answer with the paths it touched", async () => {
    const plugin = await run(Empty, {
      respond: {
        "backend.call": ({ method }) => ({ result: { method }, touched: ["a.png"] }),
      },
    });

    expect(await plugin.app.backend.call<{ method: string }>("resize", { width: 8 })).toEqual({
      method: "resize",
    });
    expect(await plugin.app.backend.run("resize")).toEqual({
      result: { method: "resize" },
      touched: ["a.png"],
    });
    expect(host.callsTo("backend.call")[0]).toEqual({ method: "resize", input: { width: 8 } });
  });
});

describe("viewer toolbars", () => {
  class Toolbar extends Plugin {
    clicks: string[] = [];
    override onload() {
      this.registerViewerToolbar("tools", { kinds: ["image"], extensions: ["svg"] }, ({ path }) => [
        ui.Text(`editing ${path}`),
        ui.Button({ label: "Go", onClick: () => void this.clicks.push(path) }),
      ]);
    }
  }

  test("registers with the kinds and extensions it matches", async () => {
    await run(Toolbar as never);

    expect(host.callsTo("viewer.registerToolbar")).toEqual([
      { id: "tools", kinds: ["image"], extensions: ["svg"] },
    ]);
  });

  test("renders for the file and routes a click back to the handler", async () => {
    const plugin = (await run(Toolbar as never)) as Toolbar;

    const out = await host.request("viewer.render", { toolbarId: "tools", path: "img/a.png" });
    expect(JSON.stringify(out)).toContain("editing img/a.png");
    const handler = JSON.stringify(out).match(/"handler":"(h\d+)"/)?.[1];
    expect(handler).toBeDefined();

    await host.request("node.event", { handler: handler as string });
    expect(plugin.clicks).toEqual(["img/a.png"]);
  });

  test("refuses a toolbar it never registered, and unregisters on unload", async () => {
    const plugin = (await run(Toolbar as never)) as Toolbar;

    await expect(
      host.request("viewer.render", { toolbarId: "nope", path: "a.png" }),
    ).rejects.toThrow("no viewer toolbar");
    await plugin.unload();
    await host.settle();
    expect(host.callsTo("viewer.unregisterToolbar")).toEqual([{ id: "tools" }]);
  });

  test("tells the plugin which file the viewer shows and can ask for a redraw", async () => {
    const plugin = await run(Empty);
    const seen: Array<unknown> = [];
    plugin.app.viewer.on("change", (file) => seen.push(file));

    host.emit("viewer.activeChanged", { path: "a.png", kind: "image" });
    await host.settle();
    await plugin.app.viewer.refresh("tools");

    expect(seen).toEqual([{ path: "a.png", kind: "image" }]);
    expect(plugin.app.viewer.active).toEqual({ path: "a.png", kind: "image" });
    expect(host.callsTo("viewer.refreshToolbar")).toEqual([{ id: "tools" }]);
  });
});
