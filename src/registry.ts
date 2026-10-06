import type { Component } from "./component.ts";
import type { CustomPaneView, PaneOptions, PaneView, PaneViewConstructor } from "./pane.ts";
import type { MenuTarget } from "./plugin.ts";
import { HandlerIds, type HandlerScope } from "./serialize.ts";
import type { SettingContainer, SettingTab } from "./settings.ts";
import type { Menu, StatusBarItem } from "./ui.ts";

export interface CommandSpec {
  id: string;
  name: string;
  /** A Lucide icon name Jensen ships. */
  icon?: string;
  category?: string;
  /** A default chord such as "Mod+Shift+H". Users can rebind it in Settings. */
  hotkey?: { key: string; when?: string };
  /** Return false to say the command is not available right now. */
  check?: () => boolean | Promise<boolean>;
  callback: () => void | Promise<void>;
}

export interface PaneRegistration {
  view: PaneViewConstructor;
  options: PaneOptions;
  custom: boolean;
}

export interface PaneInstance {
  view: PaneView<unknown> | CustomPaneView<unknown>;
  scope: HandlerScope | null;
}

export interface MenuRegistration {
  target: MenuTarget;
  build: (menu: Menu, context: Record<string, unknown>) => void | Promise<void>;
}

/** What a running plugin has registered, so Jensen's callbacks can find it again. Internal to the SDK. */
export class Registry {
  readonly ids = new HandlerIds();
  readonly commands = new Map<string, CommandSpec>();
  readonly panes = new Map<string, PaneRegistration>();
  readonly instances = new Map<string, PaneInstance>();
  readonly settingTabs = new Map<string, SettingTab>();
  readonly settingRenders = new Map<string, SettingContainer>();
  readonly menus = new Map<string, MenuRegistration>();
  readonly menuCallbacks = new Map<string, Map<string, () => void | Promise<void>>>();
  readonly statusItems = new Map<string, StatusBarItem>();
  readonly markdown = new Map<string, (source: string) => string | Promise<string>>();
  owner?: Component;
}
