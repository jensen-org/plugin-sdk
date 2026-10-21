import { AppSettings } from "./app-settings.ts";
import { Backend } from "./backend.ts";
import { Commands, Keymap } from "./commands.ts";
import type { HostConnection } from "./connection.ts";
import { Editor } from "./editor.ts";
import { Files } from "./files.ts";
import type { MethodMap, MethodName } from "./protocol/index.ts";
import { Git, Graph, Knowledge, Net } from "./services.ts";
import { Theme } from "./theme.ts";
import { Viewer } from "./viewer.ts";
import { Workspace } from "./workspace.ts";

export type Hello = MethodMap["plugin.hello"]["result"];

const REGISTRATIONS = new Set<MethodName>([
  "workspace.registerPane",
  "workspace.unregisterPane",
  "commands.register",
  "commands.unregister",
  "settings.registerTab",
  "settings.unregisterTab",
  "viewer.registerToolbar",
  "viewer.unregisterToolbar",
  "ui.registerMenu",
  "ui.unregisterMenu",
  "ui.setStatus",
  "ui.removeStatus",
  "markdown.registerRenderer",
  "markdown.unregisterRenderer",
  "theme.register",
  "theme.unregister",
]);

/**
 * The object graph a plugin works through: the workspace, the editor, the project's files, the theme,
 * commands and settings, the file viewers and the plugin's own backend, plus the code graph, knowledge
 * base, git and network when the manifest asks.
 */
export class App {
  readonly workspace: Workspace;
  readonly editor: Editor;
  readonly files: Files;
  readonly theme: Theme;
  readonly commands: Commands;
  readonly keymap: Keymap;
  readonly settings: AppSettings;
  readonly graph: Graph;
  readonly knowledge: Knowledge;
  readonly git: Git;
  readonly net: Net;
  readonly backend: Backend;
  readonly viewer: Viewer;

  constructor(
    readonly connection: HostConnection,
    readonly hello: Hello,
  ) {
    this.workspace = new Workspace(connection);
    this.editor = new Editor(connection);
    this.files = new Files(connection);
    this.theme = new Theme(connection, hello.theme);
    this.commands = new Commands(connection);
    this.keymap = new Keymap(connection);
    this.settings = new AppSettings(connection);
    this.graph = new Graph(connection);
    this.knowledge = new Knowledge(connection);
    this.git = new Git(connection);
    this.net = new Net(connection);
    this.backend = new Backend(connection);
    this.viewer = new Viewer(connection);
  }

  get pluginId(): string {
    return this.hello.pluginId;
  }

  /** The version of Jensen this plugin is running in. */
  get appVersion(): string {
    return this.hello.appVersion;
  }

  /**
   * True when this copy of the plugin runs inside one of its own custom panes. Registrations are
   * skipped there, because the copy that runs headless has already made them.
   */
  get isSurface(): boolean {
    return this.hello.surface.kind === "pane";
  }

  /** A raw protocol call. Prefer the classes on this object. */
  call<K extends MethodName>(
    method: K,
    params: MethodMap[K]["params"],
  ): Promise<MethodMap[K]["result"]> {
    if (this.isSurface && REGISTRATIONS.has(method)) return Promise.resolve(null as never);
    return this.connection.call(method, params);
  }
}
