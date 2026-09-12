import path from "node:path";

import { describe, expect, it } from "vitest";

import { isWithinProjectRoot } from "../src/project/project-filesystem.js";
import { validateProjectRelativePath } from "../src/project/project-path.js";

const INVALID_PROJECT_PATHS = [
  "",
  "/file.svg",
  "//server/share/file.svg",
  "\\\\server\\share\\file.svg",
  "architecture\\file.svg",
  "architecture//file.svg",
  "architecture/",
  ".",
  "..",
  "./file.svg",
  "../file.svg",
  "architecture/./file.svg",
  "architecture/../file.svg",
  "file\0.svg",
  "file:/tmp/file.svg",
  "file:///tmp/file.svg",
  "https://example.com/file.svg",
  "custom+scheme:value",
  "C:/file.svg",
  "C:file.svg",
  "c:\\file.svg",
  "architecture/C:/file.svg",
  "architecture/file:outside.svg",
] as const;

describe("Project Format 1.0 project-relative paths", () => {
  it.each(INVALID_PROJECT_PATHS)(
    "rejects prohibited form %j before native normalization",
    (input) => {
      expect(validateProjectRelativePath(input)).toMatchObject({
        ok: false,
        error: { code: "PROJECT_INVALID_PATH" },
      });
    },
  );

  it.each([null, undefined, 1, [], {}, true])("rejects non-string %j", (input) => {
    expect(validateProjectRelativePath(input)).toMatchObject({
      ok: false,
      error: { code: "PROJECT_INVALID_PATH" },
    });
  });

  it.each([
    "architecture/existing.svg",
    "assets/models/chair/model.glb",
    ".planaxis/cache/preview.png",
    "references/Product photo 1.jpg",
    "references/東京.png",
    "notes..txt",
    "..notes",
    "references/%2e%2e.txt",
  ])("preserves conforming path %j literally", (input) => {
    expect(validateProjectRelativePath(input)).toEqual({ ok: true, value: input });
  });
});

describe("physical root containment", () => {
  const root = path.resolve("project");
  it("accepts the root and its descendants", () => {
    expect(isWithinProjectRoot(root, root)).toBe(true);
    expect(isWithinProjectRoot(root, path.join(root, "architecture", "existing.svg"))).toBe(true);
    expect(isWithinProjectRoot(root, path.join(root, "..notes"))).toBe(true);
  });
  it("rejects parents and similarly prefixed siblings", () => {
    expect(isWithinProjectRoot(root, path.dirname(root))).toBe(false);
    expect(isWithinProjectRoot(root, `${root}-sibling`)).toBe(false);
    expect(isWithinProjectRoot(root, path.join(`${root}-sibling`, "secret.svg"))).toBe(false);
    expect(isWithinProjectRoot(root, path.resolve(root, "..", "secret.svg"))).toBe(false);
  });
});
