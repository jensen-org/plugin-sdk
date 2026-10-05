import { afterEach, describe, expect, test } from "bun:test";
import {
  CustomPaneView,
  HostError,
  Notice,
  PaneView,
  Plugin,
  Setting,
  SettingTab,
  start,
  TestHost,
  ui,
} from "../src/index.ts";

let host: TestHost;

afterEach(() => host?.close());

async function run(
  Ctor: new (app: never) => Plugin,
  options?: ConstructorParameters<typeof TestHost>[0],
) {
  host = new TestHost(options);
  const plugin = await start(Ctor as never, { connection: host.connection });
  return plugin;
}

class Empty extends Plugin {}

describe("starting a plugin", () => {
  test("says hello with the protocol version, loads, and then says it is ready", async () => {
    await run(Empty);

    expect(host.callsTo("plugin.hello")).toEqual([{ apiVersion: 1 }]);
    expect(host.calls.map((call) => call.method)).toEqual(["plugin.hello", "plugin.ready"]);
  });

  test("runs onload before it reports ready, so a pane registered there is known to the host", async () => {
    class Registers extends Plugin {
      override onload() {
        this.registerPane(
          "view",
          class extends PaneView {
            render() {
              return [];
            }
          },
          { title: "View" },
        );
      }
    }
    await run(Registers);

    const order = host.calls.map((call) => call.method);
    expect(order.indexOf("workspace.registerPane")).toBeLessThan(order.indexOf("plugin.ready"));
  });

  test("tells the host a plugin failed to load, and rethrows", async () => {
    const posted: unknown[] = [];
    (globalThis as { parent?: unknown }).parent = { postMessage: (m: unknown) => posted.push(m) };
    class Broken extends Plugin {
      override onload() {
        throw new Error("nope");
      }
    }
    host = new TestHost();

    await expect(start(Broken as never, { connection: host.connection })).rejects.toThrow("nope");
    expect(posted).toEqual([{ kind: "jensen:error", message: "nope" }]);
    (globalThis as { parent?: unknown }).parent = undefined;
  });

  test("exposes who it is running as", async () => {
    const plugin = await run(Empty);
    expect(plugin.id).toBe("test.plugin");
    expect(plugin.app.appVersion).toBe("0.0.0");
    expect(plugin.paneFocus("view")).toBe("paneFocus:plugin:test.plugin/view");
  });
});

describe("commands", () => {
  class Commands extends Plugin {
    ran = 0;
    override onload() {
      this.addCommand({
        id: "say",
        name: "Say hello",
        category: "Hello",
        hotkey: { key: "Mod+Shift+H" },
        check: () => this.ran < 2,
        callback: () => {
          this.ran += 1;
        },
      });
    }
  }

  test("registers a command with its chord and says it has an availability check", async () => {
    await run(Commands);
    expect(host.callsTo("commands.register")).toEqual([
      {
        id: "say",
        name: "Say hello",
        icon: undefined,
        category: "Hello",
        hotkey: { key: "Mod+Shift+H" },
        checked: true,
      },
    ]);
  });

  test("runs the command when the host asks, and answers its availability", async () => {
    const plugin = (await run(Commands)) as Commands;
    await host.request("command.run", { id: "say" });
    await host.request("command.run", { id: "say" });

    expect(plugin.ran).toBe(2);
    expect(await host.request("command.check", { id: "say" })).toBe(false);
  });

  test("answers an unknown command with an error instead of staying silent", async () => {
    await run(Commands);
    await expect(host.request("command.run", { id: "ghost" })).rejects.toThrow("no command");
  });

  test("unregisters the command and everything else when it unloads", async () => {
    const plugin = await run(Commands);
    await host.request("plugin.unload", {});
    await host.settle();

    expect(host.callsTo("commands.unregister")).toEqual([{ id: "say" }]);
    expect(plugin).toBeDefined();
  });
});

