# API overview

Source of truth: the `api/*.api.d.ts` reports in the SDK repository (`sdk`, `ui`, `protocol`, `testing`).

## Entry points

| Import | Holds |
|---|---|
| `@jensen-org/plugin-sdk` | `Plugin`, `Component`, `App`, `PaneView`, `CustomPaneView`, settings classes, `Notice` and modals, `Menu`, `StatusBarItem`, `Decorations`, `HostError`, `start`, the `ui` namespace, `TestHost`, and everything from the protocol |
| `@jensen-org/plugin-sdk/ui` | the pane node builders (`Stack`, `Heading`, `Button` and the rest), `themeVars`, `BASE_CSS` |
| `@jensen-org/plugin-sdk/protocol` | wire types: `MethodMap`, `CallbackMap`, `EventMap`, `Node`, `Tone`, `Capability`, `ErrorCode`, `API_VERSION` |
| `@jensen-org/plugin-sdk/testing` | `TestHost` and `TestHostOptions` |

The protocol version `API_VERSION` is `1`. `requireApiVersion(app, 1)` is true when the running Jensen speaks at least that version.

## Plugin and Component

`Plugin extends Component` and is the one class you write. Members:

| Member | Notes |
|---|---|
| `app: App`, `id` | the object graph and the plugin id |
| `onload()`, `onunload()` | both may be async. Register in `onload()` |
| `loadData<T>()`, `saveData(data)` | the plugin's own JSON data. `loadData` returns `null` when nothing was saved |
| `addCommand(spec)` | `CommandSpec`: `id`, `name`, `icon?`, `category?`, `hotkey?: { key, when? }`, `check?`, `callback` |
| `registerPane(id, View, options)` | `options`: `title`, `icon?`, `singleton?` |
| `addSettingTab(tab)` | a `SettingTab` subclass |
| `addStatusBarItem(id?)` | returns a `StatusBarItem` |
| `registerMenu(target, build, id?)` | targets `explorer`, `editor`, `pane`, `tab` |
| `registerMarkdownRenderer(language, render)` | `render(source)` returns an html string |
| `registerTheme(document)` | needs `theme` |
| `paneFocus(paneId)` | the `when` string that limits a hotkey to one of your panes |
| `register(cleanup)`, `registerDisposable(item)`, `registerEvent(ref)`, `registerInterval(id)` | tie your own resources to the plugin's lifetime |
| `addChild(component)`, `removeChild(component)` | nest `Component`s that load and unload with the plugin |

Cleanup is automatic and runs newest first. `Disposable` is `{ dispose(): void }`, `DisposableStore` collects
several, `toDisposable(fn)` wraps a function.

## App

`this.app` members: `workspace`, `editor`, `files`, `theme`, `commands`, `keymap`, `settings` (Jensen's own
settings), `graph`, `knowledge`, `git`, `net`, plus `pluginId`, `appVersion`, `isSurface`, `hello`,
`connection` and `call(method, params)` for a raw protocol call (prefer the classes).

Event emitters (`workspace`, `editor`, `files`, `theme`, `settings`) share `on(name, listener)` returning an
`EventRef`. Pass it to `this.registerEvent(ref)` so it is removed on unload.

| Emitter | Events |
|---|---|
| `workspace` | `pane-open`, `pane-close`, `active-change`, `layout-change` |
| `editor` | `change`, `selection-change`, `active-change`, `save` |
| `files` | `create`, `modify`, `delete`, `rename` (after `files.watch`) |
| `theme` | `change` |
| `settings` | `change` |

Services return `Promise<T>` where `T` defaults to `unknown`, so pass a type argument:
`this.app.git.history<Commit[]>({ limit: 20 })`. `graph`: `explainService`, `dependencies`, `impact`, `query`.
`knowledge`: `search`, `ingest`. `git`: `history`, `semanticDiff`. `net.fetch(host, path, options)` returns
`{ status, body }` for an https host listed under `network`.

## UI classes

`Notice(message, { severity?, timeoutMs? })`, `ConfirmModal`, `ChoiceModal`, `PromptModal` and `SuggestModal`
(each takes `app` and options, then `open()` resolves with the answer or `null` when dismissed), `Menu` and
`MenuItem` (`setTitle`, `setIcon`, `setDisabled`, `setSeparatorBefore`, `onClick`, `setSubmenu`),
`StatusBarItem` (`setText`, `setIcon`, `setTooltip`, `setTone`, `onClick`, `remove`).

```ts check
import { ConfirmModal, Plugin } from "@jensen-org/plugin-sdk";

export default class Tidy extends Plugin {
  onload() {
    this.addCommand({
      id: "clear",
      name: "Clear the cache",
      callback: async () => {
        const ok = await new ConfirmModal(this.app, {
          title: "Clear the cache",
          message: "This cannot be undone.",
          confirmLabel: "Clear",
          danger: true,
        }).open();
        if (ok) await this.saveData(null);
      },
    });
  }
}
```
