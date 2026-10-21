import type { HostConnection } from "./connection.ts";
import { Events } from "./events.ts";

export interface ViewerFile {
  /** The path of the file being shown, relative to the project root. */
  path: string;
  /** The kind of viewer showing it, such as "image". */
  kind: string;
}

export interface ViewerMatch {
  /** Viewer kinds to add the toolbar to, such as "image". */
  kinds?: string[];
  /** File extensions to add the toolbar to, without the dot. */
  extensions?: string[];
}

/** The file viewers Jensen draws, such as the image page, and which file each is showing. */
export class Viewer extends Events<{ change: [ViewerFile | null] }> {
  private current: ViewerFile | null = null;

  constructor(private readonly host: HostConnection) {
    super();
    host.subscribe("viewer.activeChanged", (payload) => {
      this.current = payload;
      this.trigger("change", payload);
    });
  }

  /** The file the focused viewer is showing, or null when none is. */
  get active(): ViewerFile | null {
    return this.current;
  }

  /** Asks Jensen to draw a toolbar again, after the plugin's own state changed. */
  refresh(toolbarId: string): Promise<null> {
    return this.host.call("viewer.refreshToolbar", { id: toolbarId });
  }
}
