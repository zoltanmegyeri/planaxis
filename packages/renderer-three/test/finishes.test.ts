import { createDecimal as decimal } from "@planaxis/geometry";
import { deriveArchitecturalSurfaces } from "@planaxis/model-3d";
import type { ArchitecturalModel3D, FinishTargetId, RuntimePbrMaterial } from "@planaxis/model-3d";
import {
  DataTexture,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  MeshStandardNodeMaterial,
  NoColorSpace,
  Raycaster,
  RepeatWrapping,
  SRGBColorSpace,
  TangentSpaceNormalMap,
  Vector3,
} from "three/webgpu";
import type { BufferGeometry, Material } from "three/webgpu";
import { expect, it, vi } from "vitest";
import { buildApartmentScene } from "../src/index.js";
import { surfaceGeometry } from "../src/surface-geometry.js";
import { modelFixture } from "./model-fixture.js";

const base: RuntimePbrMaterial = { baseColor: [0.8, 0.6, 0.4], roughness: 0.6, metalness: 0.2 };
const override: RuntimePbrMaterial = { baseColor: [0.2, 0.4, 0.8], roughness: 0.3, metalness: 0.8 };
const mapped = (width = "25", height = "50"): RuntimePbrMaterial => ({
  ...base,
  textures: { widthCm: decimal(width), heightCm: decimal(height) },
});
function mesh(value: unknown): Mesh<BufferGeometry, Material | Material[]> {
  if (!(value instanceof Mesh)) throw new Error("Missing test mesh.");
  return value;
}
function room(
  id: string,
  points: readonly (readonly [string, string])[],
): ArchitecturalModel3D["spaces"][number] {
  return {
    id,
    kind: "zone",
    name: id,
    function: "living-room",
    enclosure: "open",
    boundary: points.map(([x, y]) => ({ x: decimal(x), y: decimal(y) })),
  };
}
function triangles(
  object: Mesh<BufferGeometry, Material | Material[]>,
): { points: Vector3[]; material: Material }[] {
  const geometry = object.geometry;
  const indices = geometry.getIndex();
  if (!indices) throw new Error("Missing indices.");
  const palette = [object.material].flat();
  return geometry.groups.flatMap((group) => {
    const material = palette[group.materialIndex ?? 0];
    if (!material) throw new Error("Missing material.");
    const result = [];
    for (let i = group.start; i < group.start + group.count; i += 3)
      result.push({
        material,
        points: [0, 1, 2].map((j) =>
          new Vector3().fromBufferAttribute(geometry.getAttribute("position"), indices.getX(i + j)),
        ),
      });
    return result;
  });
}
function area(object: Mesh<BufferGeometry, Material | Material[]>, metalness?: number): number {
  return triangles(object).reduce((sum, triangle) => {
    if (
      metalness !== undefined &&
      (!(triangle.material instanceof MeshStandardMaterial) ||
        triangle.material.metalness !== metalness)
    )
      return sum;
    const [a, b, c] = triangle.points;
    if (!a || !b || !c) throw new Error("Missing triangle point.");
    return sum + b.clone().sub(a).cross(c.clone().sub(a)).length() / 2;
  }, 0);
}

it.each(["floor", "ceiling"] as const)(
  "scales %s UVs in centimeters and shares phase across space boundaries",
  (kind) => {
    const model = modelFixture();
    const assignments = new Map<FinishTargetId, RuntimePbrMaterial>([
      [kind, mapped()],
      [`space:space-1:${kind}`, mapped()],
    ]);
    const scene = buildApartmentScene(model, { assignments });
    const surface = mesh(scene.group.getObjectByName(kind));
    const positions = surface.geometry.getAttribute("position"),
      uv = surface.geometry.getAttribute("uv");
    for (let i = 0; i < positions.count; i++) {
      expect(uv.getX(i)).toBeCloseTo((positions.getX(i) * 100) / 25, 5);
      expect(uv.getY(i)).toBeCloseTo(
        ((positions.getZ(i) * 100) / 50) * (kind === "floor" ? 1 : -1),
        5,
      );
    }
    expect(area(surface)).toBeCloseTo(20);
    expect(surface.geometry.userData.resolvedFinishTargetRanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ finishTargetId: `space:space-1:${kind}` }),
      ]),
    );
    scene.dispose();
  },
);

