import { parseApartmentSvg } from "@planaxis/parser";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  APARTMENT_SVG_VALIDATION_CODES,
  validateApartmentSvgReferences,
  validateApartmentSvgSchema,
} from "../src/index.js";
import type {
  ApartmentSvgReferenceValidationResult,
  ReferenceValidApartmentSvgDocument,
  SchemaValidApartmentSvgDocument,
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

describe("validateApartmentSvgReferences public contract", () => {
  it("consumes schema-valid input and exposes a reference-specific result", () => {
    expectTypeOf(validateApartmentSvgReferences)
      .parameter(0)
      .toEqualTypeOf<SchemaValidApartmentSvgDocument>();
    expectTypeOf(
      validateApartmentSvgReferences,
    ).returns.toEqualTypeOf<ApartmentSvgReferenceValidationResult>();

    const result = validateApartmentSvgReferences(schemaValidDocument(createSvg()));

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expectTypeOf(result.document).toEqualTypeOf<ReferenceValidApartmentSvgDocument>();
    expect(result.errors).toEqual([]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.document)).toBe(true);
  });

  it("resolves every reference-bearing core element into typed relationships", () => {
    const utilityKinds = ["socket", "ethernet", "tv-coax", "light-switch", "wall-light"];
    const schemaDocument = schemaValidDocument(
      createSvg({
        walls: wall(),
        windows: windowElement({ "data-radiator-below": "radiator-1" }),
        doors: door({ "data-door-type": "sliding" }),
        "fixed-elements": fixedElement("radiator", {
          id: "radiator-1",
          "data-wall": "wall-1",
        }),
        utilities: [
          ...utilityKinds.map((kind, index) =>
            utility(kind, { id: `utility-${String(index + 1)}` }),
          ),
          utility("ceiling-light", { id: "ceiling-light-1" }),
        ].join(""),
      }),
    );

    const result = validateApartmentSvgReferences(schemaDocument);

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    const document = result.document;
    const resolvedWall = document.walls[0];
    const resolvedRadiator = document.fixedElements[0];
    const resolvedWindow = document.windows[0];
    const resolvedDoor = document.doors[0];
    if (
      resolvedWall === undefined ||
      resolvedRadiator === undefined ||
      resolvedRadiator.kind !== "radiator" ||
      resolvedWindow === undefined ||
      resolvedDoor === undefined
    ) {
      throw new Error("Expected the reference-valid semantic elements to be present.");
    }

    expect(resolvedWindow.wall).toBe(resolvedWall);
    expect(resolvedWindow.radiatorBelow).toBe(resolvedRadiator);
    expect(resolvedRadiator.wall).toBe(resolvedWall);
    expect(resolvedDoor.wall).toBe(resolvedWall);
    for (const resolvedUtility of document.utilities.slice(0, utilityKinds.length)) {
      if (!("wall" in resolvedUtility)) {
        throw new Error("Expected a wall-associated utility.");
      }
      expect(resolvedUtility.wall).toBe(resolvedWall);
    }
    expect("wall" in document.utilities[utilityKinds.length]!).toBe(false);

    expect(document.semanticElementsById.get(resolvedWindow.id)).toBe(resolvedWindow);
    expect(document.semanticElementsById.get(resolvedDoor.id)).toBe(resolvedDoor);
    expect(document.semanticElementsById.get(resolvedRadiator.id)).toBe(resolvedRadiator);
    for (const resolvedUtility of document.utilities) {
      expect(document.semanticElementsById.get(resolvedUtility.id)).toBe(resolvedUtility);
    }
    expect(document.semanticElementsById.get(resolvedWall.id)).toBe(resolvedWall);
    expect(resolvedWindow.x).toBe(schemaDocument.windows[0]?.x);
    expect(Object.isFrozen(resolvedWindow)).toBe(true);
    expect(Object.isFrozen(resolvedRadiator)).toBe(true);
    expect(Object.isFrozen(resolvedDoor)).toBe(true);
  });
});

