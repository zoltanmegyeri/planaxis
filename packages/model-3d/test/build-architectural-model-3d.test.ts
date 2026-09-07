import { createDecimal } from "@planaxis/geometry";
import type { HorizontalPolygonSurface3D, Point3D, RectangularPrism3D } from "@planaxis/geometry";
import type { ValidatedApartment2D } from "@planaxis/model";
import { describe, expect, expectTypeOf, it } from "vitest";

import { buildArchitecturalModel3D } from "../src/index.js";
import type { ArchitecturalModel3D, ArchitecturalSourceElement3D } from "../src/index.js";
import { apartmentFixture } from "./apartment-fixture.js";

function range(prism: RectangularPrism3D): readonly string[] {
  return [prism.verticalRange.minZ.toString(), prism.verticalRange.maxZ.toString()];
}

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Expected test element.");
  return value;
}

describe("buildArchitecturalModel3D", () => {
  it("exposes trusted input and shared renderer-independent geometry contracts", () => {
    expectTypeOf(buildArchitecturalModel3D).parameter(0).toEqualTypeOf<ValidatedApartment2D>();
    expectTypeOf(buildArchitecturalModel3D).returns.toEqualTypeOf<ArchitecturalModel3D>();
    expectTypeOf<ArchitecturalModel3D["floor"]>().toEqualTypeOf<HorizontalPolygonSurface3D>();
    expectTypeOf<
      ArchitecturalModel3D["walls"][number]["volume"]
    >().toEqualTypeOf<RectangularPrism3D>();
    expectTypeOf<ArchitecturalModel3D["cameras"][number]["position"]>().toEqualTypeOf<Point3D>();
    expectTypeOf<ArchitecturalModel3D["sourceElementsById"]>().toEqualTypeOf<
      ReadonlyMap<string, ArchitecturalSourceElement3D>
    >();
  });

  it.each([
    ["0", "242.2", "220.3", "90.2", "220.5", "210.2", "10.2", "70.5", "30.2", "160.2"],
    ["300.1", "542.3", "520.4", "390.3", "520.6", "510.3", "310.3", "370.6", "330.3", "460.3"],
    [
      "-300.1",
      "-57.9",
      "-79.8",
      "-209.9",
      "-79.6",
      "-89.9",
      "-289.9",
      "-229.6",
      "-269.9",
      "-139.9",
    ],
  ])(
    "applies level base Z %s exactly once to all architectural coordinates",
    (
      baseZ,
      ceilingZ,
      lowWallZ,
      sillZ,
      windowTopZ,
      doorTopZ,
      elementBaseZ,
      elementTopZ,
      utilityZ,
      cameraZ,
    ) => {
      const source = apartmentFixture(baseZ);
      const model = buildArchitecturalModel3D(source);
      expect(model.floor.boundary).toEqual(source.footprint.boundary);
      expect(model.ceiling.boundary).toEqual(source.footprint.boundary);
      expect(model.floor.z.toString()).toBe(baseZ);
      expect(model.ceiling.z.toString()).toBe(ceilingZ);
      expect(range(required(model.walls[0]).volume)).toEqual([baseZ, ceilingZ]);
      expect(range(required(model.walls[1]).volume)).toEqual([baseZ, lowWallZ]);
      expect(required(model.walls[1]).explicitHeight?.toString()).toBe("220.3");
      expect(range(required(model.windows[0]).opening)).toEqual([sillZ, windowTopZ]);
      for (const door of model.doors) expect(range(door.opening)).toEqual([baseZ, doorTopZ]);
      expect(range(required(model.fixedElements[0]).volume)).toEqual([elementBaseZ, elementTopZ]);
      expect(required(model.utilities[0]).position.z.toString()).toBe(utilityZ);
      expect(required(model.cameras[0]).position.z.toString()).toBe(cameraZ);
      expect(source.metadata.level.baseZ.toString()).toBe(baseZ);
      expect(required(source.fixedElements[0]).baseZ.toString()).toBe("10.2");
      expect(required(source.cameras[0]).z.toString()).toBe("160.2");
    },
  );

  it("preserves XY footprints and semantic metadata without renderer axis conversion", () => {
    const source = apartmentFixture();
    const model = buildArchitecturalModel3D(source);
    expect(model.metadata).toEqual(source.metadata);
    for (const [index, wall] of model.walls.entries()) {
      const original = required(source.walls[index]);
      expect(wall.volume.footprint).toEqual(original.footprint);
      expect(wall).toMatchObject({
        id: original.id,
        kind: original.kind,
        axis: original.axis,
        wallClass: original.wallClass,
        status: original.status,
        centerline: original.centerline,
        length: original.length,
        thickness: original.thickness,
        effectiveHeight: original.effectiveHeight,
      });
    }
    for (const [index, window] of model.windows.entries())
      expect(window.opening.footprint).toEqual(required(source.windows[index]).footprint);
    for (const [index, door] of model.doors.entries())
      expect(door.opening.footprint).toEqual(required(source.doors[index]).footprint);
    for (const [index, element] of model.fixedElements.entries()) {
      const original = required(source.fixedElements[index]);
      expect(element.volume.footprint).toEqual(original.footprint);
      expect(element).toMatchObject({
        id: original.id,
        kind: original.kind,
        status: original.status,
        height: original.height,
      });
    }
    expect(model.fixedElements.find((element) => element.kind === "fixed-object")).toHaveProperty(
      "typeDescription",
      "Equipment cabinet",
    );
    expect(range(required(model.fixedElements[2]).volume)).toEqual(["300.3", "340.6"]);
    expect(range(required(model.fixedElements[3]).volume)).toEqual(["300.1", "542.3"]);
    for (const [index, utility] of model.utilities.entries()) {
      const original = required(source.utilities[index]);
      expect(utility.position.x).toEqual(original.position.x);
      expect(utility.position.y).toEqual(original.position.y);
      expect(utility.kind).toBe(original.kind);
      expect(utility.status).toBe(original.status);
    }
    expect(required(model.utilities[5]).position.z.toString()).toBe("540.3");
  });

  it("preserves optional window details and exact hinged-door plan geometry", () => {
    const source = apartmentFixture();
    const model = buildArchitecturalModel3D(source);
    expect(model.windows[0]).toMatchObject({
      openingType: "tilt-turn",
      frameMaterial: "other",
      frameMaterialDescription: "Composite",
      frameColor: "white",
      glassType: "other",
      glassTypeDescription: "Patterned",
      status: "fixed",
    });
    for (const key of [
      "openingType",
      "frameMaterial",
      "frameMaterialDescription",
      "frameColor",
      "glassType",
      "glassTypeDescription",
      "radiatorBelow",
    ]) {
      expect(required(model.windows[1])).not.toHaveProperty(key);
    }
    for (const [index, door] of model.doors.entries()) {
      const original = required(source.doors[index]);
      expect(door.doorType).toBe(original.doorType);
      expect(door.status).toBe(original.status);
      expect(door.openingWidth).toEqual(original.openingWidth);
      if (door.doorType === "hinged" && original.doorType === "hinged") {
        expect(door.hinge).toEqual(original.hinge);
        expect(door.openLeaf).toEqual(original.openLeaf);
        expect(door.closedFreeEndpoint).toEqual(original.closedFreeEndpoint);
        expect(door.leafLength).toEqual(original.leafLength);
        expect(door.openLeaf.y.toString()).toBe("-73.9");
        expect(door.hinge).not.toHaveProperty("z");
      } else {
        expect(door).not.toHaveProperty("hinge");
        expect(door).not.toHaveProperty("openLeaf");
      }
      expect(door).not.toHaveProperty("leafVolume");
      expect(door).not.toHaveProperty("leafThickness");
    }
  });

  it("preserves precision beyond native numbers and the default decimal precision", () => {
    const source = apartmentFixture("9007199254740993.12345678901234567890123456789");
    const model = buildArchitecturalModel3D(source);
    expect(model.ceiling.z.toString()).toBe("9007199254741235.32345678901234567890123456789");
    expect(range(required(model.windows[0]).opening)).toEqual([
      "9007199254741083.32345678901234567890123456789",
      "9007199254741213.62345678901234567890123456789",
    ]);
    expect(range(required(model.fixedElements[0]).volume)).toEqual([
      "9007199254741003.32345678901234567890123456789",
      "9007199254741063.62345678901234567890123456789",
    ]);
    const camera = required(model.cameras[0]);
    expect(camera.position.x.toString()).toBe("300.12345678901234567890123456789");
    expect(camera.position.y.toString()).toBe("200.2");
    expect(camera.position.z.toString()).toBe("9007199254741153.32345678901234567890123456789");
    expect(camera.heading.toString()).toBe("270.12345678901234567890123456789");
    expect(camera.pitch.toString()).toBe("-12.12345678901234567890123456789");
    expect(camera.horizontalFov.toString()).toBe("70.12345678901234567890123456789");
    expect(required(model.utilities[0]).position.x.toString()).toBe(
      "20.12345678901234567890123456789",
    );
    expect(required(model.utilities[0]).position.z.toString()).toBe(
      "9007199254741023.32345678901234567890123456789",
    );
  });

  it("links constructed objects and indexes the same instances as typed collections", () => {
    const source = apartmentFixture();
    const model = buildArchitecturalModel3D(source);
    const wall = required(model.walls[0]);
    const radiator = required(model.fixedElements[0]);
    for (const window of model.windows) expect(window.wall).toBe(wall);
    expect(required(model.windows[0]).radiatorBelow).toBe(radiator);
    for (const door of model.doors) expect(door.wall).toBe(wall);
    expect(radiator.kind).toBe("radiator");
    if (radiator.kind === "radiator") expect(radiator.wall).toBe(wall);
    expect(required(model.fixedElements[1])).not.toHaveProperty("wall");
    for (const utility of model.utilities) {
      if (utility.kind === "ceiling-light") expect(utility).not.toHaveProperty("wall");
      else expect(utility.wall).toBe(wall);
    }
    const collections = [
      model.walls,
      model.windows,
      model.doors,
      model.fixedElements,
      model.utilities,
      model.cameras,
    ];
    expect(model.sourceElementsById.size).toBe(collections.flat().length);
    for (const elements of collections) {
      expect(Object.isFrozen(elements)).toBe(true);
      for (const element of elements) {
        expect(model.sourceElementsById.get(element.id)).toBe(element);
        expect(element).not.toBe(source.semanticElementsById.get(element.id));
        expect(Object.isFrozen(element)).toBe(true);
      }
    }
    expect(model.sourceElementsById.has(source.footprint.id)).toBe(false);
    expect(Object.isFrozen(model)).toBe(true);
    expect(Object.isFrozen(wall.volume)).toBe(true);
    expect(Object.isFrozen(wall.volume.verticalRange)).toBe(true);
  });

  it("is deterministic and exposes only zero-thickness boundaries and semantic geometry", () => {
    const source = apartmentFixture();
    const model = buildArchitecturalModel3D(source);
    expect(buildArchitecturalModel3D(source)).toEqual(model);
    for (const surface of [model.floor, model.ceiling]) {
      expect(Object.keys(surface).sort()).toEqual(["boundary", "z"]);
      expect(Object.isFrozen(surface)).toBe(true);
    }
    expect(Object.keys(required(model.walls[0]).volume).sort()).toEqual([
      "footprint",
      "verticalRange",
    ]);
    expect(required(model.utilities[5])).not.toHaveProperty("status");
    for (const element of model.sourceElementsById.values()) {
      for (const field of ["mesh", "material", "geometry", "matrix", "direction", "radius", "r"])
        expect(element).not.toHaveProperty(field);
    }
  });

  it("builds floor and ceiling when source-derived collections are empty", () => {
    const source = apartmentFixture("-0.1");
    const model = buildArchitecturalModel3D({
      ...source,
      walls: [],
      windows: [],
      doors: [],
      fixedElements: [],
      utilities: [],
      cameras: [],
      semanticElementsById: new Map([[source.footprint.id, source.footprint]]),
    });
    expect(model.sourceElementsById.size).toBe(0);
    expect(model.floor.z.equals(createDecimal("-0.1"))).toBe(true);
    expect(model.ceiling.z.equals(createDecimal("242.1"))).toBe(true);
  });
});
