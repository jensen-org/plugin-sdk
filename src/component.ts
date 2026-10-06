import { type Disposable, DisposableStore } from "./disposable.ts";
import type { EventRef } from "./events.ts";

function surface(work: Promise<void>): void {
  work.catch((cause) => {
    queueMicrotask(() => {
      throw cause;
    });
  });
}

/**
 * Anything with a lifetime. Whatever it registers is undone, newest first, when it unloads, so a
 * plugin never has to remember to clean up after itself.
 */
export class Component {
  private readonly store = new DisposableStore();
  private readonly children = new Set<Component>();
  private loaded = false;

  async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    await this.onload();
    for (const child of this.children) await child.load();
  }

  async unload(): Promise<void> {
    if (!this.loaded) return;
    this.loaded = false;
    for (const child of [...this.children].reverse()) await child.unload();
    this.children.clear();
    const errors: unknown[] = [];
    try {
      this.store.dispose();
    } catch (cause) {
      errors.push(cause);
    }
    try {
      await this.onunload();
    } catch (cause) {
      errors.push(cause);
    }
    if (errors.length > 0) throw new AggregateError(errors, "unload failed");
  }

  onload(): void | Promise<void> {}

  onunload(): void | Promise<void> {}

  addChild<T extends Component>(child: T): T {
    this.children.add(child);
    if (this.loaded) surface(child.load());
    return child;
  }

  removeChild<T extends Component>(child: T): T {
    this.children.delete(child);
    surface(child.unload());
    return child;
  }

  register(cleanup: () => void): void {
    this.store.addCallback(cleanup);
  }

  registerDisposable<T extends Disposable>(item: T): T {
    return this.store.add(item);
  }

  registerEvent(ref: EventRef): void {
    this.store.add(ref);
  }

  registerInterval(id: number): number {
    this.store.addCallback(() => clearInterval(id));
    return id;
  }
}
