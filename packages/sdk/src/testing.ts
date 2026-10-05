import {
  API_VERSION,
  type CallbackMap,
  type CallbackName,
  type EventMap,
  type EventName,
  type MethodMap,
  type MethodName,
  type Surface,
} from "jensen-plugin-protocol";
import { HostConnection } from "./connection.ts";

type Responder = (params: never) => unknown | Promise<unknown>;

export interface TestHostOptions {
  /**
   * Hand the plugin's end of the port over as `globalThis.__jensenPort`, the way Jensen does at boot,
   * instead of through `host.connection`. Use it to run a built `main.js` for real.
   */
  asGlobalPort?: boolean;
  surface?: Surface;
  respond?: {
    [K in MethodName]?: (
      params: MethodMap[K]["params"],
    ) => MethodMap[K]["result"] | Promise<MethodMap[K]["result"]>;
  };
}

interface Wire {
  v: number;
  id: number;
  kind: string;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: string; message: string };
}

/**
 * Stands in for Jensen so a plugin can be tested without it. It records every call the plugin makes,
 * answers them, and lets a test play the host's side: run a command, ask a pane to render, fire an event.
 */
export class TestHost {
  readonly connection!: HostConnection;
  readonly calls: Array<{ method: string; params: unknown }> = [];
  private readonly hostPort: MessagePort;
  private readonly responders = new Map<string, Responder>();
  private seq = 0;
  private readonly pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();

  constructor(options: TestHostOptions = {}) {
    const channel = new MessageChannel();
    this.hostPort = channel.port1;
    if (options.asGlobalPort) {
      (globalThis as { __jensenPort?: unknown }).__jensenPort = channel.port2;
    } else {
      this.connection = new HostConnection(channel.port2 as never);
    }
    this.responders.set("plugin.hello", () => ({
      pluginId: "test.plugin",
      appVersion: "0.0.0",
      surface: options.surface ?? { kind: "headless" },
      theme: { id: "test", appearance: "dark", tokens: {} },
    }));
    for (const [method, fn] of Object.entries(options.respond ?? {})) {
      this.responders.set(method, fn as Responder);
    }
    this.hostPort.onmessage = (event) => this.receive(event.data as Wire);
    this.hostPort.start();
  }

  respondTo<K extends MethodName>(
    method: K,
    fn: (
      params: MethodMap[K]["params"],
    ) => MethodMap[K]["result"] | Promise<MethodMap[K]["result"]>,
  ): this {
    this.responders.set(method, fn as Responder);
    return this;
  }

  /** The calls the plugin made to one method, in order. */
  callsTo<K extends MethodName>(method: K): Array<MethodMap[K]["params"]> {
    return this.calls.filter((call) => call.method === method).map((call) => call.params as never);
  }

  /** Plays the host: asks the plugin to do something and waits for its answer. */
  request<K extends CallbackName>(
    method: K,
    params: CallbackMap[K]["params"],
  ): Promise<CallbackMap[K]["result"]> {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve: (value) => resolve(value as never), reject });
      this.hostPort.postMessage({ v: API_VERSION, id, kind: "req", method, params });
    });
  }

  emit<K extends EventName>(topic: K, payload: EventMap[K]): void {
    this.hostPort.postMessage({ v: API_VERSION, kind: "evt", topic, payload });
  }

  /** Waits until the plugin's queued messages have been handled. */
  async settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  close(): void {
    this.connection?.close();
    delete (globalThis as { __jensenPort?: unknown }).__jensenPort;
    this.hostPort.close();
  }

  private receive(message: Wire): void {
    if (message.kind === "res") {
      const entry = this.pending.get(message.id);
      if (!entry) return;
      this.pending.delete(message.id);
      if (message.error) entry.reject(new Error(message.error.message));
      else entry.resolve(message.result);
      return;
    }
    if (message.kind !== "req" || !message.method) return;
    this.calls.push({ method: message.method, params: message.params });
    const responder = this.responders.get(message.method);
    Promise.resolve()
      .then(() => (responder ? responder(message.params as never) : null))
      .then(
        (result) =>
          this.hostPort.postMessage({
            v: API_VERSION,
            id: message.id,
            kind: "res",
            result: result ?? null,
          }),
        (cause: unknown) =>
          this.hostPort.postMessage({
            v: API_VERSION,
            id: message.id,
            kind: "res",
            error: {
              code: "failed",
              message: cause instanceof Error ? cause.message : String(cause),
            },
          }),
      );
  }
}
