# How a plugin runs

Jensen loads `main.js` into a hidden sandboxed frame and hands it a `MessagePort`. The SDK's `start()`
connects to it, says hello, constructs your class, runs `onload()` and reports ready.

`jensen-plugin build` writes the entry that calls `start()` for you.

## Two copies, one bundle

The same `main.js` also runs inside a custom pane's own frame. In that copy `onload()` runs again but
**registrations are skipped**, because the headless copy already made them. `app.isSurface` tells you which
copy you are in. Keep `onload()` to registrations and loading data, and do work in a pane's `onOpen()`.

## Cleanup

`register*` methods return a `Disposable` and also hook into the plugin's lifetime. `this.register(fn)`,
`this.registerEvent(ref)` and `this.registerInterval(id)` do the same for your own resources.

## Failing loudly

A call Jensen refuses rejects with `HostError`, carrying a `code` and, for permission errors, the
`capability`. A plugin that throws in `onload()` is reported to the user and not loaded.