describe("panes drawn by Jensen", () => {
  class Counter extends PaneView<{ n: number }> {
    onOpened = false;
    override onOpen() {
      this.onOpened = true;
    }
    render() {
      return [
        ui.Stack([
          ui.Heading(`Count ${this.state.n}`),
          ui.Button({
            label: "Add",
            onClick: async () => {
              await this.setState({ n: this.state.n + 1 });
            },
          }),
          ui.Input({ value: "x", onChange: () => undefined }),
        ]),
      ];
    }
  }
  class WithPane extends Plugin {
    override onload() {
      this.registerPane("counter", Counter, { title: "Counter", icon: "star" });
    }
  }

  test("registers a declarative pane under Plugins with its icon", async () => {
    await run(WithPane);
    expect(host.callsTo("workspace.registerPane")).toEqual([
      {
        id: "counter",
        title: "Counter",
        icon: "star",
        singleton: undefined,
        render: "declarative",
      },
    ]);
  });

  test("renders a tree with functions replaced by handler ids", async () => {
    await run(WithPane);
    await host.request("pane.open", { paneId: "counter", instanceId: "i1", state: { n: 1 } });

    const out = await host.request("pane.render", {
      paneId: "counter",
      instanceId: "i1",
      state: { n: 1 },
    });

    const stack = out.children[0] as { children: Array<Record<string, unknown>> };
    expect(stack.children[0]).toMatchObject({ type: "heading", text: "Count 1" });
    expect(stack.children[1]).toMatchObject({
      type: "button",
      onClick: { handler: expect.any(String) },
    });
    expect(JSON.stringify(out)).not.toContain("function");
  });

  test("runs a handler when the host reports the click, and stores the state it changed", async () => {
    await run(WithPane);
    await host.request("pane.open", { paneId: "counter", instanceId: "i1", state: { n: 1 } });
    const out = await host.request("pane.render", {
      paneId: "counter",
      instanceId: "i1",
      state: { n: 1 },
    });
    const button = (out.children[0] as { children: Array<{ onClick?: { handler: string } }> })
      .children[1];

    await host.request("node.event", { handler: button?.onClick?.handler ?? "" });

    expect(host.callsTo("workspace.setPaneState")).toEqual([{ instanceId: "i1", state: { n: 2 } }]);
  });

  test("refuses a handler a newer render has replaced, instead of running a stale closure", async () => {
    await run(WithPane);
    await host.request("pane.open", { paneId: "counter", instanceId: "i1", state: { n: 1 } });
    const first = await host.request("pane.render", {
      paneId: "counter",
      instanceId: "i1",
      state: { n: 1 },
    });
    await host.request("pane.render", { paneId: "counter", instanceId: "i1", state: { n: 1 } });
    const stale = (first.children[0] as { children: Array<{ onClick?: { handler: string } }> })
      .children[1]?.onClick?.handler;

    await expect(host.request("node.event", { handler: stale ?? "" })).rejects.toThrow("replaced");
  });

  test("closes the view and forgets the instance", async () => {
    await run(WithPane);
    await host.request("pane.open", { paneId: "counter", instanceId: "i1", state: { n: 1 } });
    await host.request("pane.close", { paneId: "counter", instanceId: "i1" });

    await expect(host.request("node.event", { handler: "h1" })).rejects.toThrow();
  });

  test("refuses a pane it never registered", async () => {
    await run(WithPane);
    await expect(
      host.request("pane.open", { paneId: "nope", instanceId: "i", state: null }),
    ).rejects.toThrow("no pane");
  });
});

