# Getting started

```bash
npm create jensen-plugin@latest my-plugin
cd my-plugin
npm install
npm run build
npx jensen-plugin publish
```

Install the `release/` folder `jensen-plugin publish` assembled from Jensen's Settings, Plugins, Install from GitHub.

A plugin is one class:

```ts
import { Notice, Plugin } from "jensen-plugin-sdk";

export default class Hello extends Plugin {
  onload() {
    this.addCommand({
      id: "say",
      name: "Say hello",
      hotkey: { key: "Mod+Shift+H" },
      callback: () => new Notice("Hello"),
    });
  }
}
```

Everything you register in `onload()` is removed again when the plugin unloads.

## Three pages, any number of panes

Jensen has exactly three pages and no plugin can add or change them. What a plugin adds is **panes**:
as many as it likes, opened from the pane picker, a command, or code. The SDK has no page or route API on
purpose.

## One dependency

`jensen-plugin-sdk` re-exports `jensen-ui` (as `ui`) and the protocol types, so a plugin needs only one
package.
