# The theme

```ts
const { id, appearance, tokens } = this.app.theme.current;
this.registerEvent(this.app.theme.on("change", (theme) => this.redraw(theme)));
await this.app.theme.set("nord");                       // needs `theme`
this.registerTheme(myThemeDocument);                    // needs `theme`
```

Declarative panes follow the theme automatically. A custom pane gets the tokens as CSS custom properties on
its document, kept up to date; `app.theme.applyTo(element)` writes them onto any element.

A theme document follows Jensen's `schema/theme.schema.json`, and Jensen validates it.
