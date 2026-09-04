import { describe, expect, it } from "vitest";

import {
  arePointsGeometricallyEqual,
  createDecimal,
  doesPolygonOverlapRectWithPositiveArea,
  doPolygonsOverlapWithPositiveArea,
  doRectsIntersect,
  doRectsOverlapWithPositiveArea,
  getPolygonArea,
  getSegmentIntersectionType,
  hasPolygonSelfIntersection,
  isPointInRect,
  isRectContainedInRect,
  locatePointInPolygon,
} from "../src/index.js";
import type { Point2D, Rect2D } from "../src/index.js";

describe("point relations", () => {
  it("compares both coordinates with the normative tolerance", () => {
    expect(arePointsGeometricallyEqual(point("0", "0"), point("0.01", "-0.01"))).toBe(true);
    expect(arePointsGeometricallyEqual(point("0", "0"), point("0.011", "0"))).toBe(false);
  });
});

describe("segment intersections", () => {
  it.each([
    [
      "crossing segments",
      point("0", "0"),
      point("4", "4"),
      point("0", "4"),
      point("4", "0"),
      "point",
    ],
    [
      "endpoint contact",
      point("0", "0"),
      point("2", "0"),
      point("2", "0"),
      point("3", "1"),
      "point",
    ],
    [
      "collinear overlap",
      point("0", "0"),
      point("3", "0"),
      point("2", "0"),
      point("4", "0"),
      "overlap",
    ],
    ["separation", point("0", "0"), point("1", "0"), point("2", "0"), point("3", "0"), "none"],
  ] as const)("classifies %s", (_name, aStart, aEnd, bStart, bEnd, expected) => {
    expect(getSegmentIntersectionType(aStart, aEnd, bStart, bEnd)).toBe(expected);
  });

  it("does not confuse distinct zero-length segments on one horizontal line", () => {
    expect(
      getSegmentIntersectionType(
        point("0", "1"),
        point("0", "1"),
        point("2", "1"),
        point("2", "1"),
      ),
    ).toBe("none");
  });
});

describe("polygon topology", () => {
  it("computes winding-independent area with exact decimals", () => {
    const clockwise = polygon(["0", "0"], ["0.2", "0"], ["0.2", "0.1"], ["0", "0.1"]);

    expect(getPolygonArea(clockwise).toString()).toBe("0.02");
    expect(getPolygonArea([...clockwise].reverse()).toString()).toBe("0.02");
  });

  it("detects crossings and non-adjacent boundary touches", () => {
    expect(
      hasPolygonSelfIntersection(polygon(["0", "0"], ["4", "4"], ["0", "4"], ["4", "0"])),
    ).toBe(true);
    expect(
      hasPolygonSelfIntersection(
        polygon(["0", "0"], ["4", "0"], ["4", "4"], ["2", "0"], ["0", "4"]),
      ),
    ).toBe(true);
    expect(
      hasPolygonSelfIntersection(polygon(["0", "0"], ["4", "0"], ["4", "4"], ["0", "4"])),
    ).toBe(false);
  });

  it("locates interior, boundary, and exterior points", () => {
    const square = polygon(["0", "0"], ["4", "0"], ["4", "4"], ["0", "4"]);

    expect(locatePointInPolygon(point("2", "2"), square)).toBe("inside");
    expect(locatePointInPolygon(point("4", "2"), square)).toBe("boundary");
    expect(locatePointInPolygon(point("5", "2"), square)).toBe("outside");
  });

  it("distinguishes shared boundaries from positive-area polygon overlap", () => {
    const first = polygon(["0", "0"], ["4", "0"], ["4", "4"], ["0", "4"]);
    const sharedEdge = polygon(["4", "0"], ["8", "0"], ["8", "4"], ["4", "4"]);
    const overlapping = polygon(["3", "0"], ["7", "0"], ["7", "4"], ["3", "4"]);

    expect(doPolygonsOverlapWithPositiveArea(first, sharedEdge)).toBe(false);
    expect(doPolygonsOverlapWithPositiveArea(first, overlapping)).toBe(true);
    expect(doPolygonsOverlapWithPositiveArea(first, first)).toBe(true);
  });

  it("handles concave polygons and rectangles whose corners remain outside", () => {
    const concave = polygon(["0", "0"], ["6", "0"], ["6", "2"], ["2", "2"], ["2", "6"], ["0", "6"]);
    const diamond = polygon(["2", "0"], ["4", "2"], ["2", "4"], ["0", "2"]);

    expect(
      doPolygonsOverlapWithPositiveArea(
        concave,
        polygon(["1", "1"], ["3", "1"], ["3", "3"], ["1", "3"]),
      ),
    ).toBe(true);
    expect(doesPolygonOverlapRectWithPositiveArea(diamond, rect("0", "0", "4", "4"))).toBe(true);
    expect(doesPolygonOverlapRectWithPositiveArea(diamond, rect("4", "0", "2", "4"))).toBe(false);
  });
});

describe("rectangle relations", () => {
  it("uses inclusive containment for points and rectangles", () => {
    const outer = rect("0", "0", "10", "10");

    expect(isPointInRect(point("10", "10"), outer)).toBe(true);
    expect(isPointInRect(point("10.001", "10"), outer)).toBe(false);
    expect(isRectContainedInRect(rect("0", "2", "10", "8"), outer)).toBe(true);
    expect(isRectContainedInRect(rect("0", "2", "10.001", "8"), outer)).toBe(false);
  });

  it("distinguishes contact from positive-area overlap", () => {
    const first = rect("0", "0", "4", "4");
    const touching = rect("4", "1", "2", "2");
    const overlapping = rect("3.999", "1", "2", "2");

    expect(doRectsIntersect(first, touching)).toBe(true);
    expect(doRectsOverlapWithPositiveArea(first, touching)).toBe(false);
    expect(doRectsOverlapWithPositiveArea(first, overlapping)).toBe(true);
  });
});

function point(x: string, y: string): Point2D {
  return { x: createDecimal(x), y: createDecimal(y) };
}

function polygon(...coordinates: ReadonlyArray<readonly [string, string]>): readonly Point2D[] {
  return coordinates.map(([x, y]) => point(x, y));
}

function rect(x: string, y: string, width: string, height: string): Rect2D {
  return {
    x: createDecimal(x),
    y: createDecimal(y),
    width: createDecimal(width),
    height: createDecimal(height),
  };
}
