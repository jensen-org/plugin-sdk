# Files

`app.files` reads and writes the project's files. Paths are relative to the project root and have to fall
inside a scope listed under `fs` in `jensen.permissions`. A scope is:

| Scope | Reaches |
|---|---|
| `"docs"` | the folder and everything under it |
| `"*.png"` | every `.png` file anywhere in the project |
| `"."` or `"*"` | every file in the project |

Jensen enforces the scopes below the plugin: a path outside them fails, and so does one that reaches outside
through a symlink. The user sees each scope in plain words and approves it before the plugin is enabled, so
ask for the narrowest one that works.

```ts
const entries = await this.app.files.list("docs");     // FileEntry | FolderEntry
const text = await this.app.files.read("docs/a.md");
await this.app.files.write("docs/b.md", text);
await this.app.files.rename("docs/b.md", "docs/c.md");
const watcher = await this.app.files.watch("docs", (change) => console.log(change.path));
```

Read and write bytes for formats that are not text:

```ts
const png = await this.app.files.readBytes("img/logo.png"); // Uint8Array
await this.app.files.writeBytes("img/logo.webp", png);
```

A granted folder itself cannot be deleted or renamed away, and a file type scope cannot delete a folder.

Plugins never see stored secrets: there is no API that reads tokens, keys or the keychain.
