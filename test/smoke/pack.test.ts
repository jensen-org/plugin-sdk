import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");

function run(command: string, args: string[], cwd: string): string {
  const result = Bun.spawnSync([command, ...args], { cwd, stderr: "pipe" });
  if (result.exitCode !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed: ${result.stderr.toString()}`);
  }
  return result.stdout.toString();
}

test("the packed tarball exposes every entry point", () => {
  const work = mkdtempSync(join(tmpdir(), "jensen-pack-"));
  try {
    const packed = run("npm", ["pack", "--json", "--pack-destination", work], root);
    const tarball = join(work, JSON.parse(packed)[0].filename);
    const consumer = join(work, "consumer");
    run("mkdir", ["-p", consumer], work);
    writeFileSync(join(consumer, "package.json"), '{"name":"consumer","type":"module"}\n');
    run("npm", ["install", "--no-audit", "--no-fund", tarball], consumer);
    writeFileSync(
      join(consumer, "check.mjs"),
      [
        'const sdk = await import("@jensen-org/plugin-sdk");',
        'const protocol = await import("@jensen-org/plugin-sdk/protocol");',
        'const ui = await import("@jensen-org/plugin-sdk/ui");',
        'const testing = await import("@jensen-org/plugin-sdk/testing");',
        "console.log(JSON.stringify([typeof sdk.Plugin, protocol.API_VERSION, typeof ui.Stack, typeof testing.TestHost]));",
      ].join("\n"),
    );
    const out = JSON.parse(run("node", ["check.mjs"], consumer));
    expect(out).toEqual(["function", 1, "function", "function"]);
    run("node", [join(consumer, "node_modules/.bin/jensen-plugin"), "--help"], consumer);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}, 120_000);
