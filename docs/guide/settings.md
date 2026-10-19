# Settings

A settings tab appears under Settings > Extensions. You describe the rows with the same fluent builder
Obsidian uses; Jensen draws them with its own components.

```ts
class Tab extends SettingTab {
  display() {
    this.containerEl.addHeading("General");
    new Setting(this.containerEl)
      .setName("Name")
      .setDesc("Shown in the status bar")
      .addText((t) => t.setValue(this.plugin.data.name).onChange((v) => this.plugin.update({ name: v })));
  }
}

this.addSettingTab(new Tab(this.app, this, { title: "My plugin" }));
```

Components: `addText`, `addTextArea`, `addNumber`, `addSlider`, `addToggle`, `addDropdown`, `addColor`,
`addButton`, and `setHeading()`. After a change Jensen asks `display()` again, so rows reflect your state.

Persist your own data with `loadData()` and `saveData()`. They are shared by every project by default. Pass
`{ scope: "project" }` to keep a copy for the open project only, and read the project with `app.project`
(`{ id, name }`, undefined in a Jensen too old to send it). Project scope needs a Jensen that carries it, so
check `app.project` before relying on it.

Jensen's own settings are readable with `app.settings` (needs the `settings` permission). Settings that
hold secrets are never exposed.
