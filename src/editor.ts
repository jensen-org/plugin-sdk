import type { HostConnection } from "./connection.ts";
import { Events } from "./events.ts";
import type { ActiveEditor, Decoration, Position, Range, Tone } from "./protocol/index.ts";

export interface EditorSelection {
  text: string;
  from: Position;
  to: Position;
}

/** Decorations Jensen draws on top of the code editor. They are visual only and never change the buffer. */
export const Decorations = {
  mark: (
    from: number,
    to: number,
    options: { tone?: Tone; tooltip?: string } = {},
  ): Decoration => ({
    kind: "mark",
    from,
    to,
    ...options,
  }),
  line: (line: number, tone?: Tone): Decoration => ({ kind: "line", line, tone }),
  gutter: (
    line: number,
    text: string,
    options: { tone?: Tone; tooltip?: string } = {},
  ): Decoration => ({ kind: "gutter", line, text, ...options }),
  hint: (at: number, text: string, tone?: Tone): Decoration => ({ kind: "hint", at, text, tone }),
};

/**
 * The code editor. Reading needs `editor: "read"` in the manifest, changing the buffer needs `"write"`.
 * Offsets are UTF-16 code units, the way CodeMirror counts them.
 */
export class Editor extends Events<{
  change: [{ path: string | null; lineCount: number }];
  "selection-change": [{ path: string | null; selection: Range; cursor: Position }];
  "active-change": [ActiveEditor | null];
  save: [{ path: string }];
}> {
  constructor(private readonly host: HostConnection) {
    super();
    host.subscribe("editor.changed", (payload) => this.trigger("change", payload));
    host.subscribe("editor.selectionChanged", (payload) =>
      this.trigger("selection-change", payload),
    );
    host.subscribe("editor.activeChanged", (payload) => this.trigger("active-change", payload));
    host.subscribe("editor.saved", (payload) => this.trigger("save", payload));
  }

  active(): Promise<ActiveEditor | null> {
    return this.host.call("editor.active", {});
  }

  getValue(path?: string): Promise<string> {
    return this.host.call("editor.getText", { path });
  }

  getSelection(): Promise<EditorSelection> {
    return this.host.call("editor.getSelection", {});
  }

  openFile(path: string, position: { line?: number; column?: number } = {}): Promise<null> {
    return this.host.call("editor.openFile", { path, ...position });
  }

  replaceRange(from: number, to: number, text: string): Promise<null> {
    return this.host.call("editor.replaceRange", { from, to, text });
  }

  replaceSelection(text: string): Promise<null> {
    return this.host.call("editor.replaceSelection", { text });
  }

  insert(text: string, at?: number): Promise<null> {
    return this.host.call("editor.insert", { text, at });
  }

  save(path?: string): Promise<null> {
    return this.host.call("editor.save", { path });
  }

  decorate(key: string, path: string, decorations: Decoration[]): Promise<null> {
    return this.host.call("editor.setDecorations", { key, path, decorations });
  }

  clearDecorations(key: string): Promise<null> {
    return this.host.call("editor.clearDecorations", { key });
  }
}
