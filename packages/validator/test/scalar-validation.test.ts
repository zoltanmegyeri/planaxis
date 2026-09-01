import { describe, expect, it } from "vitest";

import {
  isApartmentSvgNumberLexeme,
  validateApartmentSvgAngle360,
  validateApartmentSvgBoolean,
  validateApartmentSvgElevationMeters,
  validateApartmentSvgId,
  validateApartmentSvgLatitude,
  validateApartmentSvgLongitude,
  validateApartmentSvgNonNegativeNumber,
  validateApartmentSvgNumber,
  validateApartmentSvgPitchAngle,
  validateApartmentSvgPositiveNumber,
  validateApartmentSvgTimeZoneId,
} from "../src/index.js";

describe("Apartment SVG scalar validation", () => {
  it.each(["wall-living-left", "window-01", "camera.main", "A", "a_b-c.d9"])(
    "accepts the valid Id %s",
    (value) => {
      expect(validateApartmentSvgId(value)).toEqual({ valid: true, value });
    },
  );

  it.each(["", "1wall", "-wall", "wall space", "élement"])("rejects the invalid Id %s", (value) => {
    expect(validateApartmentSvgId(value)).toMatchObject({
      valid: false,
      reason: "invalid-lexical-form",
      actual: value,
    });
  });

  it.each(["0", "-0", "0.1", "12.01", "-42.75"])(
    "accepts the Apartment SVG Number %s without changing its exact value",
    (value) => {
      const result = validateApartmentSvgNumber(value);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.value.toString()).toBe(value === "-0" ? "0" : value);
      }
      expect(isApartmentSvgNumberLexeme(value)).toBe(true);
    },
  );

  it.each(["1e3", "1E3", "NaN", "Infinity", "12cm", "+1", ".5", "1."])(
    "rejects the nonconforming Number lexeme %s",
    (value) => {
      expect(validateApartmentSvgNumber(value)).toMatchObject({
        valid: false,
        reason: "invalid-lexical-form",
        actual: value,
      });
      expect(isApartmentSvgNumberLexeme(value)).toBe(false);
    },
  );

  it("does not impose an arbitrary digit limit on Number", () => {
    const value = `${"9".repeat(5000)}.${"0".repeat(5000)}1`;
    const result = validateApartmentSvgNumber(value);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value.toFixed(5001)).toBe(value);
    }
  });

  it.each(["0.0001", "1", "999999999999999999999999999999"])(
    "accepts the PositiveNumber %s",
    (value) => {
      expect(validateApartmentSvgPositiveNumber(value).valid).toBe(true);
    },
  );

  it.each(["0", "-0", "-0.0001"])("rejects the non-positive value %s", (value) => {
    expect(validateApartmentSvgPositiveNumber(value)).toMatchObject({
      valid: false,
      reason: "out-of-range",
    });
  });

  it.each(["0", "-0", "0.0001"])("accepts the NonNegativeNumber %s", (value) => {
    expect(validateApartmentSvgNonNegativeNumber(value).valid).toBe(true);
  });

  it("rejects a negative NonNegativeNumber", () => {
    expect(validateApartmentSvgNonNegativeNumber("-0.0001")).toMatchObject({
      valid: false,
      reason: "out-of-range",
    });
  });

  it.each(["0", "359.999999999999999999999999999999999999"])(
    "accepts the Angle360 boundary value %s",
    (value) => {
      expect(validateApartmentSvgAngle360(value).valid).toBe(true);
    },
  );

  it.each(["-0.0001", "360"])("rejects the out-of-range Angle360 %s", (value) => {
    expect(validateApartmentSvgAngle360(value)).toMatchObject({
      valid: false,
      reason: "out-of-range",
    });
  });

  it.each(["-89.999", "0", "89.999"])("accepts the PitchAngle %s", (value) => {
    expect(validateApartmentSvgPitchAngle(value).valid).toBe(true);
  });

  it.each(["-90", "90"])("rejects the exclusive PitchAngle boundary %s", (value) => {
    expect(validateApartmentSvgPitchAngle(value)).toMatchObject({
      valid: false,
      reason: "out-of-range",
    });
  });

  it.each(["-90", "0", "90"])("accepts the Latitude boundary value %s", (value) => {
    expect(validateApartmentSvgLatitude(value).valid).toBe(true);
  });

  it.each(["-90.0001", "90.0001"])("rejects the out-of-range Latitude %s", (value) => {
    expect(validateApartmentSvgLatitude(value)).toMatchObject({
      valid: false,
      reason: "out-of-range",
    });
  });

  it.each(["-180", "0", "180"])("accepts the Longitude boundary value %s", (value) => {
    expect(validateApartmentSvgLongitude(value).valid).toBe(true);
  });

  it.each(["-180.0001", "180.0001"])("rejects the out-of-range Longitude %s", (value) => {
    expect(validateApartmentSvgLongitude(value)).toMatchObject({
      valid: false,
      reason: "out-of-range",
    });
  });

  it("accepts negative and positive ElevationMeters values as Numbers", () => {
    expect(validateApartmentSvgElevationMeters("-430.25").valid).toBe(true);
    expect(validateApartmentSvgElevationMeters("8848.86").valid).toBe(true);
    expect(validateApartmentSvgElevationMeters("1e3").valid).toBe(false);
  });

  it("accepts only the two exact Boolean spellings", () => {
    expect(validateApartmentSvgBoolean("true")).toEqual({ valid: true, value: true });
    expect(validateApartmentSvgBoolean("false")).toEqual({ valid: true, value: false });

    for (const value of ["True", "FALSE", "1", "0", "yes", ""]) {
      expect(validateApartmentSvgBoolean(value).valid).toBe(false);
    }
  });

  it.each(["Europe/Budapest", "America/New_York", "Asia/Tokyo", "Etc/UTC", "US/Eastern"])(
    "accepts the offline IANA TimeZoneId %s",
    (value) => {
      expect(validateApartmentSvgTimeZoneId(value)).toEqual({ valid: true, value });
    },
  );

  it.each(["", "+02:00", "UTC+2", "Europe/Definitely-Unknown"])(
    "rejects the invalid TimeZoneId %s",
    (value) => {
      expect(validateApartmentSvgTimeZoneId(value).valid).toBe(false);
    },
  );
});
