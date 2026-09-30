# TASK-040: Implement Persistent Luminaire Semantics

## Context

PlanAxis Design Format 1.1 is now the accepted persistent contract for artificial-light luminaires.

The current `@planaxis/design`, server design-write path, and browser scenario workflow implement Design Format 1.0 only. The browser editor also reconstructs descriptors when saving name/presentation changes, so Design 1.1 luminaires must be preserved explicitly before 1.1 scenarios can safely participate in the existing workflow.

This task implements the Design 1.1 persistence/domain boundary only. Rendering and interactive luminaire editing remain separate later work.

## Required Reading

Before making changes, read and follow:

```text
AGENTS.md
README.md
docs/architecture/overview.md
docs/development/coding-guidelines.md
docs/development/testing.md
docs/decisions/ADR-002-react-browser-ui.md
docs/decisions/ADR-004-filesystem-backed-projects.md
docs/specifications/planaxis-design/1.0.md
docs/specifications/planaxis-design/1.1.md
docs/specifications/planaxis-project/1.0.md
```

Do not read any other file under `docs/tasks/`.

## Goal

Extend the existing design pipeline to support both:

```text
planaxis-design/1.0
planaxis-design/1.1
```

Design 1.1 must support the persistent luminaire semantics defined by its normative specification.

New design scenarios must be created as Design 1.1. Existing Design 1.0 scenarios must continue to load, edit, and save as Design 1.0 without implicit migration.

## Scope

The task includes:

- extending `@planaxis/design` with version-aware Design 1.0 / 1.1 descriptor types and validation;
- adding renderer-independent Design 1.1 luminaire types for `point`, `spot`, `linear`, and `area`;
- validating Design 1.1 luminaires exactly according to the normative 1.1 specification;
- preserving existing Design 1.0 behavior and closed-schema rules;
- keeping architecture/finish-target resolution compatible with both supported versions;
- updating server design POST/PUT validation and persistence to accept either supported version;
- updating browser design loading and selection to accept Design 1.1 scenarios;
- creating new browser-authored design scenarios as Design 1.1;
- preserving a descriptor's declared schema version when editing an existing scenario;
- preserving the complete Design 1.1 `luminaires` array unchanged when editing existing name/presentation fields;
- optionally displaying the number of preserved luminaires in the current design editor without adding luminaire-editing controls;
- adding focused package, server, and browser tests;
- updating current-state documentation made inaccurate by the implementation.

## Out of Scope

This task does **not** include:

- creating Three.js light objects from persistent luminaires;
- changing `@planaxis/renderer-three` to render Design 1.1 luminaires;
- luminaire placement, movement, rotation, duplication, deletion, or property-editing UI;
- 2D or 3D luminaire gizmos/markers;
- geometric containment, collision, room-membership, ceiling-attachment, or surface-attachment validation for luminaires;
- implicit conversion of Apartment SVG `ceiling-light` utilities into luminaires;
- Design 1.0 → 1.1 migration during load or save;
- fixture-model references;
- IES/photometric resources;
- RGB/RGBW light color;
- realtime GI, bloom, path tracing, or other artificial-light rendering work;
- changes to Design Format 1.0 or 1.1 normative semantics.

Do not add adjacent rendering or editing behavior merely because the persistent semantics are now available.

## Functional Requirements

### Version-aware design model

`@planaxis/design` must model the two supported schema versions explicitly.

The implementation should use a clear discriminated versioned contract rather than weakening the current trusted descriptor types with broadly optional 1.1-only fields.

Exact public type/constant names may follow existing package conventions, but callers must be able to distinguish Design 1.0 from Design 1.1 by the validated document's `schema`.

Design 1.0 retains its existing semantics.

Design 1.1 retains the same architecture, finishes, presentation, path, and resolution semantics and additionally permits `luminaires` exactly as defined by:

```text
docs/specifications/planaxis-design/1.1.md
```

Do not duplicate a second independent interpretation of those rules in application code.

### Design 1.1 luminaire validation

Implement the normative Design 1.1 luminaire contract, including:

- non-empty optional `luminaires` array;
- unique design-local IDs;
- exact `point | spot | linear | area` discrimination;
- recursively closed luminaire, position, and orientation objects;
- required/prohibited fields by type;
- finite model-space position values;
- normative orientation ranges where required;
- positive luminous flux and color temperature;
- boolean `enabled`;
- `dimming` in `[0, 1]`;
- valid spot beam angle;
- positive linear/area dimensions;
- rejection of unsupported RGB, IES, fixture-model, implicit attachment, and other unknown properties.

Use the existing `DESIGN_*` error domain and structured validation approach. Add stable focused error codes where useful; do not collapse materially different validation failures into exceptions.

### Architecture resolution

`resolveDesignArchitecture` must continue to enforce exact architecture binding and finish-target resolution for both versions.

Design 1.1 luminaires add no architecture-resource or geometric-resolution step.

The resolver must not:

- test luminaire containment;
- snap or move luminaires;
- attach them to Apartment SVG utilities;
- infer fixture relationships;
- reject a design solely because a luminaire appears physically awkward.

On successful resolution, all persistent luminaire data must be preserved unchanged.

### Server persistence

