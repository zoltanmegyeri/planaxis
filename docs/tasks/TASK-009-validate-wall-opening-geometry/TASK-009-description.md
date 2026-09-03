# TASK-009: Validate Apartment SVG Wall and Opening Geometry

## Context

TASK-008 established `ReferenceValidApartmentSvgDocument`, where all Apartment SVG 2.1 core references are resolved and type-valid.

The next normative validation steps are wall geometry, opening-to-wall relationships, and hinged-door geometry. Broader topology, placement, collision, and overlap validation remain separate work.

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

Implement the first geometric-validation stage in `@planaxis/validator`.

The stage must consume `ReferenceValidApartmentSvgDocument` and validate Apartment SVG 2.1 wall, window, and door geometry using authoritative exact-decimal arithmetic and the normative geometric tolerance.

## Scope

Implement validation for:

- wall `data-axis` geometry;
- effective wall height using explicit wall height or `metadata.level.defaultCeilingHeight`;
- window footprint relationship to its resolved supporting wall;
- window vertical opening extent against effective wall height;
- door footprint relationship to its resolved supporting wall;
- door opening height against effective wall height;
- hinged-door hinge position;
- hinged-door open-leaf geometry;
- structured geometric validation errors;
- focused tests for these rules and tolerance boundaries.

Follow the normative rules in Apartment SVG 2.1 rather than duplicating them unnecessarily in implementation-specific logic.

## Out of Scope

Do not implement:

- parsing, schema validation, or reference resolution changes unrelated to this stage;
- zone polygon or topology validation;
- zone/wall or zone/zone overlap checks;
- window/window, door/door, or door/window overlap checks;
- fixed-element geometric validation;
- utility placement validation;
- camera collision validation;
- full semantic-geometry `viewBox` containment;
- `ValidatedApartment2D` or `ArchitecturalModel3D`;
- Three.js or application behavior.

## Functional Requirements

### Stage API

Expose a deliberate public API conceptually equivalent to:

```ts
validateApartmentSvgWallAndOpeningGeometry(
  document: ReferenceValidApartmentSvgDocument,
): ApartmentSvgWallAndOpeningGeometryValidationResult
```

Ordinary invalid geometry must return structured validation errors rather than throw.

A successful result may expose the input `ReferenceValidApartmentSvgDocument` unchanged for pipeline chaining.

Do **not** introduce a new partially trusted document type such as `WallGeometryValidApartmentSvgDocument` or `GeometricallyValidApartmentSvgDocument`. Full geometric/topological conformance has not yet been established.

### Wall geometry

Validate Apartment SVG 2.1 wall-axis consistency:

```text
axis=x -> width > height
axis=y -> height > width
```

Square walls are invalid.

Use the effective wall height defined by the specification wherever opening-height validation requires it.

### Window geometry

Using the already resolved `window.wall`, validate:

- exact wall-thickness coverage;
- containment within the wall's longitudinal extent;
- `sillHeight + openingHeight <= effectiveWallHeight`.

Use the normative geometric tolerance where the specification requires geometric comparison.

### Door geometry

Using the already resolved `door.wall`, validate:

- exact wall-thickness coverage;
- containment within the wall's longitudinal extent;
- `openingHeight <= effectiveWallHeight`.

For hinged doors additionally validate:

- the hinge lies on the supporting-wall centerline;
- the hinge coincides with one longitudinal endpoint of the opening;
- the open-leaf point represents a valid 90-degree opened leaf;
- leaf length equals the opening width defined by the specification.

Sliding and opening-only doors require no hinged-door geometry checks.

### Validation codes

Add geometry-stage codes using the existing structured validation contract:

```text
APSVG-WALL-001    invalid wall axis geometry

APSVG-WINDOW-001  window does not cover supporting-wall thickness
APSVG-WINDOW-002  window exceeds supporting-wall longitudinal extent
APSVG-WINDOW-003  window opening exceeds effective wall height

APSVG-DOOR-001    invalid hinge point
APSVG-DOOR-002    invalid open-leaf point
APSVG-DOOR-003    door does not cover supporting-wall thickness
APSVG-DOOR-004    door exceeds supporting-wall longitudinal extent
APSVG-DOOR-005    door opening exceeds effective wall height
```

Errors must preserve useful element, rule, actual, and expected context through the existing validation-error contract.

## Technical Constraints

- Keep Apartment SVG validation behavior in `@planaxis/validator`.
- Use `@planaxis/geometry` for authoritative decimal values and tolerance-aware comparison.
- Do not convert authoritative geometry through JavaScript `number`.
- Reuse resolved wall relationships from `ReferenceValidApartmentSvgDocument`; do not resolve IDs again.
- Add geometry-package helpers only if they are genuinely reusable geometric primitives rather than Apartment SVG-specific validation rules.
- Do not add an external dependency.
- Preserve existing parser, schema-validation, and reference-validation APIs.

## Testing Requirements

Add focused automated coverage for:

- valid and invalid horizontal and vertical wall-axis geometry, including square walls;
- horizontal and vertical windows with valid and invalid thickness, longitudinal bounds, and opening heights;
- horizontal and vertical doors with valid and invalid thickness, longitudinal bounds, and opening heights;
- both legal hinge endpoints;
- both legal 90-degree opening sides;
- invalid hinge positions and invalid open-leaf length/orientation;
- exact `EPSILON` boundary acceptance and immediately-outside-tolerance rejection where applicable;
- successful validation returning/preserving the reference-valid input contract;
- the stage boundary: deferred zone, overlap, utility, fixed-element, or camera invalidity must not cause this validator to fail solely because of those deferred rules.

Follow `docs/development/testing.md`.

## Documentation Requirements

No documentation change is expected unless completion of the task makes an existing non-task document factually inaccurate.

Do not modify Apartment SVG 2.1 or files under `docs/tasks/`.

## Verification

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run focused validator or geometry tests during development as useful.

## Acceptance Criteria

The task is complete when:

1. wall-axis geometry is validated according to Apartment SVG 2.1;
2. window-to-wall geometry and window opening height are validated;
3. door-to-wall geometry and door opening height are validated;
4. hinged-door hinge and open-leaf invariants are validated;
5. authoritative calculations remain exact-decimal and tolerance-aware;
6. failures use the specified structured `APSVG-*` codes;
7. validation consumes resolved relationships without repeating reference resolution;
8. no new partially geometry-valid document type is introduced;
9. topology, overlaps, utilities, cameras, and other deferred checks remain out of scope;
10. focused tests and repository verification pass.

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
Task: TASK-009
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.