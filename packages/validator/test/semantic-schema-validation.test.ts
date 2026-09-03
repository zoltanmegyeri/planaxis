import { readFileSync } from "node:fs";

import { parseApartmentSvg } from "@planaxis/parser";
import type { ParsedApartmentSvgDocument } from "@planaxis/parser";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  APARTMENT_SVG_VALIDATION_CODES,
  validateApartmentSvgDocumentSchema,
  validateApartmentSvgSchema,
} from "../src/index.js";
import type {
  ApartmentSvgSchemaValidationResult,
  ApartmentSvgValidationCode,
  ApartmentSvgValidationError,
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

describe("validateApartmentSvgSchema public contract", () => {
  it("accepts a parser-owned document and exposes the schema-valid result type", () => {
    expectTypeOf(validateApartmentSvgSchema)
      .parameter(0)
      .toEqualTypeOf<ParsedApartmentSvgDocument>();
    expectTypeOf(
      validateApartmentSvgSchema,
    ).returns.toEqualTypeOf<ApartmentSvgSchemaValidationResult>();

    const result = validateSource(createSvg());

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expectTypeOf(result.document).toEqualTypeOf<SchemaValidApartmentSvgDocument>();
    expect(result.document.semanticElementsById.size).toBe(0);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.document)).toBe(true);
  });

  it("returns a complete exact-decimal representation and unresolved reference index", () => {
    const precise = "123.456789012345678901234567890123456789";
    const metadataPayload = JSON.stringify(metadataWithLocation()).replace(
      '"baseZ":0',
      `"baseZ":${precise}`,
    );
    const result = validateSource(
      createSvg(
        {
          spaces: space({ points: `${precise},0 1,1` }),
          walls: wall({ x: precise, "data-height": "250.25" }),
          windows: windowElement({
            "data-wall": "missing-wall",
            "data-radiator-below": "missing-radiator",
            "data-opening-type": "tilt-turn",
            "data-frame-material": "other",
            "data-frame-material-description": "Composite",
            "data-frame-color": "white",
            "data-glass-type": "other",
            "data-glass-type-description": "Acoustic",
          }),
          doors: door("hinged"),
          "fixed-elements": fixedElement("radiator", { "data-wall": "missing-wall" }),
          utilities: utility("socket", { "data-wall": "missing-wall" }),
          cameras: camera({ cx: precise }),
          annotations: '<g transform="rotate(45)"><rect id="annotation-only" /></g>',
        },
        { metadataPayload, viewBox: `${precise} 0 500 400` },
      ),
    );

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    const document = result.document;
    expect(document.viewBox.minX.toString()).toBe(precise);
    expect(document.viewBox.width.toString()).toBe("500");
    expect(document.metadata.level.baseZ.toString()).toBe(precise);
    expect(document.metadata.location?.latitude.toString()).toBe("47.4979");
    expect(document.spaces[0]?.points[0]?.x.toString()).toBe(precise);
    expect(document.walls[0]?.x.toString()).toBe(precise);
    expect(document.walls[0]?.wallHeight?.toString()).toBe("250.25");
    expect(document.windows[0]).toEqual(
      expect.objectContaining({
        openingType: "tilt-turn",
        frameMaterial: "other",
        frameMaterialDescription: "Composite",
        frameColor: "white",
        glassType: "other",
        glassTypeDescription: "Acoustic",
        wallId: "missing-wall",
        radiatorBelowId: "missing-radiator",
        status: "fixed",
      }),
    );
    const typedDoor = document.doors[0];
    expect(typedDoor?.doorType).toBe("hinged");
    if (typedDoor?.doorType === "hinged") {
      expect(typedDoor.hinge.x.toString()).toBe("20");
      expect(typedDoor.openLeaf.y.toString()).toBe("-25");
    }
    expect(document.fixedElements[0]?.baseZ.toString()).toBe("0");
    expect(document.utilities[0]?.radius.toString()).toBe("2");
    expect(document.cameras[0]?.heading.toString()).toBe("270");
    expect(document.semanticElementsById.get("window-1")).toBe(document.windows[0]);
    expect(document.semanticElementsById.has("annotation-only")).toBe(false);
    expect(Number(precise).toString()).not.toBe(precise);
  });

  it("returns no document for document-level or semantic schema failures", () => {
    const documentFailure = validateSource(createSvg({}, { omitGroup: "cameras" }));
    const semanticFailure = validateSource(createSvg({ walls: wall({ width: "0" }) }));

    expectError(documentFailure, APARTMENT_SVG_VALIDATION_CODES.group.missingRequiredGroup);
    expect("document" in documentFailure).toBe(false);
    expectError(semanticFailure, APARTMENT_SVG_VALIDATION_CODES.wall.invalidAttributeValue, {
      attribute: "width",
    });
    expect("document" in semanticFailure).toBe(false);
  });

  it("aggregates independent semantic failures with structured context", () => {
    const result = validateSource(
      createSvg({
        walls: wall({ width: "0" }),
        windows: windowElement({ "data-sill-height": "-1" }),
      }),
    );

    expectError(result, APARTMENT_SVG_VALIDATION_CODES.wall.invalidAttributeValue, {
      elementId: "wall-1",
      attribute: "width",
      rule: "wall.width",
      actual: "0",
    });
    expectError(result, APARTMENT_SVG_VALIDATION_CODES.window.invalidAttributeValue, {
      elementId: "window-1",
      attribute: "data-sill-height",
      rule: "window.data-sill-height",
      actual: "-1",
    });
  });

  it("preserves the TASK-005 document-only API boundary", () => {
    const parsed = parseSource(createSvg({ walls: '<circle data-kind="not-wall" />' }));

    expect(validateApartmentSvgDocumentSchema(parsed)).toEqual({ valid: true, errors: [] });
    expect(validateApartmentSvgSchema(parsed).valid).toBe(false);
  });
});

