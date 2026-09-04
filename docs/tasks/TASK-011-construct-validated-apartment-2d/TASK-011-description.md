# TASK-011: Construct ValidatedApartment2D

## Context

TASK-010 established `GeometryValidApartmentSvgDocument`, meaning all required Apartment SVG 2.1 schema, reference, geometric, and topological validation has succeeded.

The next architectural stage is construction of the normalized trusted 2D domain model used by downstream application and 3D-model code.

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

Define `ValidatedApartment2D` in `@planaxis/model` and implement deterministic construction from `GeometryValidApartmentSvgDocument`.

The resulting model must expose trusted domain concepts and useful deterministic derived values without leaking SVG parsing/validation concerns.

## Scope

Implement:

- `ValidatedApartment2D` and supporting domain types in `@planaxis/model`;
- a public builder in `@planaxis/validator` conceptually equivalent to:

```ts
buildValidatedApartment2D(
  document: GeometryValidApartmentSvgDocument,
): ValidatedApartment2D
```

- normalized domain representations for metadata, spaces, walls, windows, doors, fixed elements, utilities, and cameras;
- resolved relationships between domain-model objects;
- deterministic derived values useful to downstream code;
- a read-only semantic-element ID index containing domain-model instances;
- focused construction and type-boundary tests.

## Domain Model Requirements

`ValidatedApartment2D` must be a genuine normalized model, not an alias or wrapper around the geometry-valid SVG document.

Prefer domain-oriented structures such as:

```ts
footprint: Rect2D
position: Point2D
```

instead of exposing SVG-specific coordinate naming such as `cx` / `cy`.

Resolved relationships must reference model objects rather than preserve unresolved IDs where the ID is already available through the referenced object.

Derived values should include where applicable:

- wall length, thickness, effective height, and centerline;
- window opening width;
- door opening width;
- hinged-door leaf length and closed free endpoint.

Preserve all relevant canonical metadata and semantic attributes needed by downstream application and 3D-model code.

All authoritative and derived geometry must remain exact-decimal.

## Construction Semantics

The builder accepts only `GeometryValidApartmentSvgDocument`.

It must not perform another source-validation pass, repair geometry, infer missing facts, or return ordinary validation failures.

Defensive assertions are permitted only for impossible internal/programming errors.

Constructed objects and collections should follow the repository's existing immutable/read-only conventions.

## Package Boundaries

- `@planaxis/model` owns the domain contracts.
- `@planaxis/model` may depend on `@planaxis/geometry`.
- `@planaxis/model` must not depend on `@planaxis/validator`.
- `@planaxis/validator` owns construction from `GeometryValidApartmentSvgDocument`.
- Do not introduce renderer or Three.js dependencies.
- Avoid duplicating or moving SVG-specific vocabulary unless required for a clean domain boundary; preserve existing public APIs if shared domain vocabulary needs relocation.

## Out of Scope

Do not implement:

- additional Apartment SVG validation;
- XML/SVG parsing changes unrelated to model construction;
- persistent serialization of `ValidatedApartment2D`;
- wall volumes, floors, ceilings, meshes, or other 3D geometry;
- `ArchitecturalModel3D`;
- Three.js/rendering behavior;
- simulation, backend, or AI workflows.

## Testing Requirements

Add focused coverage proving:

- successful construction from `GeometryValidApartmentSvgDocument`;
- correct horizontal/vertical wall derived geometry;
- explicit and default effective wall heights;
- correct window and door opening widths;
- correct hinged-door leaf length and closed free endpoint for supported orientations;
- resolved relationships reference the corresponding constructed model objects;
- metadata and optional semantic attributes are preserved;
- the semantic ID index contains model objects;
- exact `Decimal` values remain authoritative;
- the builder's type boundary does not accept an ordinary `ReferenceValidApartmentSvgDocument`.

Follow `docs/development/testing.md`.

## Documentation Requirements

Update current-state documentation to show `ValidatedApartment2D` as implemented and as the trusted input to the future `ArchitecturalModel3D` stage.

Do not modify Apartment SVG 2.1 or files under `docs/tasks/`.

## Verification

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Acceptance Criteria

The task is complete when:

1. `ValidatedApartment2D` is publicly defined by `@planaxis/model`;
2. `@planaxis/validator` constructs it only from `GeometryValidApartmentSvgDocument`;
3. the model no longer exposes raw SVG parsing/validation concerns;
4. all semantic element categories and relevant metadata are represented;
5. resolved relationships point to constructed domain objects;
6. required deterministic derived values are available;
7. authoritative geometry remains exact-decimal;
8. the model package does not depend on the validator or rendering layers;
9. no additional source validation or geometric repair is introduced;
10. focused tests and repository verification pass;
11. current-state documentation reflects completion of `ValidatedApartment2D`.

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
Task: TASK-011
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.