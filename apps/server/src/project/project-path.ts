import { projectFailure, type ProjectResult } from "./project-result.js";

declare const projectRelativePathBrand: unique symbol;
export type ProjectRelativePath = string & { readonly [projectRelativePathBrand]: true };

/** Project Format 1.0 section 8: reject unsafe syntax before native resolution. */
export function validateProjectRelativePath(value: unknown): ProjectResult<ProjectRelativePath> {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.includes("\\") ||
    value.includes("\0") ||
    value
      .split("/")
      .some(
        (segment) =>
          segment === "" ||
          segment === "." ||
          segment === ".." ||
          /^[a-z][a-z0-9+.-]*:/i.test(segment),
      )
  ) {
    return projectFailure(
      "PROJECT_INVALID_PATH",
      "projectRelativePath",
      "Expected a non-empty project-relative path without absolute, URI, drive, backslash, NUL, empty, dot, or parent segments.",
    );
  }

  return { ok: true, value: value as ProjectRelativePath };
}
