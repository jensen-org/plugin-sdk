# Jensen plugin SDK

Build extensions for [Jensen](https://github.com/jensen-org/jensen): panes, commands, hotkeys, settings,
menus, and typed access to the project's files, the code editor, the layout and the theme.

```bash
npx @jensen-org/plugin-sdk create my-plugin
```

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

## One package

| Import | What it is |
|---|---|
| `@jensen-org/plugin-sdk` | The one class to extend and the object graph (`app.workspace`, `editor`, `files`, `theme`, ...) |
| `@jensen-org/plugin-sdk/ui` | Typed builders for the interface a pane describes |
| `@jensen-org/plugin-sdk/protocol` | The wire protocol as types, generated from the host's schema |
| `@jensen-org/plugin-sdk/testing` | `TestHost`, a stand in for Jensen in your tests |
| `jensen-plugin` (bin) | `create`, `build`, `dev`, `validate` and `publish` |

A plugin depends on `@jensen-org/plugin-sdk` and nothing else.

## Publish

```bash
npx jensen-plugin publish               # validate, build, write release/, print the store entry
npx jensen-plugin publish --release     # also create the GitHub release and upload release/*
npx jensen-plugin publish --store-pr    # also open a PR adding the entry to jensen-org/plugins-store
```

Plugins are listed in the [plugins store](https://github.com/jensen-org/plugins-store). Teams can also add private
registries in Jensen under Settings, Plugins, read with a token or with the connected GitHub or GitLab account.
See the publishing guide in `docs/guide/publishing.md`.

## Rules the SDK keeps

- Jensen has **three pages and a plugin cannot add or change them**. Panes are the open ended surface.
- **No method exposes a stored secret**, keychain item or credential. A guard in the protocol module and in Jensen fails the build if one appears.
- Every capability a plugin uses is declared in its manifest and granted by the user; Jensen enforces it on each call.

## Develop this repo

```bash
bun install
bun run check        # protocol sync, lint, build, typecheck, tests, API report, docs
bun run docs:dev
```

The protocol (`protocol/plugin-api.v1.json`) is owned by Jensen and vendored here. To take a new version,
copy `schema/plugin-api.v1.json` from Jensen over it, run `bun run protocol:generate`, and review the diff.
`protocol/PINNED` names the Jensen ref CI compares against; set `JENSEN_REPO` to a local checkout to compare
against that instead.

Public API changes show up as diffs in `api/`. Run `bun run api:update` after one.

## Releasing

Add a changeset (`bun run changeset`). A release is a `v<version>` tag on a commit on `main`, approved in the
`release` environment, published with npm provenance. Nothing publishes automatically. The one time setup is in
[RELEASING.md](RELEASING.md).

MIT licensed.
