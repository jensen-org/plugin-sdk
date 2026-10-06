import { App } from "./app.ts";
import { HostConnection } from "./connection.ts";
import { setCurrentApp } from "./context.ts";
import { type CustomPaneView, type PaneContext, PaneView } from "./pane.ts";
import type { Plugin } from "./plugin.ts";
import type { MenuItem as WireMenuItem } from "./protocol/index.ts";
import { API_VERSION } from "./protocol/index.ts";
import { HandlerScope } from "./serialize.ts";
import { SettingContainer } from "./settings.ts";
import { Menu, type MenuItem } from "./ui.ts";

export interface StartOptions {
  /** Defaults to the port Jensen handed this realm at boot. Tests pass a `TestHost` connection. */
  connection?: HostConnection;
}

function toWire(
  menu: Menu,
  next: () => string,
  callbacks: Map<string, () => void | Promise<void>>,
): WireMenuItem[] {
  return menu.items
    .filter((item) => item.title !== "" || item.separatorBefore)
    .map((item: MenuItem) => {
      const id = next();
      if (item.callback) callbacks.set(id, item.callback);
      return {
        id,
        label: item.title,
        icon: item.icon,
        disabled: item.disabled || undefined,
        separatorBefore: item.separatorBefore || undefined,
        children: item.submenu ? toWire(item.submenu, next, callbacks) : undefined,
      };
    });
}

function wire(plugin: Plugin, app: App): void {
  const registry = plugin.registry;
  const host = app.connection;

  host.handle("command.run", async ({ id }) => {
    const spec = registry.commands.get(id);
    if (!spec) throw new Error(`no command '${id}'`);
    await spec.callback();
    return null;
  });
  host.handle("command.check", async ({ id }) => {
    const spec = registry.commands.get(id);
    return spec ? ((await spec.check?.()) ?? true) : false;
  });

  const instantiate = (paneId: string, instanceId: string, state: unknown) => {
    const registration = registry.panes.get(paneId);
    if (!registration) throw new Error(`no pane '${paneId}'`);
    const context: PaneContext = { app, plugin, paneId, instanceId, state };
    const view = new (
      registration.view as unknown as new (
        c: PaneContext,
      ) => PaneView | CustomPaneView
    )(context);
    registry.instances.set(instanceId, { view, scope: null });
    return view;
  };

  host.handle("pane.open", async ({ paneId, instanceId, state }) => {
    const view = instantiate(paneId, instanceId, state);
    if (view instanceof PaneView) await view.onOpen();
    return null;
  });
  host.handle("pane.render", async ({ paneId, instanceId, state }) => {
    const existing = registry.instances.get(instanceId);
    const view = existing?.view ?? instantiate(paneId, instanceId, state);
    if (!(view instanceof PaneView)) {
      throw new Error(`pane '${paneId}' draws its own DOM and cannot render a node tree`);
    }
    const nodes = await view.render();
    const scope = new HandlerScope(registry.ids.next);
    const children = scope.serialize(nodes) as never;
    const instance = registry.instances.get(instanceId);
    if (instance) instance.scope = scope;
    return { children };
  });
  host.handle("pane.close", async ({ instanceId }) => {
    const instance = registry.instances.get(instanceId);
    registry.instances.delete(instanceId);
    if (instance?.view instanceof PaneView) await instance.view.onClose();
    return null;
  });
  host.handle("node.event", async ({ handler, payload }) => {
    for (const instance of registry.instances.values()) {
      const found = instance.scope?.get(handler);
      if (found) {
        await found(payload);
        return null;
      }
    }
    throw new Error(`no handler '${handler}': it was replaced by a newer render`);
  });

  host.handle("settings.render", async ({ tabId }) => {
    const tab = registry.settingTabs.get(tabId);
    if (!tab) throw new Error(`no settings tab '${tabId}'`);
    const container = new SettingContainer();
    tab.containerEl = container;
    await tab.display();
    registry.settingRenders.set(tabId, container);
    return { controls: container.controls() };
  });
  host.handle("settings.change", async ({ tabId, key, value }) => {
    const handler = registry.settingRenders.get(tabId)?.changes.get(key);
    if (!handler) throw new Error(`setting '${key}' has no change handler`);
    await (handler as (v: unknown) => void | Promise<void>)(value);
    return null;
  });
  host.handle("settings.action", async ({ tabId, key }) => {
    const action = registry.settingRenders.get(tabId)?.actions.get(key);
    if (!action) throw new Error(`setting '${key}' has no action`);
    await action();
    return null;
  });

  host.handle("menu.build", async ({ menuId, context }) => {
    const registration = registry.menus.get(menuId);
    if (!registration) throw new Error(`no menu '${menuId}'`);
    const menu = new Menu();
    await registration.build(menu, context);
    let seq = 0;
    const callbacks = new Map<string, () => void | Promise<void>>();
    const items = toWire(menu, () => `m${++seq}`, callbacks);
    registry.menuCallbacks.set(menuId, callbacks);
    return items;
  });
  host.handle("menu.select", async ({ menuId, itemId }) => {
    const callback = registry.menuCallbacks.get(menuId)?.get(itemId);
    if (!callback) throw new Error(`menu '${menuId}' has no item '${itemId}' any more`);
    await callback();
    return null;
  });

  host.handle("status.click", async ({ id }) => {
    await registry.statusItems.get(id)?.click();
    return null;
  });
  host.handle("markdown.render", async ({ id, source }) => {
    const render = registry.markdown.get(id);
    if (!render) throw new Error(`no markdown renderer '${id}'`);
    return { html: await render(source) };
  });
  host.handle("plugin.unload", async () => {
    await plugin.unload();
    return null;
  });
}

