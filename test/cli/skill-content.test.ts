import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import ts from "typescript";

const root = resolve(import.meta.dir, "../..");
const skillDir = join(root, "skills/jensen-plugin-sdk");

function markdownFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return markdownFiles(path);
    return entry.name.endsWith(".md") ? [path] : [];
  });
}

const files = markdownFiles(skillDir);
const read = (file: string) => readFileSync(file, "utf8");
const skillText = read(join(skillDir, "SKILL.md"));

function frontmatter(text: string): Record<string, string> {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!match?.[1]) throw new Error("SKILL.md has no frontmatter");
  const fields: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const at = line.indexOf(":");
    if (at < 0) throw new Error(`frontmatter line is not key: value: ${line}`);
    fields[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return fields;
}

function proseOf(text: string): string {
  return text.replace(/^```[\s\S]*?^```/gm, "");
}

interface Sample {
  file: string;
  index: number;
  code: string;
}

function samples(): Sample[] {
  const found: Sample[] = [];
  for (const file of files) {
    const pattern = /^```ts check\n([\s\S]*?)^```/gm;
    let index = 0;
    for (let match = pattern.exec(read(file)); match; match = pattern.exec(read(file))) {
      found.push({ file, index: index++, code: match[1] ?? "" });
    }
  }
  return found;
}

describe("the bundled skill", () => {
  test("has frontmatter that parses and names the skill after its directory", () => {
    const fields = frontmatter(skillText);

    expect(fields.name).toBe("jensen-plugin-sdk");
    expect(fields.name).toBe(skillDir.split("/").pop());
    expect(fields.description?.length ?? 0).toBeGreaterThan(80);
    expect(fields.description?.length ?? 0).toBeLessThanOrEqual(1024);
    expect(fields.description).toContain("@jensen-org/plugin-sdk");
    expect(fields.description).toContain("jensen-plugin");
  });

  test("keeps SKILL.md short", () => {
    expect(skillText.split("\n").length).toBeLessThanOrEqual(250);
  });

  test("links only to files that exist, and links every reference", () => {
    const linked = new Set<string>();
    for (const file of files) {
      for (const match of read(file).matchAll(/\]\(([^)#\s]+)\)/g)) {
        const target = match[1] ?? "";
        if (/^[a-z]+:/.test(target)) continue;
        const resolved = resolve(dirname(file), target);
        expect(existsSync(resolved), `${file} links to missing ${target}`).toBe(true);
        linked.add(resolved);
      }
    }
    const references = files.filter((file) => file.includes("/references/"));
    expect(references.length).toBeGreaterThanOrEqual(8);
    for (const reference of references) {
      expect(linked.has(reference), `${reference} is not linked`).toBe(true);
    }
    const fromSkill = [...skillText.matchAll(/\]\((references\/[^)]+)\)/g)].map((m) =>
      resolve(skillDir, m[1] ?? ""),
    );
    for (const reference of references) {
      expect(fromSkill, `${reference} is not linked from SKILL.md`).toContain(reference);
    }
  });

  test("mentions both install locations", () => {
    expect(skillText).toContain(".agents/skills/jensen-plugin-sdk");
    expect(skillText).toContain(".claude/skills/jensen-plugin-sdk");
  });

  test("uses no em-dashes and no dashes as separators in prose", () => {
    for (const file of files) {
      const text = read(file);
      expect(text, file).not.toContain("—");
      expect(text, file).not.toContain("–");
      const prose = proseOf(text).replace(/^---\n[\s\S]*?\n---\n/, "");
      expect(prose.match(/\S[ ]-[ ]\S/g), file).toBeNull();
    }
  });

  test("has complete samples to compile", () => {
    expect(samples().length).toBeGreaterThanOrEqual(8);
  });

  test("every sample marked as complete typechecks against the package source", () => {
    const found = samples();
    const virtual = new Map<string, string>();
    for (const sample of found) {
      virtual.set(join(root, "test/.skill-samples", `sample-${virtual.size}.ts`), sample.code);
    }

    const options: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      lib: ["lib.es2022.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"],
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      allowImportingTsExtensions: true,
      types: ["bun"],
      typeRoots: [join(root, "node_modules/@types")],
      paths: {
        "@jensen-org/plugin-sdk": ["./src/index.ts"],
        "@jensen-org/plugin-sdk/ui": ["./src/ui/index.ts"],
        "@jensen-org/plugin-sdk/protocol": ["./src/protocol/index.ts"],
        "@jensen-org/plugin-sdk/testing": ["./src/testing.ts"],
      },
      pathsBasePath: root,
    };
    const host = ts.createCompilerHost(options);
    const { fileExists, readFile, getSourceFile } = host;
    host.fileExists = (name) => virtual.has(name) || fileExists.call(host, name);
    host.readFile = (name) => virtual.get(name) ?? readFile.call(host, name);
    host.getSourceFile = (name, languageVersion, onError, shouldCreate) => {
      const code = virtual.get(name);
      return code === undefined
        ? getSourceFile.call(host, name, languageVersion, onError, shouldCreate)
        : ts.createSourceFile(name, code, languageVersion, true);
    };

    const program = ts.createProgram([...virtual.keys()], options, host);
    const names = [...virtual.keys()];
    const problems = ts
      .getPreEmitDiagnostics(program)
      .filter((diagnostic) => diagnostic.file && virtual.has(diagnostic.file.fileName))
      .map((diagnostic) => {
        const file = diagnostic.file;
        const at = file?.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
        const sample = found[names.indexOf(file?.fileName ?? "")];
        return `${sample?.file}#${sample?.index} line ${(at?.line ?? 0) + 1}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`;
      });

    expect(problems).toEqual([]);
  }, 60_000);
});