describe("custom panes", () => {
  class Canvas extends CustomPaneView {
    mounted?: unknown;
    onMount(element: HTMLElement) {
      this.mounted = element;
    }
  }
  class WithCustom extends Plugin {
    override onload() {
      this.registerPane("canvas", Canvas, { title: "Canvas", singleton: true });
    }
  }

  test("registers a pane that draws its own DOM as custom, and rejects a render call for it", async () => {
    await run(WithCustom);
    expect(host.callsTo("workspace.registerPane")[0]).toMatchObject({
      render: "custom",
      singleton: true,
    });
    await expect(
      host.request("pane.render", { paneId: "canvas", instanceId: "i", state: null }),
    ).rejects.toThrow("draws its own DOM");
  });

  test("inside its own frame it makes no registrations, and mounts the pane into the page", async () => {
    const children: unknown[] = [];
    const style = new Map<string, string>();
    (globalThis as Record<string, unknown>).document = {
      documentElement: { style: { setProperty: (n: string, v: string) => style.set(n, v) } },
      body: { style: {}, append: (el: unknown) => children.push(el) },
      createElement: () => ({ style: {} }),
    };
    (globalThis as Record<string, unknown>).addEventListener = () => undefined;

    const plugin = await run(WithCustom, {
      surface: { kind: "pane", paneId: "canvas", instanceId: "i1", state: { a: 1 } },
      respond: {
        "plugin.hello": () => ({
          pluginId: "test.plugin",
          appVersion: "0",
          surface: { kind: "pane", paneId: "canvas", instanceId: "i1", state: { a: 1 } },
          theme: { id: "t", appearance: "dark", tokens: { "--bg-0": "#000" } },
        }),
      },
    });

    expect(host.callsTo("workspace.registerPane")).toEqual([]);
    expect(host.callsTo("plugin.ready")).toEqual([]);
    expect(children).toHaveLength(1);
    expect(style.get("--bg-0")).toBe("#000");
    expect(plugin.app.isSurface).toBe(true);
    delete (globalThis as Record<string, unknown>).document;
  });
});

describe("settings", () => {
  class Tab extends SettingTab {
    saved: unknown[] = [];
    clicked = 0;
    display() {
      this.containerEl.addHeading("General");
      new Setting(this.containerEl)
        .setName("Name")
        .setDesc("Shown in the status bar")
        .addText((t) =>
          t
            .setValue("Ada")
            .setPlaceholder("who")
            .onChange((v) => void this.saved.push(v)),
        );
      new Setting(this.containerEl)
        .setName("Loud")
        .addToggle((t) => t.setValue(true).onChange((v) => void this.saved.push(v)));
      new Setting(this.containerEl)
        .setName("Mode")
        .addDropdown((d) => d.addOptions({ a: "A", b: "B" }).setValue("a"));
      new Setting(this.containerEl)
        .setName("Size")
        .addSlider((s) => s.setLimits(1, 9, 2).setValue(3));
      new Setting(this.containerEl).setName("Reset").addButton((b) =>
        b
          .setButtonText("Reset all")
          .setWarning()
          .onClick(() => void this.clicked++),
      );
      new Setting(this.containerEl).setName("Advanced").setHeading();
    }
  }
  class WithTab extends Plugin {
    tab?: Tab;
    override onload() {
      this.tab = new Tab(this.app, this, { title: "Hello" });
      this.addSettingTab(this.tab);
    }
  }

  test("registers a tab under its title", async () => {
    await run(WithTab);
    expect(host.callsTo("settings.registerTab")).toEqual([{ id: "settings", title: "Hello" }]);
  });

  test("describes every control for the host to draw", async () => {
    await run(WithTab);
    const out = await host.request("settings.render", { tabId: "settings" });

    expect(out.controls.map((control) => control.type)).toEqual([
      "heading",
      "text",
      "toggle",
      "dropdown",
      "slider",
      "button",
      "heading",
    ]);
    expect(out.controls[1]).toMatchObject({
      name: "Name",
      desc: "Shown in the status bar",
      value: "Ada",
      placeholder: "who",
    });
    expect(out.controls[4]).toMatchObject({ min: 1, max: 9, step: 2, value: 3 });
    expect(out.controls[5]).toMatchObject({ label: "Reset all", tone: "danger" });
    expect(out.controls[6]).toMatchObject({ type: "heading", text: "Advanced" });
  });

  test("passes a change and a button press back to the right handler", async () => {
    const plugin = (await run(WithTab)) as WithTab;
    const out = await host.request("settings.render", { tabId: "settings" });
    const text = out.controls[1] as { key: string };
    const button = out.controls[5] as { key: string };

    await host.request("settings.change", { tabId: "settings", key: text.key, value: "Grace" });
    await host.request("settings.action", { tabId: "settings", key: button.key });

    expect(plugin.tab?.saved).toEqual(["Grace"]);
    expect(plugin.tab?.clicked).toBe(1);
  });

  test("answers a change for a control that does not exist with an error", async () => {
    await run(WithTab);
    await host.request("settings.render", { tabId: "settings" });
    await expect(
      host.request("settings.change", { tabId: "settings", key: "zzz", value: 1 }),
    ).rejects.toThrow("no change handler");
  });
});

