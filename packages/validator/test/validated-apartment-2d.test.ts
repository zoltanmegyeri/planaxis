import type { Decimal } from "@planaxis/geometry";
import type {
  ApartmentHingedDoor,
  ApartmentSemanticElement,
  ValidatedApartment2D,
} from "@planaxis/model";
import { parseApartmentSvg } from "@planaxis/parser";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  buildValidatedApartment2D,
  validateApartmentSvgGeometry,
  validateApartmentSvgReferences,
  validateApartmentSvgSchema,
} from "../src/index.js";
import type {
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

describe("buildValidatedApartment2D public contract", () => {
  it("accepts only the final geometry-valid boundary and returns the model contract", () => {
    expectTypeOf(buildValidatedApartment2D)
      .parameter(0)
      .toEqualTypeOf<GeometryValidApartmentSvgDocument>();
    expectTypeOf(buildValidatedApartment2D).returns.toEqualTypeOf<ValidatedApartment2D>();
    expectTypeOf<ReferenceValidApartmentSvgDocument>().not.toExtend<GeometryValidApartmentSvgDocument>();
  });

  it("constructs a normalized frozen model with resolved domain relationships", () => {
    const document = geometryValidDocument(comprehensiveSvg());

    const model = buildValidatedApartment2D(document);

    expect(model).not.toBe(document);
    expect(model.bounds.x.toString()).toBe("0.1");
    expect(model.bounds.y.toString()).toBe("0.2");
    expect(model.bounds.width.toString()).toBe("599.9");
    expect(model.bounds.height.toString()).toBe("499.8");
    expect("viewBox" in model).toBe(false);

    expect(model.metadata.schema).toBe("apartment-svg/2.1");
    expect(model.metadata.project).toEqual({ name: "Normalized apartment", units: "cm" });
    expect(model.metadata.coordinateSystem.headingDegrees).toEqual({
      0: "+x",
      90: "+y",
      180: "-x",
      270: "-y",
    });
    expect(model.metadata.level.id).toBe("level-0");
    expect(model.metadata.level.baseZ.toString()).toBe("0.1");
    expect(model.metadata.level.defaultCeilingHeight.toString()).toBe("242.2");
    expect(model.metadata.location?.latitude.toString()).toBe("47.4979");
    expect(model.metadata.location?.longitude.toString()).toBe("19.0402");
    expect(model.metadata.location?.northHeading.toString()).toBe("270.25");
    expect(model.metadata.location?.elevationMeters?.toString()).toBe("105.5");
    expect(model.metadata.location?.timeZone).toBe("Europe/Budapest");

    const space = requireElement(model.spaces[0], "space");
    expect(space).toEqual(
      expect.objectContaining({
        id: "space-main",
        kind: "zone",
        name: "Combined living area",
        function: "other",
        functionDescription: "Living, dining, and work area",
        enclosure: "partial",
      }),
    );
    expect(space.boundary[0]?.x.toString()).toBe("50.1");
    expect("points" in space).toBe(false);

    const horizontalWall = requireElement(model.walls[0], "horizontal wall");
    const verticalWall = requireElement(model.walls[1], "vertical wall");
    expect(horizontalWall.footprint.x.toString()).toBe("50.1");
    expect(horizontalWall.length.toString()).toBe("400.4");
    expect(horizontalWall.thickness.toString()).toBe("10.2");
    expect(horizontalWall.effectiveHeight.toString()).toBe("242.2");
    expect("explicitHeight" in horizontalWall).toBe(false);
    expect(horizontalWall.centerline.start.x.toString()).toBe("50.1");
    expect(horizontalWall.centerline.start.y.toString()).toBe("105.3");
    expect(horizontalWall.centerline.end.x.toString()).toBe("450.5");
    expect(horizontalWall.centerline.end.y.toString()).toBe("105.3");
    expect(verticalWall.length.toString()).toBe("300.3");
    expect(verticalWall.thickness.toString()).toBe("10.2");
    expect(verticalWall.explicitHeight?.toString()).toBe("250.5");
    expect(verticalWall.effectiveHeight.toString()).toBe("250.5");
    expect(verticalWall.centerline.start.x.toString()).toBe("505.2");
    expect(verticalWall.centerline.start.y.toString()).toBe("100.2");
    expect(verticalWall.centerline.end.x.toString()).toBe("505.2");
    expect(verticalWall.centerline.end.y.toString()).toBe("400.5");
    expect("x" in horizontalWall).toBe(false);

    const radiator = requireElement(model.fixedElements[0], "radiator");
    if (radiator.kind !== "radiator") throw new Error("Expected a radiator.");
    expect(radiator.wall).toBe(horizontalWall);
    expect(radiator.height.toString()).toBe("60.6");
    const fixedObject = requireElement(model.fixedElements[1], "fixed object");
    if (fixedObject.kind !== "fixed-object") throw new Error("Expected a fixed object.");
    expect(fixedObject.typeDescription).toBe("Structural plinth");
    expect(model.fixedElements[2]?.kind).toBe("column");

    const horizontalWindow = requireElement(model.windows[0], "horizontal window");
    const verticalWindow = requireElement(model.windows[1], "vertical window");
    expect(horizontalWindow.wall).toBe(horizontalWall);
    expect(horizontalWindow.radiatorBelow).toBe(radiator);
    expect(horizontalWindow.openingWidth.toString()).toBe("40.4");
    expect(horizontalWindow.openingType).toBe("tilt-turn");
    expect(horizontalWindow.frameMaterial).toBe("other");
    expect(horizontalWindow.frameMaterialDescription).toBe("Composite frame");
    expect(horizontalWindow.frameColor).toBe("warm-white");
    expect(horizontalWindow.glassType).toBe("other");
    expect(horizontalWindow.glassTypeDescription).toBe("Acoustic glazing");
    expect(verticalWindow.wall).toBe(verticalWall);
    expect(verticalWindow.openingWidth.toString()).toBe("50.5");
    expect("wallId" in horizontalWindow).toBe(false);

    const door = requireElement(model.doors[0], "door");
    if (door.doorType !== "hinged") throw new Error("Expected a hinged door.");
    expect(door.wall).toBe(horizontalWall);
    expect(door.openingWidth.toString()).toBe("80.8");
    expect(door.leafLength.toString()).toBe("80.8");
    expect(door.hinge.x.toString()).toBe("200.1");
    expect(door.openLeaf.y.toString()).toBe("24.5");
    expect(door.closedFreeEndpoint.x.toString()).toBe("280.9");
    expect(door.closedFreeEndpoint.y.toString()).toBe("105.3");
    expect("wallId" in door).toBe(false);

    const socket = requireElement(model.utilities[0], "socket");
    if (!("wall" in socket)) throw new Error("Expected a wall-associated utility.");
    expect(socket.position.x.toString()).toBe("50.1");
    expect(socket.position.y.toString()).toBe("105.3");
    expect(socket.wall).toBe(horizontalWall);
    expect(socket.status).toBe("proposal");
    expect("cx" in socket).toBe(false);
    expect("radius" in socket).toBe(false);
    const ceilingLight = requireElement(model.utilities[1], "ceiling light");
    expect(ceilingLight.kind).toBe("ceiling-light");
    expect("wall" in ceilingLight).toBe(false);

    const camera = requireElement(model.cameras[0], "camera");
    expect(camera.position.x.toString()).toBe("550.5");
    expect(camera.heading.toString()).toBe("270.1");
    expect(camera.pitch.toString()).toBe("-5.2");
    expect(camera.horizontalFov.toString()).toBe("70.3");
    expect("cx" in camera).toBe(false);
    expect("radius" in camera).toBe(false);

    const semanticElements: readonly ApartmentSemanticElement[] = [
      ...model.spaces,
      ...model.walls,
      ...model.windows,
      ...model.doors,
      ...model.fixedElements,
      ...model.utilities,
      ...model.cameras,
    ];
    expect(model.semanticElementsById.size).toBe(semanticElements.length);
    for (const element of semanticElements) {
      expect(model.semanticElementsById.get(element.id)).toBe(element);
    }

    expectTypeOf(horizontalWall.length).toEqualTypeOf<Decimal>();
    expect(horizontalWall.length.plus(horizontalWall.thickness).toString()).toBe("410.6");
    expect(Object.isFrozen(model)).toBe(true);
    expect(Object.isFrozen(model.walls)).toBe(true);
    expect(Object.isFrozen(horizontalWall)).toBe(true);
    expect(Object.isFrozen(horizontalWall.footprint)).toBe(true);
    expect(Object.isFrozen(model.semanticElementsById)).toBe(true);
  });
});

describe("hinged-door deterministic geometry", () => {
  it.each([
    {
      name: "horizontal wall with the left hinge and negative opening side",
      wall: horizontalWall(),
      door: hingedDoor({
        "data-hinge-x": "30",
        "data-open-leaf-x": "30",
        "data-open-leaf-y": "12.99",
      }),
      closedX: "42.01",
      closedY: "25",
    },
    {
      name: "horizontal wall with the right hinge and positive opening side",
      wall: horizontalWall(),
      door: hingedDoor({
        "data-hinge-x": "42.01",
        "data-open-leaf-x": "42.01",
        "data-open-leaf-y": "37.01",
      }),
      closedX: "30",
      closedY: "25",
    },
    {
      name: "vertical wall with the top hinge and negative opening side",
      wall: verticalWall(),
      door: hingedDoor({
        x: "20",
        y: "30",
        width: "10",
        height: "12.01",
        "data-wall": "wall-vertical",
        "data-hinge-x": "25",
        "data-hinge-y": "30",
        "data-open-leaf-x": "12.99",
        "data-open-leaf-y": "30",
      }),
      closedX: "25",
      closedY: "42.01",
    },
    {
      name: "vertical wall with the bottom hinge and positive opening side",
      wall: verticalWall(),
      door: hingedDoor({
        x: "20",
        y: "30",
        width: "10",
        height: "12.01",
        "data-wall": "wall-vertical",
        "data-hinge-x": "25",
        "data-hinge-y": "42.01",
        "data-open-leaf-x": "37.01",
        "data-open-leaf-y": "42.01",
      }),
      closedX: "25",
      closedY: "30",
    },
  ])("derives exact leaf geometry for a $name", ({ wall, door, closedX, closedY }) => {
    const model = buildModel({ walls: wall, doors: door });

    const builtDoor = requireElement(model.doors[0], "hinged door");
    if (builtDoor.doorType !== "hinged") throw new Error("Expected a hinged door.");
    expectHingedDoorGeometry(builtDoor, "12.01", closedX, closedY);
  });

  it("keeps sliding and opening-only doors free of hinged-door geometry", () => {
    const model = buildModel({
      walls: horizontalWall({ width: "150" }),
      doors: [
        door({ id: "door-sliding", "data-door-type": "sliding" }),
        door({ id: "door-opening", x: "50", "data-door-type": "opening-only" }),
      ].join(""),
    });

    expect(model.doors.map((builtDoor) => builtDoor.doorType)).toEqual(["sliding", "opening-only"]);
    for (const builtDoor of model.doors) {
      expect("hinge" in builtDoor).toBe(false);
      expect("leafLength" in builtDoor).toBe(false);
      expect("closedFreeEndpoint" in builtDoor).toBe(false);
    }
  });
});

function expectHingedDoorGeometry(
  door: ApartmentHingedDoor,
  leafLength: string,
  closedX: string,
  closedY: string,
): void {
  expect(door.openingWidth.toString()).toBe(leafLength);
  expect(door.leafLength.toString()).toBe(leafLength);
  expect(door.closedFreeEndpoint.x.toString()).toBe(closedX);
  expect(door.closedFreeEndpoint.y.toString()).toBe(closedY);
}

function comprehensiveSvg(): string {
  return createSvg(
    {
      spaces: tag("polygon", {
        id: "space-main",
        points: "50.1,110.4 450,110.4 450,450 50.1,450",
        "data-kind": "zone",
        "data-name": "Combined living area",
        "data-function": "other",
        "data-function-description": "Living, dining, and work area",
        "data-enclosure": "partial",
      }),
      walls: [
        horizontalWall({
          id: "wall-horizontal",
          x: "50.1",
          y: "100.2",
          width: "400.4",
          height: "10.2",
        }),
        verticalWall({
          x: "500.1",
          y: "100.2",
          width: "10.2",
          height: "300.3",
          "data-height": "250.5",
        }),
      ].join(""),
      windows: [
        windowElement({
          id: "window-horizontal",
          x: "100.1",
          y: "100.2",
          width: "40.4",
          height: "10.2",
          "data-wall": "wall-horizontal",
          "data-sill-height": "90.1",
          "data-opening-height": "120.2",
          "data-opening-type": "tilt-turn",
          "data-frame-material": "other",
          "data-frame-material-description": "Composite frame",
          "data-frame-color": "warm-white",
          "data-glass-type": "other",
          "data-glass-type-description": "Acoustic glazing",
          "data-radiator-below": "radiator-main",
          "data-status": "modifiable",
        }),
        windowElement({
          id: "window-vertical",
          x: "500.1",
          y: "120.2",
          width: "10.2",
          height: "50.5",
          "data-wall": "wall-vertical",
        }),
      ].join(""),
      doors: hingedDoor({
        id: "door-main",
        x: "200.1",
        y: "100.2",
        width: "80.8",
        height: "10.2",
        "data-wall": "wall-horizontal",
        "data-opening-height": "210.3",
        "data-hinge-x": "200.1",
        "data-hinge-y": "105.3",
        "data-open-leaf-x": "200.1",
        "data-open-leaf-y": "24.5",
        "data-status": "proposal",
      }),
      "fixed-elements": [
        fixedElement("radiator", {
          id: "radiator-main",
          x: "100.1",
          y: "120",
          width: "40.4",
          height: "10",
          "data-base-z": "0.2",
          "data-height": "60.6",
          "data-wall": "wall-horizontal",
          "data-status": "modifiable",
        }),
        fixedElement("fixed-object", {
          id: "fixed-object-main",
          "data-type-description": "Structural plinth",
          "data-status": "proposal",
        }),
        fixedElement("column", { id: "column-main", x: "400", y: "300" }),
      ].join(""),
      utilities: [
        utility("socket", {
          id: "socket-main",
          cx: "50.1",
          cy: "105.3",
          "data-wall": "wall-horizontal",
          "data-status": "proposal",
        }),
        utility("ceiling-light", {
          id: "ceiling-light-main",
          cx: "250",
          cy: "250",
          "data-z": "242.2",
          "data-wall": null,
        }),
      ].join(""),
      cameras: tag("circle", {
        id: "camera-main",
        cx: "550.5",
        cy: "450.5",
        r: "4.4",
        "data-kind": "camera",
        "data-z": "160.6",
        "data-heading": "270.1",
        "data-pitch": "-5.2",
        "data-horizontal-fov": "70.3",
      }),
    },
    metadataWithLocation(),
    "0.1 0.2 599.9 499.8",
  );
}

function buildModel(contents: Partial<Record<GroupId, string>>): ValidatedApartment2D {
  return buildValidatedApartment2D(geometryValidDocument(createSvg(contents)));
}

function geometryValidDocument(source: string): GeometryValidApartmentSvgDocument {
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
  const geometryResult = validateApartmentSvgGeometry(referenceResult.document);
  if (!geometryResult.valid) {
    throw new Error(
      `Expected geometry validation to succeed: ${JSON.stringify(geometryResult.errors)}`,
    );
  }
  return geometryResult.document;
}

function createSvg(
  contents: Partial<Record<GroupId, string>> = {},
  metadata: Record<string, unknown> = minimumMetadata(),
  viewBox = "-200 -200 600 600",
): string {
  const groups = GROUP_IDS.map((id) => `<g id="${id}">${contents[id] ?? ""}</g>`).join("\n");
  return `<svg xmlns="${SVG_NAMESPACE_URI}" viewBox="${viewBox}" data-schema="apartment-svg" data-schema-version="2.1" data-unit="cm">
    <metadata><![CDATA[${JSON.stringify(metadata)}]]></metadata>
    ${groups}
  </svg>`;
}

function horizontalWall(overrides: AttributeOverrides = {}): string {
  return tag("rect", {
    id: "wall-horizontal",
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
    id: "wall-vertical",
    x: "20",
    y: "10",
    width: "10",
    height: "100",
    "data-kind": "wall",
    "data-axis": "y",
    "data-class": "exterior",
    "data-status": "modifiable",
    ...overrides,
  });
}

function windowElement(overrides: AttributeOverrides = {}): string {
  return tag("rect", {
    id: "window-1",
    x: "20",
    y: "20",
    width: "20",
    height: "10",
    "data-kind": "window",
    "data-wall": "wall-horizontal",
    "data-sill-height": "90",
    "data-opening-height": "120",
    "data-status": "fixed",
    ...overrides,
  });
}

function door(overrides: AttributeOverrides = {}): string {
  return tag("rect", {
    id: "door-1",
    x: "20",
    y: "20",
    width: "12.01",
    height: "10",
    "data-kind": "door",
    "data-wall": "wall-horizontal",
    "data-door-type": "opening-only",
    "data-opening-height": "210",
    "data-status": "fixed",
    ...overrides,
  });
}

function hingedDoor(overrides: AttributeOverrides = {}): string {
  return door({
    x: "30",
    "data-door-type": "hinged",
    "data-hinge-x": "30",
    "data-hinge-y": "25",
    "data-open-leaf-x": "30",
    "data-open-leaf-y": "12.99",
    ...overrides,
  });
}

function fixedElement(kind: string, overrides: AttributeOverrides = {}): string {
  return tag("rect", {
    id: "fixed-1",
    x: "300",
    y: "300",
    width: "20",
    height: "20",
    "data-kind": kind,
    "data-base-z": "0",
    "data-height": "50",
    "data-status": "fixed",
    ...overrides,
  });
}

function utility(kind: string, overrides: AttributeOverrides = {}): string {
  return tag("circle", {
    id: "utility-1",
    cx: "20",
    cy: "25",
    r: "2.33",
    "data-kind": kind,
    "data-z": "30.3",
    "data-wall": "wall-horizontal",
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
    project: { name: "Validated apartment model test", units: "cm" },
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
    project: { name: "Normalized apartment", units: "cm" },
    level: { id: "level-0", baseZ: 0.1, defaultCeilingHeight: 242.2 },
    location: {
      latitude: 47.4979,
      longitude: 19.0402,
      elevationMeters: 105.5,
      timeZone: "Europe/Budapest",
      northHeading: 270.25,
    },
  };
}

function requireElement<T>(element: T | undefined, description: string): T {
  if (element === undefined) throw new Error(`Expected ${description} to be present.`);
  return element;
}
