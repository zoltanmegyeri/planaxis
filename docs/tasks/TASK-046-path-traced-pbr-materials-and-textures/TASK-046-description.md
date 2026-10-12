# TASK-046: Opaque PBR materials and textures for path tracing

## Context

PlanAxis already loads Material 1.0/1.1 descriptors and PNG/JPEG/WebP resources through controlled project APIs, resolves Design 1.0/1.1 finish assignments, and renders metallic/roughness PBR finishes in the default Interactive view. Material 1.1 adds ambient-occlusion maps and strength to the compatible Material 1.0 contract. The existing architectural surface adapter supplies physically scaled UVs, stable mapping frames, finish partitions, and material groups.

The experimental WebGL2 path tracer reuses those architectural meshes and the existing camera/navigation. TASK-044 introduced Physical Sunny daylight and thin clear-pane transport; TASK-045 added flux-normalized point, spot, linear, and area luminaires with ray occlusion, diffuse indirect light, and visible one-sided source sheets. Their accepted implementation commits are `8c9ba10165a94416f657c0b7f8c90905354f87e5` and `5aeea058a535084857d1cd62e81eb522327aef0a` respectively.

The tracer currently extracts only linear base colors and geometric triangles. It treats opaque finishes as Lambertian and rejects all textures, nonzero metalness, roughness below 0.5, and non-opaque alpha. Existing material assets therefore cannot yet reproduce their texture detail, glossy response, or metallic reflections in that view.

The human maintainer accepted the daylight and luminaire results and prioritized material support. Physical Sunny may remain a restriction. Waiting a minute or longer for a clear static image is acceptable; material correctness, lighting, and occlusion are the acceptance priorities.

## Required Reading

Before implementation, follow the applicable repository-entry preflight in `AGENTS.md`. Read and follow:

```text
AGENTS.md
docs/architecture/overview.md
docs/architecture/daylight-path-tracing.md
docs/development/coding-guidelines.md
docs/development/testing.md
docs/decisions/ADR-002-react-browser-ui.md
docs/decisions/ADR-003-three-renderer-architecture.md
docs/decisions/ADR-004-filesystem-backed-projects.md
docs/specifications/apartment-svg/2.2.md
docs/specifications/planaxis-project/1.0.md
docs/specifications/planaxis-design/1.0.md
docs/specifications/planaxis-design/1.1.md
docs/specifications/planaxis-material/1.0.md
docs/specifications/planaxis-material/1.1.md
packages/renderer-three/src/path-tracing/UPSTREAM.md
```

Read the complete Material 1.0/1.1 property, texture, color-space, physical-mapping, alpha, version-compatibility, and resolution contracts. Read the Design finish-assignment and luminaire rules, and the relevant Apartment SVG surface, opening, level-coordinate, and validation sections. The specifications govern persistent semantics; architecture documentation governs the implemented runtime and supported experimental subset.

Under `docs/tasks/`, read only this exact assigned description. Do not read other task descriptions, records, templates, or process specifications. Earlier task identifiers and commits are historical context, not instructions to browse the task archive.

Inspect existing material loading/preparation, runtime PBR adaptation, surface UV generation, finish partitioning, tracing extraction/BVH/shaders, progressive lifecycle, and relevant tests before editing. Consult official Three.js documentation or primary sampling references as needed for implementation, recording provenance for incorporated code.

## Goal

Allow the experimental path-tracing view to render existing opaque Material 1.0/1.1 finishes using their base-color, roughness, metalness, normal, and ambient-occlusion semantics. Textured wood, plaster, glossy tile, and metal must respond convincingly to the existing Sun, sky, and design luminaires through diffuse and reflective light transport.

Both views must consume the same resolved material assets, finish assignments, and physical mapping. Their lighting algorithms may produce different images; material interpretation and assignment must remain consistent.

## Scope

The task includes:

- extending tracing scene/material data to retain material identity, UVs, and the information needed for normal mapping;
- adapting existing resolved textures into renderer-owned tracing resources;
- opaque metallic/roughness reflection and diffuse transport, including scalar factors and all five defined map roles;
- correct source evaluation/sampling and emission weighting for the expanded surface model;
- supported-input gating, atomic resource replacement, failure handling, and accumulation invalidation;
- focused tests, valid material/project fixtures, real-browser visual evidence, and architecture documentation.