describe("common semantic element rules", () => {
  it("accepts a direct child with presentation and data-x-* attributes", () => {
    const result = validateSource(
      createSvg({
        walls: wall({
          class: "wall",
          style: "display:none",
          fill: "black",
          stroke: "white",
          opacity: "0.5",
          "data-x-survey-source": "scan",
        }),
      }),
    );

    expect(result.valid).toBe(true);
  });

  it("rejects the wrong direct SVG element type", () => {
    const result = validateSource(createSvg({ walls: tag("circle", wallAttributes()) }));
    expectError(result, APARTMENT_SVG_VALIDATION_CODES.semantic.invalidElementType, {
      elementId: "wall-1",
      actual: "circle",
    });
  });

  it("rejects a semantic element outside the SVG namespace", () => {
    const result = validateSource(
      createSvg({
        walls: `<x:rect xmlns:x="urn:not-svg" ${attributesMarkup(wallAttributes())} />`,
      }),
    );
    expectError(result, APARTMENT_SVG_VALIDATION_CODES.semantic.invalidNamespace, {
      elementId: "wall-1",
    });
  });

  it("requires a valid semantic ID", () => {
    const missing = validateSource(createSvg({ walls: wall({ id: null }) }));
    const invalid = validateSource(createSvg({ walls: wall({ id: "1-wall" }) }));

    expectError(missing, APARTMENT_SVG_VALIDATION_CODES.id.missing);
    expectError(invalid, APARTMENT_SVG_VALIDATION_CODES.id.invalid, { actual: "1-wall" });
  });

  it("rejects duplicate semantic IDs across groups", () => {
    const result = validateSource(
      createSvg({ walls: wall({ id: "duplicate" }), windows: windowElement({ id: "duplicate" }) }),
    );
    expectError(result, APARTMENT_SVG_VALIDATION_CODES.id.duplicate, {
      elementId: "duplicate",
    });
  });

  it("rejects a semantic ID collision with required and extension root groups", () => {
    const requiredCollision = validateSource(createSvg({ walls: wall({ id: "spaces" }) }));
    const extensionCollision = validateSource(
      createSvg({ walls: wall({ id: "x-extra" }) }, { extraGroups: '<g id="x-extra" />' }),
    );

    expectError(requiredCollision, APARTMENT_SVG_VALIDATION_CODES.id.duplicate, {
      elementId: "spaces",
    });
    expectError(extensionCollision, APARTMENT_SVG_VALIDATION_CODES.id.duplicate, {
      elementId: "x-extra",
    });
  });

  it("requires the corresponding data-kind", () => {
    const missing = validateSource(createSvg({ walls: wall({ "data-kind": null }) }));
    const incorrect = validateSource(createSvg({ walls: wall({ "data-kind": "window" }) }));

    expectError(missing, APARTMENT_SVG_VALIDATION_CODES.semantic.missingAttribute, {
      attribute: "data-kind",
    });
    expectError(incorrect, APARTMENT_SVG_VALIDATION_CODES.wall.invalidAttributeValue, {
      attribute: "data-kind",
    });
  });

  it("prohibits transform and nested semantic elements", () => {
    const transformed = validateSource(createSvg({ walls: wall({ transform: "scale(2)" }) }));
    const nested = validateSource(
      createSvg({ walls: wall({}, '<rect id="nested" data-kind="wall" />') }),
    );

    expectError(transformed, APARTMENT_SVG_VALIDATION_CODES.semantic.prohibitedAttribute, {
      attribute: "transform",
      rule: "semantic.transform",
    });
    expectError(nested, APARTMENT_SVG_VALIDATION_CODES.semantic.nestedSemanticElement, {
      elementId: "wall-1",
    });
  });

  it("rejects unknown data and geometry-modifying attributes", () => {
    const unknownData = validateSource(createSvg({ walls: wall({ "data-mystery": "x" }) }));
    const geometryAttribute = validateSource(createSvg({ walls: wall({ rx: "2" }) }));

    expectError(unknownData, APARTMENT_SVG_VALIDATION_CODES.semantic.unknownAttribute, {
      attribute: "data-mystery",
    });
    expectError(geometryAttribute, APARTMENT_SVG_VALIDATION_CODES.semantic.unknownAttribute, {
      attribute: "rx",
    });
  });

  it.each([
    "data-length",
    "data-width",
    "data-depth",
    "data-opening-width",
    "data-wall-thickness",
    "data-center-x",
    "data-center-y",
  ])("rejects redundant geometric attribute %s", (attribute) => {
    const result = validateSource(createSvg({ walls: wall({ [attribute]: "12" }) }));
    expectError(result, APARTMENT_SVG_VALIDATION_CODES.semantic.prohibitedAttribute, {
      attribute,
      rule: "semantic.redundant-geometry-attribute",
    });
  });
});

