import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline/promises";

export interface Answers {
  directory: string;
  id: string;
  name: string;
  description: string;
  author: string;
  sdkVersion: string;
}

const SDK_VERSION = "^0.1.0";

export function slug(text: string): string {
  const out = text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return out || "my-plugin";
}

export function files(answers: Answers): Record<string, string> {
  const pkg = {
    name: slug(answers.name),
    version: "0.1.0",
    description: answers.description,
    author: answers.author,
    type: "module",
    scripts: {
      build: "jensen-plugin build",
      dev: "jensen-plugin dev",
      validate: "jensen-plugin validate",
      typecheck: "tsc --noEmit",
    },
    dependencies: { "jensen-plugin-sdk": answers.sdkVersion },
    devDependencies: { typescript: "^5.6.0" },
    jensen: {
      id: answers.id,
      minAppVersion: "0.3.0",
      permissions: { workspace: true },
    },
  };
  return {
    "package.json": `${JSON.stringify(pkg, null, 2)}\n`,
    "tsconfig.json": `${JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "Bundler",
          lib: ["ES2022", "DOM"],
          strict: true,
          noEmit: true,
          skipLibCheck: true,
        },
        include: ["src"],
      },
      null,
      2,
    )}\n`,
    ".gitignore": "node_modules\nmain.js\nrelease\n",
    "README.md": readme(answers),
    "src/main.ts": mainSource(answers),
  };
}

function mainSource(answers: Answers): string {
  return `import { Notice, PaneView, Plugin, Setting, SettingTab, ui } from "jensen-plugin-sdk";

interface Data {
  greeting: string;
}

class Hello extends PaneView {
  render() {
    const data = (this.plugin as ${pascal(answers.name)}).data;
    return [
      ui.Stack([
        ui.Heading(data.greeting),
        ui.Text("This pane is drawn by Jensen from the nodes you return.", "muted"),
        ui.Button({ label: "Say hi", onClick: () => new Notice("Hi from ${answers.name}") }),
      ]),
    ];
  }
}

class Settings extends SettingTab {
  constructor(private readonly owner: ${pascal(answers.name)}) {
    super(owner.app, owner, { title: ${JSON.stringify(answers.name)} });
  }

  display() {
    new Setting(this.containerEl)
      .setName("Greeting")
      .setDesc("What the pane says")
      .addText((text) =>
        text.setValue(this.owner.data.greeting).onChange(async (value) => {
          this.owner.data.greeting = value;
          await this.owner.saveData(this.owner.data);
        }),
      );
  }
}

export default class ${pascal(answers.name)} extends Plugin {
  data: Data = { greeting: "Hello, Jensen" };

  async onload() {
    this.data = { ...this.data, ...((await this.loadData<Data>()) ?? {}) };

    this.registerPane("hello", Hello, { title: ${JSON.stringify(answers.name)}, icon: "rocket" });
    this.addSettingTab(new Settings(this));
    this.addCommand({
      id: "open",
      name: "Open ${answers.name}",
      hotkey: { key: "Mod+Shift+H" },
      callback: async () => {
        await this.app.workspace.openPane("hello", { direction: "right" });
      },
    });
  }
}
`;
}

function pascal(name: string): string {
  const out = slug(name)
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  return /^[A-Za-z]/.test(out) ? out : `Plugin${out}`;
}

function readme(answers: Answers): string {
  return `# ${answers.name}

${answers.description}

## Develop

\`\`\`bash
bun install        # or npm install
bun run build      # bundles src/main.ts into main.js
jensen publish .   # assembles release/ and adds it as a development source
\`\`\`

Then install the release folder from Jensen's Settings, Plugins, Install from GitHub, using the sha256
\`jensen publish\` prints. \`bun run dev --publish\` rebuilds and republishes on every change.

## What it asks for

| Permission | Why |
|---|---|
| \`workspace\` | to register and open its pane |

Add only what you use: \`editor\` ("read" or "write"), \`fs\` (project folders), \`theme\`, \`settings\`,
\`graph\`, \`knowledge\`, \`git\`, \`network\` (hosts). Jensen asks the user before granting any of them, and
this README is shown before they install.
`;
}

export function write(root: string, entries: Record<string, string>): string[] {
  const written: string[] = [];
  for (const [relative, contents] of Object.entries(entries)) {
    const target = resolve(root, relative);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, contents);
    written.push(relative);
  }
  return written;
}

function flag(args: string[], name: string): string | undefined {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : undefined;
}

async function ask(question: string, fallback: string, yes: boolean): Promise<string> {
  if (yes) return fallback;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(`${question} (${fallback}) `)).trim();
    return answer || fallback;
  } finally {
    rl.close();
  }
}

export async function main(argv: string[]): Promise<number> {
  const positional = argv.find(
    (arg, index) => !arg.startsWith("--") && !argv[index - 1]?.startsWith("--"),
  );
  const yes = argv.includes("--yes") || !process.stdin.isTTY;
  const directory = positional ?? (await ask("Where should it go?", "my-jensen-plugin", yes));
  const root = resolve(process.cwd(), directory);
  if (existsSync(root) && readdirSync(root).length > 0) {
    process.stderr.write(`${directory} already exists and is not empty\n`);
    return 1;
  }
  const name =
    flag(argv, "name") ??
    (await ask("Plugin name?", directory.split("/").pop() ?? "my plugin", yes));
  const answers: Answers = {
    directory,
    name,
    id: flag(argv, "id") ?? (await ask("Plugin id (reverse dns)?", `dev.me.${slug(name)}`, yes)),
    description:
      flag(argv, "description") ??
      (await ask("One line description?", `${name}, a Jensen plugin`, yes)),
    author: flag(argv, "author") ?? (await ask("Author?", "me", yes)),
    sdkVersion: SDK_VERSION,
  };
  const written = write(root, files(answers));
  process.stdout.write(
    `Created ${directory}\n${written.map((file) => `  ${file}`).join("\n")}\n\n`,
  );
  process.stdout.write(`Next:\n  cd ${directory}\n  bun install\n  bun run build\n`);
  return 0;
}
