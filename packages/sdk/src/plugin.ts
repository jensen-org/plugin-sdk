import type { API_VERSION } from "jensen-plugin-protocol";
import type { App } from "./app.ts";
import { Component } from "./component.ts";
import { type Disposable, toDisposable } from "./disposable.ts";
import { isCustom, type PaneOptions, type PaneViewConstructor } from "./pane.ts";
import { type CommandSpec, Registry } from "./registry.ts";
import type { SettingTab } from "./settings.ts";
import type { ThemeDocument } from "./theme.ts";
import { type Menu, StatusBarItem } from "./ui.ts";

export type MenuTarget = "explorer" | "editor" | "pane" | "tab";

export interface MenuContexts {
  explorer: { path: string; targets: string[]; isDirectory: boolean };
  editor: { path: string; hasSelection: boolean };
  pane: { instanceId: string; paneKind: string | null };
  tab: { path: string | null };
}

export type ApiVersion = typeof API_VERSION;

function report(cause: unknown): void {
  queueMicrotask(() => {
    throw cause;
  });
}

/**
 * The one class a plugin extends. Register what the plugin adds in `onload()`; everything registered
 * through it is removed again when the plugin unloads.
 *
 * ```ts
 * export default class Hello extends Plugin {
 *   onload() {
 *     this.addCommand({ id: "say", name: "Say hello", hotkey: { key: "Mod+Shift+H" }, callback: () => new Notice("Hello") });
 *   }
 * }
 * ```
 */
export abstract class Plugin extends Component {
  /** @internal */
  readonly registry = new Registry();

  constructor(readonly app: App) {
    super();
    this.registry.owner = this;
  }

  get id(): string {
    return this.app.pluginId;
  }

  /** The `when` that limits a hotkey to one of this plugin's panes. */
  paneFocus(paneId: string): string {
    return `paneFocus:plugin:${this.id}/${paneId}`;
  }

  async loadData<T = unknown>(): Promise<T | null> {
    return (await this.app.call("storage.load", {})) as T | null;
  }

  saveData(data: unknown): Promise<null> {
    return this.app.call("storage.save", { data });
  }

  addCommand(spec: CommandSpec): Disposable {
    this.registry.commands.set(spec.id, spec);
    this.app
      .call("commands.register", {
        id: spec.id,
        name: spec.name,
        icon: spec.icon,
        category: spec.category,
        hotkey: spec.hotkey,
        checked: spec.check !== undefined,
      })
      .catch(report);
    return this.track(() => {
      this.registry.commands.delete(spec.id);
      this.app.call("commands.unregister", { id: spec.id }).catch(report);
    });
  }

  registerPane<S = unknown>(
    id: string,
    view: PaneViewConstructor<S>,
    options: PaneOptions,
  ): Disposable {
    const custom = isCustom(view);
    this.registry.panes.set(id, { view: view as PaneViewConstructor, options, custom });
    this.app
      .call("workspace.registerPane", {
        id,
        title: options.title,
        icon: options.icon,
        singleton: options.singleton,
        render: custom ? "custom" : "declarative",
      })
      .catch(report);
    return this.track(() => {
      this.registry.panes.delete(id);
      this.app.call("workspace.unregisterPane", { id }).catch(report);
    });
  }

  addSettingTab(tab: SettingTab): Disposable {
    this.registry.settingTabs.set(tab.id, tab);
    this.app.call("settings.registerTab", { id: tab.id, title: tab.title }).catch(report);
    return this.track(() => {
      this.registry.settingTabs.delete(tab.id);
      this.app.call("settings.unregisterTab", { id: tab.id }).catch(report);
    });
  }

  addStatusBarItem(id = `status-${this.registry.statusItems.size + 1}`): StatusBarItem {
    const item = new StatusBarItem(this.app.connection, id, !this.app.isSurface);
    this.registry.statusItems.set(id, item);
    this.track(() => {
      this.registry.statusItems.delete(id);
      item.remove().catch(report);
    });
    return item;
  }

  registerMenu<T extends MenuTarget>(
    target: T,
    build: (menu: Menu, context: MenuContexts[T]) => void | Promise<void>,
    id = `${target}-${this.registry.menus.size + 1}`,
  ): Disposable {
    this.registry.menus.set(id, {
      target,
      build: build as (menu: Menu, context: Record<string, unknown>) => void | Promise<void>,
    });
    this.app.call("ui.registerMenu", { id, target }).catch(report);
    return this.track(() => {
      this.registry.menus.delete(id);
      this.app.call("ui.unregisterMenu", { id }).catch(report);
    });
  }

  registerMarkdownRenderer(
    language: string,
    render: (source: string) => string | Promise<string>,
  ): Disposable {
    this.registry.markdown.set(language, render);
    this.app.call("markdown.registerRenderer", { id: language, language }).catch(report);
    return this.track(() => {
      this.registry.markdown.delete(language);
      this.app.call("markdown.unregisterRenderer", { id: language }).catch(report);
    });
  }

  registerTheme(document: ThemeDocument): Disposable {
    this.app.call("theme.register", { document }).catch(report);
    return this.track(() => {
      this.app.call("theme.unregister", { id: document.id }).catch(report);
    });
  }

  private track(cleanup: () => void): Disposable {
    const disposable = toDisposable(cleanup);
    this.registerDisposable(disposable);
    return disposable;
  }
}

/** True when this Jensen speaks at least the given protocol version. */
export function requireApiVersion(app: App, version: number): boolean {
  return app.hello.appVersion !== "" && version <= (1 as ApiVersion);
}
