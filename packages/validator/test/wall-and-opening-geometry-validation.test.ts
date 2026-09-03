import { parseApartmentSvg } from "@planaxis/parser";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  APARTMENT_SVG_VALIDATION_CODES,
  validateApartmentSvgReferences,
  validateApartmentSvgSchema,
  validateApartmentSvgWallAndOpeningGeometry,
} from "../src/index.js";
import type {
  ApartmentSvgValidationCode,
  ApartmentSvgWallAndOpeningGeometryValidationResult,
  ReferenceValidApartmentSvgDocument,
} from "../src/index.js";

const SVG_NAMESPACE_URI = "http://www.w3.org/2000/svg";
const GROUP_IDS = [
  "spaces",
  "walls",
  "windows",
  "doors",
  "fixed-elements",
  "utilities",
  "cameras",
  "annotations",
] as const;
type GroupId = (typeof GROUP_IDS)[number];
type AttributeOverrides = Readonly<Record<string, string | null>>;

describe("validateApartmentSvgWallAndOpeningGeometry public contract", () => {
  it("consumes reference-valid input and preserves it unchanged on success", () => {
    expectTypeOf(validateApartmentSvgWallAndOpeningGeometry)
      .parameter(0)
      .toEqualTypeOf<ReferenceValidApartmentSvgDocument>();
    expectTypeOf(
      validateApartmentSvgWallAndOpeningGeometry,
    ).returns.toEqualTypeOf<ApartmentSvgWallAndOpeningGeometryValidationResult>();
    const document = referenceValidDocument(
      createSvg({
        walls: horizontalWall(),
        windows: horizontalWindow(),
        doors: horizontalDoor(),
      }),
    );

    const result = validateApartmentSvgWallAndOpeningGeometry(document);

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.document).toBe(document);
    expect(result.errors).toEqual([]);
    expect(Object.isFrozen(result)).toBe(true);
  });
});

describe("wall axis geometry", () => {
  it("accepts horizontal and vertical walls with consistent dimensions", () => {
    const result = validateGeometry(
      createSvg({
        walls: [horizontalWall(), verticalWall()].join(""),
      }),
    );

    expect(result.valid).toBe(true);
  });

  it("rejects reversed and square dimensions for both wall axes", () => {
    const result = validateGeometry(
      createSvg({
        walls: [
          horizontalWall({ id: "wall-x-reversed", width: "10", height: "20" }),
          horizontalWall({ id: "wall-x-square", width: "10", height: "10" }),
          verticalWall({ id: "wall-y-reversed", width: "20", height: "10" }),
          verticalWall({ id: "wall-y-square", width: "10", height: "10" }),
        ].join(""),
      }),
    );

    expect(
      errorIdsForCode(result, APARTMENT_SVG_VALIDATION_CODES.wall.invalidAxisGeometry),
    ).toEqual(["wall-x-reversed", "wall-x-square", "wall-y-reversed", "wall-y-square"]);
    expect(result.errors[0]).toEqual(
      expect.objectContaining({
        category: "wall",
        rule: "wall.axis-geometry",
        attribute: "data-axis",
        actual: expect.any(String),
        expected: expect.any(String),
      }),
    );
  });
});

