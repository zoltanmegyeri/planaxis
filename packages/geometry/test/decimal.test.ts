import { Decimal as SharedDecimal } from "decimal.js";
import { describe, expect, expectTypeOf, it } from "vitest";

import { createDecimal } from "../src/index.js";

describe("createDecimal", () => {
  it("accepts lexical strings as its authoritative input contract", () => {
    expectTypeOf(createDecimal).parameter(0).toEqualTypeOf<string>();
  });

  it("constructs lexical decimal values without a binary floating-point round trip", () => {
    const oneTenth = createDecimal("0.1");
    const twoTenths = createDecimal("0.2");

    expect(oneTenth.plus(twoTenths).toString()).toBe("0.3");
    expect(createDecimal("2.33").plus(createDecimal("12.01")).toString()).toBe("14.34");
  });

  it("uses the project-owned calculation precision", () => {
    const largeValue = createDecimal("123456789012345678901234567890.1");

    expect(largeValue.plus(createDecimal("0.2")).toFixed(1)).toBe(
      "123456789012345678901234567890.3",
    );
  });

  it("is isolated from configuration changes to the shared decimal.js constructor", () => {
    const previousPrecision = SharedDecimal.precision;

    try {
      SharedDecimal.set({ precision: 1 });

      expect(createDecimal("2.33").plus(createDecimal("12.01")).toString()).toBe("14.34");
    } finally {
      SharedDecimal.set({ precision: previousPrecision });
    }
  });
});
