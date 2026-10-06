# Files

`app.files` reads and writes the project's files. Paths are relative to the project root and have to sit
inside a folder listed under `fs` in `jensen.permissions`. Jensen enforces that below the plugin: a path
outside every granted folder fails, and so does one that reaches outside through a symlink.

```ts
const entries = await this.app.files.list("docs");     // FileEntry | FolderEntry
const text = await this.app.files.read("docs/a.md");
await this.app.files.write("docs/b.md", text);
await this.app.files.rename("docs/b.md", "docs/c.md");
const watcher = await this.app.files.watch("docs", (change) => console.log(change.path));
```

A granted folder itself cannot be deleted or renamed away.

Plugins never see stored secrets: there is no API that reads tokens, keys or the keychain.
