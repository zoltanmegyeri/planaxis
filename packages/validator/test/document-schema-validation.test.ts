import { readFileSync } from "node:fs";

import { parseApartmentSvg } from "@planaxis/parser";
import type { ParsedApartmentSvgDocument } from "@planaxis/parser";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  APARTMENT_SVG_VALIDATION_CODES,
  validateApartmentSvgDocumentSchema,
} from "../src/index.js";
import type {
  ApartmentSvgValidationCode,
  ApartmentSvgValidationError,
  ApartmentSvgValidationResult,
} from "../src/index.js";

const SVG_NAMESPACE_URI = "http://www.w3.org/2000/svg";
const REQUIRED_GROUP_IDS = [
  "spaces",
  "walls",
  "windows",
  "doors",
  "fixed-elements",
  "utilities",
  "cameras",
  "annotations",
] as const;

describe("validateApartmentSvgDocumentSchema public contract", () => {
  it("exposes the stable public validation codes", () => {
    expect(APARTMENT_SVG_VALIDATION_CODES).toEqual({
      root: {
        invalidElementForm: "APSVG-ROOT-001",
        invalidNamespace: "APSVG-ROOT-002",
        missingAttribute: "APSVG-ROOT-003",
        invalidAttributeValue: "APSVG-ROOT-004",
        invalidViewBox: "APSVG-ROOT-005",
        invalidViewBoxExtent: "APSVG-ROOT-006",
      },
      metadata: {
        missing: "APSVG-METADATA-001",
        duplicate: "APSVG-METADATA-002",
        invalidContentForm: "APSVG-METADATA-003",
        invalidJson: "APSVG-METADATA-004",
        invalidRoot: "APSVG-METADATA-005",
        missingProperty: "APSVG-METADATA-006",
        invalidPropertyType: "APSVG-METADATA-007",
        invalidPropertyValue: "APSVG-METADATA-008",
        unknownProperty: "APSVG-METADATA-009",
        unitsMismatch: "APSVG-METADATA-010",
      },
      group: {
        missingRequiredGroup: "APSVG-GROUP-001",
        duplicateRequiredGroup: "APSVG-GROUP-002",
        invalidRequiredGroupForm: "APSVG-GROUP-003",
        unknownRootElement: "APSVG-GROUP-004",
        unknownGroup: "APSVG-GROUP-005",
        prohibitedTransform: "APSVG-GROUP-006",
      },
      semantic: {
        invalidElementType: "APSVG-SEMANTIC-001",
        invalidNamespace: "APSVG-SEMANTIC-002",
        missingAttribute: "APSVG-SEMANTIC-003",
        prohibitedAttribute: "APSVG-SEMANTIC-004",
        unknownAttribute: "APSVG-SEMANTIC-005",
        nestedSemanticElement: "APSVG-SEMANTIC-006",
      },
      id: {
        missing: "APSVG-ID-001",
        invalid: "APSVG-ID-002",
        duplicate: "APSVG-ID-003",
      },
      zone: {
        invalidAttributeValue: "APSVG-ZONE-101",
        malformedPoints: "APSVG-ZONE-102",
        invalidPointNumber: "APSVG-ZONE-103",
        conditionalAttribute: "APSVG-ZONE-104",
      },
      wall: {
        invalidAxisGeometry: "APSVG-WALL-001",
        invalidAttributeValue: "APSVG-WALL-101",
      },
      window: {
        invalidWallThicknessCoverage: "APSVG-WINDOW-001",
        outsideWallLongitudinalExtent: "APSVG-WINDOW-002",
        exceedsWallHeight: "APSVG-WINDOW-003",
        invalidAttributeValue: "APSVG-WINDOW-101",
        conditionalAttribute: "APSVG-WINDOW-102",
      },
      door: {
        invalidHingePoint: "APSVG-DOOR-001",
        invalidOpenLeafPoint: "APSVG-DOOR-002",
        invalidWallThicknessCoverage: "APSVG-DOOR-003",
        outsideWallLongitudinalExtent: "APSVG-DOOR-004",
        exceedsWallHeight: "APSVG-DOOR-005",
        invalidAttributeValue: "APSVG-DOOR-101",
        conditionalAttribute: "APSVG-DOOR-102",
      },
      fixedElement: {
        invalidAttributeValue: "APSVG-FIXED-101",
        conditionalAttribute: "APSVG-FIXED-102",
      },
      utility: {
        invalidAttributeValue: "APSVG-UTILITY-101",
        conditionalAttribute: "APSVG-UTILITY-102",
      },
      camera: {
        invalidAttributeValue: "APSVG-CAMERA-101",
      },
      reference: {
        broken: "APSVG-REF-001",
        wrongKind: "APSVG-REF-002",
      },
    });
  });

  it("accepts a parser-owned document and returns a discriminated result", () => {
    expectTypeOf(validateApartmentSvgDocumentSchema)
      .parameter(0)
      .toEqualTypeOf<ParsedApartmentSvgDocument>();
    expectTypeOf(
      validateApartmentSvgDocumentSchema,
    ).returns.toEqualTypeOf<ApartmentSvgValidationResult>();

    const result = validateSource(createSvg());

    expect(result).toEqual({ valid: true, errors: [] });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.errors)).toBe(true);
  });

  it("aggregates independent root, metadata, and group errors with structured context", () => {
    const metadata = createMinimumMetadata();
    requireObject(metadata, "project").name = "";
    const result = validateSource(
      createSvg({
        dataSchemaVersion: "2.0",
        metadataMarkup: metadataMarkup(metadata),
        groups: [
          ...defaultGroups().filter((markup) => !markup.includes('id="cameras"')),
          group("mystery"),
        ],
      }),
    );

    expect(result.valid).toBe(false);
    expectError(result, APARTMENT_SVG_VALIDATION_CODES.root.invalidAttributeValue, {
      attribute: "data-schema-version",
      actual: "2.0",
    });
    expectError(result, APARTMENT_SVG_VALIDATION_CODES.metadata.invalidPropertyValue, {
      path: "$.project.name",
    });
    expectError(result, APARTMENT_SVG_VALIDATION_CODES.group.missingRequiredGroup, {
      elementId: "cameras",
    });
    expectError(result, APARTMENT_SVG_VALIDATION_CODES.group.unknownGroup, {
      elementId: "mystery",
    });

    const firstError = result.errors[0];
    expect(firstError).toEqual(
      expect.objectContaining({
        code: expect.stringMatching(/^APSVG-[A-Z]+-[0-9]{3}$/u),
        category: expect.any(String),
        rule: expect.any(String),
        expected: expect.any(String),
        message: expect.any(String),
      }),
    );
  });
});

