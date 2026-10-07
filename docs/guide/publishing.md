# Publishing

Publishing lives in the SDK, not in the Jensen app. From your plugin folder:

```bash
npx jensen-plugin publish
```

It does four things:

1. Validates the `jensen` block of `package.json` and requires a `README.md`.
2. Builds `main.js` (pass `--no-build` to keep the one you already built, `--minify` to shrink it).
3. Writes `release/` with `manifest.json`, `main.js` and `README.md`, plus the backend `.wasm` when the plugin
   has one. The manifest pins every other asset with a sha256, so the manifest checksum vouches for the
   whole download.
4. Prints the plugin store entry, validated against the store schema.

Your README is shown before anyone installs, so say what the plugin does and why it asks for each
permission.

## The store entry

```json
{
  "id": "dev.me.hello",
  "name": "Hello",
  "author": "Me",
  "description": "Says hello from a pane",
  "category": "demo",
  "version": "1.0.0",
  "min_app_version": "0.1.0",
  "repo": "me/hello",
  "sha256": "..."
}
```

`jensen.category` and `jensen.repo` in `package.json` fill `category` and `repo`. Add `jensen.tag` when the release
tag is not just the version, which a repository shipping several plugins needs.

## Release and list it

```bash
npx jensen-plugin publish --release    # gh release create <tag>, uploads release/*
npx jensen-plugin publish --store-pr   # opens a PR adding entries/<id>.json to jensen-org/plugins-store
```

Both use the GitHub CLI (`gh`), so run `gh auth login` first. The release repository must be public for the
official store, because Jensen fetches its releases anonymously. The tag is `jensen.tag` when set, else the
version. Once the PR is merged, CI builds the store `index.json` and the plugin shows up under Settings, Plugins.

To try a build without publishing, install the `release/` folder from Settings, Plugins, Install from GitHub.

## Your own registry

A registry is a repository, or any HTTPS host, serving an `index.json` with the same entries the official store
uses. Add one in Jensen under Settings, Plugins, with the plus button next to Registries. Each registry is read in
one of three ways:

| Auth | Use it for |
|---|---|
| None | A public registry |
| API token | A private registry. The token is kept in your keychain, never in settings, and is sent only to the registry's own host |
| Account | A private GitHub or GitLab registry when Jensen already holds your token for that host under Integrations |

The official store at `https://raw.githubusercontent.com/jensen-org/plugins-store/main/index.json` is always
listed. If a private registry lists an id the official store also lists, the official entry wins.

## Versions

`jensen.minAppVersion` is the oldest Jensen the plugin runs on. The protocol version is `1`; a plugin built
for another version is refused with a message that says so.