describe("window geometry", () => {
  it("accepts horizontal and vertical windows that cover and stay within their walls", () => {
    const result = validateGeometry(
      createSvg({
        walls: [horizontalWall(), verticalWall()].join(""),
        windows: [
          horizontalWindow({ x: "10", width: "100" }),
          verticalWindow({ y: "20", height: "100" }),
        ].join(""),
      }),
    );

    expect(result.valid).toBe(true);
  });

  it.each([
    {
      name: "horizontal wall",
      wall: horizontalWall(),
      window: horizontalWindow({ y: "20.011" }),
    },
    {
      name: "vertical wall",
      wall: verticalWall(),
      window: verticalWindow({ width: "10.011" }),
    },
  ])("rejects invalid wall-thickness coverage on a $name", ({ wall, window }) => {
    const result = validateGeometry(createSvg({ walls: wall, windows: window }));

    expectSingleError(result, APARTMENT_SVG_VALIDATION_CODES.window.invalidWallThicknessCoverage);
  });

  it.each([
    {
      name: "horizontal wall",
      wall: horizontalWall(),
      window: horizontalWindow({ x: "9.999" }),
    },
    {
      name: "vertical wall",
      wall: verticalWall(),
      window: verticalWindow({ y: "119.999", height: "10.002" }),
    },
  ])("rejects a window outside a $name longitudinal extent", ({ wall, window }) => {
    const result = validateGeometry(createSvg({ walls: wall, windows: window }));

    expectSingleError(result, APARTMENT_SVG_VALIDATION_CODES.window.outsideWallLongitudinalExtent);
  });

  it("uses the metadata ceiling height when the wall has no explicit height", () => {
    const validResult = validateGeometry(
      createSvg({
        walls: horizontalWall(),
        windows: horizontalWindow({ "data-sill-height": "100", "data-opening-height": "142" }),
      }),
    );
    const invalidResult = validateGeometry(
      createSvg({
        walls: horizontalWall(),
        windows: horizontalWindow({ "data-sill-height": "100", "data-opening-height": "142.001" }),
      }),
    );

    expect(validResult.valid).toBe(true);
    expectSingleError(invalidResult, APARTMENT_SVG_VALIDATION_CODES.window.exceedsWallHeight);
  });

  it("uses an explicit wall height for the window vertical extent", () => {
    const result = validateGeometry(
      createSvg({
        walls: horizontalWall({ "data-height": "200" }),
        windows: horizontalWindow({ "data-sill-height": "80", "data-opening-height": "120.001" }),
      }),
    );

    expectSingleError(result, APARTMENT_SVG_VALIDATION_CODES.window.exceedsWallHeight);
  });

  it.each([
    {
      name: "horizontal window",
      wall: horizontalWall(),
      accepted: horizontalWindow({ y: "20.01", height: "10.01" }),
      rejected: horizontalWindow({ y: "20.011" }),
    },
    {
      name: "vertical window",
      wall: verticalWall(),
      accepted: verticalWindow({ x: "10.01", width: "10.01" }),
      rejected: verticalWindow({ x: "10.011" }),
    },
  ])(
    "accepts exact EPSILON and rejects a value outside it for a $name",
    ({ wall, accepted, rejected }) => {
      const acceptedResult = validateGeometry(createSvg({ walls: wall, windows: accepted }));
      const rejectedResult = validateGeometry(createSvg({ walls: wall, windows: rejected }));

      expect(acceptedResult.valid).toBe(true);
      expectSingleError(
        rejectedResult,
        APARTMENT_SVG_VALIDATION_CODES.window.invalidWallThicknessCoverage,
      );
    },
  );
});

