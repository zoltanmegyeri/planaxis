import type { Decimal, Point2D, Point3D, Rect2D, RectangularPrism3D } from "@planaxis/geometry";
import type {
  ApartmentDoor,
  ApartmentFixedElement,
  ApartmentUtility,
  ValidatedApartment2D,
} from "@planaxis/model";

import type {
  ArchitecturalCamera3D,
  ArchitecturalDoor3D,
  ArchitecturalFixedElement3D,
  ArchitecturalModel3D,
  ArchitecturalRadiator3D,
  ArchitecturalSourceElement3D,
  ArchitecturalUtility3D,
  ArchitecturalWall3D,
  ArchitecturalWindow3D,
} from "./architectural-model-3d.js";

/** Builds architecture from trusted 2D data without repeating source validation. */
export function buildArchitecturalModel3D(apartment: ValidatedApartment2D): ArchitecturalModel3D {
  const { baseZ, defaultCeilingHeight } = apartment.metadata.level;
  const walls = Object.freeze(
    apartment.walls.map(({ footprint, ...semantics }): ArchitecturalWall3D =>
      Object.freeze({
        ...semantics,
        volume: buildPrism(footprint, baseZ, semantics.effectiveHeight),
      }),
    ),
  );
  const wallsById = new Map(walls.map((wall) => [wall.id, wall]));
  const fixedElements = Object.freeze(
    apartment.fixedElements.map((element) => buildFixedElement(element, baseZ, wallsById)),
  );
  const radiatorsById = new Map(
    fixedElements
      .filter((element): element is ArchitecturalRadiator3D => element.kind === "radiator")
      .map((radiator) => [radiator.id, radiator]),
  );
  const windows = Object.freeze(
    apartment.windows.map(
      ({ footprint, wall, radiatorBelow, ...semantics }): ArchitecturalWindow3D =>
        Object.freeze({
          ...semantics,
          opening: buildPrism(footprint, baseZ.plus(semantics.sillHeight), semantics.openingHeight),
          wall: requireTarget(wallsById, wall.id),
          ...(radiatorBelow === undefined
            ? {}
            : { radiatorBelow: requireTarget(radiatorsById, radiatorBelow.id) }),
        }),
    ),
  );
  const doors = Object.freeze(apartment.doors.map((door) => buildDoor(door, baseZ, wallsById)));
  const utilities = Object.freeze(
    apartment.utilities.map((utility) => buildUtility(utility, baseZ, wallsById)),
  );
  const cameras = Object.freeze(
    apartment.cameras.map(({ position, z, ...semantics }): ArchitecturalCamera3D =>
      Object.freeze({ ...semantics, position: buildPosition(position, baseZ.plus(z)) }),
    ),
  );
  const elements: readonly ArchitecturalSourceElement3D[] = [
    ...walls,
    ...windows,
    ...doors,
    ...fixedElements,
    ...utilities,
    ...cameras,
  ];
  const sourceElementsById = new Map(elements.map((element) => [element.id, element]));
  if (sourceElementsById.size !== elements.length) {
    throw new Error("Architectural model construction encountered a duplicate source semantic ID.");
  }

  return Object.freeze({
    metadata: apartment.metadata,
    floor: Object.freeze({ boundary: apartment.footprint.boundary, z: baseZ }),
    ceiling: Object.freeze({
      boundary: apartment.footprint.boundary,
      z: baseZ.plus(defaultCeilingHeight),
    }),
    walls,
    windows,
    doors,
    fixedElements,
    utilities,
    cameras,
    sourceElementsById: Object.freeze(sourceElementsById),
  });
}

function buildFixedElement(
  element: ApartmentFixedElement,
  levelBaseZ: Decimal,
  wallsById: ReadonlyMap<string, ArchitecturalWall3D>,
): ArchitecturalFixedElement3D {
  const volume = buildPrism(element.footprint, levelBaseZ.plus(element.baseZ), element.height);
  const base = { id: element.id, status: element.status, height: element.height, volume };
  if (element.kind === "radiator") {
    return Object.freeze({
      ...base,
      kind: element.kind,
      ...(element.wall === undefined ? {} : { wall: requireTarget(wallsById, element.wall.id) }),
    });
  }
  if (element.kind === "fixed-object") {
    return Object.freeze({ ...base, kind: element.kind, typeDescription: element.typeDescription });
  }
  return Object.freeze({ ...base, kind: element.kind });
}

function buildDoor(
  door: ApartmentDoor,
  baseZ: Decimal,
  wallsById: ReadonlyMap<string, ArchitecturalWall3D>,
): ArchitecturalDoor3D {
  const { footprint, wall, ...semantics } = door;
  return Object.freeze({
    ...semantics,
    opening: buildPrism(footprint, baseZ, door.openingHeight),
    wall: requireTarget(wallsById, wall.id),
  });
}

function buildUtility(
  utility: ApartmentUtility,
  baseZ: Decimal,
  wallsById: ReadonlyMap<string, ArchitecturalWall3D>,
): ArchitecturalUtility3D {
  const base = {
    id: utility.id,
    position: buildPosition(utility.position, baseZ.plus(utility.z)),
    ...(utility.status === undefined ? {} : { status: utility.status }),
  };
  if (utility.kind === "ceiling-light") return Object.freeze({ ...base, kind: utility.kind });
  return Object.freeze({
    ...base,
    kind: utility.kind,
    wall: requireTarget(wallsById, utility.wall.id),
  });
}

function buildPrism(footprint: Rect2D, minZ: Decimal, height: Decimal): RectangularPrism3D {
  return Object.freeze({
    footprint,
    verticalRange: Object.freeze({ minZ, maxZ: minZ.plus(height) }),
  });
}

function buildPosition(position: Point2D, z: Decimal): Point3D {
  return Object.freeze({ x: position.x, y: position.y, z });
}

function requireTarget<T>(targets: ReadonlyMap<string, T>, id: string): T {
  const target = targets.get(id);
  if (target === undefined) {
    throw new Error(`Architectural model construction could not resolve constructed target ${id}.`);
  }
  return target;
}
