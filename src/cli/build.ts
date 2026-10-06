import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { build, context } from "esbuild";
import { type PackageJson, type Problem, validatePackage } from "./validate.ts";

export interface BuildOptions {
  cwd: string;
  minify: boolean;
}

export function readPackage(cwd: string): PackageJson {
  const file = resolve(cwd, "package.json");
  if (!existsSync(file)) throw new Error(`no package.json in ${cwd}`);
  return JSON.parse(readFileSync(file, "utf8")) as PackageJson;
}

export function entryFor(cwd: string, pkg: PackageJson): string {
  const declared = pkg.jensen?.entry;
  const candidates =
    typeof declared === "string" ? [declared] : ["src/main.ts", "src/main.tsx", "src/main.js"];
  const found = candidates.map((c) => resolve(cwd, c)).find((c) => existsSync(c));
  if (!found) {
    throw new Error(
      `no entry file: looked for ${candidates.join(", ")}. Set "jensen.entry" in package.json.`,
    );
  }
  return found;
}

/** The module esbuild bundles: the plugin's class, handed to the SDK to run. */
export function wrapper(entry: string): string {
  return `import Plugin from ${JSON.stringify(entry)};\nimport { start } from "@jensen-org/plugin-sdk";\nstart(Plugin);\n`;
}

function settings(options: BuildOptions, entry: string) {
  return {
    stdin: {
      contents: wrapper(entry),
      resolveDir: options.cwd,
      sourcefile: "jensen-entry.ts",
      loader: "ts" as const,
    },
    bundle: true,
    format: "esm" as const,
    target: "es2022",
    platform: "browser" as const,
    outfile: resolve(options.cwd, "main.js"),
    minify: options.minify,
    legalComments: "none" as const,
    logLevel: "info" as const,
  };
}

export function checkProject(cwd: string): Problem[] {
  const problems = validatePackage(readPackage(cwd));
  if (!existsSync(resolve(cwd, "README.md"))) {
    problems.push({
      field: "README.md",
      message:
        "is missing: every published plugin documents what it does and why it asks for its permissions",
    });
  }
  return problems;
}

export async function buildOnce(options: BuildOptions): Promise<void> {
  const entry = entryFor(options.cwd, readPackage(options.cwd));
  await build(settings(options, entry));
}

export async function watch(
  options: BuildOptions,
  onRebuild: () => void,
): Promise<() => Promise<void>> {
  const entry = entryFor(options.cwd, readPackage(options.cwd));
  const ctx = await context({
    ...settings(options, entry),
    plugins: [
      {
        name: "notify",
        setup(b) {
          b.onEnd((result) => {
            if (result.errors.length === 0) onRebuild();
          });
        },
      },
    ],
  });
  await ctx.watch();
  return () => ctx.dispose();
}
