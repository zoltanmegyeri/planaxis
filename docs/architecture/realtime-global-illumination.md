# Native-WebGPU global illumination: integration and evaluation

Evaluation date: 2026-10-08. Three.js 0.186.1; no dependency changes.

## Task closure and known limitations

On 2026-10-08, the human maintainer declared **TASK-043 completed with known limitations**
and set aside further VXGI work in favor of a separate path-tracing discussion. The uncommitted
integration is retained. This closure accepts the unresolved findings below; it does not mean
that every original Stage 4.6 visual acceptance criterion passed. No path-tracing replacement
has been selected or implemented by this task.

The renderer/browser integration is implemented.
Sun, point and spot lights provide indirect illumination, finite refinement returns idle, and
native/fallback lifecycle checks pass. Strong local lights still create obvious illumination
behind opaque 10 cm partitions. Directional radiance reduces that leakage but does not eliminate
it.

The reference M1 also permits only 16 samplers per shader stage. Twelve shadow-casting design
lights render successfully; 32 shadow samplers and the 40-light/36-proxy stress scenes exceed
that hardware limit. This limits stock Three.js direct shadow rendering as well as VXGI injection.
The preferred GI budget is device-bounded, but this does not remove the direct-rendering limit
for arbitrarily large shadow-light collections or heavily textured materials.

## Runtime contract and defaults

One existing WebGPURenderer/RenderPipeline owns the graph:

```text
opaque depth / packed view normals / velocity
    -> VXGI -> GI context with neutral geometric AO
    -> HDR scene -> TRAA -> optional HDR bloom -> tone mapping / output conversion
```

Material AO remains active. Prepass light layers exclude lighting/shadow evaluation without
replacing architectural materials; transparency is excluded. GI passes use no MSAA. Disabling
GI releases its resources and restores the existing HDR/bloom path. WebGL2 has no VXGI and
retains direct lighting, shadows, bloom, presentation and navigation.

| Parameter | Integration default | Starting evaluation value |
| --- | --- | --- |
| Resolution | 256 | 256 |
| Directional radiance | On | On |
| Additional cached bounces | 0 | 1 |
| Screen-space indirect bounce | Enabled | Enabled |
| Cone count / aperture | 1 / 25° | 4 / 40° |
| Cached-bounce aperture (unused at 0 bounces) | 10° | Stock 60° |
| GI intensity | 8 | 1 |
| Step scale | 0.5 | 0.5 |
| Normal offset | 0.5 voxels | 1.5 voxels |
| Trace distance | Unbounded | Unbounded |
| Temporal filtering | On | On |
| Additional refinement draws | 32 | 16 |
| Preferred injection budget | 32, bounded by device texture/sampler limits | 32 |
| Architecture bounds margin | 0.25 m | 0.25 m |

These are evaluated integration defaults, not a claim of completed production acceptance.
Disabling cached propagation reduced leakage and reinjection cost. Narrow 10° cones were
prohibitively expensive; one 25° cone retained 256-voxel precision and usable navigation.
One cone leaves visible sampling noise, particularly under intense artificial lighting.
Eight, sixteen and thirty-two refinement draws were compared. Mean irradiance settled quickly,
but longer refinement improved noise only modestly; 32 remains finite and covers the temporal
sampling cycle. Sampling noise and occlusion remain limitations of the retained integration.

Renderer GI settings contain only transient `enabled`; renderer default is Off. The browser
restores High as On when native WebGPU is available and Performance/Balanced/Custom as Off.
Explicit named presets recommend Off/Off/On. Manual GI edits never change quality or bloom;
later DPR/quality-field edits retain GI. The state survives 2D/3D, camera, design/material,
lighting-mode, resize and fullscreen changes and is never persisted.

## Bounds, lighting and lifecycle

The collector borrows opaque architectural mesh references without reparenting; glass,
semantic markers, targets and helpers cannot enlarge voxel bounds. Model/finish replacement
re-voxelizes; Sun/time/weather/luminaire/shadow updates reinject; camera movement changes only
the screen-space/temporal result. Camera jumps, mode/lens changes, resize/DPR and presentation
discontinuities reseed TRAA history. Invalidation draws immediately and restarts a bounded RAF
burst. Disposal, device loss and rendering/uncaptured GPU errors cancel pending refinement.

The injection policy orders Sun/Studio key first, four Physical sky sources next, then enabled
design luminaires by stable design-local ID. Zero-output sources are excluded. The preferred
32-light budget is reduced by actual allocated GPU limits; a 40-candidate unit test verifies
selection independent of traversal order. The GPU many-light case verifies twelve actual lights,
not just a CPU selector or the stock eight slots.

