# Menus and the status strip

## Context menus

```ts
this.registerMenu("explorer", (menu, ctx) => {
  menu.addItem((item) => item.setTitle(`Open ${ctx.path}`).setIcon("star").onClick(() => open(ctx.path)));
});
```

Targets and their context: `explorer` (`path`, `targets`, `isDirectory`), `editor` (`path`, `hasSelection`),
`pane` (`instanceId`, `paneKind`), `tab` (`path`). Jensen asks for the items each time the menu opens and
waits up to 150 ms for the answer.

## The status strip

```ts
const status = this.addStatusBarItem();
status.setText("Ready").setIcon("rocket").setTone("success").onClick(() => this.open());
```

The strip only shows when a plugin has put something in it.

## Notices and dialogs

`new Notice("Saved")`, `new ConfirmModal(app, {...}).open()`, `new PromptModal`, `new ChoiceModal`,
`new SuggestModal` (a searchable list).
