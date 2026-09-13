import { deriveArchitecturalSurfaces } from "@planaxis/model-3d";
import type { ArchitecturalModel3D } from "@planaxis/model-3d";
import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  FrontSide,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
} from "three/webgpu";
import { rendererBox, rendererPoint } from "./coordinates.js";
import { surfaceGeometry } from "./surface-geometry.js";

export interface ApartmentScene {
  readonly group: Group;
  readonly objectsBySourceId: ReadonlyMap<string, Group>;
  readonly bounds: Box3;
  dispose(): void;
}

export function buildApartmentScene(model: ArchitecturalModel3D): ApartmentScene {
  const group = new Group();
  const objectsBySourceId = new Map<string, Group>();
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  let disposed = false;
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    group.clear();
    objectsBySourceId.clear();
  };
  const material = (color: number, transparent = false): MeshStandardMaterial => {
    const result = new MeshStandardMaterial({
      color,
      roughness: 0.8,
      metalness: 0,
      // Back-face shadow maps leak light at floor contacts and intersecting wall corners.
      shadowSide: FrontSide,
      ...(transparent
        ? { transparent: true, opacity: 0.2, depthWrite: false, side: DoubleSide }
        : {}),
    });
    materials.add(result);
    return result;
  };
  const mesh = (
    geometry: BufferGeometry,
    finish: Material,
    parent: Group,
    shadows = true,
  ): Mesh => {
    geometries.add(geometry);
    const result = new Mesh(geometry, finish);
    result.castShadow = shadows;
    result.receiveShadow = shadows;
    parent.add(result);
    return result;
  };
  const box = (bounds: Box3, finish: Material, parent: Group): void => {
    const size = bounds.getSize(new Vector3());
    mesh(new BoxGeometry(size.x, size.y, size.z), finish, parent).position.copy(
      bounds.getCenter(new Vector3()),
    );
  };
  try {
    const wallFinish = material(0xdedbd4);
    const fixedFinish = material(0x9eaaa9);
    const glass = material(0xadc6cf, true);
    for (const element of model.sourceElementsById.values()) {
      const sourceGroup = new Group();
      sourceGroup.name = element.id;
      sourceGroup.userData = { sourceId: element.id, kind: element.kind };
      objectsBySourceId.set(element.id, sourceGroup);
      group.add(sourceGroup);
    }
    const sourceGroup = (id: string): Group => {
      const result = objectsBySourceId.get(id);
      if (!result) throw new Error(`Missing renderer source group: ${id}`);
      return result;
    };
    const derived = deriveArchitecturalSurfaces(model);
    for (const kind of ["floor", "ceiling"] as const) {
      const surfaces = derived.surfaces.filter((surface) => surface.kind === kind);
      // Inward-facing boundaries expose the interior without invented slab thickness.
      mesh(
        surfaceGeometry(surfaces),
        material(kind === "floor" ? 0xb5afa4 : 0xe9e7e1),
        group,
        kind === "floor",
      ).name = kind;
    }
    for (const wall of model.walls) {
      const surfaces = derived.surfaces.filter(
        (surface) => "sourceId" in surface && surface.sourceId === wall.id,
      );
      mesh(surfaceGeometry(surfaces), wallFinish, sourceGroup(wall.id));
    }
    for (const window of model.windows) {
      const bounds = rendererBox(window.opening);
      const center = bounds.getCenter(new Vector3());
      const a = bounds.min.clone();
      const b = bounds.max.clone();
      const axis = window.wall.axis === "x" ? "z" : "x";
      a[axis] = center[axis];
      b[axis] = center[axis];
      const c = a.clone();
      c.y = b.y;
      const d = b.clone();
      d.y = a.y;
      mesh(quadGeometry(a, d, b, c), glass, sourceGroup(window.id), false);
    }
    // Leaf thickness and sliding tracks are unspecified; doors remain unobstructed openings.
    for (const element of model.fixedElements)
      box(rendererBox(element.volume), fixedFinish, sourceGroup(element.id));
    const markerFinish = material(0x6e7b82);
    for (const utility of model.utilities) {
      const marker = mesh(
        new SphereGeometry(0.035, 12, 8),
        markerFinish,
        sourceGroup(utility.id),
        false,
      );
      marker.position.copy(rendererPoint(utility.position));
      marker.userData.visualizationMarker = true;
    }
    group.updateMatrixWorld(true);
    return { group, objectsBySourceId, bounds: new Box3().setFromObject(group), dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}

function quadGeometry(a: Vector3, b: Vector3, c: Vector3, d: Vector3): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute([...a.toArray(), ...b.toArray(), ...c.toArray(), ...d.toArray()], 3),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  return geometry;
}
