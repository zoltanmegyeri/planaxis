import type { FinishTargetId } from "@planaxis/model-3d";

/** Project Format 1.0 section 8, before any environment-specific resolution. */
export function isProjectRelativePath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !value.includes("\\") &&
    !value.includes("\0") &&
    value
      .split("/")
      .every(
        (segment) =>
          segment !== "" &&
          segment !== "." &&
          segment !== ".." &&
          !/^[a-z][a-z0-9+.-]*:/i.test(segment),
      )
  );
}

export function isDescriptorFilePath(
  value: unknown,
  directory: string,
  extension: string,
): value is string {
  if (!isProjectRelativePath(value) || !value.startsWith(`${directory}/`)) return false;
  const filename = value.slice(value.lastIndexOf("/") + 1);
  return filename.length > extension.length && filename.endsWith(extension);
}

const ID = "[A-Za-z][A-Za-z0-9._-]*";
const HORIZONTAL = "(?:floor|ceiling)";
const WALL_SIDE = `wall:${ID}:side-(?:negative|positive)`;
// A negative lookahead enforces the true end, including rejection of trailing newlines.
const FINISH_TARGET = new RegExp(
  `^(?:${HORIZONTAL}|${WALL_SIDE}|wall:${ID}:opening:${ID}:reveal-(?:start|end|top|bottom)|space:${ID}:(?:${HORIZONTAL}|${WALL_SIDE}))(?![\\s\\S])`,
);

export function isFinishTargetId(value: unknown): value is FinishTargetId {
  return typeof value === "string" && FINISH_TARGET.test(value);
}
