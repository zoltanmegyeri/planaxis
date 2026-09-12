export interface ProjectMetadata {
  readonly schema: "planaxis-project/1.0";
  readonly name: string;
  readonly architecture: { readonly active: string };
}

/** Only controlled transport messages may be displayed by the application. */
export class ProjectLoadError extends Error {}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validate the display contract; filesystem conformance remains server-owned. */
function parseProjectMetadata(value: unknown): ProjectMetadata {
  if (
    !isObject(value) ||
    value.schema !== "planaxis-project/1.0" ||
    typeof value.name !== "string" ||
    value.name.trim().length === 0 ||
    !isObject(value.architecture) ||
    typeof value.architecture.active !== "string"
  ) {
    throw new ProjectLoadError("The server returned malformed or unsupported project metadata.");
  }
  const active = value.architecture.active;
  if (
    !active.startsWith("architecture/") ||
    !active.endsWith(".svg") ||
    active.includes("\\") ||
    active.includes("\0") ||
    active.includes(":") ||
    active.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new ProjectLoadError("The server returned an invalid active architecture path.");
  }
  return { schema: value.schema, name: value.name, architecture: { active } };
}

export async function fetchProjectMetadata(signal: AbortSignal): Promise<ProjectMetadata> {
  const response = await fetch("/api/project", { signal });
  if (!response.ok)
    throw new ProjectLoadError(`Project metadata request failed (HTTP ${response.status}).`);
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new ProjectLoadError("The server returned unreadable project metadata.");
  }
  return parseProjectMetadata(value);
}

export async function fetchActiveArchitecture(signal: AbortSignal): Promise<string> {
  const response = await fetch("/api/project/architecture", { signal });
  if (!response.ok)
    throw new ProjectLoadError(`Active architecture request failed (HTTP ${response.status}).`);
  return response.text();
}
