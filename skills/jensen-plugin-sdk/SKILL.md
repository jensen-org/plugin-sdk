---
name: jensen-plugin-sdk
description: Use when building, debugging, testing or publishing a plugin for the Jensen app with @jensen-org/plugin-sdk. Covers the Plugin class, panes (PaneView and CustomPaneView), commands and hotkeys, settings tabs, menus, the status bar, files, the editor, themes, permissions in the package.json "jensen" block, TestHost tests, and the jensen-plugin CLI (create, build, dev, validate, publish, skill install). Trigger on imports from @jensen-org/plugin-sdk, a package.json with a "jensen" block, HostError, or any request to extend Jensen.
---

# Jensen plugin SDK

`@jensen-org/plugin-sdk` is the only dependency a Jensen plugin needs. A plugin is one class that extends
`Plugin`, registers what it adds in `onload()`, and talks to the Jensen app through a typed protocol.

This skill is installed in two places by `jensen-plugin skill install`: `.agents/skills/jensen-plugin-sdk`
(read by coding agents that look there) and `.claude/skills/jensen-plugin-sdk` (Claude Code).
Both hold the same files.

## Mental model

- Jensen loads the built `main.js` into a hidden sandboxed frame and hands it a `MessagePort`. The plugin
  cannot touch the DOM of the app, the disk or the network directly. Everything goes through `this.app`, and
  each call crosses the port as a protocol message that Jensen checks against the granted permissions.
- Permissions are declared once in `package.json` under `jensen.permissions`. The user is asked before
  anything is granted, and Jensen enforces the grant on every call, so a missing permission shows up as a
  rejected call at runtime, not as a type error.
- Jensen has exactly three pages (`session`, `code`, `notes`) and no API to add pages. A plugin adds panes.
- Lifecycle: the SDK's `start()` says hello, constructs your class, runs `onload()`, then reports ready. The
  `register*`, `add*` and `on(...)` methods return a `Disposable` or `EventRef` and are undone, newest first,
  when the plugin unloads. Override `onunload()` only for resources the SDK does not know about, and register
  those with `this.register(cleanup)` when you can.
- The same bundle also runs inside each custom pane's own frame. There `onload()` runs again but registrations
  are skipped. `this.app.isSurface` tells the copies apart. Keep `onload()` to registrations and loading data.

## Project layout

```
my-plugin/
  package.json     name, version, description, author, and the "jensen" block
  README.md        required: shown to the user before install, say why each permission is asked
  src/main.ts      default export is the Plugin subclass
  tsconfig.json    strict, moduleResolution Bundler, lib ES2022 and DOM
```

Manifest, the `jensen` block of `package.json`:

```json
{
  "name": "hello",
  "version": "0.1.0",
  "description": "Says hello from a pane",
  "author": "me",
  "jensen": {
    "id": "dev.me.hello",
    "minAppVersion": "0.3.0",
    "category": "demo",
    "repo": "me/hello",
    "permissions": { "workspace": true, "editor": "read", "fs": ["docs"] }
  }
}
```

`id` is a reverse-dns id, `minAppVersion` is required, `category` and `repo` are required to publish, `tag`
overrides the release tag, `entry` overrides `src/main.ts`. Do not add `contributes` or `activationEvents`,
the validator rejects them. Permission keys are listed in [permissions](references/permissions.md).

## Golden workflow

1. Scaffold: `npx @jensen-org/plugin-sdk create my-plugin` (flags `--yes --name --id --description --author`,
   and `--no-skill` to skip installing this skill). The scaffold already includes a pane, a settings tab and a command.
2. Develop: `jensen-plugin dev` rebuilds `main.js` on every change. `--publish` also reassembles `release/`.
3. Check: `jensen-plugin validate` checks the `jensen` block and README without building. `tsc --noEmit`
   typechecks. `jensen-plugin build [--minify]` writes `main.js`.
4. Test with `TestHost` from `@jensen-org/plugin-sdk/testing`, see [testing](references/testing.md).
5. Publish: `jensen-plugin publish` validates, builds, writes `release/` and prints the store entry. Add
   `--release` to create the GitHub release and `--store-pr` to open the store pull request, see
   [publishing](references/publishing.md).

All commands accept `--cwd <dir>`. Install this skill into an existing project with
`jensen-plugin skill install [--target <agents|claude|all>] [--dir <path>] [--force]`.

## Key APIs

A complete plugin with a command, a declarative pane and persisted data:

```ts check
import { Notice, PaneView, Plugin } from "@jensen-org/plugin-sdk";
import * as ui from "@jensen-org/plugin-sdk/ui";

interface Data {
  clicks: number;
}

class Counter extends PaneView<{ filter: string }> {
  render() {
    const owner = this.plugin as Hello;
    return [
      ui.Stack([
        ui.Heading(`Clicked ${owner.data.clicks} times`),
        ui.Button({
          label: "Add",
          onClick: async () => {
            await owner.bump();
            await this.refresh();
          },
        }),
      ]),
    ];
  }
}

export default class Hello extends Plugin {
  data: Data = { clicks: 0 };

  async onload() {
    this.data = { ...this.data, ...((await this.loadData<Data>()) ?? {}) };
    this.registerPane("counter", Counter, { title: "Counter", icon: "star" });
    this.addCommand({
      id: "open",
      name: "Open the counter",
      hotkey: { key: "Mod+Shift+H" },
      callback: async () => {
        await this.app.workspace.openPane("counter", { direction: "right", state: { filter: "" } });
      },
    });
  }

  async bump() {
    this.data = { clicks: this.data.clicks + 1 };
    await this.saveData(this.data);
    new Notice(`Clicked ${this.data.clicks} times`);
  }
}
```