## Out of Scope

The task does not include:

- changes to Apartment SVG, Project, Design, or Material formats, validators, or persistent semantics;
- masked/cutout or blended alpha support in tracing, material transmission, frosted/tinted glazing, solid-volume refraction, or caustics;
- clearcoat, anisotropy, sheen, subsurface scattering, displacement/height maps, emissive materials, or other properties outside Material 1.0/1.1;
- Studio/Overcast tracing, new sky/weather models, environment-map assets, or camera white balance;
- material discovery/import/editing UI, fixture or furniture importing, additional assignment transforms, or new resource APIs;
- denoising, tracing bloom, render export, automatic sample limits, persisted render jobs, or new quality presets;
- replacement of the default renderer, further VXGI development, a general rendering framework, or a wholesale upstream demo port;
- FPS, render-time, or performance benchmarks, and a required convergence deadline.

Correctness/resource-capacity checks and sampling improvements necessary for the required PBR images are within scope. Texture layout and reflection-sampling implementation are engineering choices within the constraints below.

## Functional Requirements

### 1. Existing material and assignment semantics

Reuse the successfully resolved application-to-renderer material boundary. Do not fetch descriptors or arbitrary resource paths from inside the tracer. Preserve Material 1.0 and 1.1 under their declared versions, Design 1.0/1.1 finish resolution, default finishes, base-target assignments, space overrides, and the existing atomic loading policy.

Support opaque materials with or without textures over the full declared `[0, 1]` roughness and metalness ranges. Remove the current tracing exclusions for texture presence, nonzero metalness, and roughness below 0.5 once the corresponding behavior is implemented. Do not silently coerce a glossy/metallic finish into matte or discard a declared map.

Omitted properties retain normative defaults. Effective base color, roughness, and metalness combine their factors and sampled maps according to the applicable specification. Material 1.0 does not acquire Material 1.1 AO fields through implicit migration.

Omitted alpha and explicit opaque alpha are equivalent. Source image alpha must be ignored for opaque visibility. Explicit mask/blend finishes remain unsupported in tracing with a clear availability reason; do not reinterpret them as opaque or clear glass. Unsupported glazing and weather remain explicit, and Interactive remains accessible.

No design or a scenario without finish assignments must replace old finish state with the established neutral/default state. A failed or cancelled replacement must not leave a mixed set of old/new materials or a stale traced image presented as the new scenario.

### 2. Texture roles and linear-light interpretation

Support each role individually and in combination, including a shared packed ORM resource:

| Role | Required interpretation |
| --- | --- |
| Base color | sRGB RGB decoded into linear color, multiplied by the linear base-color factor. |
| Roughness | Green channel as non-color data, multiplied by the roughness factor. |
| Metalness | Blue channel as non-color data, multiplied by the metalness factor. |
| Normal | Non-color tangent-space RGB mapped to `[-1, 1]`, with the normative `+X = +U`, `+Y = +V`, `+Z = outward normal` convention. |
| Ambient occlusion | Red channel as non-color data, using Material 1.1 strength: `1 - strength * (1 - sample)`. |

Keep color factors, texture conversion, transport, HDR accumulation, tone mapping/exposure, and output conversion in their established roles. Do not apply gamma/sRGB conversion to data maps or convert base color twice. Loading one image for multiple roles must preserve each role's interpretation without mutating shared source state.

Apply AO to the material's ambient/indirect contribution according to its specified strength. It must not change base color, direct Sun/lamp visibility, geometric occlusion, or cast-shadow geometry. Strength zero and a white AO map must leave the corresponding AO attenuation absent. Do not drop AO merely because architectural visibility is ray traced.

Reuse the supported PNG, JPEG, and WebP decoding workflow and existing project containment. The supported subset must not depend on a filename-only content assumption, a new image format, or a tracing-specific persistent asset.

### 3. Physical mapping and normal detail

Reuse the existing adapted surface geometry, material groups, finish partitions, and physically scaled mapping. Interpolate UVs at ray hits or otherwise reproduce the established physical frame; do not generate arbitrary per-triangle, bounding-box, or screen-space mapping.

