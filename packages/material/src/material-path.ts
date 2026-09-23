/** Pure Project Format 1.0 section 8 syntax, without filesystem resolution. */
export function isMaterialFilePath(value: unknown, extensions: readonly string[]): value is string {
  if (
    typeof value !== "string" ||
    !value.startsWith("assets/materials/") ||
    value.includes("\\") ||
    value.includes("\0") ||
    !value
      .split("/")
      .every(
        (segment) =>
          segment !== "" &&
          segment !== "." &&
          segment !== ".." &&
          !/^[a-z][a-z0-9+.-]*:/i.test(segment),
      )
  )
    return false;
  const filename = value.slice(value.lastIndexOf("/") + 1);
  return extensions.some(
    (extension) => filename.length > extension.length && filename.endsWith(extension),
  );
}
