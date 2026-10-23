# jensen-plugin-backend

Write the Rust backend of a [Jensen](https://github.com/jensen-org/jensen) plugin. A backend is a WebAssembly
program with named JSON methods. Jensen runs it in a sandbox, the plugin's UI calls it with `app.backend`, and AI
agents call it through the `tools` the plugin declares.

Most plugins do not need one. Add a backend for heavy work, or for tools an agent can call while Jensen's window
is closed.

```toml
[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
jensen-plugin-backend = { git = "https://github.com/jensen-org/plugin-sdk", tag = "v0.3.0" }
```

Set `tag` to the version of `@jensen-org/plugin-sdk` the plugin uses. The crate is not on crates.io.

```rust
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

Build with `rustup target add wasm32-unknown-unknown` once, then `jensen-plugin build`. `cargo test` runs natively.

The guide is in `docs/guide/backend.md` of the repository, and the plugin SDK ships an agent skill that covers it.
