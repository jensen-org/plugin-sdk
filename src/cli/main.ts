import { resolve } from "node:path";
import { buildOnce, checkProject, watch } from "./build.ts";
import { create } from "./create.ts";
import { publish } from "./publish.ts";
import { skill } from "./skill.ts";

const USAGE = `jensen-plugin <command>

  create     scaffold a new plugin in a directory
  build      bundle src/main.ts into main.js and check the package.json "jensen" block
  dev        rebuild main.js on every change (add --publish to assemble release/ after each build)
  validate   check the package.json "jensen" block and the README without building
  publish    validate, build and assemble release/, then print the plugin store entry
  skill      install the agent skill: jensen-plugin skill install

options
  --minify     minify main.js (build, publish)
  --no-build   publish the main.js that is already built
  --release    publish: create the GitHub release for the tag and upload release/
  --store-pr   publish: open a pull request adding the entry to jensen-org/plugins-store
  --cwd <d>  run in another directory
  --no-skill   create: do not install the agent skill into the new project

skill install options
  --target <t>  agents, claude or all (default all): .agents/skills and .claude/skills
  --dir <path>  install to this one directory instead
  --force       replace a skill that is already installed
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

async function assemble(cwd: string, args: string[]): Promise<void> {
  await publish({
    cwd,
    minify: flag(args, "minify"),
    build: !flag(args, "no-build"),
    release: flag(args, "release"),
    storePr: flag(args, "store-pr"),
  });
}

function target(args: string[], cwd: string): string {
  const positional = args.find((arg, i) => !arg.startsWith("--") && args[i - 1] !== "--cwd");
  return positional ? resolve(cwd, positional) : cwd;
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
    if (command === "create") return await create(args);
    if (command === "skill") return skill(args, cwd);
    if (command === "publish") {
      await assemble(target(args, cwd), args);
      return 0;
    }
    if (command === "dev") {
      report(cwd);
      const stop = await watch({ cwd, minify: false }, () => {
        process.stdout.write("rebuilt main.js\n");
        if (flag(args, "publish")) {
          publish({ cwd, minify: false, build: false, release: false, storePr: false }).catch(
            (cause) => {
              process.stderr.write(`${cause instanceof Error ? cause.message : String(cause)}\n`);
            },
          );
        }
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
