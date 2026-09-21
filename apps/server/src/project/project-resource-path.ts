import { validateProjectRelativePath, type ProjectRelativePath } from "./project-path.js";
import { projectFailure, type ProjectResult } from "./project-result.js";

/** Resource selection only; descriptor contents are validated by @planaxis/design. */
export function validateProjectResourcePath(
  input: unknown,
  kind: "design" | "architecture",
): ProjectResult<ProjectRelativePath> {
  const checked = validateProjectRelativePath(input);
  if (!checked.ok) return checked;
  const directory = kind === "design" ? "designs" : "architecture";
  const extension = kind === "design" ? ".json" : ".svg";
  const filename = checked.value.slice(checked.value.lastIndexOf("/") + 1);
  if (
    !checked.value.startsWith(`${directory}/`) ||
    !filename.endsWith(extension) ||
    filename.length <= extension.length
  ) {
    return projectFailure(
      "PROJECT_INVALID_PATH",
      "path",
      `Expected a file below ${directory}/ with a lowercase ${extension} extension.`,
    );
  }
  return checked;
}
