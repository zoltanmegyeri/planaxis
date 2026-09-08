import { createDecimal as decimal } from "@planaxis/geometry";
import { BackSide, Box3, FrontSide, Mesh, Raycaster, Vector3 } from "three/webgpu";
import { expect, it, vi } from "vitest";
import { buildApartmentScene } from "../src/index.js";
import { meters, rendererPoint } from "../src/coordinates.js";
import { buildWallGeometries, wallCells } from "../src/wall-geometry.js";
import { modelFixture } from "./model-fixture.js";

it("casts shadows from entry surfaces at wall corners and floor contacts", () => {
  const scene = buildApartmentScene(modelFixture("wall-junctions.svg"));
  const floor = scene.group.getObjectByName("floor");
  const wall = scene.objectsBySourceId.get("wall-2")?.children[0];
  if (!(floor instanceof Mesh) || !(wall instanceof Mesh)) throw new Error("Missing surfaces");
  // Reproduce the shadow pass's side selection. Back-face casting records the exit
  // surface, leaking light when a filtered/bias-offset receiver lies inside the solid.
  for (const [object, origin, direction, distance] of [
    [floor, new Vector3(4.89, 1, 1), new Vector3(0, -1, 0), 1],
    [wall, new Vector3(6, 1, 1), new Vector3(-1, 0, 0), 1],
  ] as const) {
    const material = object.material;
    if (Array.isArray(material)) throw new Error("Expected one material");
    const shadowMaterial = material.clone();
    shadowMaterial.side =
      material.shadowSide ?? (material.side === FrontSide ? BackSide : FrontSide);
    const caster = new Mesh(object.geometry, shadowMaterial);
    const hit = new Raycaster(origin, direction).intersectObject(caster)[0];
    expect(hit?.distance).toBeCloseTo(distance);
    expect(object.castShadow).toBe(true);
    expect(object.receiveShadow).toBe(true);
    shadowMaterial.dispose();
  }
  scene.dispose();
});

it("converts exact centimeters and changes basis handedness for SVG screen coordinates", () => {
  expect(meters(decimal("123.45"))).toBe(1.2345);
  const point = (x: string, y: string, z: string): Vector3 =>
    rendererPoint({ x: decimal(x), y: decimal(y), z: decimal(z) });
  expect(point("100", "200", "300").toArray()).toEqual([1, 3, 2]);
  expect(
    point("100", "0", "0")
      .cross(point("0", "100", "0"))
      .distanceTo(point("0", "0", "100").negate()),
  ).toBe(0);
});

it("places walls and fixed elements and leaves both window and door voids open", () => {
  const scene = buildApartmentScene(modelFixture());
  const wall = scene.objectsBySourceId.get("wall-1");
  if (!wall) throw new Error("Missing wall");
  const bounds = new Box3().setFromObject(wall);
  expect(bounds.min.toArray()).toEqual([expect.closeTo(0), expect.closeTo(0), expect.closeTo(0)]);
  expect(bounds.getSize(new Vector3()).toArray()).toEqual([
    expect.closeTo(1),
    expect.closeTo(2.42),
    expect.closeTo(0.1),
  ]);
  const ray = (x: number, height: number): number =>
    new Raycaster(new Vector3(x, height, 1), new Vector3(0, 0, -1)).intersectObject(wall).length;
  expect(ray(0.25, 1.5)).toBe(0);
  expect(ray(0.65, 1)).toBe(0);
  expect(ray(0.45, 1)).toBeGreaterThan(0);
  expect(ray(0.25, 2.2)).toBeGreaterThan(0);
  const column = scene.objectsBySourceId.get("column-1");
  if (!column) throw new Error("Missing column");
  expect(new Box3().setFromObject(column).getCenter(new Vector3()).toArray()).toEqual([
    expect.closeTo(1.3),
    expect.closeTo(1.21),
    expect.closeTo(0.3),
  ]);
  expect(scene.objectsBySourceId.get("window-1")?.children[0]).toBeInstanceOf(Mesh);
  expect(scene.objectsBySourceId.get("door-1")?.children).toHaveLength(0);
  scene.dispose();
});