it("changes texture repeat density with physical dimensions, including negative global coordinates", () => {
  const source = modelFixture();
  const boundary = [
    ["-100", "-50"],
    ["100", "-50"],
    ["100", "50"],
    ["-100", "50"],
  ].map(([x, y]) => ({ x: decimal(x ?? "0"), y: decimal(y ?? "0") }));
  const model = { ...source, floor: { ...source.floor, boundary }, spaces: [] };
  const scenes = [
    buildApartmentScene(model, { assignments: new Map([["floor", mapped("20", "10")]]) }),
    buildApartmentScene(model, { assignments: new Map([["floor", mapped("40", "20")]]) }),
  ];
  const small = mesh(scenes[0]?.group.getObjectByName("floor")).geometry.getAttribute("uv");
  const large = mesh(scenes[1]?.group.getObjectByName("floor")).geometry.getAttribute("uv");
  for (let i = 0; i < small.count; i++) {
    expect(small.getX(i)).toBe(large.getX(i) * 2);
    expect(small.getY(i)).toBe(large.getY(i) * 2);
  }
  expect(Math.min(...small.array)).toBe(-5);
  for (const scene of scenes) scene.dispose();
});

it.each(["x", "y"] as const)(
  "keeps %s wall mapping upright and continuous around openings and patch reordering",
  (axis) => {
    const source = modelFixture();
    const original = source.walls[0];
    if (!original) throw new Error("Missing wall.");
    const transpose = (footprint: typeof original.volume.footprint) =>
      axis === "x"
        ? footprint
        : { x: footprint.y, y: footprint.x, width: footprint.height, height: footprint.width };
    const wall = {
      ...original,
      axis,
      volume: { ...original.volume, footprint: transpose(original.volume.footprint) },
    };
    const model = {
      ...source,
      walls: [wall],
      spaces: [],
      windows: source.windows.map((w) => ({
        ...w,
        wall,
        opening: { ...w.opening, footprint: transpose(w.opening.footprint) },
      })),
      doors: [],
    };
    const derived = deriveArchitecturalSurfaces(model);
    const surfaces = derived.surfaces.filter((s) => s.kind === "wall-side");
    const assignment = mapped();
    const options = {
      targets: derived.finishTargets,
      assignments: new Map<FinishTargetId, RuntimePbrMaterial>([
        ["wall:wall-1:side-negative", assignment],
        ["wall:wall-1:side-positive", assignment],
      ]),
      materialIndex: () => 0,
    };
    for (const surface of surfaces) {
      if (surface.kind !== "wall-side") throw new Error("Expected wall side.");
      const a = surfaceGeometry([surface], options);
      const b = surfaceGeometry([{ ...surface, patches: [...surface.patches].reverse() }], options);
      const samples = (geometry: BufferGeometry): string[] => {
        const p = geometry.getAttribute("position"),
          uv = geometry.getAttribute("uv");
        for (let i = 0; i < p.count; i++) {
          const longitudinal = axis === "x" ? p.getX(i) : p.getZ(i);
          const sign = (axis === "x") === (surface.side === "side-negative") ? 1 : -1;
          expect(uv.getX(i)).toBeCloseTo((sign * longitudinal * 100) / 25, 5);
          expect(uv.getY(i)).toBeCloseTo((p.getY(i) * 100) / 50, 5);
        }
        return Array.from({ length: p.count }, (_, i) =>
          [p.getX(i), p.getY(i), p.getZ(i), uv.getX(i), uv.getY(i)].join(","),
        ).sort();
      };
      expect(samples(a)).toEqual(samples(b));
      a.dispose();
      b.dispose();
    }
  },
);

