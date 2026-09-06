import { describe, expect, it } from "vitest";

import { createDecimal, isPolygonContainedInPolygon, locatePointInPolygon } from "../src/index.js";
import type { Point2D } from "../src/index.js";

const container = points("0,0 10,0 10,10 6,10 6,4 4,4 4,10 0,10");

// The container is a square with a notch descending to y=4.
describe("complete simple-polygon containment", () => {
  it.each([
    ["identical boundary", "0,0 10,0 10,10 6,10 6,4 4,4 4,10 0,10", true],
    ["inside", "1,1 9,1 9,3 1,3", true],
    ["boundary contact", "0,0 10,0 10,4 0,4", true],
    ["concave contained polygon", "1,1 9,1 9,9 7,9 7,3 1,3", true],
    ["outside vertex", "-0.001,0 2,0 2,2 0,2", false],
    ["edge across notch", "2,6 8,6 8,8 2,8", false],
    ["edge through concave vertices", "2,2 8,8 8,9 2,3", false],
    ["outside interval along boundary line", "0,10 10,10 10,0 0,0", false],
    ["boundary detour enclosing notch", "0,0 10,0 10,10 0,10", false],
    ["diagonal zone inside", "1,1 3,2 2,9", true],
    ["repeated zone closing vertex", "1,1 3,1 3,3 1,3 1,1", true],
    ["redundant collinear vertex", "0,0 5,0 10,0 10,4 0,4", true],
  ])("handles %s in both windings", (_name, coordinates, expected) => {
    const polygon = points(coordinates);
    for (const boundary of [container, [...container].reverse()]) {
      expect(isPolygonContainedInPolygon(polygon, boundary)).toBe(expected);
      expect(isPolygonContainedInPolygon([...polygon].reverse(), boundary)).toBe(expected);
    }
  });

  it("rejects excursions even though every subject vertex is inside or on the boundary", () => {
    const polygon = points("2,6 8,6 8,8 2,8");
    expect(polygon.every((point) => locatePointInPolygon(point, container) !== "outside")).toBe(
      true,
    );
    expect(isPolygonContainedInPolygon(polygon, container)).toBe(false);
  });

  it("preserves sub-EPSILON and long decimal differences", () => {
    const boundary = points("0.1,0.2 0.3,0.2 0.3,0.4 0.1,0.4");
    expect(isPolygonContainedInPolygon(points("0.1,0.2 0.3,0.2 0.3,0.4 0.1,0.4"), boundary)).toBe(
      true,
    );
    expect(
      isPolygonContainedInPolygon(
        points("0.1,0.2 0.300000000000000000000000001,0.2 0.3,0.4 0.1,0.4"),
        boundary,
      ),
    ).toBe(false);
  });

  it("requires polygons rather than empty input", () => {
    expect(isPolygonContainedInPolygon([], container)).toBe(false);
    expect(isPolygonContainedInPolygon(container, [])).toBe(false);
  });
});

function points(coordinates: string): readonly Point2D[] {
  return coordinates.split(" ").map((pair) => {
    const [x, y] = pair.split(",");
    if (x === undefined || y === undefined) throw new Error("Expected two test coordinates.");
    return { x: createDecimal(x), y: createDecimal(y) };
  });
}
