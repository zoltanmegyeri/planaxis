import {
  arePointsGeometricallyEqual,
  getRectBottomEdge,
  getRectCenterX,
  getRectCenterY,
  getRectRightEdge,
} from "@planaxis/geometry";
import type { Point2D, Rect2D } from "@planaxis/geometry";
import type {
  ApartmentCamera,
  ApartmentDoor,
  ApartmentFixedElement,
  ApartmentFixedObject,
  ApartmentHingedDoor,
  ApartmentMetadata,
  ApartmentRadiator,
  ApartmentSemanticElement,
  ApartmentSpace,
  ApartmentUtility,
  ApartmentWall,
  ApartmentWindow,
  ValidatedApartment2D,
} from "@planaxis/model";

import type { GeometryValidApartmentSvgDocument } from "./geometry-valid-apartment-svg.js";
import type {
  ReferenceValidDoor,
  ReferenceValidFixedElement,
  ReferenceValidHingedDoor,
  ReferenceValidUtility,
  ReferenceValidWall,
} from "./reference-valid-apartment-svg.js";
import type { SchemaValidApartmentSvgMetadata } from "./schema-valid-apartment-svg.js";

/**
 * Constructs the trusted 2D domain model from the final validated SVG
 * boundary. Source validation and repair belong to the preceding stages.
 */
export function buildValidatedApartment2D(
  document: GeometryValidApartmentSvgDocument,
): ValidatedApartment2D {
  const metadata = buildMetadata(document.metadata);
  const spaces = Object.freeze(document.spaces.map(buildSpace));
  const walls = Object.freeze(
    document.walls.map((wall) => buildWall(wall, metadata.level.defaultCeilingHeight)),
  );
  const wallsById = new Map(walls.map((wall): readonly [string, ApartmentWall] => [wall.id, wall]));

  const fixedElements = Object.freeze(
    document.fixedElements.map((fixedElement) => buildFixedElement(fixedElement, wallsById)),
  );
  const radiatorsById = new Map(
    fixedElements
      .filter((fixedElement): fixedElement is ApartmentRadiator => fixedElement.kind === "radiator")
      .map((radiator): readonly [string, ApartmentRadiator] => [radiator.id, radiator]),
  );
  const windows = Object.freeze(
    document.windows.map((window): ApartmentWindow => {
      const wall = requireConstructedTarget(wallsById, window.wall.id, "wall");
      const openingWidth = getOpeningWidth(window, wall);
      return Object.freeze({
        id: window.id,
        kind: window.kind,
        footprint: buildRect(window),
        wall,
        sillHeight: window.sillHeight,
        openingHeight: window.openingHeight,
        openingWidth,
        ...(window.openingType === undefined ? {} : { openingType: window.openingType }),
        ...(window.frameMaterial === undefined ? {} : { frameMaterial: window.frameMaterial }),
        ...(window.frameMaterialDescription === undefined
          ? {}
          : { frameMaterialDescription: window.frameMaterialDescription }),
        ...(window.frameColor === undefined ? {} : { frameColor: window.frameColor }),
        ...(window.glassType === undefined ? {} : { glassType: window.glassType }),
        ...(window.glassTypeDescription === undefined
          ? {}
          : { glassTypeDescription: window.glassTypeDescription }),
        ...(window.radiatorBelow === undefined
          ? {}
          : {
              radiatorBelow: requireConstructedTarget(
                radiatorsById,
                window.radiatorBelow.id,
                "radiator",
              ),
            }),
        status: window.status,
      });
    }),
  );
  const doors = Object.freeze(document.doors.map((door) => buildDoor(door, wallsById)));
  const utilities = Object.freeze(
    document.utilities.map((utility) => buildUtility(utility, wallsById)),
  );
  const cameras = Object.freeze(
    document.cameras.map((camera): ApartmentCamera =>
      Object.freeze({
        id: camera.id,
        kind: camera.kind,
        position: buildPoint(camera.cx, camera.cy),
        z: camera.z,
        heading: camera.heading,
        pitch: camera.pitch,
        horizontalFov: camera.horizontalFov,
      }),
    ),
  );

  const semanticElements: readonly ApartmentSemanticElement[] = [
    ...spaces,
    ...walls,
    ...windows,
    ...doors,
    ...fixedElements,
    ...utilities,
    ...cameras,
  ];
  const semanticElementsById = new Map(
    semanticElements.map((element): readonly [string, ApartmentSemanticElement] => [
      element.id,
      element,
    ]),
  );
  if (semanticElementsById.size !== semanticElements.length) {
    throw new Error("Validated apartment construction encountered a duplicate semantic ID.");
  }

  return Object.freeze({
    bounds: Object.freeze({
      x: document.viewBox.minX,
      y: document.viewBox.minY,
      width: document.viewBox.width,
      height: document.viewBox.height,
    }),
    metadata,
    spaces,
    walls,
    windows,
    doors,
    fixedElements,
    utilities,
    cameras,
    semanticElementsById: Object.freeze(semanticElementsById),
  });
}

