# Acting on Run and containers

A plugin can start, stop and restart services through Run, and stop, restart or remove containers. Jensen
draws a confirmation for each one, and the plugin cannot skip it. These calls need `run: "control"` or
`containers: "control"` in the manifest, see [permissions](/reference/permissions).

```ts
const { confirmed } = await this.app.run.restart({ serviceId: "db", sessionId: "s1" });
if (!confirmed) return;

await this.app.containers.stop(container.id);
const result = await this.app.containers.remove([{ kind: "volume", id: "pgdata" }]);
```

Confirmations are held by Jensen's daemon, not by a window, so they work the same when an AI agent triggers
the call. Any Jensen client can answer, and the call waits a short time for the person. If nobody has answered
yet the call fails with a message to approve it in Jensen and retry. The request stays pending for a few
minutes, and once approved the identical retry goes through. An approval covers only the exact text the person
was shown.

Every action resolves to `{ confirmed }`. When the person declines, `confirmed` is `false` and nothing throws.
Any other refusal still rejects with a [`HostError`](/reference/errors).

- `run.start`, `run.stop` and `run.restart` take `{ serviceId, sessionId? }` and go through Run, which keeps
  its port band and session ownership.
- `containers.stop(id)` and `containers.restart(id)` only reach containers tied to the project that Jensen did
  not start. There is no start, because only the person's own tooling knows how.
- `containers.remove(items)` takes `{ kind, id }` entries. Jensen lists them with their sizes. It refuses
  anything running, anything not tied to the project, and the primary checkout's volumes unless the person
  ticks them. The answer also lists the `removed` items.

## On session cards

```ts
await this.app.sessions.setChip(session.id, { text: "2 stacks", tone: "warning", tooltip: "db, web" });
await this.app.sessions.clearChip(session.id);
await this.app.sessions.open(session.id);
const { confirmed } = await this.app.sessions.sendContext(session.id, "The db stack on 5432 is down.");
```

`setChip` replaces the chip this plugin put on that card. `open` focuses the session's pane. `sendContext`
shows the text to the person and asks before it reaches the agent, and resolves to `{ confirmed }`. All four
need `sessions` in the manifest and a Jensen that supports them.

A [Rust backend](/guide/backend#reach-jensen-from-the-backend) can remove its caller's own session stack
with `run::remove_own()`, without a prompt.
