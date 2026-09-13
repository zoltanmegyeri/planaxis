# TASK-026: Add Texture-Capable PBR Surface Rendering

## Context

TASK-025 established exact renderer-independent architectural surfaces and stable finish-target identities in `@planaxis/model-3d`. Base targets cover floor, ceiling, wall sides, and opening reveals; space-scoped targets describe more-specific floor, ceiling, and wall-side coverage with explicit fallback to their base targets.

The Three.js renderer consumes those surfaces but still uses neutral whole-category materials and generates no UV coordinates. Window glass remains a simple transparent plane.

The next Phase 1 step is to make the surface pipeline capable of deterministic physically scaled texture mapping and runtime PBR finish assignment without defining the future persistent material-asset format.

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

Add deterministic physical texture mapping and texture-capable metallic/roughness PBR rendering for TASK-025 finish targets.

The implementation must allow transient runtime material assignments to base and space-scoped finish targets, preserve physical texture scale and orientation across disconnected patches, and improve window glass using physically based Three.js rendering.

Do not define persistent material assets or design scenarios in this task.

## Scope

The task includes:

- extending the renderer-independent surface foundation with deterministic physical texture-mapping frames;
- generating Three.js UV attributes from those mappings at the renderer boundary;
- defining a small renderer-independent **runtime-only** PBR material vocabulary;
- supporting transient material assignment keyed by TASK-025 `FinishTargetId`;
- resolving space-scoped assignments before their base-target fallback;
- rendering base-color, roughness, metalness, and normal texture maps;
- supporting physically meaningful texture dimensions rather than object-relative repeat counts;
- ensuring one finish target keeps continuous mapping across disconnected surface patches and around openings;
- ensuring space-scoped coverage uses the same base mapping frame so the same material aligns seamlessly across base/override boundaries;
- partitioning/tessellating render geometry as needed so different effective finish assignments do not rely on overlapping coplanar meshes;
- preserving existing neutral materials when no runtime assignment is supplied;
- upgrading window glass from simple alpha transparency to an appropriate physically based transmissive material;
- adding focused automated tests for mapping, UVs, material resolution, physical scale, texture map configuration, and glass;
- updating current-state documentation.

## Out of Scope

This task does **not** include:

- `planaxis-material/1.0` or any other persistent material descriptor specification;
- project-relative material/texture asset paths;
- material import or asset-management UI;
- material catalogs or a global asset warehouse;
- design-scenario persistence;
- browser controls for choosing finishes;
- server APIs for materials or arbitrary project resources;
- image-based/environment lighting;
- exposure or tone-mapping controls;
- photorealistic rendering;
- window-frame/sash geometry;
- invented pane thickness, glazing layers, or manufacturer-specific optical construction;
- changing Apartment SVG 2.2 material semantics;
- adding visual-design state to `ArchitecturalModel3D`.

Do not turn transient runtime material inputs into a persistence format.

## Functional and Architectural Requirements

### Renderer-independent physical mapping frames

Physical texture-mapping semantics must remain independent of Three.js.

Extend the TASK-025 surface/finish-target foundation with a deterministic mapping frame suitable for material-bearing base targets.

The renderer-independent contract must describe, in exact PlanAxis model coordinates:

- a stable mapping origin;
- a +U direction;
- a +V direction;
- physical U/V distances in centimeters.

Do not store Three.js `Vector2`, UV buffer attributes, triangles, or renderer-number coordinates in `ArchitecturalModel3D` or its derived surface model.

Space-scoped targets must inherit/use the mapping frame of their base target rather than creating an independent origin.

A target's mapping must be invariant under renderer triangulation, patch ordering, opening subdivision, or space-override subdivision.

### Mapping orientation

Use deterministic architectural orientation.

For horizontal surfaces:

```text
floor:
    U = +X
    V = +Y
    normal = +Z

ceiling:
    choose the corresponding interior-facing frame
    so U × V = -Z
```