async function mountSurface(plugin: Plugin, app: App): Promise<void> {
  const surface = app.hello.surface;
  if (surface.kind !== "pane") return;
  const registration = plugin.registry.panes.get(surface.paneId);
  if (!registration?.custom) {
    throw new Error(`pane '${surface.paneId}' is not a custom pane this plugin registered`);
  }
  const root = document.documentElement;
  app.theme.applyTo(root);
  app.theme.on("change", () => app.theme.applyTo(root));
  document.body.style.cssText =
    "margin:0;height:100vh;background:var(--bg-0);color:var(--fg);font:var(--text-body)/1.5 var(--font)";
  const element = document.createElement("div");
  element.id = "jensen-pane";
  element.style.cssText = "height:100%";
  document.body.append(element);
  const context: PaneContext = {
    app,
    plugin,
    paneId: surface.paneId,
    instanceId: surface.instanceId,
    state: surface.state,
  };
  const view = new (registration.view as unknown as new (c: PaneContext) => CustomPaneView)(
    context,
  );
  await view.onMount(element);
  addEventListener("pagehide", () => {
    Promise.resolve(view.onUnmount()).catch((cause) => {
      queueMicrotask(() => {
        throw cause;
      });
    });
  });
}

function announceFailure(cause: unknown): void {
  const message = cause instanceof Error ? cause.message : String(cause);
  (globalThis as { parent?: { postMessage(m: unknown, o: string): void } }).parent?.postMessage(
    { kind: "jensen:error", message },
    "*",
  );
}

/**
 * Runs a plugin. The bundle `jensen-plugin build` writes calls this for you; call it yourself only if
 * you bundle by hand.
 */
export async function start(
  Ctor: new (app: App) => Plugin,
  options: StartOptions = {},
): Promise<Plugin> {
  try {
    const connection = options.connection ?? HostConnection.fromGlobal();
    const hello = await connection.call("plugin.hello", { apiVersion: API_VERSION });
    const app = new App(connection, hello);
    setCurrentApp(app);
    const plugin = new Ctor(app);
    if (hello.surface.kind === "headless") wire(plugin, app);
    await plugin.load();
    if (hello.surface.kind === "headless") await connection.call("plugin.ready", {});
    else await mountSurface(plugin, app);
    return plugin;
  } catch (cause) {
    announceFailure(cause);
    throw cause;
  }
}
