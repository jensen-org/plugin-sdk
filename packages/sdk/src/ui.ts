import type { Severity, Tone } from "jensen-plugin-protocol";
import type { App } from "./app.ts";
import type { HostConnection } from "./connection.ts";
import { currentApp } from "./context.ts";

export interface NoticeOptions {
  severity?: Severity;
  timeoutMs?: number;
}

/** A toast. `new Notice("Saved")` works anywhere inside a running plugin. */
export class Notice {
  constructor(message: string, options: NoticeOptions = {}) {
    const app = currentApp();
    app
      .call("ui.notice", { message, severity: options.severity, timeoutMs: options.timeoutMs })
      .catch((cause) => {
        queueMicrotask(() => {
          throw cause;
        });
      });
  }
}

export class ConfirmModal {
  constructor(
    private readonly app: App,
    private readonly options: {
      title: string;
      message: string;
      confirmLabel?: string;
      danger?: boolean;
    },
  ) {}

  open(): Promise<boolean> {
    return this.app.call("ui.confirm", this.options);
  }
}

export class ChoiceModal {
  constructor(
    private readonly app: App,
    private readonly options: {
      title: string;
      message: string;
      choices: { id: string; label: string }[];
    },
  ) {}

  open(): Promise<string | null> {
    return this.app.call("ui.choose", this.options);
  }
}

export class PromptModal {
  constructor(
    private readonly app: App,
    private readonly options: {
      title: string;
      message?: string;
      placeholder?: string;
      initial?: string;
      confirmLabel?: string;
    },
  ) {}

  open(): Promise<string | null> {
    return this.app.call("ui.prompt", this.options);
  }
}

export interface SuggestOptions<T> {
  title: string;
  placeholder?: string;
  items: T[];
  getText: (item: T) => string;
  getDetail?: (item: T) => string | undefined;
  getIcon?: (item: T) => string | undefined;
}

/** A searchable list. `open()` resolves to the picked item, or null when dismissed. */
export class SuggestModal<T> {
  constructor(
    private readonly app: App,
    private readonly options: SuggestOptions<T>,
  ) {}

  async open(): Promise<T | null> {
    const { items, getText, getDetail, getIcon } = this.options;
    const picked = await this.app.call("ui.suggest", {
      title: this.options.title,
      placeholder: this.options.placeholder,
      items: items.map((item, index) => ({
        id: String(index),
        label: getText(item),
        detail: getDetail?.(item),
        icon: getIcon?.(item),
      })),
    });
    return picked === null ? null : (items[Number(picked)] ?? null);
  }
}

export class MenuItem {
  title = "";
  icon?: string;
  disabled = false;
  separatorBefore = false;
  callback?: () => void | Promise<void>;
  submenu?: Menu;

  setTitle(title: string): this {
    this.title = title;
    return this;
  }
  setIcon(icon: string): this {
    this.icon = icon;
    return this;
  }
  setDisabled(disabled: boolean): this {
    this.disabled = disabled;
    return this;
  }
  setSeparatorBefore(): this {
    this.separatorBefore = true;
    return this;
  }
  onClick(callback: () => void | Promise<void>): this {
    this.callback = callback;
    return this;
  }
  setSubmenu(): Menu {
    this.submenu = new Menu();
    return this.submenu;
  }
}

export class Menu {
  readonly items: MenuItem[] = [];

  addItem(build: (item: MenuItem) => void): this {
    const item = new MenuItem();
    build(item);
    this.items.push(item);
    return this;
  }

  addSeparator(): this {
    const last = this.items.at(-1);
    if (last) last.separatorBefore = false;
    this.items.push(new MenuItem().setSeparatorBefore().setTitle("").setDisabled(true));
    return this;
  }
}

export class StatusBarItem {
  private state: {
    text?: string;
    icon?: string;
    tooltip?: string;
    tone?: Tone;
    clickable: boolean;
  } = { clickable: false };
  private callback?: () => void | Promise<void>;
  private scheduled = false;
  private removed = false;

  constructor(
    private readonly connection: HostConnection,
    readonly id: string,
    private readonly register: boolean,
  ) {}

  setText(text: string): this {
    this.state.text = text;
    return this.push();
  }
  setIcon(icon: string): this {
    this.state.icon = icon;
    return this.push();
  }
  setTooltip(tooltip: string): this {
    this.state.tooltip = tooltip;
    return this.push();
  }
  setTone(tone: Tone): this {
    this.state.tone = tone;
    return this.push();
  }
  onClick(callback: () => void | Promise<void>): this {
    this.callback = callback;
    this.state.clickable = true;
    return this.push();
  }

  click(): void | Promise<void> {
    return this.callback?.();
  }

  async remove(): Promise<void> {
    this.removed = true;
    if (this.register) await this.connection.call("ui.removeStatus", { id: this.id });
  }

  private push(): this {
    if (this.scheduled || !this.register) return this;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      if (this.removed) return;
      this.connection.call("ui.setStatus", { id: this.id, ...this.state }).catch((cause) => {
        queueMicrotask(() => {
          throw cause;
        });
      });
    });
    return this;
  }
}
