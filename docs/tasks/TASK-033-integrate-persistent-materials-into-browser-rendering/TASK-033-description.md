# TASK-033: Integrate Persistent Materials into Browser Rendering

## Context

Phase 3 now has both persistence-side foundations:

- TASK-031 implemented PlanAxis Material Format 1.0 in `@planaxis/material`;
- TASK-032 added controlled read-only server access to material descriptors and supported texture resources.

Phase 1 already provides renderer-independent finish targets, physical mapping frames, `RuntimePbrMaterial`, `RuntimeFinishAssignments`, and Three.js adaptation of transient PBR materials. Phase 2 provides selected Design 1.0 scenarios whose finish assignments reference project-local material resources.

This final Phase 3 task connects those pieces so a selected design can render its persistent Material 1.0 finishes.

## Required Reading

Before making changes, read and follow:

```text
AGENTS.md
docs/specifications/planaxis-material/1.0.md
docs/specifications/planaxis-design/1.0.md
docs/specifications/planaxis-project/1.0.md
docs/architecture/overview.md
docs/development/coding-guidelines.md
docs/development/testing.md
docs/decisions/ADR-002-react-browser-ui.md
docs/decisions/ADR-003-three-renderer-architecture.md
docs/decisions/ADR-004-filesystem-backed-projects.md
```

Inspect the existing public contracts and relevant implementation under:

```text
packages/material/
packages/model-3d/
packages/renderer-three/
apps/web/
```

Do not read any other file under `docs/tasks/`.

## Goal

Load the materials referenced by a successfully resolved selected Design 1.0 scenario, resolve and validate their texture resources, translate them into the existing renderer-independent runtime PBR contract, and render them on architectural finish targets with correct physical texture scale and Material 1.0 semantics.

## Scope

The task includes:

- add browser access to the TASK-032 material descriptor and texture endpoints, including development Vite proxy coverage;
- after successful design/architecture resolution, load each distinct referenced material descriptor;
- parse and validate descriptors with `@planaxis/material`;
- load each distinct referenced texture resource;
- validate supported texture content and decode/load it for Three.js use;
- translate effective Material 1.0 semantics into `RuntimePbrMaterial` / `RuntimeFinishAssignments`;
- apply the resulting assignments through the existing renderer finish-target pipeline;
- preserve Material 1.0 physical texture dimensions and mapping orientation;
- manage asynchronous loading, cancellation, deduplication, replacement, and GPU/image resource cleanup safely;
- provide useful material-resolution diagnostics while keeping valid architecture inspectable;
- add focused browser and renderer tests;
- update implementation-status documentation to mark Phase 3 complete.

## Material Resolution Flow

For a selected design, processing MUST preserve these stages:

```text
Design 1.0 format validation
    ↓
bound architecture load + Apartment SVG validation
    ↓
Design architecture / finish-target resolution
    ↓
Material descriptor resource load
    ↓
Material 1.0 parse / validation
    ↓
texture resource load + supported-content/decode validation
    ↓
runtime PBR adaptation
    ↓
Three.js rendering
```

Material loading MUST begin only after the design resolves successfully against the validated architecture.

A design with no `finishes` requires no material-resource requests.

## Functional Requirements

### Descriptor and texture loading

For every material path referenced by the resolved design:

- fetch it through `GET /api/project/material?path=...`;
- parse it with `parseMaterialDescriptor(...)` using the exact Design 1.0 material reference as descriptor identity;
- use Material 1.0 effective/defaulted semantics rather than inventing browser or renderer defaults.

For every texture path referenced by the validated materials:

- fetch it through `GET /api/project/material-texture?path=...`;
- require the resource content to be a supported PNG, JPEG, or WebP image consistent with its supported filename extension (`.jpg` and `.jpeg` are both JPEG);
- treat unsupported/mismatched content separately from ordinary image decode/loading failure.

The same descriptor path MUST be loaded at most once per selected-design load.

The same texture path MUST be fetched/decoded at most once per selected-design load, even when:

- multiple finish assignments use the same material;
- multiple materials reference the same texture;
- one packed texture is used for multiple map roles.

No persistent/global material cache is required.

### Runtime material translation

Translate each validated material to the existing renderer-independent runtime PBR contract.

The translation MUST preserve:

- effective `baseColor`;
- effective `roughness`;
- effective `metalness`;
- effective alpha mode, opacity, and mask cutoff;
- physical `mapping.widthCm` and `mapping.heightCm`;
- base-color, roughness, metalness, and normal map roles;
- shared map period and orientation.