Four fixed hemisphere directional sky sources use 1024-square shadow maps. Total daytime
strength is 2 in Overcast and 0.6 in Sunny; Overcast is cooler, twilight fades, and night is zero.
They remain separate from visible sky, Studio PMREM and quality Fill. This is a qualitative
renderer approximation, not a sky integration or calibrated photometric model. The windowed
Overcast scene is visibly brighter than its sealed counterpart; its mean GI-buffer irradiance
was approximately 0.00767 versus 0.00311. Those screen-wide means are diagnostic, not physical
measurements, and opening/background pixels differ.

Three r186 integration details are isolated in the adapter:

- Provision its constructor's fixed eight-light uniform arrays before shader build.
- Request advertised texture/sampler limits using the same compatibility-adapter mode.
- Advance the renderer node frame for each requested GI draw so FRAME effects are refreshed
  between housekeeping RAFs, including offscreen shadow preparation and the visible frame.
- Warm the exact HDR lighting context through the same pipeline after geometry/light changes,
  then reinject from completed shadow maps before visible output.
- Reseed TRAA through its public resize path while retaining effect/shader identities.

Reversed depth replaces logarithmic viewing depth because stock VXGI local-light injection
expects conventional/reversed shadow depths. Architectural depth nodes select projection and
initialized backend convention per render; WebGL2 may use forward depth. Local lights use zero
depth bias plus 2 mm metric normal bias. Floors, like ceilings, block local sources from either
side without fabricated slab thickness; the floor still does not cast overhead directional
shadows. A below-floor 10,000-lumen case is now almost black, instead of illuminating the interior.

## Practical matrix

The harness validates Apartment SVG 2.2 through the complete parser/schema/reference/geometry
pipeline before model generation. Its two-room footprint is 900 × 400 cm with 260 cm ceilings,
20 cm exterior walls, a 10 cm partition, a west window and a genuine 110 cm doorway. Closed
partition cases remove that doorway. No architectural/domain bypass supplies the test model.

| Case | Observed result |
| --- | --- |
| Sunny window | Visible secondary ceiling/wall illumination compared with GI Off; modest strength. |
| Connected rooms | Weak visible contribution through the actual doorway; no claim of convincing multi-bounce transport. |
| Overcast window/sealed | Windowed room receives diffuse daylight and is visibly brighter; sealed room stays dark. |
| Thin point partition | **Fails:** 5,000 lm source 90 cm from the 10 cm wall illuminates the opposite room. |
| Thin spot partition | **Fails:** bright patch/edge glow remains; directional On substantially reduces Off's leakage. |
| Contact stress | **Fails:** 5,000 lm source 20 cm from the partition leaks strongly. |
| Above ceiling / below floor | Rooms remain nearly black after two-sided local floor occlusion; faint boundary artifacts remain. |
| Point | Useful secondary surface illumination; intense diffuse result still shows noise. |
| Hidden spot | Wall-directed spot illuminates surrounding surfaces and interacts with HDR bloom. |
| Twelve lights | All twelve contribute; stable selection and rendering extend beyond stock's eight-slot allocation. |
| Forty lights / 36 proxies | Hardware sampler limit exceeded; these are unsupported stress results, not usable measurements. |
| Dynamic lighting | Reinjection updates sources; measured separately from re-voxelization and camera-only draws. |
| Temporal interaction | Finite 8/16/32 schedules verified; native Walk/Inspection switches and history reset exercised. |
| Lifecycle | Native resize/aspect, quality, exposure, lighting, luminaire/model replacement, GI On/Off/On and disposal pass in the final smoke run. |
| Fullscreen | Native entry/exit retains GI resources/camera and resets history; browser state also covered automatically. |
| WebGL2 | Real forced fallback renders point shadows/HDR bloom/output with GI unavailable. |

Earlier prototype GPU failures (MSAA/depth format, stale frames and hardware binding overflow)
were inspected rather than treated as valid timings. The final supported smoke run had no fresh
GPU validation errors. Rapid early lifecycle experiments also logged destroyed-shadow submissions;
the final native lifecycle repetition passed after the pipeline/depth/frame fixes. Retest these
resource transitions on future Three.js upgrades and other GPUs.

