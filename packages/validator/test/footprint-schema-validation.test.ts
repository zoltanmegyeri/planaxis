import { readFileSync } from "node:fs";

import { parseApartmentSvg } from "@planaxis/parser";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  APARTMENT_SVG_VALIDATION_CODES as CODES,
  validateApartmentSvgReferences,
  validateApartmentSvgSchema,
} from "../src/index.js";
import type { ReferenceValidFootprint, SchemaValidFootprint } from "../src/index.js";

const POLYGON =
  '<polygon id="apartment-footprint" points="0,0 500,0 500,400 0,400" data-kind="footprint" />';
const GROUP = `<g id="footprint">\n    ${POLYGON}\n  </g>`;
const SOURCE = readFixture("valid/minimal-document-schema.svg");

function readFixture(path: string): string {
  return readFileSync(new URL(`../../../fixtures/${path}`, import.meta.url), "utf8");
}

function validate(source: string) {
  const parsed = parseApartmentSvg(source);
  if (!parsed.ok) throw new Error(parsed.error.message);
  return validateApartmentSvgSchema(parsed.document);
}

function withPolygon(polygon: string): string {
  return SOURCE.replace(POLYGON, polygon);
}

describe("Apartment SVG 2.2 footprint structural contract", () => {
  it("exposes one exact-decimal footprint and preserves its identity through reference validation", () => {
    const precise = "0.123456789012345678901234567890123456789";
    const result = validate(withPolygon(POLYGON.replace("0,0", `${precise},-0.2`)));
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    const document = result.document;
    expect(document.schemaVersion).toBe("2.2");
    expect(document.metadata.schema).toBe("apartment-svg/2.2");
    expectTypeOf(document.footprint).toEqualTypeOf<SchemaValidFootprint>();
    expect(document.footprint.id).toBe("apartment-footprint");
    expect(document.footprint.kind).toBe("footprint");
    expect(document.footprint.points[0]?.x.toString()).toBe(precise);
    expect(document.footprint.points[0]?.y.toString()).toBe("-0.2");
    expect(document.semanticElementsById.size).toBe(1);
    expect(document.semanticElementsById.get(document.footprint.id)).toBe(document.footprint);
    const references = validateApartmentSvgReferences(document);
    expect(references.valid).toBe(true);
    if (!references.valid) return;
    expectTypeOf(references.document.footprint).toEqualTypeOf<ReferenceValidFootprint>();
    expect(references.document.footprint).toBe(document.footprint);
    expect(references.document.semanticElementsById.get(document.footprint.id)).toBe(
      document.footprint,
    );
    expect(Object.isFrozen(document.footprint.points)).toBe(true);
  });

  it.each([
    [
      "the old root version",
      SOURCE.replace('data-schema-version="2.2"', 'data-schema-version="2.1"'),
      CODES.root.invalidAttributeValue,
    ],
    [
      "the old metadata version",
      SOURCE.replace("apartment-svg/2.2", "apartment-svg/2.1"),
      CODES.metadata.invalidPropertyValue,
    ],
    ["a missing footprint group", SOURCE.replace(GROUP, ""), CODES.group.missingRequiredGroup],
    [
      "duplicate footprint groups",
      SOURCE.replace(GROUP, GROUP + GROUP),
      CODES.group.duplicateRequiredGroup,
    ],
    [
      "a non-group footprint element",
      SOURCE.replace(GROUP, '<rect id="footprint" />'),
      CODES.group.invalidRequiredGroupForm,
    ],
    [
      "a transformed footprint group",
      SOURCE.replace('<g id="footprint">', '<g id="footprint" transform="translate(1 2)">'),
      CODES.group.prohibitedTransform,
    ],
    ["an empty footprint group", withPolygon(""), CODES.footprint.invalidMultiplicity],
    [
      "multiple footprint polygons",
      withPolygon(POLYGON + POLYGON.replace('id="apartment-footprint"', 'id="second-footprint"')),
      CODES.footprint.invalidMultiplicity,
    ],
    [
      "a non-polygon footprint",
      withPolygon(POLYGON.replace("<polygon", "<rect")),
      CODES.semantic.invalidElementType,
    ],
    [
      "the wrong footprint kind",
      withPolygon(POLYGON.replace('data-kind="footprint"', 'data-kind="zone"')),
      CODES.footprint.invalidAttributeValue,
    ],
    [
      "a missing footprint ID",
      withPolygon(POLYGON.replace(' id="apartment-footprint"', "")),
      CODES.id.missing,
    ],
    [
      "an invalid footprint ID",
      withPolygon(POLYGON.replace('id="apartment-footprint"', 'id="1invalid"')),
      CODES.id.invalid,
    ],
    [
      "a footprint ID colliding with a group",
      withPolygon(POLYGON.replace('id="apartment-footprint"', 'id="walls"')),
      CODES.id.duplicate,
    ],
    [
      "missing footprint points",
      withPolygon(POLYGON.replace(' points="0,0 500,0 500,400 0,400"', "")),
      CODES.semantic.missingAttribute,
    ],
    [
      "missing footprint kind",
      withPolygon(POLYGON.replace(' data-kind="footprint"', "")),
      CODES.semantic.missingAttribute,
    ],
    [
      "a footprint in a foreign namespace",
      withPolygon(POLYGON.replace("<polygon", '<polygon xmlns="urn:foreign"')),
      CODES.semantic.invalidNamespace,
    ],
    [
      "a transformed footprint",
      withPolygon(POLYGON.replace("<polygon", '<polygon transform="scale(2)"')),
      CODES.semantic.prohibitedAttribute,
    ],
    [
      "a footprint status attribute",
      withPolygon(POLYGON.replace("<polygon", '<polygon data-status="fixed"')),
      CODES.semantic.unknownAttribute,
    ],
    [
      "an unknown data attribute",
      withPolygon(POLYGON.replace("<polygon", '<polygon data-custom="ignored"')),
      CODES.semantic.unknownAttribute,
    ],
    [
      "redundant footprint dimensions",
      withPolygon(POLYGON.replace("<polygon", '<polygon data-width="500"')),
      CODES.semantic.prohibitedAttribute,
    ],
    [
      "nested semantic geometry",
      withPolygon(
        POLYGON.replace(" />", '><polygon id="nested" data-kind="footprint" /></polygon>'),
      ),
      CODES.semantic.nestedSemanticElement,
    ],
  ])("rejects %s", (_description, source, code) => {
    const result = validate(source);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ code }));
  });

  it.each(["", " ", "0,0 1", "0,,0", "0,0,", ",0,0", "0,0;1,1"])(
    "rejects malformed coordinate list %j",
    (points) => {
      const result = validate(withPolygon(POLYGON.replace("0,0 500,0 500,400 0,400", points)));
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ attribute: "points", category: "footprint" }),
      );
    },
  );

  it.each(["1e3", "NaN", "Infinity", "12cm", "+1", ".1", "1."])(
    "rejects invalid coordinate number %j",
    (number) => {
      const result = validate(withPolygon(POLYGON.replace("0,0", `${number},0`)));
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: CODES.footprint.invalidPointNumber, actual: number }),
      );
    },
  );

  it.each([
    "0 0 500 0 500 400 0 400",
    "0, 0, 500, 0, 500, 400, 0, 400",
    "0,0 100,50 0,100", // Diagonal edges and too few vertices.
    "0,0", // No area and too few vertices.
    "0,0 0,0 100,0 100,100 0,100", // Zero-length edge.
    "0,0 100,100 0,100 100,0", // Self-intersection.
    "-100,-100 600,-100 600,600 -100,600", // Outside viewBox.
  ])("accepts coordinate syntax without enforcing deferred geometry: %s", (points) => {
    const result = validate(withPolygon(POLYGON.replace("0,0 500,0 500,400 0,400", points)));
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(validateApartmentSvgReferences(result.document).valid).toBe(true);
  });

  it("accepts common presentation and extension attributes without semantic changes", () => {
    const plain = validate(SOURCE);
    const styled = validate(
      withPolygon(
        POLYGON.replace(
          "<polygon",
          '<polygon class="boundary" style="fill:red" stroke="black" data-x-source="survey"',
        ),
      ),
    );
    expect(plain.valid && styled.valid).toBe(true);
    if (!plain.valid || !styled.valid) return;
    expect(styled.document.footprint).toEqual(plain.document.footprint);
  });

  it.each(["data-wall", "data-radiator-below"])(
    "rejects footprint as a %s reference target",
    (attribute) => {
      const source = readFixture("valid/minimal-semantic-schema.svg");
      const changedSource =
        attribute === "data-wall"
          ? source.replace('data-wall="wall-1"', 'data-wall="apartment-footprint"')
          : source.replace(
              'id="window-1"',
              'id="window-1" data-radiator-below="apartment-footprint"',
            );
      const result = validate(changedSource);
      expect(result.valid).toBe(true);
      if (!result.valid) return;
      const references = validateApartmentSvgReferences(result.document);
      expect(references.valid).toBe(false);
      expect(references.errors).toEqual([
        expect.objectContaining({
          code: CODES.reference.wrongKind,
          elementId: "window-1",
          attribute,
          actual: "footprint",
        }),
      ]);
    },
  );

  it("reports only the intended missing-points error in the focused fixture", () => {
    const result = validate(readFixture("invalid/footprint-missing-points.svg"));
    expect(result.errors).toEqual([
      expect.objectContaining({
        code: CODES.semantic.missingAttribute,
        elementId: "apartment-footprint",
        attribute: "points",
      }),
    ]);
  });
});