The existing controlled design POST/PUT endpoints must accept structurally conformant Design 1.0 and Design 1.1 documents.

Writes must:

- validate through `@planaxis/design`;
- preserve the descriptor's declared schema version;
- serialize the validated document only;
- preserve Design 1.1 luminaire data;
- retain the existing ProjectFilesystem write boundary and error handling.

Do not add new luminaire-specific server resource endpoints.

### Browser loading and editing

The existing browser scenario workflow must accept supported Design 1.1 descriptors.

A selected Design 1.1 scenario must continue to apply its currently supported architecture, finish, and presentation behavior. Its luminaires are persistent data only in this task and must not affect rendering yet.

Newly created design scenarios must use:

```text
planaxis-design/1.1
```

Editing an existing scenario must preserve its schema version:

```text
Design 1.0 -> edit -> Design 1.0
Design 1.1 -> edit -> Design 1.1
```

No ordinary load, edit, or save operation may silently migrate Design 1.0 to 1.1.

When the existing editor changes only name and/or presentation values, all other persistent data must be retained, including:

- architecture binding;
- finishes;
- Design 1.1 luminaires.

A Design 1.1 descriptor containing luminaires must therefore survive a name/presentation save with semantically identical luminaire content and ordering.

The editor MAY show a read-only luminaire count analogous to the existing finish count, but it must not expose luminaire-editing controls.

## Technical and Architectural Constraints

- Keep Design Format semantics in `@planaxis/design`.
- Keep luminaire persistence renderer-independent; do not import Three.js into the design package.
- Preserve the distinction between structural Design Format conformance and later renderer adaptation.
- Preserve Design 1.0 compatibility under its own declared schema.
- Do not introduce implicit schema migration.
- Do not infer any relationship between Design 1.1 luminaires and Apartment SVG utilities.
- Preserve existing project-filesystem and controlled-write boundaries.
- Keep browser application code focused on workflow/state rather than reimplementing design validation.
- Avoid adding dependencies unless a concrete need is demonstrated.
- Do not modify any file under `docs/tasks/`.

## Files and Areas Expected to Change

Expected areas include:

```text
packages/design/src/
packages/design/test/
apps/server/src/
apps/server/test/
apps/web/src/
apps/web/test/
README.md
AGENTS.md
docs/architecture/overview.md
docs/development/coding-guidelines.md
docs/development/testing.md
```

Only update documentation where implementation completion makes current wording inaccurate.

No renderer changes are expected.

## Testing Requirements

Add focused automated coverage for at least:

- valid minimal Design 1.0 still accepted;
- valid minimal Design 1.1 accepted;
- Design 1.0 rejects the 1.1-only `luminaires` property;
- Design 1.1 accepts each of `point`, `spot`, `linear`, and `area`;
- duplicate luminaire IDs rejected;
- type-specific required/prohibited properties enforced;
- invalid position/orientation/numeric constraints rejected;
- unknown nested luminaire properties rejected;
- RGB, IES, fixture-model, and implicit-attachment properties rejected;
- architecture/finish resolution behavior remains compatible for both versions;
- successful Design 1.1 resolution preserves luminaires unchanged;
- server POST/PUT accepts and persists both supported versions;
- server serialization preserves Design 1.1 luminaires and schema version;
- browser loads/selects a Design 1.1 scenario without trying to render its luminaires;
- new browser-created scenarios use Design 1.1;
- editing a Design 1.0 scenario preserves Design 1.0;
- editing a Design 1.1 scenario preserves Design 1.1 and its complete luminaire array;
- a name/presentation-only Design 1.1 save does not reorder or alter luminaire semantics.

Follow `docs/development/testing.md` and do not weaken existing tests.

## Documentation Requirements

Update current-state documentation to say that Design 1.1 validation/persistence integration is implemented while artificial-light rendering and luminaire editing remain future work.

Do not change normative Design 1.0 or 1.1 specification semantics.

Do not update renderer documentation as though luminaires already illuminate the scene.

## Verification

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Also run focused design/server/browser tests during development as useful.

## Acceptance Criteria

The task is complete when:

1. `@planaxis/design` supports both Design 1.0 and Design 1.1 through explicit version-aware validated types;
2. Design 1.1 luminaires are validated according to the accepted 1.1 specification;
3. Design 1.0 compatibility and closed-schema behavior remain intact;
4. architecture/finish-target resolution supports both versions and preserves Design 1.1 luminaires without adding geometric luminaire validation;
5. server design writes accept and persist either supported version through the existing safe filesystem boundary;
6. newly created browser scenarios use Design 1.1;
7. editing an existing scenario preserves its declared schema version;
8. Design 1.1 luminaires survive browser load/edit/save unchanged when unrelated fields are edited;
9. Design 1.1 luminaires remain non-rendered and non-editable in this task;
10. focused tests and repository verification pass;
11. current-state documentation accurately distinguishes implemented persistence from deferred rendering/editing.

## Final Response

Provide a concise report containing:

1. implementation summary;
2. Design 1.0 / 1.1 compatibility approach;
3. main files/areas changed;
4. tests added or updated;
5. verification commands and results;
6. deviations from this description, or `None`;
7. follow-up items, or `None`;
8. a suggested Conventional Commits message including:

```text
Task: TASK-040
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.
