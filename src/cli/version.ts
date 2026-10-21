const IDENTIFIER = "(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)";
const CORE = "(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)";
export const PLUGIN_VERSION_PATTERN = new RegExp(
  `^${CORE}(?:-${IDENTIFIER}(?:\\.${IDENTIFIER})*)?$`,
);
const RELEASE_VERSION = new RegExp(`^${CORE}$`);

export const PLUGIN_VERSION_HINT =
  "must be semver such as 1.0.0 or 1.0.0-dev.5, without build metadata";

export function isPluginVersion(version: string): boolean {
  return PLUGIN_VERSION_PATTERN.test(version);
}

export function isReleaseVersion(version: string): boolean {
  return RELEASE_VERSION.test(version);
}

export function isPreRelease(version: string): boolean {
  return isPluginVersion(version) && !isReleaseVersion(version);
}
