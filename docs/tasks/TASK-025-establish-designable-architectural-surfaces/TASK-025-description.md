# TASK-025: Establish Designable Architectural Surfaces

## Context

Phase 0 established filesystem-backed PlanAxis projects and migrated the browser to the server-selected active Apartment SVG.

Phase 1 begins the visual rendering foundation. The current `ArchitecturalModel3D` is renderer-independent, but the Three.js adapter still derives wall boundary geometry and assigns neutral materials at whole-object level. It has no stable renderer-independent concept of material-bearing architectural surfaces or finish targets.

PlanAxis needs that semantic surface layer before UVs, texture-capable PBR materials, material assets, or design scenarios can be implemented.

## Required Reading

Before making changes, read and follow:

```text
AGENTS.md
docs/architecture/overview.md
docs/development/coding-guidelines.md
docs/development/testing.md
docs/decisions/ADR-001-typescript-monorepo.md
docs/decisions/ADR-003-three-renderer-architecture.md
docs/specifications/apartment-svg/2.2.md
```

Do not read any other file under `docs/tasks/`.

## Goal

Introduce deterministic, renderer-independent architectural surfaces and stable finish-target identities for floors, ceilings, principal wall sides, space-scoped overrides, and opening reveals.

Adapt the Three.js renderer to consume this derived surface model while preserving the current neutral visual appearance.

`ArchitecturalModel3D` must remain free of Three.js types, material objects, textures, and design-scenario state.

## Scope

The task includes:

- retaining the validated Apartment SVG spaces needed for downstream 3D surface derivation;
- introducing a renderer-independent surface/finish-target contract in `@planaxis/model-3d`;
- deriving exact architectural surface geometry from `ArchitecturalModel3D`;
- defining stable base finish targets for:
  - floor;
  - ceiling;
  - both principal sides of each wall;
  - physically existing opening reveals;
- defining stable space-scoped override targets for:
  - floor;
  - ceiling;
  - adjacent portions of wall sides;
- expressing the fallback relationship from each space-scoped target to its base target;
- preserving deterministic wall-union/opening behavior when deriving exposed wall surfaces;
- adapting `@planaxis/renderer-three` to use the derived architectural surfaces rather than inventing finish-target semantics;
- preserving current source ownership/selection behavior and neutral rendering;
- adding focused automated tests for stable IDs, surface geometry, space adjacency, openings, and renderer integration;
- updating current-state architecture documentation where needed.

## Out of Scope

This task does **not** include:

- material assets or a persistent material descriptor format;
- design-scenario files or finish assignments;
- user-selectable materials;
- UV coordinates;
- texture loading or texture repeat/scale;
- PBR map support;
- image-based/environment lighting;
- exposure or tone-mapping controls;
- improved glass rendering;
- space-specific subdivision of opening reveals;
- furniture/model assets;
- changes to Apartment SVG 2.2 semantics;
- adding material/finish attributes to Apartment SVG;
- server/project API changes.

Do not implement later Phase 1 material or presentation work merely because finish targets make it possible.

## Functional and Architectural Requirements

### Renderer-independent surface layer

Add a deliberate public `@planaxis/model-3d` contract conceptually equivalent to:

```text
ArchitecturalModel3D
    -> derive/build architectural surface set
    -> renderer-independent surface geometry + finish targets
```

Exact type/function names may follow repository conventions.

The derived representation must:

- use exact PlanAxis model coordinates in centimeters;
- contain no Three.js types or JavaScript-number renderer coordinates;
- preserve source semantic ownership where applicable;
- represent one semantic surface as multiple disconnected geometric patches when required;
- produce deterministic identities and deterministic geometry for the same validated architecture;
- separate physical architectural surfaces from later visual material assignments.

Renderer-specific triangulation, `BufferGeometry`, normals, and meter conversion remain responsibilities of `@planaxis/renderer-three`.

### Spaces in `ArchitecturalModel3D`

`ValidatedApartment2D` already contains validated spaces, but `ArchitecturalModel3D` currently does not retain them.

Carry the minimum renderer-independent space semantics/geometry required for surface derivation into `ArchitecturalModel3D`.

