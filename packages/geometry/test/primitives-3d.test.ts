import { describe, expect, it } from "vitest";

import {
  arePoints3DExactlyEqual,
  arePoints3DGeometricallyEqual,
  createDecimal,
  getRectRightEdge,
  getVerticalRangeHeight,
} from "../src/index.js";
import type {
  HorizontalPolygonSurface3D,
  Point2D,
  Point3D,
  Rect2D,
  RectangularPrism3D,
  VerticalRange,
} from "../src/index.js";

function point(x: string, y: string, z: string): Point3D {
  return { x: createDecimal(x), y: createDecimal(y), z: createDecimal(z) };
}

describe("Point3D public API", () => {
  it("preserves coordinates beyond native number precision", () => {
    const value = point("9007199254740993.1", "-12.010000000000000001", "0.100000000000000001");

    expect(value.x.toString()).toBe("9007199254740993.1");
    expect(value.y.toString()).toBe("-12.010000000000000001");
    expect(value.z.toString()).toBe("0.100000000000000001");
  });

  it("compares equal coordinate values independently of identity and decimal scale", () => {
    const a = point("2.33", "-12.01", "0.1");
    const b = point("2.330", "-12.010", "0.10");

    expect(arePoints3DExactlyEqual(a, b)).toBe(true);
    expect(arePoints3DGeometricallyEqual(a, b)).toBe(true);
  });

  it.each(["x", "y", "z"] as const)("detects an exact difference in %s below tolerance", (axis) => {
    const a = point("2.33", "-12.01", "0.1");
    const b: Point3D = { ...a, [axis]: a[axis].plus(createDecimal("0.000000000000000001")) };

    expect(arePoints3DExactlyEqual(a, b)).toBe(false);
    expect(arePoints3DExactlyEqual(b, a)).toBe(false);
    expect(arePoints3DGeometricallyEqual(a, b)).toBe(true);
  });

  describe.each(["x", "y", "z"] as const)("%s tolerance", (axis) => {
    it.each([
      ["0", true],
      ["0.009", true],
      ["0.01", true],
      ["0.010000000000000001", false],
    ] as const)("compares a difference of %s symmetrically", (difference, expected) => {
      const a = point("2.33", "-12.01", "0.1");
      const b: Point3D = { ...a, [axis]: a[axis].plus(createDecimal(difference)) };

      expect(arePoints3DGeometricallyEqual(a, b)).toBe(expected);
      expect(arePoints3DGeometricallyEqual(b, a)).toBe(expected);
    });
  });

  it("applies tolerance per coordinate", () => {
    expect(
      arePoints3DGeometricallyEqual(point("0", "0", "0"), point("0.01", "-0.01", "0.01")),
    ).toBe(true);
  });
});

describe("VerticalRange public API", () => {
  it.each([
    ["0.1", "0.3", "0.2"],
    ["2.33", "2.33", "0"],
    ["-12.01", "-2.33", "9.68"],
    ["-0.1", "0.2", "0.3"],
    ["9007199254740993.1", "9007199254740993.3", "0.2"],
  ])("derives exact height from %s to %s", (minZ, maxZ, expected) => {
    const range: VerticalRange = { minZ: createDecimal(minZ), maxZ: createDecimal(maxZ) };

    expect(getVerticalRangeHeight(range).toString()).toBe(expected);
    expect(range.minZ.toString()).toBe(minZ);
    expect(range.maxZ.toString()).toBe(maxZ);
  });
});

describe("RectangularPrism3D public API", () => {
  it("composes exact rectangle and vertical range geometry", () => {
    const footprint: Rect2D = {
      x: createDecimal("9007199254740993.1"),
      y: createDecimal("-12.01"),
      width: createDecimal("0.2"),
      height: createDecimal("2.33"),
    };
    const verticalRange: VerticalRange = {
      minZ: createDecimal("-0.1"),
      maxZ: createDecimal("0.2"),
    };
    const prism: RectangularPrism3D = { footprint, verticalRange };

    expect(prism.footprint).toBe(footprint);
    expect(prism.verticalRange).toBe(verticalRange);
    expect(getRectRightEdge(prism.footprint).toString()).toBe("9007199254740993.3");
    expect(getVerticalRangeHeight(prism.verticalRange).toString()).toBe("0.3");
  });
});

describe("HorizontalPolygonSurface3D public API", () => {
  it("preserves an exact XY boundary and a single Z coordinate", () => {
    const boundary: readonly Point2D[] = [
      { x: createDecimal("0.100000000000000001"), y: createDecimal("-12.01") },
      { x: createDecimal("2.33"), y: createDecimal("-12.01") },
      { x: createDecimal("2.33"), y: createDecimal("0.2") },
    ];
    const surface: HorizontalPolygonSurface3D = {
      boundary,
      z: createDecimal("-9007199254740993.1"),
    };

    expect(surface.boundary.map(({ x, y }) => [x.toString(), y.toString()])).toEqual([
      ["0.100000000000000001", "-12.01"],
      ["2.33", "-12.01"],
      ["2.33", "0.2"],
    ]);
    expect(surface.z.toString()).toBe("-9007199254740993.1");
  });
});
