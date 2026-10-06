import type { App } from "./app.ts";

let current: App | null = null;

export function setCurrentApp(app: App | null): void {
  current = app;
}

export function currentApp(): App {
  if (!current) {
    throw new Error("no plugin is running: construct this inside a plugin, after start()");
  }
  return current;
}
