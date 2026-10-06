import type { HostConnection } from "./connection.ts";

export class Commands {
  constructor(private readonly host: HostConnection) {}

  /** Runs any command, Jensen's own or another plugin's. Needs `workspace` in the manifest. */
  execute(id: string, args?: unknown): Promise<null> {
    return this.host.call("commands.execute", { id, args });
  }

  list(): Promise<Array<{ id: string; name: string; category?: string }>> {
    return this.host.call("commands.list", {});
  }
}

export class Keymap {
  constructor(private readonly host: HostConnection) {}

  /** The chords a command is bound to now, after the user's own changes. */
  get(commandId: string): Promise<string[]> {
    return this.host.call("keymap.get", { commandId });
  }
}