describe("spaces schema", () => {
  it("rejects a non-polygon direct child", () => {
    const result = validateSource(createSvg({ spaces: tag("rect", spaceAttributes()) }));
    expectError(result, APARTMENT_SVG_VALIDATION_CODES.semantic.invalidElementType, {
      elementId: "space-1",
    });
  });

  it("parses exact-decimal polygon coordinates without geometric validation", () => {
    const precise = "0.123456789012345678901234567890123456789";
    const result = validateSource(createSvg({ spaces: space({ points: `${precise},0 1,1` }) }));

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.document.spaces[0]?.points[0]?.x.toString()).toBe(precise);
    expect(result.document.spaces[0]?.points).toHaveLength(2);
  });

  it("distinguishes invalid number lexemes from malformed coordinate lists", () => {
    const invalidNumber = validateSource(createSvg({ spaces: space({ points: "0,0 1e3,2" }) }));
    const malformed = validateSource(createSvg({ spaces: space({ points: "0,,0 1,1" }) }));

    expectError(invalidNumber, APARTMENT_SVG_VALIDATION_CODES.zone.invalidPointNumber, {
      attribute: "points",
      actual: "1e3",
    });
    expectError(malformed, APARTMENT_SVG_VALIDATION_CODES.zone.malformedPoints, {
      attribute: "points",
    });
  });

  it("requires a non-empty space name", () => {
    expectError(
      validateSource(createSvg({ spaces: space({ "data-name": "" }) })),
      APARTMENT_SVG_VALIDATION_CODES.zone.invalidAttributeValue,
      { attribute: "data-name" },
    );
  });

  it.each([
    "living-room",
    "dining",
    "kitchen",
    "bedroom",
    "bathroom",
    "toilet",
    "hall",
    "corridor",
    "entrance",
    "home-office",
    "storage",
    "utility",
    "balcony",
    "other",
  ])("accepts data-function %s", (spaceFunction) => {
    const description = spaceFunction === "other" ? "Music room" : null;
    const result = validateSource(
      createSvg({
        spaces: space({
          "data-function": spaceFunction,
          "data-function-description": description,
        }),
      }),
    );
    expect(result.valid).toBe(true);
  });

  it("enforces space function-description conditionals without cascading from an invalid enum", () => {
    const missing = validateSource(
      createSvg({ spaces: space({ "data-function": "other", "data-function-description": null }) }),
    );
    const empty = validateSource(
      createSvg({ spaces: space({ "data-function": "other", "data-function-description": "" }) }),
    );
    const prohibited = validateSource(
      createSvg({ spaces: space({ "data-function-description": "Not permitted" }) }),
    );
    const invalid = validateSource(createSvg({ spaces: space({ "data-function": "garage" }) }));

    expectError(missing, APARTMENT_SVG_VALIDATION_CODES.zone.conditionalAttribute);
    expectError(empty, APARTMENT_SVG_VALIDATION_CODES.zone.conditionalAttribute);
    expectError(prohibited, APARTMENT_SVG_VALIDATION_CODES.zone.conditionalAttribute);
    expectError(invalid, APARTMENT_SVG_VALIDATION_CODES.zone.invalidAttributeValue, {
      attribute: "data-function",
    });
    expectNoError(invalid, APARTMENT_SVG_VALIDATION_CODES.zone.conditionalAttribute);
  });

  it.each(["closed", "partial", "open"])("accepts data-enclosure %s", (enclosure) => {
    expect(
      validateSource(createSvg({ spaces: space({ "data-enclosure": enclosure }) })).valid,
    ).toBe(true);
  });

  it("rejects an invalid enclosure", () => {
    expectError(
      validateSource(createSvg({ spaces: space({ "data-enclosure": "sealed" }) })),
      APARTMENT_SVG_VALIDATION_CODES.zone.invalidAttributeValue,
      { attribute: "data-enclosure" },
    );
  });
});

describe("walls schema", () => {
  it.each(["x", "y"])("accepts data-axis %s without dimension consistency checks", (axis) => {
    const result = validateSource(
      createSvg({ walls: wall({ "data-axis": axis, width: "10", height: "100" }) }),
    );
    expect(result.valid).toBe(true);
  });

  it.each(["x", "y", "width", "height"])("requires numeric wall attribute %s", (attribute) => {
    const result = validateSource(createSvg({ walls: wall({ [attribute]: null }) }));
    expectError(result, APARTMENT_SVG_VALIDATION_CODES.semantic.missingAttribute, { attribute });
  });

  it.each(["width", "height"])("requires positive wall %s", (attribute) => {
    const result = validateSource(createSvg({ walls: wall({ [attribute]: "0" }) }));
    expectError(result, APARTMENT_SVG_VALIDATION_CODES.wall.invalidAttributeValue, { attribute });
  });

  it("validates wall axis, class, optional height, and required status", () => {
    expectError(
      validateSource(createSvg({ walls: wall({ "data-axis": "z" }) })),
      APARTMENT_SVG_VALIDATION_CODES.wall.invalidAttributeValue,
      { attribute: "data-axis" },
    );
    expectError(
      validateSource(createSvg({ walls: wall({ "data-class": "party" }) })),
      APARTMENT_SVG_VALIDATION_CODES.wall.invalidAttributeValue,
      { attribute: "data-class" },
    );
    expectError(
      validateSource(createSvg({ walls: wall({ "data-height": "0" }) })),
      APARTMENT_SVG_VALIDATION_CODES.wall.invalidAttributeValue,
      { attribute: "data-height" },
    );
    expectError(
      validateSource(createSvg({ walls: wall({ "data-status": null }) })),
      APARTMENT_SVG_VALIDATION_CODES.semantic.missingAttribute,
      { attribute: "data-status" },
    );
    expectError(
      validateSource(createSvg({ walls: wall({ "data-status": "Fixed" }) })),
      APARTMENT_SVG_VALIDATION_CODES.wall.invalidAttributeValue,
      { attribute: "data-status" },
    );

    const absentHeight = validateSource(createSvg({ walls: wall() }));
    expect(absentHeight.valid).toBe(true);
    if (absentHeight.valid) expect("wallHeight" in absentHeight.document.walls[0]!).toBe(false);
  });

  it.each(["interior", "exterior"])("accepts wall class %s", (wallClass) => {
    expect(validateSource(createSvg({ walls: wall({ "data-class": wallClass }) })).valid).toBe(
      true,
    );
  });

  it.each(["fixed", "modifiable", "proposal"])("accepts status %s", (status) => {
    expect(validateSource(createSvg({ walls: wall({ "data-status": status }) })).valid).toBe(true);
  });
});

