# TASK-034: Implement Material 1.1 Ambient Occlusion

## Context

PlanAxis currently implements PlanAxis Material Format 1.0 end to end: persistent material validation, browser material loading, renderer-independent runtime PBR adaptation, and Three.js rendering.

PlanAxis Material Format 1.1 is now the latest accepted material specification. It extends Material 1.0 with optional ambient-occlusion support through `maps.ambientOcclusion` and `ambientOcclusionStrength`.

This task implements that accepted 1.1 capability while preserving existing Material 1.0 projects.

## Required Reading

Before making changes, read and follow:

```text
AGENTS.md
docs/specifications/planaxis-material/1.0.md
docs/specifications/planaxis-material/1.1.md
docs/architecture/overview.md
docs/development/coding-guidelines.md
docs/development/testing.md
docs/decisions/ADR-002-react-browser-ui.md
docs/decisions/ADR-003-three-renderer-architecture.md
```

Inspect the existing material pipeline under:

```text
packages/material/
packages/model-3d/
apps/web/
packages/renderer-three/
```

Do not read any other file under `docs/tasks/`.

## Goal

Implement PlanAxis Material Format 1.1 ambient-occlusion support from persistent descriptor validation through browser/runtime adaptation to Three.js rendering, while continuing to accept and render conforming Material 1.0 descriptors unchanged.

## Scope

The task includes:

- extend `@planaxis/material` to support both `planaxis-material/1.0` and `planaxis-material/1.1`;
- implement the Material 1.1 `maps.ambientOcclusion` and `ambientOcclusionStrength` semantics defined by the normative specification;
- preserve Material 1.0 validation and effective behavior;
- extend the renderer-independent runtime PBR contract with ambient-occlusion texture and strength data;
- translate effective Material 1.1 ambient-occlusion semantics in the browser material-loading pipeline;
- adapt ambient occlusion to Three.js using the existing physical texture mapping;
- preserve deduplication and packed-texture reuse, including ORM resources;
- add focused material, runtime, browser, and renderer tests;
- update current-state documentation after Material 1.1 support is implemented.

## Out of Scope

This task does **not** include:

- changes to the Material 1.0 or Material 1.1 normative specifications;
- server material API or project-filesystem changes;
- new geometry, tessellation, UV generation, or secondary UV sets;
- height, displacement, bump, parallax, emissive, clearcoat, anisotropy, sheen, transmission, or other new material features;
- material-management or material-editing UI;
- automatic migration or rewriting of Material 1.0 descriptors;
- changes to Design Format or Project Format;
- new third-party runtime dependencies.

## Functional Requirements

### Material format compatibility

The public material parsing/validation flow MUST accept both supported schemas:

```text
planaxis-material/1.0
planaxis-material/1.1
```

Material 1.0 documents MUST retain their existing semantics and MUST NOT gain Material 1.1-only properties implicitly.

For Material 1.1:

- `maps.ambientOcclusion` is an optional supported texture role;
- the ambient-occlusion value is non-color data read from the red channel;
- `ambientOcclusionStrength`, when present, must be finite and in `[0, 1]`;
- `ambientOcclusionStrength` is valid only when `maps.ambientOcclusion` exists;
- when the AO map exists and strength is omitted, effective strength is `1`;
- when the AO map does not exist, there is no effective AO strength state;
- all existing map/mapping coupling, path, physical-period, orientation, and closed-schema rules remain in force.

The effective semantics must follow Material 1.1 exactly:

```text
effectiveAO = 1 - ambientOcclusionStrength * (1 - aoSample)
```

### Runtime and browser adaptation

Extend the renderer-independent runtime PBR vocabulary only as needed to represent:

- an optional ambient-occlusion texture reference;
- its effective strength.

Runtime validation MUST reject invalid AO strength values.

The browser material loader MUST:

- preserve Material 1.0 behavior;
- translate Material 1.1 AO map and effective strength into the runtime contract;
- continue fetching and decoding each distinct texture resource at most once per selected-design load;
- support the same texture resource serving AO, roughness, and metalness roles for packed ORM textures;
- preserve existing cancellation, all-or-nothing fallback, and resource-cleanup behavior.

### Three.js adaptation

The Three.js adapter MUST map the runtime AO data to the existing standard PBR material facilities:

