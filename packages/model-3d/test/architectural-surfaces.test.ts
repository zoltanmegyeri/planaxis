import { createDecimal as decimal, getPolygonArea } from "@planaxis/geometry";
import type { Decimal, Point2D, Point3D } from "@planaxis/geometry";
import type { ApartmentSpace } from "@planaxis/model";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  buildArchitecturalModel3D,
  surfaceMappingDistances,
  deriveArchitecturalSurfaces,
  horizontalFinishTargetId,
  revealFinishTargetId,
  spaceFinishTargetId,
  wallSideFinishTargetId,
} from "../src/index.js";
import type {
  ArchitecturalModel3D,
  ArchitecturalSurfacePatch3D,
  ArchitecturalSurfaceSet3D,
  ArchitecturalWall3D,
  RectangularSurfacePatch3D,
  SpaceFinishTarget,
} from "../src/index.js";
import { apartmentFixture } from "./apartment-fixture.js";

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Missing test value.");
  return value;
}
function point(x: string, y: string): Point2D {
  return { x: decimal(x), y: decimal(y) };
}
function space(
  boundary: readonly (readonly [string, string])[],
  enclosure: ApartmentSpace["enclosure"] = "open",
  id = "room",
): ApartmentSpace {
  return {
    id,
    kind: "zone",
    name: "Room",
    function: "living-room",
    enclosure,
    boundary: boundary.map(([x, y]) => point(x, y)),
  };
}
function wall(
  axis: "x" | "y" = "x",
  id = "wall",
  x = "10",
  y = "10",
  width = "100",
  height = "10",
  top = "542.3",
): ArchitecturalWall3D {
  const source = required(buildArchitecturalModel3D(apartmentFixture()).walls[0]);
  const a = decimal(x),
    b = decimal(y),
    w = decimal(width),
    h = decimal(height);
  return {
    ...source,
    id,
    axis,
    length: axis === "x" ? w : h,
    thickness: axis === "x" ? h : w,
    effectiveHeight: decimal(top).minus(decimal("300.1")),
    centerline:
      axis === "x"
        ? {
            start: point(x, b.plus(h.div(2)).toString()),
            end: point(a.plus(w).toString(), b.plus(h.div(2)).toString()),
          }
        : {
            start: point(a.plus(w.div(2)).toString(), y),
            end: point(a.plus(w.div(2)).toString(), b.plus(h).toString()),
          },
    volume: {
      footprint: { x: a, y: b, width: w, height: h },
      verticalRange: { minZ: decimal("300.1"), maxZ: decimal(top) },
    },
  };
}
function model(
  walls: readonly ArchitecturalWall3D[] = [wall()],
  spaces: readonly ApartmentSpace[] = [],
): ArchitecturalModel3D {
  return {
    ...buildArchitecturalModel3D(apartmentFixture()),
    walls,
    spaces,
    windows: [],
    doors: [],
    fixedElements: [],
    utilities: [],
    cameras: [],
    sourceElementsById: new Map(walls.map((wall) => [wall.id, wall])),
  };
}
function windowModel(axis: "x" | "y" = "x"): ArchitecturalModel3D {
  const owner = axis === "x" ? wall() : wall("y", "wall", "10", "10", "10", "100");
  const window = required(buildArchitecturalModel3D(apartmentFixture()).windows[0]);
  return {
    ...model([owner]),
    windows: [
      {
        ...window,
        wall: owner,
        id: "window",
        opening: {
          footprint: {
            x: decimal(axis === "x" ? "30" : "10"),
            y: decimal(axis === "x" ? "10" : "30"),
            width: decimal(axis === "x" ? "20" : "10"),
            height: decimal(axis === "x" ? "10" : "20"),
          },
          verticalRange: { minZ: decimal("390.3"), maxZ: decimal("520.6") },
        },
      },
    ],
  };
}
function patches(set: ArchitecturalSurfaceSet3D, id: string): readonly RectangularSurfacePatch3D[] {
  const surface = required(
    set.surfaces.find((surface) => "finishTargetId" in surface && surface.finishTargetId === id),
  );
  if (surface.kind === "floor" || surface.kind === "ceiling")
    throw new Error("Expected rectangle patches.");
  return surface.patches.filter(
    (patch): patch is RectangularSurfacePatch3D => patch.kind === "rectangle",
  );
}
function override(set: ArchitecturalSurfaceSet3D, id: string): SpaceFinishTarget {
  const target = required(set.finishTargets.find((target) => target.id === id));
  if (target.scope !== "space") throw new Error("Expected space override.");
  return target;
}
function coordinates(point: Point3D): string[] {
  return [point.x, point.y, point.z].map((value) => value.toString());
}
function area(patch: ArchitecturalSurfacePatch3D): Decimal {
  if (patch.kind === "horizontal") return getPolygonArea(patch.boundary);
  return (["x", "y", "z"] as const)
    .filter((axis) => axis !== patch.normalAxis)
    .reduce((result, axis) => result.times(patch.max[axis].minus(patch.min[axis])), decimal("1"));
}
function totalArea(patches: readonly ArchitecturalSurfacePatch3D[]): string {
  return patches.reduce((sum, patch) => sum.plus(area(patch)), decimal("0")).toString();
}

