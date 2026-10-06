import { type Disposable, toDisposable } from "./disposable.ts";
import { HostError, NotInJensenError } from "./errors.ts";
import {
  API_VERSION,
  type CallbackMap,
  type CallbackName,
  ERROR_CODES,
  type ErrorCode,
  type EventMap,
  type EventName,
  type MethodMap,
  type MethodName,
} from "./protocol/index.ts";

export type CallbackHandlers = {
  [K in CallbackName]?: (
    params: CallbackMap[K]["params"],
  ) => CallbackMap[K]["result"] | Promise<CallbackMap[K]["result"]>;
};

interface Incoming {
  v?: number;
  kind?: string;
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code?: string; message?: string; capability?: string };
  topic?: string;
  payload?: unknown;
}

const isErrorCode = (code: unknown): code is ErrorCode =>
  typeof code === "string" && (ERROR_CODES as readonly string[]).includes(code);

export interface HostPort {
  postMessage(message: unknown): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  start?(): void;
  close?(): void;
}

/** The plugin's end of the port Jensen hands it at boot. Everything the SDK does goes through here. */
export class HostConnection {
  private seq = 0;
  private readonly pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  private readonly handlers: CallbackHandlers = {};
  private readonly subscribers = new Map<EventName, Set<(payload: never) => void>>();
  private closed = false;

  constructor(private readonly port: HostPort) {
    port.onmessage = (event) => this.receive(event.data);
    port.start?.();
  }

  static fromGlobal(): HostConnection {
    const port = (globalThis as { __jensenPort?: HostPort }).__jensenPort;
    if (!port) throw new NotInJensenError();
    return new HostConnection(port);
  }

  call<K extends MethodName>(
    method: K,
    params: MethodMap[K]["params"],
  ): Promise<MethodMap[K]["result"]> {
    if (this.closed) return Promise.reject(new Error("the connection to Jensen is closed"));
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve: (value) => resolve(value as never), reject });
      this.port.postMessage({ v: API_VERSION, id, kind: "req", method, params });
    });
  }

  handle<K extends CallbackName>(name: K, handler: NonNullable<CallbackHandlers[K]>): void {
    (this.handlers as Record<string, unknown>)[name] = handler;
  }

  subscribe<K extends EventName>(topic: K, listener: (payload: EventMap[K]) => void): Disposable {
    const set = this.subscribers.get(topic) ?? new Set();
    set.add(listener as (payload: never) => void);
    this.subscribers.set(topic, set);
    return toDisposable(() => set.delete(listener as (payload: never) => void));
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.port.onmessage = null;
    this.port.close?.();
    for (const entry of this.pending.values()) entry.reject(new Error("the connection closed"));
    this.pending.clear();
  }

  private receive(data: unknown): void {
    if (!data || typeof data !== "object") return;
    const message = data as Incoming;
    if (message.v !== API_VERSION) return;
    if (message.kind === "res" && typeof message.id === "number") {
      const entry = this.pending.get(message.id);
      if (!entry) return;
      this.pending.delete(message.id);
      if (message.error) {
        const code = isErrorCode(message.error.code) ? message.error.code : "failed";
        entry.reject(
          new HostError(
            code,
            message.error.message ?? "the host refused the call",
            message.error.capability as HostError["capability"],
          ),
        );
      } else {
        entry.resolve(message.result ?? null);
      }
      return;
    }
    if (message.kind === "evt" && typeof message.topic === "string") {
      for (const listener of [...(this.subscribers.get(message.topic as EventName) ?? [])]) {
        listener(message.payload as never);
      }
      return;
    }
    if (message.kind === "req" && typeof message.id === "number") {
      this.answer(message.id, String(message.method), message.params);
    }
  }

  private answer(id: number, method: string, params: unknown): void {
    const handler = (this.handlers as Record<string, ((p: unknown) => unknown) | undefined>)[
      method
    ];
    if (!handler) {
      this.reply(id, undefined, {
        code: "unsupported",
        message: `this plugin does not handle '${method}'`,
      });
      return;
    }
    Promise.resolve()
      .then(() => handler(params))
      .then(
        (result) => this.reply(id, result ?? null),
        (cause: unknown) =>
          this.reply(id, undefined, {
            code: cause instanceof HostError ? cause.code : "failed",
            message: cause instanceof Error ? cause.message : String(cause),
          }),
      );
  }

  private reply(id: number, result?: unknown, error?: { code: string; message: string }): void {
    if (this.closed) return;
    this.port.postMessage(
      error
        ? { v: API_VERSION, id, kind: "res", error }
        : { v: API_VERSION, id, kind: "res", result },
    );
  }
}
