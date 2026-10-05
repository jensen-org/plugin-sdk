import type { ActiveTheme, ThemeInfo } from "jensen-plugin-protocol";
import type { HostConnection } from "./connection.ts";
import { type Disposable, toDisposable } from "./disposable.ts";
import { Events } from "./events.ts";

/** A theme document, as described by Jensen's `schema/theme.schema.json`. Jensen validates it. */
export type ThemeDocument = Record<string, unknown> & { id: string };

export class Theme extends Events<{ change: [ActiveTheme] }> {
  private active: ActiveTheme;

  constructor(
    private readonly host: HostConnection,
    initial: ActiveTheme,
  ) {
    super();
    this.active = initial;
    host.subscribe("theme.changed", (theme) => {
      this.active = theme;
      this.trigger("change", theme);
    });
  }

  get current(): ActiveTheme {
    return this.active;
  }

  get tokens(): Record<string, string> {
    return this.active.tokens;
  }

  get appearance(): "light" | "dark" {
    return this.active.appearance;
  }

  list(): Promise<ThemeInfo[]> {
    return this.host.call("theme.list", {});
  }

  set(id: string): Promise<null> {
    return this.host.call("theme.set", { id });
  }

  async register(document: ThemeDocument): Promise<Disposable> {
    await this.host.call("theme.register", { document });
    return toDisposable(() => {
      this.host.call("theme.unregister", { id: document.id }).catch(() => undefined);
    });
  }

  /** Writes Jensen's tokens onto an element as CSS custom properties, for a pane that draws its own DOM. */
  applyTo(element: { style: { setProperty(name: string, value: string): void } }): void {
    for (const [name, value] of Object.entries(this.active.tokens)) {
      element.style.setProperty(name, value);
    }
  }
}
