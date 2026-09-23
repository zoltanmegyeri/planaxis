import { validateProjectRelativePath, type ProjectRelativePath } from "./project-path.js";
import { projectFailure, type ProjectResult } from "./project-result.js";

const RESOURCE_LOCATIONS = {
  design: { directory: "designs", extensions: [".json"] },
  architecture: { directory: "architecture", extensions: [".svg"] },
  material: { directory: "assets/materials", extensions: [".json"] },
  "material-texture": {
    directory: "assets/materials",
    extensions: [".png", ".jpg", ".jpeg", ".webp"],
  },
} as const;

/** Resource selection only; no descriptor validation or texture decoding. */
export function validateProjectResourcePath(
  input: unknown,
  kind: keyof typeof RESOURCE_LOCATIONS,
): ProjectResult<ProjectRelativePath> {
  const checked = validateProjectRelativePath(input);
  if (!checked.ok) return checked;
  const { directory, extensions } = RESOURCE_LOCATIONS[kind];
  const filename = checked.value.slice(checked.value.lastIndexOf("/") + 1);
  if (
    !checked.value.startsWith(`${directory}/`) ||
    !extensions.some(
      (extension) => filename.endsWith(extension) && filename.length > extension.length,
    )
  ) {
    return projectFailure(
      "PROJECT_INVALID_PATH",
      "path",
      `Expected a file below ${directory}/ with a lowercase ${extensions.join(" or ")} extension.`,
    );
  }
  return checked;
}