All maps share the material's physical period and orientation even when their pixel resolutions differ. Repetition must handle negative UVs and values above one. Texture phase must remain stable across triangulation, adjoining render patches, openings/reveals, and space-finish partitions that share a finish-target frame. Preserve image-right `+U` and image-up `+V`; do not flip or mirror textures when changing rendering view.

Construct a consistent tangent frame for normal mapping, accounting for the PlanAxis-to-Three.js basis change, surface winding, opposing wall faces, floor/ceiling orientation, and two-sided ray intersections. Neutral normal-map values must reproduce the unperturbed surface; asymmetric test detail must establish that the Y convention is correct.

Keep geometric and shading normals distinct. Normal maps change material response, not architectural geometry, silhouette, wall thickness, collision, or finish-target identity. They must not move ray origins across opaque boundaries or permit below-surface rays to escape an enclosure. Handle grazing/degenerate cases robustly and document numerical choices.

Texture storage and filtering must preserve map alignment, source aspect ratio, channel meaning, and physical scale. Support the existing decoded-image contract and ordinary differing image sizes. Any resampling, mip/filtering policy, padding, or numerical approximation used by the tracer must be documented and visually verified for repetition seams and material detail.

### 4. Metallic/roughness transport

Replace the opaque Lambertian-only branch with a documented energy-conserving metallic/roughness reflection model compatible with the existing standard PBR intent. A GGX/Trowbridge-Reitz microfacet model with Fresnel and appropriate diffuse/specular weighting is an expected foundation; the exact evaluation and sampling method must be explained.

Nonmetals must retain diffuse response and exhibit surface reflections; metals must have the corresponding colored reflective response rather than retaining an inappropriate full diffuse term. Roughness must visibly control reflection spread, including polished and rough variants. Support intermediate metalness and stable behavior at both factor endpoints.

Zero/near-zero roughness must not produce NaNs, infinities, persistent invalid samples, or an unsupported-material rejection. Use a documented stable limiting treatment or numerical regularization and verify its appearance. Do not reintroduce an arbitrary broad roughness threshold or silently replace the whole material with a matte approximation.

Evaluate Sun and sampled local-light contributions against the same surface model used for path continuation. Update throughput and probability accounting for diffuse/glossy lobe selection and directional sampling. Do not apply the old Lambertian `albedo`/`cosine / pi` weight unchanged to glossy/metallic paths.

Preserve expected energy when roughness, metalness, texture factors, or sampling strategy change. Use coherent PDFs/weights and multiple-importance sampling or another valid estimator partition where light sampling and surface paths overlap. The existing diffuse-only emission-collection flag must not discard valid glossy emitter reflections or double count them.

An unobstructed area/linear source must appear in a reflective finish through its actual one-sided emitting geometry. Glossy/metallic surfaces must also reflect surrounding architecture and existing sky/window contributions through real paths. Do not supply reflections using raster screen-space buffers, Studio fill, a fabricated environment, or duplicated proxy lights.

Finite variance and remaining Monte Carlo noise may be documented. Do not hide sampling errors or alter energy with aggressive sample clamping, exposure changes, per-material artistic gains, or a denoiser. Numerical protections must be explicit and justified separately from material behavior.

### 5. Preserve accepted lighting, glazing, and presentation

Retain the current Physical Sunny eligibility, validated location/orientation, day/night simulation, Sun/sky strength, and thin clear/unspecified-pane approximation. Sunny nighttime and mixed daylight/artificial illumination must continue to work.

All four Design 1.1 luminaire types retain the accepted flux/color scale, position/orientation, cone/dimensions, enabled/dimming, source sidedness, finite-segment occlusion, and all-source participation. Material support must not change source power, move lights, invent point/spot bulbs, or make descriptor order a lighting priority.

Keep actual two-sided architectural wall/floor/ceiling/fixed-element occlusion, ray-offset discipline, clear-pane visibility, and bounded traversal failure behavior. The previously accepted concealed-strip bounce route and sealed/thin-wall controls must remain correct with the broader surface model.

Keep progressive linear HDR averaging and current tone mapping, exposure, and sRGB output applied once. Presentation-only edits redraw accumulated samples. Path tracing continues to bypass raster GI, Studio fill/helpers, and bloom. Return to Interactive preserves its camera, daylight, and retained GI/bloom settings.

