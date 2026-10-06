import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const vendored = readFileSync(resolve(root, "protocol/plugin-api.v1.json"), "utf8");
const pinned = Object.fromEntries(
  readFileSync(resolve(root, "protocol/PINNED"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("=")),
);

async function source() {
  const local = process.env.JENSEN_REPO;
  if (local) {
    const file = resolve(local, pinned.path);
    if (!existsSync(file)) throw new Error(`JENSEN_REPO is set but ${file} does not exist`);
    return { label: file, text: readFileSync(file, "utf8") };
  }
  const url = `https://raw.githubusercontent.com/${pinned.repo}/${pinned.ref}/${pinned.path}`;
  const response = await fetch(url);
  if ([401, 403, 404].includes(response.status)) {
    process.stderr.write(
      `skipped: ${url} is not readable (${response.status}). Set JENSEN_REPO to check against a local checkout.\n`,
    );
    return null;
  }
  if (!response.ok) {
    throw new Error(
      `could not fetch ${url}: ${response.status}. Set JENSEN_REPO to a local checkout.`,
    );
  }
  return { label: url, text: await response.text() };
}

const upstream = await source();
if (!upstream) process.exit(0);
const { label, text } = upstream;
if (JSON.stringify(JSON.parse(text)) !== JSON.stringify(JSON.parse(vendored))) {
  process.stderr.write(
    `protocol/plugin-api.v1.json differs from ${label}. Copy the host's file over it, regenerate, and review the diff.\n`,
  );
  process.exit(1);
}
process.stdout.write(`protocol matches ${label}\n`);