Material Format numeric dimensions use ordinary JSON-number semantics. Any conversion required by the existing runtime physical-mapping type is an adaptation concern and MUST NOT change the persistent Material 1.0 contract.

Design finish-target IDs MUST map to the corresponding runtime assignments without introducing another persistent assignment model. Existing base-target / space-override precedence in the runtime finish pipeline must remain intact.

### Texture semantics

The renderer adaptation MUST continue to implement Material 1.0 semantics:

- base-color maps use sRGB color data;
- roughness maps use non-color data and the green channel;
- metalness maps use non-color data and the blue channel;
- normal maps use non-color tangent-space data with `+X = +U`, `+Y = +V`, and `+Z = outward`;
- one full texture repetition represents `widthCm × heightCm`;
- repeat wrapping is allowed and no persistent offset, rotation, mirroring, or other transform is introduced;
- opaque mode ignores source alpha;
- mask mode applies source alpha × opacity and the configured cutoff;
- blend mode applies source alpha × opacity.

Image upload/decoding conventions MUST preserve Material 1.0 image-right = `+U` and image-up = `+V`; do not silently invert the normal-map Y direction.

### Renderer ownership and async preparation

Three.js objects, decoded renderer texture resources, texture configuration, and GPU-resource lifecycle MUST remain owned by `@planaxis/renderer-three` in accordance with ADR-003.

The browser application MAY orchestrate resource fetching and hold renderer-neutral fetched bytes/resources, but it MUST NOT import or construct Three.js objects directly.

The existing synchronous runtime texture resolver may be retained or minimally evolved as needed. Exact helper/API names are not prescribed, but asynchronous texture preparation MUST complete before mapped finishes are supplied to `setModel`.

Any renderer-side source texture/image resources created during preparation MUST have an explicit owner and MUST be disposed when they are no longer needed, including after partial failure.

### Failure behavior

Persistent material application for one selected-design load is all-or-nothing.

If any referenced material descriptor or texture fails to resolve, validate, load, decode, or prepare:

- do not partially apply persistent finish assignments;
- keep the successfully validated architecture visible with the renderer's neutral/default finishes;
- preserve and apply valid Design 1.0 presentation settings such as tone mapping and exposure;
- expose a safe diagnostic that distinguishes the failure class as far as practical.

At minimum, keep distinct user/developer diagnostics for:

- material descriptor project/API resource failure;
- Material JSON/Material 1.0 validation failure;
- texture project/API resource failure;
- unsupported or mismatched texture content;
- texture decode/loading failure;
- renderer adaptation/rendering failure.

Do not expose physical project paths, raw transport exceptions, or other unsafe machine-local details.

A material failure MUST NOT be reported as a Design Format or Apartment SVG validation failure.

Unassigned finish targets remain neutral.

### Selection and lifecycle behavior

Material loading participates in the existing selected-design generation/cancellation lifecycle.

When the user selects another design, clears the selection, or unmounts the workflow:

- obsolete in-flight descriptor/texture requests MUST be aborted or ignored;
- late completions MUST NOT overwrite the newer selection;
- prepared renderer resources belonging only to the obsolete selection MUST be released;
- active architecture / no-design behavior must remain unchanged.

Design editing in this phase continues to preserve existing finish assignments; no material assignment editor is introduced.

## Technical and Architectural Constraints

Use `@planaxis/material` as the source of Material 1.0 format validation and defaults. Do not duplicate its structural schema in `apps/web` or `@planaxis/renderer-three`.

Keep the concerns separated:

```text
apps/web
  orchestration, HTTP fetches, selected-design lifecycle,
  persistent-material -> runtime assignment translation

@planaxis/material
  persistent format validation and effective semantics

@planaxis/model-3d
  renderer-independent runtime PBR / finish-target contract

@planaxis/renderer-three
  image/texture preparation as required by Three.js,
  renderer adaptation, configured texture clones, GPU/resource cleanup
```

A small renderer-independent browser adapter may be introduced where useful.

Do not move persistent Material Format semantics into `@planaxis/model-3d`, and do not make `@planaxis/material` depend on Three.js or applications.

Avoid changing the established Phase 1 runtime material API unless a concrete integration need requires a minimal compatible evolution.

No new third-party runtime dependency is expected.

## Out of Scope

This task does **not** include:

