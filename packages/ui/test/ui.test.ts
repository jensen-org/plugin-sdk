import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as ui from "../src/index.ts";

const schema = JSON.parse(
  readFileSync(resolve(import.meta.dir, "../../../protocol/plugin-api.v1.json"), "utf8"),
) as {
  $defs: {
    Node: { oneOf: Array<{ properties: { type: { const: string } }; required: string[] }> };
  };
};

const kinds = new Map(schema.$defs.Node.oneOf.map((node) => [node.properties.type.const, node]));

const noop = () => undefined;
const built = [
  ui.Heading("h"),
  ui.Text("t", "muted"),
  ui.Code("c", "ts"),
  ui.Markdown("# m"),
  ui.Badge("b"),
  ui.Divider(),
  ui.Stack([ui.Text("x")]),
  ui.Row([ui.Text("x")], { align: "between" }),
  ui.Toolbar([ui.Text("x")]),
  ui.Split([ui.Text("a"), ui.Text("b")], { sizes: [30, 70] }),
  ui.Section("s", [ui.Text("x")]),
  ui.Tabs({ tabs: [{ key: "a", label: "A", children: [ui.Text("x")] }], onChange: noop }),
  ui.Table({ columns: [{ key: "a", label: "A" }], rows: [{ a: ui.bar(0.5) }] }),
  ui.List(["a"]),
  ui.Tree({ nodes: [{ key: "a", label: "A" }], onSelect: noop }),
  ui.KeyValue([{ key: "k", value: "v" }]),
  ui.Stat("l", "v"),
  ui.Progress(0.4),
  ui.Button({ label: "b", onClick: noop }),
  ui.IconButton({ icon: "star", label: "l", onClick: noop }),
  ui.Input({ value: "", onChange: noop }),
  ui.Textarea({ value: "", onChange: noop }),
  ui.Toggle({ label: "l", value: true, onChange: noop }),
  ui.Checkbox({ label: "l", value: true, onChange: noop }),
  ui.Select({ value: "a", options: [{ value: "a", label: "A" }], onChange: noop }),
  ui.Empty("e"),
  ui.Spinner(),
  ui.Message("m"),
];

describe("jensen-ui builders", () => {
  test("every builder makes a node kind the protocol defines", () => {
    for (const node of built) expect(kinds.has(node.type), node.type).toBe(true);
  });

  test("every node kind the protocol defines has a builder", () => {
    const covered = new Set(built.map((node) => node.type));
    expect([...kinds.keys()].filter((kind) => !covered.has(kind as never))).toEqual([]);
  });

  test("every node carries the fields the protocol requires", () => {
    for (const node of built) {
      const required = kinds.get(node.type)?.required ?? [];
      for (const field of required) expect(node, `${node.type}.${field}`).toHaveProperty(field);
    }
  });

  test("handlers stay plain functions until the SDK serializes them", () => {
    const button = ui.Button({ label: "b", onClick: noop });
    expect(typeof (button as { onClick: unknown }).onClick).toBe("function");
  });

  test("themeVars writes tokens as CSS custom properties", () => {
    expect(ui.themeVars({ "--bg-0": "#000", "--fg": "#fff" })).toBe("--bg-0: #000; --fg: #fff;");
  });
});
