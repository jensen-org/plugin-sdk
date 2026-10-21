import { cpSync, existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SKILL_NAME = "jensen-plugin-sdk";

export type SkillTarget = "agents" | "claude" | "all";

const TARGET_ROOTS: Record<Exclude<SkillTarget, "all">, string> = {
  agents: ".agents",
  claude: ".claude",
};

export interface InstallOptions {
  root: string;
  target?: SkillTarget;
  dir?: string;
  force?: boolean;
}

export interface Installed {
  destination: string;
  files: string[];
}

export function bundledSkillDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "../../skills", SKILL_NAME);
}

export function isTarget(value: string): value is SkillTarget {
  return value === "agents" || value === "claude" || value === "all";
}

export function destinationsFor(options: InstallOptions): string[] {
  if (options.dir !== undefined) return [resolve(options.root, options.dir)];
  const target = options.target ?? "all";
  const names = target === "all" ? (["agents", "claude"] as const) : ([target] as const);
  return names.map((name) => join(options.root, TARGET_ROOTS[name], "skills", SKILL_NAME));
}

export function listFiles(dir: string, base = dir): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const path = join(dir, entry.name);
      return entry.isDirectory() ? listFiles(path, base) : [relative(base, path)];
    });
}

function occupied(destination: string): boolean {
  return (
    existsSync(destination) &&
    (!statSync(destination).isDirectory() || readdirSync(destination).length > 0)
  );
}

export function installSkill(options: InstallOptions): Installed[] {
  const source = bundledSkillDir();
  if (!existsSync(join(source, "SKILL.md"))) {
    throw new Error(`the bundled skill is missing at ${source}`);
  }
  const destinations = destinationsFor(options);
  for (const destination of destinations) {
    if (!occupied(destination)) continue;
    if (!options.force) {
      throw new Error(`${destination} already exists: pass --force to replace it`);
    }
    if (!existsSync(join(destination, "SKILL.md"))) {
      throw new Error(`${destination} is not a skill directory: refusing to replace it`);
    }
  }
  return destinations.map((destination) => {
    rmSync(destination, { recursive: true, force: true });
    cpSync(source, destination, { recursive: true });
    return { destination, files: listFiles(destination) };
  });
}

export function describeInstall(installed: Installed[], root: string): string {
  return installed
    .map(({ destination, files }) => {
      const shown = relative(root, destination) || ".";
      return `  ${shown}\n${files.map((file) => `    ${file}`).join("\n")}`;
    })
    .join("\n");
}

function value(args: string[], name: string): string | undefined {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : undefined;
}

const SKILL_USAGE = `jensen-plugin skill install [--target <agents|claude|all>] [--dir <path>] [--force]

  Installs the jensen-plugin-sdk agent skill into this project.
  By default it goes to .agents/skills/jensen-plugin-sdk and .claude/skills/jensen-plugin-sdk.

  --target <t>  agents, claude or all (default all)
  --dir <path>  install to this one directory instead, and ignore --target
  --force       replace a skill that is already installed
`;

export function skill(argv: string[], cwd: string): number {
  const [action, ...args] = argv;
  if (action !== "install") {
    process.stdout.write(SKILL_USAGE);
    return action === undefined || action === "help" || action === "--help" ? 0 : 1;
  }
  const target = value(args, "target") ?? "all";
  if (!isTarget(target)) {
    process.stderr.write(`--target must be agents, claude or all, not ${target}\n`);
    return 1;
  }
  const dir = value(args, "dir");
  if (args.includes("--dir") && (dir === undefined || dir.startsWith("--"))) {
    process.stderr.write("--dir needs a path\n");
    return 1;
  }
  const installed = installSkill({
    root: cwd,
    target,
    dir,
    force: args.includes("--force"),
  });
  process.stdout.write(`Installed the ${SKILL_NAME} skill\n${describeInstall(installed, cwd)}\n`);
  return 0;
}
