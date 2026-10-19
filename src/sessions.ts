import type { HostConnection } from "./connection.ts";
import { Events } from "./events.ts";
import type { EventMap, Session, Worktree } from "./protocol/index.ts";

export type WorktreeRemoval = EventMap["worktrees.removed"];

/** The project's sessions, one per agent working in its own worktree. Needs `sessions` in the manifest. */
export class Sessions extends Events<{
  change: [Session];
  remove: [string];
}> {
  constructor(private readonly host: HostConnection) {
    super();
    host.subscribe("sessions.changed", (event) => this.trigger("change", event.session));
    host.subscribe("sessions.removed", (event) => this.trigger("remove", event.id));
  }

  list(): Promise<Session[]> {
    return this.host.call("sessions.list", {});
  }
}

/** The project's git worktrees and the session that owns each. Needs `sessions` in the manifest. */
export class Worktrees extends Events<{
  change: [Worktree];
  remove: [WorktreeRemoval];
}> {
  constructor(private readonly host: HostConnection) {
    super();
    host.subscribe("worktrees.changed", (event) => this.trigger("change", event.worktree));
    host.subscribe("worktrees.removed", (event) => this.trigger("remove", event));
  }

  list(): Promise<Worktree[]> {
    return this.host.call("worktrees.list", {});
  }
}