describe("menus, status items, markdown, themes and storage", () => {
  class Everything extends Plugin {
    picked: string[] = [];
    override onload() {
      this.registerMenu("explorer", (menu, context) => {
        menu
          .addItem((item) =>
            item
              .setTitle(`Open ${context.path}`)
              .setIcon("star")
              .onClick(() => void this.picked.push(context.path)),
          )
          .addItem((item) =>
            item
              .setTitle("More")
              .setSubmenu()
              .addItem((sub) => sub.setTitle("Deep")),
          );
      });
      const status = this.addStatusBarItem("s1");
      status
        .setText("Ready")
        .setIcon("rocket")
        .setTone("success")
        .onClick(() => void this.picked.push("status"));
      this.registerMarkdownRenderer("shout", (source) => `<b>${source.toUpperCase()}</b>`);
      this.registerTheme({ id: "night", name: "Night" });
    }
  }

  test("builds a context menu from the plugin's items and runs the one that is chosen", async () => {
    const plugin = (await run(Everything)) as Everything;
    const items = await host.request("menu.build", {
      menuId: "explorer-1",
      context: { path: "src/a.ts", targets: [], isDirectory: false },
    });

    expect(items[0]).toMatchObject({ label: "Open src/a.ts", icon: "star" });
    expect(items[1]?.children?.[0]?.label).toBe("Deep");
    await host.request("menu.select", {
      menuId: "explorer-1",
      itemId: items[0]?.id ?? "",
      context: {},
    });
    expect(plugin.picked).toEqual(["src/a.ts"]);
  });

  test("keeps a status item in step with what the plugin sets, in one call per tick", async () => {
    const plugin = (await run(Everything)) as Everything;
    await host.settle();

    expect(host.callsTo("ui.setStatus")).toEqual([
      { id: "s1", text: "Ready", icon: "rocket", tone: "success", clickable: true },
    ]);
    await host.request("status.click", { id: "s1" });
    expect(plugin.picked).toEqual(["status"]);
  });

  test("renders markdown on request and registers the theme", async () => {
    await run(Everything);
    expect(await host.request("markdown.render", { id: "shout", source: "hi" })).toEqual({
      html: "<b>HI</b>",
    });
    expect(host.callsTo("theme.register")).toEqual([{ document: { id: "night", name: "Night" } }]);
  });

  test("loads and saves its own data", async () => {
    host = new TestHost({ respond: { "storage.load": () => ({ n: 4 }) } });
    const plugin = await start(Empty as never, { connection: host.connection });

    expect(await plugin.loadData<{ n: number }>()).toEqual({ n: 4 });
    await plugin.saveData({ n: 5 });
    expect(host.callsTo("storage.save")).toEqual([{ data: { n: 5 } }]);
  });
});

