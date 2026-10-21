# A Rust backend

Some work does not belong in JavaScript: decoding images, parsing a big file, compressing. A plugin can ship
a **backend**, a Rust program compiled to WebAssembly that Jensen runs in a sandbox. The plugin calls it
from its UI, and AI agents call the same program through the tools the plugin declares.

```bash
npx jensen-plugin create my-plugin --backend
```

scaffolds a plugin with a backend crate and a viewer toolbar that calls it.

## Write the backend

```toml
# backend/Cargo.toml
[lib]
crate-type = ["cdylib"]

[dependencies]
jensen-plugin-backend = { git = "https://github.com/jensen-org/plugin-sdk", tag = "v0.2.0" }
```

```rust
// backend/src/lib.rs
use jensen_plugin_backend::{Backend, Value, fs, json};

fn shrink(input: Value) -> Result<Value, String> {
    let path = input["path"].as_str().ok_or("path is required")?;
    let bytes = fs::read(path)?;
    fs::write(path, &bytes[..bytes.len() / 2])?;
    Ok(json!({ "before": bytes.len() }))
}

fn register(backend: &mut Backend) {
    backend.method("shrink", shrink);
}

jensen_plugin_backend::export!(register);
```

A method takes JSON and returns JSON, or an error message. The crate also builds natively, so
`cargo test` exercises your logic without WebAssembly.

## Declare it

```json
"jensen": {
  "backend": "backend.wasm",
  "backendBuild": "cargo build --release --target wasm32-unknown-unknown --manifest-path backend/Cargo.toml && cp backend/target/wasm32-unknown-unknown/release/my_plugin.wasm backend.wasm",
  "permissions": { "backend": true, "fs": ["*.png"] },
  "tools": [
    {
      "name": "shrink",
      "description": "Halve a file",
      "inputSchema": { "type": "object", "properties": { "path": { "type": "string" } }, "required": ["path"] }
    }
  ]
}
```

`jensen-plugin build` runs `backendBuild` first. `jensen-plugin publish` copies the `.wasm` into `release/` and
pins its sha256 in the manifest, like `main.js`.

## Call it from the plugin

```ts
const { result, touched } = await this.app.backend.run<{ before: number }>("shrink", { path: "a.png" });
```

`app.backend.call` returns only the result. `touched` lists the paths the backend wrote or deleted, and
Jensen refreshes any open tab on them, so the file viewer shows the change at once.

## Agent tools

Every entry under `tools` is a method of the backend. Agents see them through `list_plugin_tools` and run
them with `call_plugin_tool`, named `<plugin_id>_<tool>`, even when Jensen's window is closed. Write the
description for the agent: it decides from it when to call the tool.

## What the sandbox allows

The backend is deny by default. It reaches only the files that fall inside the `fs` scopes the user approved
and has no network, clock or process access. Each call has a time limit, a memory limit and an I/O budget.
Jensen shows the user the backend and the tools before they enable the plugin.
