# TASK-008: Resolve and Validate Apartment SVG References

## Context

PlanAxis currently validates Apartment SVG 2.1 through complete schema conformance.

Successful schema validation produces `SchemaValidApartmentSvgDocument`, which contains exact-decimal semantic values, unresolved reference ID strings, and `semanticElementsById`. The next architectural stage is reference resolution and referential validation.

This task must establish that stage without performing geometric or topological validation.

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

Implement reference resolution and referential validation in `@planaxis/validator`.

On success, the validator must produce a clearly named reference-valid intermediate representation containing typed resolved relationships. This representation is still not `ValidatedApartment2D`, because geometric and topological conformance has not yet been established.

## Scope

The task includes:

- consuming `SchemaValidApartmentSvgDocument` without reparsing XML or repeating schema validation;
- resolving every Apartment SVG 2.1 core `Ref`;
- validating target existence and required semantic kind;
- producing typed resolved relationships for:
  - window → wall;
  - optional window → radiator via `data-radiator-below`;
  - door → wall;
  - optional radiator → wall;
  - wall-associated utility → wall;
- adding structured reference validation errors;
- adding a reference-valid document/type contract and semantic ID index suitable for later validation;
- exporting a deliberate public reference-validation API;
- adding focused tests for valid, missing-target, wrong-kind, optional-reference, and stage-boundary behavior;
- updating current-state documentation made inaccurate by completion of this stage.

## Out of Scope

This task does **not** include:

- XML parsing or schema validation changes unrelated to enabling this stage;
- geometric or topological validation;
- wall/window/door geometry checks;
- utility placement checks;
- overlap, polygon, or camera-collision checks;
- geometric tolerance calculations;
- derived architectural geometry;
- construction of `ValidatedApartment2D` or `ArchitecturalModel3D`;
- changes to Apartment SVG 2.1;
- Three.js, application, HTTP, persistence, or AI functionality.

Do not add adjacent geometric checks merely because resolved walls make them convenient.

## Functional Requirements

### Public stage API

Expose a stage-specific API conceptually equivalent to:

```ts
validateApartmentSvgReferences(
  document: SchemaValidApartmentSvgDocument,
): ApartmentSvgReferenceValidationResult
```

Exact type names may be refined, but the public contract must clearly communicate reference validation rather than complete Apartment SVG validity.

Ordinary reference failures must be returned as structured validation results, not thrown as programming exceptions.

### Reference-valid representation

Introduce a validator-owned type with an explicit trust-level name such as:

```text
ReferenceValidApartmentSvgDocument
```

It must preserve the schema-valid semantic data and replace downstream dependence on raw reference lookup with typed relationships.

For example, a reference-valid window should expose its resolved wall and, when present, its resolved radiator. Equivalent resolved relationships are required for doors, radiators, and wall-associated utilities.

Retaining the original reference ID in addition to the resolved target is optional; downstream code must not be required to resolve the same ID again.

The reference-valid document must provide an ID index whose values are consistent with the reference-valid representation.

### Referential rules

Validate all Apartment SVG 2.1 `Ref` attributes.

A reference is invalid when:

1. its ID does not resolve to a core semantic element; or
2. it resolves to a core semantic element of the wrong required kind.

Required target kinds are:

```text
data-wall            -> wall
data-radiator-below  -> radiator
```

Non-core content, including annotations, must not become a valid reference target.

Independent reference failures should be aggregated deterministically where practical.

### Validation errors

Extend the structured validation contract with a `reference` category and these codes:

```text
APSVG-REF-001  broken reference / target not found
APSVG-REF-002  referenced core element has the wrong semantic kind
```

Errors should identify the referring element and reference attribute and preserve useful actual/expected context.

## Technical and Architectural Constraints

- Keep the implementation in `@planaxis/validator`.
- Reuse `SchemaValidApartmentSvgDocument.semanticElementsById`.
- Preserve exact-decimal values unchanged.
- Preserve existing schema-validation APIs and behavior.
- Do not move partially trusted types into `@planaxis/model`.
- Do not add an external dependency; none is expected.
- Keep reference resolution separate from geometry.
- Do not modify any file under `docs/tasks/`.

## Files and Areas Expected to Change

Expected areas include:

```text
packages/validator/src/
packages/validator/test/
README.md
docs/architecture/overview.md
```

Focused fixtures may be added when they make reference behavior clearer.

## Testing Requirements

Add automated coverage for:

- every supported reference-bearing element with valid targets;
- missing `data-wall` targets;
- existing core targets of the wrong kind;
- valid, missing, and wrong-kind `data-radiator-below`;
- optional radiator `data-wall` being absent;
- non-core/annotation content not being referenceable;
- successful output exposing typed resolved relationships;
- the stage boundary: reference validation must not reject input solely for deferred geometric/topological invalidity.

Follow `docs/development/testing.md` and do not weaken existing tests.

## Documentation Requirements

Update current-state wording in `README.md` and `docs/architecture/overview.md` so they describe reference validation as implemented and geometric/topological validation as the next stage.

Do not change normative specification semantics.

## Verification

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Also run focused validator tests during development as useful.

## Acceptance Criteria

The task is complete when:

1. all Apartment SVG 2.1 core references are resolved and validated for target existence and kind;
2. broken and wrong-kind references return the specified structured `APSVG-REF-*` errors;
3. success returns a typed reference-valid intermediate document with resolved relationships and a consistent ID index;
4. existing schema-validation behavior remains compatible;
5. geometric/topological validation remains out of scope;
6. focused tests and repository verification pass;
7. current-state documentation reflects the completed pipeline stage.

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
Task: TASK-008
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.