The default Interactive renderer must preserve its existing PBR/material behavior. Switching view must not mutate borrowed texture transforms, color-space state, finishes, source images, or persistent descriptors.

### 6. Resource ownership, failure, and accumulation

The separate tracing WebGL2 context owns its GPU material/texture resources. Reuse already decoded source images where appropriate; do not treat the Interactive context's GPU allocation as directly shareable. Do not dispose or close borrowed source images while their established owner or another scene still needs them.

Replace tracing material tables, textures, and associated scene data atomically. Deduplicate shared resources where appropriate while retaining role interpretation. Clean up old/partial allocations on replacement, upload/initialization failure, cancelled selection, unmount, and final disposal.

Respect actual device texture/storage/indexing capacity. Every supported effective material and map must participate; no silent truncation or omitted maps is allowed. If a valid resource cannot be represented/uploaded, report an explicit tracing failure through the existing UI, distinct from format/design/architecture validation failure, with Interactive still accessible.

Invalidate accumulated transport whenever effective material assignments, factors, maps, mapping, or normal/AO parameters change. Texture readiness must be synchronized before rendering the new material set. A change while paused clears stale samples and retains pause; resume starts the changed scene from cleared history. Changes must preserve camera/navigation and daylight state.

Preserve existing camera/projection, architecture, light, viewport/DPR, daylight, visibility, 2D/unmount, failure, and disposal behavior. Presentation-only changes and unchanged inputs must not repeatedly rebuild resources or clear history. Progressive work remains limited to the active, eligible, visible, unpaused experiment.

Update supported-subset/help text so it accurately describes opaque PBR support and the remaining alpha/glazing/weather restrictions. Retain the experimental label and current controls; do not add a new material workflow or settings panel.

## Technical and Architectural Constraints

- Preserve validation-before-3D, authoritative exact geometry, and the canonical Apartment SVG. Renderer numeric approximations must not flow back into domain or persistence.
- Keep shader/material sampling, GPU storage, tangent adaptation, tracing meshes, and ownership inside `packages/renderer-three`. React owns application workflow; simulation retains daylight semantics.
- Reuse `RuntimePbrMaterial`, resolved runtime texture references, existing surface mapping, and controlled project APIs. Do not serialize Three.js/GPU/UV-channel state into descriptors.
- Extend the accepted separate WebGL2 backend under ADR-003 without replacing the default WebGPU-first renderer or its supported fallback.
- Keep source and material loading failures separate from structural conformance and architectural validation. Existing atomic design-material behavior remains intact.
- Avoid unrelated refactors, a parallel asset loader, new geometry/decimal engines, or a general renderer/material plugin framework.
- Correctness tests must exercise material evaluation/adaptation, probability/energy behavior, real scene data, and lifecycle. Shader-source string assertions alone are insufficient.
- Do not modify normative specifications or any task artifacts. Refine current-runtime architecture documentation for implemented behavior only.

## Files and Areas Expected to Change

Expected areas include:

```text
packages/renderer-three/src/path-tracing/
packages/renderer-three/src/apartment-renderer.ts
packages/renderer-three/src/runtime-materials.ts
packages/renderer-three/src/prepare-textures.ts
packages/renderer-three/src/surface-geometry.ts
packages/renderer-three/test/
apps/web/src/load-materials.ts
apps/web/src/three-viewport.tsx
apps/web/src/ and apps/web/test/ where tracing eligibility/help is implemented
fixtures/projects/
docs/architecture/daylight-path-tracing.md
docs/architecture/overview.md
docs/decisions/ADR-003-three-renderer-architecture.md
README.md
AGENTS.md
```

This is guidance, not a requirement to change every listed file. Prefer reusing existing UV generation, resource resolution, and material validation unchanged. Preserve earlier evaluation captures as historical evidence.

## Dependencies

No new dependency is expected. Reuse existing Three.js and local tracing infrastructure. Sampling/packing choices must serve this bounded task rather than introduce another application or general renderer.

If a dependency change is demonstrably necessary, follow `AGENTS.md` and the coding guidelines: inspect current registry metadata, evaluate the newest stable major, select the newest non-deprecated mutually compatible stable version, keep versions consistent, and document any evidence-backed exception. Do not guess versions, force installs, ignore peer errors, or add speculative overrides.

