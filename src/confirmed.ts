import { HostError } from "./errors.ts";

export interface Confirmation {
  confirmed: boolean;
}

/** Turns a refused confirmation into `{ confirmed: false }`, whether the host answers it or rejects it as cancelled. */
export async function confirmation<T extends Confirmation>(
  call: Promise<T>,
): Promise<T | Confirmation> {
  try {
    return await call;
  } catch (cause) {
    if (cause instanceof HostError && cause.code === "cancelled") return { confirmed: false };
    throw cause;
  }
}
