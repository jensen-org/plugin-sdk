import type { Capability, ErrorCode } from "./protocol/index.ts";

export class HostError extends Error {
  readonly code: ErrorCode;
  readonly capability?: Capability;

  constructor(code: ErrorCode, message: string, capability?: Capability) {
    super(message);
    this.name = "HostError";
    this.code = code;
    this.capability = capability;
  }
}

export class NotInJensenError extends Error {
  constructor() {
    super(
      "Jensen's plugin port is not available: plugin code has to run inside Jensen. " +
        "Use `jensen-plugin dev` to load it, or TestHost to run it in a test.",
    );
    this.name = "NotInJensenError";
  }
}
