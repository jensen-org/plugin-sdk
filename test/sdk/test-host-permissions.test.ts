import { afterEach, describe, expect, test } from "bun:test";
import { HostError, TestHost } from "../../src/index.ts";

let host: TestHost;

afterEach(() => host?.close());

describe("TestHost permissions", () => {
  test("answers every call when no permissions are declared", async () => {
    host = new TestHost();

    await expect(host.connection.call("workspace.listPanes", {} as never)).resolves.toBeNull();
  });

  test("refuses a method whose capability is not granted", async () => {
    host = new TestHost({ permissions: ["graph"] });

    const denied = await host.connection
      .call("workspace.listPanes", {} as never)
      .catch((cause: unknown) => cause);

    expect(denied).toBeInstanceOf(HostError);
    expect((denied as HostError).code).toBe("permission_denied");
    expect((denied as HostError).capability).toBe("workspace");
  });

  test("lets a granted capability and the capability none through", async () => {
    host = new TestHost({ permissions: ["workspace"] });

    await expect(host.connection.call("workspace.listPanes", {} as never)).resolves.toBeNull();
    await expect(host.connection.call("storage.load", {} as never)).resolves.toBeNull();
  });
});
