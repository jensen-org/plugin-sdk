---
"@jensen-org/plugin-sdk": minor
---

Add a Rust backend for plugins, viewer toolbars and binary files. `app.backend` calls a WebAssembly
backend, `registerViewerToolbar` adds a toolbar to viewers such as the image page, `app.files.readBytes`
and `writeBytes` handle any format, and `app.editor.retarget` moves an open tab. `fs` scopes can now be a
file type (`"*.png"`) or `"."` for every file. `jensen-plugin create --backend` scaffolds a backend, and
`build` and `publish` handle `entry.backend` and agent `tools`. The `jensen-plugin-backend` crate writes the
backend.
