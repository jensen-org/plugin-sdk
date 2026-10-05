# Publishing

1. `jensen-plugin validate` checks the `jensen` block of `package.json`.
2. `jensen-plugin build` writes `main.js`.
3. `jensen publish .` assembles `release/` (`manifest.json`, `main.js`, `README.md`), pins every asset with a
   sha256 and adds the folder as a development source so you can install it to try it.
4. Create a GitHub release tagged with the version that uploads every file in `release/`.
5. Open a PR adding the printed entry to the plugin store.

Your README is shown before anyone installs, so say what the plugin does and why it asks for each
permission.

## Versions

`jensen.minAppVersion` is the oldest Jensen the plugin runs on. The protocol version is `1`; a plugin built
for another version is refused with a message that says so.
