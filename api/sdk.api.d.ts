// app-settings.d.ts
import type { HostConnection } from "./connection.ts";
import { Events } from "./events.ts";
/** Jensen's own settings. Needs `settings` in the manifest. */
export declare class AppSettings extends Events<{
    change: [{
        key: string;
        value: unknown;
    }];
}> {
    private readonly host;
    constructor(host: HostConnection);
    get<T = unknown>(key: string): Promise<T>;
    set(key: string, value: unknown): Promise<null>;
}

// app.d.ts
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
/**
 * The object graph a plugin works through: the workspace, the editor, the project's files, the theme,
 * commands and settings, the file viewers and the plugin's own backend, plus the code graph, knowledge
 * base, git and network when the manifest asks.
 */
export declare class App {
    readonly connection: HostConnection;
    readonly hello: Hello;
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
    constructor(connection: HostConnection, hello: Hello);
    get pluginId(): string;
    /** The version of Jensen this plugin is running in. */
    get appVersion(): string;
    /**
     * True when this copy of the plugin runs inside one of its own custom panes. Registrations are
     * skipped there, because the copy that runs headless has already made them.
     */
    get isSurface(): boolean;
    /** A raw protocol call. Prefer the classes on this object. */
    call<K extends MethodName>(method: K, params: MethodMap[K]["params"]): Promise<MethodMap[K]["result"]>;
}

// backend.d.ts
import type { HostConnection } from "./connection.ts";
export interface BackendResult<T> {
    result: T;
    /** The project paths the backend wrote or deleted during the call. */
    touched: string[];
}
/**
 * The plugin's own WebAssembly program, the one `entry.backend` names in the manifest. It needs
 * `backend: true` under permissions and reaches only the files the `fs` scopes allow. Jensen refreshes
 * any open tab on a path the backend touched, so an image viewer shows the new pixels at once.
 */
export declare class Backend {
    private readonly host;
    constructor(host: HostConnection);
    /** Calls one backend method and returns what it answered. */
    call<T = unknown>(method: string, input?: unknown): Promise<T>;
    /** Like `call`, and also reports the paths the backend touched. */
    run<T = unknown>(method: string, input?: unknown): Promise<BackendResult<T>>;
}

// base64.d.ts
export declare function toBase64(bytes: Uint8Array): string;
export declare function fromBase64(text: string): Uint8Array;

// cli/build.d.ts
import { type PackageJson, type Problem } from "./validate.ts";
export interface BuildOptions {
    cwd: string;
    minify: boolean;
}
export declare function readPackage(cwd: string): PackageJson;
export declare function entryFor(cwd: string, pkg: PackageJson): string;
/** The module esbuild bundles: the plugin's class, handed to the SDK to run. */
export declare function wrapper(entry: string): string;
export declare function checkProject(cwd: string): Problem[];
export declare function buildBackend(cwd: string, pkg: PackageJson): void;
export declare function buildOnce(options: BuildOptions): Promise<void>;
export declare function watch(options: BuildOptions, onRebuild: () => void): Promise<() => Promise<void>>;

// cli/create.d.ts
export interface Answers {
    directory: string;
    id: string;
    name: string;
    description: string;
    author: string;
    sdkVersion: string;
    backend?: boolean;
}
export declare function slug(text: string): string;
export declare function files(answers: Answers): Record<string, string>;
export declare function write(root: string, entries: Record<string, string>): string[];
export declare function create(argv: string[]): Promise<number>;

// cli/main.d.ts
export declare function main(argv: string[]): Promise<number>;

// cli/publish.d.ts
import type { PackageJson, Problem } from "./validate.ts";
export declare const RELEASE_DIR = "release";
export declare const MANIFEST_ASSET = "manifest.json";
export declare const MAIN_ASSET = "main.js";
export declare const README_ASSET = "README.md";
export declare const API_VERSION = 1;
export declare const STORE_REPO = "jensen-org/plugins-store";
export interface StoreEntry {
    id: string;
    name: string;
    author: string;
    description: string;
    category: string;
    version: string;
    min_app_version: string;
    repo: string;
    tag?: string;
    sha256: string;
}
export interface Published {
    manifestJson: string;
    entry: StoreEntry;
    releaseDir: string;
    assets: string[];
}
export declare function validateEntry(entry: StoreEntry): Problem[];
export declare function sha256Hex(bytes: string | Uint8Array): string;
export declare function assemble(cwd: string, pkg: PackageJson): Published;
export declare function releaseTag(entry: StoreEntry): string;
export declare function releaseArgs(entry: StoreEntry, published: Published): string[];
export declare function entryFile(entry: StoreEntry): string;
export interface Runner {
    (command: string, args: string[], cwd?: string): string;
}
export declare const run: Runner;
export declare function createRelease(entry: StoreEntry, published: Published, exec?: Runner): void;
export declare function openStorePr(entry: StoreEntry, exec?: Runner): string;
export interface PublishOptions {
    cwd: string;
    minify: boolean;
    build: boolean;
    release: boolean;
    storePr: boolean;
}
export declare function publish(options: PublishOptions): Promise<StoreEntry>;

