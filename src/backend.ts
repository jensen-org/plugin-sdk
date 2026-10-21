import type { HostConnection } from "./connection.ts";

export interface BackendResult<T> {
  result: T;
  /** The project paths the backend wrote or deleted during the call. */
  touched: string[];
}

/**
 * The plugin's own WebAssembly program, the one `entry.backend` names in the manifest. It needs
 * `backend: true` under permissions and reaches only the files the `fs` scopes allow. Jensen refreshes
 * any open tab on a path the backend touched, so an image viewer shows the new pixels at once.
 */
export class Backend {
  constructor(private readonly host: HostConnection) {}

  /** Calls one backend method and returns what it answered. */
  async call<T = unknown>(method: string, input?: unknown): Promise<T> {
    return (await this.run<T>(method, input)).result;
  }

  /** Like `call`, and also reports the paths the backend touched. */
  async run<T = unknown>(method: string, input?: unknown): Promise<BackendResult<T>> {
    const answer = await this.host.call("backend.call", { method, input });
    return answer as BackendResult<T>;
  }
}