What lives where, all on `this` (a `Plugin`) or `this.app` (an `App`):

| Need | API |
|---|---|
| Command and hotkey | `this.addCommand({ id, name, hotkey: { key, when }, check, callback })` |
| Declarative pane | `this.registerPane(id, PaneViewSubclass, { title, icon, singleton })` |
| Custom DOM pane | `CustomPaneView` subclass with `onMount(element)` |
| Open or find panes | `this.app.workspace.openPane`, `getLeavesOfType`, `listPanes` |
| Settings tab | `this.addSettingTab(new MyTab(this.app, this, { title }))` and `Setting` |
| Plugin data | `await this.loadData<T>()`, `await this.saveData(data)` |
| Menus and status | `this.registerMenu(target, build)`, `this.addStatusBarItem()` |
| Notices and dialogs | `new Notice(text)`, `ConfirmModal`, `PromptModal`, `ChoiceModal`, `SuggestModal` |
| Editor | `this.app.editor` (`active`, `getValue`, `replaceSelection`, `insert`, `decorate`) |
| Files | `this.app.files` (`read`, `write`, `list`, `stat`, `exists`, `rename`, `watch`) |
| Theme | `this.app.theme` (`current`, `on("change")`, `set`, `register`, `applyTo`) |
| Other commands | `this.app.commands.execute(id)`, `list()`, `this.app.keymap.get(id)` |
| Code graph, knowledge, git, network | `this.app.graph`, `knowledge`, `git`, `net.fetch(host, path)` |

Where to read more, one line each:

- [api-overview](references/api-overview.md): the full class map, package entry points, `App` and `Plugin` members. Read first when unsure what exists.
- [panes-and-ui](references/panes-and-ui.md): every `ui` node builder, pane state, handlers, custom panes, opening panes.
- [settings](references/settings.md): settings tabs, every control, persisting data, Jensen's own settings.
- [files-editor-theme](references/files-editor-theme.md): reading and writing files, editor edits, decorations, themes, events.
- [permissions](references/permissions.md): the manifest permission keys, what each gates, how to ask for the least.
- [testing](references/testing.md): `TestHost`, answering calls, driving callbacks, running a built `main.js`.
- [publishing](references/publishing.md): `release/`, the store entry, GitHub release, store pull request, registries.
- [errors](references/errors.md): `HostError` codes, the messages you will see, and how to fix each.

## Common mistakes

- Using a capability without declaring it. Calls reject with `HostError` code `permission_denied` and
  `error.capability` names what is missing, for example `editor:write`. Add it to `jensen.permissions`.
- Panes need `workspace`. Registering commands, settings tabs, menus, status items, notices, dialogs, reading
  the theme and `loadData` or `saveData` need no permission.
- Doing work in `onload()` that assumes headless. In a custom pane's copy registrations are skipped, so put
  per pane work in `onMount()` or `onOpen()`.
- Holding state in module variables for a pane. Use `PaneView` state (`this.setState`) so it survives restarts,
  and plugin data (`saveData`) for plugin wide state.
- Keeping a handler across renders. After a handler runs, Jensen asks for `render()` again and handlers from an
  older render are refused with "replaced by a newer render". Build handlers inside `render()`.
- Paths outside the granted `fs` folders, absolute paths, or `..` segments. Paths are relative to the project
  root and must sit inside a folder listed under `fs`.
- Editor offsets are UTF-16 code units, the way CodeMirror counts them, not bytes or code points.
- Importing Node APIs or the DOM of the app. Only `CustomPaneView` has a DOM, and it is a sandboxed frame.
- Running plugin code outside Jensen, for example importing `main.js` in a script. Connecting without a port
  throws `NotInJensenError`. Use `TestHost` in tests.
- Forgetting `README.md`. `validate`, `build` and `publish` fail without it.
- Hand writing a wrapper entry. `jensen-plugin build` generates it and calls `start()` for you.

How errors surface: a refused call rejects with `HostError` (`code`, optional `capability`). A throw inside
`onload()` is reported to the user and the plugin is not loaded. A throw inside a command, pane handler or
render fails that one callback and the error message goes back to Jensen. Details are in [errors](references/errors.md).

## Code samples in this skill

Fenced blocks tagged `ts check` are complete files that are compiled against the SDK source by the SDK's own
test suite, so they are safe to copy. Blocks tagged plain `ts` are fragments to place inside `onload()` or a
method.

## Checklist before publishing

- [ ] `package.json` has `name`, `version` (semver), `description`, `author`, and a `jensen` block with `id`, `minAppVersion`, `category`, `repo`
- [ ] Permissions are the minimum used, each justified in `README.md`
- [ ] `jensen-plugin validate` exits 0
- [ ] `tsc --noEmit` is clean and tests pass
- [ ] `jensen-plugin build` produces `main.js`, and the README says what the plugin does
- [ ] `jensen-plugin publish` prints a store entry with no problems, and `repo` is public for the official store
- [ ] Version bumped, and `gh auth login` done before `--release` or `--store-pr`
