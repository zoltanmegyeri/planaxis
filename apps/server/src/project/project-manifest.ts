import {
  PROJECT_ARCHITECTURE_DIRECTORY,
  PROJECT_ARCHITECTURE_EXTENSION,
  PROJECT_MANIFEST_FILENAME,
  PROJECT_SCHEMA,
} from "./project-format-constants.js";
import { validateProjectRelativePath, type ProjectRelativePath } from "./project-path.js";
import { projectFailure, type ProjectResult } from "./project-result.js";

const ACTIVE_ARCHITECTURE_FIELD = `${PROJECT_ARCHITECTURE_DIRECTORY}.active`;

export interface ProjectManifest {
  readonly schema: typeof PROJECT_SCHEMA;
  readonly name: string;
  readonly architecture: { readonly active: ProjectRelativePath };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateProjectManifest(value: unknown): ProjectResult<ProjectManifest> {
  if (
    !isObject(value) ||
    Object.keys(value).length !== 3 ||
    !["schema", "name", PROJECT_ARCHITECTURE_DIRECTORY].every((key) => Object.hasOwn(value, key))
  ) {
    return projectFailure(
      "PROJECT_INVALID_MANIFEST",
      "manifest",
      "The manifest must be an object containing exactly schema, name, and architecture.",
    );
  }
  if (value.schema !== PROJECT_SCHEMA) {
    return projectFailure(
      "PROJECT_UNSUPPORTED_SCHEMA",
      "schema",
      `Only ${PROJECT_SCHEMA} is supported.`,
    );
  }
  if (typeof value.name !== "string" || !/[^\p{White_Space}\uFEFF]/u.test(value.name)) {
    return projectFailure(
      "PROJECT_INVALID_MANIFEST",
      "name",
      "The project name must contain at least one non-whitespace Unicode character.",
    );
  }
  if (
    !isObject(value.architecture) ||
    Object.keys(value.architecture).length !== 1 ||
    !Object.hasOwn(value.architecture, "active")
  ) {
    return projectFailure(
      "PROJECT_INVALID_MANIFEST",
      PROJECT_ARCHITECTURE_DIRECTORY,
      "Architecture must be an object containing exactly active.",
    );
  }

  const active = validateProjectRelativePath(value.architecture.active);
  if (!active.ok) {
    return { ok: false, error: { ...active.error, location: ACTIVE_ARCHITECTURE_FIELD } };
  }
  const filename = active.value.slice(active.value.lastIndexOf("/") + 1);
  if (
    !active.value.startsWith(`${PROJECT_ARCHITECTURE_DIRECTORY}/`) ||
    !filename.endsWith(PROJECT_ARCHITECTURE_EXTENSION) ||
    filename.length <= PROJECT_ARCHITECTURE_EXTENSION.length
  ) {
    return projectFailure(
      "PROJECT_INVALID_ARCHITECTURE_PATH",
      ACTIVE_ARCHITECTURE_FIELD,
      `The active architecture must be below ${PROJECT_ARCHITECTURE_DIRECTORY}/ with the lowercase ${PROJECT_ARCHITECTURE_EXTENSION} extension.`,
    );
  }
  return {
    ok: true,
    value: Object.freeze({
      schema: PROJECT_SCHEMA,
      name: value.name,
      architecture: Object.freeze({ active: active.value }),
    }),
  };
}

export function parseProjectManifest(bytes: Uint8Array): ProjectResult<ProjectManifest> {
  let value: unknown;
  try {
    // A BOM is discouraged, not prohibited; fatal decoding enforces UTF-8 without repair.
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    value = JSON.parse(text);
  } catch {
    return projectFailure(
      "PROJECT_INVALID_JSON",
      PROJECT_MANIFEST_FILENAME,
      "The manifest must contain one UTF-8 encoded JSON object.",
    );
  }
  return validateProjectManifest(value);
}
