# Commands and hotkeys

```ts
this.addCommand({
  id: "insert-date",
  name: "Insert today's date",
  category: "Hello",
  hotkey: { key: "Mod+Shift+D", when: "editorFocus" },
  callback: () => this.app.editor.insert(new Date().toISOString().slice(0, 10)),
});
```

The command shows in the palette and in Settings > Keyboard, where the user can rebind or unbind it.
`Mod` is Cmd on macOS and Ctrl elsewhere.

`when` limits the chord: `global` (default), `editorFocus`, or a pane via `this.paneFocus("view")`.

`check` lets a command say it is not available right now:

```ts
check: async () => (await this.app.editor.active()) !== null,
```

Run any command, Jensen's own included, with `app.commands.execute(id)` (needs `workspace`).
