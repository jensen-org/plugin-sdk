import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { create } from "../../src/cli/create.ts";
import { main } from "../../src/cli/main.ts";
import {
  bundledSkillDir,
  destinationsFor,
  installSkill,
  listFiles,
  SKILL_NAME,
  skill,
} from "../../src/cli/skill.ts";

let work: string;
let out: ReturnType<typeof spyOn>;
let err: ReturnType<typeof spyOn>;

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), "jensen-skill-"));
  out = spyOn(process.stdout, "write").mockImplementation(() => true);
  err = spyOn(process.stderr, "write").mockImplementation(() => true);
});

afterEach(() => {
  out.mockRestore();
  err.mockRestore();
  rmSync(work, { recursive: true, force: true });
});

const agents = (root: string) => join(root, ".agents/skills", SKILL_NAME);
const claude = (root: string) => join(root, ".claude/skills", SKILL_NAME);

function printed(): string {
  return out.mock.calls.map((call: unknown[]) => String(call[0])).join("");
}

describe("jensen-plugin skill install", () => {
  test("installs into .agents and .claude under the project by default", () => {
    const installed = installSkill({ root: work });

    expect(installed.map((item) => item.destination)).toEqual([agents(work), claude(work)]);
    const expected = listFiles(bundledSkillDir());
    expect(expected).toContain("SKILL.md");
    for (const destination of [agents(work), claude(work)]) {
      expect(listFiles(destination)).toEqual(expected);
      expect(readFileSync(join(destination, "SKILL.md"), "utf8")).toContain(`name: ${SKILL_NAME}`);
    }
  });

  test("honours --target for one location", () => {
    installSkill({ root: work, target: "claude" });
    expect(existsSync(claude(work))).toBe(true);
    expect(existsSync(agents(work))).toBe(false);

    installSkill({ root: work, target: "agents" });
    expect(existsSync(agents(work))).toBe(true);
  });

  test("--dir installs to that single path and ignores the target", () => {
    const code = skill(["install", "--dir", "custom/place", "--target", "claude"], work);

    expect(code).toBe(0);
    expect(existsSync(join(work, "custom/place/SKILL.md"))).toBe(true);
    expect(existsSync(claude(work))).toBe(false);
    expect(existsSync(agents(work))).toBe(false);
    expect(destinationsFor({ root: work, dir: "custom/place" })).toEqual([
      join(work, "custom/place"),
    ]);
  });

  test("prints every file it wrote", () => {
    expect(skill(["install"], work)).toBe(0);

    const text = printed();
    expect(text).toContain(".agents/skills/jensen-plugin-sdk");
    expect(text).toContain(".claude/skills/jensen-plugin-sdk");
    expect(text).toContain("SKILL.md");
    expect(text).toContain("references/testing.md");
  });

  test("refuses to overwrite without --force and leaves everything untouched", () => {
    installSkill({ root: work, target: "claude" });
    writeFileSync(join(claude(work), "SKILL.md"), "mine");

    expect(() => installSkill({ root: work })).toThrow("--force");
    expect(readFileSync(join(claude(work), "SKILL.md"), "utf8")).toBe("mine");
    expect(existsSync(agents(work))).toBe(false);
  });

  test("--force replaces an installed skill and drops stale files", () => {
    installSkill({ root: work });
    writeFileSync(join(claude(work), "SKILL.md"), "mine");
    writeFileSync(join(claude(work), "stale.md"), "old");

    installSkill({ root: work, force: true });

    expect(readFileSync(join(claude(work), "SKILL.md"), "utf8")).toContain(`name: ${SKILL_NAME}`);
    expect(existsSync(join(claude(work), "stale.md"))).toBe(false);
  });

  test("--force still refuses a directory that is not a skill", () => {
    mkdirSync(join(work, "docs"));
    writeFileSync(join(work, "docs/keep.md"), "keep");

    expect(() => installSkill({ root: work, dir: "docs", force: true })).toThrow("not a skill");
    expect(readFileSync(join(work, "docs/keep.md"), "utf8")).toBe("keep");
  });

  test("reports a bad target and a missing --dir value", () => {
    expect(skill(["install", "--target", "nope"], work)).toBe(1);
    expect(skill(["install", "--dir"], work)).toBe(1);
    expect(skill(["wat"], work)).toBe(1);
    expect(skill([], work)).toBe(0);
  });

  test("is wired into the CLI, with --cwd and --force", async () => {
    expect(await main(["skill", "install", "--cwd", work])).toBe(0);
    expect(existsSync(join(agents(work), "SKILL.md"))).toBe(true);

    expect(await main(["skill", "install", "--cwd", work])).toBe(1);
    expect(await main(["skill", "install", "--cwd", work, "--force"])).toBe(0);
  });
});

describe("jensen-plugin create and the skill", () => {
  async function scaffold(...extra: string[]): Promise<number> {
    const previous = process.cwd();
    process.chdir(work);
    try {
      return await create(["demo", "--yes", ...extra]);
    } finally {
      process.chdir(previous);
    }
  }

  test("installs the skill into the new project by default", async () => {
    expect(await scaffold()).toBe(0);

    expect(existsSync(join(agents(join(work, "demo")), "SKILL.md"))).toBe(true);
    expect(existsSync(join(claude(join(work, "demo")), "SKILL.md"))).toBe(true);
    expect(printed()).toContain("agent skill");
  });

  test("--no-skill opts out, wherever the flag sits", async () => {
    expect(await scaffold("--no-skill")).toBe(0);

    expect(existsSync(join(work, "demo/package.json"))).toBe(true);
    expect(existsSync(join(work, "demo/.agents"))).toBe(false);
    expect(existsSync(join(work, "demo/.claude"))).toBe(false);
  });

  test("a flag before the directory does not hide it", async () => {
    const previous = process.cwd();
    process.chdir(work);
    try {
      expect(await create(["--no-skill", "--yes", "later"])).toBe(0);
    } finally {
      process.chdir(previous);
    }
    expect(existsSync(join(work, "later/package.json"))).toBe(true);
  });
});