// cli/skill.d.ts
export declare const SKILL_NAME = "jensen-plugin-sdk";
export type SkillTarget = "agents" | "claude" | "all";
export interface InstallOptions {
    root: string;
    target?: SkillTarget;
    dir?: string;
    force?: boolean;
}
export interface Installed {
    destination: string;
    files: string[];
}
export declare function bundledSkillDir(): string;
export declare function isTarget(value: string): value is SkillTarget;
export declare function destinationsFor(options: InstallOptions): string[];
export declare function listFiles(dir: string, base?: string): string[];
export declare function installSkill(options: InstallOptions): Installed[];
export declare function describeInstall(installed: Installed[], root: string): string;
export declare function skill(argv: string[], cwd: string): number;

// cli/validate.d.ts
export interface Problem {
    field: string;
    message: string;
}
export interface PackageJson {
    name?: string;
    version?: string;
    description?: string;
    author?: unknown;
    jensen?: Record<string, unknown>;
}
/** Checks what `jensen-plugin publish` will derive a manifest from, so a mistake shows up before a release. */
export declare function validatePackage(pkg: PackageJson): Problem[];

// commands.d.ts
import type { HostConnection } from "./connection.ts";
export declare class Commands {
    private readonly host;
    constructor(host: HostConnection);
    /** Runs any command, Jensen's own or another plugin's. Needs `workspace` in the manifest. */
    execute(id: string, args?: unknown): Promise<null>;
    list(): Promise<Array<{
        id: string;
        name: string;
        category?: string;
    }>>;
}
export declare class Keymap {
    private readonly host;
    constructor(host: HostConnection);
    /** The chords a command is bound to now, after the user's own changes. */
    get(commandId: string): Promise<string[]>;
}

// component.d.ts
import { type Disposable } from "./disposable.ts";
import type { EventRef } from "./events.ts";
/**
 * Anything with a lifetime. Whatever it registers is undone, newest first, when it unloads, so a
 * plugin never has to remember to clean up after itself.
 */
export declare class Component {
    private readonly store;
    private readonly children;
    private loaded;
    load(): Promise<void>;
    unload(): Promise<void>;
    onload(): void | Promise<void>;
    onunload(): void | Promise<void>;
    addChild<T extends Component>(child: T): T;
    removeChild<T extends Component>(child: T): T;
    register(cleanup: () => void): void;
    registerDisposable<T extends Disposable>(item: T): T;
    registerEvent(ref: EventRef): void;
    registerInterval(id: number): number;
}

// connection.d.ts
import { type Disposable } from "./disposable.ts";
import { type CallbackMap, type CallbackName, type EventMap, type EventName, type MethodMap, type MethodName } from "./protocol/index.ts";
export type CallbackHandlers = {
    [K in CallbackName]?: (params: CallbackMap[K]["params"]) => CallbackMap[K]["result"] | Promise<CallbackMap[K]["result"]>;
};
export interface HostPort {
    postMessage(message: unknown): void;
    onmessage: ((event: {
        data: unknown;
    }) => void) | null;
    start?(): void;
    close?(): void;
}
/** The plugin's end of the port Jensen hands it at boot. Everything the SDK does goes through here. */
export declare class HostConnection {
    private readonly port;
    private seq;
    private readonly pending;
    private readonly handlers;
    private readonly subscribers;
    private closed;
    constructor(port: HostPort);
    static fromGlobal(): HostConnection;
    call<K extends MethodName>(method: K, params: MethodMap[K]["params"]): Promise<MethodMap[K]["result"]>;
    handle<K extends CallbackName>(name: K, handler: NonNullable<CallbackHandlers[K]>): void;
    subscribe<K extends EventName>(topic: K, listener: (payload: EventMap[K]) => void): Disposable;
    close(): void;
    private receive;
    private answer;
    private reply;
}