describe("data-wall reference validation", () => {
  it("aggregates missing targets for windows, doors, radiators, and wall utilities", () => {
    const result = validateReferences(
      createSvg({
        windows: windowElement({ "data-wall": "missing-window-wall" }),
        doors: door({ "data-wall": "missing-door-wall" }),
        "fixed-elements": fixedElement("radiator", {
          id: "radiator-1",
          "data-wall": "missing-radiator-wall",
        }),
        utilities: utility("socket", { "data-wall": "missing-utility-wall" }),
      }),
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      expect.objectContaining({
        code: APARTMENT_SVG_VALIDATION_CODES.reference.broken,
        category: "reference",
        rule: "reference.target-exists",
        elementId: "window-1",
        attribute: "data-wall",
        actual: "missing-window-wall",
      }),
      expect.objectContaining({
        code: APARTMENT_SVG_VALIDATION_CODES.reference.broken,
        elementId: "door-1",
        attribute: "data-wall",
        actual: "missing-door-wall",
      }),
      expect.objectContaining({
        code: APARTMENT_SVG_VALIDATION_CODES.reference.broken,
        elementId: "radiator-1",
        attribute: "data-wall",
        actual: "missing-radiator-wall",
      }),
      expect.objectContaining({
        code: APARTMENT_SVG_VALIDATION_CODES.reference.broken,
        elementId: "utility-1",
        attribute: "data-wall",
        actual: "missing-utility-wall",
      }),
    ]);
    expect("document" in result).toBe(false);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.errors)).toBe(true);
  });

  it("rejects existing core targets of the wrong semantic kind", () => {
    const result = validateReferences(
      createSvg({
        spaces: space(),
        windows: windowElement({ "data-wall": "space-1" }),
        doors: door({ "data-wall": "space-1" }),
        "fixed-elements": fixedElement("radiator", {
          id: "radiator-1",
          "data-wall": "space-1",
        }),
        utilities: utility("socket", { "data-wall": "space-1" }),
      }),
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(4);
    for (const error of result.errors) {
      expect(error).toEqual(
        expect.objectContaining({
          code: APARTMENT_SVG_VALIDATION_CODES.reference.wrongKind,
          category: "reference",
          rule: "reference.target-kind",
          attribute: "data-wall",
          expected: "wall",
          actual: "zone",
        }),
      );
    }
  });

  it("allows a radiator to omit its optional wall reference", () => {
    const result = validateReferences(
      createSvg({
        walls: wall(),
        windows: windowElement(),
        "fixed-elements": fixedElement("radiator", { id: "radiator-1" }),
      }),
    );

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    const radiator = result.document.fixedElements[0];
    expect(radiator?.kind).toBe("radiator");
    expect(radiator === undefined ? true : "wall" in radiator).toBe(false);
    expect("radiatorBelow" in result.document.windows[0]!).toBe(false);
  });
});

describe("data-radiator-below reference validation", () => {
  it("reports a missing radiator target", () => {
    const result = validateReferences(
      createSvg({
        walls: wall(),
        windows: windowElement({ "data-radiator-below": "missing-radiator" }),
      }),
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      expect.objectContaining({
        code: APARTMENT_SVG_VALIDATION_CODES.reference.broken,
        category: "reference",
        elementId: "window-1",
        attribute: "data-radiator-below",
        actual: "missing-radiator",
      }),
    ]);
  });

  it("reports a radiator reference to an existing target of the wrong kind", () => {
    const result = validateReferences(
      createSvg({
        walls: wall(),
        windows: windowElement({ "data-radiator-below": "wall-1" }),
      }),
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      expect.objectContaining({
        code: APARTMENT_SVG_VALIDATION_CODES.reference.wrongKind,
        category: "reference",
        elementId: "window-1",
        attribute: "data-radiator-below",
        expected: "radiator",
        actual: "wall",
      }),
    ]);
  });
});