Retain existing licenses and upstream provenance. If additional upstream or reference implementation code is incorporated, record the exact source/revision, license, adapted files, and substantive changes in `path-tracing/UPSTREAM.md` or the appropriate provenance document. Explain material evaluation, sampling, and texture storage choices in architecture documentation.

## Testing Requirements

Add focused automated coverage for changed behavior, including:

- opaque Material 1.0/1.1 defaults and factors, all map roles, shared ORM channel use, and no implicit schema migration;
- sRGB factor/base-map conversion exactly once, unmodified non-color data, factor/map multiplication, opaque source-alpha ignoring, and explicit mask/blend rejection;
- physical repeat dimensions, negative/repeated UVs, barycentric mapping, differing image sizes, finish-group selection, base/space overrides, openings/reveals, and continuity across render partitions;
- tangent-space orientation on floor/ceiling and opposing wall faces, neutral/asymmetric normal maps, and geometric-normal separation preventing thin-wall leakage;
- diffuse/specular evaluation and sampling, metalness/roughness endpoints, near-zero stability, lobe/source probability accounting, and energy/normalization checks with meaningful numerical expectations;
- AO strength/defaults/white-map behavior and separation from direct visibility, geometry, and material base color;
- shared-source ownership, atomic replacement, capacity/upload failure, cancellation, cleanup, and unchanged Interactive texture/material state;
- material-input invalidation while active/paused, readiness synchronization, presentation-only redraw, empty/default replacement, supported-subset gating, and existing lighting/navigation lifecycle regressions.

Derive persistent expected semantics from the specifications. Do not duplicate or weaken unchanged parser/validator coverage. Tests must verify behavior beyond reproducing the implementation's formulas; use independent limiting cases, numerical integration/reference expectations, and actual geometry/resources where appropriate.

Create valid, focused project fixtures and scenario descriptors using existing architecture and finish targets. Include small licensed or purpose-generated deterministic texture assets whose color, channel, orientation, and repeat behavior are inspectable. Record third-party asset provenance; do not introduce imported fixture models or new format fields.

The real-browser review matrix must cover:

| Case | Required observation/control |
| --- | --- |
| Textured apartment finishes | Wood floor, painted/plaster surface, and tile/stone use their actual assigned maps at the declared physical scale and orientation in both views. |
| Scalar PBR limits | Nonmetal and metal finishes, rough/polished variants, and zero/near-zero roughness render finite stable output with meaningful response differences. |
| Glossy/metallic reflections | Room/window/sky and visible rectangular-source reflections follow real geometry; roughness changes their spread, and normal detail changes their shape. |
| Normal-map convention | An asymmetric detail pattern shows correct U/V direction on floor, ceiling, and opposing wall faces; neutral-map control preserves the unperturbed response. |
| Independent and packed maps | Roughness, metalness, normal, and AO effects can be isolated; packed ORM and equivalent separate-role assets preserve channel semantics. |
| AO control | Strength zero/white map removes AO attenuation; nontrivial AO affects indirect shading without replacing an opaque cast shadow. |
| Mapping/assignment boundaries | Repetition and phase survive finish partitioning/openings; base and space assignments select the correct materials without reversed images or visible packing seams. |
| Sunny and artificial light | The same material scene works in daytime and Sunny nighttime with the accepted luminaires; mixed light and source reflections coexist. |
| Concealed/occlusion regression | The accepted concealed strip still lights through its open bounce route; lights-off and sealed/thin-wall controls retain expected dark regions. |
| Unsupported and lifecycle cases | Mask/blend and unsupported glazing/weather remain explicit; replacement, pause/resume, presentation redraw, 2D/3D, and return to Interactive remain correct. |

Keep camera, architecture, viewport/DPR, tone mapping/exposure, and lighting fixed for matched material controls. Change one material parameter or role at a time where needed. Interactive comparison verifies assignments/mapping and expected material response, without requiring pixel-identical lighting from different rendering algorithms.

Let each static view accumulate until the required behavior is assessable, commonly around 1024 samples or more if needed. This is a review guideline, not a sample-count or elapsed-time threshold. Do not compensate for incorrect materials by changing exposure between matched controls.

Capture actual browser output and record project/scenario, material variants, camera, zoned date/time, presentation, viewport/DPR, sample count, backend, and remaining noise/approximations. Existing accepted daylight/luminaire fixtures must be revisited for relevant regression controls. Mocked GPU tests establish contracts/lifecycle; real shader appearance requires separate browser evidence.