// context.d.ts
import type { App } from "./app.ts";
export declare function setCurrentApp(app: App | null): void;
export declare function currentApp(): App;

// disposable.d.ts
export interface Disposable {
    dispose(): void;
}
export declare class DisposableStore implements Disposable {
    private items;
    private disposed;
    add<T extends Disposable>(item: T): T;
    addCallback(cleanup: () => void): void;
    dispose(): void;
}
export declare function toDisposable(cleanup: () => void): Disposable;

// editor.d.ts
import type { HostConnection } from "./connection.ts";
import { Events } from "./events.ts";
import type { ActiveEditor, Decoration, Position, Range, Tone } from "./protocol/index.ts";
export interface EditorSelection {
    text: string;
    from: Position;
    to: Position;
}
/** Decorations Jensen draws on top of the code editor. They are visual only and never change the buffer. */
export declare const Decorations: {
    mark: (from: number, to: number, options?: {
        tone?: Tone;
        tooltip?: string;
    }) => Decoration;
    line: (line: number, tone?: Tone) => Decoration;
    gutter: (line: number, text: string, options?: {
        tone?: Tone;
        tooltip?: string;
    }) => Decoration;
    hint: (at: number, text: string, tone?: Tone) => Decoration;
};
/**
 * The code editor. Reading needs `editor: "read"` in the manifest, changing the buffer needs `"write"`.
 * Offsets are UTF-16 code units, the way CodeMirror counts them.
 */
export declare class Editor extends Events<{
    change: [{
        path: string | null;
        lineCount: number;
    }];
    "selection-change": [{
        path: string | null;
        selection: Range;
        cursor: Position;
    }];
    "active-change": [ActiveEditor | null];
    save: [{
        path: string;
    }];
}> {
    private readonly host;
    constructor(host: HostConnection);
    active(): Promise<ActiveEditor | null>;
    getValue(path?: string): Promise<string>;
    getSelection(): Promise<EditorSelection>;
    openFile(path: string, position?: {
        line?: number;
        column?: number;
    }): Promise<null>;
    /** Moves an open tab to another path, for example after the plugin converted the file. */
    retarget(from: string, to: string): Promise<null>;
    replaceRange(from: number, to: number, text: string): Promise<null>;
    replaceSelection(text: string): Promise<null>;
    insert(text: string, at?: number): Promise<null>;
    save(path?: string): Promise<null>;
    decorate(key: string, path: string, decorations: Decoration[]): Promise<null>;
    clearDecorations(key: string): Promise<null>;
}

// errors.d.ts
import type { Capability, ErrorCode } from "./protocol/index.ts";
export declare class HostError extends Error {
    readonly code: ErrorCode;
    readonly capability?: Capability;
    constructor(code: ErrorCode, message: string, capability?: Capability);
}
export declare class NotInJensenError extends Error {
    constructor();
}

// events.d.ts
import { type Disposable } from "./disposable.ts";
export type EventRef = Disposable;
export declare class Events<E extends {
    [name: string]: unknown[];
}> {
    private listeners;
    on<K extends keyof E>(name: K, listener: (...args: E[K]) => void): EventRef;
    trigger<K extends keyof E>(name: K, ...args: E[K]): void;
    clear(): void;
}

// files.d.ts
import type { HostConnection } from "./connection.ts";
import { type Disposable } from "./disposable.ts";
import { Events } from "./events.ts";
import type { FileStat } from "./protocol/index.ts";
export declare abstract class FileSystemEntry {
    readonly path: string;
    constructor(path: string);
    get name(): string;
}
export declare class FileEntry extends FileSystemEntry {
    readonly size: number;
    readonly modifiedMs?: number | undefined;
    constructor(path: string, size: number, modifiedMs?: number | undefined);
    get extension(): string;
}
export declare class FolderEntry extends FileSystemEntry {
}
export interface FileChange {
    path: string;
    from?: string;
}
/**
 * The project's files. Every path is relative to the project root and has to fall inside a scope
 * listed under `fs` in the manifest: a folder such as "docs", a file type such as "*.png", or "." for
 * every file. Jensen enforces the scopes below the plugin and not in it, after the user consents.
 */
