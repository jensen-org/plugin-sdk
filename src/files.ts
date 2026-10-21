import { fromBase64, toBase64 } from "./base64.ts";
import type { HostConnection } from "./connection.ts";
import { type Disposable, toDisposable } from "./disposable.ts";
import { Events } from "./events.ts";
import type { DirEntry, FileStat } from "./protocol/index.ts";

export abstract class FileSystemEntry {
  constructor(readonly path: string) {}

  get name(): string {
    return this.path.split("/").filter(Boolean).at(-1) ?? this.path;
  }
}

export class FileEntry extends FileSystemEntry {
  constructor(
    path: string,
    readonly size: number,
    readonly modifiedMs?: number,
  ) {
    super(path);
  }

  get extension(): string {
    const dot = this.name.lastIndexOf(".");
    return dot > 0 ? this.name.slice(dot + 1) : "";
  }
}

export class FolderEntry extends FileSystemEntry {}

export interface FileChange {
  path: string;
  from?: string;
}

function join(folder: string, name: string): string {
  const base = folder.replace(/\/+$/, "");
  return base ? `${base}/${name}` : name;
}

/**
 * The project's files. Every path is relative to the project root and has to fall inside a scope
 * listed under `fs` in the manifest: a folder such as "docs", a file type such as "*.png", or "." for
 * every file. Jensen enforces the scopes below the plugin and not in it, after the user consents.
 */
export class Files extends Events<{
  create: [FileChange];
  modify: [FileChange];
  delete: [FileChange];
  rename: [FileChange];
}> {
  constructor(private readonly host: HostConnection) {
    super();
    host.subscribe("fs.changed", (event) => {
      this.trigger(event.kind === "delete" ? "delete" : event.kind, {
        path: event.path,
        from: event.from,
      });
    });
  }

  read(path: string): Promise<string> {
    return this.host.call("fs.read", { path });
  }

  write(path: string, contents: string): Promise<null> {
    return this.host.call("fs.write", { path, contents });
  }

  /** Reads a file of any format, such as an image. */
  async readBytes(path: string): Promise<Uint8Array> {
    return fromBase64(await this.host.call("fs.readBytes", { path }));
  }

  /** Writes bytes to a file, creating parent folders. Open tabs on the path refresh. */
  writeBytes(path: string, data: Uint8Array): Promise<null> {
    return this.host.call("fs.writeBytes", { path, data: toBase64(data) });
  }

  async list(path: string): Promise<Array<FileEntry | FolderEntry>> {
    const entries: DirEntry[] = await this.host.call("fs.list", { path });
    return entries.map((entry) =>
      entry.kind === "dir"
        ? new FolderEntry(join(path, entry.name))
        : new FileEntry(join(path, entry.name), entry.size ?? 0),
    );
  }

  async stat(path: string): Promise<FileStat | null> {
    return this.host.call("fs.stat", { path });
  }

  async exists(path: string): Promise<boolean> {
    return (await this.stat(path)) !== null;
  }

  mkdir(path: string): Promise<null> {
    return this.host.call("fs.mkdir", { path });
  }

  delete(path: string, options: { recursive?: boolean } = {}): Promise<null> {
    return this.host.call("fs.delete", { path, recursive: options.recursive });
  }

  rename(from: string, to: string): Promise<null> {
    return this.host.call("fs.rename", { from, to });
  }

  async watch(path: string, listener?: (change: FileChange) => void): Promise<Disposable> {
    const { watchId } = await this.host.call("fs.watch", { path });
    const subscription = listener
      ? this.host.subscribe("fs.changed", (event) => {
          if (event.watchId === watchId) listener({ path: event.path, from: event.from });
        })
      : null;
    return toDisposable(() => {
      subscription?.dispose();
      this.host.call("fs.unwatch", { watchId }).catch(() => undefined);
    });
  }
}
