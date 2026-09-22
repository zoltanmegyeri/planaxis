# TASK-031: Implement the PlanAxis Material Package

## Context

PlanAxis Material Format 1.0 is now the normative persistent material format for Phase 3.

Phase 1 already established renderer-independent physical surface mapping and a transient metallic/roughness PBR runtime contract. Phase 2 established Design Format 1.0 finish assignments that reference project-local resources under `assets/materials/` without interpreting them.

This task begins Phase 3 by implementing the pure shared Material Format boundary. Later tasks will add controlled server resource access and browser/rendering integration.

## Required Reading

Before making changes, read and follow:

```text
AGENTS.md
docs/specifications/planaxis-material/1.0.md
docs/specifications/planaxis-project/1.0.md
docs/specifications/planaxis-design/1.0.md
docs/architecture/overview.md
docs/development/coding-guidelines.md
docs/development/testing.md
docs/decisions/ADR-001-typescript-monorepo.md
docs/decisions/ADR-003-three-renderer-architecture.md
docs/decisions/ADR-004-filesystem-backed-projects.md
```

Do not read any other file under `docs/tasks/`.

## Goal

Create a reusable `@planaxis/material` workspace package that implements PlanAxis Material Format 1.0 parsing, validation, trusted types, descriptor identity, texture-reference validation, and deterministic effective/defaulted material semantics without filesystem, browser, or renderer dependencies.

## Scope

The task includes:

- create `@planaxis/material` following existing workspace/package conventions;
- model trusted Material 1.0 descriptor data and project-relative descriptor identity;
- parse untrusted JSON text and validate Material 1.0 content and descriptor-path conformance;
- validate recursively closed root, `mapping`, `maps`, and `alpha` objects;
- validate `name`, scalar PBR values, map/mapping coupling, physical texture dimensions, supported texture paths/extensions, and alpha variants;
- expose the normative defaults for omitted scalar and alpha values without silently rewriting durable descriptor data;
- expose deliberate public APIs and structured expected validation failures;
- add focused deterministic package tests;
- update current-state documentation made inaccurate by implementing the package.

## Out of Scope

This task does **not** include:

- filesystem access, resource existence checks, symbolic-link handling, or project-root containment;
- loading or decoding PNG, JPEG, or WebP files;
- server routes or HTTP APIs;
- browser/React integration;
- conversion to `RuntimePbrMaterial`, Three.js textures, or renderer objects;
- applying design finish assignments;
- material discovery, creation, editing, deletion, import, or catalog UI;
- finish-assignment orientation or other mapping overrides;
- additional PBR fields or texture formats beyond Material Format 1.0;
- changes to PlanAxis Material Format 1.0, Design Format 1.0, or Project Format 1.0.

## Functional Requirements

The implementation MUST conform to `docs/specifications/planaxis-material/1.0.md`.

In particular:

- Material JSON MUST remain untrusted until validated.
- Descriptor identity MUST be the exact project-relative path under `assets/materials/` with a lowercase `.json` suffix; no serialized material ID may be introduced.
- `schema` MUST be exactly `planaxis-material/1.0`.
- `name` MUST be required and contain at least one non-whitespace character.
- `baseColor`, `roughness`, and `metalness` MUST use ordinary finite JavaScript/TypeScript numbers with the specified `[0, 1]` ranges and normative defaults:
  - `baseColor = [1, 1, 1]`;
  - `roughness = 1`;
  - `metalness = 0`.
- `maps`, when present, MUST be non-empty and contain only `baseColor`, `roughness`, `metalness`, and `normal`.
- `mapping` MUST be present exactly when `maps` is present.
- `mapping.widthCm` and `mapping.heightCm` MUST be finite numbers strictly greater than zero. `Decimal` MUST NOT be introduced for Material Format numeric values.
- Texture references MUST be canonical project-relative paths under `assets/materials/` and use only lowercase `.png`, `.jpg`, `.jpeg`, or `.webp` extensions.
- Texture references MAY point anywhere under `assets/materials/`; they are not required to be siblings of the descriptor and the same resource MAY be reused by multiple map roles.
- Validation MUST NOT check texture existence, file bytes, image dimensions, decoding, or renderer compatibility.
- Alpha MUST support exactly the specified `opaque`, `mask`, and `blend` closed-object variants, including default opacity `1` where defined and required mask `cutoff`.
- The public API MUST make normative defaults available deterministically without mutating or rewriting the validated durable document. Exact API/type names may follow repository conventions.
- Map roles and alpha variants MUST remain explicit in trusted types so later integration can apply the normative color/channel/orientation semantics without guessing.
- Normal validation failures MUST be structured expected outcomes rather than generic thrown exceptions.

