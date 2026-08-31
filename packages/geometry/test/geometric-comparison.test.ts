import { describe, expect, it } from "vitest";

import {
  createDecimal,
  GEOMETRIC_EPSILON,
  isGeometricallyEqual,
  isGreaterThanOrEqualWithinTolerance,
  isLessThanOrEqualWithinTolerance,
} from "../src/index.js";

describe("GEOMETRIC_EPSILON", () => {
  it("is the exact normative Apartment SVG tolerance", () => {
    expect(GEOMETRIC_EPSILON.toString()).toBe("0.01");
  });
});

describe("isGeometricallyEqual", () => {
  it.each([
    ["0", true],
    ["0.009", true],
    ["0.010", true],
    ["0.011", false],
  ])("treats a difference of %s as equal: %s", (difference, expected) => {
    expect(
      isGeometricallyEqual(createDecimal("12.01"), createDecimal("12.01").plus(difference)),
    ).toBe(expected);
  });
});

describe("isLessThanOrEqualWithinTolerance", () => {
  it("accepts an ordinary less-than relation", () => {
    expect(isLessThanOrEqualWithinTolerance(createDecimal("2.33"), createDecimal("12.01"))).toBe(
      true,
    );
  });

  it("accepts a value greater by exactly EPSILON", () => {
    expect(isLessThanOrEqualWithinTolerance(createDecimal("12.01"), createDecimal("12.00"))).toBe(
      true,
    );
  });

  it("rejects a value immediately outside the tolerance", () => {
    expect(isLessThanOrEqualWithinTolerance(createDecimal("12.011"), createDecimal("12.00"))).toBe(
      false,
    );
  });
});

describe("isGreaterThanOrEqualWithinTolerance", () => {
  it("accepts an ordinary greater-than relation", () => {
    expect(isGreaterThanOrEqualWithinTolerance(createDecimal("12.01"), createDecimal("2.33"))).toBe(
      true,
    );
  });

  it("accepts a value smaller by exactly EPSILON", () => {
    expect(
      isGreaterThanOrEqualWithinTolerance(createDecimal("11.99"), createDecimal("12.00")),
    ).toBe(true);
  });

  it("rejects a value immediately outside the tolerance", () => {
    expect(
      isGreaterThanOrEqualWithinTolerance(createDecimal("11.989"), createDecimal("12.00")),
    ).toBe(false);
  });
});
