# Errors

A call Jensen refuses rejects with `HostError`, which has `code` (an `ErrorCode`), `message`, and for permission
errors `capability`. An error code the SDK does not recognise becomes `failed`.

```ts check
import { HostError, Plugin } from "@jensen-org/plugin-sdk";

export default class Safe extends Plugin {
  onload() {
    this.addCommand({
      id: "read",
      name: "Read the readme",
      callback: async () => {
        try {
          await this.app.files.read("docs/readme.md");
        } catch (cause) {
          if (cause instanceof HostError && cause.code === "permission_denied") {
            console.error(`missing permission: ${cause.capability}`);
            return;
          }
          throw cause;
        }
      },
    });
  }
}
```

## Codes

| `code` | Meaning | Usual fix |
|---|---|---|
| `bad_request` | the params were malformed or named something that does not exist | check the id, the path shape and the types |
| `permission_denied` | the capability in `error.capability` was not granted | add the matching key to `jensen.permissions`, see [permissions](permissions.md) |
| `not_found` | the target does not exist | check the path or id, use `files.exists` first |
| `failed` | the call was valid and did not work. Also what a throw inside your callback becomes | read the message |
| `cancelled` | the call was cancelled | retry if still needed |
| `unsupported` | Jensen does not serve that method, or the plugin does not handle a callback | `requireApiVersion`, raise `minAppVersion` |
| `rate_limited`, `too_busy`, `io_budget_exceeded`, `killed` | the plugin hit a budget | batch calls, debounce events, avoid tight loops |

## Messages you will meet

| Message | Cause |
|---|---|
| `no handler '<id>': it was replaced by a newer render` | a pane handler from an old render fired. Rebuild handlers inside `render()` |
| `no pane '<id>'`, `no command '<id>'` | the host asked for something this plugin never registered. Check the id matches `registerPane` or `addCommand` |
| `pane '<id>' draws its own DOM and cannot render a node tree` | a `CustomPaneView` was asked to render nodes. Use `PaneView` for node trees |
| `pane '<id>' is not a custom pane this plugin registered` | a pane surface started for an id that is not a `CustomPaneView` |
| `setting '<key>' has no change handler` | a `Setting` row without `onChange` received a change |
| `menu '<id>' has no item '<id>' any more` | the menu was rebuilt before the click arrived |
| `the connection to Jensen is closed` or `the connection closed` | a call was made after unload. Stop timers and listeners in cleanup |
| `NotInJensenError` | plugin code ran without Jensen's port. Run it in Jensen, or use `TestHost` |

## Where errors go

- A throw in `onload()` is announced to the user and the plugin is not loaded. Put risky work in a command or
  pane hook, and catch what you can recover from.
- A throw in a command callback, pane `render()` or handler, settings handler or menu callback fails that one
  callback with code `failed` and the message goes back to Jensen. The plugin keeps running.
- Rejections from fire and forget calls (`void this.app.files.read(...)`) are easy to lose. Await calls or
  attach `.catch`.

## Validation problems

`jensen-plugin validate`, `build` and `publish` print one line per problem as `  field: message`, for example
`jensen.minAppVersion: is required: the oldest Jensen this plugin runs on` or
`jensen.contributes: v1 plugins register panes, commands, settings and themes at runtime from onload()...`.
Fix the named field in `package.json` and run again. A missing `README.md` is reported as the field `README.md`.
Building also fails with `no entry file: looked for src/main.ts, src/main.tsx, src/main.js` when no entry exists.