Representative captures: [hidden spot](gi-evaluation/hidden-spot.jpg),
[failed point partition](gi-evaluation/thin-partition.jpg),
[failed spot partition](gi-evaluation/thin-spot-partition.jpg),
[Overcast window](gi-evaluation/overcast-window.jpg),
[Overcast sealed](gi-evaluation/overcast-sealed.jpg),
[blocked below-floor light](gi-evaluation/below-floor.jpg),
[twelve lights](gi-evaluation/many-lights.jpg).

## Rectangular proxy experiment

The engineering-only prototype splits nominal output across wide 150° spots, using up to four
linear samples and a 3 × 3 area grid at approximately 50 cm spacing. It preserves the Design 1.1
one-sided frame and replaces the rectangular direct light during comparison to avoid doubled
output. The ordinary area/linear cases produce useful GI, but change direct edge/hotspot appearance
and need additional shadow maps. First area/linear proxy frames took about 1.51/1.11 seconds,
including shader compilation. The 36-spot stress case exceeded the M1 sampler limit and produced
invalid pipelines, so its timing is deliberately not reported as performance evidence.

The approximation is **rejected for production**. Linear/area retain their existing shadowless
RectAreaLight direct rendering and do not inject VXGI. The experiment remains only in the opt-in
evaluation harness. No GI-only rectangular light fork or persistence semantics were introduced.
Compare [direct area rendering](gi-evaluation/area-direct.jpg) and
[area spot prototype](gi-evaluation/area-proxies.jpg).

## Fixed-buffer performance

Reference: Apple M1, eight GPU cores; native WebGPU Metal 3, Chromium 154 in the Codex in-app
browser. Drawing buffer: 1920 × 1080, DPR 1, AgX, bloom enabled, Medium direct shadows.
The following broad matrix was measured during the initial iteration at GI intensity 1;
the review continuation below measures the current intensity 8 default separately.
The table records CPU submission plus awaited GPU queue completion for forty small camera
movements after warmup. FPS is `1000 / mean duration`, not a vsync/frame-pacing measurement or
an automated performance guarantee. Initial frames include shader compilation. Warm voxelization
and light reinjection include shadow preparation plus final output; they are distinct operations.

| Daylight variant | Interactive ms / FPS equivalent | Initial ms | Warm voxelization ms | Reinjection ms |
| --- | --- | --- | --- | --- |
| GI Off | 1.5 / 675 | 107 | 0.6 | 0.7 |
| 128 isotropic, 4 × 40°, 1 cached bounce | 27.2 / 37 | 194 | 131 | 67 |
| 256 isotropic, 4 × 40°, 1 cached bounce | 30.1 / 33 | 212 | 205 | 143 |
| Integration default, 256 directional, 1 × 25°, 0 cached | 26.0 / 38 | 213 | 136 | 58 |
| Default + 1 cached bounce | 26.0 / 38 | 319 | 310 | 225 |
| Default + 2 cached bounces | 26.2 / 38 | 497 | 493 | 391 |
| Default with budget 16 | 26.0 / 38 | 210 | 138 | 58 |
| Default with 2 cones | 41.5 / 24 | 205 | 165 | 87 |
| Starting 256 directional, 4 × 40°, 1 cached | 49.5 / 20 | 279 | 233 | 138 |
| 256 directional, 3 × 40°, 1 cached | 40.5 / 25 | 277 | 212 | 119 |

The rejected 2 × 10° directional setup took 136 ms per draw (approximately 7 FPS), demonstrating
that reducing aperture alone is not a viable leakage fix. Spatial resolution was retained at 256
after reducing cone cost.

| Twelve-light variant | Interactive ms / FPS equivalent | Initial ms | Warm voxelization ms | Reinjection ms |
| --- | --- | --- | --- | --- |
| GI Off | 21.4 / 47 | 1640 | 22 | 68 |
| 128 isotropic, 4 cones | 35.5 / 28 | 544 | 173 | 127 |
| 256 isotropic, 4 cones | 39.5 / 25 | 603 | 262 | 214 |
| Integration default | 35.9 / 28 | 381 | 178 | 140 |
| Default + 1 / 2 cached bounces | 36.9 / 27; 36.6 / 27 | 526; 665 | 372; 516 | 309; 474 |
| Default with budget 16 | 37.1 / 27 | 573 | 190 | 145 |
| Default with 2 cones | 58.3 / 17 | 404 | 193 | 168 |
| Starting 4 cones / reduced 3 cones | 61.5 / 16; 51.7 / 19 | 454; 431 | 264; 246 | 208; 202 |