describe("door opening geometry", () => {
  it("accepts horizontal and vertical sliding or opening-only doors", () => {
    const result = validateGeometry(
      createSvg({
        walls: [horizontalWall(), verticalWall()].join(""),
        doors: [
          horizontalDoor({ x: "10", width: "100" }),
          verticalDoor({ y: "20", height: "100", "data-door-type": "sliding" }),
        ].join(""),
      }),
    );

    expect(result.valid).toBe(true);
  });

  it.each([
    {
      name: "horizontal wall",
      wall: horizontalWall(),
      door: horizontalDoor({ height: "9.989" }),
    },
    {
      name: "vertical wall",
      wall: verticalWall(),
      door: verticalDoor({ x: "9.989" }),
    },
  ])("rejects invalid door thickness coverage on a $name", ({ wall, door }) => {
    const result = validateGeometry(createSvg({ walls: wall, doors: door }));

    expectSingleError(result, APARTMENT_SVG_VALIDATION_CODES.door.invalidWallThicknessCoverage);
  });

  it.each([
    {
      name: "horizontal wall",
      wall: horizontalWall(),
      door: horizontalDoor({ x: "100", width: "10.001" }),
    },
    {
      name: "vertical wall",
      wall: verticalWall(),
      door: verticalDoor({ y: "19.999" }),
    },
  ])("rejects a door outside a $name longitudinal extent", ({ wall, door }) => {
    const result = validateGeometry(createSvg({ walls: wall, doors: door }));

    expectSingleError(result, APARTMENT_SVG_VALIDATION_CODES.door.outsideWallLongitudinalExtent);
  });

  it("validates door height against default and explicit wall heights", () => {
    const defaultHeightValidResult = validateGeometry(
      createSvg({
        walls: horizontalWall(),
        doors: horizontalDoor({ "data-opening-height": "242" }),
      }),
    );
    const defaultHeightInvalidResult = validateGeometry(
      createSvg({
        walls: horizontalWall(),
        doors: horizontalDoor({ "data-opening-height": "242.001" }),
      }),
    );
    const explicitHeightValidResult = validateGeometry(
      createSvg({
        walls: verticalWall({ "data-height": "200" }),
        doors: verticalDoor({ "data-opening-height": "200" }),
      }),
    );
    const explicitHeightInvalidResult = validateGeometry(
      createSvg({
        walls: verticalWall({ "data-height": "200" }),
        doors: verticalDoor({ "data-opening-height": "200.001" }),
      }),
    );

    expect(defaultHeightValidResult.valid).toBe(true);
    expect(explicitHeightValidResult.valid).toBe(true);
    expectSingleError(
      defaultHeightInvalidResult,
      APARTMENT_SVG_VALIDATION_CODES.door.exceedsWallHeight,
    );
    expectSingleError(
      explicitHeightInvalidResult,
      APARTMENT_SVG_VALIDATION_CODES.door.exceedsWallHeight,
    );
  });

  it.each([
    {
      name: "horizontal door",
      wall: horizontalWall(),
      accepted: horizontalDoor({ y: "20.01", height: "10.01" }),
      rejected: horizontalDoor({ height: "10.011" }),
    },
    {
      name: "vertical door",
      wall: verticalWall(),
      accepted: verticalDoor({ x: "10.01", width: "10.01" }),
      rejected: verticalDoor({ width: "10.011" }),
    },
  ])(
    "accepts exact EPSILON and rejects a value outside it for a $name",
    ({ wall, accepted, rejected }) => {
      const acceptedResult = validateGeometry(createSvg({ walls: wall, doors: accepted }));
      const rejectedResult = validateGeometry(createSvg({ walls: wall, doors: rejected }));

      expect(acceptedResult.valid).toBe(true);
      expectSingleError(
        rejectedResult,
        APARTMENT_SVG_VALIDATION_CODES.door.invalidWallThicknessCoverage,
      );
    },
  );
});

