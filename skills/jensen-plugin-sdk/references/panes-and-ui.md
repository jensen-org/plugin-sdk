# Panes and the ui builders

Registering and opening panes needs `workspace`.

## Declarative panes

Extend `PaneView<S>` and return `UiNode[]` from `render()`. Jensen paints the tree with its own components, so
the pane follows the theme with no CSS.

| Member | Notes |
|---|---|
| `render()` | required, may be async |
| `state`, `setState(next)` | state is stored with the layout and survives restarts. `setState` also re-renders |
| `refresh()` | ask Jensen to render again |
| `onOpen()`, `onClose()` | pane lifecycle hooks, both optional |
| `app`, `plugin`, `instanceId`, `ctx` | context. `ctx.paneId` is the id you registered |

Handlers in the tree are plain functions. After one runs, Jensen asks for `render()` again. A handler from an
older render is refused, so always build handlers inside `render()`.

```ts check
import { PaneView, Plugin } from "@jensen-org/plugin-sdk";
import * as ui from "@jensen-org/plugin-sdk/ui";

interface Filter {
  text: string;
  done: boolean;
}

class Tasks extends PaneView<Filter> {
  render() {
    return [
      ui.Stack([
        ui.Toolbar([
          ui.Input({
            label: "Filter",
            value: this.state.text,
            placeholder: "Type to filter",
            onChange: (value) => this.setState({ ...this.state, text: value }),
          }),
          ui.Toggle({
            label: "Done only",
            value: this.state.done,
            onChange: (value) => this.setState({ ...this.state, done: value }),
          }),
        ]),
        ui.Table({
          columns: [
            { key: "name", label: "Task" },
            { key: "progress", label: "Progress", align: "end" },
          ],
          rows: [{ name: "Write tests", progress: ui.bar(0.5, "50%") }],
          empty: "Nothing here",
        }),
      ]),
    ];
  }
}

export default class TasksPlugin extends Plugin {
  onload() {
    this.registerPane("tasks", Tasks, { title: "Tasks", icon: "list", singleton: true });
  }
}
```

## Node builders

All return `UiNode` and live in `@jensen-org/plugin-sdk/ui`. Import with `import * as ui from ...` or use the
`ui` namespace exported by the main package.

| Group | Builders |
|---|---|
| Text | `Heading(text, level?)`, `Text(text, tone?)`, `Code(text, language?)`, `Markdown(text)`, `Badge(text, tone?)`, `Divider()` |
| Layout | `Stack(children, { gap? })`, `Row(children, { gap?, align? })`, `Toolbar(children)`, `Split(children, { direction?, sizes? })`, `Section(title, children)`, `Tabs({ tabs, active?, onChange? })` |
| Data | `Table({ columns, rows, empty? })`, `List(items)`, `Tree({ nodes, selected?, onSelect? })`, `KeyValue(items)`, `Stat(label, value, hint?)`, `Progress(value, label?)`, `bar(value, title?)` as a table cell |
| Input | `Button({ label, onClick, icon?, tone? })`, `IconButton({ icon, label, onClick })`, `Input`, `Textarea`, `Toggle`, `Checkbox`, `Select({ value, options, onChange })` |
| Feedback | `Empty(title, hint?)`, `Spinner(label?)`, `Message(text, tone?)` |

`Tone` is `default`, `muted`, `info`, `success`, `warning` or `danger`. Icons are Lucide icon names that Jensen
ships, such as `rocket`, `star` or `terminal`. Input handlers receive the new value (`string` or `boolean`).
A `Table` row maps each column `key` to a `Cell`: string, number, boolean, null or `ui.bar(...)`.

## Custom panes

For what nodes cannot express, extend `CustomPaneView`. It runs in a sandboxed frame and draws its own DOM.
Jensen's theme arrives as CSS custom properties such as `var(--bg-0)`, `var(--fg)` and `var(--primary)`.

```ts check
import { CustomPaneView, Plugin } from "@jensen-org/plugin-sdk";

class Clock extends CustomPaneView {
  private timer?: ReturnType<typeof setInterval>;

  onMount(element: HTMLElement) {
    const face = document.createElement("p");
    face.style.cssText = "font:600 2rem/1 var(--font-mono);color:var(--primary)";
    const tick = () => {
      face.textContent = new Date().toLocaleTimeString();
    };
    tick();
    this.timer = setInterval(tick, 1000);
    element.append(face);
  }

  onUnmount() {
    clearInterval(this.timer);
  }
}

export default class ClockPlugin extends Plugin {
  onload() {
    this.registerPane("clock", Clock, { title: "Clock", icon: "star", singleton: true });
  }
}
```

A custom pane cannot return a node tree. `this.app.theme.applyTo(element)` writes the tokens onto any element.
Clean up timers and listeners in `onUnmount()`.

## Opening and finding panes

```ts
const leaf = await this.app.workspace.openPane("tasks", { direction: "right", state: { text: "", done: false } });
await leaf.focus();
const open = await this.app.workspace.getLeavesOfType("tasks");
for (const each of open) await each.refresh();
```

`OpenPaneOptions`: `state`, `direction` (`above`, `below`, `left`, `right`, `within`), `reference` (a
`PaneLeaf`), `focus`. A `PaneLeaf` has `focus`, `close`, `setState`, `refresh`, `moveNextTo(reference, direction)`
and `instanceId`, `paneId`, `pluginId`, `kind`, `title`, `active`. `currentPage()` resolves to `session`, `code`
or `notes`.