- ambient-occlusion texture as non-color data;
- red-channel AO semantics;
- `ambientOcclusionStrength` as the renderer AO intensity;
- texture UV channel `0`, using the same existing physical UV mapping as all other material maps;
- existing repeat wrapping and identity texture transforms.

Do not add or duplicate geometry UV attributes solely for AO.

Renderer-specific Three.js details MUST remain inside `@planaxis/renderer-three`.

### Backward compatibility

Existing conforming Material 1.0 descriptors and tests MUST remain supported.

No migration, file rewrite, schema reinterpretation, or behavioral regression is permitted merely because Material 1.1 support is added.

## Technical and Architectural Constraints

Keep the established responsibility split:

```text
@planaxis/material
  persistent Material 1.0 / 1.1 validation and effective semantics

@planaxis/model-3d
  renderer-independent runtime PBR contract

apps/web
  resource orchestration and persistent-to-runtime translation

@planaxis/renderer-three
  Three.js texture/material adaptation and resource ownership
```

Do not duplicate persistent Material Format validation outside `@planaxis/material`.

Do not leak Three.js types or renderer-specific AO concepts into persistent material contracts.

Reuse the existing physical mapping and texture-preparation pipeline; no new dependency is expected.

Do not modify any file under `docs/tasks/`.

## Files and Areas Expected to Change

Expected areas include:

```text
packages/material/
packages/model-3d/
apps/web/
packages/renderer-three/
README.md
docs/architecture/overview.md
```

No server change is expected.

## Dependencies

No new dependency is expected.

If a dependency change becomes necessary, follow `docs/development/coding-guidelines.md` and report the reason and selected version in the final response.

## Testing Requirements

Add or update focused automated coverage for:

- Material 1.0 descriptors remaining valid and unchanged;
- Material 1.1 scalar-only descriptors;
- Material 1.1 AO map with omitted strength defaulting effectively to `1`;
- explicit AO strengths at `0`, intermediate values, and `1`;
- invalid AO strength values;
- `ambientOcclusionStrength` without `maps.ambientOcclusion`;
- AO map path and map/mapping validation;
- packed ORM reuse of one texture for AO, roughness, and metalness;
- runtime AO strength validation;
- browser translation of AO texture and effective strength;
- AO texture deduplication and existing resource cleanup/cancellation behavior;
- Three.js AO map configuration as non-color data on UV channel `0`;
- renderer AO intensity mapping;
- existing Material 1.0 rendering and alpha/map behavior remaining compatible.

Tests must not require an external network, real user project, or GPU device.

## Documentation Requirements

Update current-state documentation so it no longer states that Material 1.1 ambient-occlusion support is accepted but unimplemented.

At minimum review and update as needed:

```text
README.md
docs/architecture/overview.md
```

Keep Material 1.0 documented as a supported earlier schema.

## Verification

Run focused tests during development, then run:

```bash
pnpm --filter @planaxis/material test
pnpm --filter @planaxis/model-3d test
pnpm --filter @planaxis/web test
pnpm --filter @planaxis/renderer-three test
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Do not report a command as successful unless it actually completed successfully.

## Acceptance Criteria

The task is complete when:

1. `@planaxis/material` supports both Material 1.0 and 1.1 without weakening either schema;
2. Material 1.1 AO map, strength, defaulting, coupling, channel, and physical-mapping semantics match the normative specification;
3. Material 1.1 AO data reaches the renderer-independent runtime contract and selected-design browser pipeline;
4. Three.js renders AO through its standard AO map/intensity facilities using the existing physical UV mapping and non-color texture handling;
5. packed ORM resources remain deduplicated and usable across AO/roughness/metalness roles;
6. existing Material 1.0 behavior remains compatible;
7. focused tests and repository verification pass;
8. README and architecture documentation describe Material 1.1 AO support as implemented;
9. no server, geometry/UV, height/displacement, material-management, or other out-of-scope feature is introduced.

## Final Response

Provide a concise execution report containing:

1. implementation summary;
2. main files/areas changed;
3. tests added or updated;
4. verification commands actually run and their results;
5. dependency changes, or `None`;
6. deviations from this description, or `None`;
7. follow-up items, or `None`;
8. a suggested Conventional Commits message including:

```text
Task: TASK-034
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.
