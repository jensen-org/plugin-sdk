# Testing with TestHost

`TestHost` from `@jensen-org/plugin-sdk/testing` stands in for Jensen. It records every call the plugin makes,
answers them, and lets a test play the host's side. It does not enforce permissions, so a test cannot prove a
manifest is complete. Check permissions by reading the code against [permissions](permissions.md).

The tests below run with `bun test`. The same shape works with any runner.

```ts check
import { afterEach, expect, test } from "bun:test";
import { Plugin, start } from "@jensen-org/plugin-sdk";
import { TestHost } from "@jensen-org/plugin-sdk/testing";

class Hello extends Plugin {
  onload() {
    this.addCommand({
      id: "say",
      name: "Say hello",
      callback: async () => {
        await this.saveData({ said: true });
      },
    });
  }
}

let host: TestHost;

afterEach(() => host.close());

test("registers a command and runs it", async () => {
  host = new TestHost();
  await start(Hello, { connection: host.connection });

  expect(host.callsTo("commands.register")[0]?.id).toBe("say");
  await host.request("command.run", { id: "say" });
  expect(host.callsTo("storage.save")).toEqual([{ data: { said: true } }]);
});

test("answers a file read", async () => {
  host = new TestHost();
  host.respondTo("fs.read", ({ path }) => `contents of ${path}`);
  await start(Hello, { connection: host.connection });

  const text = await host.connection.call("fs.read", { path: "docs/a.md" });
  expect(text).toBe("contents of docs/a.md");
});
```

## API

| Member | Use |
|---|---|
| `new TestHost({ respond, surface, asGlobalPort })` | `respond` maps method names to answer functions. `surface` defaults to headless |
| `host.connection` | pass as `start(Plugin, { connection: host.connection })` |
| `host.respondTo(method, fn)` | answer a protocol method. Unanswered methods resolve to `null` |
| `host.callsTo(method)` | the params of each call the plugin made to that method, in order |
| `host.calls` | every call as `{ method, params }` |
| `host.request(callback, params)` | play the host: `command.run`, `command.check`, `pane.render`, `pane.open`, `node.event`, `settings.render`, `settings.change`, `menu.build`, `status.click`, `plugin.unload` and the rest of `CallbackMap` |
| `host.emit(topic, payload)` | fire a host event such as `editor.changed` or `theme.changed` |
| `host.settle()` | wait a few milliseconds for queued messages |
| `host.close()` | always call it, for example in `afterEach` |

Steps that matter:

- `start()` sends `plugin.hello` then `plugin.ready`, and runs `onload()` in between. The default hello
  answer reports plugin id `test.plugin`, app version `0.0.0`, a headless surface and an empty dark theme.
- To test a pane, `await host.request("pane.render", { paneId, instanceId: "i1", state })` and read
  `result.children`. Handlers appear as `{ handler: "<id>" }`. Fire one with
  `host.request("node.event", { handler, payload })`, then render again.
- To test a custom pane, start with `new TestHost({ surface: { kind: "pane", paneId, instanceId, state } })`.
  It mounts into `document`, so run it under a DOM such as happy-dom.
- To run a built bundle for real, `new TestHost({ asGlobalPort: true })`, then `await import("./main.js")`.
  Do not read `host.connection` in that mode, it is not created.
- A responder that throws reaches the plugin as a `HostError` with code `failed`. In the other direction,
  `host.request` rejects with a plain `Error` carrying the callback's message.
- Call `host.settle()` after `host.emit(...)` before asserting on what the plugin did in response.

The repository's own `test/sdk/plugin.test.ts` is a good source of patterns for panes, settings, menus and
events.
