# The Rust backend

A plugin can ship a second program next to `main.js`: a **backend**, written in Rust with the
`jensen-plugin-backend` crate and compiled to WebAssembly. Jensen loads it into a sandbox, the plugin's UI
calls it with `this.app.backend`, and AI agents call the same methods as tools. Needs Jensen 0.3.0, and 0.3.2
for `fs::list` and the `host_api` helpers.

## Do you need one?

Most plugins do not. Panes, commands, settings, files and the editor are all in the npm package, and Jensen's
own engine does that work under the plugin's permissions. Add a backend only for:

- **Heavy work**: decoding or re-encoding images, parsing a big file, compressing. Native speed, no webview jank.
- **Agent tools**: a method an AI agent can call while Jensen's window is closed. The plugin's JavaScript only
  runs in the window, so only a backend can answer then.

If neither applies, stay in TypeScript. A backend adds a second language, a second toolchain and a second
thing to test and publish.

## Prerequisites

```bash
rustup target add wasm32-unknown-unknown
```

Rust with edition 2024 support. Nothing else: the crate is fetched by git tag, it is not on crates.io.

## Scaffold

```bash
npx @jensen-org/plugin-sdk create my-plugin --backend
```

```
my-plugin/
  package.json            "jensen" block gains backend, backendBuild, tools, permissions.backend
  src/main.ts             the TypeScript half, with a viewer toolbar that calls the backend
  backend/Cargo.toml      crate-type ["cdylib", "rlib"], depends on jensen-plugin-backend
  backend/src/lib.rs      the Rust half
  backend.wasm            built output, git ignored
```

## Write the backend

```toml
# backend/Cargo.toml
[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
jensen-plugin-backend = { git = "https://github.com/jensen-org/plugin-sdk", tag = "v0.3.0" }
```

Keep `tag` equal to the `@jensen-org/plugin-sdk` version the plugin uses. The tag is the crate's version.

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

- A method takes a `serde_json::Value` and returns `Result<Value, String>`. The `Err` text is shown to the user
  and handed back to an agent that called it.
- `register` runs once per call, so keep state out of statics. Persist with `storage` or files.
- Use `Value` and `json!` from the crate, they are re-exported.
- Clippy denies `unwrap` and `expect` in the crate. Follow that in your code, use `?` and `ok_or`.

## What the backend can reach

Everything is checked against the plugin's permissions, the same as the TypeScript side.

| API | Does | Needs |
|---|---|---|
| `fs::read(path)`, `write(path, &[u8])`, `remove(path)` | any file format, paths relative to the project root, folders created on write | `fs` scope that covers the path, `fsRead` for reads only |
| `fs::list(path)` | `Vec<DirEntry { name, kind, size }>`. Under a type scope such as `*.yaml` it shows folders and files in scope | Jensen 0.3.2 |
| `host_api::call(method, params)` | run any protocol method as the plugin. UI methods are refused | the method's own permission |
| `host_api::context()` | `CallContext { caller, plugin_id, project_id, session_id, checkout }`. `caller` is `Caller::Ui` or `Caller::Agent` | none |
| `run::list()`, `run::remove_own()` | Run instances. `remove_own` deletes the calling session's Compose project, volumes and built images, with no confirmation, and is refused without a session | `run: "read"`, `run: "control"` |
| `containers::list()`, `containers::logs(id, &LogOptions)` | containers tied to the project, one page of logs per call (pass back `cursor`) | `containers` |
| `sessions::list()`, `worktrees::list()` | the open project's sessions and worktrees | `sessions` |
| `git::history(params)` | raw `Value`, the protocol does not type it | `git` |
| `storage::load()`, `load_project()` | the plugin's saved data, `Null` before the first save | none |
| `wait::until(&Condition, timeout_ms)` | `true` when a container is running or healthy, a log line matches or a run reaches a status, `false` on timeout | the capability that reads what it watches |
| `log(LogLevel, text)` | write to Jensen's plugin log | none |

The typed results (`RunInstance`, `Container`, `LogPage`, `Session`, `Worktree`) live in
`jensen_plugin_backend::types`. An answer that does not fit its struct is an error that names the method.

Limits: Jensen stops a backend call after **30 seconds**. A backend has no clock, so waiting happens in the host
with `wait::until`. The host uses 10 seconds when none is given and cuts a longer value to
`wait::MAX_TIMEOUT_MS` (25 seconds). To wait longer, return after each `false` and let the caller ask again.

