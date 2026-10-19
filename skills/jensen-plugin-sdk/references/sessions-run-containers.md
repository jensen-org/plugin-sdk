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
