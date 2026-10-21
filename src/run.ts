import { type Confirmation, confirmation } from "./confirmed.ts";
import type { HostConnection } from "./connection.ts";
import { Events } from "./events.ts";
import type { RunInstance, RunService } from "./protocol/index.ts";

export interface RunTarget {
  serviceId: string;
  sessionId?: string;
}

/** Run's detected services and the instances it started, or that were started outside Jensen. Needs `run` in the manifest, and `run: "control"` to start, stop or restart. */
export class Run extends Events<{
  change: [RunInstance];
  remove: [string];
}> {
  constructor(private readonly host: HostConnection) {
    super();
    host.subscribe("run.changed", (event) => this.trigger("change", event.run));
    host.subscribe("run.removed", (event) => this.trigger("remove", event.id));
  }

  services(): Promise<RunService[]> {
    return this.host.call("run.services", {});
  }

  list(): Promise<RunInstance[]> {
    return this.host.call("run.list", {});
  }

  /** Starts a service through Run. Jensen asks the person to confirm, and the answer says whether they did. */
  start(target: RunTarget): Promise<Confirmation> {
    return confirmation(this.host.call("run.start", target));
  }

  stop(target: RunTarget): Promise<Confirmation> {
    return confirmation(this.host.call("run.stop", target));
  }

  restart(target: RunTarget): Promise<Confirmation> {
    return confirmation(this.host.call("run.restart", target));
  }
}
