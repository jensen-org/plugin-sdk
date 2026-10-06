export interface Disposable {
  dispose(): void;
}

export class DisposableStore implements Disposable {
  private items: Array<() => void> = [];
  private disposed = false;

  add<T extends Disposable>(item: T): T {
    if (this.disposed) item.dispose();
    else this.items.push(() => item.dispose());
    return item;
  }

  addCallback(cleanup: () => void): void {
    if (this.disposed) cleanup();
    else this.items.push(cleanup);
  }

  dispose(): void {
    this.disposed = true;
    const errors: unknown[] = [];
    for (const cleanup of this.items.splice(0).reverse()) {
      try {
        cleanup();
      } catch (cause) {
        errors.push(cause);
      }
    }
    if (errors.length > 0) throw new AggregateError(errors, "cleanup failed");
  }
}

export function toDisposable(cleanup: () => void): Disposable {
  let done = false;
  return {
    dispose() {
      if (done) return;
      done = true;
      cleanup();
    },
  };
}