describe("talking to Jensen", () => {
  test("turns a refusal into a typed error that names the capability", async () => {
    host = new TestHost();
    host.respondTo("fs.read", () => {
      throw new Error("capability 'fs' is not granted");
    });
    const plugin = await start(Empty as never, { connection: host.connection });

    await expect(plugin.app.files.read("a.md")).rejects.toBeInstanceOf(HostError);
  });

  test("reads and writes files, lists a folder as files and folders, and stats", async () => {
    host = new TestHost();
    host.respondTo("fs.list", () => [
      { name: "a.md", kind: "file" as const, size: 5 },
      { name: "sub", kind: "dir" as const },
    ]);
    host.respondTo("fs.stat", ({ path }) =>
      path === "a.md" ? { kind: "file" as const, size: 5, modifiedMs: 1 } : null,
    );
    const plugin = await start(Empty as never, { connection: host.connection });

    const entries = await plugin.app.files.list("docs");
    expect(entries.map((entry) => [entry.constructor.name, entry.path, entry.name])).toEqual([
      ["FileEntry", "docs/a.md", "a.md"],
      ["FolderEntry", "docs/sub", "sub"],
    ]);
    expect(await plugin.app.files.exists("a.md")).toBe(true);
    expect(await plugin.app.files.exists("b.md")).toBe(false);
  });

  test("forwards editor events and the active editor", async () => {
    host = new TestHost();
    const plugin = await start(Empty as never, { connection: host.connection });
    const seen: unknown[] = [];
    plugin.app.editor.on("change", (payload) => void seen.push(payload));

    host.emit("editor.changed", { path: "a.ts", lineCount: 3 });
    await host.settle();

    expect(seen).toEqual([{ path: "a.ts", lineCount: 3 }]);
  });

  test("tracks the theme as it changes", async () => {
    host = new TestHost();
    const plugin = await start(Empty as never, { connection: host.connection });
    expect(plugin.app.theme.appearance).toBe("dark");

    host.emit("theme.changed", { id: "paper", appearance: "light", tokens: { "--bg-0": "#fff" } });
    await host.settle();

    expect(plugin.app.theme.appearance).toBe("light");
    expect(plugin.app.theme.tokens["--bg-0"]).toBe("#fff");
  });

  test("raises a toast through new Notice", async () => {
    await run(Empty);
    new Notice("Saved", { severity: "success" });
    await host.settle();
    expect(host.callsTo("ui.notice")).toEqual([
      { message: "Saved", severity: "success", timeoutMs: undefined },
    ]);
  });

  test("opens panes beside another and lists the ones it owns", async () => {
    host = new TestHost();
    host.respondTo("workspace.openPane", () => ({ instanceId: "i9" }));
    host.respondTo("workspace.listPanes", () => [
      {
        instanceId: "i9",
        kind: "plugin:test.plugin/v",
        ref: "",
        title: "V",
        active: true,
        paneId: "v",
        pluginId: "test.plugin",
      },
    ]);
    const plugin = await start(Empty as never, { connection: host.connection });

    const leaf = await plugin.app.workspace.openPane("v", { direction: "right", state: { a: 1 } });

    expect(leaf.instanceId).toBe("i9");
    expect(leaf.title).toBe("V");
    expect(host.callsTo("workspace.openPane")[0]).toMatchObject({
      paneId: "v",
      direction: "right",
      state: { a: 1 },
    });
    expect((await plugin.app.workspace.getLeavesOfType("v")).length).toBe(1);
  });

  test("has no way to add or change a page, only to read which one is showing", async () => {
    const { App, Plugin: PluginClass, Workspace } = await import("../src/index.ts");
    const names = [App, PluginClass, Workspace].flatMap((cls) =>
      Object.getOwnPropertyNames(cls.prototype),
    );
    const pageish = names.filter((name) => /page|route/i.test(name));
    expect(pageish).toEqual(["currentPage"]);
  });
});

describe("the connection", () => {
  test("ignores a message that is not protocol version 1", async () => {
    host = new TestHost();
    const plugin = await start(Empty as never, { connection: host.connection });
    const seen: unknown[] = [];
    plugin.app.theme.on("change", (t) => void seen.push(t));

    (host as unknown as { hostPort: MessagePort }).hostPort.postMessage({
      v: 2,
      kind: "evt",
      topic: "theme.changed",
      payload: { id: "x", appearance: "light", tokens: {} },
    });
    await host.settle();

    expect(seen).toEqual([]);
  });

  test("answers a callback it does not handle with an unsupported error", async () => {
    await run(Empty);
    await expect(host.request("markdown.render", { id: "x", source: "" })).rejects.toThrow(
      "no markdown renderer",
    );
  });

  test("fails with a message that says what to do when it runs outside Jensen", async () => {
    await expect(start(Empty as never)).rejects.toThrow("has to run inside Jensen");
  });
});
