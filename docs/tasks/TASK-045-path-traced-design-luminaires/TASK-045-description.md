# TASK-045: Path-traced design luminaires

## Context

PlanAxis already validates, persists, resolves, and interactively renders Design 1.1 point, spot, linear, and area luminaires. The application converts successfully resolved descriptors into runtime luminaire inputs, including effective luminous flux after enabled state and dimming. Luminaire placement and editing UI are not implemented.

The experimental daylight path tracer is implemented in `@planaxis/renderer-three` and was accepted through TASK-044, implementation commit `8c9ba10165a94416f657c0b7f8c90905354f87e5`. It uses a separate WebGL2 backend, the existing architectural meshes and camera/navigation, progressive linear HDR accumulation, matte diffuse transport, thin clear-window transmission, and the existing Physical Sunny simulation. Design luminaires currently do not contribute to that image.

The human maintainer tested the daylight experiment in several scenarios and found the resulting images substantially more convincing than the current VXGI output. The next evaluation is artificial lighting, especially a concealed strip whose light must reach the room through surface reflections. Waiting a minute or longer for a clear static image is acceptable; rendering speed is not an acceptance target.

This task extends the existing experiment. The default interactive renderer and its retained VXGI integration remain available for navigation and comparison.

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
docs/specifications/planaxis-material/1.1.md
packages/renderer-three/src/path-tracing/UPSTREAM.md
```

For Apartment SVG, focus on level/model-space coordinates, physical surfaces, openings, fixed elements, and validation. For Design 1.1, read the complete luminaire contract, including the normative orientation frame and type-specific emission semantics. Read Design 1.0 for compatibility, and the Material specification for the existing supported matte subset.

Under `docs/tasks/`, read only this exact assigned description. Do not read task records, other descriptions, templates, or task-process specifications. All task-specific requirements are contained here; the references to earlier task identifiers are historical context only.

Inspect the existing luminaire application adapter, renderer runtime contract, path-tracing implementation, and relevant tests before changing them.

## Goal

Render the selected design's point, spot, linear, and area lights in the experimental path-tracing view with correctly occluded direct illumination and diffuse indirect transport. A concealed strip must illuminate a room through a physically open bounce route without leaking through opaque architecture.

The result must support artificial-only nighttime scenes and mixed Sun, sky, and artificial illumination while preserving existing scene validation, navigation, presentation, and progressive-rendering behavior.

## Scope

The task includes:

- adapting the existing resolved runtime luminaire set into the path tracer;
- flux-consistent emission, source sampling, and visibility for all four types;
- idealized visible emitting surfaces for linear and area sources;
- direct and indirect artificial illumination within the current material/glazing subset;
- luminaire replacement, accumulation invalidation, failure handling, and resource ownership;
- focused automated tests, valid project fixtures, real-browser visual evidence, and architecture documentation.

## Out of Scope

The task does not include:

- changes to Apartment SVG, Project, Design, or Material formats or validation rules;
- luminaire placement/editing UI, utility binding, fixture models, imported furniture, IES, RGB lights, or additional persistent fields;
- textured, metallic, glossy, frosted, tinted, or otherwise unsupported material/glazing transport;
- Studio or Overcast path tracing, new sky models, camera white balance, or calibrated lux/irradiance analysis;
- bloom in the path-traced output, denoising, render export, automatic sample limits, or new render presets;
- replacement of the default renderer, further VXGI development, or a general renderer/plugin framework;
- FPS, render-time, memory-performance benchmarks, or a required convergence deadline;
- a general bidirectional integrator, caustics system, or wholesale port of upstream demos.

Targeted sampling improvements needed to satisfy the concealed-light case are within scope. No particular integration algorithm is prescribed.

## Functional Requirements

### 1. Existing design and runtime inputs

Use the existing successfully resolved Design 1.1 luminaire data and application-to-renderer boundary. Preserve the declared position, orientation, nominal lumens, Kelvin temperature, enabled state, dimming, beam angle, and dimensions according to the specification.

The current application adapter already supplies effective runtime lumens:

```text
effective lumens = enabled ? luminousFluxLumens * dimming : 0
```

Do not apply enabled/dimming a second time in the renderer or modify the stored descriptor. Disabled and zero-dim sources must contribute no illumination or visible emission. Positive effective output must participate in tracing.

No selected design, Design 1.0, and Design 1.1 with omitted luminaires must all replace the runtime set with an empty set. Selecting such a scenario after a lit scenario must remove the previous lights. Preserve both supported Design versions without migration; do not persist an empty `luminaires` array.

Every effective source in the selected set must participate. Array order must not establish priority or change total expected illumination. Do not reuse VXGI light-selection budgets, silently truncate the set, or substitute only a few representative lights. A genuine backend capacity failure must be explicit through the existing path-tracing availability/failure UI, with Interactive rendering still accessible.

### 2. Placement, orientation, and source shapes

Convert centimeters to renderer meters exactly once and map PlanAxis `(X, Y, Z)` to Three.js `(X, Z, Y)` at the established renderer boundary. Model-space Z already includes the level offset. Do not apply that offset again.

Use the normative Design 1.1 frame, including heading, positive-down pitch, and roll. Reuse the existing frame adaptation where suitable. Source sidedness must follow its emission normal, independently of any ray-facing normal used for opaque architectural shading.

- **Point:** an ideal isotropic point source over the full sphere. Do not invent orientation, a visible bulb, or a finite source radius.
- **Spot:** an ideal point source centered on the declared forward direction. The declared beam angle is the full cone angle. Any chosen angular falloff must respect that cone and be normalized to preserve total flux. Do not invent an IES profile or persistent penumbra field.
- **Linear:** a one-sided finite source centered at its position, with length along rolledSide and emission toward forward. Use the established renderer approximation of a length by **1 cm** rectangle for finite sampling and visible emission. The 1 cm width is a documented renderer policy, not a Design property, housing dimension, or new normative thickness.
- **Area:** a one-sided rectangle centered at its position, with width along rolledSide, height along rolledVertical, and emission toward forward.

Use a documented diffuse/Lambertian emission model for the finite rectangles. Their front faces must be visible as emitting surfaces when unobstructed; their back faces must not emit. Do not create fixture housings or emissive proxy spheres for point/spot sources. Light-source representation must remain renderer-owned and separate from canonical architecture and finish targets.

A geometrically inconvenient but structurally valid light remains valid Design data. Do not move a light out of a wall, add collision/attachment conformance rules, or silently repair its placement.

### 3. Luminous flux and color

Treat the declared lumens as total source output, not raw radiance, candela, exposure compensation, or an arbitrary per-type intensity. Dimming must scale linear transport proportionally.

For normalization, an isotropic point source has luminous intensity `Phi / (4 * pi)`. A one-sided Lambertian rectangle of area `A` has luminance `Phi / (pi * A)`. A spot's angular distribution must integrate to its total `Phi` over the declared cone. These photometric relationships establish flux preservation; they do not imply spectral power is available from the descriptor.

Use one documented, consistent conversion from photometric source quantities into the tracer's linear RGB transport units for all four types. Preserve the established approximate Kelvin-to-linear-RGB policy and document its limitations. Do not fabricate spectral measurements or claim calibrated photometry.

Changing rectangle dimensions at fixed lumens must change source brightness and distribution without multiplying total emitted flux. Narrowing a spot cone must redistribute the same total output. Account for distance, surface/source cosines, and sampling probability consistently.

Do not adjust the current Sun/sky strength, use per-type artistic multipliers, add ambient fill, or compensate with exposure to conceal an incorrect light model. Existing presentation controls remain presentation only.

### 4. Transport and occlusion

Integrate lamp contributions into the same linear HDR transport as Sun and sky. Support direct illumination and multiple diffuse bounces through the existing opaque matte surfaces. Explicitly sample ideal point/spot sources; do not depend on a random path hitting an infinitesimal point.

Finite emitting rectangles must contribute through both visibility to the camera and light transport. If direct-source sampling and path hits can estimate the same contribution, use correct weighting or another valid estimator to prevent double counting. Light-selection and source-sampling probabilities must be accounted for.

Use actual architectural triangles for visibility, retaining complete two-sided wall, floor, ceiling, opening/reveal, and fixed-element occlusion regardless of raster culling. All four light types require ray-traced occlusion; the interactive renderer's shadowless rectangular-light approximation must not carry over.

Local-light visibility is a finite segment ending at the source sample. Geometry beyond the source must not block it. Avoid source/self intersections without increasing offsets enough to cross thin partitions. Retain the existing clear/unspecified thin-pane approximation for relevant visibility and transport paths; unsupported glazing remains explicitly unavailable. Bounded traversal exhaustion must occlude rather than create a leak.

Required concealed-strip behavior: an opaque baffle hides the strip and blocks its direct path to at least one visible receiving region, while a physically open route through nearby matte surfaces allows indirect illumination to reach that region. The final image must show this reflected light. A fully sealed adjacent region must not become lit by rays crossing its opaque boundary.

More accumulation may be used to clarify this case. Light leakage, unshadowed rectangular proxies, fake ambient/fill lights, and bloom are not acceptable substitutes for transport.

### 5. Physical daylight and presentation

Keep the current Physical Sunny eligibility rules and supported finish/glazing subset. At nighttime, use the existing simulation's Sun/sky state without introducing a replacement environment or fill. Luminaires must continue to illuminate the interior when direct Sun output is zero.

At daytime, Sun, sky, and artificial contributions must coexist in the same accumulation. Switching daylight time must preserve the selected design's lights and reset transport appropriately. With no effective luminaires, existing daylight output and support rules must remain intact.

Keep tone mapping, exposure, and sRGB output conversion applied exactly once after linear HDR accumulation. Changing exposure or tone mapping redraws the accumulated image without restarting samples. Path tracing continues to bypass raster GI, Studio fill/environment helpers, and bloom. Returning to Interactive preserves its retained GI/bloom settings.

Update any UI/help text that currently says design luminaires are excluded from tracing. Retain the experimental label; do not add luminaire controls or a second design-selection workflow.

### 6. Accumulation, lifecycle, and failure behavior

Extend existing `setLuminaires` and tracing synchronization so every transport-affecting light change invalidates the accumulated image: addition/removal, effective output, Kelvin, position, orientation, beam angle, and finite-source dimensions.

Changes while paused must clear stale samples and preserve the paused state. Resume continues the unchanged scene, or starts the changed scene from its cleared history. Light changes must not alter camera pose, navigation mode, or daylight state.

Preserve existing invalidation for architecture, finishes, glazing, camera/projection, drawing-buffer size/DPR, and daylight. Preserve session-only selection/pause/sample behavior and the established stop conditions for Interactive, hidden documents, 2D/unmount, ineligibility, failure, and disposal.

Keep owned light buffers/textures, emitter geometry, acceleration data, and related GPU resources under renderer lifecycle control. Replace and dispose them safely, including partial initialization/upload failures and repeated scene/view changes. Reuse architectural scene data where appropriate; do not introduce a new application rendering loop or fetch persistent descriptors inside the renderer.

## Technical and Architectural Constraints

- Preserve validation-before-3D and exact authoritative geometry. Renderer approximations must not flow back into the domain model or SVG.
- Keep Three.js, source representations, sampling, shaders, and GPU ownership in `packages/renderer-three`; React owns application controls, and `packages/simulation` retains daylight semantics.
- Extend the accepted separate WebGL2 experimental backend under ADR-003. Keep the default WebGPU-first renderer and its supported WebGL2 fallback intact.
- Reuse resolved runtime luminaire inputs and existing project resource APIs. Do not bypass project-root containment or load arbitrary browser-supplied paths.
- Preserve existing interactive luminaire behavior. Shared refactoring must not silently change its appearance or known capability limits.
- Keep sampling choices and numerical tolerances explicit and documented. Test changed transport behavior rather than asserting shader source text alone.
- Do not change normative specifications or task artifacts. Update architecture documentation for implemented behavior only.

## Files and Areas Expected to Change

Expected areas include:

```text
packages/renderer-three/src/path-tracing/
packages/renderer-three/src/apartment-renderer.ts
packages/renderer-three/src/runtime-luminaires.ts
packages/renderer-three/test/
apps/web/src/design-luminaires.ts
apps/web/src/three-viewport.tsx
apps/web/src/ and apps/web/test/ where tracing status/help is implemented
fixtures/projects/
docs/architecture/daylight-path-tracing.md
docs/architecture/overview.md
docs/decisions/ADR-003-three-renderer-architecture.md
README.md
AGENTS.md
```

This list is guidance; only change files that the implementation actually requires. Existing descriptor validation and persistence should normally need no changes. Leave historical VXGI evaluation evidence intact.

## Dependencies

No new dependency is expected. Reuse the existing Three.js version and local path-tracing infrastructure; do not replace the renderer or import an upstream demo as a separate application.

If a new or updated dependency is demonstrably necessary, follow `AGENTS.md` and the coding guidelines: inspect current registry metadata, evaluate the newest stable major, select the newest non-deprecated mutually compatible stable release, keep versions consistent, and document any evidence-backed compatibility exception. Do not guess versions, force installation, ignore peer errors, or add speculative overrides.

Preserve upstream licensing and provenance. Update `path-tracing/UPSTREAM.md` when incorporating additional upstream code, identifying its exact source and adaptation. New substantial sampling logic should identify the approach in architecture documentation without claiming an upstream algorithm that was not implemented.

## Testing Requirements

Add focused automated coverage for the actual changed behavior, including:

- all four runtime source types; effective lumens, disabled/zero-dim behavior, and empty-set replacement across Design 1.0/1.1/no-design transitions;
- centimeter/basis conversion, nonzero model-space Z, heading/pitch/roll, full spot angle, linear length/1 cm renderer width, and area dimensions/sidedness;
- flux normalization, proportional dimming, fixed-flux resizing/cone changes, finite/nonnegative output, and sampling-probability accounting;
- finite visibility segments, opaque blockers/thin partitions, correct emitter self-intersection handling, and retained clear-pane behavior;
- contribution from all sources regardless of descriptor order, plus explicit capacity failure if the implementation introduces a bounded capacity;
- every light-input invalidation category, changes while paused, presentation-only redraw, replacement/cleanup, and tracing failure recovery;
- unchanged default interactive rendering, daylight-only tracing, camera/navigation, and supported-input gating.

Use normative Design semantics for expected adaptation results. Do not duplicate the full validator suite when its behavior is unchanged, weaken existing assertions, or rely solely on mocked GPU/shader-string tests as proof of transport correctness.

Create valid, focused project fixtures and scenario descriptors for real-browser review. They must use supported matte finishes and existing Apartment SVG geometry; a concealed-light baffle may be a valid fixed architectural element. Do not introduce fixture models, invalid schemas, or runtime-only architectural geometry to build the acceptance case.

The visual review matrix must cover:

| Case | Required observation/control |
| --- | --- |
| Point at night | Direct illumination, opaque shadow, and visible diffuse bounce; matched lights-off control. |
| Spot at night | Declared aim/cone and orientation; narrowed/reoriented variant redistributes light without arbitrary output gain. |
| Area at night | Front-face emission, no back-face emission, finite-source shadowing, and fixed-flux dimension variant. |
| Concealed linear strip at night | Source hidden behind a baffle; a directly blocked receiving region is lit through diffuse reflection; matched off control and sealed-region control. |
| Thin partition | An effective source on one side does not illuminate a fully enclosed adjacent room by crossing opaque geometry. |
| Mixed daytime lighting | Sun/sky and design lights coexist; switching time or scenario updates the image correctly. |
| Mixed luminaire set | Point, spot, linear, and area sources coexist without omission; reordered descriptors preserve lighting semantics. |
| Daylight regression | Existing windowed, sealed, and thin-wall daylight fixtures retain their expected behavior without effective design lights. |

Keep camera, viewport, presentation, materials, and relevant daylight settings fixed for matched controls. Let the static image accumulate until the required behavior is assessable, commonly around 1024 samples or more if needed. This is a review guideline, not a sample-count or elapsed-time pass/fail threshold.

Capture actual browser output and record project/scenario, camera, date/time/time zone, presentation, viewport/DPR, sample count, backend, and remaining noise/limitations. Include the concealed-strip, lights-off, and sealed/thin-wall controls in saved evidence. Interactive/VXGI comparison is qualitative context where supported; no benchmark or universal claim of superiority is required.

## Documentation Requirements

Update `docs/architecture/daylight-path-tracing.md` with the supported luminaire contract, linear-source approximation, flux/color conversion, source sampling and weighting, occlusion, invalidation/resource ownership, reproduction instructions, captures, and honest limitations.

Update relevant current-runtime sections of `docs/architecture/overview.md`, `README.md`, and `AGENTS.md` so they no longer describe artificial luminaires as excluded from path tracing. Refine ADR-003's existing experimental-backend section to record the bounded extension and renderer-owned emitting surfaces without rewriting historical decisions or broadening persistence semantics.

Store visual evidence under a clearly named architecture evidence directory, using concise filenames and documentation links. Distinguish observed browser results from expectations and remaining human acceptance. Do not describe calibrated photometry, complete convergence, or unsupported material/light features as implemented.

Do not modify any file under `docs/tasks/`.

## Verification

Run the standard root checks after implementation:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run the real-browser visual matrix above through the normal project-loading application workflow, and inspect both traced output and browser errors. Verify pause/resume, scenario/light replacement, presentation changes, and return to Interactive in a real browser in addition to automated lifecycle tests.

If dependency manifests or the lockfile change, also inspect current registry metadata and run:

```bash
pnpm outdated --recursive
pnpm install --frozen-lockfile
```

Newer incompatible releases may remain unselected only with evidence-backed justification. Report every required command or browser case that could not be executed and why; do not claim success for an unexecuted check. Performance benchmarking is not required.

## Acceptance Criteria

The task is complete only when:

1. Existing resolved Design 1.1 point, spot, linear, and area luminaires contribute correctly to the experimental image, including enabled/dimming, color, position/orientation, cone, dimensions, and total-flux semantics.
2. Linear and area front faces visibly emit when unobstructed, back faces do not emit, and source dimensions do not invent fixture/persistence semantics.
3. Direct rays and diffuse transport respect actual opaque architecture for all types, including finite source segments and thin partitions; no ambient/fill or unshadowed-proxy workaround supplies the accepted result.
4. The concealed-strip case visibly lights a directly blocked receiving region through a real bounce route, while matched off and sealed-region controls demonstrate that the result is not leakage.
5. Artificial-only nighttime and mixed daylight scenes work; the daylight-only experiment, material/glazing gating, and default Interactive/VXGI behavior remain intact.
6. Every effective source participates without array-order priority or silent truncation; empty-set replacement and explicit capacity/failure behavior are correct.
7. Light changes reset stale accumulation, including while paused; presentation-only changes retain samples; camera/navigation and retained Interactive settings survive view changes.
8. Owned tracing resources and progressive work follow the established replacement, visibility, failure, and disposal lifecycle without stale data or leaks.
9. Focused tests and required root checks pass, real-browser evidence covers the required matrix, and current-runtime documentation describes the implementation and its limitations accurately.
10. No new format, luminaire editor, fixture importer, general renderer framework, performance target, or unrelated functionality is introduced. Any dependency change satisfies the repository's metadata, compatibility, and frozen-lockfile rules.

Human visual acceptance remains the final review step. Unresolved required visual behavior must be reported explicitly rather than marked complete because tests pass.

## Final Response

Provide a concise execution report containing:

1. what was implemented and the principal files/areas changed;
2. source-model, flux/color, sampling, and concealed-light decisions that matter for review;
3. tests added/updated and verification commands actually run, with results;
4. browser review results, evidence links, reproduction settings, and unresolved limitations;
5. dependency changes and evidence-backed version exceptions, or `None`;
6. deviations from this description, or `None`;
7. follow-up work identified, or `None`;
8. a suggested Conventional Commits implementation message with a concise body and this trailer:

```text
Task: TASK-045
```

Do not stage, commit, push, pull, fetch, or perform other Git write/synchronization operations. Do not modify task records, this description, or any other file under `docs/tasks/`. Leave the implementation working set for human review and finalization.
