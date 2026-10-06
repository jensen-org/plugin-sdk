import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { buildOnce, checkProject, readPackage } from "./build.ts";
import type { PackageJson, Problem } from "./validate.ts";

export const RELEASE_DIR = "release";
export const MANIFEST_ASSET = "manifest.json";
export const MAIN_ASSET = "main.js";
export const README_ASSET = "README.md";
export const API_VERSION = 1;
export const STORE_REPO = "jensen-org/plugins-store";

export interface StoreEntry {
  id: string;
  name: string;
  author: string;
  description: string;
  category: string;
  version: string;
  min_app_version: string;
  repo: string;
  tag?: string;
  sha256: string;
}

export interface Published {
  manifestJson: string;
  entry: StoreEntry;
  releaseDir: string;
  assets: string[];
}

const ENTRY_RULES: Record<Exclude<keyof StoreEntry, "tag">, { pattern?: RegExp; hint: string }> = {
  id: {
    pattern: /^[a-z0-9-]+(\.[a-z0-9-]+)+$/,
    hint: "must be a reverse-dns id such as dev.me.hello",
  },
  name: { hint: "is required" },
  author: { hint: "is required" },
  description: { hint: "is required" },
  category: { pattern: /^[a-z0-9-]+$/, hint: 'is required: set "jensen.category", such as "lint"' },
  version: { pattern: /^\d+\.\d+\.\d+$/, hint: "must be major.minor.patch" },
  min_app_version: { pattern: /^\d+\.\d+\.\d+$/, hint: "must be major.minor.patch" },
  repo: {
    pattern: /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/,
    hint: 'is required: set "jensen.repo" to the GitHub owner/name hosting the release',
  },
  sha256: { pattern: /^[a-fA-F0-9]{64}$/, hint: "must be a sha256 hex digest" },
};

export function validateEntry(entry: StoreEntry): Problem[] {
  const problems: Problem[] = [];
  for (const [field, rule] of Object.entries(ENTRY_RULES)) {
    const value = entry[field as keyof StoreEntry];
    const ok = typeof value === "string" && value.length > 0 && (rule.pattern?.test(value) ?? true);
    if (!ok) problems.push({ field: `entry.${field}`, message: rule.hint });
  }
  if (entry.tag !== undefined && !/^[^/\s]+$/.test(entry.tag)) {
    problems.push({ field: "entry.tag", message: "must not contain slashes or whitespace" });
  }
  return problems;
}

