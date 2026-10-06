/** Turns the functions a pane puts in its tree into handler ids Jensen can call back. */
export class HandlerScope {
  private readonly handlers = new Map<string, (payload: unknown) => void | Promise<void>>();

  constructor(private readonly nextId: () => string) {}

  serialize<T>(value: T): unknown {
    if (typeof value === "function") {
      const id = this.nextId();
      this.handlers.set(id, value as (payload: unknown) => void | Promise<void>);
      return { handler: id };
    }
    if (Array.isArray(value)) return value.map((item) => this.serialize(item));
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter(([, member]) => member !== undefined)
          .map(([key, member]) => [key, this.serialize(member)]),
      );
    }
    return value;
  }

  get(id: string): ((payload: unknown) => void | Promise<void>) | undefined {
    return this.handlers.get(id);
  }
}

export class HandlerIds {
  private seq = 0;

  next = (): string => `h${++this.seq}`;
}
