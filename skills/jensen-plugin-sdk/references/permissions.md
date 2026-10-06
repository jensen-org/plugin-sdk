# Permissions

Declared under `jensen.permissions` in `package.json`. Jensen asks the user before granting any of them and
enforces the grant on every call. Ask for the least that works, and explain each one in `README.md`, which the
user reads before installing.

```json
{ "jensen": { "permissions": { "workspace": true, "editor": "read", "fs": ["docs"], "network": ["api.example.com"] } } }
```

| Key | Value | Gives |
|---|---|---|
| `workspace` | `true` | register, open, move and close panes, list panes, run and list commands |
| `editor` | `"none"`, `"read"` or `"write"` | read: buffer, selection, open files, decorations and editor events. write: also replace, insert and save |
| `fs` | list of relative folders | read and write inside those project folders |
| `theme` | `true` | switch the active theme, register themes |
| `settings` | `true` | read and write Jensen's own settings, never secrets |
| `graph`, `knowledge`, `git` | `true` | the code graph, the knowledge base, git history and semantic diff |
| `network` | list of hosts | https requests to those hosts through `app.net.fetch(host, path)` |

`jensen-plugin validate` rejects unknown keys, non boolean values for boolean keys, an `editor` other than
`none`, `read` or `write`, non string lists, and `fs` entries that are absolute, empty, contain `..` or `.`
segments, or use backslashes.

## What needs nothing

Registering commands, settings tabs, menus and status items, showing notices and dialogs, `loadData` and
`saveData`, reading the theme, and `keymap.get`. Refreshing a pane (`refresh()`) also needs nothing, but opening,
registering or moving panes needs `workspace`.

## Capability names in errors

When a call is refused, `HostError.capability` is one of `none`, `graph`, `knowledge`, `git`, `workspace`,
`theme`, `settings`, `editor:read`, `editor:write`, `fs`, `network`. Map it back to the manifest key: `editor:read`
and `editor:write` both come from `editor`.

Protocol method to capability, for the cases that surprise people:

| Method | Capability |
|---|---|
| `workspace.registerPane`, `openPane`, `listPanes`, `setPaneState` | `workspace` |
| `commands.execute`, `commands.list` | `workspace` |
| `editor.openFile`, `editor.setDecorations`, `editor.getText` | `editor:read` |
| `editor.insert`, `replaceRange`, `replaceSelection`, `save` | `editor:write` |
| `settings.get`, `settings.set` | `settings` |
| `theme.set`, `theme.register` | `theme` |

There is no permission that reads stored credentials.