## Technical and Architectural Constraints

`@planaxis/material` is a pure shared format/domain package.

It MUST NOT depend on:

```text
apps/server
apps/web
@planaxis/renderer-three
React
Three.js
Node.js filesystem APIs
```

No dependency on `@planaxis/design` or `@planaxis/model-3d` is expected; Material Format 1.0 is independently versioned and does not require architectural or finish-target data.

Do not move project-filesystem security/path-resolution responsibility into this package. Lexical project-relative path validation required by Material Format may be implemented locally according to the normative specifications rather than refactoring unrelated server infrastructure.

No new third-party runtime dependency is expected.

## Files and Areas Expected to Change

Expected areas include:

```text
packages/material/
README.md
docs/architecture/overview.md
pnpm-lock.yaml
```

Other workspace configuration may change only as required by established monorepo conventions.

Do not modify any file under:

```text
docs/tasks/
```

Do not modify normative specifications as part of this implementation. If a real specification conflict is discovered, report it rather than silently changing the contract.

## Testing Requirements

Add focused automated tests covering at least:

- minimal and complete valid Material 1.0 descriptors;
- descriptor paths under `assets/materials/` and invalid descriptor identities;
- required `schema` and non-blank `name`;
- recursively closed objects and unknown-property rejection;
- scalar boundary values, invalid/non-finite values, and normative defaults;
- `baseColor` tuple length/component validation;
- `maps`/`mapping` presence coupling and non-empty maps;
- positive finite physical texture dimensions;
- valid PNG/JPEG/WebP project-relative texture paths;
- unsupported, uppercase, traversal, absolute, backslash, dot-segment, and out-of-scope texture paths;
- reuse of one texture path by multiple map roles;
- all valid alpha modes, alpha defaults, required mask cutoff, invalid ranges, and invalid variant properties;
- JSON syntax failures versus Material Format validation failures;
- deterministic effective/defaulted interpretation without mutating validated durable data.

Tests MUST require no filesystem, browser, image decoder, GPU, or network access.

## Documentation Requirements

Update only implementation-status documentation made inaccurate by the new package.

At minimum, review and update as needed:

```text
README.md
docs/architecture/overview.md
```

Keep normative Material Format semantics in `docs/specifications/planaxis-material/1.0.md` rather than duplicating them extensively.

## Verification

Run:

```bash
pnpm --filter @planaxis/material test
pnpm --filter @planaxis/material typecheck
pnpm --filter @planaxis/material build
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm outdated --recursive
pnpm install --frozen-lockfile
```

Do not report a command as successful unless it actually completed successfully.

## Acceptance Criteria

The task is complete when:

1. `@planaxis/material` exists as a buildable, tested workspace package with a deliberate public API;
2. Material 1.0 JSON and descriptor paths are validated according to the normative specification;
3. trusted material data remains renderer-, filesystem-, browser-, React-, and Three.js-independent;
4. scalar/alpha defaults are available deterministically without rewriting durable descriptor data;
5. map/mapping rules, physical dimensions, supported texture paths, and alpha variants are enforced;
6. project-resource existence, image decoding, and renderer adaptation remain separate later stages;
7. structured validation failures and focused tests cover valid, invalid, boundary, and defaulting behavior;
8. relevant implementation-status documentation is updated without changing the accepted specifications;
9. required repository verification passes;
10. no out-of-scope server, browser, renderer, material-management, or assignment-orientation behavior is introduced.

## Final Response

Provide a concise execution report containing:

1. implementation summary;
2. main files/areas changed;
3. tests added or updated;
4. verification commands actually run and their results;
5. dependency changes, including any intentional version exceptions;
6. deviations from this description, or `None`;
7. follow-up items, or `None`;
8. a suggested Conventional Commits message including:

```text
Task: TASK-031
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.