Budget 16 versus preferred 32 has no meaningful cost/selection difference in the supported
twelve-light scene; it contains fewer than sixteen candidates. Actual 32-shadow injection failed
the hardware sampler limit and is not claimed to have passed GPU validation. CPU selection and
slot provisioning are tested above 32 candidates. The initial intensity-1 default achieved 28 FPS in this
many-light case and 38 FPS in daylight; the preferred 45–60 FPS range is not achieved with GI.

## Review continuation: stronger indirect illumination

Human review found the unity-strength contribution barely visible. The renderer default now
uses `giIntensity = 8`, compared with the previous 1. This multiplies only the indirect
irradiance in VXGI before the HDR scene pass. Direct Sun/sky/luminaire power, material values,
exposure, tone mapping, quality/bloom state and persistent formats are unchanged. It is
qualitative renderer tuning, not a calibrated light-energy claim.

The same 1080p harness compared gains 1/4/8/16. In Sunny, screen-wide GI-buffer means were
approximately 0.03158/0.12632/0.25228/0.50453. Gain 8 makes secondary ceiling/wall illumination
clearly more visible; 16 adds less useful visual improvement and washes out strong artificial
lighting. The Studio comparison preserves the built-in environment, which already provides
most of the room illumination: GI-buffer means increased from 0.00337 to 0.02696, but the
displayed difference is less pronounced than in Physical. These means remain diagnostics,
not pixel-perfect assertions or photometric measurements.

At gain 8, Overcast window/sealed means were 0.06143/0.02485; the windowed room is visibly
brighter while the sealed room remains dark. Doorway contribution is stronger but still weak
in the adjacent room. Hidden-spot bounce becomes pronounced and retains the HDR bloom path.
The 2,000-lumen point case becomes very bright and loses surface contrast. Existing thin-wall
leakage is also amplified (mean approximately 10.02 versus 1.25 at unity), so this adjustment
does **not** resolve the original task's hard occlusion acceptance failure. Below-floor blocking remains
effective apart from brighter boundary artifacts.

Repeated intensity-only measurements used the same reference GPU/browser and fixed buffer,
with 16 warmup and 40 camera-movement draws per variant:

| Case / gain | Interactive ms / FPS equivalent | Initial ms | Warm voxelization ms | Reinjection ms |
| --- | --- | --- | --- | --- |
| Sunny / 1 | 26.0 / 38.4 | 222.0 | 137.6 | 58.9 |
| Sunny / 8 | 26.4 / 37.8 | 217.4 | 139.6 | 58.6 |
| Twelve lights / 1 | 38.5 / 26.0 | 789.0 | 197.8 | 132.3 |
| Twelve lights / 8 | 39.7 / 25.2 | 364.5 | 198.0 | 134.7 |

The graph and sample count are unchanged; the gain adjustment adds no passes. Timings are
similar within this run, but the repeated many-light result remains below the 30 FPS target.
Native lifecycle and WebGL2 fallback pass with the new default; the final browser run reports
no GPU warnings or validation errors.

Compare [unity daylight GI](gi-evaluation/daylight-intensity-1.jpg) with
[stronger daylight GI](gi-evaluation/daylight-intensity-8.jpg). The harness's intensity and
Studio comparison controls are engineering-only; the application still exposes only GI On/Off.

## Automated verification

`pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass. The workspace suite contains
2,426 passing tests. A separate focused run passes 231 renderer tests and 244 browser tests,
including GI state, pipeline ordering, invalidation, finite scheduling, backend degradation and
resource/lifecycle behavior. `git diff --check` is clean. The production build retains Vite's
large-chunk advisory; it is not a build failure. Automated checks do not replace the failed
visual acceptance cases above.

## Reproduction and deferred investigation

From the repository root, start the opt-in engineering page with:

```bash
pnpm --filter @planaxis/web exec vite ../.. --host 127.0.0.1 --port 5174
```

Open `http://127.0.0.1:5174/packages/renderer-three/evaluation/index.html`. It is not part of
normal project serving. The controls are engineering inputs, not product/persistent VXGI settings.
Unsupported stress cases report the sampler limit before submitting invalid pipelines.

Thin-wall occlusion, shadow sampler sharing/atlasing, temporal noise, doorway transport and
broader GPU/textured-design evaluation remain unresolved findings retained for reference.
Further VXGI investigation is set aside by the task-closure decision. A separate discussion
will evaluate the maintainer's proposed Three.js path-tracing solution before any replacement
implementation is authorized. Luminaire placement/editing, IES and richer atmosphere remain
future Phase 4 work; Phase 5 asset placement remains separate. No normative specification or
task artifact was modified.
