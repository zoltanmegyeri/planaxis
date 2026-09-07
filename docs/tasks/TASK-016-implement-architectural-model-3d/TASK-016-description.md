# TASK-016: Implement ArchitecturalModel3D

## Context

PlanAxis now has a fully Apartment SVG 2.2-conformant pipeline through `ValidatedApartment2D`, and TASK-015 established the exact renderer-independent 3D primitives in `@planaxis/geometry`.

The existing `@planaxis/model-3d` package is still a skeleton. The next architectural stage is to define a renderer-independent 3D architectural domain model and deterministically build it from trusted `ValidatedApartment2D` data.

## Required Reading

Before making changes, read and follow:

```text
AGENTS.md
docs/architecture/overview.md
docs/development/coding-guidelines.md
docs/development/testing.md
docs/decisions/ADR-001-typescript-monorepo.md
docs/specifications/apartment-svg/2.2.md
```

Do not read any other file under `docs/tasks/`.

## Goal

Implement `ArchitecturalModel3D` in `@planaxis/model-3d` and expose a deterministic builder from `ValidatedApartment2D`.

The resulting model must represent known architectural 3D geometry and relationships using exact `Decimal` values and the shared 3D geometry primitives, while remaining independent of Three.js, meshes, rendering, and unsupported physical assumptions.

## Scope

The task includes:

- defining public renderer-independent `ArchitecturalModel3D` contracts;
- implementing and exporting a builder conceptually equivalent to:

```ts
buildArchitecturalModel3D(
  apartment: ValidatedApartment2D,
): ArchitecturalModel3D
```

- deriving model-space floor and default ceiling surfaces;
- deriving wall volumes;
- representing window and door wall openings as exact 3D opening prisms;
- deriving fixed-element volumes;
- deriving utility and camera model-space positions;
- preserving camera orientation/FOV values without trigonometric conversion;
- preserving relevant architectural semantics and resolved relationships;
- adding a consistent source-semantic ID index for constructed 3D architectural elements;
- adding focused `@planaxis/model-3d` tests and package dependencies/scripts required for them;
- updating current-state documentation.

## Functional Requirements

### Model-space coordinate rule

All 3D geometry remains in PlanAxis model space.

Preserve source X and Y coordinates unchanged. Convert only level-local architectural Z values using:

```text
modelZ = metadata.level.baseZ + localZ
```

Use exact `Decimal` arithmetic.

Do not remap axes for Three.js or any other renderer. Renderer coordinate conversion belongs at the renderer boundary.

### Floor and default ceiling

Expose one floor surface and one default ceiling surface using `HorizontalPolygonSurface3D`.

Their geometry is:

```text
floor:
  boundary = validated apartment footprint boundary
  z = level.baseZ

ceiling:
  boundary = validated apartment footprint boundary
  z = level.baseZ + level.defaultCeilingHeight
```

They are zero-thickness architectural boundary surfaces.

Do not invent slab thickness, ceiling thickness, material, finish, or construction data.

Explicit wall heights that differ from `defaultCeilingHeight` must not alter the global default ceiling surface.

### Walls

Represent each validated wall with a renderer-independent architectural wall object containing its source identity/semantics and a `RectangularPrism3D` volume.

For each wall:

```text
footprint = validated wall footprint
minZ = level.baseZ
maxZ = level.baseZ + wall.effectiveHeight
```

Preserve relevant wall semantics such as class and status.

### Windows and doors

Represent each window and door as a semantic wall opening whose exact opening geometry is a `RectangularPrism3D`.

Window opening:

```text
footprint = validated window footprint
minZ = level.baseZ + sillHeight
maxZ = minZ + openingHeight
```

Door opening:

```text
footprint = validated door footprint
minZ = level.baseZ
maxZ = level.baseZ + openingHeight
```

Each constructed window and door must point to the corresponding constructed 3D wall object rather than requiring downstream raw-ID resolution.

Preserve relevant source semantics needed by later architectural/rendering layers, including window opening/frame/glass metadata when present and door type/status. For hinged doors, preserve the validated exact plan-view hinge/open-leaf/derived leaf geometry rather than inventing a physical door-leaf thickness or arbitrary 3D surface.

Do not boolean-subtract openings from wall prisms, split wall meshes, triangulate geometry, or perform CSG. The wall prism is the wall envelope; window and door opening prisms represent the corresponding void extents for downstream renderer adaptation.

### Fixed elements

Represent every fixed element with its source identity/semantics and a `RectangularPrism3D`:

```text
footprint = validated fixed-element footprint
minZ = level.baseZ + element.baseZ
maxZ = minZ + element.height
```

Preserve fixed-element kind, status, optional radiator-to-wall relationship, and fixed-object description where applicable.

### Utilities

Represent every utility with a model-space `Point3D`:

```text
x = validated position.x
y = validated position.y
z = level.baseZ + utility.z
```

Preserve utility kind/status and resolved wall relationship for wall-associated utilities.

The SVG marker radius is not part of the trusted 2D model and must not be invented in 3D.

### Cameras

Represent every camera with:

- model-space `Point3D` position;
- exact heading;
- exact pitch;
- exact horizontal FOV.

