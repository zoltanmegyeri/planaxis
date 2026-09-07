# TASK-015: Establish Exact 3D Geometry Foundations

## Context

PlanAxis now has a fully Apartment SVG 2.2-conformant pipeline through `ValidatedApartment2D`.

The next architectural milestone is `ArchitecturalModel3D`, but the shared geometry package currently provides only exact-decimal 2D primitives. Before introducing renderer-independent architectural 3D domain types, PlanAxis needs a minimal exact 3D geometry foundation that mirrors the existing numeric architecture without growing into a generic 3D engine.

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

Add the small set of exact-decimal, renderer-independent 3D primitives required by the upcoming `ArchitecturalModel3D` work.

The new primitives must stay generic to geometry, use authoritative `Decimal` values, and avoid architectural, rendering, or transformation semantics.

## Scope

Implement and publicly export these geometry concepts in `@planaxis/geometry`:

```text
Point3D
VerticalRange
RectangularPrism3D
HorizontalPolygonSurface3D
```

Add only the focused helpers needed to compare or derive simple values from these primitives consistently with the existing 2D API.

Add automated tests and update current-state documentation where needed.

## Functional Requirements

### `Point3D`

Represent an exact 3D point:

```ts
interface Point3D {
  readonly x: Decimal;
  readonly y: Decimal;
  readonly z: Decimal;
}
```

Provide exact and tolerance-aware equality helpers analogous to the existing `Point2D` helpers.

### `VerticalRange`

Represent an exact closed vertical interval:

```ts
interface VerticalRange {
  readonly minZ: Decimal;
  readonly maxZ: Decimal;
}
```

Provide a deterministic helper for its height:

```text
maxZ - minZ
```

The geometry package must not apply apartment-level offsets or otherwise interpret the range architecturally.

### `RectangularPrism3D`

Represent an axis-aligned vertical prism as:

```ts
interface RectangularPrism3D {
  readonly footprint: Rect2D;
  readonly verticalRange: VerticalRange;
}
```

This primitive is intended to support later wall, opening, and fixed-element geometry without introducing ambiguous `width/depth/height` conventions.

Do not add architectural meaning such as wall, window, door, or fixed-element kinds.

### `HorizontalPolygonSurface3D`

Represent a zero-thickness horizontal polygon surface as:

```ts
interface HorizontalPolygonSurface3D {
  readonly boundary: readonly Point2D[];
  readonly z: Decimal;
}
```

This deliberately constrained primitive is sufficient for the future Apartment SVG 2.2 floor and default ceiling surfaces.

Do not generalize it into an arbitrary 3D polygon or planar-surface system.

### Exact numeric semantics

All coordinates, ranges, and derived values must use the existing `Decimal` abstraction.

Do not introduce JavaScript `number` as authoritative geometry and do not add renderer-boundary conversions in this task.

Tolerance-aware comparisons must reuse the existing centralized geometric-comparison rules.

## Out of Scope

This task does **not** include:

- `ArchitecturalModel3D`;
- apartment-specific 3D domain types;
- conversion from `ValidatedApartment2D`;
- model-space application of `metadata.level.baseZ`;
- floor or ceiling architectural objects;
- wall/window/door/fixed-element construction;
- utility or camera domain construction;
- vectors, normals, matrices, transforms, Euler angles, or quaternions;
- generic 3D polygons, meshes, triangles, polyhedra, or CSG;
- polygon triangulation for rendering;
- trigonometric camera-direction derivation;
- Three.js or other renderer-specific code;
- new external dependencies.

Avoid speculative abstractions that are not required by the upcoming renderer-independent architectural model.

## Technical and Architectural Constraints

- Implement these primitives in `@planaxis/geometry`.
- Follow the style of existing exact-decimal 2D geometry types and helpers.
- Prefer small, immutable structural interfaces and pure deterministic functions.
- Reuse `Point2D`, `Rect2D`, `Decimal`, and centralized tolerance helpers rather than duplicating them.
- Export the new public API deliberately from `packages/geometry/src/index.ts`.
- Keep `@planaxis/model-3d` free of architectural model implementation in this task.
- Do not add an external dependency.
- Do not modify any file under `docs/tasks/`.

## Files and Areas Expected to Change

Expected areas include:

```text
packages/geometry/src/
packages/geometry/test/
README.md
docs/architecture/overview.md
```

Only update documentation where completion of this foundation changes current-state wording.

## Testing Requirements

Add focused automated coverage for:

- exact equality and inequality of `Point3D`;
- tolerance-aware `Point3D` equality using the existing geometric tolerance semantics;
- `VerticalRange` height with positive, zero, and negative-coordinate endpoints as applicable;
- preservation of exact decimal values without `number` conversion;
- `RectangularPrism3D` composition from an existing `Rect2D` and `VerticalRange`;
- `HorizontalPolygonSurface3D` preservation of exact XY boundary and Z;
- public exports from `@planaxis/geometry`.

Do not introduce tests for architectural conversion rules; those belong to TASK-016.

Follow `docs/development/testing.md` and do not weaken existing geometry coverage.

## Documentation Requirements

Update current-state wording in:

```text
README.md
docs/architecture/overview.md
```

if needed so they identify exact 3D geometry foundations as implemented and `ArchitecturalModel3D` construction as the next development stage.

Do not modify the Apartment SVG 2.2 specification.

## Verification

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run focused geometry tests during development as useful.

## Acceptance Criteria

The task is complete when:

1. `@planaxis/geometry` publicly exposes `Point3D`, `VerticalRange`, `RectangularPrism3D`, and `HorizontalPolygonSurface3D`;
2. all new authoritative values use exact `Decimal` geometry;
3. point equality and simple range derivation follow existing exact/tolerance conventions;
4. the primitives remain renderer-independent and architecture-neutral;
5. no speculative generic 3D engine, transformation system, mesh representation, or apartment conversion logic is introduced;
6. focused tests and repository verification pass;
7. current-state documentation accurately identifies `ArchitecturalModel3D` as the next stage.

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
Task: TASK-015
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.
