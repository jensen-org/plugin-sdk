import type { App } from "./app.ts";
import type { Plugin } from "./plugin.ts";
import type { SettingControl, Tone } from "./protocol/index.ts";

type Change<T> = (value: T) => void | Promise<void>;

export class SettingContainer {
  private readonly thunks: Array<() => SettingControl> = [];
  readonly changes = new Map<string, Change<never>>();
  readonly actions = new Map<string, () => void | Promise<void>>();
  private seq = 0;

  nextKey(): string {
    return `s${++this.seq}`;
  }

  push(control: () => SettingControl): void {
    this.thunks.push(control);
  }

  addHeading(text: string): this {
    this.push(() => ({ type: "heading", text }));
    return this;
  }

  addDescription(text: string): this {
    this.push(() => ({ type: "description", text }));
    return this;
  }

  controls(): SettingControl[] {
    return this.thunks.map((thunk) => thunk());
  }
}

export class TextComponent {
  value = "";
  placeholder?: string;
  handler?: Change<string>;
  setValue(value: string): this {
    this.value = value;
    return this;
  }
  setPlaceholder(placeholder: string): this {
    this.placeholder = placeholder;
    return this;
  }
  onChange(handler: Change<string>): this {
    this.handler = handler;
    return this;
  }
}

export class TextAreaComponent extends TextComponent {}

export class NumberComponent {
  value = 0;
  min?: number;
  max?: number;
  step?: number;
  handler?: Change<number>;
  setValue(value: number): this {
    this.value = value;
    return this;
  }
  setLimits(min: number, max: number, step?: number): this {
    this.min = min;
    this.max = max;
    this.step = step;
    return this;
  }
  onChange(handler: Change<number>): this {
    this.handler = handler;
    return this;
  }
}

export class SliderComponent extends NumberComponent {
  override min = 0;
  override max = 100;
}

export class ToggleComponent {
  value = false;
  handler?: Change<boolean>;
  setValue(value: boolean): this {
    this.value = value;
    return this;
  }
  onChange(handler: Change<boolean>): this {
    this.handler = handler;
    return this;
  }
}

export class DropdownComponent {
  value = "";
  options: { value: string; label: string }[] = [];
  handler?: Change<string>;
  addOption(value: string, label: string): this {
    this.options.push({ value, label });
    return this;
  }
  addOptions(options: Record<string, string>): this {
    for (const [value, label] of Object.entries(options)) this.addOption(value, label);
    return this;
  }
  setValue(value: string): this {
    this.value = value;
    return this;
  }
  onChange(handler: Change<string>): this {
    this.handler = handler;
    return this;
  }
}

export class ColorComponent {
  value = "#000000";
  handler?: Change<string>;
  setValue(value: string): this {
    this.value = value;
    return this;
  }
  onChange(handler: Change<string>): this {
    this.handler = handler;
    return this;
  }
}

export class ButtonComponent {
  label = "";
  tone?: Tone;
  handler?: () => void | Promise<void>;
  setButtonText(label: string): this {
    this.label = label;
    return this;
  }
  setWarning(): this {
    this.tone = "danger";
    return this;
  }
  onClick(handler: () => void | Promise<void>): this {
    this.handler = handler;
    return this;
  }
}

/**
 * One row of a settings tab, built the way Obsidian's `Setting` is. Jensen draws the row with its own
 * components, so a plugin's settings look and behave like the rest of Settings.
 */
export class Setting {
  private name = "";
  private desc?: string;
  private built = false;

  constructor(private readonly container: SettingContainer) {}

  setName(name: string): this {
    this.name = name;
    return this;
  }

  setDesc(desc: string): this {
    this.desc = desc;
    return this;
  }

  setHeading(): this {
    if (!this.built) {
      this.built = true;
      this.container.push(() => ({ type: "heading", text: this.name }));
    }
    return this;
  }

  addText(build: (component: TextComponent) => void): this {
    const component = new TextComponent();
    build(component);
    return this.control(component.handler, (key) => ({
      type: "text",
      key,
      name: this.name,
      desc: this.desc,
      value: component.value,
      placeholder: component.placeholder,
    }));
  }

  addTextArea(build: (component: TextAreaComponent) => void): this {
    const component = new TextAreaComponent();
    build(component);
    return this.control(component.handler, (key) => ({
      type: "textarea",
      key,
      name: this.name,
      desc: this.desc,
      value: component.value,
    }));
  }

  addNumber(build: (component: NumberComponent) => void): this {
    const component = new NumberComponent();
    build(component);
    return this.control(component.handler, (key) => ({
      type: "number",
      key,
      name: this.name,
      desc: this.desc,
      value: component.value,
      min: component.min,
      max: component.max,
      step: component.step,
    }));
  }

  addSlider(build: (component: SliderComponent) => void): this {
    const component = new SliderComponent();
    build(component);
    return this.control(component.handler, (key) => ({
      type: "slider",
      key,
      name: this.name,
      desc: this.desc,
      value: component.value,
      min: component.min,
      max: component.max,
      step: component.step,
    }));
  }

  addToggle(build: (component: ToggleComponent) => void): this {
    const component = new ToggleComponent();
    build(component);
    return this.control(component.handler, (key) => ({
      type: "toggle",
      key,
      name: this.name,
      desc: this.desc,
      value: component.value,
    }));
  }

  addDropdown(build: (component: DropdownComponent) => void): this {
    const component = new DropdownComponent();
    build(component);
    return this.control(component.handler, (key) => ({
      type: "dropdown",
      key,
      name: this.name,
      desc: this.desc,
      value: component.value,
      options: component.options,
    }));
  }

  addColor(build: (component: ColorComponent) => void): this {
    const component = new ColorComponent();
    build(component);
    return this.control(component.handler, (key) => ({
      type: "color",
      key,
      name: this.name,
      desc: this.desc,
      value: component.value,
    }));
  }

  addButton(build: (component: ButtonComponent) => void): this {
    const component = new ButtonComponent();
    build(component);
    const key = this.container.nextKey();
    if (component.handler) this.container.actions.set(key, component.handler);
    this.container.push(() => ({
      type: "button",
      key,
      name: this.name,
      desc: this.desc,
      label: component.label,
      tone: component.tone,
    }));
    this.built = true;
    return this;
  }

  private control<V>(handler: Change<V> | undefined, build: (key: string) => SettingControl): this {
    const key = this.container.nextKey();
    if (handler) this.container.changes.set(key, handler as Change<never>);
    this.container.push(() => build(key));
    this.built = true;
    return this;
  }
}

/** A section in Settings, under Extensions. Fill `containerEl` in `display()`. */
export abstract class SettingTab {
  readonly id: string;
  readonly title: string;
  containerEl = new SettingContainer();

  constructor(
    readonly app: App,
    readonly plugin: Plugin,
    options: { id?: string; title?: string } = {},
  ) {
    this.id = options.id ?? "settings";
    this.title = options.title ?? plugin.id;
  }

  abstract display(): void | Promise<void>;

  /** Asks Jensen to draw the section again, for example after the plugin's data changed. */
  refresh(): Promise<null> {
    return this.app.call("settings.refreshTab", { id: this.id });
  }
}