Camera model-space Z is:

```text
level.baseZ + camera.z
```

Do not derive direction vectors, Euler objects, matrices, or trigonometric approximations in this task.

### Relationships and ID index

Construct relationships against the new 3D objects, not against the original `ValidatedApartment2D` element instances.

At minimum preserve the existing meaningful resolved relationships:

```text
window -> wall
window -> optional radiatorBelow
door -> wall
radiator -> optional wall
wall-associated utility -> wall
```

Expose a read-only ID index for source-derived 3D architectural elements. Its values must be the same constructed instances exposed through the model's typed collections.

The derived floor and default ceiling do not need invented source IDs and should not be inserted into that source-semantic index.

### Model contents

`ArchitecturalModel3D` should expose, at minimum:

```text
metadata
floor
ceiling
walls
windows
doors
fixedElements
utilities
cameras
sourceElementsById
```

Exact type names may be refined, but the public model must communicate architectural semantics rather than renderer implementation details.

The model need not extrude or otherwise represent 2D `space`/zone polygons in this task. Do not invent room volumes or room heights.

## Technical and Architectural Constraints

- Own the 3D domain contracts and builder in `@planaxis/model-3d`.
- Depend on `@planaxis/model` for `ValidatedApartment2D` input and shared semantic types as appropriate.
- Depend on `@planaxis/geometry` for exact numeric and 3D geometry primitives.
- Use the TASK-015 primitives rather than creating parallel 3D representations.
- Keep authoritative values as `Decimal`; no `number` conversion is permitted here.
- Produce a normalized read-only object graph consistent with existing PlanAxis domain style.
- Treat `ValidatedApartment2D` as trusted input. Do not repeat source-document schema/reference/geometric validation.
- Defensive assertions are allowed only for impossible internal inconsistencies.
- Do not introduce an external dependency.
- Do not modify any file under `docs/tasks/`.

## Out of Scope

This task does **not** include:

- Three.js or renderer-specific types;
- a renderer adapter or `THREE.Scene` construction;
- Decimal-to-`number` conversion;
- mesh generation or triangulation;
- boolean wall subtraction, CSG, or mesh splitting;
- materials, textures, lighting, shadows, or GPU concerns;
- invented wall layers, window frame dimensions, glass thickness, door-leaf thickness, floor slab thickness, or ceiling thickness;
- generic vector/matrix/transform frameworks;
- camera direction-vector trigonometry;
- runtime solar/light simulation;
- room/space volume extrusion;
- persistence or serialization of `ArchitecturalModel3D`;
- changes to Apartment SVG 2.2.

## Files and Areas Expected to Change

Expected areas include:

```text
packages/model-3d/src/
packages/model-3d/test/
packages/model-3d/package.json
pnpm-lock.yaml
README.md
docs/architecture/overview.md
```

Only change other files when required by package wiring or public API integration.

## Testing Requirements

Add focused tests that construct or obtain trusted `ValidatedApartment2D` input and verify deterministic renderer-independent 3D output.

Cover at least:

- floor boundary equals the validated apartment footprint and floor Z equals `level.baseZ`;
- default ceiling uses the same footprint and `level.baseZ + defaultCeilingHeight`;
- wall prism footprint and model-space vertical range;
- explicit wall height differing from the default ceiling height;
- window opening model-space Z range;
- door opening model-space Z range;
- fixed-element model-space vertical range;
- utility model-space position;
- camera model-space position with heading, pitch, and FOV preserved exactly;
- non-zero and negative `level.baseZ` cases;
- preservation of exact decimals beyond native JavaScript `number` precision;
- resolved 3D wall/radiator relationships pointing to constructed 3D instances;
- consistency of `sourceElementsById` identity with typed collections;
- absence of invented floor/ceiling thickness or renderer-specific representation.

Tests must not require WebGL or Three.js.

Follow `docs/development/testing.md` and do not weaken existing coverage.

## Documentation Requirements

Update current-state wording in:

```text
README.md
docs/architecture/overview.md
```

so they describe `ArchitecturalModel3D` construction as implemented and identify renderer adaptation / Three.js visualization as the next architectural stage.

Do not modify the normative Apartment SVG 2.2 specification.

## Verification

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run focused `@planaxis/model-3d` tests during development as useful.

## Acceptance Criteria

The task is complete when:

1. `@planaxis/model-3d` exposes a renderer-independent `ArchitecturalModel3D` and deterministic builder from `ValidatedApartment2D`;
2. floor, ceiling, wall, opening, fixed-element, utility, and camera geometry is derived in exact model-space coordinates;
3. all level-local Z values are converted by applying `metadata.level.baseZ` exactly once;
4. windows, doors, radiators, and wall-associated utilities preserve meaningful relationships using constructed 3D instances;
5. wall openings are represented as semantic opening prisms without renderer-oriented boolean/mesh processing;
6. camera orientation/FOV remains exact source-domain data without trigonometric conversion;
7. the model uses no Three.js types or native-number authoritative geometry;
8. focused tests and repository verification pass;
9. current-state documentation identifies renderer adaptation as the next stage;
10. no unsupported physical geometry or unrelated functionality is invented.

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
Task: TASK-016
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.