describe("hinged-door geometry", () => {
  it.each([
    [
      "horizontal left hinge, negative side",
      horizontalWall(),
      horizontalHingedDoor({
        "data-hinge-x": "20",
        "data-open-leaf-x": "20",
        "data-open-leaf-y": "-5",
      }),
    ],
    [
      "horizontal left hinge, positive side",
      horizontalWall(),
      horizontalHingedDoor({
        "data-hinge-x": "20",
        "data-open-leaf-x": "20",
        "data-open-leaf-y": "55",
      }),
    ],
    [
      "horizontal right hinge, negative side",
      horizontalWall(),
      horizontalHingedDoor({
        "data-hinge-x": "50",
        "data-open-leaf-x": "50",
        "data-open-leaf-y": "-5",
      }),
    ],
    [
      "horizontal right hinge, positive side",
      horizontalWall(),
      horizontalHingedDoor({
        "data-hinge-x": "50",
        "data-open-leaf-x": "50",
        "data-open-leaf-y": "55",
      }),
    ],
    [
      "vertical top hinge, negative side",
      verticalWall(),
      verticalHingedDoor({
        "data-hinge-y": "30",
        "data-open-leaf-x": "-15",
        "data-open-leaf-y": "30",
      }),
    ],
    [
      "vertical top hinge, positive side",
      verticalWall(),
      verticalHingedDoor({
        "data-hinge-y": "30",
        "data-open-leaf-x": "45",
        "data-open-leaf-y": "30",
      }),
    ],
    [
      "vertical bottom hinge, negative side",
      verticalWall(),
      verticalHingedDoor({
        "data-hinge-y": "60",
        "data-open-leaf-x": "-15",
        "data-open-leaf-y": "60",
      }),
    ],
    [
      "vertical bottom hinge, positive side",
      verticalWall(),
      verticalHingedDoor({
        "data-hinge-y": "60",
        "data-open-leaf-x": "45",
        "data-open-leaf-y": "60",
      }),
    ],
  ])("accepts the legal %s", (_name, wall, door) => {
    const result = validateGeometry(createSvg({ walls: wall, doors: door }));

    expect(result.valid).toBe(true);
  });

  it.each([
    [
      "off the wall centerline",
      horizontalHingedDoor({ "data-hinge-y": "26", "data-open-leaf-y": "56" }),
    ],
    [
      "between opening endpoints",
      horizontalHingedDoor({
        "data-hinge-x": "30",
        "data-open-leaf-x": "30",
        "data-open-leaf-y": "55",
      }),
    ],
  ])("rejects a hinge %s", (_name, door) => {
    const result = validateGeometry(createSvg({ walls: horizontalWall(), doors: door }));

    expectSingleError(result, APARTMENT_SVG_VALIDATION_CODES.door.invalidHingePoint);
  });

  it.each([
    ["with the wrong length", horizontalHingedDoor({ "data-open-leaf-y": "54" })],
    ["that is not perpendicular", horizontalHingedDoor({ "data-open-leaf-x": "21" })],
  ])("rejects an open-leaf point %s", (_name, door) => {
    const result = validateGeometry(createSvg({ walls: horizontalWall(), doors: door }));

    expectSingleError(result, APARTMENT_SVG_VALIDATION_CODES.door.invalidOpenLeafPoint);
  });

  it("applies EPSILON to hinge endpoint and centerline coordinates", () => {
    const accepted = horizontalHingedDoor({
      "data-hinge-x": "20.01",
      "data-hinge-y": "25.01",
      "data-open-leaf-x": "20.01",
      "data-open-leaf-y": "55.01",
    });
    const rejected = horizontalHingedDoor({
      "data-hinge-x": "20.011",
      "data-open-leaf-x": "20.011",
      "data-open-leaf-y": "55",
    });

    expect(validateGeometry(createSvg({ walls: horizontalWall(), doors: accepted })).valid).toBe(
      true,
    );
    expectSingleError(
      validateGeometry(createSvg({ walls: horizontalWall(), doors: rejected })),
      APARTMENT_SVG_VALIDATION_CODES.door.invalidHingePoint,
    );
  });

  it("applies EPSILON to open-leaf perpendicularity and length", () => {
    const accepted = horizontalHingedDoor({
      "data-open-leaf-x": "20.01",
      "data-open-leaf-y": "55.01",
    });
    const invalidOrientation = horizontalHingedDoor({ "data-open-leaf-x": "20.011" });
    const invalidLength = horizontalHingedDoor({ "data-open-leaf-y": "55.011" });

    expect(validateGeometry(createSvg({ walls: horizontalWall(), doors: accepted })).valid).toBe(
      true,
    );
    expectSingleError(
      validateGeometry(createSvg({ walls: horizontalWall(), doors: invalidOrientation })),
      APARTMENT_SVG_VALIDATION_CODES.door.invalidOpenLeafPoint,
    );
    expectSingleError(
      validateGeometry(createSvg({ walls: horizontalWall(), doors: invalidLength })),
      APARTMENT_SVG_VALIDATION_CODES.door.invalidOpenLeafPoint,
    );
  });
});

