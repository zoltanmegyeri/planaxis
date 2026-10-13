# TASK-047: Path-traced daylight calibration and indirect-light validation

## Context

PlanAxis's accepted experimental WebGL2 path tracer renders Physical Sunny daylight, thin clear panes, all four Design 1.1 luminaire types, and opaque Material 1.0/1.1 metallic/roughness PBR finishes with their defined texture roles. Interactive/VXGI remains the fast navigation view; the human maintainer uses path tracing for final static images and accepts long accumulation times.

After accepting TASK-046, the maintainer reported insufficient illumination outside direct Sun patches. A large living room with two substantial windows remains too dark under summer morning/noon/afternoon conditions even though sunlight reaches its floor or wall. An earlier review reported the same symptom in Open Space on June 21 at noon after roughly 1,500 samples. This is reported evidence to reproduce, not proof of complete convergence or a confirmed transport defect.

Current tracing inputs reuse `3 * directStrength` for the Sun and the visible procedural sky's linear color gradient as environment radiance. They are appearance values, without a documented physical daylight scale or calibrated relationship to the luminaire transport units. Only escaping paths collect sky radiance. The integrator limits paths to eight opaque/24 total interactions, compensates surviving Russian-roulette paths, and uses a bounded single-scattering GGX/diffuse model and material AO.

The leading hypothesis is Sun/sky and exposure calibration. Path truncation, material energy loss, AO, geometry/glazing, and finite-sample error must also be evaluated. Neither a blanket increase in bounce brightness nor merely waiting for more frames is an established solution.

## Required Reading

Before implementation, follow the applicable repository-entry preflight in `AGENTS.md`. Read and follow:

```text
AGENTS.md
docs/architecture/overview.md
docs/architecture/daylight-path-tracing.md
docs/architecture/path-traced-pbr-evaluation/README.md
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

Focus on daylight/civil-time semantics, existing source units, PBR evaluation and sampling, AO, glazing, actual architectural occlusion, resource lifecycle, presentation, and project/material resolution boundaries. Specifications retain authority over persistent formats; this task does not revise them.

Read PBRT 4's [Infinite Area Lights](https://pbr-book.org/4ed/Light_Sources/Infinite_Area_Lights), especially the window/portal discussion. It distinguishes sampling efficiency from expected illumination. Select and inspect primary references for the daylight calibration and any transport corrections; document the assumptions, equations, units, and provenance used.

Under `docs/tasks/`, read only this exact assigned description. Do not browse task records, other descriptions, templates, or task-process specifications. Earlier task identifiers are historical context only.

Inspect the simulation, physical-sky adapter, tracing source/BSDF/shader/progressive implementation, presentation handling, relevant tests, and accepted public fixtures before editing.

## Goal

Correct the reported dark-interior behavior by establishing a coherent Sunny daylight input and validating the energy that reaches indirectly lit surfaces. A large, light-finished room with substantial windows must show convincing illumination beyond its direct Sun patch at a documented fixed exposure, with the improvement supported by linear-light measurements and controlled references.

Preserve the accepted PBR, luminaire, clear-pane, navigation, and occlusion behavior. The result must identify which source, transport, material, or presentation effects caused the symptom and explain why the implemented correction is justified.

## Scope

The task includes:

- reproducing the symptom in a public controlled room and the maintainer's Open Space case when available;
- establishing a documented direct-Sun/diffuse-sky scale consistent with the existing RGB transport and luminaire convention;
- linear HDR/source-isolation diagnostics and a fixed presentation baseline;
- evaluating path limits, roulette, PBR energy, reflectance, AO, glazing, and convergence independently;
- implementing source calibration and demonstrated transport corrections needed for the required outcome;
- focused tests, valid fixtures, real-browser evidence, and architecture/provenance documentation.

Window-guided sky sampling is optional and within scope only if measured convergence error warrants it. It must preserve the lighting integral and architectural visibility.

## Out of Scope

The task does not include:

- changes to Apartment SVG, Project, Design, or Material formats or persistent semantics;
- Studio/Overcast tracing, new weather modes, a general atmosphere/cloud system, environment-asset importing, or fabricated exterior geometry;
- additional material/glazing types, IES, fixture/furniture importing, or material/luminaire editing UI;
- automatic exposure, new tone mappers, per-scene brightness sliders/presets, persistent render jobs, bloom, denoising, or render export;
- a blanket GI/bounce multiplier, unoccluded ambient fill, or per-material artistic gains;
- replacement of the default renderer, further VXGI tuning, or a general renderer framework;
- FPS, render-time, or performance benchmarks, and a convergence deadline;
- a general bidirectional/caustics/volumetric integrator or general apartment exporter to another renderer.

Bounded diagnostic tooling and reference calculations required to assess brightness and transport are within scope. A full spectral or certified building-daylight analysis system is not required.

## Functional Requirements

### 1. Reproduce and separate the causes

Before changing source strengths or transport, capture a reproducible baseline with the current implementation. Record architecture, camera, date/time/time zone, Sun direction/elevation, weather, materials, effective lights, exposure/tone mapping, viewport/DPR, sample count, and current source/path parameters.

Create a valid public reference project representing a large living room with two substantial windows, complete opaque boundaries, a visible Sun patch, and surfaces outside direct Sun visibility. Use explicit location/north/time-zone metadata and June 21, 2026 at 12:00 local civil time as the main summer condition. Select orientation so actual solar geometry produces the intended patch; do not substitute a hard-coded Sun direction in the normal application.

Use neutral, nonmetallic light finishes with known linear reflectance for the first diagnosis, without AO or normal maps and without luminaires. Record both descriptor sRGB values and effective linear values; an sRGB factor is not itself a linear reflectance. Then restore representative accepted PBR finishes and isolate material effects.

Where the maintainer's Open Space project is available through the configured project boundary, reproduce its June 21/noon condition and verify the correction there. Do not guess or persist an absolute private path, copy private assets into the repository, or weaken resource containment. If unavailable, continue the public diagnosis, report the private check as NOT RUN, and clearly distinguish the public proxy from an actual Open Space reproduction. Human review must assess the original apartment result when access becomes available.

Isolate direct Sun, diffuse sky, their combination, and relevant material/AO/path variants through a narrow reproducible diagnostic harness or test-only controls. Do not add user-facing source-isolation controls or persistent debug fields. Inspect openings/panes and visibility so missing geometry, material assignment, or blocked rays are not misdiagnosed as a brightness-scale problem.

### 2. Establish coherent Sunny source calibration

Replace reliance on uncalibrated display-color magnitudes with an explicit, documented Sunny lighting reference. The chosen model must define direct-Sun strength, diffuse-sky strength/distribution, elevation dependence, and RGB color assumptions sufficiently to reproduce its output and compare it to primary reference values.

Distinguish direct-normal illuminance/irradiance from sky luminance/radiance. Document the reference quantity, its units, conversion into the tracer's RGB transport convention, directional cosine factors, and sky integration. Do not confuse a solar disc's radiance or a sky display color with the integrated incident energy used by the source estimator. Account for angular integration and cosine factors exactly once.

Normalize direct Sun and diffuse sky together, including their relative contribution, with a consistent relationship to the existing luminaire flux/color scale. Preserve the four luminaire types' declared total lumens, enabled/dimming, dimensions, orientation, and Kelvin semantics. Do not change lamp power to compensate for daylight or silently switch the meaning of existing transport units.

A bounded clear-sky reference is sufficient; a full atmosphere renderer is not required. Reference constants, atmospheric assumptions, approximation ranges, sky angular distribution, and any lower-hemisphere policy must be explicit. Do not fabricate an exterior ground mesh or duplicate Sun energy in both an environment and the explicit source.

Use the existing validated solar position, apartment orientation, and zoned instant. Brightness must change coherently with Sun elevation, including low Sun, sunrise/sunset, twilight/night, and supported geographic edge cases. A summer date alone must not force daytime output when the actual Sun is below the horizon. Direct Sun must be absent below the horizon; nighttime luminaires remain usable without artificial daytime fill.

Separate lighting quantities from display appearance. Traced camera/reflection escape rays and sampled sky lighting must evaluate a consistent environment. The existing Interactive sky/light appearance remains intact; do not apply tracing calibration gains to raster lights, VXGI helpers, or the default renderer as a side effect.

### 3. Measure indirect transport and material energy

Evaluate the current eight-opaque/24-total limits against longer-path references, including at least 8, 16, and 32 opaque interactions with adequate total-interaction headroom. Isolate truncation from roulette and sampling noise. Choose any production-limit change from measured residual contribution and correctness; do not assume more bounces alone will solve the symptom.

Retain correct Russian-roulette compensation. Compare controlled results with and without roulette under equivalent path limits to verify expectation within statistical uncertainty. Removing roulette or increasing survival probability must not be presented as added illumination.

Validate BSDF throughput, lobe/source PDFs, MIS, geometric/shading-normal handling, pane transmission, and AO so correct energy is neither attenuated twice nor counted twice. Evaluate material losses against independent analytical/numerical or established reference expectations. Energy upper-bound tests alone are insufficient to establish realistic reflectance; inspect expected retained energy as well.

Distinguish legitimate absorption in dark materials and defined AO from unintended loss. Include nonmetallic painted surfaces and diffuse-dominant room finishes, alongside relevant rough/polished metal controls. Do not restore brightness by ignoring map factors, removing AO semantics, forcing high albedo, deleting Fresnel, or weakening existing passive-energy tests.

Corrections to the bounded PBR energy model or normal treatment are in scope only when the audit demonstrates their relevance and a physically justified improvement. Preserve the accepted material contract, texture mapping, glossy source/architecture reflections, finite stable endpoints, and normalization. Document any remaining single-scattering or other approximation and its measured effect.

Keep actual two-sided architectural occlusion, tiny geometric offsets, clear-pane behavior, and bounded traversal failure discipline. Longer paths or altered sampling must not create bright sealed rooms or leaks across thin partitions.

### 4. Linear measurements and presentation baseline

Measure the accumulated linear HDR image before tone mapping/output conversion. Use documented fixed regions or reference receiving surfaces for direct-lit and indirectly lit areas; record luminance and their ratio, relevant source quantities, and uncertainty/convergence evidence. Do not infer energy from JPEG/sRGB capture brightness alone.

Provide reproducible comparisons for Sun-only, sky-only, combined, path-length variants, and neutral-versus-PBR/AO controls. Reference expectations and numerical tolerances must be justified independently of whichever constants make the screenshot look attractive. Measurements may be produced by bounded renderer/test diagnostics without adding a permanent product UI.

Use existing AgX/0 EV as the initial fixed before/after presentation baseline. Additional documented fixed exposures may assess scene dynamic range, but matched comparisons must retain the same presentation. Explain how the final lighting reference relates to that baseline and whether remaining darkness is an exposure or source/transport issue.

Preserve `2 ** exposureEV`, supported tone mappers, and output conversion exactly once. Manual exposure remains a camera/presentation adjustment and must redraw retained samples. Do not change stored design presentation overrides, EV meaning, application defaults, or apply a hidden exposure offset. Exposure-only changes do not satisfy this task's source/transport correction goal.

The final public reference must show assessably improved illumination outside its Sun patch with the same materials, camera, and presentation used for the baseline. Direct patches must retain meaningful highlights/shape and material response; raising all pixels to clipped white is not acceptable evidence.

### 5. Optional sky-sampling improvement

First establish source and transport correctness. If finite-sample measurements show that window escape sampling prevents reliable assessment, add a bounded environment/source estimator or window-guided proposal with correct PDF/MIS accounting and unbiased support for the contributing paths.

A window used to guide sampling remains an architectural aperture, not an added emitter. Preserve actual pane transmission, frame/reveal/blocker visibility, and other legitimate exterior routes. Do not brighten rooms by assigning artificial flux to a window, accepting rays through occluders, or double counting explicit Sun or escaped-sky contributions.

Compare the changed estimator against the same lighting integral/reference. Improved convergence must reduce variance without an unexplained shift in expected brightness. General performance optimization and a full portal framework are not required.

### 6. Runtime behavior and accepted regressions

Keep Physical Sunny and the existing opaque PBR/clear-pane subset. Unsupported alpha, glazing, weather, and backend conditions remain explicit. Daylight calibration must work with all existing material roles and all four effective luminaire types in day/night/mixed scenes.

Keep Interactive/VXGI as the fast navigation view and path tracing as the explicitly selected progressive view. Do not change Interactive source scales, material appearance, GI/bloom intent, navigation, or camera projection. Selection/pause/sample state remains session-only.

Source/transport-input changes must clear stale accumulation, including while paused, while preserving pause, camera/navigation, and daylight control state. Presentation-only changes retain history. Preserve hidden/2D/unmount/ineligible/failure/disposal cancellation and safe ownership of any added resources.

Any new numeric/reference parameters must be finite and validated at the appropriate boundary. Backend failures remain distinguishable from valid architecture/design/material data, with Interactive accessible. Calibration must not bypass the existing allocation/capacity protections for PBR textures or lights.

Do not add new user-facing intensity controls to make correctness dependent on manual tuning. Update help/status text only where implemented behavior or documented limitations change.

## Technical and Architectural Constraints

- Preserve exact authoritative geometry, validation-before-3D, and the canonical Apartment SVG. Approximate daylight calculations must not modify project architecture.
- New renderer-independent daylight reference quantities/calculations belong in `packages/simulation` where appropriate. RGB adaptation, lighting uniforms, BSDFs, HDR diagnostics, and GPU ownership belong in `packages/renderer-three`; React retains controls and application workflow.
- Reuse existing solar/civil-time semantics, resolved materials/luminaires, physical meshes/mapping, and project APIs. Do not introduce a parallel loader or persistent calibration format.
- Extend the existing bounded WebGL2 experiment under ADR-003. Do not replace the default renderer or add a general rendering/diagnostic framework.
- Keep calibration deterministic for fixed inputs and assumptions. Document units, reference ranges, constants, tolerances, and intentionally approximate behavior.
- Do not weaken prior validation, passive-energy, source-flux, occlusion, or ownership assertions to obtain brighter images. Update expected values only where this task deliberately and correctly changes the model.
- Do not modify normative specifications or any task artifacts during implementation. Current-runtime documents must distinguish implemented calibration from expectations or future work.

## Files and Areas Expected to Change

Expected areas include:

```text
packages/simulation/src/
packages/simulation/test/
packages/renderer-three/src/apartment-renderer.ts
packages/renderer-three/src/physical-sky.ts
packages/renderer-three/src/path-tracing/
packages/renderer-three/test/
apps/web/src/ and apps/web/test/ where daylight/tracing lifecycle or help requires updates
fixtures/projects/
docs/architecture/daylight-path-tracing.md
docs/architecture/overview.md
docs/decisions/ADR-003-three-renderer-architecture.md
README.md
AGENTS.md
```

This is guidance, not a requirement to change every listed area. Keep corrections narrow and leave earlier browser evidence and VXGI evaluation history intact.

## Dependencies

No new dependency is expected. Use existing simulation/Three.js/tracing infrastructure and focused local reference calculations. Do not add a second rendering engine or large analysis framework just to tune this scene.

If a dependency change is demonstrably necessary, follow `AGENTS.md` and the coding guidelines: inspect current registry metadata, evaluate the newest stable major, select the newest non-deprecated mutually compatible stable version, keep versions consistent, and document evidence-backed exceptions. Do not guess versions, force installs, ignore peers, or add speculative overrides.

Use primary daylight and transport references. Record equations, assumptions, exact source/revision, and licensing/provenance for incorporated code or assets in architecture documentation and the relevant provenance file. Do not imply physically measured spectral power from a qualitative RGB conversion.

## Testing Requirements

Add focused coverage for changed behavior, including:

- chosen clear-sky reference values, units/conversions, cosine/angular normalization, direct/diffuse balance, and deterministic elevation dependence;
- low Sun, below-horizon direct output, twilight/night, latitude/time edge cases, and preservation of solar/orientation/civil-time behavior;
- analytical receiving-plane/environment controls and independent source/BSDF energy expectations, including retained energy and numerical endpoints;
- roulette expectation and path-truncation comparisons with justified tolerances/statistical treatment;
- PBR reflectance/AO/normal/pane isolation and all-four-luminaire power/visibility regressions;
- consistent sky evaluation and correct PDF/MIS/support if an additional estimator is implemented;
- accumulation invalidation, pause/history retention, presentation-only redraw, cleanup/capacity failures, and unchanged Interactive behavior.

Use focused deterministic/analytical cases where possible and adequate sampling for stochastic checks. Do not make flaky per-pixel stochastic equality assertions or derive expected physical values solely from the current implementation. A matched CPU formula or an energy upper bound alone does not prove final interior illumination.

Create valid public project fixtures for the two-window summer room, source/reflectance controls, windowless/sealed control, and thin-wall/blocked-light cases. Use existing formats and supported materials; no runtime-only architectural replacement or fabricated exterior geometry is allowed. Reference helper data must be clearly derived/test-only, not a competing architectural source of truth.

The real-browser review matrix must include:

| Case | Required evidence |
| --- | --- |
| Summer two-window reference | Matched baseline/final views at June 21/noon, fixed AgX/0 EV, neutral light finishes, visible direct patch and illuminated shaded regions; linear luminance/ratio measurements. |
| Source isolation | Direct Sun, diffuse sky, and combined measurements identifying the correction and ruling out double counting. |
| Transport audit | 8/16/32-interaction comparisons, roulette controls, and neutral/PBR/AO variants separating truncation, material loss, and variance. |
| Morning/noon/afternoon | Actual solar direction and calibrated Sunny brightness change coherently without scene-specific tuning. |
| Nighttime and mixed lights | Below-horizon Sun output is absent; all four luminaires retain power/appearance at matched presentation; daylight/artificial balance is explained. |
| Occlusion controls | Windowless/sealed room and chamber across a thin partition remain dark; a blocked opening cannot deliver sky/Sun through opaque geometry. |
| Accepted material/light regressions | Texture mapping, reflective source/architecture paths, clear panes, concealed-strip bounce route, and source sidedness remain correct. |
| Runtime controls | Pause/input reset, exposure/tone redraw, 2D/3D, and return to Interactive preserve their accepted behavior. |
| Open Space, if accessible | Actual original-case baseline/final under documented matching inputs; otherwise an explicit NOT RUN/access limitation and public-proxy distinction. |

Compare static sample checkpoints and linear-region stability with sufficient accumulation to distinguish noise from a persistent mean difference. Roughly 1,024-1,500 samples are useful initial checkpoints, not proof of convergence or a deadline. Longer reference runs are allowed. Report residual error/noise rather than choosing favorable frames.

Store actual browser captures, measurement results, reproduction settings, and assumptions under a clearly named architecture evidence directory. Private apartment resources remain outside the repository. Do not claim that a public fixture reproduces or fixes an unavailable private apartment.

## Documentation Requirements

Update `docs/architecture/daylight-path-tracing.md` with the diagnosis, chosen daylight reference and unit scale, Sun/sky relationship, exposure baseline, audited energy/path-limit results, any sampling correction, runtime effects, reproduction steps, measured before/after results, and remaining approximations.

Update relevant current-runtime sections of `docs/architecture/overview.md`, `README.md`, and `AGENTS.md`. Refine ADR-003's experimental-backend section for the accepted tracing-specific calibration/model change without rewriting historical decisions or implying that Interactive/VXGI now uses the new source scale.

Record evidence separately from human acceptance. A brighter screenshot alone does not establish calibrated transport, and this bounded reference is not a certified illuminance prediction. Preserve earlier evidence as historical results.

Do not modify any file under `docs/tasks/`.

## Verification

Run the standard root checks after implementation:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run the source/transport/reference measurements and real-browser matrix through the normal project-loading workflow. Inspect output and browser errors; confirm that matched controls preserve exposure, camera, materials, and intended source conditions.

If dependency manifests or the lockfile change, also inspect current registry metadata and run:

```bash
pnpm outdated --recursive
pnpm install --frozen-lockfile
```

Newer incompatible releases may remain unselected only with evidence-backed justification. Report every required command, reference measurement, or browser case that could not be run and why. Do not claim success for unexecuted checks. Performance benchmarking is not required.

## Acceptance Criteria

The task is complete only when:

1. A reproducible baseline establishes the reported dark-indirect-light symptom and distinguishes source scale, material/path losses, presentation, and finite-sample error through measured controls.
2. Sunny direct Sun and diffuse sky have a documented coherent reference, dimensional conversion, elevation behavior, and relationship to the existing luminaire transport scale. Calibration is not an arbitrary scene-specific gain.
3. The final public summer-room image shows convincing illumination outside the direct patch at matched materials/camera/presentation, supported by linear-light values/reference expectations and residual-error evidence.
4. Bounce/roulette/material audits justify the chosen production transport settings and any energy correction without weakening passive-energy, source-flux, AO, or geometry semantics.
5. Sky contributions and any optional source estimator preserve expected illumination and actual visibility, without duplicate Sun/environment energy, artificial window emitters, or unoccluded fill.
6. Sealed/thin-wall/blocked-opening controls retain correct darkness, while accepted PBR, glazing, concealed-strip, all-four-luminaire, nighttime, and mixed-light behavior remains intact.
7. Exposure retains its existing meaning and presentation-only history behavior; no stored design overrides, hidden exposure offsets, or automatic adaptation supply the fix. Interactive/VXGI appearance and navigation remain intact.
8. Required tests, root checks, measurements, and public browser cases pass; the original Open Space case is verified when accessible or explicitly recorded as unavailable for subsequent human review.
9. Architecture/provenance documentation records the actual diagnosis, correction, reference assumptions, quantitative/visual evidence, and limitations. No new format, weather feature, editor, renderer framework, or unrelated functionality is introduced.
10. Any dependency change satisfies current metadata/compatibility and frozen-lockfile requirements.

Human visual acceptance remains the final review step. Do not declare the required dark-interior correction complete solely because checks pass, source constants changed, or exposure made a capture brighter.

## Final Response

Provide a concise execution report containing:

1. the diagnosis and implemented correction, including the main files/areas changed;
2. daylight reference quantities/units, calibration assumptions, exposure baseline, and material/path/roulette findings;
3. before/after linear measurements, uncertainty/convergence observations, and public/private reproduction status;
4. tests added/updated, verification commands actually run, browser evidence links, and remaining limitations;
5. dependency/provenance changes and evidence-backed version exceptions, or `None`;
6. deviations from this description, or `None`;
7. follow-up work identified, or `None`;
8. a suggested Conventional Commits implementation message with a concise body and this trailer:

```text
Task: TASK-047
```

Do not stage, commit, push, pull, fetch, or perform other Git write/synchronization operations. Do not modify this description, task records, or any other file under `docs/tasks/`. Leave the implementation working set for human review and finalization.
