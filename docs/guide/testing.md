# Testing

`TestHost` stands in for Jensen. It records every call your plugin makes, answers them, and lets a test
play the host.

```ts
import { start } from "@jensen-org/plugin-sdk";
import { TestHost } from "@jensen-org/plugin-sdk/testing";

test("registers a command", async () => {
  const host = new TestHost();
  await start(MyPlugin, { connection: host.connection });

  expect(host.callsTo("commands.register")[0]?.id).toBe("say");
  await host.request("command.run", { id: "say" });
  host.close();
});
```

`host.respondTo("fs.read", () => "contents")` answers a call, `host.emit("theme.changed", ...)` fires an
event, and `new TestHost({ permissions: ["workspace"] })` makes a call to any other capability fail with
`permission_denied`, so a test can check what your manifest needs. `new TestHost({ asGlobalPort: true })` lets you import a
built `main.js` and run it for real.