export declare class Files extends Events<{
    create: [FileChange];
    modify: [FileChange];
    delete: [FileChange];
    rename: [FileChange];
}> {
    private readonly host;
    constructor(host: HostConnection);
    read(path: string): Promise<string>;
    write(path: string, contents: string): Promise<null>;
    /** Reads a file of any format, such as an image. */
    readBytes(path: string): Promise<Uint8Array>;
    /** Writes bytes to a file, creating parent folders. Open tabs on the path refresh. */
    writeBytes(path: string, data: Uint8Array): Promise<null>;
    list(path: string): Promise<Array<FileEntry | FolderEntry>>;
    stat(path: string): Promise<FileStat | null>;
    exists(path: string): Promise<boolean>;
    mkdir(path: string): Promise<null>;
    delete(path: string, options?: {
        recursive?: boolean;
    }): Promise<null>;
    rename(from: string, to: string): Promise<null>;
    watch(path: string, listener?: (change: FileChange) => void): Promise<Disposable>;
}

// index.d.ts
export { App, type Hello } from "./app.ts";
export { Backend, type BackendResult } from "./backend.ts";
export { type PackageJson, type Problem, validatePackage } from "./cli/validate.ts";
export { Commands, Keymap } from "./commands.ts";
export { Component } from "./component.ts";
export { HostConnection } from "./connection.ts";
export { type Disposable, DisposableStore, toDisposable } from "./disposable.ts";
export { Decorations, Editor, type EditorSelection } from "./editor.ts";
export { HostError, NotInJensenError } from "./errors.ts";
export { type EventRef, Events } from "./events.ts";
export { type FileChange, FileEntry, FileSystemEntry, Files, FolderEntry } from "./files.ts";
export { CustomPaneView, type PaneContext, type PaneOptions, PaneView, type PaneViewConstructor, } from "./pane.ts";
export { type MenuContexts, type MenuTarget, Plugin, requireApiVersion, } from "./plugin.ts";
export * from "./protocol/index.ts";
export type { CommandSpec } from "./registry.ts";
export { Git, Graph, Knowledge, Net } from "./services.ts";
export { ButtonComponent, ColorComponent, DropdownComponent, NumberComponent, Setting, SettingContainer, SettingTab, SliderComponent, TextAreaComponent, TextComponent, ToggleComponent, } from "./settings.ts";
export { type StartOptions, start } from "./start.ts";
export { TestHost, type TestHostOptions } from "./testing.ts";
export { Theme, type ThemeDocument } from "./theme.ts";
export type { UiNode } from "./ui/index.ts";
export * as ui from "./ui/index.ts";
export { ChoiceModal, ConfirmModal, Menu, MenuItem, Notice, type NoticeOptions, PromptModal, StatusBarItem, SuggestModal, } from "./ui.ts";
export { Viewer, type ViewerFile, type ViewerMatch } from "./viewer.ts";
export { type LayoutChange, type OpenPaneOptions, PaneLeaf, Workspace } from "./workspace.ts";

// pane.d.ts
import type { App } from "./app.ts";
import type { Plugin } from "./plugin.ts";
import type { UiNode } from "./ui/index.ts";
export interface PaneContext<S = unknown> {
    app: App;
    plugin: Plugin;
    paneId: string;
    instanceId: string;
    state: S;
}
/**
 * A pane Jensen draws for the plugin. `render()` returns a tree of `@jensen-org/plugin-sdk/ui` nodes and Jensen paints
 * it with its own components, so the pane matches the app and follows the theme. After a handler runs,
 * Jensen asks for `render()` again.
 */
export declare abstract class PaneView<S = unknown> {
    readonly ctx: PaneContext<S>;
    protected current: S;
    constructor(ctx: PaneContext<S>);
    get app(): App;
    get plugin(): Plugin;
    get instanceId(): string;
    /** What this pane was opened with and last stored. Jensen keeps it with the layout across restarts. */
    get state(): S;
    setState(next: S): Promise<void>;
    refresh(): Promise<null>;
    onOpen(): void | Promise<void>;
    onClose(): void | Promise<void>;
    abstract render(): UiNode[] | Promise<UiNode[]>;
}
/**
 * A pane that draws its own DOM, for what a tree of nodes cannot express. It runs in a sandboxed
 * frame beside Jensen: Jensen's theme is applied to it as CSS custom properties.
 */