describe("windows schema", () => {
  it("accepts optional enums, color, and unresolved references", () => {
    const result = validateSource(
      createSvg({
        windows: windowElement({
          "data-wall": "does-not-exist",
          "data-radiator-below": "also-missing",
          "data-opening-type": "casement",
          "data-frame-material": "wood",
          "data-frame-color": "",
          "data-glass-type": "clear",
        }),
      }),
    );
    expect(result.valid).toBe(true);
  });

  it("validates reference, sill, opening-height, and status scalar requirements", () => {
    expectError(
      validateSource(createSvg({ windows: windowElement({ "data-wall": null }) })),
      APARTMENT_SVG_VALIDATION_CODES.semantic.missingAttribute,
      { attribute: "data-wall" },
    );
    expectError(
      validateSource(createSvg({ windows: windowElement({ "data-wall": "" }) })),
      APARTMENT_SVG_VALIDATION_CODES.window.invalidAttributeValue,
      { attribute: "data-wall" },
    );
    expectError(
      validateSource(createSvg({ windows: windowElement({ "data-sill-height": "-0.1" }) })),
      APARTMENT_SVG_VALIDATION_CODES.window.invalidAttributeValue,
      { attribute: "data-sill-height" },
    );
    expectError(
      validateSource(createSvg({ windows: windowElement({ "data-opening-height": "0" }) })),
      APARTMENT_SVG_VALIDATION_CODES.window.invalidAttributeValue,
      { attribute: "data-opening-height" },
    );
    expectError(
      validateSource(createSvg({ windows: windowElement({ "data-status": "unknown" }) })),
      APARTMENT_SVG_VALIDATION_CODES.window.invalidAttributeValue,
      { attribute: "data-status" },
    );
    expect(
      validateSource(createSvg({ windows: windowElement({ "data-sill-height": "0" }) })).valid,
    ).toBe(true);
  });

  it.each(["fixed", "casement", "tilt", "tilt-turn", "sliding"])(
    "accepts opening type %s",
    (openingType) => {
      expect(
        validateSource(createSvg({ windows: windowElement({ "data-opening-type": openingType }) }))
          .valid,
      ).toBe(true);
    },
  );

  it("rejects invalid optional window enums", () => {
    for (const [attribute, value] of [
      ["data-opening-type", "awning"],
      ["data-frame-material", "vinyl"],
      ["data-glass-type", "mirrored"],
    ] as const) {
      expectError(
        validateSource(createSvg({ windows: windowElement({ [attribute]: value }) })),
        APARTMENT_SVG_VALIDATION_CODES.window.invalidAttributeValue,
        { attribute },
      );
    }
  });

  it.each(["wood", "plastic", "aluminium", "steel", "other"])(
    "accepts frame material %s with its valid conditional shape",
    (material) => {
      const result = validateSource(
        createSvg({
          windows: windowElement({
            "data-frame-material": material,
            "data-frame-material-description": material === "other" ? "Composite" : null,
          }),
        }),
      );
      expect(result.valid).toBe(true);
    },
  );

  it.each(["clear", "frosted", "tinted", "other"])(
    "accepts glass type %s with its valid conditional shape",
    (glassType) => {
      const result = validateSource(
        createSvg({
          windows: windowElement({
            "data-glass-type": glassType,
            "data-glass-type-description": glassType === "other" ? "Special" : null,
          }),
        }),
      );
      expect(result.valid).toBe(true);
    },
  );

  it("enforces frame and glass description conditionals", () => {
    for (const invalidWindow of [
      windowElement({ "data-frame-material": "other", "data-frame-material-description": null }),
      windowElement({ "data-frame-material": "other", "data-frame-material-description": "" }),
      windowElement({ "data-frame-material": "wood", "data-frame-material-description": "No" }),
      windowElement({ "data-frame-material-description": "No material" }),
      windowElement({ "data-glass-type": "other", "data-glass-type-description": null }),
      windowElement({ "data-glass-type": "other", "data-glass-type-description": "" }),
      windowElement({ "data-glass-type": "clear", "data-glass-type-description": "No" }),
      windowElement({ "data-glass-type-description": "No glass type" }),
    ]) {
      expectError(
        validateSource(createSvg({ windows: invalidWindow })),
        APARTMENT_SVG_VALIDATION_CODES.window.conditionalAttribute,
      );
    }
  });

  it("rejects an empty optional radiator reference", () => {
    expectError(
      validateSource(createSvg({ windows: windowElement({ "data-radiator-below": "" }) })),
      APARTMENT_SVG_VALIDATION_CODES.window.invalidAttributeValue,
      { attribute: "data-radiator-below" },
    );
  });
});

