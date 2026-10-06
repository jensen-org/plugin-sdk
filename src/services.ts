import type { HostConnection } from "./connection.ts";

type Result<T> = Promise<T>;

export class Graph {
  constructor(private readonly host: HostConnection) {}

  explainService<T = unknown>(service: string): Result<T> {
    return this.host.call("graph.explainService", { service } as never) as Result<T>;
  }
  dependencies<T = unknown>(target: string, options: { incoming?: boolean } = {}): Result<T> {
    return this.host.call("graph.dependencies", { target, ...options } as never) as Result<T>;
  }
  impact<T = unknown>(target: string): Result<T> {
    return this.host.call("graph.impact", { target } as never) as Result<T>;
  }
  query<T = unknown>(query: string): Result<T> {
    return this.host.call("graph.query", { query } as never) as Result<T>;
  }
}

export class Knowledge {
  constructor(private readonly host: HostConnection) {}

  search<T = unknown>(query: string, options: { k?: number } = {}): Result<T> {
    return this.host.call("knowledge.search", { query, ...options } as never) as Result<T>;
  }
  ingest<T = unknown>(path: string): Result<T> {
    return this.host.call("knowledge.ingest", { path } as never) as Result<T>;
  }
}

export class Git {
  constructor(private readonly host: HostConnection) {}

  history<T = unknown>(options: { path?: string; limit?: number } = {}): Result<T> {
    return this.host.call("git.history", options as never) as Result<T>;
  }
  semanticDiff<T = unknown>(path: string): Result<T> {
    return this.host.call("git.semanticDiff", { path } as never) as Result<T>;
  }
}

export interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export class Net {
  constructor(private readonly host: HostConnection) {}

  /** An https request to a host listed under `network` in the manifest. */
  fetch(
    host: string,
    path: string,
    options: FetchOptions = {},
  ): Promise<{ status: number; body: string }> {
    return this.host.call("net.fetch", { host, path, ...options } as never) as Promise<{
      status: number;
      body: string;
    }>;
  }
}
