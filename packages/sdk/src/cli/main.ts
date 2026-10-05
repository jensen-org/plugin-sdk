import { spawnSync } from "node:child_process";
import { buildOnce, checkProject, watch } from "./build.ts";

const USAGE = `jensen-plugin <command>

  build      bundle src/main.ts into main.js and check the package.json "jensen" block
  dev        rebuild main.js on every change (add --publish to run \`jensen publish\` after each build)
  validate   check the package.json "jensen" block and the README without building

options
  --minify   minify main.js (build)
  --cwd <d>  run in another directory
`;

function flag(args: string[], name: string): boolean {
  return args.includes(`--${name}`);
}

function value(args: string[], name: string): string | undefined {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : undefined;
}

function report(cwd: string): boolean {
  const problems = checkProject(cwd);
  for (const problem of problems) process.stderr.write(`  ${problem.field}: ${problem.message}\n`);
  return problems.length === 0;
}

function publish(cwd: string): void {
  const result = spawnSync("jensen", ["publish", "."], { cwd, stdio: "inherit" });
  if (result.error) {
    process.stderr.write(`could not run \`jensen publish\`: ${result.error.message}\n`);
  }
}

export async function main(argv: string[]): Promise<number> {
  const [command, ...args] = argv;
  const cwd = value(args, "cwd") ?? process.cwd();
  try {
    if (command === "validate") {
      if (!report(cwd)) return 1;
      process.stdout.write("package.json is ready to publish\n");
      return 0;
    }
    if (command === "build") {
      if (!report(cwd)) return 1;
      await buildOnce({ cwd, minify: flag(args, "minify") });
      return 0;
    }
    if (command === "dev") {
      report(cwd);
      const stop = await watch({ cwd, minify: false }, () => {
        process.stdout.write("rebuilt main.js\n");
        if (flag(args, "publish")) publish(cwd);
      });
      process.on("SIGINT", () => {
        stop().finally(() => process.exit(0));
      });
      await new Promise(() => undefined);
    }
    process.stdout.write(USAGE);
    return command === undefined || command === "help" || command === "--help" ? 0 : 1;
  } catch (cause) {
    process.stderr.write(`${cause instanceof Error ? cause.message : String(cause)}\n`);
    return 1;
  }
}