export function sha256Hex(bytes: string | Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function slug(name: string): string {
  const out = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return out === "" ? "plugin" : out;
}

function authorName(author: unknown): string {
  if (typeof author === "string") return author;
  if (author && typeof author === "object") {
    const name = (author as { name?: unknown }).name;
    return typeof name === "string" ? name : "";
  }
  return "";
}

function permissionsOf(block: Record<string, unknown>) {
  const given = (block.permissions ?? {}) as Record<string, unknown>;
  return {
    graph: given.graph === true,
    knowledge: given.knowledge === true,
    git: given.git === true,
    workspace: given.workspace === true,
    theme: given.theme === true,
    settings: given.settings === true,
    editor: typeof given.editor === "string" ? given.editor : "none",
    fs: Array.isArray(given.fs) ? given.fs : [],
    network: Array.isArray(given.network) ? given.network : [],
  };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function assemble(cwd: string, pkg: PackageJson): Published {
  const block = (pkg.jensen ?? {}) as Record<string, unknown>;
  const mainSrc = resolve(cwd, MAIN_ASSET);
  const readmeSrc = resolve(cwd, README_ASSET);
  if (!existsSync(mainSrc)) {
    throw new Error("nothing to publish: no built main.js, run jensen-plugin build first");
  }
  if (!existsSync(readmeSrc)) {
    throw new Error(
      `no README.md in ${cwd}: every published plugin must document what it does and why it asks for its permissions, because Jensen shows it before the user installs`,
    );
  }

  const id = optionalString(block.id) ?? `plugin.${slug(pkg.name ?? "")}`;
  const manifest = {
    id,
    name: pkg.name ?? "",
    version: pkg.version ?? "",
    minAppVersion: optionalString(block.minAppVersion) ?? "",
    apiVersion: API_VERSION,
    description: pkg.description ?? "",
    author: authorName(pkg.author),
    entry: { main: MAIN_ASSET },
    permissions: permissionsOf(block),
  };

  const releaseDir = resolve(cwd, RELEASE_DIR);
  rmSync(releaseDir, { recursive: true, force: true });
  mkdirSync(releaseDir, { recursive: true });
  copyFileSync(mainSrc, join(releaseDir, MAIN_ASSET));
  copyFileSync(readmeSrc, join(releaseDir, README_ASSET));

  const pin = (name: string) => ({
    asset: name,
    sha256: sha256Hex(readFileSync(join(releaseDir, name))),
  });
  const manifestJson = JSON.stringify(
    { ...manifest, dist: { main: pin(MAIN_ASSET), readme: pin(README_ASSET) } },
    null,
    2,
  );
  writeFileSync(join(releaseDir, MANIFEST_ASSET), manifestJson);

  const tag = optionalString(block.tag);
  const entry: StoreEntry = {
    id: manifest.id,
    name: manifest.name,
    author: manifest.author,
    description: manifest.description,
    category: optionalString(block.category) ?? "",
    version: manifest.version,
    min_app_version: manifest.minAppVersion,
    repo: optionalString(block.repo) ?? "",
    ...(tag === undefined ? {} : { tag }),
    sha256: sha256Hex(manifestJson),
  };
  return {
    manifestJson,
    entry,
    releaseDir,
    assets: [MANIFEST_ASSET, MAIN_ASSET, README_ASSET],
  };
}

export function releaseTag(entry: StoreEntry): string {
  return entry.tag ?? entry.version;
}

export function releaseArgs(entry: StoreEntry, published: Published): string[] {
  const tag = releaseTag(entry);
  return [
    "release",
    "create",
    tag,
    ...published.assets.map((asset) => join(published.releaseDir, asset)),
    "--repo",
    entry.repo,
    "--title",
    `${entry.name} ${entry.version}`,
    "--notes",
    `${entry.name} ${entry.version}`,
  ];
}

export function entryFile(entry: StoreEntry): string {
  return `${JSON.stringify(entry, null, 2)}\n`;
}

export interface Runner {
  (command: string, args: string[], cwd?: string): string;
}

export const run: Runner = (command, args, cwd) => {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.error) throw new Error(`could not run ${command}: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`${command} ${args.slice(0, 2).join(" ")} failed: ${result.stderr.trim()}`);
  }
  return result.stdout.trim();
};

export function createRelease(entry: StoreEntry, published: Published, exec: Runner = run): void {
  exec("gh", releaseArgs(entry, published));
}

export function openStorePr(entry: StoreEntry, exec: Runner = run): string {
  const login = exec("gh", ["api", "user", "--jq", ".login"]);
  exec("gh", ["repo", "fork", STORE_REPO, "--clone=false"]);
  const work = mkdtempSync(join(tmpdir(), "jensen-plugin-store-"));
  try {
    exec("gh", [
      "repo",
      "clone",
      `${login}/${STORE_REPO.split("/")[1]}`,
      work,
      "--",
      "--depth",
      "1",
    ]);
    const branch = `plugin/${entry.id}-${entry.version}`;
    exec("git", ["checkout", "-b", branch], work);
    mkdirSync(join(work, "entries"), { recursive: true });
    writeFileSync(join(work, "entries", `${entry.id}.json`), entryFile(entry));
    exec("git", ["add", `entries/${entry.id}.json`], work);
    exec("git", ["commit", "-m", `feat: add ${entry.id} ${entry.version}`], work);
    exec("git", ["push", "-u", "origin", branch], work);
    return exec("gh", [
      "pr",
      "create",
      "--repo",
      STORE_REPO,
      "--head",
      `${login}:${branch}`,
      "--title",
      `Add ${entry.name} ${entry.version}`,
      "--body",
      `Adds \`entries/${entry.id}.json\` for ${entry.repo} at tag ${releaseTag(entry)}.`,
    ]);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

export interface PublishOptions {
  cwd: string;
  minify: boolean;
  build: boolean;
  release: boolean;
  storePr: boolean;
}

export async function publish(options: PublishOptions): Promise<StoreEntry> {
  const problems = checkProject(options.cwd);
  if (problems.length > 0) {
    throw new Error(problems.map((p) => `  ${p.field}: ${p.message}`).join("\n"));
  }
  if (options.build) await buildOnce({ cwd: options.cwd, minify: options.minify });
  const published = assemble(options.cwd, readPackage(options.cwd));
  const entry = published.entry;
  const entryProblems = validateEntry(entry);
  if (entryProblems.length > 0) {
    throw new Error(entryProblems.map((p) => `  ${p.field}: ${p.message}`).join("\n"));
  }
  process.stdout.write(`${entryFile(entry)}`);
  if (options.release) {
    createRelease(entry, published);
    process.stderr.write(`created release ${releaseTag(entry)} on ${entry.repo}\n`);
  }
  if (options.storePr) {
    process.stderr.write(`${openStorePr(entry)}\n`);
  }
  return entry;
}
