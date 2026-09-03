# TASK-010: Complete Apartment SVG Topology, Placement, Collision, and Overlap Validation

## Context

TASK-009 implemented Apartment SVG 2.1 wall/opening geometry validation while preserving `ReferenceValidApartmentSvgDocument` as its successful output.

The remaining geometric/topological rules are zone topology, semantic `viewBox` containment, wall-associated utility placement, camera collisions, and global overlap restrictions. Completing these rules establishes the final trusted SVG representation before `ValidatedApartment2D`.

## Required Reading

Before making changes, read and follow:

```text
AGENTS.md
docs/architecture/overview.md
docs/development/coding-guidelines.md
docs/development/testing.md
docs/decisions/ADR-001-typescript-monorepo.md
docs/specifications/apartment-svg/2.1.md
```

Do not read any other file under `docs/tasks/`.

## Goal

Implement the complete Apartment SVG geometric/topological validation gate in `@planaxis/validator`.

The new full-stage API must consume `ReferenceValidApartmentSvgDocument`, compose the TASK-009 wall/opening validator, validate all remaining Apartment SVG 2.1 spatial invariants, and return a trusted `GeometryValidApartmentSvgDocument` only when every required geometric/topological check passes.

## Scope

Implement:

- a public full geometric-validation API;
- composition of TASK-009 wall/opening validation;
- `GeometryValidApartmentSvgDocument` as the final trusted SVG validation boundary;
- zone polygon validity and topology;
- semantic geometry containment within the root `viewBox`;
- wall-associated utility placement;
- camera collisions with wall and fixed-element volumes;
- remaining opening/wall and opening/opening overlap restrictions;
- zone/zone and zone/wall overlap restrictions;
- reusable exact-decimal geometry primitives required by these checks;
- structured validation errors and focused automated tests.

## Out of Scope

Do not implement:

- parsing, schema validation, or reference-resolution changes unrelated to this stage;
- geometric repair, snapping, normalization, or inferred corrections;
- `ValidatedApartment2D` construction;
- `ArchitecturalModel3D`;
- rendering, Three.js, simulation, backend, or AI workflows.

## Functional Requirements

### Full validation API

Expose a deliberate public API conceptually equivalent to:

```ts
validateApartmentSvgGeometry(
  document: ReferenceValidApartmentSvgDocument,
): ApartmentSvgGeometryValidationResult
```

The API must run the TASK-009 wall/opening validation first. If that stage fails, return those errors without running later checks whose assumptions depend on valid wall/opening geometry.

Preserve the existing narrower TASK-009 API.

### Geometry-valid trust boundary

On success, return a `GeometryValidApartmentSvgDocument`.

The type must be nominal/opaque enough that an ordinary `ReferenceValidApartmentSvgDocument` is not accidentally assignable to it. It must not duplicate, repair, or change authoritative semantic geometry.

This type represents successful completion of all required Apartment SVG 2.1 schema, reference, geometric, and topological validation stages.

### Zone topology

Validate each zone according to Apartment SVG 2.1:

- at least three geometrically distinct vertices;
- positive area;
- no self-intersection;
- no interior overlap with wall footprints;
- no positive-area interior overlap with another zone;
- shared zone boundaries and zone/wall boundary contact remain permitted.

Use the normative geometric tolerance where applicable. Do not invent a separate area tolerance not defined by the specification.

### Semantic `viewBox` containment

Validate the specification-wide requirement that every point of core semantic geometry is inside the root `viewBox`.

Cover all relevant semantic geometry, including:

- zone polygons;
- wall, window, door, and fixed-element footprints;
- utility and camera semantic points;
- hinged-door hinge and open-leaf points.

Utility/camera marker radius is presentation-only and must not affect containment.

### Utility placement

For every wall-associated utility, validate that its `(cx, cy)` semantic point lies on or within the footprint of its already resolved supporting wall.

Do not re-resolve `data-wall`.

### Camera collisions

Reject a camera whose physical 3D point lies inside the volume of:

- any wall; or
- any fixed element.

Use:

```text
wall XY = wall footprint
wall Z  = [level.baseZ, level.baseZ + effectiveWallHeight]

fixed-element XY = element footprint
fixed-element Z  = [baseZ, baseZ + height]
```