## Documentation Requirements

Update `docs/architecture/daylight-path-tracing.md` with opaque PBR support, retained restrictions, factor/channel/color-space handling, tangent/mapping conventions, AO interpretation, evaluation/sampling/weighting, texture ownership/capacity, invalidation, reproduction steps, visual evidence, and honest numerical/visual limitations.

Update relevant current-runtime sections in `docs/architecture/overview.md`, `README.md`, and `AGENTS.md` so they no longer claim that tracing supports only untextured nonmetallic matte finishes. Refine ADR-003's existing experimental-backend section for the bounded PBR extension without rewriting historical decisions or broadening persistent material semantics.

Store new captures and concise reproduction metadata in a clearly named architecture evidence directory. Link to existing normative material contracts rather than duplicating them. Identify agent-observed results separately from human acceptance. Do not claim full material/transparency parity, calibrated photometry, complete convergence, or unsupported features.

Do not modify any file under `docs/tasks/`.

## Verification

Run the standard root checks after implementation:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run the real-browser matrix through normal project loading, inspect tracing output and browser errors, and verify material/scenario changes, pause/resume, presentation-only redraw, and return to Interactive. Use the accepted daylight/luminaire scenarios for regression evidence as relevant.

If dependency manifests or the lockfile change, also inspect current registry metadata and run:

```bash
pnpm outdated --recursive
pnpm install --frozen-lockfile
```

Newer incompatible releases may remain unselected only with evidence-backed justification. Report every required command or browser case that could not be executed and why. Do not claim success for unexecuted checks. Performance benchmarking is not required.

## Acceptance Criteria

The task is complete only when:

1. Existing resolved opaque Material 1.0/1.1 assets render in tracing with the declared factors and all supported texture roles, using the existing Design finish assignments and version semantics.
2. Physical texture scale, orientation, repetition, map alignment, and finish partitioning remain consistent with Interactive, including differing image resolutions and packed ORM resources.
3. Nonmetallic, metallic, rough, polished, and zero/near-zero roughness cases have finite, meaningful PBR response; glossy reflections include actual architecture/sky and finite-source emission with correct sampling/weighting.
4. Normal maps follow the normative tangent convention without changing architecture or allowing opaque-boundary leaks. AO retains its specified indirect-shading semantics without becoming direct visibility or an albedo substitute.
5. Opaque source alpha is ignored, remaining mask/blend/glazing/weather restrictions are explicit, and supported maps are never silently omitted or replaced by matte shading.
6. Accepted daylight, clear-pane, all-four-luminaire, concealed-strip, and sealed/thin-wall behavior remains correct within the documented material model. Source flux, presentation, and default Interactive behavior remain intact.
7. Material changes and readiness reset stale history, including while paused; presentation-only edits retain samples. Atomic replacement, source ownership, failure/capacity reporting, and disposal leave no mixed or stale scene state.
8. Focused tests and required root checks pass; browser evidence covers the material/control matrix with reproducible settings and recorded limitations.
9. Current-runtime documentation and provenance accurately describe the implemented subset. No new persistent format, material editor/importer, extra weather mode, renderer framework, performance target, or unrelated feature is introduced.
10. Any dependency change satisfies registry/version compatibility rules and frozen-lockfile verification.

Human visual acceptance remains the final review step. Passing tests alone must not be used to declare unresolved required material/reflection behavior complete.

## Final Response

Provide a concise execution report containing:

1. what was implemented and the principal files/areas changed;
2. material model, sampling/weighting, normal/AO, texture storage/filtering, and numerical choices relevant to review;
3. tests added/updated and verification commands actually run, with results;
4. browser observations, evidence links, reproduction settings, and remaining limitations;
5. dependency changes and evidence-backed version exceptions, or `None`;
6. deviations from this description, or `None`;
7. follow-up work identified, or `None`;
8. a suggested Conventional Commits implementation message with a concise body and this trailer:

```text
Task: TASK-046
```

Do not stage, commit, push, pull, fetch, or perform other Git write/synchronization operations. Do not modify this description, task records, or any other file under `docs/tasks/`. Leave the implementation working set for human review and finalization.
