import type { ArchitecturalSurfaceSet3D, FinishTargetId } from "@planaxis/model-3d";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  parseDesignDescriptor,
  resolveDesignArchitecture,
  type DesignArchitecture,
  type ValidatedDesignDescriptor,
} from "../src/index.js";

const architecturePath = "architecture/alternatives/apartment.svg";

function design(targets?: readonly FinishTargetId[]): ValidatedDesignDescriptor {
  const result = parseDesignDescriptor(
    JSON.stringify({
      schema: "planaxis-design/1.0",
      name: "Test design",
      architecture: architecturePath,
      ...(targets === undefined
        ? {}
        : {
            finishes: targets.map((target) => ({
              target,
              material: "assets/materials/not-yet-created",
            })),
          }),
    }),
    "designs/test.json",
  );
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe("pure architecture resolution", () => {
  it("accepts the existing derived surface target contract without copying geometry", () => {
    expectTypeOf<ArchitecturalSurfaceSet3D["finishTargets"]>().toExtend<
      DesignArchitecture["finishTargets"]
    >();
  });

  it("resolves matching architecture without finishes", () => {
    const descriptor = design();
    expect(
      resolveDesignArchitecture(descriptor, { path: architecturePath, finishTargets: [] }),
    ).toEqual({ ok: true, value: descriptor });
  });

  it.each([
    "architecture/other.svg",
    "architecture/alternatives/Apartment.svg",
    "architecture/alternatives/./apartment.svg",
  ])("rejects a different architecture even when every target matches: %s", (path) => {
    expect(
      resolveDesignArchitecture(design(["floor"]), { path, finishTargets: [{ id: "floor" }] }),
    ).toEqual({
      ok: false,
      stage: "architecture",
      errors: [
        {
          code: "DESIGN_ARCHITECTURE_MISMATCH",
          expectedArchitecture: architecturePath,
          actualArchitecture: path,
          message: expect.any(String),
        },
      ],
    });
  });

  it("enforces exact binding even when no finishes are present", () => {
    expect(
      resolveDesignArchitecture(design(), { path: "architecture/other.svg", finishTargets: [] }),
    ).toMatchObject({ ok: false, errors: [{ code: "DESIGN_ARCHITECTURE_MISMATCH" }] });
  });

  it("resolves all finish families by membership and leaves opaque materials unchanged", () => {
    const targets: FinishTargetId[] = [
      "floor",
      "ceiling",
      "wall:w:side-negative",
      "wall:w:side-positive",
      "wall:w:opening:o:reveal-start",
      "wall:w:opening:o:reveal-end",
      "wall:w:opening:o:reveal-top",
      "wall:w:opening:o:reveal-bottom",
      "space:s:floor",
      "space:s:ceiling",
      "space:s:wall:w:side-negative",
      "space:s:wall:w:side-positive",
    ];
    const descriptor = design(targets);
    const result = resolveDesignArchitecture(descriptor, {
      path: architecturePath,
      finishTargets: [
        ...targets.toReversed().map((id) => ({ id })),
        { id: "wall:unused:side-positive" },
      ],
    });
    expect(result).toEqual({ ok: true, value: descriptor });
    if (!result.ok) throw new Error("Expected resolved design.");
    expect(result.value).toBe(descriptor);
  });

  it("reports all stale targets in assignment order without repair or base-target fallback", () => {
    const descriptor = design([
      "floor",
      "wall:old:side-positive",
      "space:room:floor",
      "wall:w:opening:door:reveal-bottom",
    ]);
    const before = JSON.stringify(descriptor);
    const architecture: DesignArchitecture = Object.freeze({
      path: architecturePath,
      finishTargets: Object.freeze([
        { id: "floor" as const },
        { id: "wall:new:side-positive" as const },
        { id: "wall:w:opening:door:reveal-top" as const },
      ]),
    });
    expect(resolveDesignArchitecture(descriptor, architecture)).toEqual({
      ok: false,
      stage: "architecture",
      errors: [
        {
          code: "DESIGN_UNRESOLVED_TARGET",
          target: "wall:old:side-positive",
          assignmentIndex: 1,
          message: expect.any(String),
        },
        {
          code: "DESIGN_UNRESOLVED_TARGET",
          target: "space:room:floor",
          assignmentIndex: 2,
          message: expect.any(String),
        },
        {
          code: "DESIGN_UNRESOLVED_TARGET",
          target: "wall:w:opening:door:reveal-bottom",
          assignmentIndex: 3,
          message: expect.any(String),
        },
      ],
    });
    expect(JSON.stringify(descriptor)).toBe(before);
    // Structural conformance is unchanged by missing targets or missing material resources.
    expect(parseDesignDescriptor(JSON.stringify(descriptor.document), descriptor.path).ok).toBe(
      true,
    );
  });
});