## Declare it

```json
"jensen": {
  "backend": "backend.wasm",
  "backendBuild": "cargo build --release --target wasm32-unknown-unknown --manifest-path backend/Cargo.toml && cp backend/target/wasm32-unknown-unknown/release/my_plugin.wasm backend.wasm",
  "permissions": { "backend": true, "fs": ["*.png"] },
  "tools": [
    {
      "name": "shrink",
      "description": "Halve a PNG file in place. Use it when an image is too large for the page.",
      "inputSchema": {
        "type": "object",
        "properties": { "path": { "type": "string" } },
        "required": ["path"]
      }
    }
  ]
}
```

- `backend` is a relative path to a built `.wasm` inside the plugin. It requires `permissions.backend: true`,
  and that permission requires `backend`.
- `backendBuild` is a shell command that writes `backend`. `jensen-plugin build` runs it before bundling.
  The wasm file name is the crate name with dashes turned into underscores.
- `tools` are optional, at most 32, each served by the backend method of the **same name**. `name` is lowercase
  letters, digits and `_`, starting with a letter, and unique. `description` is required and is what the agent
  reads to decide when to call the tool, so write it for the agent. `inputSchema` is a JSON schema object.
  `tools` without `backend` is a validation error.
- Agents list them with `list_plugin_tools` and run them with `call_plugin_tool`, under the name
  `<plugin_id>_<tool>`, even when Jensen's window is closed.
- Raise `minAppVersion` to at least `0.3.0` (`0.3.2` if you use `fs::list` or `host_api`).

## Call it from the plugin

```ts check
import { Notice, Plugin } from "@jensen-org/plugin-sdk";

export default class Shrinker extends Plugin {
  onload() {
    this.addCommand({
      id: "shrink",
      name: "Shrink the picture",
      callback: async () => {
        const { result, touched } = await this.app.backend.run<{ before: number }>("shrink", {
          path: "photos/a.png",
        });
        new Notice(`Was ${result.before} bytes, changed ${touched.join(", ")}`);
      },
    });
  }
}
```

`app.backend.call<T>(method, input)` returns only the result. `app.backend.run<T>` also returns `touched`, the
project paths the backend wrote or deleted. Jensen refreshes any open tab on those paths, so an image viewer
shows the new pixels at once. See [viewers-and-binary-files](viewers-and-binary-files.md) for toolbars.

A backend error rejects the call with `HostError`. See [errors](errors.md).

## Test it

Build the crate natively, no wasm needed, and use `cargo test`:

```bash
cargo test --manifest-path backend/Cargo.toml
```

`fs` falls back to the real disk natively. Answer host calls and the caller yourself:

```rust
use jensen_plugin_backend::host_api::{CallContext, Caller, set_test_context, set_test_responder, clear_test_host};

set_test_context(&CallContext {
    caller: Caller::Agent,
    plugin_id: "acme.containers".into(),
    project_id: "p1".into(),
    session_id: Some("s1".into()),
    checkout: None,
});
set_test_responder(|method, _params| match method {
    "run.list" => Ok(serde_json::json!([])),
    other => Err(format!("unexpected {other}")),
});
// ...call your method, assert on the result...
clear_test_host();
```

`Backend::handle(method, bytes)` runs one method the way Jensen does and returns the JSON envelope
(`{"ok": ...}` or `{"error": "..."}`). Test the TypeScript side with `TestHost`, see [testing](testing.md).

## Publish

`jensen-plugin publish` builds, copies `backend.wasm` into `release/` and pins its sha256 in the manifest, the
same as `main.js`, and lists `tools` in the manifest. See [publishing](publishing.md).

## Mistakes

- **No wasm target**: `cargo build` fails with `can't find crate for std`. Run `rustup target add wasm32-unknown-unknown`.
- **Crate tag out of step with the SDK**: the protocol or `host_api` calls differ. Pin both to the same version.
- **`permissions.backend` missing**: calls reject with `permission_denied`, capability `backend`, and `validate` flags it.
- **Path outside the `fs` scopes**: `fs::read` returns Jensen's refusal as the `Err` text.
- **A tool with no method of that name**: the agent gets "the backend has no method '<name>'".
- **Running past 30 seconds**: the call is stopped. Split the work, or return progress and let the caller ask again.
- **Keeping state in a static**: it is gone on the next call.
- **Forgetting `backend.wasm` is a build output**: git ignore it, rebuild with `jensen-plugin build`.
