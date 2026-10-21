# Settings

A `SettingTab` appears under Settings, Extensions. Registering one needs no permission. Describe the rows with
the fluent `Setting` builder, the way Obsidian does. Jensen draws them with its own components.

```ts check
import { Plugin, Setting, SettingTab } from "@jensen-org/plugin-sdk";

interface Data {
  name: string;
  limit: number;
  loud: boolean;
  mode: string;
}

class Tab extends SettingTab {
  constructor(private readonly owner: Prefs) {
    super(owner.app, owner, { title: "Prefs" });
  }

  display() {
    this.containerEl.addHeading("General");
    new Setting(this.containerEl)
      .setName("Name")
      .setDesc("Shown in the status bar")
      .addText((text) =>
        text.setValue(this.owner.data.name).onChange((value) => this.owner.update({ name: value })),
      );
    new Setting(this.containerEl).setName("Limit").addSlider((slider) =>
      slider
        .setLimits(1, 100, 1)
        .setValue(this.owner.data.limit)
        .onChange((value) => this.owner.update({ limit: value })),
    );
    new Setting(this.containerEl)
      .setName("Loud")
      .addToggle((toggle) =>
        toggle.setValue(this.owner.data.loud).onChange((value) => this.owner.update({ loud: value })),
      );
    new Setting(this.containerEl).setName("Mode").addDropdown((dropdown) =>
      dropdown
        .addOptions({ fast: "Fast", safe: "Safe" })
        .setValue(this.owner.data.mode)
        .onChange((value) => this.owner.update({ mode: value })),
    );
    new Setting(this.containerEl).setName("Reset").addButton((button) =>
      button
        .setButtonText("Reset")
        .setWarning()
        .onClick(() => this.owner.update({ name: "", limit: 10 })),
    );
  }
}

export default class Prefs extends Plugin {
  data: Data = { name: "", limit: 10, loud: false, mode: "safe" };

  async onload() {
    this.data = { ...this.data, ...((await this.loadData<Data>()) ?? {}) };
    this.addSettingTab(new Tab(this));
  }

  async update(patch: Partial<Data>) {
    this.data = { ...this.data, ...patch };
    await this.saveData(this.data);
  }
}
```

## Controls

| Builder | Component methods |
|---|---|
| `addText`, `addTextArea` | `setValue`, `setPlaceholder`, `onChange(string)` |
| `addNumber` | `setValue`, `setLimits(min, max, step?)`, `onChange(number)` |
| `addSlider` | same as number, with `min` and `max` always set |
| `addToggle` | `setValue(boolean)`, `onChange(boolean)` |
| `addDropdown` | `addOption(value, label)`, `addOptions({ value: label })`, `setValue`, `onChange` |
| `addColor` | `setValue`, `onChange(string)` |
| `addButton` | `setButtonText`, `setWarning()`, `onClick` |

`Setting` also has `setName`, `setDesc` and `setHeading()`. `containerEl` has `addHeading(text)` and
`addDescription(text)`.

## Rules

- Fill `this.containerEl` inside `display()` only. Jensen swaps in a fresh container on every render, and asks
  for `display()` again after each change, so rows reflect your state.
- `SettingTab` constructor options are `{ id?, title? }`. `refresh()` asks Jensen to redraw, for example
  after the plugin's data changed elsewhere.
- Persist your own data with `loadData()` and `saveData()`. They need no permission. Merge saved data over
  defaults, as above, so new fields get a value after an upgrade.
- Jensen's own settings are `this.app.settings.get(key)` and `set(key, value)` and need `settings` in the
  manifest. They never expose secrets. `this.app.settings.on("change", ...)` reports changes.
