import type { Cell, Node, TableColumn, Tone, TreeNode } from "../protocol/index.ts";

export type { Cell, TableColumn, Tone, TreeNode };

export type Callback<T = void> = (payload: T) => void | Promise<void>;

type Replace<N, K extends string, V> = Omit<N, K> & { [P in K]: V };
type Variant<T extends Node["type"]> = Extract<Node, { type: T }>;

/**
 * The tree a pane describes. It mirrors the protocol's node shapes, with each handler written as a
 * plain function. `@jensen-org/plugin-sdk` turns the functions into handler ids on the way to Jensen and
 * calls them again when the user interacts.
 */
export type UiNode =
  | Variant<"heading">
  | Variant<"text">
  | Variant<"code">
  | Variant<"markdown">
  | Variant<"badge">
  | Variant<"divider">
  | Replace<Variant<"stack">, "children", UiNode[]>
  | Replace<Variant<"row">, "children", UiNode[]>
  | Replace<Variant<"toolbar">, "children", UiNode[]>
  | Replace<Variant<"split">, "children", UiNode[]>
  | Replace<Variant<"section">, "children", UiNode[]>
  | {
      type: "tabs";
      active?: string;
      onChange?: Callback<string>;
      tabs: { key: string; label: string; icon?: string; children: UiNode[] }[];
    }
  | Variant<"table">
  | Variant<"list">
  | { type: "tree"; nodes: TreeNode[]; selected?: string; onSelect?: Callback<string> }
  | Variant<"keyValue">
  | Variant<"stat">
  | Variant<"progress">
  | Replace<Variant<"button">, "onClick", Callback>
  | Replace<Variant<"iconButton">, "onClick", Callback>
  | Replace<Variant<"input">, "onChange", Callback<string>>
  | Replace<Variant<"textarea">, "onChange", Callback<string>>
  | Replace<Variant<"toggle">, "onChange", Callback<boolean>>
  | Replace<Variant<"checkbox">, "onChange", Callback<boolean>>
  | Replace<Variant<"select">, "onChange", Callback<string>>
  | Variant<"empty">
  | Variant<"spinner">
  | Variant<"message">;

type Of<T extends UiNode["type"]> = Extract<UiNode, { type: T }>;
type Options<T extends UiNode["type"]> = Omit<Of<T>, "type">;

export const Heading = (text: string, level: 1 | 2 | 3 = 1): UiNode => ({
  type: "heading",
  text,
  level,
});
export const Text = (text: string, tone?: Tone): UiNode => ({ type: "text", text, tone });
export const Code = (text: string, language?: string): UiNode => ({ type: "code", text, language });
export const Markdown = (text: string): UiNode => ({ type: "markdown", text });
export const Badge = (text: string, tone?: Tone): UiNode => ({ type: "badge", text, tone });
export const Divider = (): UiNode => ({ type: "divider" });

export const Stack = (children: UiNode[], options: { gap?: number } = {}): UiNode => ({
  type: "stack",
  children,
  ...options,
});
export const Row = (
  children: UiNode[],
  options: { gap?: number; align?: "start" | "center" | "end" | "between" } = {},
): UiNode => ({ type: "row", children, ...options });
export const Toolbar = (children: UiNode[]): UiNode => ({ type: "toolbar", children });
export const Split = (
  children: UiNode[],
  options: { direction?: "horizontal" | "vertical"; sizes?: number[] } = {},
): UiNode => ({ type: "split", children, ...options });
export const Section = (title: string, children: UiNode[]): UiNode => ({
  type: "section",
  title,
  children,
});
export const Tabs = (options: Options<"tabs">): UiNode => ({ type: "tabs", ...options });

export const Table = (options: Options<"table">): UiNode => ({ type: "table", ...options });
export const List = (items: string[]): UiNode => ({ type: "list", items });
export const Tree = (options: Options<"tree">): UiNode => ({ type: "tree", ...options });
export const KeyValue = (items: { key: string; value: string }[]): UiNode => ({
  type: "keyValue",
  items,
});
export const Stat = (label: string, value: string, hint?: string): UiNode => ({
  type: "stat",
  label,
  value,
  hint,
});
export const Progress = (value: number, label?: string): UiNode => ({
  type: "progress",
  value,
  label,
});
export const bar = (value: number, title?: string): Cell => ({ bar: value, title });

export const Button = (options: Options<"button">): UiNode => ({ type: "button", ...options });
export const IconButton = (options: Options<"iconButton">): UiNode => ({
  type: "iconButton",
  ...options,
});
export const Input = (options: Options<"input">): UiNode => ({ type: "input", ...options });
export const Textarea = (options: Options<"textarea">): UiNode => ({
  type: "textarea",
  ...options,
});
export const Toggle = (options: Options<"toggle">): UiNode => ({ type: "toggle", ...options });
export const Checkbox = (options: Options<"checkbox">): UiNode => ({
  type: "checkbox",
  ...options,
});
export const Select = (options: Options<"select">): UiNode => ({ type: "select", ...options });

export const Empty = (title: string, hint?: string): UiNode => ({ type: "empty", title, hint });
export const Spinner = (label?: string): UiNode => ({ type: "spinner", label });
export const Message = (text: string, tone: Tone = "info"): UiNode => ({
  type: "message",
  text,
  tone,
});

/** CSS custom properties Jensen's theme exposes, for a custom pane that draws its own DOM. */
export function themeVars(tokens: Record<string, string>): string {
  return Object.entries(tokens)
    .map(([name, value]) => `${name}: ${value};`)
    .join(" ");
}

/** The base style a custom pane needs to look at home next to Jensen's own panes. */
export const BASE_CSS =
  "html,body{margin:0;height:100%;background:var(--bg-0);color:var(--fg);font:var(--text-body)/1.5 var(--font)}";