describe("doors schema", () => {
  it.each(["hinged", "sliding", "opening-only"])("accepts door type %s", (doorType) => {
    expect(validateSource(createSvg({ doors: door(doorType) })).valid).toBe(true);
  });

  it("rejects an invalid door type without fabricated hinge condition errors", () => {
    const result = validateSource(
      createSvg({ doors: door("hinged", { "data-door-type": "folding" }) }),
    );
    expectError(result, APARTMENT_SVG_VALIDATION_CODES.door.invalidAttributeValue, {
      attribute: "data-door-type",
    });
    expectNoError(result, APARTMENT_SVG_VALIDATION_CODES.door.conditionalAttribute);
  });

  it.each(["data-hinge-x", "data-hinge-y", "data-open-leaf-x", "data-open-leaf-y"])(
    "requires hinged-door attribute %s",
    (attribute) => {
      const result = validateSource(createSvg({ doors: door("hinged", { [attribute]: null }) }));
      expectError(result, APARTMENT_SVG_VALIDATION_CODES.door.conditionalAttribute, { attribute });
    },
  );

  it.each(["sliding", "opening-only"])(
    "prohibits hinge/open-leaf attributes for %s",
    (doorType) => {
      const result = validateSource(createSvg({ doors: door(doorType, { "data-hinge-x": "1" }) }));
      expectError(result, APARTMENT_SVG_VALIDATION_CODES.door.conditionalAttribute, {
        attribute: "data-hinge-x",
      });
    },
  );

  it("validates wall Ref, opening height, status, and numeric hinge lexemes", () => {
    expectError(
      validateSource(createSvg({ doors: door("hinged", { "data-wall": null }) })),
      APARTMENT_SVG_VALIDATION_CODES.semantic.missingAttribute,
      { attribute: "data-wall" },
    );
    expectError(
      validateSource(createSvg({ doors: door("hinged", { "data-wall": "" }) })),
      APARTMENT_SVG_VALIDATION_CODES.door.invalidAttributeValue,
      { attribute: "data-wall" },
    );
    expectError(
      validateSource(createSvg({ doors: door("hinged", { "data-opening-height": "0" }) })),
      APARTMENT_SVG_VALIDATION_CODES.door.invalidAttributeValue,
      { attribute: "data-opening-height" },
    );
    expectError(
      validateSource(createSvg({ doors: door("hinged", { "data-hinge-x": "1e3" }) })),
      APARTMENT_SVG_VALIDATION_CODES.door.invalidAttributeValue,
      { attribute: "data-hinge-x" },
    );
    expectError(
      validateSource(createSvg({ doors: door("hinged", { "data-status": "unknown" }) })),
      APARTMENT_SVG_VALIDATION_CODES.door.invalidAttributeValue,
      { attribute: "data-status" },
    );
  });

  it("accepts geometrically incorrect hinged coordinates and a missing wall target", () => {
    const result = validateSource(
      createSvg({
        doors: door("hinged", {
          "data-wall": "missing",
          "data-hinge-x": "999",
          "data-hinge-y": "888",
          "data-open-leaf-x": "777",
          "data-open-leaf-y": "666",
        }),
      }),
    );
    expect(result.valid).toBe(true);
  });
});