it.each(["floor", "ceiling"] as const)(
  "partitions concave and diagonal %s overrides with fallback and no double coverage",
  (kind) => {
    const source = modelFixture();
    const spaces = [
      room("triangle", [
        ["100", "100"],
        ["300", "100"],
        ["100", "300"],
      ]),
      room("concave", [
        ["300", "200"],
        ["400", "200"],
        ["400", "250"],
        ["350", "250"],
        ["350", "300"],
        ["300", "300"],
      ]),
      room("fallback", [
        ["0", "200"],
        ["50", "200"],
        ["50", "300"],
        ["0", "300"],
      ]),
    ];
    const scene = buildApartmentScene(
      { ...source, spaces },
      {
        assignments: new Map<FinishTargetId, RuntimePbrMaterial>([
          [kind, base],
          [`space:triangle:${kind}`, override],
          [`space:concave:${kind}`, override],
        ]),
      },
    );
    const surface = mesh(scene.group.getObjectByName(kind));
    expect(area(surface)).toBeCloseTo(20, 5);
    expect(area(surface, override.metalness)).toBeCloseTo(2.75, 5);
    expect(area(surface, base.metalness)).toBeCloseTo(17.25, 5);
    for (const [x, y, expected] of [
      [1.23, 1.37, override.metalness],
      [3.23, 2.77, override.metalness],
      [3.79, 2.77, base.metalness],
      [0.23, 2.37, base.metalness],
    ] as const) {
      const hits = new Raycaster(
        new Vector3(x, kind === "floor" ? 1 : 2, y),
        new Vector3(0, kind === "floor" ? -1 : 1, 0),
      ).intersectObject(surface);
      expect(hits).toHaveLength(1);
      const hit = hits[0];
      const finish = [surface.material].flat()[hit?.face?.materialIndex ?? 0];
      expect(finish).toBeInstanceOf(MeshStandardMaterial);
      expect((finish as MeshStandardMaterial).metalness).toBe(expected);
    }
    scene.dispose();
  },
);

it("applies disconnected wall coverage once with one material and continuous mapping", () => {
  const source = modelFixture();
  const spaces = [
    room("arms", [
      ["0", "10"],
      ["8", "10"],
      ["8", "40"],
      ["92", "40"],
      ["92", "10"],
      ["100", "10"],
      ["100", "90"],
      ["0", "90"],
    ]),
  ];
  const model = { ...source, spaces };
  const finish = { ...override, textures: mapped().textures } as RuntimePbrMaterial;
  const assignments = new Map<FinishTargetId, RuntimePbrMaterial>([
    ["wall:wall-1:side-positive", base],
    ["space:arms:wall:wall-1:side-positive", finish],
  ]);
  const scene = buildApartmentScene(model, { assignments });
  const wall = mesh(scene.objectsBySourceId.get("wall-1")?.children[0]);
  expect(scene.objectsBySourceId.get("wall-1")?.children).toHaveLength(1);
  expect(area(wall)).toBeCloseTo(4.264, 5);
  expect(area(wall, override.metalness)).toBeCloseTo(0.16 * 2.42, 5);
  for (const [x, expected] of [
    [0.031, override.metalness],
    [0.951, override.metalness],
    [0.451, base.metalness],
  ] as const) {
    const hits = new Raycaster(new Vector3(x, 1.13, 1), new Vector3(0, 0, -1)).intersectObject(
      wall,
    );
    expect(hits).toHaveLength(1);
    const finish = [wall.material].flat()[hits[0]?.face?.materialIndex ?? 0];
    expect((finish as MeshStandardMaterial).metalness).toBe(expected);
  }
  const p = wall.geometry.getAttribute("position"),
    uv = wall.geometry.getAttribute("uv"),
    index = wall.geometry.getIndex();
  if (!index) throw new Error("Missing index.");
  for (const group of wall.geometry.groups) {
    const material = [wall.material].flat()[group.materialIndex ?? 0];
    if (!(material instanceof MeshStandardMaterial) || material.metalness !== override.metalness)
      continue;
    for (let i = group.start; i < group.start + group.count; i++) {
      const vertex = index.getX(i);
      expect(uv.getX(vertex)).toBeCloseTo(-p.getX(vertex) * 4, 5);
      expect(uv.getY(vertex)).toBeCloseTo(p.getY(vertex) * 2, 5);
    }
  }
  const repeat = buildApartmentScene(model, { assignments });
  expect([...wall.geometry.getAttribute("position").array]).toEqual([
    ...mesh(repeat.objectsBySourceId.get("wall-1")?.children[0]).geometry.getAttribute("position")
      .array,
  ]);
  repeat.dispose();
  scene.dispose();
});

