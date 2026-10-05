# Hello pane

An example plugin that touches every surface the SDK offers:

- a declarative pane (`Hello dashboard`) and a custom pane (`Hello clock`)
- a settings section with text, toggle and button rows
- two commands with hotkeys, one scoped to the code editor
- a status bar item and an explorer context menu entry
- editor access: it inserts text and decorates every `TODO`
- file access: it lists the `docs` folder
- the theme: the dashboard shows it and redraws when it changes

## Try it

```bash
bun install
bun run build                 # writes main.js
jensen publish .              # assembles release/ and adds it as a development source
```

Then install the release folder from Settings, Plugins, Install from GitHub, using the sha256 `jensen publish` printed.

## Why it asks for what it asks for

| Permission | Used for |
|---|---|
| `workspace` | registering and opening panes |
| `settings` | reserved for reading Jensen's settings |
| `theme` | reserved for switching themes |
| `editor: write` | inserting the date and decorating TODOs |
| `fs: ["docs"]` | listing the docs folder |
