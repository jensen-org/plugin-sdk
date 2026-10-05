import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packages = ["protocol", "ui", "sdk", "create"];

function declarations(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return declarations(path);
      return entry.name.endsWith(".d.ts") ? [path] : [];
    });
}

function report(name) {
  const dist = resolve(root, "packages", name, "dist");
  if (!existsSync(dist)) throw new Error(`packages/${name} is not built: run bun run build first`);
  return declarations(dist)
    .map((file) => `// ${relative(dist, file)}\n${readFileSync(file, "utf8")}`)
    .join("\n");
}

const check = process.argv.includes("--check");
let drift = false;
mkdirSync(resolve(root, "api"), { recursive: true });
for (const name of packages) {
  const target = resolve(root, "api", `${name}.api.d.ts`);
  const next = report(name);
  if (check) {
    const current = existsSync(target) ? readFileSync(target, "utf8") : "";
    if (current !== next) {
      process.stderr.write(
        `api/${name}.api.d.ts is out of date: run bun run api:update and review the diff\n`,
      );
      drift = true;
    }
  } else {
    writeFileSync(target, next);
  }
}
if (drift) process.exit(1);
