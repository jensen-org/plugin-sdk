import type { HostConnection } from "./connection.ts";
import { Events } from "./events.ts";
import type {
  Container,
  ContainerImage,
  ContainerNetwork,
  ContainerVolume,
  EventMap,
  LogLine,
  MethodMap,
} from "./protocol/index.ts";

export type ContainerEvent = EventMap["containers.event"];
export type LogOptions = Omit<MethodMap["containers.logs"]["params"], "id">;
export type LogPage = MethodMap["containers.logs"]["result"];

/**
 * The containers, volumes, images and networks Jensen can tie to the open project, from Docker and from
 * its sandbox. Needs `containers` in the manifest. Environment values are never part of a container.
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
}
