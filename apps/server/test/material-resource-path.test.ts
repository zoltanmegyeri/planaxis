import { describe, expect, it } from "vitest";

import { validateProjectResourcePath } from "../src/project/project-resource-path.js";

describe("Material 1.0 resource selectors", () => {
  it.each([
    ["material", "assets/materials/paint.json"],
    ["material", "assets/materials/nested/東京 paint/material.json"],
    ["material-texture", "assets/materials/shared/base.png"],
    ["material-texture", "assets/materials/shared/base.jpg"],
    ["material-texture", "assets/materials/shared/base.jpeg"],
    ["material-texture", "assets/materials/base.webp"],
  ] as const)("preserves the exact %s path %s", (kind, input) => {
    expect(validateProjectResourcePath(input, kind)).toEqual({ ok: true, value: input });
  });

  describe.each(["material", "material-texture"] as const)("%s", (kind) => {
    it.each([
      undefined,
      null,
      1,
      [],
      {},
      "",
      "/assets/materials/a.json",
      "C:/assets/materials/a.json",
      "file:assets/materials/a.json",
      "assets/materials/../a.json",
      "assets/materials/./a.json",
      "assets/materials//a.json",
      "assets\\materials\\a.json",
      "assets/materials/a\0.json",
      "assets/materials/",
      "assets/materials/a",
      "assets/materials/a.JSON",
      "assets/materials/a.PNG",
      "assets/materials/a.JPG",
      "assets/materials/a.JPEG",
      "assets/materials/a.WEBP",
      "assets/materials/a.gif",
      "assets/materials/a.svg",
      "assets/materials/a.avif",
      "assets/materials/a.ktx2",
      "assets/materials/.json",
      "assets/materials/.png",
      "assets/materials/.jpg",
      "assets/materials/.jpeg",
      "assets/materials/.webp",
      "assets/materials-other/a.json",
      "assets/models/a.json",
      "assets/models/a.png",
      "references/materials/a.json",
      "references/materials/a.png",
      ".planaxis/a.json",
      ".planaxis/a.png",
      "designs/a.json",
      "architecture/a.png",
    ])("rejects invalid selector %j", (input) => {
      expect(validateProjectResourcePath(input, kind)).toMatchObject({
        ok: false,
        error: { code: "PROJECT_INVALID_PATH" },
      });
    });
  });

  it("keeps descriptor and texture selectors distinct", () => {
    expect(validateProjectResourcePath("assets/materials/a.png", "material").ok).toBe(false);
    expect(validateProjectResourcePath("assets/materials/a.json", "material-texture").ok).toBe(
      false,
    );
  });
});