describe("fixed-elements schema", () => {
  it.each([
    "radiator",
    "column",
    "shaft",
    "chimney",
    "boiler",
    "built-in",
    "air-conditioner",
    "stair",
    "mechanical-box",
    "fixed-object",
  ])("accepts fixed-element kind %s", (kind) => {
    expect(validateSource(createSvg({ "fixed-elements": fixedElement(kind) })).valid).toBe(true);
  });

  it("rejects an unknown fixed-element kind", () => {
    expectError(
      validateSource(createSvg({ "fixed-elements": fixedElement("furniture") })),
      APARTMENT_SVG_VALIDATION_CODES.fixedElement.invalidAttributeValue,
      { attribute: "data-kind" },
    );
  });

  it("preserves exact dimensions and permits a radiator's unresolved optional wall", () => {
    const precise = "10.00000000000000000000000000000000001";
    const result = validateSource(
      createSvg({
        "fixed-elements": fixedElement("radiator", { x: precise, "data-wall": "missing-wall" }),
      }),
    );
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.document.fixedElements[0]?.x.toString()).toBe(precise);
      expect(result.document.fixedElements[0]).toEqual(
        expect.objectContaining({ kind: "radiator", wallId: "missing-wall" }),
      );
    }
  });

  it("validates numeric values and status without enforcing column recommendations", () => {
    expectError(
      validateSource(createSvg({ "fixed-elements": fixedElement("column", { width: "0" }) })),
      APARTMENT_SVG_VALIDATION_CODES.fixedElement.invalidAttributeValue,
      { attribute: "width" },
    );
    expectError(
      validateSource(
        createSvg({ "fixed-elements": fixedElement("column", { "data-base-z": "-1" }) }),
      ),
      APARTMENT_SVG_VALIDATION_CODES.fixedElement.invalidAttributeValue,
      { attribute: "data-base-z" },
    );
    expectError(
      validateSource(
        createSvg({ "fixed-elements": fixedElement("column", { "data-height": "0" }) }),
      ),
      APARTMENT_SVG_VALIDATION_CODES.fixedElement.invalidAttributeValue,
      { attribute: "data-height" },
    );
    expectError(
      validateSource(
        createSvg({ "fixed-elements": fixedElement("column", { "data-status": "unknown" }) }),
      ),
      APARTMENT_SVG_VALIDATION_CODES.fixedElement.invalidAttributeValue,
      { attribute: "data-status" },
    );
    expect(
      validateSource(
        createSvg({
          "fixed-elements": fixedElement("column", { "data-base-z": "15", "data-height": "50" }),
        }),
      ).valid,
    ).toBe(true);
  });

  it("enforces fixed-element wall and type-description conditionals", () => {
    expectError(
      validateSource(
        createSvg({ "fixed-elements": fixedElement("radiator", { "data-wall": "" }) }),
      ),
      APARTMENT_SVG_VALIDATION_CODES.fixedElement.invalidAttributeValue,
      { attribute: "data-wall" },
    );
    expectError(
      validateSource(
        createSvg({ "fixed-elements": fixedElement("column", { "data-wall": "wall-1" }) }),
      ),
      APARTMENT_SVG_VALIDATION_CODES.fixedElement.conditionalAttribute,
      { attribute: "data-wall" },
    );
    expectError(
      validateSource(
        createSvg({
          "fixed-elements": fixedElement("fixed-object", { "data-type-description": null }),
        }),
      ),
      APARTMENT_SVG_VALIDATION_CODES.fixedElement.conditionalAttribute,
      { attribute: "data-type-description" },
    );
    expectError(
      validateSource(
        createSvg({
          "fixed-elements": fixedElement("fixed-object", { "data-type-description": "" }),
        }),
      ),
      APARTMENT_SVG_VALIDATION_CODES.fixedElement.conditionalAttribute,
      { attribute: "data-type-description" },
    );
    expectError(
      validateSource(
        createSvg({ "fixed-elements": fixedElement("boiler", { "data-type-description": "No" }) }),
      ),
      APARTMENT_SVG_VALIDATION_CODES.fixedElement.conditionalAttribute,
      { attribute: "data-type-description" },
    );
  });
});

describe("utilities schema", () => {
  it.each(["socket", "ethernet", "tv-coax", "light-switch", "ceiling-light", "wall-light"])(
    "accepts utility kind %s",
    (kind) => {
      expect(validateSource(createSvg({ utilities: utility(kind) })).valid).toBe(true);
    },
  );

  it("rejects an unknown utility kind", () => {
    expectError(
      validateSource(createSvg({ utilities: utility("water") })),
      APARTMENT_SVG_VALIDATION_CODES.utility.invalidAttributeValue,
      { attribute: "data-kind" },
    );
  });

  it("preserves exact values and unresolved wall IDs without placement checks", () => {
    const precise = "20.12345678901234567890123456789";
    const result = validateSource(
      createSvg({
        utilities: utility("socket", { cx: precise, cy: "999", "data-wall": "missing" }),
      }),
    );
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.document.utilities[0]?.cx.toString()).toBe(precise);
      expect(result.document.utilities[0]).toEqual(expect.objectContaining({ wallId: "missing" }));
    }
  });

  it("requires positive marker radius and nonnegative Z", () => {
    expectError(
      validateSource(createSvg({ utilities: utility("socket", { r: "0" }) })),
      APARTMENT_SVG_VALIDATION_CODES.utility.invalidAttributeValue,
      { attribute: "r" },
    );
    expectError(
      validateSource(createSvg({ utilities: utility("socket", { "data-z": "-1" }) })),
      APARTMENT_SVG_VALIDATION_CODES.utility.invalidAttributeValue,
      { attribute: "data-z" },
    );
  });

  it.each(["socket", "ethernet", "tv-coax", "light-switch", "wall-light"])(
    "requires data-wall for %s",
    (kind) => {
      expectError(
        validateSource(createSvg({ utilities: utility(kind, { "data-wall": null }) })),
        APARTMENT_SVG_VALIDATION_CODES.utility.conditionalAttribute,
        { attribute: "data-wall" },
      );
    },
  );

  it("prohibits data-wall for ceiling-light", () => {
    expectError(
      validateSource(createSvg({ utilities: utility("ceiling-light", { "data-wall": "wall-1" }) })),
      APARTMENT_SVG_VALIDATION_CODES.utility.conditionalAttribute,
      { attribute: "data-wall" },
    );
  });

  it.each(["fixed", "modifiable", "proposal"])("accepts optional utility status %s", (status) => {
    expect(
      validateSource(createSvg({ utilities: utility("socket", { "data-status": status }) })).valid,
    ).toBe(true);
  });

  it("rejects invalid optional utility status", () => {
    expectError(
      validateSource(createSvg({ utilities: utility("socket", { "data-status": "Fixed" }) })),
      APARTMENT_SVG_VALIDATION_CODES.utility.invalidAttributeValue,
      { attribute: "data-status" },
    );
  });
});