describe("wall-and-opening validation stage boundary", () => {
  it("ignores deferred topology, overlap, placement, and collision invalidity", () => {
    const result = validateGeometry(
      createSvg({
        spaces: space({ points: "0,0 1,1" }),
        walls: horizontalWall(),
        windows: [
          horizontalWindow({ id: "window-1", x: "20", width: "40" }),
          horizontalWindow({ id: "window-2", x: "30", width: "40" }),
        ].join(""),
        doors: horizontalDoor({ x: "40", width: "30" }),
        "fixed-elements": fixedElement("radiator", { "data-wall": "wall-x", x: "500" }),
        utilities: utility("socket", { cx: "500", cy: "500" }),
        cameras: camera({ cx: "510", cy: "15", "data-z": "50" }),
      }),
    );

    expect(result.valid).toBe(true);
  });
});

function validateGeometry(source: string): ApartmentSvgWallAndOpeningGeometryValidationResult {
  return validateApartmentSvgWallAndOpeningGeometry(referenceValidDocument(source));
}

function referenceValidDocument(source: string): ReferenceValidApartmentSvgDocument {
  const parsed = parseApartmentSvg(source);
  if (!parsed.ok) {
    throw new Error(`Expected XML parsing to succeed: ${parsed.error.message}`);
  }
  const schemaResult = validateApartmentSvgSchema(parsed.document);
  if (!schemaResult.valid) {
    throw new Error(
      `Expected schema validation to succeed: ${JSON.stringify(schemaResult.errors)}`,
    );
  }
  const referenceResult = validateApartmentSvgReferences(schemaResult.document);
  if (!referenceResult.valid) {
    throw new Error(
      `Expected reference validation to succeed: ${JSON.stringify(referenceResult.errors)}`,
    );
  }
  return referenceResult.document;
}

function expectSingleError(
  result: ApartmentSvgWallAndOpeningGeometryValidationResult,
  code: ApartmentSvgValidationCode,
): void {
  expect(result.valid).toBe(false);
  expect(result.errors).toHaveLength(1);
  expect(result.errors[0]).toEqual(
    expect.objectContaining({
      code,
      elementId: expect.any(String),
      rule: expect.any(String),
      actual: expect.any(String),
      expected: expect.any(String),
    }),
  );
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.errors)).toBe(true);
  expect(Object.isFrozen(result.errors[0])).toBe(true);
  expect("document" in result).toBe(false);
}

function errorIdsForCode(
  result: ApartmentSvgWallAndOpeningGeometryValidationResult,
  code: ApartmentSvgValidationCode,
): string[] {
  return result.errors
    .filter((error) => error.code === code)
    .map((error) => error.elementId)
    .filter((elementId): elementId is string => elementId !== undefined);
}

function createSvg(contents: Partial<Record<GroupId, string>> = {}): string {
  const groups = GROUP_IDS.map((id) => `<g id="${id}">${contents[id] ?? ""}</g>`).join("\n");
  return `<svg xmlns="${SVG_NAMESPACE_URI}" viewBox="-500 -500 2000 2000" data-schema="apartment-svg" data-schema-version="2.1" data-unit="cm">
    <metadata><![CDATA[${JSON.stringify(minimumMetadata())}]]></metadata>
    ${groups}
  </svg>`;
}

function horizontalWall(overrides: AttributeOverrides = {}): string {
  return tag("rect", {
    id: "wall-x",
    x: "10",
    y: "20",
    width: "100",
    height: "10",
    "data-kind": "wall",
    "data-axis": "x",
    "data-class": "interior",
    "data-status": "fixed",
    ...overrides,
  });
}

function verticalWall(overrides: AttributeOverrides = {}): string {
  return tag("rect", {
    id: "wall-y",
    x: "10",
    y: "20",
    width: "10",
    height: "100",
    "data-kind": "wall",
    "data-axis": "y",
    "data-class": "interior",
    "data-status": "fixed",
    ...overrides,
  });
}

function horizontalWindow(overrides: AttributeOverrides = {}): string {
  return tag("rect", {
    id: "window-x",
    x: "20",
    y: "20",
    width: "30",
    height: "10",
    "data-kind": "window",
    "data-wall": "wall-x",
    "data-sill-height": "100",
    "data-opening-height": "100",
    "data-status": "fixed",
    ...overrides,
  });
}

