# The editor

Reading needs `editor: "read"`, changing the buffer needs `"write"`.

```ts
const info = await this.app.editor.active();          // path, language, selection, cursor
const text = await this.app.editor.getValue();
await this.app.editor.replaceSelection("hello");
await this.app.editor.insert("x", 0);
await this.app.editor.openFile("src/main.ts", { line: 10 });
```

Edits are one undoable change labelled with your plugin. Offsets are UTF-16 code units, the way
CodeMirror counts them.

## Decorations

Visual only, so `read` is enough:

```ts
import { Decorations } from "jensen-plugin-sdk";

await this.app.editor.decorate("todos", path, [
  Decorations.mark(10, 14, { tone: "warning", tooltip: "Fix this" }),
  Decorations.gutter(3, "!", { tone: "danger" }),
  Decorations.line(5, "info"),
  Decorations.hint(20, " : number", "muted"),
]);
await this.app.editor.clearDecorations("todos");
```

Decorations follow the text as the user types.

## Events

`app.editor.on("change" | "selection-change" | "active-change" | "save", ...)`.
