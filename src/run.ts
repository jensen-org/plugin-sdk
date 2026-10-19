import type { HostConnection } from "./connection.ts";
import { Events } from "./events.ts";
import type { RunInstance, RunService } from "./protocol/index.ts";

/** Run's detected services and the instances it started, or that were started outside Jensen. Needs `run` in the manifest. */
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
}
