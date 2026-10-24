# Sessions, Run and containers

Read the state of the agents working on the project. Each object needs its own manifest permission, listed in
[permissions](permissions.md). Every call needs a Jensen that carries it, so a plugin that supports older apps
checks `this.app.appVersion` first.

| Object | Methods | Events |
|---|---|---|
| `this.app.sessions` | `list()` returns `Session[]` | `change` with a `Session`, `remove` with the id |
| `this.app.worktrees` | `list()` returns `Worktree[]` | `change` with a `Worktree`, `remove` with `{ path, branch, sessionId? }` |
| `this.app.run` | `services()` returns `RunService[]`, `list()` returns `RunInstance[]` | `change` with a `RunInstance`, `remove` with the id |
| `this.app.containers` | `list()`, `volumes()`, `images()`, `networks()`, `logs(id, options)`, `logsAll(id, options)` | `event` with a `ContainerEvent` |

```ts check
import { Plugin } from "@jensen-org/plugin-sdk";

export default class Watcher extends Plugin {
  async onload() {
    const sessions = await this.app.sessions.list();
    const waiting = sessions.filter((session) => session.status === "needs_input");
    console.log(waiting.length);

    this.registerDisposable(
      this.app.worktrees.on("remove", ({ path, sessionId }) => console.log("gone", path, sessionId)),
    );

    const instances = await this.app.run.list();
    const outside = instances.filter((instance) => instance.origin === "outside");
    console.log(outside.length);

    for (const container of await this.app.containers.list()) {
      if (container.state !== "running") continue;
      for await (const line of this.app.containers.logsAll(container.id, { tail: 50 })) {
        console.log(line.stream, line.text);
      }
    }
  }
}
```

- A `Session.status` is `needs_input`, `blocked`, `working`, `idle` or `finished`. `worktree` and `Worktree.path`
  are relative to the project root.
- `RunInstance.origin` is `jensen` or `outside`. Removal events are how you tell a leftover from a live copy.
- Containers, volumes, images and networks are only those Jensen can tie to the open project. `tiedBy` says why:
  `run`, `compose_project`, `working_dir` or `bind_mount`. `engine` is `docker` or `sandbox`.
- A container never has environment values. Logs can hold sensitive data, so ask for `containers` only when you
  need them.
- `logs` returns one page `{ lines, cursor? }`. `logsAll` follows the cursor until it is absent.

## Session cards

With `sessions`: `setChip(sessionId, { text, tone?, tooltip? })` and `clearChip(sessionId)` mark a card,
`open(sessionId)` focuses its pane, and `sendContext(sessionId, text)` offers text to the agent. Jensen shows the
text and asks the person first, and the call resolves to `{ confirmed }`.

## Actions

Each needs `run: "control"` or `containers: "control"`. Jensen asks the person to confirm every one, and each
resolves to `{ confirmed }`. A declined confirmation is `{ confirmed: false }`, not an exception.

| Call | Notes |
|---|---|
| `run.start(target)`, `run.stop(target)`, `run.restart(target)` | `target` is `{ serviceId, sessionId? }` |
| `containers.stop(id)`, `containers.restart(id)` | only containers tied to the project that Jensen did not start |
| `containers.remove([{ kind, id }])` | refuses running or untied items. The result lists `removed` |

```ts check
import { Plugin } from "@jensen-org/plugin-sdk";

export default class Cleaner extends Plugin {
  onload() {
    this.addCommand({
      id: "clean",
      name: "Clean volumes",
      callback: async () => {
        const volumes = await this.app.containers.volumes();
        const unused = volumes.filter((volume) => volume.inUseBy.length === 0);
        const answer = await this.app.containers.remove(
          unused.map((volume) => ({ kind: "volume" as const, id: volume.name })),
        );
        if (!answer.confirmed) return;
        await this.app.run.restart({ serviceId: "db" });
      },
    });
  }
}
```

Confirmations are held by Jensen's daemon, so they also work when an agent triggers the call through a tool.
If nobody has answered in time the call fails with a message to approve it in Jensen and retry the identical
call. Do not loop on it: tell the user to approve it. An approval covers only the exact text shown.

A Rust backend reaches the same methods with `host_api::call`, reads its caller with `host_api::context()`,
waits in the host with `wait::until`, and removes its caller's own session stack with `run::remove_own()`.
Those host imports need a Jensen that provides them.
