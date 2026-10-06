# Publishing

Publishing lives in the SDK, not in the Jensen app. Run from the plugin folder.

```bash
jensen-plugin publish [--minify] [--no-build] [--release] [--store-pr] [--cwd <dir>]
```

It does four things:

1. Validates the `jensen` block of `package.json` and requires `README.md`.
2. Builds `main.js` (`--no-build` keeps the one you already built, `--minify` shrinks it).
3. Writes `release/` with `manifest.json`, `main.js` and `README.md`. The manifest pins the other assets with a
   sha256, so the manifest checksum vouches for the whole download.
4. Prints the plugin store entry, validated against the store rules.

## The store entry

| Field | Comes from | Rule |
|---|---|---|
| `id` | `jensen.id`, else `plugin.<slug of name>` | reverse dns with at least one dot |
| `name`, `description` | `name`, `description` in `package.json` | required |
| `author` | `author` as a string, or its `name` | required |
| `version` | `version` | `major.minor.patch` |
| `min_app_version` | `jensen.minAppVersion` | `major.minor.patch` |
| `category` | `jensen.category` | lowercase letters, digits and hyphens |
| `repo` | `jensen.repo` | GitHub `owner/name` |
| `tag` | `jensen.tag`, optional | no slashes or whitespace. The release tag is this, else the version |
| `sha256` | digest of `manifest.json` | 64 hex characters |

## Release and listing

```bash
jensen-plugin publish --release    # gh release create <tag>, uploads release/*
jensen-plugin publish --store-pr   # forks jensen-org/plugins-store and opens a PR adding entries/<id>.json
```

Both use the GitHub CLI, so run `gh auth login` first. The release repository must be public for the official
store, because Jensen fetches its releases anonymously. After the pull request merges, CI builds the store
`index.json` and the plugin appears under Settings, Plugins.

To try a build without publishing, install the `release/` folder from Settings, Plugins, Install from GitHub,
using the sha256 that `publish` prints.

## Other commands

| Command | Does |
|---|---|
| `jensen-plugin create [dir] [--yes] [--name n] [--id id] [--description d] [--author a] [--no-skill]` | scaffold a plugin and install this skill into it |
| `jensen-plugin build [--minify]` | validate then bundle `src/main.ts` into `main.js` (esm, es2022, browser) |
| `jensen-plugin dev [--publish]` | rebuild `main.js` on every change |
| `jensen-plugin validate` | check the `jensen` block and README without building |
| `jensen-plugin skill install [--target <agents\|claude\|all>] [--dir <path>] [--force]` | install this skill |

The entry file is `src/main.ts`, `src/main.tsx` or `src/main.js`, or whatever `jensen.entry` names.

## Versions

`jensen.minAppVersion` is the oldest Jensen the plugin runs on. The protocol version is `1`, and a plugin built
for another protocol version is refused with a message that says so. Bump `version` for every release, the tag
and store entry derive from it.

## Your own registry

A registry is a repository or an https host serving an `index.json` with the same entries as the official store.
Users add one under Settings, Plugins, with the plus button next to Registries. Auth is none, an API token
(kept in the keychain and sent only to that registry's host), or an account that Jensen already holds a token
for under Integrations. The official store is always listed and wins when an id appears in both.