Do not reinterpret spaces as floor or ceiling boundaries. The apartment footprint remains the physical floor/default-ceiling boundary; spaces define optional semantic override regions within it.

### Finish-target identity

Finish-target IDs are stable semantic identifiers. They must be derived only from architectural semantics and source IDs, never from triangle order, renderer object order, generated mesh indices, or material instances.

Apartment SVG `Id` values cannot contain `:`, so the following colon-delimited namespace is unambiguous.

Required base target IDs:

```text
floor
ceiling

wall:<wall-id>:side-negative
wall:<wall-id>:side-positive
```

Required space-scoped targets:

```text
space:<space-id>:floor
space:<space-id>:ceiling

space:<space-id>:wall:<wall-id>:side-negative
space:<space-id>:wall:<wall-id>:side-positive
```

Required opening-reveal targets use the owning wall and opening IDs:

```text
wall:<wall-id>:opening:<opening-id>:reveal-start
wall:<wall-id>:opening:<opening-id>:reveal-end
wall:<wall-id>:opening:<opening-id>:reveal-top
wall:<wall-id>:opening:<opening-id>:reveal-bottom
```

Only physically existing reveal surfaces receive targets. For example, do not invent a bottom wall reveal where a door opening reaches the floor, or a longitudinal reveal where an opening reaches the corresponding wall end.

Provide centralized typed helpers/constructors for target IDs; downstream code should not scatter manual string assembly.

### Wall-side sign semantics

`side-negative` and `side-positive` refer to the outward normal along the wall's transverse axis in PlanAxis model coordinates.

For `data-axis="x"` walls:

```text
side-negative = minimum-Y face, outward normal -Y
side-positive = maximum-Y face, outward normal +Y
```

For `data-axis="y"` walls:

```text
side-negative = minimum-X face, outward normal -X
side-positive = maximum-X face, outward normal +X
```

These identities must not depend on screen orientation, room interpretation, or exterior/interior classification.

### Reveal orientation semantics

The two longitudinal opening reveals use wall-local start/end semantics:

- `reveal-start` is at the lower coordinate along the wall's longitudinal axis;
- `reveal-end` is at the higher coordinate along the wall's longitudinal axis;
- `reveal-bottom` and `reveal-top` use model-space Z.

This avoids view-dependent `left` / `right` naming.

Opening reveals are independent base finish targets in this task. Do not split a reveal between spaces or infer which neighboring wall-side finish it should inherit.

### Base and space-scoped override semantics

Base targets define the default finish address for an architectural surface.

Space-scoped targets are optional, more-specific override addresses. Their fallback/base relationship must be explicit in the renderer-independent contract:

```text
space:<space-id>:floor
    -> floor

space:<space-id>:ceiling
    -> ceiling

space:<space-id>:wall:<wall-id>:side-negative
    -> wall:<wall-id>:side-negative
```

and equivalently for `side-positive`.

This task defines the target hierarchy and geometric coverage only. It does not assign any material.

Space-scoped override regions must not be represented as duplicate coplanar render surfaces. They describe semantic coverage of a base physical surface for later material resolution.

### Floor and ceiling coverage

The base `floor` and `ceiling` surfaces continue to use the apartment footprint.

Every space must expose:

```text
space:<space-id>:floor
space:<space-id>:ceiling
```

as override targets covering that space polygon on the corresponding base surface.

Areas of the footprint not covered by a space remain governed only by the base `floor` / `ceiling` targets.

Because Apartment SVG 2.2 prohibits overlapping space interiors, the derivation must not invent overlap precedence between spaces.

### Wall-side space adjacency

Create a space-scoped wall-side target only when the space is actually adjacent to that exposed wall side for positive linear extent.

A corner/point touch alone must not create a target.

The override coverage is the portion of that wall side adjacent to the space, over the available exposed vertical wall surface, excluding wall openings and portions removed by wall-union/intersection behavior.

If the same space is adjacent to the same wall side in multiple disconnected intervals, all such coverage belongs to the same target ID. Do not generate implementation-dependent segment-number IDs.

Open, partial, and closed spaces follow the same geometric adjacency rule.