Camera marker radius does not participate in collision detection.

### Global overlap rules

Complete Apartment SVG 2.1 overlap validation:

- wall/wall overlap remains permitted;
- a window may intersect only its resolved supporting wall;
- a door may intersect only its resolved supporting wall;
- positive-area window/window overlap is prohibited;
- positive-area door/door overlap is prohibited;
- positive-area door/window overlap is prohibited;
- zone/wall interior overlap is prohibited while boundary contact remains valid;
- zone/zone positive-area interior overlap is prohibited while shared boundaries remain valid.

### Validation codes

Extend the existing stable structured error vocabulary.

At minimum preserve the specification-defined meanings:

```text
APSVG-ZONE-001    self-intersecting zone
APSVG-CAMERA-001  camera inside wall
```

Use stable additional codes for the other new geometric/topological rules, following the existing category-based numbering conventions. Avoid renumbering existing codes.

Every error must preserve useful rule, element, expected, and actual context through the existing validation-error contract.

## Geometry Package Requirements

Add only reusable, domain-neutral geometry primitives to `@planaxis/geometry`.

Expected needs include operations such as:

- segment intersection;
- polygon area;
- polygon self-intersection;
- point/rectangle containment;
- positive-area rectangle overlap;
- polygon/rectangle interior overlap;
- polygon/polygon positive-area overlap;
- reusable containment helpers.

Keep Apartment SVG concepts such as zones, walls, validation stages, and APSVG errors in `@planaxis/validator`.

All authoritative calculations must remain exact-decimal. Do not convert geometry through JavaScript `number` and do not add an external geometry dependency unless repository constraints make it genuinely unavoidable.

## Testing Requirements

Add focused automated coverage for:

- valid zones and too few geometrically distinct vertices;
- zero-area and self-intersecting zones;
- shared zone boundaries versus positive-area zone overlap;
- zone/wall boundary contact versus interior overlap;
- semantic geometry exactly on `viewBox` boundaries and outside them;
- valid and invalid wall-associated utility placement;
- camera collisions/non-collisions against walls and fixed elements across XY and Z boundaries;
- allowed wall/wall overlap;
- forbidden non-supporting-wall intersection by windows and doors;
- positive-area window/window, door/door, and door/window overlap;
- boundary-only contact where permitted;
- the full API composing TASK-009 and refusing to produce a geometry-valid document when any required stage fails;
- compile-time/type-level separation between `ReferenceValidApartmentSvgDocument` and `GeometryValidApartmentSvgDocument` where practical.

Follow `docs/development/testing.md`.

## Documentation Requirements

Update current-state documentation where needed to reflect that Apartment SVG geometric/topological validation is complete and that `GeometryValidApartmentSvgDocument` is now the final trusted SVG representation before `ValidatedApartment2D`.

Do not modify Apartment SVG 2.1 or files under `docs/tasks/`.

## Verification

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run focused geometry and validator tests during development as useful.

## Acceptance Criteria

The task is complete when:

1. the public full-stage validator composes TASK-009 and all remaining Apartment SVG 2.1 geometric/topological checks;
2. zones satisfy polygon validity and topology rules;
3. all core semantic geometry satisfies `viewBox` containment;
4. wall-associated utility placement is validated;
5. camera/wall and camera/fixed-element collisions are validated;
6. all remaining opening, zone, and wall overlap restrictions are enforced;
7. reusable exact-decimal geometry primitives support the implementation without leaking Apartment SVG semantics into `@planaxis/geometry`;
8. successful validation returns `GeometryValidApartmentSvgDocument`;
9. ordinary `ReferenceValidApartmentSvgDocument` values cannot accidentally cross that trust boundary;
10. the validator reports errors and never guesses, repairs, or normalizes invalid geometry;
11. focused tests and repository verification pass;
12. current-state documentation reflects completion of geometric/topological validation.

## Final Response

Provide a concise report containing:

1. implementation summary;
2. main files/areas changed;
3. tests added or updated;
4. verification commands and results;
5. deviations from this description, or `None`;
6. follow-up items, or `None`;
7. a suggested Conventional Commits message including:

```text
Task: TASK-010
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.