describe("architectural surfaces", () => {
  it("retains exact space semantics while keeping physical boundaries and source selection unchanged", () => {
    const room = space(
      [
        ["20", "20"],
        ["200", "20"],
        ["200", "100"],
        ["20", "100"],
      ],
      "partial",
    );
    const source = { ...apartmentFixture(), spaces: Object.freeze([room]) };
    const architecture = buildArchitecturalModel3D(source);
    expect(architecture.spaces).toBe(source.spaces);
    expect(architecture.spaces[0]).toBe(room);
    expect(architecture.sourceElementsById.has(room.id)).toBe(false);
    expect(architecture.floor.boundary).toBe(source.footprint.boundary);
    expect(architecture.ceiling.boundary).toBe(source.footprint.boundary);
  });

  it("exposes stable base and space floor/ceiling targets with explicit fallback and separate coverage", () => {
    const room = space([
      ["20", "20"],
      ["30", "20"],
      ["30", "30"],
      ["20", "30"],
    ]);
    const architecture = model([], [room]);
    const result = deriveArchitecturalSurfaces(architecture);
    expect(result.finishTargets.map((target) => target.id)).toEqual([
      "floor",
      "ceiling",
      "space:room:floor",
      "space:room:ceiling",
    ]);
    expect(result.surfaces).toHaveLength(2);
    for (const kind of ["floor", "ceiling"] as const) {
      const target = override(result, `space:room:${kind}`);
      expect(target.baseTargetId).toBe(kind);
      expect(target.coverage).toEqual([
        {
          kind: "horizontal",
          boundary: room.boundary,
          z: architecture[kind].z,
          normalSign: kind === "floor" ? "positive" : "negative",
        },
      ]);
      expect(totalArea(target.coverage)).toBe("100");
      expect(
        totalArea(required(result.surfaces.find((surface) => surface.kind === kind)).patches),
      ).toBe("260000");
    }
    expect(deriveArchitecturalSurfaces(architecture)).toEqual(result);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.finishTargets)).toBe(true);
  });

  it("keeps neighboring spaces independent and leaves uncovered regions on their base target", () => {
    const left = space(
      [
        ["20", "20"],
        ["40", "20"],
        ["40", "60"],
        ["20", "60"],
      ],
      "open",
      "left",
    );
    const right = space(
      [
        ["40", "20"],
        ["70", "20"],
        ["70", "60"],
        ["40", "60"],
      ],
      "closed",
      "right",
    );
    const architecture = windowModel();
    const result = deriveArchitecturalSurfaces({ ...architecture, spaces: [left, right] });
    expect(result.surfaces).toEqual(deriveArchitecturalSurfaces(architecture).surfaces);
    const leftCoverage = override(result, "space:left:wall:wall:side-positive");
    const rightCoverage = override(result, "space:right:wall:wall:side-positive");
    expect(leftCoverage.baseTargetId).toBe(rightCoverage.baseTargetId);
    expect(totalArea(leftCoverage.coverage)).toBe("3541");
    expect(totalArea(rightCoverage.coverage)).toBe("5963");
    expect(result.finishTargets.filter((target) => target.scope === "space")).toHaveLength(6);
    expect(
      result.finishTargets
        .filter((target) => target.scope === "space")
        .every((target) => !target.id.includes(":opening:")),
    ).toBe(true);
  });

  it("centralizes colon-delimited semantic ID construction", () => {
    expect(horizontalFinishTargetId("floor")).toBe("floor");
    const base = wallSideFinishTargetId("wall.a-1", "side-positive");
    expect(base).toBe("wall:wall.a-1:side-positive");
    expect(spaceFinishTargetId("space_2", base)).toBe("space:space_2:wall:wall.a-1:side-positive");
    expect(revealFinishTargetId("wall.a-1", "window.1", "reveal-start")).toBe(
      "wall:wall.a-1:opening:window.1:reveal-start",
    );
  });

  it.each(["x", "y"] as const)(
    "uses signed transverse normals for %s walls without view-dependent identity",
    (axis) => {
      const owner = axis === "x" ? wall() : wall("y", "wall", "10", "10", "10", "100");
      const result = deriveArchitecturalSurfaces(model([owner]));
      for (const sign of ["negative", "positive"] as const) {
        const patch = required(patches(result, `wall:wall:side-${sign}`)[0]);
        expect(patch.normalAxis).toBe(axis === "x" ? "y" : "x");
        expect(patch.normalSign).toBe(sign);
        const transverse = sign === "negative" ? "10" : "20";
        expect(coordinates(patch.min)).toEqual(
          axis === "x" ? ["10", transverse, "300.1"] : [transverse, "10", "300.1"],
        );
        expect(coordinates(patch.max)).toEqual(
          axis === "x" ? ["110", transverse, "542.3"] : [transverse, "110", "542.3"],
        );
      }
    },
  );

  it.each(["open", "partial", "closed"] as const)(
    "uses positive-length adjacency for %s spaces on either side of either wall axis",
    (enclosure) => {
      for (const axis of ["x", "y"] as const)
        for (const side of ["negative", "positive"] as const) {
          const y = side === "positive" ? ["20", "40"] : ["0", "10"];
          const points: [string, string][] = [
            ["30", required(y[0])],
            ["80", required(y[0])],
            ["80", required(y[1])],
            ["30", required(y[1])],
          ];
          const room = space(axis === "x" ? points : points.map(([x, y]) => [y, x]), enclosure);
          const owner = axis === "x" ? wall() : wall("y", "wall", "10", "10", "10", "100");
          const result = deriveArchitecturalSurfaces(model([owner], [room]));
          const target = override(result, `space:room:wall:wall:side-${side}`);
          expect(target.baseTargetId).toBe(`wall:wall:side-${side}`);
          expect(totalArea(target.coverage)).toBe("12110");
          expect(
            result.finishTargets.filter(
              (target) => target.scope === "space" && target.id.includes(":wall:"),
            ),
          ).toHaveLength(1);
        }
    },
  );

  it.each([
    [
      ["50", "20"],
      ["70", "40"],
      ["30", "40"],
    ],
    [
      ["30", "20"],
      ["80", "20.001"],
      ["80", "40"],
      ["30", "40"],
    ],
    [
      ["30", "20.01"],
      ["80", "20.01"],
      ["80", "40"],
      ["30", "40"],
    ],
  ])(
    "does not turn point contact, diagonal edges, or a small gap into wall adjacency",
    (...boundary) => {
      const result = deriveArchitecturalSurfaces(
        model([wall()], [space(boundary.map((pair) => [required(pair[0]), required(pair[1])]))]),
      );
      expect(
        result.finishTargets
          .filter((target) => target.scope === "space")
          .map((target) => target.id),
      ).toEqual(["space:room:floor", "space:room:ceiling"]);
    },
  );

  it("keeps disconnected adjacency and opening-split coverage under one override identity", () => {
    const room = space([
      ["20", "20"],
      ["40", "20"],
      ["40", "40"],
      ["70", "40"],
      ["70", "20"],
      ["90", "20"],
      ["90", "80"],
      ["20", "80"],
    ]);
    const architecture = { ...windowModel(), spaces: [room] };
    const result = deriveArchitecturalSurfaces(architecture);
    const target = override(result, "space:room:wall:wall:side-positive");
    expect(totalArea(target.coverage)).toBe(
      decimal("40").times("242.2").minus(decimal("10").times("130.3")).toString(),
    );
    expect(target.coverage.length).toBeGreaterThan(2);
    expect(result.finishTargets.filter((candidate) => candidate.id === target.id)).toHaveLength(1);
    expect(result.surfaces.filter((surface) => surface.kind === "wall-side")).toHaveLength(2);
    for (const patch of target.coverage) {
      if (patch.kind !== "rectangle") throw new Error("Expected wall coverage.");
      expect(
        (patch.min.x.gte(20) && patch.max.x.lte(40)) ||
          (patch.min.x.gte(70) && patch.max.x.lte(90)),
      ).toBe(true);
      if (patch.min.x.lt(50) && patch.max.x.gt(30))
        expect(patch.max.z.lte("390.3") || patch.min.z.gte("520.6")).toBe(true);
    }
  });

  it.each(["x", "y"] as const)(
    "derives exact window reveal geometry and keeps %s wall-side identities across opening partitions",
    (axis) => {
      const result = deriveArchitecturalSurfaces(windowModel(axis));
      const transverse = axis === "x" ? "y" : "x";
      for (const [reveal, normalAxis, sign, coordinate, expectedArea] of [
        ["reveal-start", axis, "positive", "30", "1303"],
        ["reveal-end", axis, "negative", "50", "1303"],
        ["reveal-bottom", "z", "positive", "390.3", "200"],
        ["reveal-top", "z", "negative", "520.6", "200"],
      ] as const) {
        const patch = required(patches(result, `wall:wall:opening:window:${reveal}`)[0]);
        expect(patch.normalAxis).toBe(normalAxis);
        expect(patch.normalSign).toBe(sign);
        expect(patch.min[normalAxis].toString()).toBe(coordinate);
        expect(patch.max[normalAxis].toString()).toBe(coordinate);
        expect(patch.min[transverse].toString()).toBe("10");
        expect(patch.max[transverse].toString()).toBe("20");
        expect(area(patch).toString()).toBe(expectedArea);
      }
      for (const side of ["negative", "positive"]) {
        expect(totalArea(patches(result, `wall:wall:side-${side}`))).toBe("21614");
        expect(
          result.finishTargets.filter((target) => target.id === `wall:wall:side-${side}`),
        ).toHaveLength(1);
      }
    },
  );

  it.each(["start", "end", "entire"] as const)(
    "omits nonexistent reveals for a floor/top-reaching door at the wall %s",
    (position) => {
      const architecture = model();
      const owner = required(architecture.walls[0]);
      const original = required(buildArchitecturalModel3D(apartmentFixture()).doors[2]);
      const door = {
        ...original,
        id: "door",
        wall: owner,
        opening: {
          footprint: {
            x: decimal(position === "end" ? "90" : "10"),
            y: decimal("10"),
            width: decimal(position === "entire" ? "100" : "20"),
            height: decimal("10"),
          },
          verticalRange: owner.volume.verticalRange,
        },
      };
      const result = deriveArchitecturalSurfaces({ ...architecture, doors: [door] });
      const reveals = result.finishTargets.filter((target) => target.id.includes(":opening:"));
      expect(reveals.map((target) => target.id)).toEqual(
        position === "entire"
          ? []
          : [`wall:wall:opening:door:reveal-${position === "start" ? "end" : "start"}`],
      );
      if (position === "entire") expect(patches(result, "wall:wall:side-positive")).toHaveLength(0);
    },
  );

  it("keeps ordinary door jambs and lintel while omitting its floor reveal", () => {
    const architecture = model();
    const owner = required(architecture.walls[0]);
    const original = required(buildArchitecturalModel3D(apartmentFixture()).doors[2]);
    const result = deriveArchitecturalSurfaces({
      ...architecture,
      doors: [
        {
          ...original,
          id: "door",
          wall: owner,
          opening: {
            footprint: { ...owner.volume.footprint, x: decimal("30"), width: decimal("20") },
            verticalRange: { minZ: decimal("300.1"), maxZ: decimal("510.3") },
          },
        },
      ],
    });
    expect(
      result.finishTargets
        .filter((target) => target.id.includes(":opening:"))
        .map((target) => target.id)
        .sort(),
    ).toEqual([
      "wall:wall:opening:door:reveal-end",
      "wall:wall:opening:door:reveal-start",
      "wall:wall:opening:door:reveal-top",
    ]);
    expect(totalArea(patches(result, "wall:wall:opening:door:reveal-start"))).toBe("2102");
    expect(totalArea(patches(result, "wall:wall:opening:door:reveal-top"))).toBe("200");
  });

  it("preserves through-openings when validated thickness differs within tolerance", () => {
    const architecture = windowModel();
    const window = required(architecture.windows[0]);
    const adjusted = {
      ...window,
      opening: {
        ...window.opening,
        footprint: { ...window.opening.footprint, y: decimal("10.01"), height: decimal("9.99") },
      },
    };
    expect(deriveArchitecturalSurfaces({ ...architecture, windows: [adjusted] })).toEqual(
      deriveArchitecturalSurfaces(architecture),
    );
  });

  it("suppresses buried faces at unequal-height wall intersections and preserves exact union volume", () => {
    const architecture = model([wall(), wall("y", "junction", "60", "10", "10", "100", "500.1")]);
    const result = deriveArchitecturalSurfaces(architecture);
    const positive = patches(result, "wall:wall:side-positive");
    expect(totalArea(positive)).toBe("22220");
    for (const patch of positive)
      if (patch.min.x.lt(70) && patch.max.x.gt(60)) expect(patch.min.z.toString()).toBe("500.1");
    const rectangles = result.surfaces
      .flatMap<ArchitecturalSurfacePatch3D>((surface) => surface.patches)
      .filter((patch): patch is RectangularSurfacePatch3D => patch.kind === "rectangle");
    const tripleVolume = rectangles.reduce(
      (sum, patch) =>
        sum.plus(
          area(patch)
            .times(patch.min[patch.normalAxis])
            .times(patch.normalSign === "positive" ? "1" : "-1"),
        ),
      decimal("0"),
    );
    expect(tripleVolume.toString()).toBe(
      decimal("1000").times("242.2").plus(decimal("900").times("200")).times("3").toString(),
    );
    expect(deriveArchitecturalSurfaces(architecture)).toEqual(result);
  });

  it("assigns coincident exterior patches to the first source wall without changing semantic IDs", () => {
    const first = wall("x", "first"),
      second = wall("x", "second");
    const room = space([
      ["20", "20"],
      ["40", "20"],
      ["40", "60"],
      ["20", "60"],
    ]);
    const result = deriveArchitecturalSurfaces(model([first, second], [room]));
    expect(
      result.finishTargets.some((target) => target.id === "space:room:wall:first:side-positive"),
    ).toBe(true);
    expect(
      result.finishTargets.some((target) => target.id === "space:room:wall:second:side-positive"),
    ).toBe(false);
    expect(totalArea(patches(result, "wall:first:side-positive"))).toBe("24220");
    expect(patches(result, "wall:second:side-positive")).toHaveLength(0);
    const reversed = deriveArchitecturalSurfaces(model([second, first]));
    expect(
      result.finishTargets
        .filter((target) => target.scope === "base")
        .map((target) => target.id)
        .sort(),
    ).toEqual(reversed.finishTargets.map((target) => target.id).sort());
    expect(patches(reversed, "wall:first:side-positive")).toHaveLength(0);
  });

  it("retains centimeter precision beyond renderer numbers and contains no visual state", () => {
    const source = apartmentFixture("9007199254740993.12345678901234567890123456789");
    const architecture = buildArchitecturalModel3D(source);
    const result = deriveArchitecturalSurfaces(architecture);
    const patch = required(patches(result, "wall:wall:side-positive")[0]);
    expect(patch.min.z.toString()).toBe("9007199254740993.12345678901234567890123456789");
    expectTypeOf(patch.min.x).toEqualTypeOf<Decimal>();
    expectTypeOf(deriveArchitecturalSurfaces).parameter(0).toEqualTypeOf<ArchitecturalModel3D>();
    expectTypeOf(deriveArchitecturalSurfaces).returns.toEqualTypeOf<ArchitecturalSurfaceSet3D>();
    const inspect = (value: unknown): void => {
      if (value === null || typeof value !== "object" || value instanceof decimal("0").constructor)
        return;
      for (const [key, child] of Object.entries(value)) {
        expect([
          "material",
          "texture",
          "mesh",
          "uv",
          "matrix",
          "geometry",
          "designScenario",
        ]).not.toContain(key);
        expect(typeof child).not.toBe("number");
        inspect(child);
      }
    };
    inspect(result);
  });
});

