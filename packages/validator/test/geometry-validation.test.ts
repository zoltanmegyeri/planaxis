import { parseApartmentSvg } from "@planaxis/parser";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  APARTMENT_SVG_VALIDATION_CODES,
  validateApartmentSvgGeometry,
  validateApartmentSvgReferences,
  validateApartmentSvgSchema,
} from "../src/index.js";
import type {
  ApartmentSvgGeometryValidationResult,
  ApartmentSvgValidationCode,
  GeometryValidApartmentSvgDocument,
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

describe("validateApartmentSvgGeometry public contract", () => {
  it("consumes reference-valid input and returns the branded final trust boundary", () => {
    expectTypeOf(validateApartmentSvgGeometry)
      .parameter(0)
      .toEqualTypeOf<ReferenceValidApartmentSvgDocument>();
    expectTypeOf(
      validateApartmentSvgGeometry,
    ).returns.toEqualTypeOf<ApartmentSvgGeometryValidationResult>();
    expectTypeOf<ReferenceValidApartmentSvgDocument>().not.toExtend<GeometryValidApartmentSvgDocument>();

    const document = referenceValidDocument(createSvg({ walls: horizontalWall() }));
    const result = validateApartmentSvgGeometry(document);

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expectTypeOf(result.document).toEqualTypeOf<GeometryValidApartmentSvgDocument>();
    expect(result.document).toBe(document);
    expect(result.errors).toEqual([]);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("returns wall/opening errors alone before dependent later checks", () => {
    const result = validateGeometry(
      createSvg({
        spaces: zone({ points: "0,0 1,1" }),
        walls: horizontalWall({ width: "10", height: "10" }),
      }),
    );

    expect(errorCodes(result)).toEqual([APARTMENT_SVG_VALIDATION_CODES.wall.invalidAxisGeometry]);
  });
});

describe("zone topology", () => {
  it("accepts a valid polygon and a repeated closing vertex", () => {
    const result = validateGeometry(
      createSvg({ spaces: zone({ points: "10,10 100,10 100,100 10,100 10,10" }) }),
    );

    expect(result.valid).toBe(true);
  });

  it("rejects fewer than three geometrically distinct vertices", () => {
    const result = validateGeometry(
      createSvg({ spaces: zone({ points: "10,10 10.009,10.009 100,100" }) }),
    );

    expect(errorCodes(result)).toContain(
      APARTMENT_SVG_VALIDATION_CODES.zone.insufficientDistinctVertices,
    );
  });

  it("rejects zero-area and self-intersecting polygons", () => {
    const zeroAreaResult = validateGeometry(
      createSvg({ spaces: zone({ points: "10,10 50,50 100,100" }) }),
    );
    const selfIntersectionResult = validateGeometry(
      createSvg({ spaces: zone({ points: "10,10 100,100 10,100 100,10" }) }),
    );

    expect(errorCodes(zeroAreaResult)).toContain(
      APARTMENT_SVG_VALIDATION_CODES.zone.nonPositiveArea,
    );
    expect(errorCodes(selfIntersectionResult)).toContain(
      APARTMENT_SVG_VALIDATION_CODES.zone.selfIntersection,
    );
  });

  it("allows shared zone boundaries and rejects positive-area overlap", () => {
    const sharedBoundaryResult = validateGeometry(
      createSvg({
        spaces: [
          zone({ id: "zone-left", points: "10,10 100,10 100,100 10,100" }),
          zone({ id: "zone-right", points: "100,10 190,10 190,100 100,100" }),
        ].join(""),
      }),
    );
    const overlapResult = validateGeometry(
      createSvg({
        spaces: [
          zone({ id: "zone-left", points: "10,10 100,10 100,100 10,100" }),
          zone({ id: "zone-right", points: "99.999,10 190,10 190,100 99.999,100" }),
        ].join(""),
      }),
    );

    expect(sharedBoundaryResult.valid).toBe(true);
    expectSingleError(overlapResult, APARTMENT_SVG_VALIDATION_CODES.zone.overlapsZone);
  });

  it("allows zone/wall boundary contact and rejects interior overlap", () => {
    const boundaryResult = validateGeometry(
      createSvg({
        spaces: zone({ points: "50,110 450,110 450,400 50,400" }),
        walls: horizontalWall(),
      }),
    );
    const overlapResult = validateGeometry(
      createSvg({
        spaces: zone({ points: "50,109.999 450,109.999 450,400 50,400" }),
        walls: horizontalWall(),
      }),
    );

    expect(boundaryResult.valid).toBe(true);
    expectSingleError(overlapResult, APARTMENT_SVG_VALIDATION_CODES.zone.overlapsWall);
  });
});

describe("semantic viewBox containment", () => {
  it("accepts core semantic points and footprints exactly on every boundary", () => {
    const result = validateGeometry(
      createSvg({
        spaces: zone({ points: "0,0 500,0 500,50 0,50" }),
        walls: horizontalWall({ x: "0", y: "100", width: "500" }),
        "fixed-elements": fixedElement("column", { x: "490", y: "490", width: "10", height: "10" }),
        utilities: utility("ceiling-light", { cx: "0", cy: "500", "data-wall": null }),
        cameras: camera({ cx: "500", cy: "0" }),
      }),
    );

    expect(result.valid).toBe(true);
  });

  it("rejects zone, rectangle, utility, camera, and hinged-door points outside the boundary", () => {
    const result = validateGeometry(
      createSvg({
        spaces: zone({ points: "-0.001,0 50,0 50,50 0,50" }),
        walls: [
          horizontalWall(),
          horizontalWall({ id: "wall-outside", x: "-0.001", y: "200" }),
        ].join(""),
        windows: windowElement({
          id: "window-outside",
          x: "-0.001",
          y: "200",
          "data-wall": "wall-outside",
        }),
        doors: hingedDoor({
          x: "200",
          width: "105.001",
          "data-hinge-x": "200",
          "data-open-leaf-x": "200",
          "data-open-leaf-y": "-0.001",
        }),
        "fixed-elements": fixedElement("column", { x: "490.001", y: "490" }),
        utilities: utility("ceiling-light", { cx: "500.001", "data-wall": null }),
        cameras: camera({ cy: "500.001" }),
      }),
    );

    expect(
      errorIdsForCode(result, APARTMENT_SVG_VALIDATION_CODES.root.semanticGeometryOutsideViewBox),
    ).toEqual([
      "zone-1",
      "wall-outside",
      "window-outside",
      "fixed-1",
      "utility-1",
      "camera-1",
      "door-1",
    ]);
  });
});

describe("wall-associated utility placement", () => {
  it("accepts a utility on the supporting wall boundary and ignores marker radius", () => {
    const result = validateGeometry(
      createSvg({
        walls: horizontalWall(),
        utilities: utility("socket", { cx: "50", cy: "100", r: "100" }),
      }),
    );

    expect(result.valid).toBe(true);
  });

  it("rejects a semantic utility point outside its already resolved wall", () => {
    const result = validateGeometry(
      createSvg({
        walls: horizontalWall(),
        utilities: utility("socket", { cx: "49.999", cy: "100" }),
      }),
    );

    expectSingleError(result, APARTMENT_SVG_VALIDATION_CODES.utility.outsideSupportingWall);
  });
});

describe("camera collisions", () => {
  it.each([
    ["lower Z boundary", "0"],
    ["upper Z boundary", "242"],
  ])("rejects a camera inside a wall at the %s", (_name, z) => {
    const result = validateGeometry(
      createSvg({
        walls: horizontalWall(),
        cameras: camera({ cx: "50", cy: "100", "data-z": z, r: "0.001" }),
      }),
    );

    expectSingleError(result, APARTMENT_SVG_VALIDATION_CODES.camera.insideWall);
  });

  it("accepts cameras separated from a wall in either XY or Z regardless of marker radius", () => {
    const result = validateGeometry(
      createSvg({
        walls: horizontalWall(),
        cameras: [
          camera({ id: "camera-xy", cx: "49.999", cy: "100", r: "100" }),
          camera({ id: "camera-z", cx: "100", cy: "105", "data-z": "242.001" }),
        ].join(""),
      }),
    );

    expect(result.valid).toBe(true);
  });

  it.each([
    ["lower Z boundary", "50"],
    ["upper Z boundary", "150"],
  ])("rejects a camera inside a fixed element at the %s", (_name, z) => {
    const result = validateGeometry(
      createSvg({
        "fixed-elements": fixedElement("column", { "data-base-z": "50", "data-height": "100" }),
        cameras: camera({ cx: "320", cy: "320", "data-z": z }),
      }),
    );

    expectSingleError(result, APARTMENT_SVG_VALIDATION_CODES.camera.insideFixedElement);
  });

  it("accepts a camera whose XY is inside a fixed element but Z is outside", () => {
    const result = validateGeometry(
      createSvg({
        "fixed-elements": fixedElement("column", { "data-base-z": "50", "data-height": "100" }),
        cameras: camera({ cx: "320", cy: "320", "data-z": "150.001" }),
      }),
    );

    expect(result.valid).toBe(true);
  });
});

describe("global overlap restrictions", () => {
  it("allows wall/wall overlap", () => {
    const result = validateGeometry(
      createSvg({
        walls: [
          horizontalWall(),
          verticalWall({ id: "wall-crossing", x: "100", y: "50", height: "200" }),
        ].join(""),
      }),
    );

    expect(result.valid).toBe(true);
  });

  it("rejects a window that intersects a non-supporting wall", () => {
    const result = validateGeometry(
      createSvg({
        walls: [
          horizontalWall(),
          verticalWall({ id: "wall-crossing", x: "120", y: "50", height: "200" }),
        ].join(""),
        windows: windowElement({ x: "110", width: "40" }),
      }),
    );

    expectSingleError(result, APARTMENT_SVG_VALIDATION_CODES.window.intersectsNonSupportingWall);
  });

  it("rejects a door that intersects a non-supporting wall", () => {
    const result = validateGeometry(
      createSvg({
        walls: [
          horizontalWall(),
          verticalWall({ id: "wall-crossing", x: "220", y: "50", height: "200" }),
        ].join(""),
        doors: door({ x: "210", width: "40" }),
      }),
    );

    expectSingleError(result, APARTMENT_SVG_VALIDATION_CODES.door.intersectsNonSupportingWall);
  });

  it.each([
    {
      name: "windows",
      group: "windows" as const,
      first: windowElement({ id: "window-1", x: "100", width: "40" }),
      touching: windowElement({ id: "window-2", x: "140", width: "40" }),
      overlapping: windowElement({ id: "window-2", x: "139.999", width: "40" }),
      code: APARTMENT_SVG_VALIDATION_CODES.window.overlapsWindow,
    },
    {
      name: "doors",
      group: "doors" as const,
      first: door({ id: "door-1", x: "200", width: "40" }),
      touching: door({ id: "door-2", x: "240", width: "40" }),
      overlapping: door({ id: "door-2", x: "239.999", width: "40" }),
      code: APARTMENT_SVG_VALIDATION_CODES.door.overlapsDoor,
    },
  ])("allows boundary contact and rejects positive-area overlap between $name", (testCase) => {
    const touchingResult = validateGeometry(
      createSvg({ walls: horizontalWall(), [testCase.group]: testCase.first + testCase.touching }),
    );
    const overlappingResult = validateGeometry(
      createSvg({
        walls: horizontalWall(),
        [testCase.group]: testCase.first + testCase.overlapping,
      }),
    );

    expect(touchingResult.valid).toBe(true);
    expectSingleError(overlappingResult, testCase.code);
  });

  it("allows door/window boundary contact and rejects positive-area overlap", () => {
    const touchingResult = validateGeometry(
      createSvg({
        walls: horizontalWall(),
        windows: windowElement({ x: "100", width: "40" }),
        doors: door({ x: "140", width: "40" }),
      }),
    );
    const overlapResult = validateGeometry(
      createSvg({
        walls: horizontalWall(),
        windows: windowElement({ x: "100", width: "40" }),
        doors: door({ x: "139.999", width: "40" }),
      }),
    );

    expect(touchingResult.valid).toBe(true);
    expectSingleError(overlapResult, APARTMENT_SVG_VALIDATION_CODES.door.overlapsWindow);
  });
});

function validateGeometry(source: string): ApartmentSvgGeometryValidationResult {
  return validateApartmentSvgGeometry(referenceValidDocument(source));
}

function referenceValidDocument(source: string): ReferenceValidApartmentSvgDocument {
  const parsed = parseApartmentSvg(source);
  if (!parsed.ok) throw new Error(`Expected XML parsing to succeed: ${parsed.error.message}`);
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
  result: ApartmentSvgGeometryValidationResult,
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

function errorCodes(result: ApartmentSvgGeometryValidationResult): ApartmentSvgValidationCode[] {
  return result.errors.map((error) => error.code);
}

function errorIdsForCode(
  result: ApartmentSvgGeometryValidationResult,
  code: ApartmentSvgValidationCode,
): string[] {
  return result.errors
    .filter((error) => error.code === code)
    .map((error) => error.elementId)
    .filter((elementId): elementId is string => elementId !== undefined);
}

function createSvg(contents: Partial<Record<GroupId, string>> = {}): string {
  const groups = GROUP_IDS.map((id) => `<g id="${id}">${contents[id] ?? ""}</g>`).join("\n");
  return `<svg xmlns="${SVG_NAMESPACE_URI}" viewBox="0 0 500 500" data-schema="apartment-svg" data-schema-version="2.1" data-unit="cm">
    <metadata><![CDATA[${JSON.stringify(minimumMetadata())}]]></metadata>
    ${groups}
  </svg>`;
}

function horizontalWall(overrides: AttributeOverrides = {}): string {
  return tag("rect", {
    id: "wall-main",
    x: "50",
    y: "100",
    width: "400",
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
    id: "wall-vertical",
    x: "100",
    y: "50",
    width: "10",
    height: "200",
    "data-kind": "wall",
    "data-axis": "y",
    "data-class": "interior",
    "data-status": "fixed",
    ...overrides,
  });
}

function windowElement(overrides: AttributeOverrides = {}): string {
  return tag("rect", {
    id: "window-1",
    x: "100",
    y: "100",
    width: "40",
    height: "10",
    "data-kind": "window",
    "data-wall": "wall-main",
    "data-sill-height": "90",
    "data-opening-height": "120",
    "data-status": "fixed",
    ...overrides,
  });
}

function door(overrides: AttributeOverrides = {}): string {
  return tag("rect", {
    id: "door-1",
    x: "200",
    y: "100",
    width: "40",
    height: "10",
    "data-kind": "door",
    "data-wall": "wall-main",
    "data-door-type": "opening-only",
    "data-opening-height": "210",
    "data-status": "fixed",
    ...overrides,
  });
}

function hingedDoor(overrides: AttributeOverrides = {}): string {
  return door({
    "data-door-type": "hinged",
    "data-hinge-x": "200",
    "data-hinge-y": "105",
    "data-open-leaf-x": "200",
    "data-open-leaf-y": "65",
    ...overrides,
  });
}

function zone(overrides: AttributeOverrides = {}): string {
  return tag("polygon", {
    id: "zone-1",
    points: "50,110 450,110 450,400 50,400",
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
    x: "300",
    y: "300",
    width: "50",
    height: "50",
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
    cx: "100",
    cy: "105",
    r: "2",
    "data-kind": kind,
    "data-z": "30",
    "data-wall": "wall-main",
    ...overrides,
  });
}

function camera(overrides: AttributeOverrides = {}): string {
  return tag("circle", {
    id: "camera-1",
    cx: "250",
    cy: "250",
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
    project: { name: "Complete geometry validation test", units: "cm" },
    coordinateSystem: {
      x: "right",
      y: "down",
      z: "up",
      headingDegrees: { 0: "+x", 90: "+y", 180: "-x", 270: "-y" },
    },
    level: { id: "level-0", baseZ: 0, defaultCeilingHeight: 242 },
  };
}