function verticalWindow(overrides: AttributeOverrides = {}): string {
  return tag("rect", {
    id: "window-y",
    x: "10",
    y: "30",
    width: "10",
    height: "30",
    "data-kind": "window",
    "data-wall": "wall-y",
    "data-sill-height": "100",
    "data-opening-height": "100",
    "data-status": "fixed",
    ...overrides,
  });
}

function horizontalDoor(overrides: AttributeOverrides = {}): string {
  return tag("rect", {
    id: "door-x",
    x: "20",
    y: "20",
    width: "30",
    height: "10",
    "data-kind": "door",
    "data-wall": "wall-x",
    "data-door-type": "opening-only",
    "data-opening-height": "210",
    "data-status": "fixed",
    ...overrides,
  });
}

function verticalDoor(overrides: AttributeOverrides = {}): string {
  return tag("rect", {
    id: "door-y",
    x: "10",
    y: "30",
    width: "10",
    height: "30",
    "data-kind": "door",
    "data-wall": "wall-y",
    "data-door-type": "opening-only",
    "data-opening-height": "210",
    "data-status": "fixed",
    ...overrides,
  });
}

function horizontalHingedDoor(overrides: AttributeOverrides = {}): string {
  return horizontalDoor({
    "data-door-type": "hinged",
    "data-hinge-x": "20",
    "data-hinge-y": "25",
    "data-open-leaf-x": "20",
    "data-open-leaf-y": "55",
    ...overrides,
  });
}

function verticalHingedDoor(overrides: AttributeOverrides = {}): string {
  return verticalDoor({
    "data-door-type": "hinged",
    "data-hinge-x": "15",
    "data-hinge-y": "30",
    "data-open-leaf-x": "45",
    "data-open-leaf-y": "30",
    ...overrides,
  });
}

function space(overrides: AttributeOverrides = {}): string {
  return tag("polygon", {
    id: "space-1",
    points: "0,0 100,0 100,100 0,100",
    "data-kind": "zone",
    "data-name": "Living room",
    "data-function": "living-room",
    "data-enclosure": "closed",
    ...overrides,
  });
}

function fixedElement(kind: string, overrides: AttributeOverrides = {}): string {
  return tag("rect", {
    id: "fixed-1",
    x: "10",
    y: "10",
    width: "40",
    height: "20",
    "data-kind": kind,
    "data-base-z": "0",
    "data-height": "100",
    "data-status": "fixed",
    ...overrides,
  });
}

function utility(kind: string, overrides: AttributeOverrides = {}): string {
  return tag("circle", {
    id: "utility-1",
    cx: "10",
    cy: "10",
    r: "2",
    "data-kind": kind,
    "data-z": "30",
    "data-wall": "wall-x",
    ...overrides,
  });
}

function camera(overrides: AttributeOverrides = {}): string {
  return tag("circle", {
    id: "camera-1",
    cx: "50",
    cy: "50",
    r: "4",
    "data-kind": "camera",
    "data-z": "160",
    "data-heading": "270",
    "data-pitch": "0",
    "data-horizontal-fov": "70",
    ...overrides,
  });
}

function tag(name: string, attributes: AttributeOverrides): string {
  const markup = Object.entries(attributes)
    .filter((entry): entry is [string, string] => entry[1] !== null)
    .map(([attribute, value]) => `${attribute}="${value}"`)
    .join(" ");
  return `<${name} ${markup} />`;
}

function minimumMetadata(): Record<string, unknown> {
  return {
    schema: "apartment-svg/2.1",
    project: { name: "Geometry validation test", units: "cm" },
    coordinateSystem: {
      x: "right",
      y: "down",
      z: "up",
      headingDegrees: { 0: "+x", 90: "+y", 180: "-x", 270: "-y" },
    },
    level: { id: "level-0", baseZ: 0, defaultCeilingHeight: 242 },
  };
}
