import { afterEach, describe, expect, test } from "bun:test";
import { Decorations, HostError, Notice, Plugin, start, TestHost } from "../../src/index.ts";

let host: TestHost;

afterEach(() => host?.close());

async function run(options?: ConstructorParameters<typeof TestHost>[0]) {
  host = new TestHost(options);
  return start(class extends Plugin {} as never, {
    connection: host.connection,
  }) as Promise<Plugin>;
}

describe("notice actions", () => {
  test("sends the actions and tells onAction which button was pressed", async () => {
    await run({ respond: { "ui.notice": () => "n1" } });
    const notice = new Notice("Stack is down", {
      severity: "warn",
      actions: [
        { id: "restart", label: "Restart" },
        { id: "logs", label: "Logs" },
      ],
    });
    const pressed: string[] = [];
    notice.onAction((id) => pressed.push(id));
    await host.settle();

    await host.request("notice.action", { noticeId: "n1", actionId: "restart" });
    await host.request("notice.action", { noticeId: "other", actionId: "logs" });

    expect(host.callsTo("ui.notice")[0]?.actions).toEqual([
      { id: "restart", label: "Restart" },
      { id: "logs", label: "Logs" },
    ]);
    expect(pressed).toEqual(["restart"]);
  });

  test("stops telling a listener that was disposed", async () => {
    await run({ respond: { "ui.notice": () => "n1" } });
    const notice = new Notice("x", { actions: [{ id: "a", label: "A" }] });
    const pressed: string[] = [];
    notice.onAction((id) => pressed.push(id)).dispose();
    await host.settle();

    await host.request("notice.action", { noticeId: "n1", actionId: "a" });

    expect(pressed).toEqual([]);
  });

  test("hears again after the last listener was disposed and a new one was added", async () => {
    await run({ respond: { "ui.notice": () => "n1" } });
    const notice = new Notice("x", { actions: [{ id: "a", label: "A" }] });
    notice.onAction(() => {}).dispose();
    await host.settle();
    const pressed: string[] = [];
    notice.onAction((id) => pressed.push(id));

    await host.request("notice.action", { noticeId: "n1", actionId: "a" });

    expect(pressed).toEqual(["a"]);
  });

  test("keeps the plain call shape and copes with a host that returns no id", async () => {
    await run();
    const notice = new Notice("Saved");
    notice.onAction(() => {});
    await host.settle();

    expect(host.callsTo("ui.notice")).toEqual([{ message: "Saved" }]);
  });

  test("keeps no listener for a notice without actions", async () => {
    await run({ respond: { "ui.notice": () => "n1" } });
    const notice = new Notice("Saved");
    const pressed: string[] = [];
    notice.onAction((id) => pressed.push(id));
    await host.settle();

    await host.request("notice.action", { noticeId: "n1", actionId: "a" });

    expect(pressed).toEqual([]);
  });
});

describe("pane badges", () => {
  test("sets and clears a badge by pane id", async () => {
    const plugin = await run();

    await plugin.app.workspace.setBadge("stacks", { count: 3, tone: "danger" });
    await plugin.app.workspace.setBadge("stacks");

    expect(host.callsTo("workspace.setPaneBadge")).toEqual([
      { paneId: "stacks", count: 3, tone: "danger" },
      { paneId: "stacks" },
    ]);
  });
});

describe("session chips and handoffs", () => {
  test("sets, clears and opens through the protocol methods", async () => {
    const plugin = await run();

    await plugin.app.sessions.setChip("s1", {
      text: "2 stacks",
      tone: "warning",
      tooltip: "db, web",
    });
    await plugin.app.sessions.clearChip("s1");
    await plugin.app.sessions.open("s1");

    expect(host.callsTo("sessions.setChip")).toEqual([
      { sessionId: "s1", text: "2 stacks", tone: "warning", tooltip: "db, web" },
    ]);
    expect(host.callsTo("sessions.clearChip")).toEqual([{ sessionId: "s1" }]);
    expect(host.callsTo("sessions.open")).toEqual([{ sessionId: "s1" }]);
  });

  test("reports whether the person let the context through", async () => {
    const plugin = await run({
      respond: { "sessions.sendContext": ({ text }) => ({ confirmed: text === "ok" }) },
    });

    expect(await plugin.app.sessions.sendContext("s1", "ok")).toEqual({ confirmed: true });
    expect(await plugin.app.sessions.sendContext("s1", "no")).toEqual({ confirmed: false });
  });

  test("reports a cancelled handoff instead of throwing", async () => {
    const plugin = await run({
      respond: {
        "sessions.sendContext": () => {
          throw new HostError("cancelled", "declined");
        },
      },
    });

    expect(await plugin.app.sessions.sendContext("s1", "x")).toEqual({ confirmed: false });
  });
});

describe("decoration actions", () => {
  test("carries an action on every kind of decoration", () => {
    const action = { id: "fix", title: "Fix port" };

    expect(Decorations.mark(0, 4, { action }).action).toEqual(action);
    expect(Decorations.line(1, "warning", { action }).action).toEqual(action);
    expect(Decorations.gutter(1, "!", { action }).action).toEqual(action);
    expect(Decorations.hint(2, "5432", "info", { action }).action).toEqual(action);
    expect(Decorations.line(1, "warning")).toEqual({ kind: "line", line: 1, tone: "warning" });
  });

  test("tells only the listener of that key which action was chosen", async () => {
    const plugin = await run();
    const chosen: unknown[] = [];
    const other: unknown[] = [];
    plugin.app.editor.onDecorationAction("ports", (event) => chosen.push(event));
    plugin.app.editor.onDecorationAction("other", (event) => other.push(event));

    await host.request("decoration.action", {
      key: "ports",
      path: "compose.yaml",
      actionId: "fix",
    });

    expect(chosen).toEqual([{ path: "compose.yaml", actionId: "fix" }]);
    expect(other).toEqual([]);
  });
});
