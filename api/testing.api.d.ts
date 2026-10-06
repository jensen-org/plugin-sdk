// testing.d.ts
import { HostConnection } from "./connection.ts";
import { type CallbackMap, type CallbackName, type EventMap, type EventName, type MethodMap, type MethodName, type Surface } from "./protocol/index.ts";
export interface TestHostOptions {
    /**
     * Hand the plugin's end of the port over as `globalThis.__jensenPort`, the way Jensen does at boot,
     * instead of through `host.connection`. Use it to run a built `main.js` for real.
     */
    asGlobalPort?: boolean;
    surface?: Surface;
    respond?: {
        [K in MethodName]?: (params: MethodMap[K]["params"]) => MethodMap[K]["result"] | Promise<MethodMap[K]["result"]>;
    };
}
/**
 * Stands in for Jensen so a plugin can be tested without it. It records every call the plugin makes,
 * answers them, and lets a test play the host's side: run a command, ask a pane to render, fire an event.
 */
export declare class TestHost {
    readonly connection: HostConnection;
    readonly calls: Array<{
        method: string;
        params: unknown;
    }>;
    private readonly hostPort;
    private readonly responders;
    private seq;
    private readonly pending;
    constructor(options?: TestHostOptions);
    respondTo<K extends MethodName>(method: K, fn: (params: MethodMap[K]["params"]) => MethodMap[K]["result"] | Promise<MethodMap[K]["result"]>): this;
    /** The calls the plugin made to one method, in order. */
    callsTo<K extends MethodName>(method: K): Array<MethodMap[K]["params"]>;
    /** Plays the host: asks the plugin to do something and waits for its answer. */
    request<K extends CallbackName>(method: K, params: CallbackMap[K]["params"]): Promise<CallbackMap[K]["result"]>;
    emit<K extends EventName>(topic: K, payload: EventMap[K]): void;
    /** Waits until the plugin's queued messages have been handled. */
    settle(): Promise<void>;
    close(): void;
    private receive;
}