Use the repository's exact/tolerance geometry conventions consistently; do not introduce renderer-number proximity tests to determine semantic adjacency.

### Exposed wall geometry

Move or refactor semantic wall-surface derivation so that exposed principal wall sides and reveal ownership are determined outside Three.js.

Preserve the current architectural interpretation that overlapping/intersecting wall rectangles form a geometric union and buried internal faces are not rendered.

Openings must remain voids through their owning wall.

Any wall cap/end faces needed to preserve current visual completeness but not covered by the finish-target vocabulary above may remain non-designable neutral structural surfaces in this task. Do not invent additional persistent finish-target namespaces solely for them.

### Renderer integration

Update `@planaxis/renderer-three` so material-bearing floor, ceiling, wall-side, and reveal geometry is driven by the renderer-independent surface derivation.

The renderer may triangulate surface polygons, compute normals, convert centimeters to meters, and build Three.js objects as needed.

Keep the visual result intentionally neutral:

- continue using the existing basic `MeshStandardMaterial`-based appearance;
- do not add textures, environment maps, presentation controls, or design-state material assignment;
- preserve current shadows, navigation, camera behavior, and source-element grouping/selection semantics.

This task should change the semantic geometry boundary, not redesign the viewer.

## Expected Areas

Expected changes are primarily under:

```text
packages/model-3d/src/
packages/model-3d/test/
packages/renderer-three/src/
packages/renderer-three/test/
docs/architecture/overview.md
README.md
```

Geometry helpers may change when a renderer-independent exact primitive/operation is genuinely required.

## Testing Requirements

Add focused automated coverage for at least:

- `ArchitecturalModel3D` retaining the required space semantics;
- deterministic base floor and ceiling targets;
- deterministic `space:<id>:floor` and `space:<id>:ceiling` targets and fallback relationships;
- both X-axis and Y-axis wall `side-negative` / `side-positive` identity and geometry;
- positive-length space/wall adjacency creating the correct space-scoped target;
- corner-only space/wall contact creating no override target;
- one space touching one wall side in multiple disconnected intervals retaining one target identity;
- wall openings splitting exposed side geometry without changing the wall-side target identity;
- deterministic reveal IDs and geometry for windows and doors;
- nonexistent reveal faces not receiving targets;
- wall intersections continuing to suppress buried faces deterministically;
- no Three.js/material types leaking into `@planaxis/model-3d`;
- the Three.js renderer consuming the derived surfaces while retaining neutral rendering and existing source ownership;
- existing browser/renderer behavior remaining protected by the current test suite.

Use exact geometric assertions in renderer-independent packages. Renderer tests may assert converted/triangulated output at the established renderer boundary.

## Documentation Requirements

Update current-state documentation so it describes:

- designable architectural surface derivation as implemented;
- stable base and space-scoped finish-target identities;
- the renderer consuming those surfaces while still using neutral materials;
- UVs, real material assignment, IBL, improved glass, and presentation controls as subsequent Phase 1 work.

Do not describe design scenarios or material assets as implemented.

## Verification

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run focused `model-3d` and `renderer-three` tests during development as useful.

## Acceptance Criteria

The task is complete when:

1. `ArchitecturalModel3D` retains the space information required for deterministic surface derivation without acquiring renderer or visual-design state;
2. `@planaxis/model-3d` exposes a renderer-independent exact architectural surface/finish-target representation;
3. the specified floor, ceiling, wall-side, space-scoped, and physically existing reveal target IDs are stable and deterministic;
4. space-scoped floor/ceiling targets and positive-length wall-adjacency targets explicitly fall back to their base targets;
5. exposed wall-side/reveal geometry respects wall unions and openings without deriving semantic identity from Three.js geometry;
6. space overrides describe semantic coverage without creating duplicate coplanar physical render surfaces;
7. `@planaxis/renderer-three` consumes the derived surface model while preserving the current neutral appearance and viewer behavior;
8. UVs, textures, material assets/assignments, environment lighting, improved glass, and presentation controls remain out of scope;
9. focused automated tests and repository-level verification pass;
10. documentation accurately reflects the new Phase 1 surface foundation.

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
Task: TASK-025
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.
