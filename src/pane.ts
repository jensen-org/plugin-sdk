import type { App } from "./app.ts";
import type { Plugin } from "./plugin.ts";
import type { UiNode } from "./ui/index.ts";

export interface PaneContext<S = unknown> {
  app: App;
  plugin: Plugin;
  paneId: string;
  instanceId: string;
  state: S;
}

/**
 * A pane Jensen draws for the plugin. `render()` returns a tree of `@jensen-org/plugin-sdk/ui` nodes and Jensen paints
 * it with its own components, so the pane matches the app and follows the theme. After a handler runs,
 * Jensen asks for `render()` again.
 */
export abstract class PaneView<S = unknown> {
  protected current: S;

  constructor(readonly ctx: PaneContext<S>) {
    this.current = ctx.state;
  }

  get app(): App {
    return this.ctx.app;
  }

  get plugin(): Plugin {
    return this.ctx.plugin;
  }

  get instanceId(): string {
    return this.ctx.instanceId;
  }

  /** What this pane was opened with and last stored. Jensen keeps it with the layout across restarts. */
  get state(): S {
    return this.current;
  }

  async setState(next: S): Promise<void> {
    this.current = next;
    await this.app.call("workspace.setPaneState", { instanceId: this.instanceId, state: next });
  }

  refresh(): Promise<null> {
    return this.app.call("workspace.refreshPane", { instanceId: this.instanceId });
  }

  onOpen(): void | Promise<void> {}

  onClose(): void | Promise<void> {}

  abstract render(): UiNode[] | Promise<UiNode[]>;
}

/**
 * A pane that draws its own DOM, for what a tree of nodes cannot express. It runs in a sandboxed
 * frame beside Jensen: Jensen's theme is applied to it as CSS custom properties.
 */
export abstract class CustomPaneView<S = unknown> {
  constructor(readonly ctx: PaneContext<S>) {}

  get app(): App {
    return this.ctx.app;
  }

  get plugin(): Plugin {
    return this.ctx.plugin;
  }

  get state(): S {
    return this.ctx.state;
  }

  abstract onMount(element: HTMLElement): void | Promise<void>;

  onUnmount(): void | Promise<void> {}
}

export type PaneViewConstructor<S = unknown> = new (
  ctx: PaneContext<S>,
) => PaneView<S> | CustomPaneView<S>;

export interface PaneOptions {
  title: string;
  /** A Lucide icon name Jensen ships, such as "rocket" or "terminal". */
  icon?: string;
  /** Only one instance may exist, whatever asks for another. */
  singleton?: boolean;
}

export function isCustom<S>(view: PaneViewConstructor<S>): boolean {
  return (view as unknown as { prototype: unknown }).prototype instanceof CustomPaneView;
}