- material discovery/catalog UI;
- material create/update/delete/import APIs or UI;
- assigning/changing materials from the browser;
- assignment-level texture rotation, mirroring, scale, or offset;
- file watching or automatic hot reload after external project-file edits;
- global/persistent asset caching;
- AI material extraction or generation;
- ambient-occlusion, displacement, emissive, clearcoat, anisotropy, sheen, transmission, or other Material 1.0-excluded properties;
- environment-map assets, lighting-design features, furniture/model assets, or post-processing;
- changes to Material Format 1.0, Design Format 1.0, or Project Format 1.0.

Manual editing of project JSON and texture files followed by normal design re-selection/reload is sufficient for Phase 3.

## Files and Areas Expected to Change

Expected areas include:

```text
apps/web/
packages/renderer-three/
```

Workspace dependency manifests and lockfile may change as required for direct dependencies such as `@planaxis/material` or an existing renderer-independent workspace package.

Changes to `packages/model-3d/` should occur only if a minimal runtime integration adjustment is demonstrably necessary.

Also update implementation-status documentation, including as needed:

```text
README.md
docs/architecture/overview.md
```

Do not modify any file under:

```text
docs/tasks/
```

Do not modify normative specifications unless an actual conflict is discovered; report such a conflict instead of silently changing the contract.

## Testing Requirements

Add focused automated coverage for at least:

- Vite proxy access to both material endpoints without broadening unrelated proxy paths;
- a scalar-only material assigned to a valid finish target;
- textured materials using base-color, roughness, metalness, and normal maps;
- physical texture dimensions reaching the existing UV/runtime mapping contract;
- Material 1.0 alpha modes;
- descriptor deduplication across repeated assignments;
- texture fetch/decode deduplication across materials and packed map roles;
- material descriptor project/API failure;
- invalid Material JSON and Material 1.0 validation failure;
- missing texture project/API failure;
- unsupported/mismatched image content;
- image decode/loading failure;
- all-or-nothing fallback to neutral finishes after any material failure;
- presentation overrides still applying when material resolution fails;
- unassigned targets remaining neutral;
- successful runtime assignments reaching `setModel`;
- correct texture role/color-space/wrapping/orientation configuration in the Three.js adapter;
- cleanup of prepared source resources and configured clones on replacement, disposal, abort, and partial failure;
- late material/texture responses not overwriting a newer design selection;
- existing no-design, stale-design, architecture-validation, design-editing, camera, and presentation behavior remaining compatible.

Tests should use small deterministic in-memory or committed test resources as appropriate and must not require an external network, real user project, or GPU device.

## Documentation Requirements

Update current-state documentation so Phase 3 is described as implemented:

- Material 1.0 format validation exists in `@planaxis/material`;
- the server exposes controlled raw descriptor/texture reads;
- the browser resolves selected-design materials;
- Three.js renders persistent PBR finishes with physical scale;
- material-management UI and later richer design features remain future work.

Remove wording that says persistent material rendering is still pending.

## Verification

Run focused tests during development, then run:

```bash
pnpm --filter @planaxis/web test
pnpm --filter @planaxis/web typecheck
pnpm --filter @planaxis/web build
pnpm --filter @planaxis/renderer-three test
pnpm --filter @planaxis/renderer-three typecheck
pnpm --filter @planaxis/renderer-three build
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

If dependency manifests or the lockfile change, also perform the dependency verification required by `docs/development/coding-guidelines.md`.

Do not report a command as successful unless it actually completed successfully.

## Acceptance Criteria

The task is complete when:

1. a selected, architecture-resolved Design 1.0 scenario loads its distinct referenced Material 1.0 descriptors through the controlled server API;
2. all referenced texture resources are fetched, supported-content checked, decoded/prepared, and deduplicated for the selected load;
3. effective persistent material semantics are translated into the existing renderer-independent runtime finish assignments;
4. assigned architectural surfaces render Material 1.0 scalar/map/alpha semantics at the specified physical texture scale and orientation;
5. Three.js-specific texture creation/configuration and resource ownership remain inside `@planaxis/renderer-three`;
6. any material/texture failure causes neutral all-or-nothing finish fallback while valid architecture and design presentation remain usable;
7. diagnostics preserve the distinction between Design, architecture, material-format, resource, texture, and renderer failures;
8. asynchronous selection changes cannot apply stale materials and obsolete resources are cleaned up;
9. no material-management UI, write API, assignment transform, or unrelated Phase 4+ behavior is introduced;
10. focused browser/renderer tests and repository verification pass;
11. README and architecture documentation describe Phase 3 as completed.

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
Task: TASK-033
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.
