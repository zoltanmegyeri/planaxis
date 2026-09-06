# TASK-013: Migrate Apartment SVG Structural Support to 2.2

## Context

Apartment SVG 2.2 is now the current normative specification. The implementation still targets Apartment SVG 2.1 and does not structurally represent the new mandatory apartment footprint.

This task is the first implementation step of the 2.2 migration. It updates the parser/schema/reference trust stages and repository test inputs to the new structural contract while deliberately deferring the new geometric, containment, Z-coordinate, and full domain-model semantics to follow-up work.

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

Make PlanAxis structurally understand Apartment SVG 2.2 through schema and reference validation.

A structurally valid 2.2 document must expose its mandatory footprint as typed exact-decimal semantic data through the schema-valid and reference-valid intermediate representations, without prematurely implementing the footprint's geometric or containment rules.

## Scope

The task includes:

- changing the supported root schema version and metadata schema identifier from 2.1 to 2.2;
- adding `footprint` to the Apartment SVG vocabulary, required core groups, and semantic kinds;
- validating the required `footprint` group and its exactly one footprint `<polygon>`;
- validating the footprint polygon's schema-level element form, required attributes, permitted common attributes, and coordinate-list syntax;
- representing footprint points with exact decimal coordinates;
- exposing the footprint through `SchemaValidApartmentSvgDocument`, the schema-valid semantic ID index, `ReferenceValidApartmentSvgDocument`, and its semantic ID index;
- preserving the footprint unchanged through reference validation without introducing new reference semantics;
- updating the shared apartment metadata schema literal to `apartment-svg/2.2` where required to keep existing downstream code type-correct, without otherwise expanding `ValidatedApartment2D`;
- migrating existing tests and Apartment SVG fixtures that target current behavior to 2.2 structure and version identifiers;
- updating current-state documentation made inaccurate by completion of this migration stage.

Parser changes are required only where the existing generic parser does not already preserve the new group and polygon correctly.

## Out of Scope

This task does **not** include:

- footprint geometric conformance, including minimum distinct-vertex count, positive area, self-intersection, zero-length edges, or horizontal/vertical edge requirements;
- footprint containment within the root `viewBox`;
- containment of zones, walls, openings, fixed elements, utilities, cameras, or hinged-door geometry within the footprint;
- the Apartment SVG 2.2 hinged-door open-leaf containment exception;
- changes to level-relative architectural Z interpretation or camera-collision Z calculations;
- adding the footprint to `ValidatedApartment2D` or otherwise completing the 2.2 domain-model migration;
- renderer-independent 3D geometry or `ArchitecturalModel3D`;
- backward-compatible support for Apartment SVG 2.1;
- new external dependencies.

Do not move geometric 2.2 rules into schema validation merely because the footprint is available there.

## Functional Requirements

### Version contract

The current implementation must target Apartment SVG 2.2:

```text
data-schema="apartment-svg"
data-schema-version="2.2"
metadata.schema="apartment-svg/2.2"
data-unit="cm"
```

Apartment SVG 2.1 must no longer be accepted as the current supported schema version.

### Footprint group and element

Schema validation must enforce the 2.2 structural rules for the footprint:

- exactly one required top-level `g` with `id="footprint"`;
- the group must obey the same core-group transform prohibition as other semantic groups;
- the group must contain exactly one footprint semantic element;
- that semantic element must use SVG `polygon`;
- it must have the required `id`, `points`, and `data-kind` attributes;
- `data-kind` must be exactly `footprint`;
- its `points` value must be parsed as the specification-defined coordinate list using exact decimal values;
- permitted presentation and `data-x-*` extension attributes must continue to follow the common attribute rules.

Rules classified by Apartment SVG 2.2 as geometric conformance must remain deferred.

### Schema-valid representation

Introduce an explicit schema-valid footprint contract and expose exactly one footprint from `SchemaValidApartmentSvgDocument`.

The footprint must participate in the schema-valid semantic ID index consistently with other core semantic elements.

Its typed representation must retain:

- `id`;
- semantic kind `footprint`;
- exact-decimal polygon points.

### Reference-valid representation

Reference validation must carry the schema-valid footprint through unchanged.

