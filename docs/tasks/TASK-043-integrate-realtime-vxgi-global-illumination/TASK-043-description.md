# TASK-043: Integrate Realtime VXGI Global Illumination

## Context

TASK-042 completed the Stage 4.5 WebGPU `RenderPipeline` and HDR bloom foundation. PlanAxis already has Physical daylight, procedural sky, Design 1.1 artificial luminaires, runtime quality presets, and WebGPU-first rendering with WebGL2 fallback.

Stage 4.6 now adds realtime indirect lighting. Three.js r186 provides `VXGINode` / `VXGIVolume`; PlanAxis has selected VXGI as the realtime GI technique because apartment geometry is mostly static while Sun and luminaire state change dynamically, and off-screen architectural occlusion is important.

VXGI remains a renderer implementation detail. The task must validate it against representative apartment-lighting cases rather than merely enable the effect.

## Required Reading

Before making changes, read and follow:

```text
AGENTS.md
README.md
docs/architecture/overview.md
docs/development/coding-guidelines.md
docs/development/testing.md
docs/decisions/ADR-002-react-browser-ui.md
docs/decisions/ADR-003-three-renderer-architecture.md
docs/specifications/planaxis-design/1.1.md
```

Do not read any other file under `docs/tasks/`.

## Goal

Integrate Three.js VXGI into PlanAxis High-quality rendering so indirect Sun, point-light, and spot-light bounce becomes convincing while wall/floor leakage remains acceptable and interactive rendering stays usable.

Also:

- provide useful diffuse Physical sky illumination through a renderer-owned approximation;
- experimentally evaluate bounded GI approximations for linear/area luminaires;
- preserve event-driven rendering through finite temporal convergence;
- keep WebGL2 fallback fully usable without VXGI.

## Scope

The task includes:

- native-WebGPU capability gating for realtime GI;
- renderer-owned transient GI enablement;
- VXGI integration into the existing `RenderPipeline`;
- depth/normal/velocity data required by VXGI/temporal resolve;
- temporal filtering with finite convergence bursts rather than a permanent idle animation loop;
- architecture-derived voxel bounds;
- indirect contribution from Physical Sun and supported artificial lights;
- an occlusion-aware diffuse-sky approximation for Physical lighting;
- deterministic management of the VXGI light budget;
- a bounded experimental spot-light approximation for linear/area GI;
- a single Global Illumination on/off control in Rendering;
- quality-preset recommendations;
- focused automated tests, practical visual/performance evaluation, and documentation updates.

## Out of Scope

This task does **not** include:

- changes to Apartment SVG, Design Format, Material Format, or project persistence;
- persistence of GI settings;
- user-facing VXGI tuning controls;
- exposing voxel resolution, cone count, bounce count, directional radiance, or similar implementation parameters;
- SSGI or LightProbeGrid as parallel production GI implementations;
- a private fork of Three.js VXGI solely to support linear/area lights;
- IES photometry;
- path tracing;
- luminaire placement/editing UI;
- furniture/model assets;
- professional photometric or building-energy accuracy.

## Functional Requirements

### GI runtime and quality behavior

Introduce renderer-owned transient GI state, separate from `RendererQualitySettings`.

Named quality selection applies only this recommendation:

```text
Performance -> GI Off
Balanced    -> GI Off
High        -> GI On when native WebGPU supports VXGI
```

Manual GI changes must not change the named quality preset or make it `Custom`.

Required behavior includes:

```text
High -> user disables GI
Quality remains High

Balanced -> user enables GI
Quality remains Balanced

High -> GI On -> user changes DPR
Quality becomes Custom
GI remains On
```

At initial browser restoration:

```text
restored Performance -> GI Off
restored Balanced    -> GI Off
restored High        -> GI On when supported
restored Custom      -> GI Off
```

GI state is not persisted separately.

On the WebGL2 backend, GI must be unavailable/disabled with a concise explanation while existing High-quality features remain usable.

### Render-pipeline integration

Use the existing `WebGPURenderer` and `RenderPipeline`; do not introduce a second rendering stack.

The High-quality GI path should conceptually be:

```text
depth / normal / velocity pre-pass
        ↓
VXGI
        ↓
GI lighting context
        ↓
HDR scene pass
        ↓
temporal resolve
        ↓
bloom when enabled
        ↓
tone mapping / output color conversion
```

Bloom must remain an HDR post-process after the temporally resolved GI-lit scene and before final output transformation.

VXGI geometric AO should initially be neutralized while GI is evaluated. It may be enabled only if practical evaluation shows a clear benefit without undesirable double-darkening with existing material AO; record that decision.

### Initial VXGI configuration

Start evaluation from:

```text
voxel resolution        256
directional radiance    on
cached bounces          1
cone count              4
cone angle              about 40 degrees
GI intensity            1
step scale              0.5
normal offset           1.5 voxels
maximum trace distance  unbounded
temporal filtering      on
light budget            32
```

These are engineering starting values, not persistent product semantics.

Evaluate alternatives where useful, especially:

```text
128 vs 256 voxels
directional radiance off vs on
3 vs 4 cones
1 vs 2 bounces
16 vs 32 injected lights
8 vs 16 vs 32 convergence frames
```

