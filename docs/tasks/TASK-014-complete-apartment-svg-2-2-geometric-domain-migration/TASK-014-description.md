# TASK-014: Complete Apartment SVG 2.2 Geometric and Domain Migration

## Context

TASK-013 migrated PlanAxis structural, schema-valid, and reference-valid Apartment SVG support to version 2.2 and introduced the mandatory footprint as typed exact-decimal semantic data.

The remaining validation and trusted-domain layers still reflect pre-2.2 behavior: footprint geometry is not geometrically validated, placement geometry is checked only against the root `viewBox`, camera-wall Z collision still mixes level-local and model-space coordinates, and `ValidatedApartment2D` does not yet contain the canonical apartment footprint.

This task completes the Apartment SVG 2.2 migration through the trusted 2D domain boundary.

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

Make the complete parser → schema → reference → geometry → `ValidatedApartment2D` pipeline conform to Apartment SVG 2.2.

A successful validation must guarantee the new footprint geometry and footprint-containment invariants, use consistent level-local Z semantics, and produce a `ValidatedApartment2D` that exposes the validated canonical footprint for downstream 3D construction.

## Scope

The task includes:

- validating all Apartment SVG 2.2 geometric/topological rules of the mandatory footprint;
- validating the footprint itself against the root `viewBox`;
- enforcing Apartment SVG 2.2 apartment-footprint containment for stationary core placement geometry;
- preserving the hinged-door `open-leaf` exception defined by the specification;
- correcting camera collision validation to compare level-local architectural Z values consistently;
- adding the canonical footprint to the `ValidatedApartment2D` domain contract and semantic ID index;
- preserving element-level Z values as level-local values in the trusted 2D model;
- adding or extending reusable exact-decimal 2D geometry helpers when required;
- updating affected tests and fixtures;
- updating current-state documentation so the repository describes the 2.2 migration as complete.

## Out of Scope

This task does **not** include:

- exact 3D geometry primitives;
- explicit floor or ceiling domain objects;
- conversion of level-local Z values into model-space Z values;
- `ArchitecturalModel3D` or any 2D-to-3D builder;
- Three.js or renderer-specific behavior;
- multi-level support;
- holes or multiple disconnected apartment footprints;
- backward-compatible support for Apartment SVG 2.1;
- changes to the normative Apartment SVG 2.2 specification;
- new external dependencies.

Do not introduce 3D abstractions merely because the validated footprint will later define floor and ceiling XY geometry.

## Functional Requirements

### Footprint geometric conformance

The complete geometry-validation stage must enforce the Apartment SVG 2.2 footprint rules.

The footprint polygon must:

- have at least four distinct vertices;
- have positive area;
- have no self-intersection;
- have no zero-length edge, including the implicit closing edge;
- use only horizontal or vertical edges;
- have an axis-aligned closing edge;
- use exact coordinate equality for orthogonality rather than `EPSILON`;
- be entirely contained within the root `viewBox`.

Concave orthogonal footprints are valid.

Use structured footprint validation errors. Add the geometric codes recommended by the specification:

```text
APSVG-FOOTPRINT-001  invalid footprint polygon
APSVG-FOOTPRINT-002  stationary semantic placement geometry outside footprint
```

The existing footprint schema-level `APSVG-FOOTPRINT-1xx` errors remain distinct from these geometric failures.

### Apartment-footprint containment

Treat the footprint as a closed region consisting of its interior and boundary.

Require complete containment of:

```text
zone          complete polygon
wall          complete rectangle
window        complete opening rectangle
door          complete opening rectangle
fixed element complete rectangle
utility       semantic point (cx, cy)
camera        semantic point (cx, cy)
```

Boundary contact is valid.

Containment of polygons and rectangles must apply to the entire geometric set, not only selected vertices. Tests must include a concave-footprint case where vertex-only containment would incorrectly accept geometry that crosses outside the footprint.

Utility and camera marker radii remain non-semantic and must not participate.

For hinged doors:

- the opening footprint must be contained;
- the `open-leaf` reference point may be outside the apartment footprint;
- the `open-leaf` point must still satisfy root `viewBox` containment.

The existing root `viewBox` containment invariant remains in force for core semantic geometry, including the footprint itself.

### Level-local Z semantics

Architectural element-level Z values are level-local, with local `Z = 0` at the level floor.

Validation must therefore compare camera collisions in one consistent coordinate space.

For collision validation, use level-local ranges:

```text
wall          [0, effectiveWallHeight]
fixed element [data-base-z, data-base-z + data-height]
camera        data-z
```

`metadata.level.baseZ` must not be added to only one side of a collision comparison.

Add focused tests with non-zero `level.baseZ` proving that changing the model-space level offset does not change level-local camera collision results.

No domain Z value should be converted to model-space in this task. `metadata.level.baseZ` remains the separate offset for the future 3D builder.