describe("reference-validation stage boundaries", () => {
  it("does not treat annotation content as a referenceable core element", () => {
    const result = validateReferences(
      createSvg({
        windows: windowElement({ "data-wall": "annotation-wall" }),
        annotations: '<rect id="annotation-wall" data-kind="wall" />',
      }),
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      expect.objectContaining({
        code: APARTMENT_SVG_VALIDATION_CODES.reference.broken,
        elementId: "window-1",
        attribute: "data-wall",
        actual: "annotation-wall",
      }),
    ]);
  });

  it("accepts reference-valid input with deferred geometric and topological errors", () => {
    const result = validateReferences(
      createSvg({
        spaces: space({ points: "0,0 1,1" }),
        walls: wall({ width: "10", height: "100", "data-axis": "x" }),
        windows: windowElement({ x: "999", y: "999" }),
        doors: door({
          x: "999",
          y: "999",
          "data-door-type": "hinged",
          "data-hinge-x": "3",
          "data-hinge-y": "7",
          "data-open-leaf-x": "11",
          "data-open-leaf-y": "13",
        }),
        utilities: utility("socket", { cx: "999", cy: "999" }),
        cameras: camera({ cx: "1", cy: "1", "data-z": "1" }),
      }),
    );

    expect(result.valid).toBe(true);
  });
});

function validateReferences(source: string): ApartmentSvgReferenceValidationResult {
  return validateApartmentSvgReferences(schemaValidDocument(source));
}

function schemaValidDocument(source: string): SchemaValidApartmentSvgDocument {
  const parsed = parseApartmentSvg(source);
  if (!parsed.ok) {
    throw new Error(`Expected XML parsing to succeed: ${parsed.error.message}`);
  }

  const result = validateApartmentSvgSchema(parsed.document);
  if (!result.valid) {
    throw new Error(`Expected schema validation to succeed: ${JSON.stringify(result.errors)}`);
  }
  return result.document;
}

function createSvg(contents: Partial<Record<GroupId, string>> = {}): string {
  const groups = GROUP_IDS.map((id) => `<g id="${id}">${contents[id] ?? ""}</g>`).join("\n");
  return `<svg xmlns="${SVG_NAMESPACE_URI}" viewBox="0 0 500 400" data-schema="apartment-svg" data-schema-version="2.1" data-unit="cm">
    <metadata><![CDATA[${JSON.stringify(minimumMetadata())}]]></metadata>
    ${groups}
  </svg>`;
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

function wall(overrides: AttributeOverrides = {}): string {
  return tag("rect", {
    id: "wall-1",
    x: "0",
    y: "0",
    width: "100",
    height: "10",
    "data-kind": "wall",
    "data-axis": "x",
    "data-class": "interior",
    "data-status": "fixed",
    ...overrides,
  });
}

function windowElement(overrides: AttributeOverrides = {}): string {
  return tag("rect", {
    id: "window-1",
    x: "10",
    y: "0",
    width: "30",
    height: "10",
    "data-kind": "window",
    "data-wall": "wall-1",
    "data-sill-height": "80",
    "data-opening-height": "120",
    "data-status": "fixed",
    ...overrides,
  });
}

function door(overrides: AttributeOverrides = {}): string {
  return tag("rect", {
    id: "door-1",
    x: "20",
    y: "0",
    width: "30",
    height: "10",
    "data-kind": "door",
    "data-wall": "wall-1",
    "data-door-type": "opening-only",
    "data-opening-height": "210",
    "data-status": "fixed",
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
    "data-wall": kind === "ceiling-light" ? null : "wall-1",
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
    project: { name: "Reference validation test", units: "cm" },
    coordinateSystem: {
      x: "right",
      y: "down",
      z: "up",
      headingDegrees: { 0: "+x", 90: "+y", 180: "-x", 270: "-y" },
    },
    level: { id: "level-0", baseZ: 0, defaultCeilingHeight: 242 },
  };
}
