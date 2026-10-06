# Getting started

```bash
npx @jensen-org/plugin-sdk create my-plugin
cd my-plugin
npm install
npm run build
npx jensen-plugin publish
```

Install the `release/` folder `jensen-plugin publish` assembled from Jensen's Settings, Plugins, Install from GitHub.

A plugin is one class:

```ts
import { Notice, Plugin } from "@jensen-org/plugin-sdk";

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

`@jensen-org/plugin-sdk` is the only dependency a plugin needs. It ships the pane builders as
`@jensen-org/plugin-sdk/ui`, the protocol types as `@jensen-org/plugin-sdk/protocol` and the test host as
`@jensen-org/plugin-sdk/testing`. `bunx @jensen-org/plugin-sdk create my-plugin` scaffolds the same plugin.
