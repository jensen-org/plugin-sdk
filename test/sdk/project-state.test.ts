import { afterEach, describe, expect, test } from "bun:test";
import {
  type Container,
  type LogLine,
  Plugin,
  type RunInstance,
  type Session,
  start,
  TestHost,
  type Worktree,
} from "../../src/index.ts";

let host: TestHost;

afterEach(() => host?.close());

async function run(options?: ConstructorParameters<typeof TestHost>[0]) {
  host = new TestHost(options);
  return start(class extends Plugin {} as never, {
    connection: host.connection,
  }) as Promise<Plugin>;
}

const session: Session = { id: "s1", status: "working", branch: "feat/a", worktree: ".jensen/a" };
const worktree: Worktree = {
  path: ".jensen/a",
  branch: "feat/a",
  head: "abc",
  isPrimary: false,
  locked: false,
  merged: false,
  idleDays: 0,
  sessionId: "s1",
};
const instance: RunInstance = {
  id: "r1",
  serviceId: "db",
  sessionId: "s1",
  status: "running",
  ports: [{ declared: 5432, host: 41000 }],
  startedAt: "2026-10-19T10:00:00Z",
  origin: "jensen",
};

describe("sessions and worktrees", () => {
  test("lists them through the protocol methods", async () => {
    const plugin = await run({
      respond: { "sessions.list": () => [session], "worktrees.list": () => [worktree] },
    });

    expect(await plugin.app.sessions.list()).toEqual([session]);
    expect(await plugin.app.worktrees.list()).toEqual([worktree]);
  });

  test("tells listeners when one changes or goes away", async () => {
    const plugin = await run();
    const seen: unknown[] = [];
    plugin.app.sessions.on("change", (value) => seen.push(["session change", value.id]));
    plugin.app.sessions.on("remove", (id) => seen.push(["session remove", id]));
    plugin.app.worktrees.on("change", (value) => seen.push(["worktree change", value.path]));
    plugin.app.worktrees.on("remove", (value) => seen.push(["worktree remove", value]));

    host.emit("sessions.changed", { session });
    host.emit("sessions.removed", { id: "s1" });
    host.emit("worktrees.changed", { worktree });
    host.emit("worktrees.removed", { path: ".jensen/a", branch: "feat/a", sessionId: "s1" });
    await host.settle();

    expect(seen).toEqual([
      ["session change", "s1"],
      ["session remove", "s1"],
      ["worktree change", ".jensen/a"],
      ["worktree remove", { path: ".jensen/a", branch: "feat/a", sessionId: "s1" }],
    ]);
  });
});

describe("Run", () => {
  test("lists services and instances", async () => {
    const plugin = await run({
      respond: {
        "run.services": () => [
          { id: "db", name: "db", kind: "compose", source: { file: "compose.yaml" } },
        ],
        "run.list": () => [instance],
      },
    });

    expect((await plugin.app.run.services()).map((service) => service.id)).toEqual(["db"]);
    expect(await plugin.app.run.list()).toEqual([instance]);
  });

  test("tells listeners when an instance changes or goes away", async () => {
    const plugin = await run();
    const seen: unknown[] = [];
    plugin.app.run.on("change", (value) => seen.push(["change", value.id]));
    plugin.app.run.on("remove", (id) => seen.push(["remove", id]));

    host.emit("run.changed", { run: instance });
    host.emit("run.removed", { id: "r1" });
    await host.settle();

    expect(seen).toEqual([
      ["change", "r1"],
      ["remove", "r1"],
    ]);
  });
});

describe("containers", () => {
  const container: Container = {
    id: "c1",
    name: "db",
    engine: "docker",
    tiedBy: "run",
    image: "postgres",
    state: "running",
    oomKilled: false,
    restartCount: 0,
    ports: [],
    mounts: [],
    labels: {},
    createdAt: "2026-10-19T10:00:00Z",
  };

  test("lists containers, volumes, images and networks", async () => {
    const plugin = await run({
      respond: {
        "containers.list": () => [container],
        "containers.volumes": () => [
          { name: "data", engine: "docker", tiedBy: "run", inUseBy: ["c1"] },
        ],
        "containers.images": () => [{ id: "i1", engine: "docker", tiedBy: "run", inUseBy: [] }],
        "containers.networks": () => [
          { name: "net", engine: "sandbox", tiedBy: "bind_mount", inUseBy: [] },
        ],
      },
    });

    expect(await plugin.app.containers.list()).toEqual([container]);
    expect((await plugin.app.containers.volumes())[0]?.name).toBe("data");
    expect((await plugin.app.containers.images())[0]?.id).toBe("i1");
    expect((await plugin.app.containers.networks())[0]?.engine).toBe("sandbox");
  });

  test("sends the log options with the container id", async () => {
    const plugin = await run({ respond: { "containers.logs": () => ({ lines: [] }) } });

    await plugin.app.containers.logs("c1", { tail: 50, since: "2026-10-19T00:00:00Z" });

    expect(host.callsTo("containers.logs")).toEqual([
      { id: "c1", tail: 50, since: "2026-10-19T00:00:00Z" },
    ]);
  });

  test("follows the cursor through every page and stops when there is none", async () => {
    const line = (text: string): LogLine => ({ at: "t", stream: "stdout", text });
    const pages: Record<string, { lines: LogLine[]; cursor?: string }> = {
      start: { lines: [line("a"), line("b")], cursor: "p2" },
      p2: { lines: [line("c")], cursor: "p3" },
      p3: { lines: [line("d")] },
    };
    const plugin = await run({
      respond: { "containers.logs": ({ cursor }) => pages[cursor ?? "start"] ?? { lines: [] } },
    });

    const texts: string[] = [];
    for await (const entry of plugin.app.containers.logsAll("c1", { tail: 10 })) {
      texts.push(entry.text);
    }

    expect(texts).toEqual(["a", "b", "c", "d"]);
    expect(host.callsTo("containers.logs").map((call) => call.cursor)).toEqual([
      undefined,
      "p2",
      "p3",
    ]);
  });

  test("tells listeners about container events", async () => {
    const plugin = await run();
    const seen: string[] = [];
    plugin.app.containers.on("event", (event) => seen.push(`${event.kind}:${event.action}`));

    host.emit("containers.event", { id: "c1", kind: "container", action: "die", at: "t" });
    await host.settle();

    expect(seen).toEqual(["container:die"]);
  });
});
