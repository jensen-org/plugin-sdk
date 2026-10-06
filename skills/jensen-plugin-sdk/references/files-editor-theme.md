# Files, editor and theme

## Files

`this.app.files` reads and writes the project's files. Needs `fs`, a list of folders in the manifest. Paths are
relative to the project root and must sit inside a granted folder. Jensen enforces this below the plugin: a path
outside every granted folder fails, and so does one that reaches outside through a symlink. A granted folder
itself cannot be deleted or renamed away. There is no API that reads stored secrets, tokens or the keychain.

| Method | Returns |
|---|---|
| `read(path)` | `string` |
| `write(path, contents)` | `null` |
| `list(path)` | `Array<FileEntry or FolderEntry>`, each with `path` and `name`. `FileEntry` adds `size`, `modifiedMs?`, `extension` |
| `stat(path)` | `FileStat` with `kind`, `size`, `modifiedMs`, or `null` |
| `exists(path)` | `boolean` |
| `mkdir(path)` | `null` |
| `delete(path, { recursive? })` | `null` |
| `rename(from, to)` | `null` |
| `watch(path, listener?)` | `Disposable`. Changes also fire `files.on("create" or "modify" or "delete" or "rename", ...)` |

```ts check
import { FileEntry, Plugin } from "@jensen-org/plugin-sdk";

export default class Notes extends Plugin {
  async onload() {
    const watcher = await this.app.files.watch("docs", (change) => {
      console.log(change.path);
    });
    this.registerDisposable(watcher);

    this.addCommand({
      id: "count",
      name: "Count docs",
      callback: async () => {
        const entries = await this.app.files.list("docs");
        const files = entries.filter((entry): entry is FileEntry => entry instanceof FileEntry);
        await this.app.files.write("docs/count.txt", String(files.length));
      },
    });
  }
}
```

## Editor

`this.app.editor`. Reading, opening files and decorations need `editor: "read"`. Changing or saving the buffer
needs `editor: "write"`. Offsets are UTF-16 code units, the way CodeMirror counts them. An edit is one undoable
change labelled with your plugin.

| Method | Notes |
|---|---|
| `active()` | `ActiveEditor` (`path`, `languageId`, `dirty`, `lineCount`, `selection`, `cursor`) or `null` |
| `getValue(path?)` | buffer text |
| `getSelection()` | `{ text, from, to }` |
| `openFile(path, { line?, column? })` | read |
| `replaceRange(from, to, text)`, `replaceSelection(text)`, `insert(text, at?)`, `save(path?)` | write |
| `decorate(key, path, decorations)`, `clearDecorations(key)` | read, visual only |

`Decorations` builders: `mark(from, to, { tone?, tooltip? })`, `line(line, tone?)`,
`gutter(line, text, { tone?, tooltip? })`, `hint(at, text, tone?)`. Decorations follow the text as the user types.
Reuse one `key` per feature so you replace your own decorations instead of stacking them.

```ts check
import { Decorations, Plugin } from "@jensen-org/plugin-sdk";

export default class Todos extends Plugin {
  onload() {
    this.registerEvent(this.app.editor.on("change", () => void this.mark()));
  }

  private async mark() {
    const active = await this.app.editor.active();
    if (!active?.path) return;
    const text = await this.app.editor.getValue();
    const marks = [...text.matchAll(/TODO/g)].map((match) =>
      Decorations.mark(match.index, match.index + 4, { tone: "warning", tooltip: "Open item" }),
    );
    await this.app.editor.decorate("todos", active.path, marks);
  }
}
```

Events: `editor.on("change" | "selection-change" | "active-change" | "save", listener)`.

## Theme

```ts
const { id, appearance, tokens } = this.app.theme.current;
this.registerEvent(this.app.theme.on("change", (theme) => this.redraw(theme)));
await this.app.theme.set("nord");
this.registerTheme(myThemeDocument);
```

Reading the theme (`current`, `tokens`, `appearance`, `list()`) needs no permission. `set` and `register` need
`theme`. A `ThemeDocument` is an object with a string `id`, shaped by Jensen's `schema/theme.schema.json`, and
Jensen validates it. Declarative panes follow the theme automatically. Custom panes get the tokens as CSS custom
properties, kept current, and `app.theme.applyTo(element)` writes them onto any element.