Prefer preserving 256-voxel spatial precision when possible. If performance requires compromise, first consider reducing light/proxy count or cone cost before reducing voxel resolution.

### Voxel bounds and invalidation

Derive VXGI bounds from apartment architecture, with a small renderer-owned margin (start around 0.25 m). Scene helpers, light targets, UI helpers, and unrelated objects must not accidentally expand the GI volume.

Preserve the distinction between:

```text
geometry/model change
    -> re-voxelization
    -> light injection
    -> temporal convergence

Sun/time/weather/luminaire change
    -> light reinjection
    -> temporal convergence

camera movement
    -> screen-space/temporal update only
```

Do not re-voxelize static architecture for ordinary camera or lighting changes.

### Finite temporal convergence

Keep PlanAxis event-driven.

Do not add a permanent animation loop solely for GI.

After a relevant invalidation, render an immediate frame and then a finite refinement burst. Start with 16 additional frames and compare approximately 8 / 16 / 32 during manual tuning.

Continuous active navigation may naturally keep requesting frames. Once interaction stops, the renderer must finish its bounded convergence burst and return idle.

Reset temporal history on discontinuities where prior-frame data is invalid, including camera jumps/mode switches and equivalent pipeline/viewport changes.

### Physical sky contribution

The visible procedural sky must remain distinct from GI implementation.

First implement/evaluate an occlusion-aware renderer approximation using a small fixed set of shadow-aware directional sky proxy lights, initially approximately four directions around the sky hemisphere.

Their color/intensity must derive from existing runtime daylight/weather state:

- stronger cool diffuse contribution in Overcast;
- weaker diffuse contribution in Sunny;
- fade through twilight;
- negligible contribution at night.

These are renderer-generated Physical-lighting helpers, not design luminaires, and must remain separate from the existing quality Fill light.

The target behavior is that an Overcast room with exterior openings receives meaningful diffuse daylight while an equivalent sealed room remains substantially darker.

If the directional-proxy approach is demonstrably unsuitable, a simpler time/weather-dependent fill approximation may be used only with a clearly documented limitation and without changing persistent semantics.

### Point and spot luminaires

Existing point and spot luminaires must participate in VXGI indirect illumination.

Indirect contribution must update after enabled/state/dimming/light changes without architecture re-voxelization.

### Linear and area luminaire experiment

Current linear/area luminaires use `RectAreaLight`, which stock VXGI does not inject.

Experiment with a bounded wide-spot approximation when GI is enabled. Start from a sampling strategy around:

```text
linear:
  ceil(length / 50 cm), capped at 4 samples

area:
  ceil(width / 50 cm) × ceil(height / 50 cm),
  capped at 3 × 3 samples
```

Split the luminaire's nominal luminous output across its proxy samples and preserve its one-sided orientation.

These counts are tuning inputs, not fixed requirements. Do not create one light per centimeter or per square centimeter.

Accept the approximation only if:

- direct appearance remains acceptable;
- indirect result is useful;
- performance remains acceptable;
- no excessive light-count/shadow cost is introduced.

If the experiment fails, retain the existing `RectAreaLight` direct rendering and leave linear/area VXGI contribution unsupported for this stage. This outcome does not fail the task if the hard GI acceptance cases pass.

Do not fork Three.js VXGI solely to create GI-only proxy lights.

### Light-budget policy

Do not allow Three.js scene traversal order to silently decide which lights enter VXGI.

PlanAxis must own a deterministic light-budget policy. Physical daylight sources and enabled design luminaires should be treated intentionally, with stable behavior when the configured budget is exceeded.

Start with a budget of 32 and evaluate 16 versus 32 on representative apartment lighting.

### UI and backend behavior

Expose one transient control:

```text
Global illumination
[ On / Off ]
```

Do not expose raw VXGI parameters.

The control must:

- update without rebuilding architectural/domain state;
- remain independent from bloom;
- remain independent from the quality preset after explicit preset recommendation;
- be disabled/unavailable on WebGL2 with an explanation;
- survive ordinary camera, design, material, lighting-mode, resize, and fullscreen changes within the renderer lifecycle.

## Evaluation Matrix

Perform practical evaluation using representative apartment geometry. The hard cases are:

| Case | Required behavior |
| --- | --- |
| Sunny window bounce | Direct Sun on floor/wall produces visible secondary illumination on surfaces without direct Sun access. |
| Connected rooms | A bright room contributes indirect light through a real doorway/opening without obvious through-wall leakage. |
| Overcast window vs sealed room | Windowed space receives meaningful diffuse daylight; equivalent sealed space remains substantially darker. |
| Thin wall / floor-ceiling leakage | Strong nearby lighting does not create obvious bright patches through opaque partitions; compare directional radiance off/on. |
| Point light | Secondary illumination is visible beyond the directly lit region. |
| Spot / hidden-light prototype | A bright indirectly lit wall can illuminate the surrounding room and interact naturally with existing bloom. |
| Many-light apartment | More than eight GI-capable lights behave deterministically and remain practically usable. |
| Dynamic lighting | Time/weather/luminaire changes re-inject lighting without unnecessary re-voxelization or stale GI. |
| Temporal interaction | Walk/navigation remains interactive; stopping converges for a finite burst and returns idle; camera jumps reset invalid history. |
| Lifecycle / fallback | Resize, aspect, fullscreen, model/design replacement and disposal remain correct; WebGL2 remains usable with GI unavailable. |