function buildMetadata(metadata: SchemaValidApartmentSvgMetadata): ApartmentMetadata {
  return Object.freeze({
    schema: metadata.schema,
    project: Object.freeze({ ...metadata.project }),
    coordinateSystem: Object.freeze({
      ...metadata.coordinateSystem,
      headingDegrees: Object.freeze({ ...metadata.coordinateSystem.headingDegrees }),
    }),
    level: Object.freeze({ ...metadata.level }),
    ...(metadata.location === undefined
      ? {}
      : {
          location: Object.freeze({
            latitude: metadata.location.latitude,
            longitude: metadata.location.longitude,
            northHeading: metadata.location.northHeading,
            ...(metadata.location.elevationMeters === undefined
              ? {}
              : { elevationMeters: metadata.location.elevationMeters }),
            ...(metadata.location.timeZone === undefined
              ? {}
              : { timeZone: metadata.location.timeZone }),
          }),
        }),
  });
}

function buildSpace(space: GeometryValidApartmentSvgDocument["spaces"][number]): ApartmentSpace {
  return Object.freeze({
    id: space.id,
    kind: space.kind,
    boundary: Object.freeze(space.points.map((point) => buildPoint(point.x, point.y))),
    name: space.name,
    function: space.function,
    ...(space.functionDescription === undefined
      ? {}
      : { functionDescription: space.functionDescription }),
    enclosure: space.enclosure,
  });
}

function buildWall(
  wall: ReferenceValidWall,
  defaultCeilingHeight: ApartmentMetadata["level"]["defaultCeilingHeight"],
): ApartmentWall {
  const footprint = buildRect(wall);
  const isHorizontal = wall.axis === "x";
  const centerline = isHorizontal
    ? Object.freeze({
        start: buildPoint(footprint.x, getRectCenterY(footprint)),
        end: buildPoint(getRectRightEdge(footprint), getRectCenterY(footprint)),
      })
    : Object.freeze({
        start: buildPoint(getRectCenterX(footprint), footprint.y),
        end: buildPoint(getRectCenterX(footprint), getRectBottomEdge(footprint)),
      });

  return Object.freeze({
    id: wall.id,
    kind: wall.kind,
    footprint,
    axis: wall.axis,
    ...(wall.wallHeight === undefined ? {} : { explicitHeight: wall.wallHeight }),
    wallClass: wall.wallClass,
    status: wall.status,
    length: isHorizontal ? footprint.width : footprint.height,
    thickness: isHorizontal ? footprint.height : footprint.width,
    effectiveHeight: wall.wallHeight ?? defaultCeilingHeight,
    centerline,
  });
}

