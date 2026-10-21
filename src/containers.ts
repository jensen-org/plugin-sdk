import { type Confirmation, confirmation } from "./confirmed.ts";
import type { HostConnection } from "./connection.ts";
import { Events } from "./events.ts";
import type {
  Container,
  ContainerImage,
  ContainerItem,
  ContainerNetwork,
  ContainerVolume,
  EventMap,
  LogLine,
  MethodMap,
} from "./protocol/index.ts";

export type ContainerEvent = EventMap["containers.event"];
export type LogOptions = Omit<MethodMap["containers.logs"]["params"], "id">;
export type LogPage = MethodMap["containers.logs"]["result"];
export type RemoveResult = MethodMap["containers.remove"]["result"];

/**
 * The containers, volumes, images and networks Jensen can tie to the open project, from Docker and from
 * its sandbox. Needs `containers` in the manifest, and `containers: "control"` to stop, restart or remove. Environment values are never part of a container.
 */
export class Containers extends Events<{ event: [ContainerEvent] }> {
  constructor(private readonly host: HostConnection) {
    super();
    host.subscribe("containers.event", (event) => this.trigger("event", event));
  }

  list(): Promise<Container[]> {
    return this.host.call("containers.list", {});
  }

  volumes(): Promise<ContainerVolume[]> {
    return this.host.call("containers.volumes", {});
  }

  images(): Promise<ContainerImage[]> {
    return this.host.call("containers.images", {});
  }

  networks(): Promise<ContainerNetwork[]> {
    return this.host.call("containers.networks", {});
  }

  /** One page of a container's logs. Pass the `cursor` of the last page to read the next one. */
  logs(id: string, options: LogOptions = {}): Promise<LogPage> {
    return this.host.call("containers.logs", { id, ...options });
  }

  /** Every line of a container's logs, following the cursor until the host has no more. */
  async *logsAll(id: string, options: Omit<LogOptions, "cursor"> = {}): AsyncGenerator<LogLine> {
    let cursor: string | undefined;
    do {
      const page = await this.logs(id, { ...options, cursor });
      yield* page.lines;
      cursor = page.cursor;
    } while (cursor);
  }

  /** Stops a container Jensen did not start. Jensen asks the person to confirm. */
  stop(id: string): Promise<Confirmation> {
    return confirmation(this.host.call("containers.stop", { id }));
  }

  restart(id: string): Promise<Confirmation> {
    return confirmation(this.host.call("containers.restart", { id }));
  }

  /**
   * Removes leftovers. Jensen lists them with their sizes and the person confirms. It refuses anything
   * running or not tied to the project, and says which items it removed.
   */
  remove(items: ContainerItem[]): Promise<RemoveResult> {
    return confirmation(this.host.call("containers.remove", { items }));
  }
}