it("leaves unassigned regions neutral while assigning base reveals independently", () => {
  const scene = buildApartmentScene(modelFixture(), {
    assignments: new Map<FinishTargetId, RuntimePbrMaterial>([
      ["space:space-1:floor", override],
      ["wall:wall-1:opening:window-1:reveal-bottom", base],
    ]),
  });
  const floor = mesh(scene.group.getObjectByName("floor"));
  expect(area(floor, override.metalness)).toBeCloseTo(0.9);
  expect(area(floor, 0)).toBeCloseTo(19.1);
  const wall = mesh(scene.objectsBySourceId.get("wall-1")?.children[0]);
  expect(area(wall, base.metalness)).toBeCloseTo(0.03);
  expect(area(wall)).toBeCloseTo(4.264);
  scene.dispose();
});

it("configures independent color/data maps with repeat wrapping and disposes only owned clones", () => {
  const reference = Symbol();
  const source = new DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1);
  source.repeat.set(3, 4);
  source.offset.set(0.2, 0.3);
  source.rotation = 0.7;
  source.channel = 2;
  source.matrixAutoUpdate = false;
  const sourceDispose = vi.spyOn(source, "dispose");
  const scene = buildApartmentScene(modelFixture(), {
    assignments: new Map([
      [
        "floor",
        {
          ...base,
          textures: {
            widthCm: decimal("20"),
            heightCm: decimal("40"),
            baseColorMap: reference,
            roughnessMap: reference,
            metalnessMap: reference,
            normalMap: reference,
          },
        },
      ],
    ]),
    resolveTexture: () => source,
  });
  const material = mesh(scene.group.getObjectByName("floor")).material;
  if (!(material instanceof MeshStandardMaterial)) throw new Error("Missing PBR material.");
  expect(material.color.getRGB({ r: 0, g: 0, b: 0 }, SRGBColorSpace)).toEqual({
    r: expect.closeTo(0.8),
    g: expect.closeTo(0.6),
    b: expect.closeTo(0.4),
  });
  expect(material.normalMapType).toBe(TangentSpaceNormalMap);
  const maps = [material.map, material.roughnessMap, material.metalnessMap, material.normalMap];
  expect(new Set(maps).size).toBe(4);
  const disposals = maps.map((map, i) => {
    if (!map) throw new Error("Missing texture.");
    expect(map).not.toBe(source);
    expect(map.colorSpace).toBe(i === 0 ? SRGBColorSpace : NoColorSpace);
    expect(map.wrapS).toBe(RepeatWrapping);
    expect(map.wrapT).toBe(RepeatWrapping);
    expect(map.repeat.toArray()).toEqual([1, 1]);
    expect(map.offset.toArray()).toEqual([0, 0]);
    expect(map.rotation).toBe(0);
    expect(map.channel).toBe(0);
    expect(map.matrixAutoUpdate).toBe(true);
    expect(map.image).toBe(source.image);
    return vi.spyOn(map, "dispose");
  });
  expect(source.repeat.toArray()).toEqual([3, 4]);
  const materialDispose = vi.spyOn(material, "dispose");
  scene.dispose();
  scene.dispose();
  for (const dispose of disposals) expect(dispose).toHaveBeenCalledTimes(1);
  expect(materialDispose).toHaveBeenCalledTimes(1);
  expect(sourceDispose).not.toHaveBeenCalled();
  source.dispose();
});