it("partitions multiple vertically separated openings on a vertical wall without losing solids", () => {
  const model = modelFixture();
  const original = model.walls[0];
  if (!original) throw new Error("Missing wall");
  const prism = (bottom: string, top: string) => ({
    footprint: { x: decimal("0"), y: decimal("20"), width: decimal("10"), height: decimal("40") },
    verticalRange: { minZ: decimal(bottom), maxZ: decimal(top) },
  });
  const wall = {
    ...original,
    axis: "y" as const,
    volume: {
      footprint: { x: decimal("0"), y: decimal("0"), width: decimal("10"), height: decimal("100") },
      verticalRange: { minZ: decimal("300"), maxZ: decimal("600") },
    },
  };
  const cells = wallCells(wall, [prism("320", "400"), prism("450", "550")]);
  const occupied = (height: number): boolean =>
    cells.some((cell) => cell.containsPoint(new Vector3(0.05, height, 0.4)));
  expect(occupied(3.5)).toBe(false);
  expect(occupied(4.25)).toBe(true);
  expect(occupied(5)).toBe(false);
  expect(occupied(5.75)).toBe(true);
  const volume = cells.reduce((sum, cell) => {
    const size = cell.getSize(new Vector3());
    return sum + size.x * size.y * size.z;
  }, 0);
  expect(volume).toBeCloseTo(0.3 - 0.4 * 0.1 * 1.8);
});

it("triangulates concave floor and ceiling with inward normals and no invented thickness", () => {
  const model = modelFixture();
  const boundary = [
    [0, 0],
    [300, 0],
    [300, 100],
    [100, 100],
    [100, 300],
    [0, 300],
  ].map(([x, y]) => ({ x: decimal(String(x)), y: decimal(String(y)) }));
  const scene = buildApartmentScene({
    ...model,
    floor: { boundary, z: decimal("300") },
    ceiling: { boundary, z: decimal("542") },
  });
  for (const [name, height, normal] of [
    ["floor", 3, 1],
    ["ceiling", 5.42, -1],
  ] as const) {
    const surface = scene.group.getObjectByName(name);
    if (!(surface instanceof Mesh)) throw new Error("Missing surface");
    const bounds = new Box3().setFromObject(surface);
    expect(bounds.min.y).toBeCloseTo(height);
    expect(bounds.max.y).toBeCloseTo(height);
    expect(surface.geometry.getAttribute("normal").getY(0)).toBeCloseTo(normal);
    const positions = surface.geometry.getAttribute("position");
    const indices = surface.geometry.getIndex();
    if (!indices) throw new Error("Missing triangles");
    let area = 0;
    for (let i = 0; i < indices.count; i += 3) {
      const a = new Vector3().fromBufferAttribute(positions, indices.getX(i));
      const b = new Vector3().fromBufferAttribute(positions, indices.getX(i + 1));
      const c = new Vector3().fromBufferAttribute(positions, indices.getX(i + 2));
      area += b.sub(a).cross(c.sub(a)).length() / 2;
    }
    expect(area).toBeCloseTo(5);
  }
  scene.dispose();
});

it("maps source IDs, constructs deterministic geometry, and releases each shared resource once", () => {
  const model = modelFixture();
  const first = buildApartmentScene(model);
  const second = buildApartmentScene(model);
  expect([...first.objectsBySourceId.keys()]).toEqual([...model.sourceElementsById.keys()]);
  const meshes = (scene: typeof first): Mesh[] => {
    const result: Mesh[] = [];
    scene.group.traverse((object) => {
      if (object instanceof Mesh) result.push(object);
    });
    return result;
  };
  const a = meshes(first);
  const b = meshes(second);
  expect(a.map((mesh) => mesh.position.toArray())).toEqual(
    b.map((mesh) => mesh.position.toArray()),
  );
  expect(a.map((mesh) => [...mesh.geometry.getAttribute("position").array])).toEqual(
    b.map((mesh) => [...mesh.geometry.getAttribute("position").array]),
  );
  const resources = new Set(a.flatMap((mesh) => [mesh.geometry, ...[mesh.material].flat()]));
  const spies = [...resources].map((resource) => vi.spyOn(resource, "dispose"));
  first.dispose();
  first.dispose();
  for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
  expect(first.group.children).toHaveLength(0);
  expect(first.objectsBySourceId.size).toBe(0);
  second.dispose();
});