describe("cameras schema", () => {
  it("accepts and preserves exact camera values", () => {
    const precise = "30.12345678901234567890123456789";
    const result = validateSource(
      createSvg({ cameras: camera({ cx: precise, "data-z": precise }) }),
    );
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.document.cameras[0]?.cx.toString()).toBe(precise);
      expect(result.document.cameras[0]?.z.toString()).toBe(precise);
    }
  });

  it("requires positive marker radius and nonnegative Z", () => {
    expectError(
      validateSource(createSvg({ cameras: camera({ r: "0" }) })),
      APARTMENT_SVG_VALIDATION_CODES.camera.invalidAttributeValue,
      { attribute: "r" },
    );
    expectError(
      validateSource(createSvg({ cameras: camera({ "data-z": "-1" }) })),
      APARTMENT_SVG_VALIDATION_CODES.camera.invalidAttributeValue,
      { attribute: "data-z" },
    );
  });

  it.each(["0", "359.999999999999999999999999999"])("accepts heading boundary %s", (heading) => {
    expect(validateSource(createSvg({ cameras: camera({ "data-heading": heading }) })).valid).toBe(
      true,
    );
  });

  it.each(["-0.0001", "360"])("rejects heading %s", (heading) => {
    expectError(
      validateSource(createSvg({ cameras: camera({ "data-heading": heading }) })),
      APARTMENT_SVG_VALIDATION_CODES.camera.invalidAttributeValue,
      { attribute: "data-heading" },
    );
  });

  it.each(["-89.999999999999999", "0", "89.999999999999999"])("accepts pitch %s", (pitch) => {
    expect(validateSource(createSvg({ cameras: camera({ "data-pitch": pitch }) })).valid).toBe(
      true,
    );
  });

  it.each(["-90", "90"])("rejects pitch boundary %s", (pitch) => {
    expectError(
      validateSource(createSvg({ cameras: camera({ "data-pitch": pitch }) })),
      APARTMENT_SVG_VALIDATION_CODES.camera.invalidAttributeValue,
      { attribute: "data-pitch" },
    );
  });

  it.each(["0.0000000000000000000000000001", "179.999999999999999999999999"])(
    "accepts horizontal FOV %s",
    (fov) => {
      expect(
        validateSource(createSvg({ cameras: camera({ "data-horizontal-fov": fov }) })).valid,
      ).toBe(true);
    },
  );

  it.each(["0", "180"])("rejects horizontal FOV boundary %s", (fov) => {
    expectError(
      validateSource(createSvg({ cameras: camera({ "data-horizontal-fov": fov }) })),
      APARTMENT_SVG_VALIDATION_CODES.camera.invalidAttributeValue,
      { attribute: "data-horizontal-fov", rule: "camera.data-horizontal-fov-range" },
    );
  });

  it("rejects an invalid FOV Number lexeme", () => {
    expectError(
      validateSource(createSvg({ cameras: camera({ "data-horizontal-fov": "1e2" }) })),
      APARTMENT_SVG_VALIDATION_CODES.camera.invalidAttributeValue,
      { attribute: "data-horizontal-fov", rule: "camera.data-horizontal-fov-number" },
    );
  });
});

describe("annotations and schema-stage boundaries", () => {
  it("leaves nested annotation graphics opaque and outside the semantic index", () => {
    const result = validateSource(
      createSvg({
        walls: wall(),
        annotations:
          '<g id="annotation-group" transform="translate(1 2)"><rect id="annotation-rect" data-kind="wall" transform="scale(2)" /></g>',
      }),
    );
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.document.semanticElementsById.has("annotation-group")).toBe(false);
    expect(result.document.semanticElementsById.has("annotation-rect")).toBe(false);
    expect(result.document.walls).toHaveLength(1);
  });

  it("accepts broken references and deliberately deferred geometry/topology errors", () => {
    const result = validateSource(
      createSvg({
        spaces: space({ points: "0,0 1,1" }),
        walls: wall({ x: "0", y: "0", width: "10", height: "100", "data-axis": "x" }),
        windows: windowElement({
          x: "999",
          y: "999",
          "data-wall": "missing-wall",
          "data-radiator-below": "missing-radiator",
        }),
        doors: door("hinged", {
          x: "999",
          y: "999",
          "data-wall": "missing-wall",
          "data-hinge-x": "3",
          "data-hinge-y": "7",
          "data-open-leaf-x": "11",
          "data-open-leaf-y": "13",
        }),
        utilities: utility("socket", { cx: "999", cy: "999", "data-wall": "missing-wall" }),
        cameras: camera({ cx: "1", cy: "1", "data-z": "1" }),
      }),
    );
    expect(result.valid).toBe(true);
  });
});

describe("fixture-based semantic schema validation", () => {
  it("accepts the focused valid semantic fixture", () => {
    expect(validateSource(readFixture("valid/minimal-semantic-schema.svg")).valid).toBe(true);
  });

  it("reports the intended duplicate-ID fixture error", () => {
    const result = validateSource(readFixture("invalid/duplicate-semantic-id.svg"));
    expectError(result, APARTMENT_SVG_VALIDATION_CODES.id.duplicate, { elementId: "duplicate" });
    expect(result.errors).toHaveLength(1);
  });
});