The floor/ceiling mapping origin must be tied to the apartment model coordinate system, not to individual triangulated patches or spaces.

For every vertical material-bearing surface:

```text
V = +Z
U × V = outward surface normal
```

This applies to wall sides and vertical opening reveals.

Consequently, opposite wall sides receive opposite longitudinal U directions when required to avoid mirrored face-on mapping.

For horizontal reveal faces, use the same normal-oriented rule as other horizontal surfaces.

The implementation may expose reusable exact helpers rather than duplicating per-surface formulas.

### Physical scale and UV generation

The material vocabulary must express texture size in physical units.

Use centimeters in the renderer-independent runtime contract, consistent with PlanAxis architectural units.

For a texture whose physical repeat size is:

```text
widthCm
heightCm
```

the Three.js UV mapping must be derived conceptually as:

```text
u = physicalUDistanceCm / widthCm
v = physicalVDistanceCm / heightCm
```

so one complete texture repeat represents the declared physical size.

Do not use object-size-relative repeat values as the source of truth.

Negative or greater-than-one UV values are valid; the renderer must configure mapped textures for repeat wrapping where applicable.

Texture mapping must remain continuous across disconnected patches belonging to the same finish target. A window or door opening must not restart the wall texture on each resulting patch.


### Runtime PBR material vocabulary

Introduce a small renderer-independent runtime material contract broadly aligned with metallic/roughness PBR.

It must support at least:

- base color;
- roughness;
- metalness;
- optional base-color map;
- optional roughness map;
- optional metalness map;
- optional tangent-space normal map;
- physical texture width/height for mapped textures;
- opacity/alpha behavior needed for ordinary non-glass surface materials.

Use sensible validation/types for scalar ranges such as roughness and metalness.

The contract must contain no Three.js material or texture objects and must not be stored in `ArchitecturalModel3D`.

Texture map references in this task are transient runtime references only. They must not acquire project-path or persistent-asset semantics. Use an explicit renderer-side resolution/loading boundary so tests can use deterministic in-memory fixtures without network access.

Do not define asset IDs, JSON schema, filenames, project directories, or versioning for these runtime descriptors.

### Texture color-space semantics

Configure maps according to their physical meaning:

- base-color textures are color data and must use the appropriate sRGB/color-space handling;
- roughness, metalness, and normal maps are non-color data and must not receive sRGB color interpretation.

The renderer must configure all maps belonging to one material consistently with the declared physical dimensions and mapping orientation.

### Finish assignment and fallback

Allow callers to supply a transient mapping conceptually equivalent to:

```text
FinishTargetId -> RuntimePbrMaterial
```

Exact API names may follow repository conventions.

Material resolution must follow TASK-025 semantics:

```text
explicit space-scoped assignment
    -> if absent, base-target assignment
    -> if absent, existing neutral renderer default
```

Reveal targets are base targets only in this phase.

The renderer must be able to apply different effective materials to different finish-target coverage regions without drawing duplicate coplanar physical surfaces.

Space coverage must therefore participate in deterministic render partitioning/tessellation or equivalent non-overlapping draw grouping.

Do not implement overrides by placing a second coincident mesh slightly above a base floor/wall.

If one space-scoped target consists of multiple disconnected coverage patches, all patches use the same resolved material and mapping frame.

### Renderer integration

`@planaxis/renderer-three` remains responsible for:

- conversion from centimeters to meters;
- tessellation/triangulation;
- UV buffer generation;
- Three.js texture creation/configuration;
- `MeshStandardMaterial` / `MeshPhysicalMaterial` adaptation as appropriate;
- GPU resource ownership and disposal.

Reuse finish-target identity and exact mapping semantics from `@planaxis/model-3d`; do not reconstruct those semantics from mesh geometry.

All created textures/materials must participate in explicit renderer disposal.

Existing camera, navigation, shadows, source grouping/selection, and event-driven renderer lifecycle must remain compatible.

### Neutral defaults