it("removes partition faces while retaining opening reveals and outward wall surfaces", () => {
  const scene = buildApartmentScene(modelFixture());
  const wall = scene.objectsBySourceId.get("wall-1");
  if (!wall) throw new Error("Missing wall");
  let area = 0;
  let signedVolume = 0;
  wall.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const positions = object.geometry.getAttribute("position");
    const indices = object.geometry.getIndex();
    if (!indices) throw new Error("Missing wall indices");
    for (let i = 0; i < indices.count; i += 3) {
      const a = new Vector3()
        .fromBufferAttribute(positions, indices.getX(i))
        .applyMatrix4(object.matrixWorld);
      const b = new Vector3()
        .fromBufferAttribute(positions, indices.getX(i + 1))
        .applyMatrix4(object.matrixWorld);
      const c = new Vector3()
        .fromBufferAttribute(positions, indices.getX(i + 2))
        .applyMatrix4(object.matrixWorld);
      area += b.clone().sub(a).cross(c.clone().sub(a)).length() / 2;
      signedVolume += a.dot(b.clone().cross(c)) / 6;
    }
  });
  // 1 × 2.42 × 0.1 wall, a 0.3 × 1.2 window and a floor-reaching 0.3 × 2.1 door.
  // Internal partition faces contribute no surface area; reveals remain exposed.
  expect(area).toBeCloseTo(4.264, 5);
  expect(signedVolume).toBeCloseTo((2.42 - 0.3 * 1.2 - 0.3 * 2.1) * 0.1, 6);
  expect(wall.children).toHaveLength(1);
  scene.dispose();
});

it.each([false, true])(
  "renders a rectangular wall union without duplicate corner caps (butted=%s)",
  (butted) => {
    const source = modelFixture().walls[0];
    if (!source) throw new Error("Missing wall");
    const walls = [
      [0, 0, 500, 10],
      [0, 390, 500, 10],
      [0, butted ? 10 : 0, 10, butted ? 380 : 400],
      [490, butted ? 10 : 0, 10, butted ? 380 : 400],
    ].map(([x = 0, y = 0, width = 0, height = 0], index) => ({
      wall: {
        ...source,
        id: `wall-${index}`,
        axis: width > height ? ("x" as const) : ("y" as const),
        volume: {
          footprint: {
            x: decimal(String(x)),
            y: decimal(String(y)),
            width: decimal(String(width)),
            height: decimal(String(height)),
          },
          verticalRange: { minZ: decimal("0"), maxZ: decimal("300") },
        },
      },
      openings: [],
    }));
    const geometries = buildWallGeometries(walls);
    let area = 0;
    let volume = 0;
    let topArea = 0;
    for (const geometry of geometries) {
      const positions = geometry.getAttribute("position");
      const indices = geometry.getIndex();
      if (!indices) throw new Error("Missing triangles");
      for (let i = 0; i < indices.count; i += 3) {
        const a = new Vector3().fromBufferAttribute(positions, indices.getX(i));
        const b = new Vector3().fromBufferAttribute(positions, indices.getX(i + 1));
        const c = new Vector3().fromBufferAttribute(positions, indices.getX(i + 2));
        const triangleArea = b.clone().sub(a).cross(c.clone().sub(a)).length() / 2;
        area += triangleArea;
        volume += a.dot(b.clone().cross(c)) / 6;
        if (a.y === 3 && b.y === 3 && c.y === 3) topArea += triangleArea;
      }
      geometry.dispose();
    }
    // One continuous 5 × 4 m ring with 10 cm walls and a 4.8 × 3.8 m interior.
    expect(topArea).toBeCloseTo(20 - 4.8 * 3.8, 5);
    expect(area).toBeCloseTo(2 * (20 - 4.8 * 3.8) + (18 + 17.2) * 3, 5);
    expect(volume).toBeCloseTo((20 - 4.8 * 3.8) * 3, 5);
  },
);
