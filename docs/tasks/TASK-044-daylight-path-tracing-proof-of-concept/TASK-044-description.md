# TASK-044: Daylight path-tracing proof of concept

## Context

PlanAxis validates Apartment SVG, builds renderer-independent architectural geometry, and adapts it through `@planaxis/renderer-three`. The current interactive renderer uses native-WebGPU-first Three.js rendering with automatic WebGL2 fallback, PBR materials, Physical Sun/sky lighting, design luminaires, HDR bloom, and optional VXGI.

The human maintainer accepted the VXGI implementation with known unresolved thin-wall light leakage and set aside further VXGI work. Its code remains available as a comparison baseline. The next question is whether progressively accumulated path tracing produces more convincing apartment interiors.

The selected starting point is erichlof's `THREE.js-PathTracing-Renderer`. Its demos share accumulation and output infrastructure but use different scene and lighting shaders. The glTF apartment viewer demonstrates triangle-BVH rendering, Sun lighting, and environment illumination; it is not a complete drop-in adapter for PlanAxis materials and lights.

The human maintainer accepts waiting a minute or longer for a clear stationary image. This task must deliver a working PlanAxis view promptly. Performance benchmarking, broad renderer evaluation, and real-time path-tracing targets are not required.

## Required Reading

Before making changes, read and follow:

```text
AGENTS.md
docs/architecture/overview.md
docs/architecture/realtime-global-illumination.md
docs/decisions/ADR-002-react-browser-ui.md
docs/decisions/ADR-003-three-renderer-architecture.md
docs/decisions/ADR-004-filesystem-backed-projects.md
docs/development/coding-guidelines.md
docs/development/testing.md
```

Read the relevant sections of these normative specifications:

```text
docs/specifications/apartment-svg/2.2.md
docs/specifications/planaxis-project/1.0.md
docs/specifications/planaxis-design/1.1.md
docs/specifications/planaxis-material/1.1.md
```

Focus on location/orientation, walls, windows, floor/ceiling geometry, camera conventions, project loading, resolved finishes, and tone mapping/exposure. Preserve existing supported earlier format versions; this task does not change parsers, validators, descriptors, or persistence.

Inspect the selected external implementation at execution time:

