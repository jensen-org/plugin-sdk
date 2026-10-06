// ui/index.d.ts
import type { Cell, Node, TableColumn, Tone, TreeNode } from "../protocol/index.ts";
export type { Cell, TableColumn, Tone, TreeNode };
export type Callback<T = void> = (payload: T) => void | Promise<void>;
type Replace<N, K extends string, V> = Omit<N, K> & {
    [P in K]: V;
};
type Variant<T extends Node["type"]> = Extract<Node, {
    type: T;
}>;
/**
 * The tree a pane describes. It mirrors the protocol's node shapes, with each handler written as a
 * plain function. `@jensen-org/plugin-sdk` turns the functions into handler ids on the way to Jensen and
 * calls them again when the user interacts.
 */
export type UiNode = Variant<"heading"> | Variant<"text"> | Variant<"code"> | Variant<"markdown"> | Variant<"badge"> | Variant<"divider"> | Replace<Variant<"stack">, "children", UiNode[]> | Replace<Variant<"row">, "children", UiNode[]> | Replace<Variant<"toolbar">, "children", UiNode[]> | Replace<Variant<"split">, "children", UiNode[]> | Replace<Variant<"section">, "children", UiNode[]> | {
    type: "tabs";
    active?: string;
    onChange?: Callback<string>;
    tabs: {
        key: string;
        label: string;
        icon?: string;
        children: UiNode[];
    }[];
} | Variant<"table"> | Variant<"list"> | {
    type: "tree";
    nodes: TreeNode[];
    selected?: string;
    onSelect?: Callback<string>;
} | Variant<"keyValue"> | Variant<"stat"> | Variant<"progress"> | Replace<Variant<"button">, "onClick", Callback> | Replace<Variant<"iconButton">, "onClick", Callback> | Replace<Variant<"input">, "onChange", Callback<string>> | Replace<Variant<"textarea">, "onChange", Callback<string>> | Replace<Variant<"toggle">, "onChange", Callback<boolean>> | Replace<Variant<"checkbox">, "onChange", Callback<boolean>> | Replace<Variant<"select">, "onChange", Callback<string>> | Variant<"empty"> | Variant<"spinner"> | Variant<"message">;
type Of<T extends UiNode["type"]> = Extract<UiNode, {
    type: T;
}>;
type Options<T extends UiNode["type"]> = Omit<Of<T>, "type">;
export declare const Heading: (text: string, level?: 1 | 2 | 3) => UiNode;
export declare const Text: (text: string, tone?: Tone) => UiNode;
export declare const Code: (text: string, language?: string) => UiNode;
export declare const Markdown: (text: string) => UiNode;
export declare const Badge: (text: string, tone?: Tone) => UiNode;
export declare const Divider: () => UiNode;
export declare const Stack: (children: UiNode[], options?: {
    gap?: number;
}) => UiNode;
export declare const Row: (children: UiNode[], options?: {
    gap?: number;
    align?: "start" | "center" | "end" | "between";
}) => UiNode;
export declare const Toolbar: (children: UiNode[]) => UiNode;
export declare const Split: (children: UiNode[], options?: {
    direction?: "horizontal" | "vertical";
    sizes?: number[];
}) => UiNode;
export declare const Section: (title: string, children: UiNode[]) => UiNode;
export declare const Tabs: (options: Options<"tabs">) => UiNode;
export declare const Table: (options: Options<"table">) => UiNode;
export declare const List: (items: string[]) => UiNode;
export declare const Tree: (options: Options<"tree">) => UiNode;
export declare const KeyValue: (items: {
    key: string;
    value: string;
}[]) => UiNode;
export declare const Stat: (label: string, value: string, hint?: string) => UiNode;
export declare const Progress: (value: number, label?: string) => UiNode;
export declare const bar: (value: number, title?: string) => Cell;
export declare const Button: (options: Options<"button">) => UiNode;
export declare const IconButton: (options: Options<"iconButton">) => UiNode;
export declare const Input: (options: Options<"input">) => UiNode;
export declare const Textarea: (options: Options<"textarea">) => UiNode;
export declare const Toggle: (options: Options<"toggle">) => UiNode;
export declare const Checkbox: (options: Options<"checkbox">) => UiNode;
export declare const Select: (options: Options<"select">) => UiNode;
export declare const Empty: (title: string, hint?: string) => UiNode;
export declare const Spinner: (label?: string) => UiNode;
export declare const Message: (text: string, tone?: Tone) => UiNode;
/** CSS custom properties Jensen's theme exposes, for a custom pane that draws its own DOM. */
export declare function themeVars(tokens: Record<string, string>): string;
/** The base style a custom pane needs to look at home next to Jensen's own panes. */
export declare const BASE_CSS = "html,body{margin:0;height:100%;background:var(--bg-0);color:var(--fg);font:var(--text-body)/1.5 var(--font)}";