The reference-valid semantic ID index must contain the corresponding reference-valid footprint representation.

The footprint introduces no new `Ref` attributes. Existing reference rules and target-kind requirements must remain unchanged; a footprint must not accidentally become a valid target for a wall or radiator reference.

### Stage boundary

Schema/reference validation must not reject an otherwise structurally valid footprint solely because it is geometrically invalid under deferred 2.2 rules.

Tests should protect this boundary using at least one structurally valid but geometrically invalid footprint, such as a polygon containing a diagonal edge.

### Transitional downstream compatibility

The existing downstream geometry/domain pipeline must remain buildable and testable during this staged migration.

Update the shared `ApartmentMetadata.schema` literal to `apartment-svg/2.2` as required for type compatibility, but do not add the footprint to `ValidatedApartment2D` or claim that the domain model fully implements Apartment SVG 2.2 in this task.

Full 2.2 geometric and domain conformance remains follow-up work.

## Technical and Architectural Constraints

- Keep schema-valid and reference-valid trust-level types owned by `@planaxis/validator`.
- Preserve exact decimal parsing and representation for footprint coordinates.
- Reuse existing polygon/point parsing conventions rather than introducing a parallel numeric path.
- Preserve the separation between schema validation, reference validation, geometric validation, and domain construction.
- Do not add an external dependency.
- Do not add temporary backward-compatibility infrastructure for 2.1.
- Make the smallest coherent changes needed to keep downstream compilation and existing pipeline tests working during the staged migration.
- Do not modify any file under `docs/tasks/`.

## Files and Areas Expected to Change

Expected areas include:

```text
packages/validator/src/
packages/validator/test/
packages/model/src/
packages/parser/test/            # if current parser expectations encode the old group/version structure
fixtures/
apps/cli/test/                   # if fixture/version assumptions require updates
README.md
docs/architecture/overview.md
```

Other existing tests containing inline Apartment SVG documents may also require 2.2 structural updates.

## Testing Requirements

Add or update automated coverage for:

- root `data-schema-version="2.2"` and metadata `schema="apartment-svg/2.2"`;
- rejection of the old 2.1 version identifiers;
- missing, duplicate, or incorrectly formed `footprint` group;
- empty footprint group and multiple footprint semantic elements;
- wrong SVG element type or wrong `data-kind` in the footprint group;
- missing or invalid footprint schema attributes and malformed coordinate-list syntax;
- successful exact-decimal footprint representation in `SchemaValidApartmentSvgDocument`;
- footprint presence and identity in schema-valid and reference-valid semantic ID indexes;
- reference validation preserving the footprint without changing existing reference semantics;
- schema/reference stage acceptance of a structurally valid footprint whose deferred geometry is invalid;
- migration of existing valid fixtures and unrelated invalid fixtures so they target Apartment SVG 2.2 without introducing accidental earlier failures.

Follow `docs/development/testing.md`. Keep invalid fixtures focused on their intended primary rule.

Do not weaken or delete existing coverage merely to accommodate the version migration.

## Documentation Requirements

Update current-state wording in:

```text
README.md
docs/architecture/overview.md
```

so they state that structural/schema/reference support has migrated to Apartment SVG 2.2 while full 2.2 geometric and `ValidatedApartment2D` alignment remains pending.

Do not modify the normative Apartment SVG 2.2 specification.

## Verification

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run focused parser/validator/CLI tests during development as useful.

## Acceptance Criteria

The task is complete when:

1. the parser/schema/reference pipeline targets Apartment SVG 2.2 rather than 2.1;
2. the mandatory footprint group and polygon are schema-validated according to their structural rules;
3. schema-valid and reference-valid documents expose the footprint as exact-decimal typed semantic data with consistent ID indexes;
4. deferred footprint geometry, footprint containment, and level-relative Z semantics remain outside this task;
5. existing fixtures and tests that exercise current behavior use appropriate 2.2 document structure;
6. the existing downstream pipeline remains type-correct and testable without prematurely adding the footprint to `ValidatedApartment2D`;
7. current-state documentation accurately describes the partial 2.2 migration;
8. required repository verification passes;
9. no unrelated changes or new dependencies are introduced.

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
Task: TASK-013
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.
