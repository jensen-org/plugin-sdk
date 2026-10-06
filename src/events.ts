import { type Disposable, toDisposable } from "./disposable.ts";

export type EventRef = Disposable;

type Listener = (...args: unknown[]) => void;

export class Events<E extends { [name: string]: unknown[] }> {
  private listeners = new Map<keyof E, Set<Listener>>();

  on<K extends keyof E>(name: K, listener: (...args: E[K]) => void): EventRef {
    const wrapped = listener as unknown as Listener;
    const set = this.listeners.get(name) ?? new Set<Listener>();
    set.add(wrapped);
    this.listeners.set(name, set);
    return toDisposable(() => set.delete(wrapped));
  }

  trigger<K extends keyof E>(name: K, ...args: E[K]): void {
    for (const listener of [...(this.listeners.get(name) ?? [])]) listener(...args);
  }

  clear(): void {
    this.listeners.clear();
  }
}
