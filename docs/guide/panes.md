# Panes

## Declarative panes

Extend `PaneView` and return `@jensen-org/plugin-sdk/ui` nodes. Jensen draws them with its own components, so the pane
matches the app and follows the theme with no CSS.

```ts
import { PaneView } from "@jensen-org/plugin-sdk";
import * as ui from "@jensen-org/plugin-sdk/ui";

class Counter extends PaneView<{ n: number }> {
  render() {
    return [
      ui.Stack([
        ui.Heading(`Count ${this.state.n}`),
        ui.Button({ label: "Add", onClick: () => this.setState({ n: this.state.n + 1 }) }),
      ]),
    ];
  }
}

// in onload()
this.registerPane("counter", Counter, { title: "Counter", icon: "star" });
```

Handlers are plain functions. After one runs, Jensen asks for `render()` again. A handler from an older
render is refused rather than run against stale state.

`setState` stores the state with the layout, so a pane comes back as it was after a restart.

## Custom panes

For what nodes cannot express, extend `CustomPaneView`. It runs in a sandboxed frame and draws its own DOM;
Jensen's theme tokens arrive as CSS custom properties (`var(--bg-0)`, `var(--fg)`, `var(--primary)`).

```ts
class Clock extends CustomPaneView {
  onMount(el: HTMLElement) {
    el.textContent = new Date().toLocaleTimeString();
  }
}
```

## Opening panes

```ts
const leaf = await this.app.workspace.openPane("counter", { direction: "right", state: { n: 0 } });
await leaf.focus();
```

`workspace` permission is required to register and open panes.
