import type { HostConnection } from "./connection.ts";
import { Events } from "./events.ts";

/** Jensen's own settings. Needs `settings` in the manifest. */
export class AppSettings extends Events<{ change: [{ key: string; value: unknown }] }> {
  constructor(private readonly host: HostConnection) {
    super();
    host.subscribe("settings.changed", (change) => this.trigger("change", change));
  }

  async get<T = unknown>(key: string): Promise<T> {
    return (await this.host.call("settings.get", { key })) as T;
  }

  set(key: string, value: unknown): Promise<null> {
    return this.host.call("settings.set", { key, value });
  }
}
