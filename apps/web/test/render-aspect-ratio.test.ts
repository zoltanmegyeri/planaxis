import { expect, it } from "vitest";
import { fitRenderSurface } from "../src/render-aspect-ratio.js";
import type { RenderAspectRatio } from "../src/render-aspect-ratio.js";

it.each([
  ["fill", 1200, 800, 0, 0],
  ["16:9", 1200, 675, 0, 62.5],
  ["3:2", 1200, 800, 0, 0],
  ["1:1", 800, 800, 200, 0],
  ["2:3", 1600 / 3, 800, 1000 / 3, 0],
  ["9:16", 450, 800, 375, 0],
] as const)("fits and centers the %s render surface", (selection, width, height, left, top) => {
  expect(fitRenderSurface(1200, 800, selection as RenderAspectRatio)).toEqual({
    width: expect.closeTo(width),
    height: expect.closeTo(height),
    left: expect.closeTo(left),
    top: expect.closeTo(top),
  });
});
