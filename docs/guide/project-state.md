# Sessions, Run and containers

Jensen runs several agents on one project at once, each in its own worktree. A plugin can follow that work
through four objects on `app`: `sessions`, `worktrees`, `run` and `containers`. They are read only.

Each one needs its own permission in the manifest, see [permissions](/reference/permissions). These calls
need a Jensen that carries them, so check `app.appVersion` before relying on one.

## Sessions and worktrees

```ts
const sessions = await this.app.sessions.list();
const waiting = sessions.filter((session) => session.status === "needs_input");

const worktrees = await this.app.worktrees.list();
const orphans = worktrees.filter((worktree) => !worktree.isPrimary && !worktree.sessionId);
```

A `Session` has an `id`, a `status` (`needs_input`, `blocked`, `working`, `idle` or `finished`), and when
known a `number`, `title`, `branch`, project relative `worktree` and the `plan` it works on. A `Worktree` has
its `path`, `branch`, `head`, `isPrimary`, `locked`, `merged`, `idleDays` and the `sessionId` that owns it.

Both emit `change` with the new value and `remove`. Removal is the signal that tells a leftover from a live
copy: `sessions.on("remove", (id) => ...)` and `worktrees.on("remove", ({ path, branch, sessionId }) => ...)`.

## Run

```ts
const services = await this.app.run.services();
const instances = await this.app.run.list();
const outside = instances.filter((instance) => instance.origin === "outside");
```

`services()` is what Run detects (`compose`, `package`, `make`, `procfile` or `runner`), with the person's
corrections applied. `list()` is every instance, with its `status`, host `ports`, `sessionId`, `worktree` and
`composeProject`. `origin: "outside"` marks one that was started outside Jensen. `run.on("change", ...)` and
`run.on("remove", (id) => ...)` follow them.

## Containers

```ts
const containers = await this.app.containers.list();
const crashing = containers.filter((container) => container.restartCount > 3);

for await (const line of this.app.containers.logsAll(crashing[0]?.id ?? "", { tail: 200 })) {
  console.log(line.stream, line.text);
}
```

`list()`, `volumes()`, `images()` and `networks()` return only what Jensen can tie to the open project, from
Docker and from its sandbox. Each item says which `engine` holds it and why it belongs, in `tiedBy`
(`run`, `compose_project`, `working_dir` or `bind_mount`). A container never carries its environment values.

`logs(id, { since, until, tail, cursor })` returns one page, `{ lines, cursor? }`. `logsAll(id, options)` is an
async iterator that follows the cursor until there is none. Logs can hold sensitive data, so Jensen says so on
the consent sheet. `containers.on("event", ...)` reports container, volume, image and network events.