export declare abstract class CustomPaneView<S = unknown> {
    readonly ctx: PaneContext<S>;
    constructor(ctx: PaneContext<S>);
    get app(): App;
    get plugin(): Plugin;
    get state(): S;
    abstract onMount(element: HTMLElement): void | Promise<void>;
    onUnmount(): void | Promise<void>;
}
export type PaneViewConstructor<S = unknown> = new (ctx: PaneContext<S>) => PaneView<S> | CustomPaneView<S>;
export interface PaneOptions {
    title: string;
    /** A Lucide icon name Jensen ships, such as "rocket" or "terminal". */
    icon?: string;
    /** Only one instance may exist, whatever asks for another. */
    singleton?: boolean;
}
export declare function isCustom<S>(view: PaneViewConstructor<S>): boolean;

// plugin.d.ts
import type { App } from "./app.ts";
import { Component } from "./component.ts";
import { type Disposable } from "./disposable.ts";
import { type PaneOptions, type PaneViewConstructor } from "./pane.ts";
import type { API_VERSION } from "./protocol/index.ts";
import { type CommandSpec, Registry } from "./registry.ts";
import type { SettingTab } from "./settings.ts";
import type { ThemeDocument } from "./theme.ts";
import type { UiNode } from "./ui/index.ts";
import { type Menu, StatusBarItem } from "./ui.ts";
import type { ViewerMatch } from "./viewer.ts";
export type MenuTarget = "explorer" | "editor" | "pane" | "tab";
export interface MenuContexts {
    explorer: {
        path: string;
        targets: string[];
        isDirectory: boolean;
    };
    editor: {
        path: string;
        hasSelection: boolean;
    };
    pane: {
        instanceId: string;
        paneKind: string | null;
    };
    tab: {
        path: string | null;
    };
}
export type ApiVersion = typeof API_VERSION;
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
export declare abstract class Plugin extends Component {
    readonly app: App;
    /** @internal */
    readonly registry: Registry;
    constructor(app: App);
    get id(): string;
    /** The `when` that limits a hotkey to one of this plugin's panes. */
    paneFocus(paneId: string): string;
    loadData<T = unknown>(): Promise<T | null>;
    saveData(data: unknown): Promise<null>;
    addCommand(spec: CommandSpec): Disposable;
    registerPane<S = unknown>(id: string, view: PaneViewConstructor<S>, options: PaneOptions): Disposable;
    addSettingTab(tab: SettingTab): Disposable;
    addStatusBarItem(id?: string): StatusBarItem;
    registerMenu<T extends MenuTarget>(target: T, build: (menu: Menu, context: MenuContexts[T]) => void | Promise<void>, id?: string): Disposable;
    /**
     * Adds a toolbar to the viewers that show a matching file, such as the image page. `render` returns
     * `ui` nodes for the file in `context.path`; Jensen calls it again after a handler runs, when the file
     * changes, and on `app.viewer.refresh(id)`.
     */
    registerViewerToolbar(id: string, match: ViewerMatch, render: (context: {
        path: string;
    }) => UiNode[] | Promise<UiNode[]>): Disposable;
    registerMarkdownRenderer(language: string, render: (source: string) => string | Promise<string>): Disposable;
    registerTheme(document: ThemeDocument): Disposable;
    private track;
}
/** True when this Jensen speaks at least the given protocol version. */
export declare function requireApiVersion(app: App, version: number): boolean;

