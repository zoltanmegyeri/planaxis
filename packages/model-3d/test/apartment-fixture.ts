import { createDecimal as decimal } from "@planaxis/geometry";
import type { Point2D, Rect2D } from "@planaxis/geometry";
import type {
  ApartmentCamera,
  ApartmentDoor,
  ApartmentFixedElement,
  ApartmentFootprint,
  ApartmentMetadata,
  ApartmentRadiator,
  ApartmentSemanticElement,
  ApartmentUtility,
  ApartmentWall,
  ApartmentWindow,
  ValidatedApartment2D,
} from "@planaxis/model";

function point(x: string, y: string): Point2D {
  return Object.freeze({ x: decimal(x), y: decimal(y) });
}

function rect(x: string, y: string, width: string, height: string): Rect2D {
  return Object.freeze({
    x: decimal(x),
    y: decimal(y),
    width: decimal(width),
    height: decimal(height),
  });
}

/** Direct trusted input with a concave footprint and nonoverlapping wall openings. */
export function apartmentFixture(baseZ = "300.1"): ValidatedApartment2D {
  const metadata: ApartmentMetadata = Object.freeze({
    schema: "apartment-svg/2.2",
    project: Object.freeze({ name: "Architectural model test", units: "cm" }),
    coordinateSystem: Object.freeze({
      x: "right",
      y: "down",
      z: "up",
      headingDegrees: Object.freeze({ 0: "+x", 90: "+y", 180: "-x", 270: "-y" }),
    }),
    level: Object.freeze({
      id: "level",
      baseZ: decimal(baseZ),
      defaultCeilingHeight: decimal("242.2"),
    }),
    location: Object.freeze({
      latitude: decimal("47.4979"),
      longitude: decimal("19.0402"),
      northHeading: decimal("270.25"),
      elevationMeters: decimal("105.5"),
      timeZone: "Europe/Budapest",
    }),
  });
  const footprint: ApartmentFootprint = Object.freeze({
    id: "footprint-source",
    kind: "footprint",
    boundary: Object.freeze([
      point("0", "0"),
      point("600", "0"),
      point("600", "300"),
      point("400", "300"),
      point("400", "500"),
      point("0", "500"),
    ]),
  });
  const wall: ApartmentWall = Object.freeze({
    id: "wall",
    kind: "wall",
    footprint: rect("0", "0", "600", "12.2"),
    axis: "x",
    wallClass: "exterior",
    status: "fixed",
    length: decimal("600"),
    thickness: decimal("12.2"),
    effectiveHeight: decimal("242.2"),
    centerline: Object.freeze({ start: point("0", "6.1"), end: point("600", "6.1") }),
  });
  const lowWall: ApartmentWall = Object.freeze({
    id: "low-wall",
    kind: "wall",
    footprint: rect("0", "0", "12.2", "500"),
    axis: "y",
    wallClass: "interior",
    status: "modifiable",
    length: decimal("500"),
    thickness: decimal("12.2"),
    explicitHeight: decimal("220.3"),
    effectiveHeight: decimal("220.3"),
    centerline: Object.freeze({ start: point("6.1", "0"), end: point("6.1", "500") }),
  });
  const radiator: ApartmentRadiator = Object.freeze({
    id: "radiator",
    kind: "radiator",
    footprint: rect("30", "20", "80", "10"),
    baseZ: decimal("10.2"),
    height: decimal("60.3"),
    status: "proposal",
    wall,
  });
  const fixedElements: readonly ApartmentFixedElement[] = Object.freeze([
    radiator,
    Object.freeze({
      id: "free-radiator",
      kind: "radiator",
      footprint: rect("130", "20", "80", "10"),
      baseZ: decimal("10.2"),
      height: decimal("60.3"),
      status: "fixed",
    }),
    Object.freeze({
      id: "object",
      kind: "fixed-object",
      footprint: rect("100", "100", "30", "20"),
      baseZ: decimal("0.2"),
      height: decimal("40.3"),
      status: "modifiable",
      typeDescription: "Equipment cabinet",
    }),
    Object.freeze({
      id: "column",
      kind: "column",
      footprint: rect("200", "100", "20", "20"),
      baseZ: decimal("0"),
      height: decimal("242.2"),
      status: "fixed",
    }),
  ]);
  const windows: readonly ApartmentWindow[] = Object.freeze([
    Object.freeze({
      id: "window",
      kind: "window",
      footprint: rect("30", "0", "80", "12.2"),
      wall,
      sillHeight: decimal("90.2"),
      openingHeight: decimal("130.3"),
      openingWidth: decimal("80"),
      openingType: "tilt-turn",
      frameMaterial: "other",
      frameMaterialDescription: "Composite",
      frameColor: "white",
      glassType: "other",
      glassTypeDescription: "Patterned",
      radiatorBelow: radiator,
      status: "fixed",
    }),
    Object.freeze({
      id: "plain-window",
      kind: "window",
      footprint: rect("130", "0", "80", "12.2"),
      wall,
      sillHeight: decimal("90.2"),
      openingHeight: decimal("130.3"),
      openingWidth: decimal("80"),
      status: "proposal",
    }),
  ]);
  const doors: readonly ApartmentDoor[] = Object.freeze([
    Object.freeze({
      id: "hinged",
      kind: "door",
      doorType: "hinged",
      footprint: rect("230", "0", "80", "12.2"),
      wall,
      openingHeight: decimal("210.2"),
      openingWidth: decimal("80"),
      status: "modifiable",
      hinge: point("230", "6.1"),
      openLeaf: point("230", "-73.9"),
      leafLength: decimal("80"),
      closedFreeEndpoint: point("310", "6.1"),
    }),
    Object.freeze({
      id: "sliding",
      kind: "door",
      doorType: "sliding",
      footprint: rect("330", "0", "80", "12.2"),
      wall,
      openingHeight: decimal("210.2"),
      openingWidth: decimal("80"),
      status: "proposal",
    }),
    Object.freeze({
      id: "opening-only",
      kind: "door",
      doorType: "opening-only",
      footprint: rect("430", "0", "80", "12.2"),
      wall,
      openingHeight: decimal("210.2"),
      openingWidth: decimal("80"),
      status: "fixed",
    }),
  ]);
  const utilities: readonly ApartmentUtility[] = Object.freeze([
    ...(["socket", "ethernet", "tv-coax", "light-switch", "wall-light"] as const).map((kind) =>
      Object.freeze({
        id: kind,
        kind,
        position: point("20.12345678901234567890123456789", "12.2"),
        z: decimal("30.2"),
        status: "proposal" as const,
        wall,
      }),
    ),
    Object.freeze({
      id: "ceiling-light",
      kind: "ceiling-light",
      position: point("300", "200"),
      z: decimal("240.2"),
    }),
  ]);
  const cameras: readonly ApartmentCamera[] = Object.freeze([
    Object.freeze({
      id: "camera",
      kind: "camera",
      position: point("300.12345678901234567890123456789", "200.2"),
      z: decimal("160.2"),
      heading: decimal("270.12345678901234567890123456789"),
      pitch: decimal("-12.12345678901234567890123456789"),
      horizontalFov: decimal("70.12345678901234567890123456789"),
    }),
  ]);
  const walls = Object.freeze([wall, lowWall]);
  const elements: readonly ApartmentSemanticElement[] = [
    footprint,
    ...walls,
    ...windows,
    ...doors,
    ...fixedElements,
    ...utilities,
    ...cameras,
  ];
  return Object.freeze({
    metadata,
    footprint,
    bounds: rect("-100", "-100", "800", "700"),
    spaces: Object.freeze([]),
    walls,
    windows,
    doors,
    fixedElements,
    utilities,
    cameras,
    semanticElementsById: Object.freeze(new Map(elements.map((element) => [element.id, element]))),
  });
}
