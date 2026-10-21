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
jensen-plugin-backend = { git = "https://github.com/jensen-org/plugin-sdk", tag = "v0.3.0" }
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

## List a folder

`fs::list("docs")` returns the folder's entries as `DirEntry { name, kind, size }`. Under a file type scope
such as `*.yaml` it shows the folders and the files in scope and nothing else. A backend that imports
`fs_list` needs a Jensen that provides it (minimum app version to be set when the app ships it), and one that
never lists a folder keeps loading everywhere.

## Reach Jensen from the backend

`host_api::call(method, params)` runs a protocol method as the plugin, under the same capability checks as
the frontend, so the backend needs the same manifest permissions. UI methods are refused, and a refusal comes
back as the host's own message. Typed helpers cover the common ones, and return the structs in
`jensen_plugin_backend::types` (`RunInstance`, `Container`, `LogPage`, `Session`, `Worktree`) rather than raw
JSON: `run::list()`, `containers::list()`, `containers::logs(id, &options)`, `sessions::list()`,
`worktrees::list()`, `run::remove_own()`, `git::history(params)`, `storage::load()` and
`storage::load_project()`. `git::history` stays a `serde_json::Value`, because the protocol does not type its
answer. An answer that does not fit its struct is an error that names the method.

`host_api::context()` says who is calling: `caller` is `Caller::Ui` or `Caller::Agent`, with the `plugin_id`,
`project_id` and, for an agent that called through a session, its `session_id` and `checkout` (that
session's worktree, relative to the project root).

A backend has no clock, and Jensen stops a backend call that runs longer than 30 seconds, so waiting happens in
the host: `wait::until(&Condition::Container { id, state: ContainerWait::Healthy }, timeout_ms)` returns `true`
once the container is running or healthy, a log line matches, or a run reaches a status, and `false` when the
timeout passes first. The host uses 10 seconds (`wait::DEFAULT_TIMEOUT_MS`) when the call names no timeout and
cuts a longer one to 25 seconds (`wait::MAX_TIMEOUT_MS`), which leaves the rest of the 30 seconds for the work
around it. To wait longer, return after each `false` and let the caller ask again.

`run::remove_own()` removes the calling session's own Compose project, with its volumes and built images, and
is refused when the call has no session. It is the one action that needs no confirmation.

To test without Jensen, answer the host natively:

```rust
use jensen_plugin_backend::host_api::{CallContext, Caller, set_test_context, set_test_responder};

set_test_context(&CallContext {
    caller: Caller::Agent,
    plugin_id: "acme.containers".into(),
    project_id: "p1".into(),
    session_id: Some("s1".into()),
    checkout: None,
});
set_test_responder(|method, _params| Ok(serde_json::json!({ "lines": [] })));
```

`host_call` and `context` need a Jensen that provides them. Until the app ships them, a backend that imports
them does not load, so the minimum app version is set when they do.

## What the sandbox allows

The backend is deny by default. It reaches only the files that fall inside the `fs` scopes the user approved
and has no network, clock or process access. Each call has a time limit, a memory limit and an I/O budget.
Jensen shows the user the backend and the tools before they enable the plugin.