// registry.d.ts
import type { Component } from "./component.ts";
import type { CustomPaneView, PaneOptions, PaneView, PaneViewConstructor } from "./pane.ts";
import type { MenuTarget } from "./plugin.ts";
import { HandlerIds, type HandlerScope } from "./serialize.ts";
import type { SettingContainer, SettingTab } from "./settings.ts";
import type { UiNode } from "./ui/index.ts";
import type { Menu, StatusBarItem } from "./ui.ts";
export interface CommandSpec {
    id: string;
    name: string;
    /** A Lucide icon name Jensen ships. */
    icon?: string;
    category?: string;
    /** A default chord such as "Mod+Shift+H". Users can rebind it in Settings. */
    hotkey?: {
        key: string;
        when?: string;
    };
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
export interface ViewerToolbarRegistration {
    render: (context: {
        path: string;
    }) => UiNode[] | Promise<UiNode[]>;
    scope: HandlerScope | null;
}
/** What a running plugin has registered, so Jensen's callbacks can find it again. Internal to the SDK. */
export declare class Registry {
    readonly ids: HandlerIds;
    readonly commands: Map<string, CommandSpec>;
    readonly panes: Map<string, PaneRegistration>;
    readonly instances: Map<string, PaneInstance>;
    readonly settingTabs: Map<string, SettingTab>;
    readonly settingRenders: Map<string, SettingContainer>;
    readonly menus: Map<string, MenuRegistration>;
    readonly menuCallbacks: Map<string, Map<string, () => void | Promise<void>>>;
    readonly statusItems: Map<string, StatusBarItem>;
    readonly viewerToolbars: Map<string, ViewerToolbarRegistration>;
    readonly markdown: Map<string, (source: string) => string | Promise<string>>;
    owner?: Component;
}

// serialize.d.ts
/** Turns the functions a pane puts in its tree into handler ids Jensen can call back. */
export declare class HandlerScope {
    private readonly nextId;
    private readonly handlers;
    constructor(nextId: () => string);
    serialize<T>(value: T): unknown;
    get(id: string): ((payload: unknown) => void | Promise<void>) | undefined;
}
export declare class HandlerIds {
    private seq;
    next: () => string;
}

// services.d.ts
import type { HostConnection } from "./connection.ts";
type Result<T> = Promise<T>;
export declare class Graph {
    private readonly host;
    constructor(host: HostConnection);
    explainService<T = unknown>(service: string): Result<T>;
    dependencies<T = unknown>(target: string, options?: {
        incoming?: boolean;
    }): Result<T>;
    impact<T = unknown>(target: string): Result<T>;
    query<T = unknown>(query: string): Result<T>;
}
export declare class Knowledge {
    private readonly host;
    constructor(host: HostConnection);
    search<T = unknown>(query: string, options?: {
        k?: number;
    }): Result<T>;
    ingest<T = unknown>(path: string): Result<T>;
}
export declare class Git {
    private readonly host;
    constructor(host: HostConnection);
    history<T = unknown>(options?: {
        path?: string;
        limit?: number;
    }): Result<T>;
    semanticDiff<T = unknown>(path: string): Result<T>;
}
export interface FetchOptions {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
}
export declare class Net {
    private readonly host;
    constructor(host: HostConnection);
    /** An https request to a host listed under `network` in the manifest. */
    fetch(host: string, path: string, options?: FetchOptions): Promise<{
        status: number;
        body: string;
    }>;
}
export {};

// settings.d.ts
import type { App } from "./app.ts";
import type { Plugin } from "./plugin.ts";
import type { SettingControl, Tone } from "./protocol/index.ts";
type Change<T> = (value: T) => void | Promise<void>;
export declare class SettingContainer {
    private readonly thunks;
    readonly changes: Map<string, Change<never>>;
    readonly actions: Map<string, () => void | Promise<void>>;
    private seq;
    nextKey(): string;
    push(control: () => SettingControl): void;
    addHeading(text: string): this;
    addDescription(text: string): this;
    controls(): SettingControl[];
}
export declare class TextComponent {
    value: string;
    placeholder?: string;
    handler?: Change<string>;
    setValue(value: string): this;
    setPlaceholder(placeholder: string): this;
    onChange(handler: Change<string>): this;
}
export declare class TextAreaComponent extends TextComponent {
}
export declare class NumberComponent {
    value: number;
    min?: number;
    max?: number;
    step?: number;
    handler?: Change<number>;
    setValue(value: number): this;
    setLimits(min: number, max: number, step?: number): this;
    onChange(handler: Change<number>): this;
}
export declare class SliderComponent extends NumberComponent {
    min: number;
    max: number;
}
export declare class ToggleComponent {
    value: boolean;
    handler?: Change<boolean>;
    setValue(value: boolean): this;
    onChange(handler: Change<boolean>): this;
}
export declare class DropdownComponent {
    value: string;
    options: {
        value: string;
        label: string;
    }[];
    handler?: Change<string>;
    addOption(value: string, label: string): this;
    addOptions(options: Record<string, string>): this;
    setValue(value: string): this;
    onChange(handler: Change<string>): this;
}
export declare class ColorComponent {
    value: string;
    handler?: Change<string>;
    setValue(value: string): this;
    onChange(handler: Change<string>): this;
}
export declare class ButtonComponent {
    label: string;
    tone?: Tone;
    handler?: () => void | Promise<void>;
    setButtonText(label: string): this;
    setWarning(): this;
    onClick(handler: () => void | Promise<void>): this;
}
/**
 * One row of a settings tab, built the way Obsidian's `Setting` is. Jensen draws the row with its own
 * components, so a plugin's settings look and behave like the rest of Settings.
 */
export declare class Setting {
    private readonly container;
    private name;
    private desc?;
    private built;
    constructor(container: SettingContainer);
    setName(name: string): this;
    setDesc(desc: string): this;
    setHeading(): this;
    addText(build: (component: TextComponent) => void): this;
    addTextArea(build: (component: TextAreaComponent) => void): this;
    addNumber(build: (component: NumberComponent) => void): this;
    addSlider(build: (component: SliderComponent) => void): this;
    addToggle(build: (component: ToggleComponent) => void): this;
    addDropdown(build: (component: DropdownComponent) => void): this;
    addColor(build: (component: ColorComponent) => void): this;
    addButton(build: (component: ButtonComponent) => void): this;
    private control;
}
/** A section in Settings, under Extensions. Fill `containerEl` in `display()`. */
export declare abstract class SettingTab {
    readonly app: App;
    readonly plugin: Plugin;
    readonly id: string;
    readonly title: string;
    containerEl: SettingContainer;
    constructor(app: App, plugin: Plugin, options?: {
        id?: string;
        title?: string;
    });
    abstract display(): void | Promise<void>;
    /** Asks Jensen to draw the section again, for example after the plugin's data changed. */
    refresh(): Promise<null>;
}
export {};

// start.d.ts
import { App } from "./app.ts";
import { HostConnection } from "./connection.ts";
import type { Plugin } from "./plugin.ts";
export interface StartOptions {
    /** Defaults to the port Jensen handed this realm at boot. Tests pass a `TestHost` connection. */
    connection?: HostConnection;
}
/**
 * Runs a plugin. The bundle `jensen-plugin build` writes calls this for you; call it yourself only if
 * you bundle by hand.
 */
export declare function start(Ctor: new (app: App) => Plugin, options?: StartOptions): Promise<Plugin>;

// theme.d.ts
import type { HostConnection } from "./connection.ts";
import { type Disposable } from "./disposable.ts";
import { Events } from "./events.ts";
import type { ActiveTheme, ThemeInfo } from "./protocol/index.ts";
/** A theme document, as described by Jensen's `schema/theme.schema.json`. Jensen validates it. */
export type ThemeDocument = Record<string, unknown> & {
    id: string;
};
export declare class Theme extends Events<{
    change: [ActiveTheme];
}> {
    private readonly host;
    private active;
    constructor(host: HostConnection, initial: ActiveTheme);
    get current(): ActiveTheme;
    get tokens(): Record<string, string>;
    get appearance(): "light" | "dark";
    list(): Promise<ThemeInfo[]>;
    set(id: string): Promise<null>;
    register(document: ThemeDocument): Promise<Disposable>;
    /** Writes Jensen's tokens onto an element as CSS custom properties, for a pane that draws its own DOM. */
    applyTo(element: {
        style: {
            setProperty(name: string, value: string): void;
        };
    }): void;
}

// ui.d.ts
import type { App } from "./app.ts";
import type { HostConnection } from "./connection.ts";
import type { Severity, Tone } from "./protocol/index.ts";
export interface NoticeOptions {
    severity?: Severity;
    timeoutMs?: number;
}
/** A toast. `new Notice("Saved")` works anywhere inside a running plugin. */
export declare class Notice {
    constructor(message: string, options?: NoticeOptions);
}
export declare class ConfirmModal {
    private readonly app;
    private readonly options;
    constructor(app: App, options: {
        title: string;
        message: string;
        confirmLabel?: string;
        danger?: boolean;
    });
    open(): Promise<boolean>;
}
export declare class ChoiceModal {
    private readonly app;
    private readonly options;
    constructor(app: App, options: {
        title: string;
        message: string;
        choices: {
            id: string;
            label: string;
        }[];
    });
    open(): Promise<string | null>;
}
export declare class PromptModal {
    private readonly app;
    private readonly options;
    constructor(app: App, options: {
        title: string;
        message?: string;
        placeholder?: string;
        initial?: string;
        confirmLabel?: string;
    });
    open(): Promise<string | null>;
}
export interface SuggestOptions<T> {
    title: string;
    placeholder?: string;
    items: T[];
    getText: (item: T) => string;
    getDetail?: (item: T) => string | undefined;
    getIcon?: (item: T) => string | undefined;
}
/** A searchable list. `open()` resolves to the picked item, or null when dismissed. */
export declare class SuggestModal<T> {
    private readonly app;
    private readonly options;
    constructor(app: App, options: SuggestOptions<T>);
    open(): Promise<T | null>;
}
export declare class MenuItem {
    title: string;
    icon?: string;
    disabled: boolean;
    separatorBefore: boolean;
    callback?: () => void | Promise<void>;
    submenu?: Menu;
    setTitle(title: string): this;
    setIcon(icon: string): this;
    setDisabled(disabled: boolean): this;
    setSeparatorBefore(): this;
    onClick(callback: () => void | Promise<void>): this;
    setSubmenu(): Menu;
}
export declare class Menu {
    readonly items: MenuItem[];
    addItem(build: (item: MenuItem) => void): this;
    addSeparator(): this;
}
export declare class StatusBarItem {
    private readonly connection;
    readonly id: string;
    private readonly register;
    private state;
    private callback?;
    private scheduled;
    private removed;
    constructor(connection: HostConnection, id: string, register: boolean);
    setText(text: string): this;
    setIcon(icon: string): this;
    setTooltip(tooltip: string): this;
    setTone(tone: Tone): this;
    onClick(callback: () => void | Promise<void>): this;
    click(): void | Promise<void>;
    remove(): Promise<void>;
    private push;
}

// viewer.d.ts
import type { HostConnection } from "./connection.ts";
import { Events } from "./events.ts";
export interface ViewerFile {
    /** The path of the file being shown, relative to the project root. */
    path: string;
    /** The kind of viewer showing it, such as "image". */
    kind: string;
}
export interface ViewerMatch {
    /** Viewer kinds to add the toolbar to, such as "image". */
    kinds?: string[];
    /** File extensions to add the toolbar to, without the dot. */
    extensions?: string[];
}
/** The file viewers Jensen draws, such as the image page, and which file each is showing. */
export declare class Viewer extends Events<{
    change: [ViewerFile | null];
}> {
    private readonly host;
    private current;
    constructor(host: HostConnection);
    /** The file the focused viewer is showing, or null when none is. */
    get active(): ViewerFile | null;
    /** Asks Jensen to draw a toolbar again, after the plugin's own state changed. */
    refresh(toolbarId: string): Promise<null>;
}

// workspace.d.ts
import type { HostConnection } from "./connection.ts";
import { Events } from "./events.ts";
import type { Direction, PaneInfo } from "./protocol/index.ts";
export declare class PaneLeaf {
    private readonly host;
    readonly info: PaneInfo;
    constructor(host: HostConnection, info: PaneInfo);
    get instanceId(): string;
    get paneId(): string | undefined;
    get pluginId(): string | undefined;
    get kind(): string;
    get title(): string;
    get active(): boolean;
    focus(): Promise<void>;
    close(): Promise<void>;
    setState(state: unknown): Promise<void>;
    refresh(): Promise<void>;
    moveNextTo(reference: PaneLeaf, direction: Direction): Promise<void>;
}
export interface LayoutChange {
    page: "session" | "code" | "notes";
    panes: PaneLeaf[];
}
export interface OpenPaneOptions {
    state?: unknown;
    direction?: Direction;
    reference?: PaneLeaf;
    focus?: boolean;
}
/**
 * The panes on screen. Jensen has exactly three pages, and a plugin cannot add or change them:
 * what a plugin adds is panes, as many as it likes.
 */
export declare class Workspace extends Events<{
    "pane-open": [PaneLeaf];
    "pane-close": [string];
    "active-change": [PaneLeaf | null];
    "layout-change": [LayoutChange];
}> {
    private readonly host;
    constructor(host: HostConnection);
    currentPage(): Promise<"session" | "code" | "notes">;
    listPanes(): Promise<PaneLeaf[]>;
    getLeavesOfType(paneId: string): Promise<PaneLeaf[]>;
    openPane(paneId: string, options?: OpenPaneOptions): Promise<PaneLeaf>;
}