Linear and area proxy cases are experimental rather than hard acceptance requirements.

## Performance Evaluation

Use a fixed approximately 1920 × 1080 drawing buffer for comparable manual measurements and record the browser/GPU used.

Compare at least:

```text
GI Off baseline
VXGI 128
VXGI 256
256 + directional radiance
256 + 1 vs 2 bounces
256 + 16 vs 32 lights
256 + linear/area proxy stress case when applicable
```

Observe separately:

- steady interactive cost while navigating;
- initial/replacement re-voxelization cost;
- lighting-reinjection cost.

A practical target is roughly 30 FPS or better during continuous Walk on the reference development GPU, while 45–60 FPS is preferable. This is a manual engineering target, not an automated timing assertion.

The chosen production defaults must provide convincingly better indirect lighting while remaining genuinely interactive.

## Technical and Architectural Constraints

- Keep VXGI, sky proxies, temporal resources, light budgeting, and proxy-light implementation inside `@planaxis/renderer-three`.
- Keep browser code responsible for transient controls and preset interaction.
- Do not serialize GI/VXGI state into architecture, design, material, project data, or local storage.
- Preserve the existing renderer/domain separation and physical semantic luminaire model.
- Preserve Studio versus Physical lighting semantics.
- Keep the existing WebGPU-first / WebGL2-fallback architecture.
- Avoid new dependencies; use the repository's existing Three.js version.
- Do not modify any file under `docs/tasks/`.

## Testing Requirements

Add focused automated coverage for:

- GI settings/default validation and capability gating;
- Performance/Balanced/High/Custom recommendation behavior;
- manual GI override remaining independent from quality state;
- WebGL2 unavailable/disabled behavior;
- GI pipeline graph and bloom/output ordering;
- geometry re-voxelization versus lighting-only reinjection;
- camera-only updates avoiding re-voxelization/reinjection;
- finite convergence scheduling, stopping, and cancellation/reset;
- deterministic light-budget selection;
- sky-proxy lifecycle/state updates;
- linear/area proxy construction if retained;
- resize/fullscreen/model/design/lighting transitions preserving valid GI state;
- resource disposal and replacement safety.

Where practical, test stable configuration/lifecycle behavior without requiring a physical GPU. Do not add brittle pixel-perfect or performance assertions.

Follow `docs/development/testing.md` and do not weaken existing tests.

## Documentation Requirements

Update current-state documentation and ADR-003 to describe:

- VXGI as the native-WebGPU realtime GI implementation;
- production GI defaults chosen after evaluation;
- finite temporal convergence;
- sky-light approximation and its limitations;
- quality-preset recommendation and transient GI control;
- WebGL2 degradation behavior;
- linear/area GI support or the documented deferred limitation;
- remaining Phase 4 work.

Do not change normative persistence specifications.

## Verification

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Also run focused renderer/browser tests and the practical evaluation matrix.

## Acceptance Criteria

The task is complete when:

1. native-WebGPU High rendering can use VXGI through the existing renderer/pipeline architecture;
2. 256-resolution VXGI is used unless documented evaluation demonstrates an unacceptable practical cost;
3. wall/floor leakage is acceptable on representative apartment geometry, with directional radiance evaluated;
4. Sun, point, and spot lights produce useful indirect illumination;
5. Overcast Physical lighting provides useful opening-dependent diffuse daylight through the chosen sky approximation;
6. static architecture is not re-voxelized for ordinary camera or lighting changes;
7. temporal GI converges through a bounded event-driven refinement burst and returns idle;
8. GI enablement follows the agreed quality recommendations while remaining manually independent;
9. WebGL2 remains functional with GI clearly unavailable/disabled;
10. light-budget behavior is deterministic and practical for representative many-light scenes;
11. linear/area GI is either accepted after the bounded proxy experiment or explicitly documented as deferred while existing direct `RectAreaLight` rendering is preserved;
12. bloom, tone mapping, exposure, resize/fullscreen, navigation, design/material replacement, and renderer lifecycle remain compatible;
13. focused automated tests and repository verification pass;
14. the evaluation matrix and performance measurements support the selected defaults;
15. current-state documentation and ADR-003 accurately describe the implemented behavior and limitations.

## Final Response

Provide a concise report containing:

1. implementation summary and final GI architecture;
2. final VXGI defaults and any changes from the starting values;
3. sky-light approach and observed result;
4. linear/area experiment result and accepted fallback/support level;
5. light-budget policy;
6. temporal-convergence behavior;
7. performance measurements and reference browser/GPU;
8. evaluation-matrix results, including leakage observations;
9. tests and repository verification results;
10. main files/areas changed;
11. deviations from this description, or `None`;
12. follow-up items, or `None`;
13. a suggested Conventional Commits message including:

```text
Task: TASK-043
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.
