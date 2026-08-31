import { describe, expect, it } from "vitest";

import {
  createDecimal,
  getRectBottomEdge,
  getRectCenterX,
  getRectCenterY,
  getRectRightEdge,
} from "../src/index.js";
import type { Point2D, Rect2D } from "../src/index.js";

describe("Point2D", () => {
  it("preserves exact decimal coordinates", () => {
    const point: Point2D = {
      x: createDecimal("2.33"),
      y: createDecimal("12.01"),
    };

    expect(point.x.toString()).toBe("2.33");
    expect(point.y.toString()).toBe("12.01");
  });
});

describe("Rect2D", () => {
  it("preserves exact fields and derives fractional geometry exactly", () => {
    const rect: Rect2D = {
      x: createDecimal("2.33"),
      y: createDecimal("12.01"),
      width: createDecimal("0.2"),
      height: createDecimal("0.1"),
    };

    expect(rect.x.toString()).toBe("2.33");
    expect(rect.y.toString()).toBe("12.01");
    expect(rect.width.toString()).toBe("0.2");
    expect(rect.height.toString()).toBe("0.1");
    expect(getRectRightEdge(rect).toString()).toBe("2.53");
    expect(getRectBottomEdge(rect).toString()).toBe("12.11");
    expect(getRectCenterX(rect).toString()).toBe("2.43");
    expect(getRectCenterY(rect).toString()).toBe("12.06");
  });
});