### `ValidatedApartment2D`

Introduce an explicit renderer-independent domain concept for the validated apartment footprint, preserving:

- footprint `id`;
- `kind: "footprint"`;
- exact-decimal polygon boundary points.

Expose it directly from `ValidatedApartment2D`, conceptually:

```ts
readonly footprint: ApartmentFootprint;
```

The footprint must also be part of `ApartmentSemanticElement` and `semanticElementsById`, with the index referring to the same constructed domain instance exposed by `ValidatedApartment2D.footprint`.

Keep `bounds` as the root `viewBox` bounds. The footprint and `bounds` represent different concepts and must not be conflated.

Preserve fixed-element `baseZ`, utility `z`, camera `z`, sill heights, and other element-level architectural Z values as level-local values.

Do not add explicit floor or ceiling surfaces to `ValidatedApartment2D`; their future model-space Z positions are deterministically derivable from the validated footprint and level metadata.

## Technical and Architectural Constraints

- Keep source-document geometric validation in `@planaxis/validator`.
- Keep trusted domain contracts in `@planaxis/model`.
- Put generally reusable exact-decimal polygon/shape operations in `@planaxis/geometry` when a new helper is needed.
- Reuse existing exact-decimal polygon primitives and topology operations where practical.
- Do not implement footprint containment with bounding-box approximation or vertex-only shortcuts.
- Preserve the existing validation-stage separation and nominal `GeometryValidApartmentSvgDocument` boundary.
- Do not repeat schema or reference validation inside later stages.
- Do not add an external dependency.
- Do not modify any file under `docs/tasks/`.

## Files and Areas Expected to Change

Expected areas include:

```text
packages/geometry/src/
packages/geometry/test/
packages/validator/src/
packages/validator/test/
packages/model/src/
fixtures/
apps/cli/test/                   # if integration expectations require updates
README.md
docs/architecture/overview.md
```

Only change areas that are actually required by the implementation.

## Testing Requirements

Add or update automated coverage for:

- valid rectangular and concave orthogonal footprints;
- fewer than four distinct footprint vertices;
- non-positive-area footprint;
- self-intersecting footprint;
- zero-length footprint edge;
- diagonal edge and diagonal closing edge;
- footprint outside the root `viewBox`;
- valid boundary contact between stationary geometry and the footprint;
- each stationary geometry category outside the footprint where practical;
- complete rectangle/polygon containment across concave footprint boundaries, not just vertex containment;
- hinged-door `open-leaf` outside the footprint but inside `viewBox` being accepted;
- hinged-door `open-leaf` outside the root `viewBox` remaining invalid;
- camera-wall and camera-fixed-element collisions with non-zero `level.baseZ`;
- successful `ValidatedApartment2D` footprint construction;
- exact footprint boundary preservation;
- the footprint's identity in `semanticElementsById`;
- preservation of level-local Z values in the trusted domain model;
- full valid-fixture and CLI validation behavior under Apartment SVG 2.2.

Update unrelated invalid fixtures as necessary so their footprint is geometrically valid and their placement geometry is contained; they should continue failing primarily for the rule they are intended to test.

Follow `docs/development/testing.md` and do not weaken existing coverage.

## Documentation Requirements

Update current-state wording in:

```text
README.md
docs/architecture/overview.md
```

so they describe the parser, validator, CLI, and `ValidatedApartment2D` pipeline as fully aligned with Apartment SVG 2.2 and identify renderer-independent 3D foundations/modeling as the next development stage.

Update other non-historical documentation only if this implementation makes it inaccurate.

Do not modify the normative Apartment SVG 2.2 specification.

## Verification

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run focused geometry, validator, model/domain, and CLI tests during development as useful.

## Acceptance Criteria

The task is complete when:

1. the complete validation pipeline enforces all Apartment SVG 2.2 footprint geometry and footprint-containment rules;
2. root `viewBox` containment remains correct, including the hinged-door `open-leaf` exception relative to footprint containment;
3. camera collision validation uses consistent level-local Z semantics and behaves correctly with non-zero `level.baseZ`;
4. `ValidatedApartment2D` exposes the validated canonical footprint as exact-decimal domain data and includes it consistently in the semantic ID index;
5. architectural element-level Z values remain level-local in the 2D domain model;
6. valid and invalid fixtures exercise the 2.2 rules without accidental unrelated failures;
7. the complete existing Apartment SVG pipeline is accurately documented as 2.2-conformant;
8. required tests and repository verification pass;
9. no 3D, renderer, compatibility, or unrelated functionality is introduced.

## Final Response

Provide a concise report containing:

1. implementation summary;
2. main files/areas changed;
3. tests and fixtures added or updated;
4. verification commands and results;
5. deviations from this description, or `None`;
6. follow-up items, or `None`;
7. a suggested Conventional Commits message including:

```text
Task: TASK-014
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.
