# jensen-ui

Typed builders for the interface a [Jensen](https://github.com/jensen-org/jensen) plugin pane describes.

A pane returns a tree of nodes. Jensen draws it with its own PrimeVue components, so a plugin pane
matches the app and follows the theme with no CSS at all.

```ts
import { Button, Heading, Stack, Text } from "jensen-ui";

render() {
  return [
    Stack([
      Heading("Hello"),
      Text("Counted clicks: 3", "muted"),
      Button({ label: "Click", onClick: () => this.bump() }),
    ]),
  ];
}
```

Handlers are plain functions. `jensen-plugin-sdk` turns them into ids on the way out and calls them
when the user interacts, then asks the pane to render again.

`jensen-plugin-sdk` re-exports this package as `ui`, so a plugin needs only one dependency.
