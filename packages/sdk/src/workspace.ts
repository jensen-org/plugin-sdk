import type { Direction, PaneInfo } from "jensen-plugin-protocol";
import type { HostConnection } from "./connection.ts";
import { Events } from "./events.ts";

export class PaneLeaf {
  constructor(
    private readonly host: HostConnection,
    readonly info: PaneInfo,
  ) {}

  get instanceId(): string {
    return this.info.instanceId;
  }
  get paneId(): string | undefined {
    return this.info.paneId;
  }
  get pluginId(): string | undefined {
    return this.info.pluginId;
  }
  get kind(): string {
    return this.info.kind;
  }
  get title(): string {
    return this.info.title;
  }
  get active(): boolean {
    return this.info.active;
  }

  async focus(): Promise<void> {
    await this.host.call("workspace.focusPane", { instanceId: this.instanceId });
  }

  async close(): Promise<void> {
    await this.host.call("workspace.closePane", { instanceId: this.instanceId });
  }

  async setState(state: unknown): Promise<void> {
    await this.host.call("workspace.setPaneState", { instanceId: this.instanceId, state });
  }

  async refresh(): Promise<void> {
    await this.host.call("workspace.refreshPane", { instanceId: this.instanceId });
  }

  async moveNextTo(reference: PaneLeaf, direction: Direction): Promise<void> {
    await this.host.call("workspace.movePane", {
      instanceId: this.instanceId,
      direction,
      referenceInstanceId: reference.instanceId,
    });
  }
}

export interface LayoutChange {
  page: "session" | "code" | "notes";
  panes: PaneLeaf[];
}

export interface OpenPaneOptions {
  state?: unknown;
  direction?: Direction;
  reference?: PaneLeaf;
  focus?: boolean;
}

/**
 * The panes on screen. Jensen has exactly three pages, and a plugin cannot add or change them:
 * what a plugin adds is panes, as many as it likes.
 */
export class Workspace extends Events<{
  "pane-open": [PaneLeaf];
  "pane-close": [string];
  "active-change": [PaneLeaf | null];
  "layout-change": [LayoutChange];
}> {
  constructor(private readonly host: HostConnection) {
    super();
    host.subscribe("workspace.paneOpened", (info) =>
      this.trigger("pane-open", new PaneLeaf(host, info)),
    );
    host.subscribe("workspace.paneClosed", ({ instanceId }) =>
      this.trigger("pane-close", instanceId),
    );
    host.subscribe("workspace.activeChanged", (info) =>
      this.trigger("active-change", info ? new PaneLeaf(host, info) : null),
    );
    host.subscribe("workspace.layoutChanged", ({ page, panes }) =>
      this.trigger("layout-change", { page, panes: panes.map((p) => new PaneLeaf(host, p)) }),
    );
  }

  currentPage(): Promise<"session" | "code" | "notes"> {
    return this.host.call("workspace.currentPage", {});
  }

  async listPanes(): Promise<PaneLeaf[]> {
    const infos = await this.host.call("workspace.listPanes", {});
    return infos.map((info) => new PaneLeaf(this.host, info));
  }

  async getLeavesOfType(paneId: string): Promise<PaneLeaf[]> {
    return (await this.listPanes()).filter((leaf) => leaf.paneId === paneId);
  }

  async openPane(paneId: string, options: OpenPaneOptions = {}): Promise<PaneLeaf> {
    const { instanceId } = await this.host.call("workspace.openPane", {
      paneId,
      state: options.state,
      direction: options.direction,
      referenceInstanceId: options.reference?.instanceId,
      focus: options.focus,
    });
    const leaves = await this.listPanes();
    const leaf = leaves.find((candidate) => candidate.instanceId === instanceId);
    return (
      leaf ?? new PaneLeaf(this.host, { instanceId, kind: "", ref: "", title: "", active: true })
    );
  }
}