describe("root document validation", () => {
  it("accepts the canonical root and a valid exact-decimal viewBox", () => {
    expect(validateSource(createSvg({ viewBox: "-30.25 -0.1 440.0001 500" }))).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("rejects a namespace-equivalent prefixed root form", () => {
    const result = validateSource(
      createSvg({
        rootName: "s:svg",
        namespaceDeclaration: `xmlns:s="${SVG_NAMESPACE_URI}" xmlns="${SVG_NAMESPACE_URI}"`,
      }),
    );

    expectError(result, APARTMENT_SVG_VALIDATION_CODES.root.invalidElementForm, {
      actual: "s:svg",
    });
  });

  it("rejects an incorrect root namespace form", () => {
    const result = validateSource(
      createSvg({ namespaceDeclaration: 'xmlns="urn:example:not-svg"' }),
    );

    expectError(result, APARTMENT_SVG_VALIDATION_CODES.root.invalidNamespace, {
      attribute: "xmlns",
    });
  });

  it("reports every missing required root schema attribute", () => {
    const result = validateSource(
      createSvg({ viewBox: null, dataSchema: null, dataSchemaVersion: null, dataUnit: null }),
    );

    for (const attribute of ["viewBox", "data-schema", "data-schema-version", "data-unit"]) {
      expectError(result, APARTMENT_SVG_VALIDATION_CODES.root.missingAttribute, { attribute });
    }
  });

  it.each([
    ["data-schema", { dataSchema: "floor-plan" }],
    ["data-schema-version", { dataSchemaVersion: "2.0" }],
    ["data-unit", { dataUnit: "mm" }],
  ] as const)("rejects an invalid %s value", (attribute, options) => {
    const result = validateSource(createSvg(options));

    expectError(result, APARTMENT_SVG_VALIDATION_CODES.root.invalidAttributeValue, { attribute });
  });

  it("rejects a viewBox with the wrong arity", () => {
    const result = validateSource(createSvg({ viewBox: "0 0 500" }));

    expectError(result, APARTMENT_SVG_VALIDATION_CODES.root.invalidViewBox, {
      attribute: "viewBox",
      rule: "root.viewBox-arity",
    });
  });

  it.each(["0 0 1e3 400", "0 0 12cm 400", "0 0 NaN 400"])(
    "rejects a nonconforming Number lexeme in viewBox: %s",
    (viewBox) => {
      const result = validateSource(createSvg({ viewBox }));

      expectError(result, APARTMENT_SVG_VALIDATION_CODES.root.invalidViewBox, {
        rule: "root.viewBox-number-lexemes",
        actual: viewBox,
      });
    },
  );

  it.each([
    ["0 0 0 400", "root.viewBox-width"],
    ["0 0 -1 400", "root.viewBox-width"],
    ["0 0 500 0", "root.viewBox-height"],
    ["0 0 500 -1", "root.viewBox-height"],
  ])("rejects a non-positive viewBox extent in %s", (viewBox, rule) => {
    const result = validateSource(createSvg({ viewBox }));

    expectError(result, APARTMENT_SVG_VALIDATION_CODES.root.invalidViewBoxExtent, { rule });
  });
});

describe("metadata XML content validation", () => {
  it("requires exactly one direct metadata element", () => {
    const missingResult = validateSource(createSvg({ metadataMarkup: null }));
    const duplicateResult = validateSource(
      createSvg({
        metadataMarkup: `${metadataMarkup(createMinimumMetadata())}${metadataMarkup(
          createMinimumMetadata(),
        )}`,
      }),
    );

    expectError(missingResult, APARTMENT_SVG_VALIDATION_CODES.metadata.missing);
    expectError(duplicateResult, APARTMENT_SVG_VALIDATION_CODES.metadata.duplicate, {
      actual: "2",
    });
    expectNoError(duplicateResult, APARTMENT_SVG_VALIDATION_CODES.metadata.missingProperty);
  });

  it("accepts one CDATA payload with surrounding whitespace-only text", () => {
    const json = JSON.stringify(createMinimumMetadata());
    const result = validateSource(
      createSvg({ metadataMarkup: `<metadata>\n  <![CDATA[${json}]]>\n</metadata>` }),
    );

    expect(result.valid).toBe(true);
  });

  it.each([
    ["meaningful ordinary text", `<metadata>${JSON.stringify(createMinimumMetadata())}</metadata>`],
    [
      "a child element",
      `<metadata><![CDATA[${JSON.stringify(createMinimumMetadata())}]]><title>extra</title></metadata>`,
    ],
    [
      "a comment",
      `<metadata><!-- extra --><![CDATA[${JSON.stringify(createMinimumMetadata())}]]></metadata>`,
    ],
    ["multiple payloads", "<metadata><![CDATA[{}]]><![CDATA[{}]]></metadata>"],
  ])("rejects metadata containing %s", (_description, metadataMarkupValue) => {
    const result = validateSource(createSvg({ metadataMarkup: metadataMarkupValue }));

    expectError(result, APARTMENT_SVG_VALIDATION_CODES.metadata.invalidContentForm);
    expectNoError(result, APARTMENT_SVG_VALIDATION_CODES.metadata.invalidJson);
    expectNoError(result, APARTMENT_SVG_VALIDATION_CODES.metadata.missingProperty);
  });

  it("reports malformed metadata JSON without fabricating property errors", () => {
    const result = validateSource(
      createSvg({ metadataMarkup: rawMetadataMarkup('{"schema":"apartment-svg/2.1", nope}') }),
    );

    expectError(result, APARTMENT_SVG_VALIDATION_CODES.metadata.invalidJson);
    expectNoError(result, APARTMENT_SVG_VALIDATION_CODES.metadata.missingProperty);
  });

  it.each(["[]", '"metadata"', "1", "true", "null"])(
    "rejects a non-object metadata JSON root: %s",
    (payload) => {
      const result = validateSource(createSvg({ metadataMarkup: rawMetadataMarkup(payload) }));

      expectError(result, APARTMENT_SVG_VALIDATION_CODES.metadata.invalidRoot, { path: "$" });
      expectNoError(result, APARTMENT_SVG_VALIDATION_CODES.metadata.missingProperty);
    },
  );
});

describe("metadata schema validation", () => {
  it("accepts the normative minimum metadata object", () => {
    expect(validateSource(createSvg()).valid).toBe(true);
  });

  it.each([
    ["schema", (metadata: Record<string, unknown>) => delete metadata.schema],
    [
      "project.name",
      (metadata: Record<string, unknown>) => delete requireObject(metadata, "project").name,
    ],
    [
      "coordinateSystem.x",
      (metadata: Record<string, unknown>) => delete requireObject(metadata, "coordinateSystem").x,
    ],
    [
      "level.defaultCeilingHeight",
      (metadata: Record<string, unknown>) =>
        delete requireObject(metadata, "level").defaultCeilingHeight,
    ],
  ] as const)("reports the missing required metadata field %s", (path, removeField) => {
    const metadata = createMinimumMetadata();
    removeField(metadata);
    const result = validateSource(createSvg({ metadataMarkup: metadataMarkup(metadata) }));

    expectError(result, APARTMENT_SVG_VALIDATION_CODES.metadata.missingProperty, {
      path: `$.${path}`,
    });
  });

  it.each(["0", "90", "180", "270"])("reports a missing coordinate heading entry %s", (heading) => {
    const metadata = createMinimumMetadata();
    const headings = requireObject(requireObject(metadata, "coordinateSystem"), "headingDegrees");
    delete headings[heading];
    const result = validateSource(createSvg({ metadataMarkup: metadataMarkup(metadata) }));

    expectError(result, APARTMENT_SVG_VALIDATION_CODES.metadata.missingProperty, {
      path: `$.coordinateSystem.headingDegrees.${heading}`,
    });
  });

  it.each([
    [
      "$.schema",
      (metadata: Record<string, unknown>): void => {
        metadata.schema = true;
      },
    ],
    [
      "$.project",
      (metadata: Record<string, unknown>): void => {
        metadata.project = [];
      },
    ],
    [
      "$.level.baseZ",
      (metadata: Record<string, unknown>): void => {
        requireObject(metadata, "level").baseZ = "0";
      },
    ],
    [
      "$.location",
      (metadata: Record<string, unknown>): void => {
        metadata.location = null;
      },
    ],
  ] as const)("rejects the wrong JSON value type at %s", (path, changeType) => {
    const metadata = createMinimumMetadata();
    changeType(metadata);
    const result = validateSource(createSvg({ metadataMarkup: metadataMarkup(metadata) }));

    expectError(result, APARTMENT_SVG_VALIDATION_CODES.metadata.invalidPropertyType, { path });
  });

  it.each([
    [
      "$.schema",
      (metadata: Record<string, unknown>): void => {
        metadata.schema = "apartment-svg/2.0";
      },
    ],
    [
      "$.project.units",
      (metadata: Record<string, unknown>): void => {
        requireObject(metadata, "project").units = "mm";
      },
    ],
    [
      "$.coordinateSystem.x",
      (metadata: Record<string, unknown>): void => {
        requireObject(metadata, "coordinateSystem").x = "left";
      },
    ],
    [
      "$.coordinateSystem.headingDegrees.90",
      (metadata: Record<string, unknown>): void => {
        requireObject(requireObject(metadata, "coordinateSystem"), "headingDegrees")["90"] = "-y";
      },
    ],
  ] as const)("rejects an invalid metadata constant at %s", (path, changeValue) => {
    const metadata = createMinimumMetadata();
    changeValue(metadata);
    const result = validateSource(createSvg({ metadataMarkup: metadataMarkup(metadata) }));

    expectError(result, APARTMENT_SVG_VALIDATION_CODES.metadata.invalidPropertyValue, { path });
  });

  it("rejects an empty project name", () => {
    const metadata = createMinimumMetadata();
    requireObject(metadata, "project").name = "";
    const result = validateSource(createSvg({ metadataMarkup: metadataMarkup(metadata) }));

    expectError(result, APARTMENT_SVG_VALIDATION_CODES.metadata.invalidPropertyValue, {
      path: "$.project.name",
      actual: '""',
    });
  });

  it("rejects an invalid level Id", () => {
    const metadata = createMinimumMetadata();
    requireObject(metadata, "level").id = "1-invalid";
    const result = validateSource(createSvg({ metadataMarkup: metadataMarkup(metadata) }));

    expectError(result, APARTMENT_SVG_VALIDATION_CODES.metadata.invalidPropertyValue, {
      path: "$.level.id",
    });
  });

  it("rejects an invalid Number lexeme in level.baseZ", () => {
    const payload = JSON.stringify(createMinimumMetadata()).replace('"baseZ":0', '"baseZ":1e3');
    const result = validateSource(createSvg({ metadataMarkup: rawMetadataMarkup(payload) }));

    expectError(result, APARTMENT_SVG_VALIDATION_CODES.metadata.invalidPropertyValue, {
      path: "$.level.baseZ",
      actual: "1e3",
    });
  });

  it.each(["0", "-1"])("rejects non-positive level.defaultCeilingHeight %s", (ceilingHeight) => {
    const payload = JSON.stringify(createMinimumMetadata()).replace(
      '"defaultCeilingHeight":242',
      `"defaultCeilingHeight":${ceilingHeight}`,
    );
    const result = validateSource(createSvg({ metadataMarkup: rawMetadataMarkup(payload) }));

    expectError(result, APARTMENT_SVG_VALIDATION_CODES.metadata.invalidPropertyValue, {
      path: "$.level.defaultCeilingHeight",
    });
  });

  it("reports metadata/root unit disagreement", () => {
    const metadata = createMinimumMetadata();
    requireObject(metadata, "project").units = "m";
    const result = validateSource(
      createSvg({ dataUnit: "mm", metadataMarkup: metadataMarkup(metadata) }),
    );

    expectError(result, APARTMENT_SVG_VALIDATION_CODES.metadata.unitsMismatch, {
      path: "$.project.units",
      attribute: "data-unit",
    });
  });
});

describe("optional location metadata", () => {
  it("does not invent or require a location object", () => {
    expect(validateSource(createSvg()).valid).toBe(true);
  });

  it("accepts a complete valid location with optional elevation and time zone", () => {
    const metadata = metadataWithLocation();
    const result = validateSource(createSvg({ metadataMarkup: metadataMarkup(metadata) }));

    expect(result.valid).toBe(true);
  });

  it("accepts location when optional elevationMeters and timeZone are omitted", () => {
    const metadata = metadataWithLocation();
    const location = requireObject(metadata, "location");
    delete location.elevationMeters;
    delete location.timeZone;

    expect(validateSource(createSvg({ metadataMarkup: metadataMarkup(metadata) })).valid).toBe(
      true,
    );
  });

  it.each(["latitude", "longitude", "northHeading"])(
    "requires location.%s when location exists",
    (field) => {
      const metadata = metadataWithLocation();
      delete requireObject(metadata, "location")[field];
      const result = validateSource(createSvg({ metadataMarkup: metadataMarkup(metadata) }));

      expectError(result, APARTMENT_SVG_VALIDATION_CODES.metadata.missingProperty, {
        path: `$.location.${field}`,
      });
    },
  );

  it.each(["-90", "90"])("accepts latitude boundary %s", (latitude) => {
    expect(validateLocationNumber("latitude", latitude).valid).toBe(true);
  });

  it.each(["-90.0000000000000000001", "90.0000000000000000001"])(
    "rejects latitude outside the exact boundary: %s",
    (latitude) => {
      const result = validateLocationNumber("latitude", latitude);
      expectError(result, APARTMENT_SVG_VALIDATION_CODES.metadata.invalidPropertyValue, {
        path: "$.location.latitude",
        actual: latitude,
      });
    },
  );

  it.each(["-180", "180"])("accepts longitude boundary %s", (longitude) => {
    expect(validateLocationNumber("longitude", longitude).valid).toBe(true);
  });

  it.each(["-180.0001", "180.0001"])("rejects longitude outside the boundary: %s", (value) => {
    const result = validateLocationNumber("longitude", value);
    expectError(result, APARTMENT_SVG_VALIDATION_CODES.metadata.invalidPropertyValue, {
      path: "$.location.longitude",
    });
  });

  it.each(["0", "359.999999999999999999999999999999999999999999999999"])(
    "accepts the northHeading boundary behavior for %s",
    (northHeading) => {
      expect(validateLocationNumber("northHeading", northHeading).valid).toBe(true);
    },
  );

  it.each(["-0.0001", "360"])("rejects invalid northHeading %s", (value) => {
    const result = validateLocationNumber("northHeading", value);
    expectError(result, APARTMENT_SVG_VALIDATION_CODES.metadata.invalidPropertyValue, {
      path: "$.location.northHeading",
    });
  });

  it("accepts an optional negative elevationMeters value", () => {
    expect(validateLocationNumber("elevationMeters", "-430.25").valid).toBe(true);
  });

  it.each(["Europe/Budapest", "America/New_York", "Etc/UTC"])(
    "accepts IANA time zone %s",
    (timeZone) => {
      const metadata = metadataWithLocation();
      requireObject(metadata, "location").timeZone = timeZone;
      expect(validateSource(createSvg({ metadataMarkup: metadataMarkup(metadata) })).valid).toBe(
        true,
      );
    },
  );

  it.each(["+02:00", "UTC+2", "Europe/Definitely-Unknown"])(
    "rejects non-IANA or unknown time zone %s",
    (timeZone) => {
      const metadata = metadataWithLocation();
      requireObject(metadata, "location").timeZone = timeZone;
      const result = validateSource(createSvg({ metadataMarkup: metadataMarkup(metadata) }));

      expectError(result, APARTMENT_SVG_VALIDATION_CODES.metadata.invalidPropertyValue, {
        path: "$.location.timeZone",
        actual: JSON.stringify(timeZone),
      });
    },
  );

  it("preserves an IEEE-754-unsafe valid metadata numeric lexeme", () => {
    const exactHeading = "359.999999999999999999999999999999999999999999999999999999";
    const payload = JSON.stringify(metadataWithLocation()).replace(
      '"northHeading":270',
      `"northHeading":${exactHeading}`,
    );
    const result = validateSource(createSvg({ metadataMarkup: rawMetadataMarkup(payload) }));

    expect(Number(exactHeading)).toBe(360);
    expect(result.valid).toBe(true);
  });
});

describe("metadata extension keys", () => {
  it("accepts x-* extension keys and ignores their semantic contents", () => {
    const metadata = metadataWithLocation();
    metadata["x-schema"] = { schema: "not-core", northHeading: 999 };
    requireObject(metadata, "project")["x-units"] = "meters";
    requireObject(metadata, "coordinateSystem")["x-axis"] = "left";
    requireObject(requireObject(metadata, "coordinateSystem"), "headingDegrees")["x-360"] = "+x";
    requireObject(metadata, "level")["x-height"] = -1;
    requireObject(metadata, "location")["x-timeZone"] = "+02:00";

    expect(validateSource(createSvg({ metadataMarkup: metadataMarkup(metadata) })).valid).toBe(
      true,
    );
  });

  it.each([
    [
      "$.unknown",
      (metadata: Record<string, unknown>): void => {
        metadata.unknown = true;
      },
    ],
    [
      "$.project.unknown",
      (metadata: Record<string, unknown>): void => {
        requireObject(metadata, "project").unknown = true;
      },
    ],
    [
      "$.coordinateSystem.unknown",
      (metadata: Record<string, unknown>): void => {
        requireObject(metadata, "coordinateSystem").unknown = true;
      },
    ],
    [
      "$.coordinateSystem.headingDegrees.unknown",
      (metadata: Record<string, unknown>): void => {
        requireObject(requireObject(metadata, "coordinateSystem"), "headingDegrees").unknown = true;
      },
    ],
    [
      "$.level.unknown",
      (metadata: Record<string, unknown>): void => {
        requireObject(metadata, "level").unknown = true;
      },
    ],
    [
      "$.location.unknown",
      (metadata: Record<string, unknown>): void => {
        requireObject(metadata, "location").unknown = true;
      },
    ],
  ] as const)("rejects a non-extension key at %s", (path, addUnknownKey) => {
    const metadata = metadataWithLocation();
    addUnknownKey(metadata);
    const result = validateSource(createSvg({ metadataMarkup: metadataMarkup(metadata) }));

    expectError(result, APARTMENT_SVG_VALIDATION_CODES.metadata.unknownProperty, { path });
  });
});

describe("top-level document and group validation", () => {
  it("accepts all eight empty required groups exactly once in any order", () => {
    const groups = [...defaultGroups()].reverse();

    expect(validateSource(createSvg({ groups })).valid).toBe(true);
  });

  it("reports a missing required group", () => {
    const result = validateSource(
      createSvg({ groups: defaultGroups().filter((markup) => !markup.includes('id="walls"')) }),
    );

    expectError(result, APARTMENT_SVG_VALIDATION_CODES.group.missingRequiredGroup, {
      elementId: "walls",
    });
  });

  it("reports a duplicated required group without validating one arbitrarily", () => {
    const result = validateSource(createSvg({ groups: [...defaultGroups(), group("walls")] }));

    expectError(result, APARTMENT_SVG_VALIDATION_CODES.group.duplicateRequiredGroup, {
      elementId: "walls",
      actual: "2",
    });
    expectNoError(result, APARTMENT_SVG_VALIDATION_CODES.group.prohibitedTransform);
  });

  it("accepts the permitted non-semantic root elements", () => {
    const result = validateSource(
      createSvg({
        extraRootElements:
          '<style>.wall { fill: black; }</style><defs><linearGradient id="visual" /></defs><title>Title</title><desc>Description</desc>',
      }),
    );

    expect(result.valid).toBe(true);
  });

  it("rejects an unknown non-permitted root element", () => {
    const result = validateSource(createSvg({ extraRootElements: '<circle id="decor" />' }));

    expectError(result, APARTMENT_SVG_VALIDATION_CODES.group.unknownRootElement, {
      elementId: "decor",
      actual: "circle",
    });
  });

  it("accepts an x-* extension group without interpreting its contents", () => {
    const result = validateSource(
      createSvg({
        groups: [
          ...defaultGroups(),
          group(
            "x-furniture-prototype",
            ' transform="translate(10 10)"',
            '<unknown-shape data-kind="wall" />',
          ),
        ],
      }),
    );

    expect(result.valid).toBe(true);
  });

  it.each(["mystery", "", undefined])(
    "rejects an unknown non-extension top-level group with id %s",
    (id) => {
      const unknownGroup = id === undefined ? "<g />" : group(id);
      const result = validateSource(createSvg({ groups: [...defaultGroups(), unknownGroup] }));

      expectError(result, APARTMENT_SVG_VALIDATION_CODES.group.unknownGroup);
    },
  );

  it("rejects a differently typed element carrying a required group ID", () => {
    const result = validateSource(
      createSvg({
        groups: [
          ...defaultGroups().filter((markup) => !markup.includes('id="walls"')),
          '<rect id="walls" />',
        ],
      }),
    );

    expectError(result, APARTMENT_SVG_VALIDATION_CODES.group.invalidRequiredGroupForm, {
      elementId: "walls",
      actual: "rect",
    });
    expectNoError(result, APARTMENT_SVG_VALIDATION_CODES.group.missingRequiredGroup);
  });

  it("rejects an alien-namespace g carrying a required group ID", () => {
    const result = validateSource(
      createSvg({
        groups: [
          ...defaultGroups().filter((markup) => !markup.includes('id="walls"')),
          '<x:g xmlns:x="urn:not-svg" id="walls" />',
        ],
      }),
    );

    expectError(result, APARTMENT_SVG_VALIDATION_CODES.group.invalidRequiredGroupForm, {
      elementId: "walls",
      actual: "x:g",
    });
  });

  it("prohibits transform on a core semantic group container", () => {
    const groups = defaultGroups().map((markup) =>
      markup.includes('id="walls"') ? group("walls", ' transform="translate(1 2)"') : markup,
    );
    const result = validateSource(createSvg({ groups }));

    expectError(result, APARTMENT_SVG_VALIDATION_CODES.group.prohibitedTransform, {
      elementId: "walls",
      attribute: "transform",
      actual: "translate(1 2)",
    });
  });

  it("permits transform on the annotations group", () => {
    const groups = defaultGroups().map((markup) =>
      markup.includes('id="annotations"')
        ? group("annotations", ' transform="translate(1 2)"', '<text x="0" y="0">Note</text>')
        : markup,
    );

    expect(validateSource(createSvg({ groups })).valid).toBe(true);
  });

  it("accepts an xml-stylesheet processing instruction without accessing its target", () => {
    const result = validateSource(
      `<?xml-stylesheet type="text/css" href="https://example.invalid/apartment.css"?>${createSvg()}`,
    );

    expect(result.valid).toBe(true);
  });
});

describe("document-schema scope boundary", () => {
  it("does not validate semantic child schemas, IDs, references, or geometry", () => {
    const invalidSemanticContent = [
      group("spaces", "", '<rect id="duplicate" data-kind="not-a-zone" transform="scale(2)" />'),
      group("walls", "", '<circle id="duplicate" data-kind="not-a-wall" data-axis="diagonal" />'),
      group("windows", "", '<path id="window-bad" data-kind="unknown" data-wall="missing-wall" />'),
      group("doors", "", '<line id="door-bad" data-wall="missing-wall" />'),
      group("fixed-elements", "", '<polygon id="fixed-bad" />'),
      group("utilities", "", '<rect id="utility-bad" data-kind="unknown" />'),
      group("cameras", "", '<path id="camera-bad" data-heading="999" />'),
      group("annotations", "", '<g transform="rotate(45)"><path /></g>'),
    ];

    expect(validateSource(createSvg({ groups: invalidSemanticContent })).valid).toBe(true);
  });
});

describe("fixture-based document schema validation", () => {
  it("accepts the focused valid fixture", () => {
    expect(validateSource(readFixture("valid/minimal-document-schema.svg")).valid).toBe(true);
  });

  it("reports the intended primary error for focused invalid fixtures", () => {
    const missingGroupResult = validateSource(readFixture("invalid/missing-cameras-group.svg"));
    const malformedMetadataResult = validateSource(
      readFixture("invalid/malformed-metadata-json.svg"),
    );

    expectError(missingGroupResult, APARTMENT_SVG_VALIDATION_CODES.group.missingRequiredGroup, {
      elementId: "cameras",
    });
    expect(missingGroupResult.errors).toHaveLength(1);

    expectError(malformedMetadataResult, APARTMENT_SVG_VALIDATION_CODES.metadata.invalidJson);
    expect(malformedMetadataResult.errors).toHaveLength(1);
  });
});

interface SvgOptions {
  readonly rootName?: string;
  readonly namespaceDeclaration?: string | null;
  readonly viewBox?: string | null;
  readonly dataSchema?: string | null;
  readonly dataSchemaVersion?: string | null;
  readonly dataUnit?: string | null;
  readonly metadataMarkup?: string | null;
  readonly groups?: readonly string[];
  readonly extraRootElements?: string;
}

function createSvg(options: SvgOptions = {}): string {
  const rootName = options.rootName ?? "svg";
  const namespaceDeclaration = optionOrDefault(
    options.namespaceDeclaration,
    `xmlns="${SVG_NAMESPACE_URI}"`,
  );
  const attributes = [
    namespaceDeclaration,
    attribute("viewBox", optionOrDefault(options.viewBox, "0 0 500 400")),
    attribute("data-schema", optionOrDefault(options.dataSchema, "apartment-svg")),
    attribute("data-schema-version", optionOrDefault(options.dataSchemaVersion, "2.1")),
    attribute("data-unit", optionOrDefault(options.dataUnit, "cm")),
  ].filter((value): value is string => value !== null);
  const metadata = optionOrDefault(options.metadataMarkup, metadataMarkup(createMinimumMetadata()));
  const groups = options.groups ?? defaultGroups();

  return `<${rootName} ${attributes.join(" ")}>
    ${metadata ?? ""}
    ${options.extraRootElements ?? ""}
    ${groups.join("\n")}
  </${rootName}>`;
}

function optionOrDefault<T>(value: T | null | undefined, defaultValue: T): T | null {
  return value === undefined ? defaultValue : value;
}

function attribute(name: string, value: string | null): string | null {
  return value === null ? null : `${name}="${value}"`;
}

function defaultGroups(): string[] {
  return REQUIRED_GROUP_IDS.map((id) => group(id));
}

function group(id: string, attributes = "", content = ""): string {
  return `<g id="${id}"${attributes}>${content}</g>`;
}

function rawMetadataMarkup(payload: string): string {
  return `<metadata><![CDATA[${payload}]]></metadata>`;
}

function metadataMarkup(metadata: Record<string, unknown>): string {
  return rawMetadataMarkup(JSON.stringify(metadata));
}

function createMinimumMetadata(): Record<string, unknown> {
  return {
    schema: "apartment-svg/2.1",
    project: {
      name: "Document schema test apartment",
      units: "cm",
    },
    coordinateSystem: {
      x: "right",
      y: "down",
      z: "up",
      headingDegrees: {
        "0": "+x",
        "90": "+y",
        "180": "-x",
        "270": "-y",
      },
    },
    level: {
      id: "level-0",
      baseZ: 0,
      defaultCeilingHeight: 242,
    },
  };
}

function metadataWithLocation(): Record<string, unknown> {
  return {
    ...createMinimumMetadata(),
    location: {
      latitude: 47.4979,
      longitude: 19.0402,
      elevationMeters: 105,
      timeZone: "Europe/Budapest",
      northHeading: 270,
    },
  };
}

function validateLocationNumber(
  field: "latitude" | "longitude" | "northHeading" | "elevationMeters",
  lexicalValue: string,
): ApartmentSvgValidationResult {
  const payload = JSON.stringify(metadataWithLocation()).replace(
    new RegExp(`"${field}":-?[0-9]+(?:\\.[0-9]+)?`, "u"),
    `"${field}":${lexicalValue}`,
  );
  return validateSource(createSvg({ metadataMarkup: rawMetadataMarkup(payload) }));
}

function requireObject(object: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = object[key];
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Expected test metadata property ${key} to be an object.`);
  }
  return value as Record<string, unknown>;
}

function validateSource(source: string): ApartmentSvgValidationResult {
  const parseResult = parseApartmentSvg(source);
  if (!parseResult.ok) {
    throw new Error(`Expected XML parsing to succeed: ${parseResult.error.message}`);
  }

  return validateApartmentSvgDocumentSchema(parseResult.document);
}

function expectError(
  result: ApartmentSvgValidationResult,
  code: ApartmentSvgValidationCode,
  context: Partial<ApartmentSvgValidationError> = {},
): void {
  expect(result.valid).toBe(false);
  expect(result.errors).toContainEqual(expect.objectContaining({ code, ...context }));
}

function expectNoError(
  result: ApartmentSvgValidationResult,
  code: ApartmentSvgValidationCode,
): void {
  expect(result.errors.some((error) => error.code === code)).toBe(false);
}

function readFixture(relativePath: string): string {
  return readFileSync(new URL(`../../../fixtures/${relativePath}`, import.meta.url), "utf8");
}
