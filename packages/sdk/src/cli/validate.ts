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
] as const;
const KNOWN_PERMISSIONS = new Set<string>([...BOOLEAN_PERMISSIONS, "editor", "fs", "network"]);
const RETIRED_KEYS: Record<string, string> = {
  contributes:
    "v1 plugins register panes, commands, settings and themes at runtime from onload(), so there is no contributes block",
  activationEvents: "every enabled plugin loads at startup, so there is no activationEvents key",
};

function isRelativeScope(scope: string): boolean {
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

/** Checks what `jensen publish` will derive a manifest from, so a mistake shows up before a release. */
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
              `'${scope}' must be a relative directory inside the project`,
            );
          }
        }
      }
    }
  }
  return problems;
}
