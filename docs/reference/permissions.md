# Permissions

Declared under `jensen.permissions` in `package.json`. Jensen asks the user before granting any of them,
and enforces the grant on every call.

| Key | Gives |
|---|---|
| `workspace` | register, open, move and close panes; run any command |
| `editor` | `"read"`: buffer, selection, decorations, which file a viewer shows, viewer toolbars. `"write"`: also edit and save |
| `fs` | list of scopes readable and writable: a folder (`"docs"`), a file type (`"*.png"`), a file name pattern (`"Dockerfile*"`, `".env*"`), or `"."` and `"*"` for every file |
| `fsRead` | the same scopes, read only: `read`, `readBytes`, `list`, `stat` and `watch`, and the backend's `fs::read` and `fs::list`. Writes need `fs` |
| `sessions` | `true`: read sessions and worktrees, mark session cards, open a session and hand it context |
| `run` | `"none"`, `"read"` or `"control"`. read: Run's services and instances. control: also start, stop and restart |
| `containers` | `"none"`, `"read"` or `"control"`. read: containers, volumes, images, networks and logs, which can hold sensitive data. control: also stop, restart and remove |
| `backend` | run the plugin's own WebAssembly backend, and offer its tools to AI agents |
| `theme` | switch the active theme, register themes |
| `settings` | read and write Jensen's own settings (never secrets) |
| `graph`, `knowledge`, `git` | the code graph, knowledge base and git history |
| `network` | list of hosts reachable over https |

These keys need a Jensen that carries them. Raise `minAppVersion` to the first release that does.

Registering commands, settings tabs, menus and status items, showing notices and dialogs, reading the
theme, and a plugin's own data need no permission.

There is no permission that reads stored credentials.
