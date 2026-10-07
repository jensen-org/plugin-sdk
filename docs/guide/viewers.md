# Viewer toolbars

Jensen shows some files in a viewer rather than the code editor: images today. `registerViewerToolbar` adds a
toolbar above the viewer for the files you match.

```ts
export default class Pics extends Plugin {
  onload() {
    this.registerViewerToolbar("tools", { kinds: ["image"] }, ({ path }) => [
      ui.Row([
        ui.Text(path, "muted"),
        ui.Button({ label: "Halve", onClick: () => this.app.backend.call("shrink", { path }) }),
      ]),
    ]);
  }
}
```

`match` takes `kinds` (the viewer, such as `"image"`) and `extensions` (without the dot). `render` returns
[`ui` nodes](/guide/panes) for the file, with the path relative to the project root.

Jensen calls `render` again when a handler runs, when the file changes on disk, and on
`this.app.viewer.refresh("tools")`. The permission it needs is `workspace`.

## Changing the file

When a handler writes the file with `app.files.writeBytes` or the backend, the open viewer reloads: the
picture, its dimensions and its size update without reopening the tab. If the new file has a different
name, such as after converting `a.png` to `a.webp`, move the tab with `app.editor.retarget("a.png", "a.webp")`
(needs `editor: "read"`).

```ts
app.viewer.on("change", (file) => console.log(file?.path, file?.kind));
```