When no runtime material assignment is provided, rendered architecture should remain visually compatible with the current neutral appearance.

The new material pipeline must not require material assets merely to open and inspect an Apartment SVG.

Fixed elements and utility markers may remain on their existing neutral renderer materials unless required by the refactor.

### Improved window glass

Replace the current simple low-opacity `MeshStandardMaterial` glass with a physically based transmissive Three.js material appropriate to the existing zero-thickness window plane.

Requirements:

- preserve the current architectural window geometry; do not invent pane thickness;
- use transmission/refraction-oriented physical material capabilities supported by the repository's WebGPU-first Three.js path;
- keep deterministic renderer defaults;
- use Apartment SVG `glassType` (`clear`, `frosted`, `tinted`, `other`) only where it provides justified semantic guidance;
- do not invent exact manufacturer properties;
- keep glass resource lifecycle/disposal correct.

The result may still look limited before TASK-027 introduces environment lighting. This task establishes correct material capability, not final photorealism.

## Expected Areas

Expected changes are primarily under:

```text
packages/model-3d/src/
packages/model-3d/test/
packages/renderer-three/src/
packages/renderer-three/test/
README.md
docs/architecture/overview.md
```

`apps/web` should change only if required to preserve/adapt the existing renderer API; no material-selection UI is expected.

Avoid unrelated server/project changes.

## Testing Requirements

Add focused automated coverage for at least:

- stable mapping frames for floor and ceiling;
- X-axis and Y-axis wall sides using `V = +Z` and the correct non-mirrored U direction;
- vertical and horizontal reveal mapping orientation;
- space-scoped targets reusing their base target's mapping frame;
- wall mapping remaining continuous across opening-split patches;
- UV generation matching physical centimeter distances and declared texture size;
- UV mapping not restarting at per-patch or per-space origins;
- different physical texture dimensions producing the expected repeat density;
- material-resolution precedence: space assignment, then base assignment, then neutral default;
- non-overlapping render partitioning for space-specific floor/ceiling/wall finishes;
- deterministic handling of multiple disconnected coverage patches;
- base-color map color-space configuration;
- roughness/metalness/normal maps treated as non-color data;
- texture repeat wrapping and resource disposal;
- existing no-assignment neutral rendering;
- improved clear/frosted/tinted glass using the intended physical material family without invented geometry;
- existing renderer/browser behavior remaining protected by the current suite.

Use deterministic in-memory/test texture sources. Routine tests must not require external network resources.

## Documentation Requirements

Update current-state documentation so it describes:

- exact renderer-independent physical surface mapping as implemented;
- Three.js UV generation at the renderer boundary;
- transient texture-capable runtime PBR finish assignment;
- physical texture dimensions/repeat scale;
- improved transmissive glass;
- persistent material assets/design scenarios, IBL, exposure, and tone mapping as future work.

Do not describe the transient runtime material contract as `planaxis-material/1.0`.

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

1. TASK-025 material-bearing surfaces expose stable renderer-independent physical mapping frames;
2. space-scoped targets use their base target's mapping frame and do not introduce mapping seams;
3. Three.js geometry receives deterministic UVs derived from physical centimeter distances;
4. texture repeat is controlled by declared physical texture dimensions rather than object-relative repeat counts;
5. a renderer-independent runtime metallic/roughness PBR vocabulary supports base color, roughness, metalness, and base-color/roughness/metalness/normal maps without becoming a persistence format;
6. transient assignments resolve space target -> base target -> neutral default and render without duplicate coplanar override meshes;
7. texture color-space, wrapping, and disposal behavior is correct and tested;
8. window glass uses an appropriate physically based transmissive material while preserving existing architectural geometry;
9. no persistent material format, project asset API, design scenario, IBL, exposure, or tone-mapping functionality is introduced;
10. repository verification and focused automated tests pass;
11. documentation accurately describes the implemented Phase 1 PBR/texture foundation and remaining work.

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
Task: TASK-026
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.