interface SvgOptions {
  readonly metadataPayload?: string;
  readonly omitGroup?: GroupId;
  readonly extraGroups?: string;
  readonly viewBox?: string;
}

function createSvg(
  contents: Partial<Record<GroupId, string>> = {},
  options: SvgOptions = {},
): string {
  const groups = GROUP_IDS.filter((id) => id !== options.omitGroup)
    .map((id) => `<g id="${id}">${contents[id] ?? ""}</g>`)
    .join("\n");
  return `<svg xmlns="${SVG_NAMESPACE_URI}" viewBox="${options.viewBox ?? "0 0 500 400"}" data-schema="apartment-svg" data-schema-version="2.1" data-unit="cm">
    <metadata><![CDATA[${options.metadataPayload ?? JSON.stringify(minimumMetadata())}]]></metadata>
    ${groups}
    ${options.extraGroups ?? ""}
  </svg>`;
}

function space(overrides: AttributeOverrides = {}, children = ""): string {
  return tag("polygon", { ...spaceAttributes(), ...overrides }, children);
}

function spaceAttributes(): Record<string, string | null> {
  return {
    id: "space-1",
    points: "0,0 100,0 100,100 0,100",
    "data-kind": "zone",
    "data-name": "Living room",
    "data-function": "living-room",
    "data-function-description": null,
    "data-enclosure": "closed",
  };
}

function wall(overrides: AttributeOverrides = {}, children = ""): string {
  return tag("rect", { ...wallAttributes(), ...overrides }, children);
}

function wallAttributes(): Record<string, string | null> {
  return {
    id: "wall-1",
    x: "0",
    y: "0",
    width: "100",
    height: "10",
    "data-kind": "wall",
    "data-axis": "x",
    "data-height": null,
    "data-class": "interior",
    "data-status": "fixed",
  };
}

function windowElement(overrides: AttributeOverrides = {}, children = ""): string {
  return tag(
    "rect",
    {
      id: "window-1",
      x: "10",
      y: "0",
      width: "30",
      height: "10",
      "data-kind": "window",
      "data-wall": "wall-1",
      "data-sill-height": "80",
      "data-opening-height": "120",
      "data-opening-type": null,
      "data-frame-material": null,
      "data-frame-material-description": null,
      "data-frame-color": null,
      "data-glass-type": null,
      "data-glass-type-description": null,
      "data-radiator-below": null,
      "data-status": "fixed",
      ...overrides,
    },
    children,
  );
}

function door(doorType: string, overrides: AttributeOverrides = {}): string {
  const hinged = doorType === "hinged";
  return tag("rect", {
    id: "door-1",
    x: "20",
    y: "0",
    width: "30",
    height: "10",
    "data-kind": "door",
    "data-wall": "wall-1",
    "data-door-type": doorType,
    "data-opening-height": "210",
    "data-hinge-x": hinged ? "20" : null,
    "data-hinge-y": hinged ? "5" : null,
    "data-open-leaf-x": hinged ? "20" : null,
    "data-open-leaf-y": hinged ? "-25" : null,
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
    "data-wall": null,
    "data-type-description": kind === "fixed-object" ? "Custom cabinet" : null,
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
    "data-status": null,
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

function tag(name: string, attributes: AttributeOverrides, children = ""): string {
  return `<${name} ${attributesMarkup(attributes)}>${children}</${name}>`;
}

function attributesMarkup(attributes: AttributeOverrides): string {
  return Object.entries(attributes)
    .filter((entry): entry is [string, string] => entry[1] !== null)
    .map(([name, value]) => `${name}="${value}"`)
    .join(" ");
}

function minimumMetadata(): Record<string, unknown> {
  return {
    schema: "apartment-svg/2.1",
    project: { name: "Semantic schema test", units: "cm" },
    coordinateSystem: {
      x: "right",
      y: "down",
      z: "up",
      headingDegrees: { 0: "+x", 90: "+y", 180: "-x", 270: "-y" },
    },
    level: { id: "level-0", baseZ: 0, defaultCeilingHeight: 242 },
  };
}

function metadataWithLocation(): Record<string, unknown> {
  return {
    ...minimumMetadata(),
    location: {
      latitude: 47.4979,
      longitude: 19.0402,
      elevationMeters: 105,
      timeZone: "Europe/Budapest",
      northHeading: 270,
    },
  };
}

function parseSource(source: string): ParsedApartmentSvgDocument {
  const result = parseApartmentSvg(source);
  if (!result.ok) throw new Error(`Expected XML parsing to succeed: ${result.error.message}`);
  return result.document;
}

function validateSource(source: string): ApartmentSvgSchemaValidationResult {
  return validateApartmentSvgSchema(parseSource(source));
}

function expectError(
  result: ApartmentSvgSchemaValidationResult,
  code: ApartmentSvgValidationCode,
  context: Partial<ApartmentSvgValidationError> = {},
): void {
  expect(result.valid).toBe(false);
  expect(result.errors).toContainEqual(expect.objectContaining({ code, ...context }));
}

function expectNoError(
  result: ApartmentSvgSchemaValidationResult,
  code: ApartmentSvgValidationCode,
): void {
  expect(result.errors.some((error) => error.code === code)).toBe(false);
}

function readFixture(relativePath: string): string {
  return readFileSync(new URL(`../../../fixtures/${relativePath}`, import.meta.url), "utf8");
}
