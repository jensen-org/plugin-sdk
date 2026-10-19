import { type Confirmation, confirmation } from "./confirmed.ts";
import type { HostConnection } from "./connection.ts";
import { Events } from "./events.ts";
import type { EventMap, MethodMap, Session, Worktree } from "./protocol/index.ts";

export type WorktreeRemoval = EventMap["worktrees.removed"];
export type SessionChip = Omit<MethodMap["sessions.setChip"]["params"], "sessionId">;

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

  /** Puts a short chip on the session's card, replacing the one this plugin put there before. */
  async setChip(sessionId: string, chip: SessionChip): Promise<void> {
    await this.host.call("sessions.setChip", { sessionId, ...chip });
  }

  async clearChip(sessionId: string): Promise<void> {
    await this.host.call("sessions.clearChip", { sessionId });
  }

  /** Focuses the session's pane. */
  async open(sessionId: string): Promise<void> {
    await this.host.call("sessions.open", { sessionId });
  }

  /** Offers text to a session. Jensen shows it and asks the person before it is delivered. */
  sendContext(sessionId: string, text: string): Promise<Confirmation> {
    return confirmation(this.host.call("sessions.sendContext", { sessionId, text }));
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
