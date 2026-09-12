export type ProjectErrorCode =
  | "PROJECT_INVALID_JSON"
  | "PROJECT_INVALID_MANIFEST"
  | "PROJECT_UNSUPPORTED_SCHEMA"
  | "PROJECT_INVALID_PATH"
  | "PROJECT_INVALID_ARCHITECTURE_PATH"
  | "PROJECT_NOT_FOUND"
  | "PROJECT_NOT_DIRECTORY"
  | "PROJECT_NOT_REGULAR_FILE"
  | "PROJECT_INACCESSIBLE"
  | "PROJECT_SYMLINK"
  | "PROJECT_OUTSIDE_ROOT"
  | "PROJECT_RESOURCE_CHANGED";

export interface ProjectError {
  readonly code: ProjectErrorCode;
  readonly message: string;
  /** Manifest field or project-relative resource; never an absolute local path. */
  readonly location: string;
}

export type ProjectResult<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: ProjectError };

export function projectFailure(
  code: ProjectErrorCode,
  location: string,
  message: string,
): ProjectResult<never> {
  return { ok: false, error: { code, location, message } };
}
