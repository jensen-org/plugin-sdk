# Permissions

Declared under `jensen.permissions` in `package.json`. Jensen asks the user before granting any of them,
and enforces the grant on every call.

| Key | Gives |
|---|---|
| `workspace` | register, open, move and close panes; add toolbars to file viewers; run any command |
| `editor` | `"read"`: buffer, selection, decorations. `"write"`: also edit and save |
| `fs` | list of scopes readable and writable: a folder (`"docs"`), a file type (`"*.png"`), or `"."` and `"*"` for every file |
| `backend` | run the plugin's own WebAssembly backend, and offer its tools to AI agents |
| `theme` | switch the active theme, register themes |
| `settings` | read and write Jensen's own settings (never secrets) |
| `graph`, `knowledge`, `git` | the code graph, knowledge base and git history |
| `network` | list of hosts reachable over https |

Registering commands, settings tabs, menus and status items, showing notices and dialogs, reading the
theme, and a plugin's own data need no permission.

There is no permission that reads stored credentials.