describe("physical surface mapping", () => {
  it("anchors floor and ceiling to global XY with exact interior-facing frames", () => {
    const result = deriveArchitecturalSurfaces(model());
    for (const [id, sign, z] of [
      ["floor", "1", "300.1"],
      ["ceiling", "-1", "542.3"],
    ] as const) {
      const frame = required(result.finishTargets.find((target) => target.id === id)).mapping;
      expect(coordinates(frame.origin)).toEqual(["0", "0", z]);
      expect(coordinates(frame.uDirection)).toEqual(["1", "0", "0"]);
      expect(coordinates(frame.vDirection)).toEqual(["0", sign, "0"]);
      const distances = surfaceMappingDistances(frame, {
        x: decimal("-12.345678901234567890123"),
        y: decimal("42.125"),
        z: decimal(z),
      });
      expect(distances.uCm.toString()).toBe("-12.345678901234567890123");
      expect(distances.vCm.toString()).toBe(id === "floor" ? "42.125" : "-42.125");
      expect(Object.isFrozen(frame)).toBe(true);
      expect(Object.isFrozen(frame.origin)).toBe(true);
    }
  });

  it.each(["x", "y"] as const)(
    "orients %s wall sides and every reveal with U cross V outward",
    (axis) => {
      const result = deriveArchitecturalSurfaces(windowModel(axis));
      for (const surface of result.surfaces) {
        if (!("mapping" in surface)) continue;
        const { uDirection: u, vDirection: v } = surface.mapping;
        const cross = {
          x: u.y.times(v.z).minus(u.z.times(v.y)),
          y: u.z.times(v.x).minus(u.x.times(v.z)),
          z: u.x.times(v.y).minus(u.y.times(v.x)),
        };
        for (const patch of surface.patches) {
          const normalAxis = patch.kind === "horizontal" ? "z" : patch.normalAxis;
          expect(coordinates(cross)).toEqual(
            ["x", "y", "z"].map((a) =>
              a === normalAxis ? (patch.normalSign === "positive" ? "1" : "-1") : "0",
            ),
          );
          if (normalAxis !== "z") expect(coordinates(v)).toEqual(["0", "0", "1"]);
        }
      }
      const negative = required(
        result.finishTargets.find((target) => target.id === "wall:wall:side-negative"),
      ).mapping;
      const positive = required(
        result.finishTargets.find((target) => target.id === "wall:wall:side-positive"),
      ).mapping;
      expect(coordinates(negative.uDirection)).toEqual(
        axis === "x" ? ["1", "0", "0"] : ["0", "-1", "0"],
      );
      expect(coordinates(positive.uDirection)).toEqual(
        axis === "x" ? ["-1", "0", "0"] : ["0", "1", "0"],
      );
      expect(result.surfaces.filter((surface) => surface.kind === "opening-reveal")).toHaveLength(
        4,
      );
    },
  );

  it("shares base frames with space coverage and keeps wall phase through opening subdivision", () => {
    const architecture = windowModel();
    const withSpace = {
      ...architecture,
      spaces: [
        space([
          ["20", "20"],
          ["80", "20"],
          ["80", "80"],
          ["20", "80"],
        ]),
      ],
    };
    const result = deriveArchitecturalSurfaces(withSpace);
    for (const target of result.finishTargets) {
      if (target.scope === "space")
        expect(target.mapping).toBe(
          required(result.finishTargets.find((base) => base.id === target.baseTargetId)).mapping,
        );
    }
    const id = "wall:wall:side-positive";
    const frame = required(result.finishTargets.find((target) => target.id === id)).mapping;
    const noOpenings = deriveArchitecturalSurfaces({ ...architecture, windows: [] });
    expect(frame).toEqual(
      required(noOpenings.finishTargets.find((target) => target.id === id)).mapping,
    );
    expect(patches(result, id).length).toBeGreaterThan(1);
    for (const patch of patches(result, id)) {
      const { uCm, vCm } = surfaceMappingDistances(frame, patch.min);
      expect(uCm.toString()).toBe(patch.min.x.negated().toString());
      expect(vCm.toString()).toBe(patch.min.z.minus(decimal("300.1")).toString());
    }
  });
});
