# @jensen-org/plugin-sdk

## 0.3.0

### Minor Changes

- e947e61: Act on Run and containers with `app.run.start`, `stop` and `restart` and `app.containers.stop`, `restart` and `remove`. Each resolves to `{ confirmed }`, and a declined confirmation is reported instead of thrown. The Rust backend crate adds `host_api::call`, `host_api::context` and typed helpers including `run::remove_own` and `wait::until`, with native test hooks, and moves to 0.3.0.
- eb64bb6: The manifest accepts `sessions`, `run` and `containers` permissions and a read only `fsRead` list. File scopes also take file name patterns such as `Dockerfile*` and `.env*`. `jensen-plugin validate` checks them and `jensen-plugin publish` writes them only when a plugin asks, so existing manifests are unchanged.
- `jensen-plugin validate` and `publish` accept semver pre-release versions such as `0.1.2-dev.5` for private registries. `publish --release` marks the GitHub release as a pre-release, and `publish --store-pr` refuses a pre-release version.
- c89ee03: Read the open project with `app.project`, and keep a plugin's data per project with `loadData({ scope: "project" })` and `saveData(data, { scope: "project" })`. The Rust backend crate can list a folder with `fs::list`.
- b5a0e27: Read the agents' work with `app.sessions`, `app.worktrees`, `app.run` and `app.containers`: lists, change and remove events, and paged or streamed container logs with `logsAll`. These need a Jensen that carries the matching capabilities.
- 6d1e7c4: The bundled agent skill now covers the whole plugin: the Rust backend and the `jensen-plugin-backend` crate, agent tools, viewer toolbars, binary files, file type scopes and pre-release publishing. The guides explain when a backend is worth adding and which Jensen version it needs.
- 30d8f1b: `TestHost` takes an opt-in `permissions` list. A call to a method whose capability is not in the list fails with `permission_denied`, so plugin tests can check their consent assumptions. A responder that throws a `HostError` now reaches the plugin with that error's code instead of `failed`.
- b41d894: Toasts take `actions` and `notice.onAction`, panes get `workspace.setBadge`, session cards get `sessions.setChip`, `clearChip`, `open` and `sendContext`, and decorations take an `action` heard through `editor.onDecorationAction`. They need a Jensen that supports each one.

## 0.2.0

### Minor Changes

- 6da8a72: Add a Rust backend for plugins, viewer toolbars and binary files. `app.backend` calls a WebAssembly
  backend, `registerViewerToolbar` adds a toolbar to viewers such as the image page, `app.files.readBytes`
  and `writeBytes` handle any format, and `app.editor.retarget` moves an open tab. `fs` scopes can now be a
  file type (`"*.png"`) or `"."` for every file. `jensen-plugin create --backend` scaffolds a backend, and
  `build` and `publish` handle `entry.backend` and agent `tools`. The `jensen-plugin-backend` crate writes the
  backend.
