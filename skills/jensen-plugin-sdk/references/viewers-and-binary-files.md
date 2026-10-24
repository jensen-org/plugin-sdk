# Viewer toolbars and binary files

Jensen shows some files in a **viewer** instead of the code editor. Images are the viewer today, with kind
`"image"`. A plugin can add a toolbar above a viewer, read and write files of any format, and move an open tab.

## Viewer toolbars

```ts check
import { Plugin } from "@jensen-org/plugin-sdk";
import * as ui from "@jensen-org/plugin-sdk/ui";

export default class Pics extends Plugin {
  onload() {
    this.registerViewerToolbar("tools", { kinds: ["image"] }, ({ path }) => [
      ui.Row([
        ui.Text(path, "muted"),
        ui.Button({
          label: "Halve",
          onClick: async () => {
            await this.app.backend.run("shrink", { path });
          },
        }),
      ]),
    ]);
  }
}
```

- `registerViewerToolbar(id, match, render)` returns a `Disposable`, undone when the plugin unloads.
- `match` is `{ kinds?: string[]; extensions?: string[] }`. `extensions` have no leading dot.
- `render({ path })` returns `ui` nodes, the same builders as panes, see [panes-and-ui](panes-and-ui.md). `path` is
  relative to the project root. It may be async.
- Jensen calls `render` again after one of the toolbar's handlers runs, when the file changes on disk, and on
  `this.app.viewer.refresh("tools")`. Build handlers inside `render`, like in a pane.
- A toolbar learns the path of every file it is shown for, so it needs `editor: "read"`, the permission that
  lets a plugin see the active editor.
- `this.app.viewer.active` is `{ path, kind }` or `null`. `this.app.viewer.on("change", (file) => ...)` fires
  when the focused viewer changes.

## Binary files

```ts
const bytes = await this.app.files.readBytes("photos/a.png");
await this.app.files.writeBytes("photos/a.png", bytes.subarray(0, bytes.length / 2));
```

- `files.readBytes(path)` returns a `Uint8Array`. `files.writeBytes(path, data)` creates parent folders.
- Both need an `fs` scope covering the path (`fsRead` is enough to read). Open tabs on the path refresh.
- `files.read` and `files.write` are for text. Use the byte versions for images and anything not UTF-8.

## Scopes for file types

`fs` and `fsRead` entries can name a folder, a file type or a name pattern:

| Entry | Covers |
|---|---|
| `"docs"` | everything under `docs` |
| `"*.png"` | every `.png` in the project |
| `"Dockerfile*"` | files whose name starts with `Dockerfile` |
| `"."` | every file in the project. Ask for it only when you truly need all of them |

## Changing the file under a viewer

When a handler writes the file with `files.writeBytes` or the backend, the open viewer reloads, so the picture,
its dimensions and its size update without reopening the tab. If the new file has a different name, such as
converting `a.png` to `a.webp`, move the tab:

```ts
await this.app.editor.retarget("a.png", "a.webp");
```

`editor.retarget(from, to)` needs `editor: "read"`.

For heavy work on the bytes, hand them to a Rust backend, see [backend](backend.md).
