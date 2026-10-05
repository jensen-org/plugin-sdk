import { describe, expect, test } from "bun:test";
import {
  API_VERSION,
  ERROR_CODES,
  EVENT_CAPABILITY,
  METHOD_CAPABILITY,
  type MethodName,
} from "../src/index.ts";

describe("the protocol package", () => {
  test("speaks version 1", () => {
    expect(API_VERSION).toBe(1);
  });

  test("names a capability for every method and event", () => {
    for (const name of Object.keys(METHOD_CAPABILITY)) {
      expect(METHOD_CAPABILITY[name as MethodName]).toBeTruthy();
    }
    expect(Object.keys(EVENT_CAPABILITY).length).toBeGreaterThan(5);
  });

  test("lists the error codes a host may answer with", () => {
    expect(ERROR_CODES).toContain("permission_denied");
    expect(ERROR_CODES).toContain("unsupported");
  });

  test("offers no way to add or change a page", () => {
    for (const name of Object.keys(METHOD_CAPABILITY)) {
      const touchesPages = /page|route/i.test(name);
      expect(!touchesPages || name === "workspace.currentPage").toBe(true);
    }
  });

  test("exposes no secret, keychain or credential to a plugin", () => {
    for (const name of Object.keys(METHOD_CAPABILITY)) {
      expect(name).not.toMatch(/secret|keychain|keyring|credential|token|password|vault/i);
    }
  });
});