function buildFixedElement(
  fixedElement: ReferenceValidFixedElement,
  wallsById: ReadonlyMap<string, ApartmentWall>,
): ApartmentFixedElement {
  const base = {
    id: fixedElement.id,
    footprint: buildRect(fixedElement),
    baseZ: fixedElement.baseZ,
    height: fixedElement.elementHeight,
    status: fixedElement.status,
  };

  if (fixedElement.kind === "radiator") {
    return Object.freeze({
      ...base,
      kind: fixedElement.kind,
      ...(fixedElement.wall === undefined
        ? {}
        : { wall: requireConstructedTarget(wallsById, fixedElement.wall.id, "wall") }),
    });
  }

  if (fixedElement.kind === "fixed-object") {
    const fixedObject: ApartmentFixedObject = Object.freeze({
      ...base,
      kind: fixedElement.kind,
      typeDescription: fixedElement.typeDescription,
    });
    return fixedObject;
  }

  return Object.freeze({ ...base, kind: fixedElement.kind });
}

function buildDoor(
  door: ReferenceValidDoor,
  wallsById: ReadonlyMap<string, ApartmentWall>,
): ApartmentDoor {
  const wall = requireConstructedTarget(wallsById, door.wall.id, "wall");
  const footprint = buildRect(door);
  const openingWidth = getOpeningWidth(footprint, wall);
  const base = {
    id: door.id,
    kind: door.kind,
    footprint,
    wall,
    openingHeight: door.openingHeight,
    openingWidth,
    status: door.status,
  };

  if (door.doorType === "hinged") {
    const hingedDoor: ApartmentHingedDoor = Object.freeze({
      ...base,
      doorType: door.doorType,
      hinge: buildPoint(door.hinge.x, door.hinge.y),
      openLeaf: buildPoint(door.openLeaf.x, door.openLeaf.y),
      leafLength: openingWidth,
      closedFreeEndpoint: buildClosedFreeEndpoint(door, wall),
    });
    return hingedDoor;
  }

  return Object.freeze({ ...base, doorType: door.doorType });
}

function buildClosedFreeEndpoint(door: ReferenceValidHingedDoor, wall: ApartmentWall): Point2D {
  const centerlineCoordinate =
    wall.axis === "x" ? wall.centerline.start.y : wall.centerline.start.x;
  const firstEndpoint =
    wall.axis === "x"
      ? buildPoint(door.x, centerlineCoordinate)
      : buildPoint(centerlineCoordinate, door.y);
  const secondEndpoint =
    wall.axis === "x"
      ? buildPoint(getRectRightEdge(door), centerlineCoordinate)
      : buildPoint(centerlineCoordinate, getRectBottomEdge(door));

  if (arePointsGeometricallyEqual(door.hinge, firstEndpoint)) return secondEndpoint;
  if (arePointsGeometricallyEqual(door.hinge, secondEndpoint)) return firstEndpoint;
  throw new Error(`Geometry-valid hinged door ${door.id} has no recognized hinge endpoint.`);
}

function buildUtility(
  utility: ReferenceValidUtility,
  wallsById: ReadonlyMap<string, ApartmentWall>,
): ApartmentUtility {
  const base = {
    id: utility.id,
    position: buildPoint(utility.cx, utility.cy),
    z: utility.z,
    ...(utility.status === undefined ? {} : { status: utility.status }),
  };
  if (!("wall" in utility)) {
    return Object.freeze({ ...base, kind: utility.kind });
  }

  return Object.freeze({
    ...base,
    kind: utility.kind,
    wall: requireConstructedTarget(wallsById, utility.wall.id, "wall"),
  });
}

function getOpeningWidth(footprint: Rect2D, wall: ApartmentWall): ApartmentWall["length"] {
  return wall.axis === "x" ? footprint.width : footprint.height;
}

function buildRect(rect: Rect2D): Rect2D {
  return Object.freeze({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
}

function buildPoint(x: Point2D["x"], y: Point2D["y"]): Point2D {
  return Object.freeze({ x, y });
}

function requireConstructedTarget<T>(
  targetsById: ReadonlyMap<string, T>,
  targetId: string,
  targetDescription: string,
): T {
  const target = targetsById.get(targetId);
  if (target === undefined) {
    throw new Error(
      `Validated apartment construction could not resolve constructed ${targetDescription} ${targetId}.`,
    );
  }
  return target;
}
