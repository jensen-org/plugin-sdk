export interface Problem {
  field: string;
  message: string;
}

const ID = /^[a-z0-9]+([.-][a-z0-9]+)*$/;
const BOOLEAN_PERMISSIONS = [
  "graph",
  "knowledge",
  "git",
  "workspace",
  "theme",
  "settings",
  "backend",
] as const;
const TOOL_NAME = /^[a-z][a-z0-9_]*$/;
const MAX_TOOLS = 32;
const KNOWN_PERMISSIONS = new Set<string>([...BOOLEAN_PERMISSIONS, "editor", "fs", "network"]);
const RETIRED_KEYS: Record<string, string> = {
  contributes:
    "v1 plugins register panes, commands, settings and themes at runtime from onload(), so there is no contributes block",
  activationEvents: "every enabled plugin loads at startup, so there is no activationEvents key",
};

function isRelativeScope(scope: string): boolean {
  if (scope === "*" || scope === ".") return true;
  if (scope.startsWith("*.")) return /^[A-Za-z0-9_-]+$/.test(scope.slice(2));
  if (/[*?[]/.test(scope)) return false;
  if (!scope || scope.startsWith("/") || scope.includes("\\")) return false;
  const parts = scope.split("/");
  return parts.every((part) => part !== "" && part !== "." && part !== "..");
}

export interface PackageJson {
  name?: string;
  version?: string;
  description?: string;
  author?: unknown;
  jensen?: Record<string, unknown>;
}

/** Checks what `jensen-plugin publish` will derive a manifest from, so a mistake shows up before a release. */
export function validatePackage(pkg: PackageJson): Problem[] {
  const problems: Problem[] = [];
  const add = (field: string, message: string) => problems.push({ field, message });

  if (!pkg.name) add("name", "is required");
  if (!pkg.version || !/^\d+\.\d+\.\d+/.test(pkg.version))
    add("version", "must be semver, such as 1.0.0");
  if (!pkg.description) add("description", "is required: Jensen shows it before the user installs");
  if (!pkg.author) add("author", "is required");

  const block = pkg.jensen;
  if (!block || typeof block !== "object") {
    add(
      "jensen",
      'is missing: add a "jensen" block with at least an id and the permissions you need',
    );
    return problems;
  }
  for (const [key, why] of Object.entries(RETIRED_KEYS)) {
    if (key in block) add(`jensen.${key}`, why);
  }
  const id = block.id;
  if (id !== undefined && (typeof id !== "string" || !ID.test(id))) {
    add("jensen.id", "must be a reverse-dns id of lowercase letters, digits, '.' and '-'");
  }
  if (typeof block.minAppVersion !== "string") {
    add("jensen.minAppVersion", "is required: the oldest Jensen this plugin runs on");
  }

  const permissions = block.permissions;
  if (permissions !== undefined) {
    if (typeof permissions !== "object" || permissions === null) {
      add("jensen.permissions", "must be an object");
    } else {
      const given = permissions as Record<string, unknown>;
      for (const key of Object.keys(given)) {
        if (!KNOWN_PERMISSIONS.has(key))
          add(`jensen.permissions.${key}`, "is not a permission Jensen knows");
      }
      for (const key of BOOLEAN_PERMISSIONS) {
        if (key in given && typeof given[key] !== "boolean") {
          add(`jensen.permissions.${key}`, "must be true or false");
        }
      }
      if ("editor" in given && !["none", "read", "write"].includes(String(given.editor))) {
        add("jensen.permissions.editor", 'must be "none", "read" or "write"');
      }
      for (const key of ["fs", "network"] as const) {
        const value = given[key];
        if (
          value !== undefined &&
          !(Array.isArray(value) && value.every((v) => typeof v === "string"))
        ) {
          add(`jensen.permissions.${key}`, "must be a list of strings");
        }
      }
      const scopes = given.fs;
      if (Array.isArray(scopes)) {
        for (const scope of scopes) {
          if (typeof scope === "string" && !isRelativeScope(scope)) {
            add(
              "jensen.permissions.fs",
              `'${scope}' must be a folder inside the project, a file type such as "*.png", or "." for every file`,
            );
          }
        }
      }
    }
  }
  checkBackend(block, add);
  return problems;
}

function checkBackend(
  block: Record<string, unknown>,
  add: (field: string, message: string) => void,
): void {
  const backend = block.backend;
  const permissions = (block.permissions ?? {}) as Record<string, unknown>;
  if (backend !== undefined) {
    const parts = typeof backend === "string" ? backend.split("/") : [];
    const safe =
      typeof backend === "string" &&
      backend.endsWith(".wasm") &&
      !backend.startsWith("/") &&
      !backend.includes("\\") &&
      parts.every((part) => part !== "" && part !== "." && part !== "..");
    if (!safe) {
      add("jensen.backend", "must be a relative path to a built .wasm file inside the plugin");
    }
    if (permissions.backend !== true) {
      add("jensen.permissions.backend", "must be true when jensen.backend is set");
    }
  } else if (permissions.backend === true) {
    add("jensen.backend", "is required when the backend permission is set");
  }
  if (block.backendBuild !== undefined && typeof block.backendBuild !== "string") {
    add("jensen.backendBuild", "must be a shell command that writes jensen.backend");
  }
  const tools = block.tools;
  if (tools === undefined) return;
  if (!Array.isArray(tools)) {
    add("jensen.tools", "must be a list");
    return;
  }
  if (backend === undefined && tools.length > 0) {
    add("jensen.tools", "need jensen.backend, which serves them");
  }
  if (tools.length > MAX_TOOLS) add("jensen.tools", `may declare at most ${MAX_TOOLS} tools`);
  const seen = new Set<string>();
  tools.forEach((tool, index) => {
    const field = `jensen.tools[${index}]`;
    const item = tool as Record<string, unknown> | null;
    const name = item?.name;
    if (typeof name !== "string" || !TOOL_NAME.test(name)) {
      add(`${field}.name`, "must be lowercase letters, digits and '_', starting with a letter");
    } else if (seen.has(name)) {
      add(`${field}.name`, `'${name}' is declared twice`);
    } else {
      seen.add(name);
    }
    if (typeof item?.description !== "string" || item.description === "") {
      add(`${field}.description`, "is required: agents read it to decide when to call the tool");
    }
    if (typeof item?.inputSchema !== "object" || item.inputSchema === null) {
      add(`${field}.inputSchema`, "must be a JSON schema object");
    }
  });
}