- [Upstream repository](https://github.com/erichlof/THREE.js-PathTracing-Renderer)
- [Demo catalogue](https://erichlof.github.io/THREE.js-PathTracing-Renderer/)
- [Apartment viewer](https://erichlof.github.io/THREE.js-PathTracing-Renderer/GLTF_Model_Viewer.html)
- [Shared initialization and accumulation](https://github.com/erichlof/THREE.js-PathTracing-Renderer/blob/gh-pages/js/InitCommon.js)
- [Apartment scene conversion](https://github.com/erichlof/THREE.js-PathTracing-Renderer/blob/gh-pages/js/GLTF_Model_Viewer.js)
- [Apartment shader](https://github.com/erichlof/THREE.js-PathTracing-Renderer/blob/gh-pages/shaders/Gltf_Viewer_Fragment.glsl)
- [Three.js backend migration guidance](https://threejs.org/manual/pages/webgpurenderer)

External code is an implementation reference, not a replacement for PlanAxis's normative semantics. Verify the license and record the upstream commit used for any adapted source.

Read only this assigned description under `docs/tasks/`. Do not read another task record or description, the shared task templates, or the task-record specification during execution.

## Goal

In the ordinary PlanAxis browser application, a human reviewer can select an experimental path-tracing view of a validated apartment, position the camera inside a room, and watch sunlight entering through a clear window produce direct illumination and reflected light on other interior surfaces.

The same apartment and viewpoint can be inspected with the existing VXGI renderer. The result must be a real integration using PlanAxis geometry, not an embedded external demo or a shader containing a hard-coded apartment.

## Scope

The task includes:

- an explicitly selected, transient experimental path-tracing view;
- a separate WebGL2 path-tracing backend inside the existing Three.js adapter boundary;
- triangle-BVH adaptation of current architectural surfaces and physical fixed elements;
- simple diffuse surface materials and thin clear-window transmission;
- Physical Sunny Sun and sky illumination with traced indirect light;
- progressive accumulation, sample-count display, pause/resume, and invalidation;
- camera-preserving switching between the experimental and existing renderers;
- one reproducible simple windowed-apartment project and focused occlusion controls;
- correctness tests, real-browser visual review, and documentation of the bounded experiment.

## Out of Scope

The task does not include:

- performance benchmarks, timing thresholds, FPS targets, Apple M1 performance comparisons, or optimization projects;
- a native WebGPU port of the path tracer;
- removing, replacing, or further tuning the accepted VXGI implementation;
- a general renderer-selection framework or plugin system;
- artificial luminaires, concealed LED strips, IES, or bidirectional-lighting integration;
- full Material Format rendering parity, texture maps, metallic/glossy finishes, frosted/tinted glazing, volumetric glass, glass caustics, or new material properties;
- Studio or Overcast path tracing, animated clouds, or richer atmospheric simulation;
- furniture/model importing, fixture geometry, or placement/editing workflows;
- image-export UI, saved render jobs, server rendering, persistent sample/settings fields, or new format versions;
- changes to authoritative apartment geometry or the deterministic validation pipeline.

## Functional Requirements

### 1. Explicit experimental selection

Add an accessible selection in the existing Rendering UI between the current interactive rendering and `Path tracing (experimental)`. The existing renderer remains the default.

Path tracing is available only in 3D with validated architecture, valid Physical location/orientation, Sunny weather, and a usable WebGL2 floating-point rendering capability. Explain unavailability concisely. Do not infer location, silently change the selected lighting/weather mode, or select a different renderer because of a quality preset.

For this proof of concept, required finish support is neutral architectural defaults and opaque, untextured, nonmetallic matte finishes with their effective base colors. Required glazing support is clear or unspecified glass using the existing qualitative clear-glass defaults. Identify unsupported finish/glazing inputs and keep the existing view available; do not silently claim full material parity. Limitation handling must preserve valid architecture and persistent data.

The experimental view is daylight-only. Design luminaires do not contribute and their omission must be stated in the mode's concise description. Existing luminaire data and the interactive view's lighting remain unchanged.

Renderer selection, sample count, and pause state are session-only. Do not write them to local storage, Apartment SVG, project/design/material descriptors, or server APIs.

### 2. Architectural scene adaptation and occlusion

Consume geometry derived from the existing validated model and architectural surface pipeline. Convert that geometry to the tracer's triangle/material data and BVH inside `renderer-three`. Reuse existing mesh/surface construction where practical rather than introducing a competing architectural geometry builder.

Keep the established centimeter-to-meter and coordinate-axis conversion, surface winding, model-space level offsets, openings, and fixed-element geometry correct. A glTF export/import round trip is not required and must not become a new persistence dependency.

All physically present opaque walls, floor, ceiling, opening reveals, and fixed elements participate in ray visibility. Utility markers, camera helpers, selection overlays, and other visualization-only objects do not become physical occluders or emitters.

Floor and ceiling have no fabricated thickness. They must block light from either side. Camera-facing culling or an overhead inspection view must not remove the ceiling from indirect-light visibility. Do not open the roof to make interior illumination stronger.

Clear windows retain the current opening-center, zero-thickness glazing geometry. Sun and sky paths must transmit through the glazing while the surrounding wall and reveals remain opaque. Use and document an appropriate thin-surface approximation; do not apply a solid-glass-sphere refraction model to a single sheet or remove glazing to obtain the desired image.

Ray-origin offsets and intersection tolerances must be reviewed in the renderer's meter units. They must not skip thin walls, create contact cracks, or redefine authoritative domain tolerances. Limitations in a stock demo shader are not permission to accept obvious enclosure leakage.

### 3. Sun, sky, and indirect illumination

Use the existing simulation result for the selected Physical instant, location, orientation, Sun direction, and Sunny daylight color/strength. Do not introduce a second solar calculator or a continuously advancing clock.

The tracer computes the complete daylight image, including direct Sun visibility and indirect diffuse transport. VXGI, the existing four Physical sky helper lights, Studio environment/fill, and other raster-lighting contributions must not be added to that image.

Sky radiance contributes only along paths that reach the exterior, including transmission through the window. Opaque enclosure surfaces must block those paths. Use a deterministic procedural sky or another locally bundled deterministic representation consistent with the current Sunny daylight state. Do not load the external demo's HDR image or other remote assets at runtime.

The implementation must retain enough diffuse transport to illuminate surfaces outside the direct Sun patch. Review scene-specific bounce limits, early termination, weighting, and denoising in the adapted shader. Increasing exposure, adding ambient fill, or blurring away enclosure errors does not demonstrate indirect lighting.

This remains qualitative visualization. Calibrated irradiance, lux predictions, and unbiased reference-renderer equivalence are not required and must not be claimed.

### 4. Progressive rendering and lifecycle

Display the accumulated sample count and provide accessible Pause and Resume controls. Pause retains the current image and stops tracing work. Resume continues the same accumulation when its inputs are unchanged.

Changes to camera pose/projection, viewport or effective drawing-buffer size, architecture, supported finishes/glazing, or daylight invalidate obsolete samples. Restart accumulation for the new inputs. Camera motion may use a noisy or reduced-sample preview; stationary refinement must not average different viewpoints or scene states together.

The review may begin around 1,024 samples, but this count is not a universal quality guarantee or mandatory stop point. The implementation may continue accumulating until paused.

Exposure and tone mapping operate on the accumulated linear HDR image. A presentation-only change should update the displayed image without mixing different lighting solutions or unnecessarily rebuilding geometry/BVH. Apply the current AgX, ACES Filmic, or Neutral selection, exposure, and output color conversion once. Do not retain the demo's independent Reinhard/gamma output on top of PlanAxis presentation.

Bloom is bypassed in the experimental view for this proof of concept. Retain the existing bloom selection and restore its ordinary effect on return to the interactive view; do not implement a second bloom pipeline.

Refinement may schedule successive frames while the experimental view is active, visible, and unpaused. This is an explicit exception to the ordinary idle render behavior. Stop work when paused, hidden, in 2D, switched to the interactive renderer, unavailable, failed, or disposed. Resume/restart appropriately when the experimental view returns. Retain the existing interactive renderer's finite VXGI refinement and event-driven behavior.

Dispose owned buffers, BVH/material textures, render targets, shaders, controls, and scheduled work on replacement/final cleanup, including partial initialization failures. Obsolete asynchronous results must not replace a newer model or render mode. Inactive backends must not continue drawing.

### 5. Camera and comparison behavior

Switching renderer selection preserves the current camera pose, projection, focal-length/aspect choices, Physical instant, weather, and presentation. It must not trigger automatic reframing or reset the Sun.

Existing inspection, embedded-camera, and Walk controls must still allow positioning the camera. Reuse the current navigation behavior; do not install the external demo's global keyboard, pointer-lock, mobile joystick, or GUI systems.

Path tracing does not overwrite the user's VXGI or bloom settings. On return to the interactive renderer, restore their existing behavior when supported by that backend.

If path-tracing initialization or rendering fails, stop its work, report a useful error, and allow return to the existing view. Do not require WebGPU for the WebGL2 experiment. On a WebGL2-only device, the existing direct-lighting fallback remains available even though VXGI comparison is unavailable.

## Technical and Architectural Constraints

Keep Three.js objects, shaders, BVH conversion, render targets, and backend ownership in `@planaxis/renderer-three`. React/UI state stays in `apps/web`; approximate solar/daylight semantics stay in `@planaxis/simulation`.

The accepted default remains `WebGPURenderer` with its supported WebGL2 fallback. The experimental backend uses conventional `WebGLRenderer` and GLSL, because conventional `ShaderMaterial` does not become compatible with `WebGPURenderer` by forcing its WebGL2 backend. Separate canvases/contexts are allowed inside the adapter; preserve one visible apartment viewport and explicit lifecycle ownership.

Record this bounded backend exception in an ADR or a clearly dated refinement to ADR-003, including its experimental scope and unchanged default. Do not turn this task into a wholesale renderer migration.

Adapt only the upstream code needed for this daylight scene. Prefer modules with explicit ownership over demo globals and shared mutable shader registration. Keep any unavoidable Three.js compatibility bridges isolated and documented.

Do not access arbitrary filesystem paths, add resource-serving routes, send project geometry to external services, or introduce a new framework/state-management/geometry dependency.

## Files and Areas Expected to Change

Expected areas include:

```text
packages/renderer-three/src/
packages/renderer-three/test/
apps/web/src/
apps/web/test/
fixtures/
docs/architecture/overview.md
docs/architecture/daylight-path-tracing.md
docs/decisions/
README.md
```

Follow the actual established test layout. Add a small conforming project fixture for manual reproduction where existing fixtures belong. Keep external-source provenance and license notices close to adapted code. Update the agent overview if necessary to avoid describing implemented behavior as entirely future work.

Do not modify `docs/tasks/` or unrelated implementation areas.

## Dependencies

Reuse the repository's current Three.js installation and existing utilities. Do not copy the upstream repository's bundled Three.js build, loaders, UI libraries, models, or textures into PlanAxis.

Vendoring the minimal required JavaScript/GLSL source is allowed. Record the selected upstream commit, source files, license, and material adaptations; retain applicable notices. Runtime loading from GitHub/CDNs is not allowed.

No new third-party dependency is predetermined. If one is genuinely necessary, follow AGENTS.md and the coding guidelines: inspect current registry metadata, evaluate the latest stable major, select the newest non-deprecated mutually compatible stable release, keep repeated versions consistent, and document any evidence-backed exception. Do not guess versions or force incompatible installs.

## Testing Requirements

Add focused automated correctness tests for:

- scene extraction, coordinate conversion, opening/glazing classification, and exclusion of visualization markers;
- opaque wall, floor, and ceiling visibility from both sides, including ceilings visually culled from above;
- material base-color conversion and explicit handling of unsupported inputs;
- Sun-direction/daylight mapping and exclusion of raster GI/fill/sky-helper contributions;
- accumulation invalidation, sample-count and pause/resume behavior, and cancellation of inactive/disposed work;
- camera/presentation retention across renderer switches;
- capability/initialization failure and return to the existing renderer.

Use deterministic small fixtures and mocked GPU boundaries where appropriate. Do not duplicate the full SVG validation suite, weaken existing tests, or claim mocked tests establish real shader output.

Real-browser visual verification is required for the actual integrated shaders. Performance benchmarks, timing assertions, frame-rate gates, and a hardware performance matrix are explicitly not required.

## Documentation Requirements

Add `docs/architecture/daylight-path-tracing.md` describing the implemented scene/material/glazing subset, backend boundary, Sun/sky treatment, sampling/invalidation, presentation, lifecycle, limitations, and upstream provenance.

Include a reproducible manual comparison procedure with the project path, embedded/interior viewpoint, exact Physical civil date/time and zone or instant, Sunny selection, presentation, and sample count used. Update the architecture overview, appropriate ADR, and README entry points consistently. Preserve the accepted VXGI limitations as history.

Do not present the experiment as full material/luminaire support, a completed renderer replacement, a calibrated daylight simulator, or an established improvement over VXGI before human review.

## Verification

Run the required repository checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

If dependency manifests or the lockfile change, also inspect current registry information and run:

```bash
pnpm outdated --recursive
pnpm install --frozen-lockfile
```

Report every command actually executed and its result; identify any required check not run and the reason.

For the visual review, provide a small conforming project with a complete floor/ceiling enclosure, opaque walls, one clear window, no active artificial lights, and an interior camera. Choose and document a fixed Sunny instant at which the Sun enters the window. Use neutral/matte surfaces and retain at least one surface outside the direct Sun patch.

Also provide a sealed counterpart with the window removed and the wall restored through a valid SVG, not a shader override. Keep the same physical daylight and presentation. It must remain dark inside apart from numerical display noise. These fixtures must traverse normal project loading, SVG validation, and model construction.

Capture the same interior viewpoint using interactive VXGI Off, interactive VXGI On where native WebGPU is available, and stationary path tracing. Keep architecture, viewport, materials, Sun state, tone mapping, exposure, and bloom-disabled comparison conditions fixed. Record actual sample counts and any unavoidable lighting-model differences. Do not use per-image exposure tuning to manufacture an improvement.

Inspect the windowed result for a correctly placed Sun patch, visible secondary illumination, wall/ceiling contact occlusion, and refinement without persistent ghosts. Inspect the sealed control and a thin opaque wall from both sides. Capture the images and place review evidence with the architecture documentation in a suitable small format.

A supported real browser, preferably the maintainer's Apple M1 environment, is sufficient. There is no one-minute deadline, fixed sample-count quality guarantee, or requirement that path tracing look better in every scene. Report actual visual failures honestly; the human maintainer decides whether the result merits a later expansion.

## Acceptance Criteria

1. Normal PlanAxis project loading exposes an explicitly selected experimental path-tracing view for the documented supported subset.
2. A real windowed apartment interior shows direct Sun entering through clear glazing and traced secondary illumination on surfaces outside the direct patch.
3. Opaque walls and complete floor/ceiling geometry block exterior light; the sealed control has no visible illumination caused by enclosure leakage or hidden fill.
4. Progressive accumulation, sample-count display, pause/resume, invalidation, and cleanup work as specified.
5. Renderer switches preserve camera, Physical daylight, and presentation, and the existing VXGI/direct-lighting view remains usable.
6. Unsupported inputs and backend failures are explicit; no persistent schema/data changes or runtime external asset loading are introduced.
7. Focused tests and required repository checks pass, with real-browser comparison evidence and a reproducible procedure supplied.
8. The adapter boundary, bounded WebGL2 exception, upstream provenance/license, and experimental limitations are documented.
9. No performance benchmarks, artificial-lighting expansion, native WebGPU port, unrelated refactors, or task-artifact modifications are introduced.

## Final Response

Provide a concise execution report containing:

1. implementation summary and main files/areas changed;
2. how to launch the comparison project and reproduce the interior daylight view;
3. tests added/updated and verification commands actually run with results;
4. actual visual findings and links to comparison captures, including failed cases;
5. supported material/glazing/lighting subset and remaining limitations;
6. upstream commit/license and any dependency additions/updates with compatibility evidence;
7. deviations from this description, or `None`;
8. follow-up work, or `None`;
9. a suggested Conventional Commits message with a concise body and `Task: TASK-044`.

Leave execution/review/finalization recording to the human maintainer. Do not modify any file under `docs/tasks/` and do not stage, commit, push, pull, fetch, or otherwise change Git state.