it.each(["opaque", "mask", "blend"] as const)("adapts ordinary %s alpha behavior", (mode) => {
  const alpha =
    mode === "opaque"
      ? { mode }
      : mode === "mask"
        ? { mode, opacity: 0.7, cutoff: 0.4 }
        : { mode, opacity: 0.7 };
  const scene = buildApartmentScene(modelFixture(), {
    assignments: new Map([["floor", { ...base, alpha }]]),
  });
  const material = mesh(scene.group.getObjectByName("floor")).material;
  if (
    !(material instanceof MeshStandardMaterial) &&
    !(material instanceof MeshStandardNodeMaterial)
  )
    throw new Error("Missing material.");
  expect(material.opacity).toBe(mode === "opaque" ? 1 : 0.7);
  expect(material.transparent).toBe(mode === "blend");
  expect(material.depthWrite).toBe(mode !== "blend");
  expect(material.alphaTest).toBe(0);
  if (material instanceof MeshStandardNodeMaterial) expect(material.maskNode).not.toBeNull();
  scene.dispose();
});

it("cleans partial texture allocation when the resolver fails and requires explicit resolution", () => {
  const source = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  const cloned = source.clone();
  const disposal = vi.spyOn(cloned, "dispose");
  vi.spyOn(source, "clone").mockReturnValue(cloned);
  const assignments = new Map<FinishTargetId, RuntimePbrMaterial>([
    [
      "floor",
      {
        ...base,
        textures: {
          widthCm: decimal("1"),
          heightCm: decimal("1"),
          baseColorMap: Symbol(),
          normalMap: Symbol(),
        },
      },
    ],
  ]);
  expect(() => buildApartmentScene(modelFixture(), { assignments })).toThrow("resolver");
  const resolver = vi
    .fn()
    .mockReturnValueOnce(source)
    .mockImplementationOnce(() => {
      throw new Error("Texture unavailable");
    });
  expect(() =>
    buildApartmentScene(modelFixture(), { assignments, resolveTexture: resolver }),
  ).toThrow("Texture unavailable");
  expect(disposal).toHaveBeenCalledTimes(1);
  source.dispose();
});

it.each([undefined, "clear", "frosted", "tinted", "other"] as const)(
  "uses physical transmission for %s glass without adding thickness",
  (glassType) => {
    const model = modelFixture();
    const windows = model.windows.map((window) => ({
      ...window,
      ...(glassType === undefined ? {} : { glassType }),
    }));
    const scene = buildApartmentScene({ ...model, windows });
    const pane = mesh(scene.objectsBySourceId.get("window-1")?.children[0]);
    const material = pane.material;
    if (!(material instanceof MeshPhysicalMaterial)) throw new Error("Expected physical glass.");
    expect(material.transmission).toBe(1);
    expect(material.opacity).toBe(1);
    expect(material.transparent).toBe(false);
    expect(material.thickness).toBe(0);
    expect(material.roughness).toBe(glassType === "frosted" ? 0.5 : 0.05);
    expect(material.color.getHex()).toBe(glassType === "tinted" ? 0xa6a6a6 : 0xffffff);
    expect(material.ior).toBe(1.5);
    expect(pane.geometry.getAttribute("position").count).toBe(4);
    const positions = pane.geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++) expect(positions.getZ(i)).toBeCloseTo(0.05);
    expect(pane.castShadow).toBe(false);
    const disposal = vi.spyOn(material, "dispose");
    scene.dispose();
    expect(disposal).toHaveBeenCalledTimes(1);
  },
);

it.each([0, 0.4, 1])("retains mask equality at cutoff %s in the shader comparison", (cutoff) => {
  const scene = buildApartmentScene(modelFixture(), {
    assignments: new Map([
      ["floor", { ...base, alpha: { mode: "mask", opacity: cutoff, cutoff } }],
    ]),
  });
  const material = mesh(scene.group.getObjectByName("floor")).material;
  if (!(material instanceof MeshStandardNodeMaterial))
    throw new Error("Expected masked PBR node material");
  // The generated node graph must retain equality; the backend's built-in alphaTest
  // uses <= and would discard these fragments (including fully opaque alpha at 1).
  const graph = material.maskNode?.toJSON();
  expect(graph?.nodes).toEqual(expect.arrayContaining([expect.objectContaining({ op: ">=" })]));
  expect(graph?.nodes).not.toEqual(expect.arrayContaining([expect.objectContaining({ op: "<=" })]));
  expect(material.alphaTest).toBe(0);
  expect(material.opacity).toBe(cutoff);
  scene.dispose();
});
