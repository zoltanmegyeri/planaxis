# Experimental daylight path tracing

Implemented 2026-10-09 for TASK-044, extended with design luminaires on 2026-10-11 for TASK-045.
This is a bounded qualitative experiment for human
review, not a renderer replacement or calibrated lux/irradiance prediction. The accepted
VXGI integration and its [known limitations](realtime-global-illumination.md) remain available.

## Selection and supported scene

In a validated 3D project, Rendering → View offers **Interactive** (default) and
**Path tracing (experimental)**. Tracing requires validated SVG location/north orientation,
Physical lighting, Sunny weather, and WebGL2 with `EXT_color_buffer_float` and a complete
RGBA32F framebuffer. Missing capabilities, unsupported inputs and shader/context failures
are explained. Return to Interactive remains available without invalidating the architecture.
Changing a lighting/weather setting never silently changes it to satisfy tracing eligibility.

The supported finishes are neutral architecture defaults and effective opaque, untextured,
nonmetallic matte base colors (roughness ≥ 0.5). They are treated as Lambertian diffuse surfaces;
there is no roughness-dependent glossy lobe. All texture roles, metallic/glossy finishes,
mask/blend alpha and frosted/tinted/other glazing explicitly disable tracing. Material 1.0/1.1
and Design 1.0/1.1 loading and persistence retain their existing version semantics.
Resolved Design 1.1 luminaires contribute at night and alongside daylight; bloom is bypassed.
Neither luminaire data nor the user's interactive GI/bloom intent is overwritten.

The tracer borrows `buildApartmentScene` meshes: the actual finish-partitioned wall surfaces,
opening reveals, floor/ceiling and fixed-element prisms. It excludes utility visualization
markers and camera/door helper groups. Existing centimeter-to-meter and `(X,Y,Z) → (X,Z,Y)`
conversion, adjusted winding, level offsets and voids are reused, without a second architectural
builder. Floors and ceilings retain zero thickness but intersect from both sides, independent
of raster culling, visibility and shadow masks. All opaque triangles are two-sided occluders.

Clear/unspecified panes remain the existing zero-thickness opening-center triangles. An IOR 1.5
Schlick approximation chooses reflection or straight-through transmission, without solid-volume
refraction or moving/removing panes. Sun shadow rays multiply pane transmission and stop at
opaque surfaces. This is qualitative clear glazing: no caustics, volumetric absorption,
frosting, tinting or inferred frames. Ray origins offset **0.00001 m (0.01 mm)** along the oriented
normal; positive intersections above **0.0000025 m** are accepted. These renderer choices do not
redefine the domain's `EPSILON`. The 1 cm partition controls exercise this scale.

## Transport and presentation

The existing `calculateSolarPosition`, `planaxisSunDirection` and `deriveDaylight` result drives
both views. Scene-to-Sun `(x,y,z)` maps to `(x,z,y)`; the same Sunny Sun color and qualitative
strength (`3 × directStrength`) feed next-event estimation at each diffuse hit. The tracer
continues cosine-weighted diffuse paths for up to eight diffuse interactions, with Russian
roulette after three and at most 24 total surface interactions. Glass visibility allows up to
32 crossings; exhaustion blocks light. Sun visibility is deterministic with sharp shadows.

Only rays that escape the geometry collect procedural sky radiance. The gradient reuses the
existing Sunny linear zenith/horizon palette, including the current horizon continuation below
the horizon. No external HDR/blue-noise asset, ground box, raster GI, Physical sky helper light,
Studio PMREM or fill is added. This sky is a qualitative environment approximation, not a
physical atmosphere or modeled exterior ground. Window reflections and diffuse escape sampling
can remain noisy; no spatial denoising or exposure compensation conceals occlusion failures.

Two RGBA32F targets hold a running **linear HDR average**, one independent sample per scheduled
frame. The output shader uses Three.js's current AgX, ACES Filmic or Neutral mapping,
`2 ** exposureEv`, and sRGB output once. There is no additional demo Reinhard/gamma transform.
Presentation edits redraw this image, retaining samples and geometry/BVH. Interactive bloom and
GI resume their retained behavior on return; there is no second bloom graph.

## Ownership, invalidation and navigation

A conventional `WebGLRenderer` owns a separate overlay canvas, shaders, triangle/AABB textures
and targets inside `renderer-three`. Its overlay accepts no input. The original viewport canvas
continues to own Orbit/embedded-camera/Walk navigation. The same perspective camera and actual
projection are borrowed: ray unprojection accounts for forward WebGL, forward WebGPU and
reversed depth. The accumulation key retains the projection's X/Y/W rows and clipping inputs;
Three.js adopting its depth encoding on the first Interactive draw preserves the viewing rays
and unchanged history. Actual focal length/aspect/offset changes still reset it.
Selecting a rendering view does not reframe or change focal length/aspect,
Physical instant, weather or presentation. See the dated [ADR-003 refinement](../decisions/ADR-003-three-renderer-architecture.md).

Model/finish/glazing replacement rebuilds the BVH. Camera pose/projection, viewport/effective
buffer dimensions (including DPR), architecture, daylight and every luminaire transport input
invalidate accumulation. Stationary
samples never mix different inputs. Pause retains the image and cancels tracing; Resume continues
unchanged inputs. A changed input while paused clears obsolete samples, awaiting Resume.
A 1,024-sample review is useful but is neither a quality guarantee nor a stopping limit.

`ProgressiveAccumulator` schedules only while selected, eligible, visible and unpaused. It stops
on hidden documents, 2D unmount, interactive selection, failure and disposal. Interactive VXGI
retains its finite 32-frame refinement. Selection and pause intent live in React session state
across 2D/3D; samples belong to the mounted backend and restart on remount. Nothing is stored in
local storage, descriptors, SVG or server APIs. The existing persisted quality preference is
independent and cannot select tracing.

Initialization/allocation/shader errors release owned resources and leave Interactive usable.
Disposal cancels work and releases textures, targets, geometry, materials, renderer/context and
overlay, including pending default-renderer initialization. The existing default initialization
completion guard prevents a disposed model from being rendered later. GPU/device errors cancel
both refinement mechanisms. An inactive renderer does not draw the apartment.

## Reproduction

From the repository root:

```bash
pnpm start -- --project fixtures/projects/daylight-path-tracing-windowed
```

Open `http://127.0.0.1:3000/`, choose **3D**, then camera **interior**. Use Rendering:

- Physical, Sunny, **2026-10-09 12:00 Europe/Budapest** (`2026-10-09T10:00:00Z`).
- Pixel ratio **1×**, Medium shadows, AgX, **0 EV**, bloom **Off**, Fill Off.
- Keep the same camera default 75° horizontal FOV, Fill aspect ratio, and viewport for all views.
- Capture Interactive with GI Off, then GI On where native WebGPU is available.
- Select Path tracing, close the panel, leave the camera stationary and pause for the capture.

The fixed instant has approximate solar azimuth **170.4573°**, elevation **36.1467°**, and
PlanAxis scene-to-Sun vector **(0.1338704, 0.7963352, 0.5898551)**. It enters the south window
and illuminates the floor, leaving walls and part of the floor outside the direct patch.
The complete room is 600 × 500 cm, 260 cm high, with 20 cm perimeter walls and one 180 × 160 cm
clear south window at a 70 cm sill. There are no artificial lights or assigned textures.

Stop the server and repeat normal startup with `fixtures/projects/daylight-path-tracing-sealed`
for the sealed control. Its SVG omits the window and restores the original full south wall;
no shader override seals it. Repeat all daylight/presentation/camera settings unchanged.
For `fixtures/projects/daylight-path-tracing-thin-wall`, the south window lights only the
right chamber and a complete **1 cm** opaque partition separates the left chamber. Camera
**interior** views the lit side; **sealed-side** views the dark side. Both files traverse normal
project loading, full SVG validation and model construction.

## Real-browser evidence

Verified in the Codex in-app browser on macOS with native WebGPU available for VXGI and a
working conventional WebGL2 float framebuffer for tracing. The browser viewport is 1280 × 720;
the apartment drawing buffer is 1280 × 666 at 1×. All comparison captures use the same
fixed instant, camera, neutral defaults, AgX/0 EV and bloom Off described above. There is no
per-image exposure tuning. The JPEG captures include the ordinary application toolbar;
[the settings capture](path-tracing-evaluation/windowed-settings.jpg) records the selected controls.

| Project/view | Samples/refinement | Capture and observation |
| --- | --- | --- |
| Windowed, Interactive GI Off | Event-driven raster | [Capture](path-tracing-evaluation/windowed-interactive-off.jpg): floor Sun patch and lit reveal; most other interior surfaces remain black. |
| Windowed, Interactive VXGI On | Existing finite 32-frame refinement | [Capture](path-tracing-evaluation/windowed-interactive-vxgi.jpg): indirect wall illumination, with grain and bright contact halos. |
| Windowed, path tracing | 1,382, paused | [Capture](path-tracing-evaluation/windowed-path-tracing.jpg): same floor Sun patch, visible cool secondary illumination on walls/floor, dark wall/ceiling contacts. |
| Sealed, Interactive GI Off | Event-driven raster | [Capture](path-tracing-evaluation/sealed-interactive-off.jpg): black interior. |
| Sealed, Interactive VXGI On | Existing finite 32-frame refinement | [Capture](path-tracing-evaluation/sealed-interactive-vxgi.jpg): wall illumination and contact halos remain despite the restored opaque wall. This is a retained VXGI failure, not a path-traced result. |
| Sealed, path tracing | 619, paused | [Capture](path-tracing-evaluation/sealed-path-tracing.jpg): black interior, without visible enclosure leakage. |
| 1 cm partition, lit side | 615, paused | [Capture](path-tracing-evaluation/thin-wall-lit-path-tracing.jpg): Sun on floor/partition and secondary wall illumination; dark floor/wall contacts. |
| 1 cm partition, sealed side | 523, paused | [Capture](path-tracing-evaluation/thin-wall-sealed-path-tracing.jpg): black interior behind the same partition. |

The path-traced windowed result visibly refines without persistent mixed-view ghosts. Grain
remains on secondary illumination, especially in the lower-sample partition capture. The
sealed controls show no visible final tracer leakage at these viewpoints; this does not
establish correctness for every geometry scale or apartment. These are qualitative agent
observations for human review, not an established overall advantage over VXGI. The lighting
models differ: raster VXGI retains its existing four diffuse-sky helpers and approximation,
while tracing samples the continuous sky only on escaped paths and uses Lambertian surfaces
and stochastic thin-pane reflection. Raster Sun shadows retain their established biases.

An initial real-shader failure is retained in
[this capture](path-tracing-evaluation/initial-reversed-depth-failure.jpg): the displayed count
was 1,072 during accumulation (1,077 when subsequently paused), but the camera rays pointed
backward and the expected window/Sun patch was absent. Hard-coded GLSL `-1` near depth was
incompatible with the shared native renderer's reversed projection. The final implementation
unprojects the camera's actual near-plane depth; a regression test covers WebGL, WebGPU and
reversed depth. This failure is resolved in the final captures above.

Normal browser interaction also confirmed pause/resume, camera-change reset (615 → 0 when
selecting the partition's sealed-side camera), full-screen buffer reset, return to Interactive
with the same embedded camera, and Neutral → AgX presentation-only redraw retaining all
1,382 samples. The final
browser console reported no shader/runtime warnings or errors. No browser capability failure
was observed on this machine; failure recovery is exercised separately by mocked boundaries.

## Verification and limitations

Focused tests cover actual scene extraction, meter/axis/level conversion, openings/clear-pane
classification, exclusion of markers, two-sided floor/ceiling/thin-wall intersections, effective
linear base colors, explicit unsupported inputs, deterministic BVH packing, Sun mapping,
camera/presentation retention, pause/resume, invalidation, hidden/disposed
cancellation and failure recovery. Mocked GPU tests establish lifecycle/contracts, not shader
appearance; browser evidence is separate.

TASK-044 repository verification: `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build`
all pass. The test run includes **2,441 passing tests**, including 13 added renderer tests and
two added browser workflow tests. Focused renderer/browser test and typecheck runs and
renderer/browser builds also pass after corrections. Earlier development failures (minimal
canvas mocks, the extra Rendering control count, a stale test camera matrix and a device-loss
test payload) were corrected without weakening the prior behavior assertions. The production
build retains Vite's large-chunk advisory; it is not a build failure. No required check was
omitted. No dependency manifest/lockfile changed, so dependency-change checks do not apply.

The current experiment supports Physical Sunny daylight and design luminaires. Studio/Overcast tracing,
full PBR/textures, caustics, denoising, native WebGPU tracing, exports and persisted jobs remain
outside scope. There is no performance target or benchmark. Very small geometry, very large
world coordinates and scenes beyond device texture capacity require further review. Diffuse
bounce limits/Russian roulette and the idealized sky/panes are approximations. Human review
must decide whether broader path-tracing work is warranted.

## Path-traced design luminaires

The existing application boundary supplies effective lumens after enabled/dimming once.
No design, Design 1.0, and Design 1.1 without luminaires replace the set with no sources.
Zero-effective sources have neither emission nor geometry. The renderer reuses the normative
forward/rolledSide/rolledVertical frame and maps model-space centimeters to meters once;
model-space Z already contains the level offset. Valid inconvenient placements are retained.

Point sources are isotropic delta emitters with intensity Phi/(4 pi). Spots use uniform
intensity Phi/[2 pi (1-cos(fullAngle/2))] inside the declared cone and zero outside. This
hard-edged, flux-normalized cone differs from Interactive's retained 0.2 penumbra policy.
Linear sources use the established length by **1 cm** rectangle; area sources use declared
width/height along the rolled axes. Both use one-sided Lambertian luminance Phi/(pi area).
The 1 cm width is a renderer approximation, with no added Design property or fixture housing.
Analytical sheets are visible and occluding from both sides, with emission only toward
forward; their backs absorb. They are independent of architecture/BVH and finish targets.
Point/spot lights have no visible bulb, sphere or radius.

All four types use the same **683 lumens per linear transport unit** scale. The retained
1000-40000 K approximate black-body sRGB fit is converted to linear RGB, then normalized to
Rec.709 luminance Y=0.2126R+0.7152G+0.0722B. Multiplying the normalized chromaticity by each
photometric coefficient divided by 683 preserves its Y/flux relationships. This scale is a
qualitative RGB surrogate based on maximum photopic efficacy, **not** measured spectral
power, manufacturer efficacy, white balance or calibrated photometry. Sun/sky keep their
existing qualitative strengths; exposure and tone mapping remain output presentation only.

At each diffuse interaction, next-event estimation selects **one of all effective sources
uniformly**, multiplying by the source count. Point/spot use explicit delta-source sampling.
Rectangles use a uniform position with area density 1/A; the estimator includes its reciprocal,
source cosine, receiving cosine, inverse-square distance and Lambertian BRDF 1/pi.
Fixed-flux resizing changes luminance and distribution without multiplying total output;
narrower cones redistribute the same flux. Canonical source ordering makes reordered runtime
sets use identical random sequences, without priority, selection budgets or omitted sources.

The integrator partitions estimators instead of using MIS: next-event estimation exclusively
estimates diffuse-to-emitter segments, including straight transmission through thin panes.
After a diffuse hit, an emitter path hit terminates without adding emission. Camera rays and
chains containing a subsequent specular pane reflection collect source-hit emission, since
direct source sampling does not estimate those reflected routes. Straight pane transmission
preserves this partition; each later diffuse interaction starts its own source estimator.
Diffuse continuation still finds real bounce surfaces, so an upward concealed strip can
light the room by sampling it from the ceiling and propagating that light to receiving walls
and floor. No ambient helper, bloom, unshadowed proxy or guided fabricated bounce supplies it.

Local visibility ends at the sampled source; architecture beyond it cannot block the lamp.
The selected sheet is excluded from its endpoint intersection, while other sheets occlude.
Architecture always intersects from both sides. Visibility re-aims to the sample from the
existing 0.00001 m normal offset, retaining the 0.0000025 m minimum intersection distance.
Near-coincident source samples within 0.00001 m are rejected to avoid singular estimates;
no larger offset moves origins across the 1 cm partition. Clear panes multiply transmission
using the existing IOR-1.5 Schlick approximation, with at most 32 crossings; exhaustion blocks.

Every effective source occupies five RGBA32F texels. A separate owned texture replaces
atomically after upload, leaving architectural textures/BVH intact. Capacity is the actual
device maximum texture size and exact float indexing range; unrepresentable coefficients,
dimensions or spot cones fail explicitly in tracing status. A conservative bound on the largest
source estimate above the coincidence cutoff and visible sheet radiance also rejects HDR
transport/presentation overflow. Positive source
coefficients that underflow float storage fail explicitly rather than silently disappearing.
There is no silent truncation.
Allocation/upload failures release partial resources; backend disposal releases old/new
textures, targets, shaders and context. Interactive remains accessible on tracing failure.
Changing output, Kelvin, position, orientation (including roll), beam or dimensions clears
history, including while paused, preserving pause/navigation/daylight. Presentation-only
redraw retains samples. Source updates do not fetch descriptors or start an application loop.

### Luminaire reproduction

Start the normal production application:

```bash
pnpm start -- --project fixtures/projects/path-traced-luminaires
```

Select a scenario, 3D, camera **interior**, Physical/Sunny, **2026-10-11 23:00 Europe/Budapest**
(`2026-10-11T21:00:00Z`), pixel ratio 1, AgX/0 EV, Fill Off, bloom Off and GI Off.
All positive fixture sources have 6000 nominal lumens at 3000 K and dimming 1.
Select Path tracing, close Rendering, leave the view stationary, then Pause for capture.
Selection and paused state survive scenario/2D replacement; reselect the same embedded
camera and Resume after replacement. The default 75-degree horizontal FOV and Fill aspect
are used. For mixed daytime scenes use **2026-10-11 12:00** in the same zone, without changing
presentation. Older daylight regression projects retain the earlier date/settings above.

The sealed 600 by 500 by 260 cm room has 20 cm perimeter walls, a full 1 cm partition at
X=200 cm, a 30 by 30 by 130 cm shadow column, and a baffle spanning X=260..500, Y=50..130,
Z=200..205 cm. The strip is centered at (380,80,210), length 180 cm, facing upward. It is
hidden from the interior camera at (550,420,160), heading 225 degrees/pitch 8 degrees;
the ceiling above/front of the baffle provides an open reflection route into the main room.
Camera **sealed-side** at (100,380,160) views the enclosed unlit chamber. The windowed variant
adds a clear 180 by 160 cm south opening at 70 cm sill in the main chamber only.
No runtime-only architecture or fixture model was introduced.

### Luminaire browser evidence

The normal production application was reviewed in the Codex in-app browser on macOS, with
native WebGPU for Interactive and a separate WebGL2 float framebuffer for tracing. The viewport
is 1280 by 720 and the apartment buffer 1280 by 666, DPR 1, Medium raster shadows, GI Off,
bloom Off, neutral matte defaults, AgX/0 EV, Physical/Sunny and the fixture's default 75-degree
horizontal FOV/Fill aspect. [Settings](path-traced-luminaires-evaluation/settings.jpg) records
the controls. Sample counts below are the paused UI counts; a few captures were composited
just before pause and display a slightly earlier count. These are agent observations for
human visual acceptance, with visible noise and idealized transport.

All following luminaire cases use `fixtures/projects/path-traced-luminaires` and the nighttime
instant above unless specified. Scenario paths are under `designs/`.

| Scenario/camera | Samples | Capture and observed behavior |
| --- | --- | --- |
| 01-point, interior | 367 | [Point](path-traced-luminaires-evaluation/point-night.jpg): warm direct light, an opaque baffle/column shadow and reflected light on shaded surfaces; no invented bulb. |
| 02-spot, interior | 492 | [Wide cone](path-traced-luminaires-evaluation/spot-wide.jpg): aimed floor/column illumination and indirect wall light. |
| 03-spot-narrow, interior | 662 | [Narrow cone](path-traced-luminaires-evaluation/spot-narrow.jpg): a narrower, brighter footprint at the same 6000 lumens. |
| 04-spot-aim, interior | 261 | [Reoriented cone](path-traced-luminaires-evaluation/spot-reoriented.jpg): the footprint moves to the north wall/partition; the column's previously lit side becomes dark. |
| 05-area, interior | 84 | [Area/shadows](path-traced-luminaires-evaluation/area-night.jpg): visible source and soft finite-source shading around the baffle and column. Grain remains at this count. |
| 05-area, emitter-front | 97 | [Front](path-traced-luminaires-evaluation/area-front.jpg): unobstructed one-sided emission. |
| 06-area-large, emitter-front | 66 | [Larger front](path-traced-luminaires-evaluation/area-large-front.jpg): four times the emitting area, same flux and presentation, with changed distribution. Both fronts approach tone-mapped white, so this capture alone is not a photometric brightness measurement. |
| 05-area, emitter-back | 163 | [Back](path-traced-luminaires-evaluation/area-back.jpg): black absorbing sheet while reflected room lighting remains visible. |
| 07-concealed, interior | 1074 | [Concealed strip](path-traced-luminaires-evaluation/concealed-strip.jpg): the baffle hides the source, while reflected light reaches walls and floor below it. Noise remains in indirect regions. |
| 08-off, interior | 243 | [Matched off](path-traced-luminaires-evaluation/lights-off.jpg): black at the same camera/nighttime settings. |
| 07-concealed, sealed-side | 428 | [Sealed side](path-traced-luminaires-evaluation/concealed-sealed-side.jpg): black behind the full 1 cm partition despite light in the adjoining chamber. |
| 07-concealed, emitter-back | 159 | [Linear front](path-traced-luminaires-evaluation/linear-front.jpg): the camera above the upward-facing strip sees its thin emitting face and ceiling illumination. The camera name describes its relation to the downward area source. |
| 09-disabled, interior | 48 | [Disabled/zero-dim](path-traced-luminaires-evaluation/disabled-zero.jpg): black, with no visible source sheet. |
| 14-legacy, interior | 45 | [Design 1.0](path-traced-luminaires-evaluation/legacy-empty.jpg): no retained sources. |
| No design, interior | 89 | [No design](path-traced-luminaires-evaluation/no-design.jpg): no retained sources. |
| 10-mixed, interior | 163 | [All four types](path-traced-luminaires-evaluation/mixed-night.jpg): combined direct and reflected light, including the visible area front and concealed-strip ceiling contribution. |
| 11-reordered, interior | 98 | [Reordered](path-traced-luminaires-evaluation/mixed-reordered.jpg): the same lighting distribution, with more grain at its lower sample count. Automated packing/estimator tests establish order invariance separately. |
| 11-reordered, sealed-side | 132 | [All-source sealed side](path-traced-luminaires-evaluation/mixed-sealed-side.jpg): black across the opaque 1 cm partition with all four types active. |
| 12-day-mixed, interior, 12:00 | 175 | [Mixed daylight](path-traced-luminaires-evaluation/mixed-day.jpg): a cool Sun patch on floor/column coexists with warm artificial light and the visible area front. |
| 12-day-mixed, interior, changed to 23:00 | 272 | [Time change](path-traced-luminaires-evaluation/mixed-after-night-change.jpg): the Sun patch disappears and lamp illumination remains. The paused time edit first cleared 175 samples to zero. |
| 13-day-off, interior, 12:00 | 343 | [Matched daylight only](path-traced-luminaires-evaluation/day-lights-off.jpg): the same Sun patch and cool indirect daylight remain, with no emitting sheet or warm lamp contribution. |

Existing daylight-only fixtures were restarted through the same normal project workflow with
No design, **2026-10-09 12:00 Europe/Budapest** and the unchanged viewport/presentation/settings
above. [Regression settings](path-traced-luminaires-evaluation/regression-settings.jpg) records
the selected instant and controls; the original TASK-044 evidence remains intact.

| Existing project/camera | Samples | Capture and observed behavior |
| --- | --- | --- |
| daylight-path-tracing-windowed, interior | 319 | [Windowed](path-traced-luminaires-evaluation/regression-windowed.jpg): the expected floor Sun patch and cool secondary wall/floor illumination; grain remains. |
| daylight-path-tracing-sealed, interior | 489 | [Sealed](path-traced-luminaires-evaluation/regression-sealed.jpg): black with the window absent. |
| daylight-path-tracing-thin-wall, interior | 403 | [Lit side](path-traced-luminaires-evaluation/regression-thin-wall-lit.jpg): direct Sun on the floor/partition and cool secondary lighting, retaining dark boundary contacts. |
| daylight-path-tracing-thin-wall, sealed-side | 622 | [Sealed side](path-traced-luminaires-evaluation/regression-thin-wall-sealed.jpg): black behind the complete 1 cm wall, with no visible enclosure leakage. Selecting this camera while paused first cleared 403 samples to zero. |

[Review metadata](path-traced-luminaires-evaluation/metadata.json) records all 26 tracing
captures, project/scenario, camera, zoned time, paused count, backend and common settings.
These viewpoints showed no visible tracer leakage; they do not establish correctness for every
geometry scale or apartment. No shader/runtime warnings or errors were reported in the browser.
The [Overcast eligibility check](path-traced-luminaires-evaluation/sunny-eligibility.jpg)
retains the explicit Sunny requirement and an accessible return to Interactive. No real
capability/upload failure occurred on this machine; focused mocked boundary tests cover those
failures separately.

The spot [Interactive comparison](path-traced-luminaires-evaluation/spot-interactive.jpg)
uses the same camera/nighttime/presentation with GI Off and bloom Off. Its direct-light
approximation leaves most room surfaces dark. This is qualitative context, without a benchmark
or a claim of overall superiority.

Browser presentation edits changed the spot to Neutral/+1 EV and
[redrew all 492 accumulated samples](path-traced-luminaires-evaluation/presentation-neutral-1ev.jpg)
without reset, then restored AgX/0 EV. Returning from a tracing-first mount to Interactive
and back retained all 66 paused samples, the embedded camera, and GI/bloom Off. The initial
depth-encoding-only reset found during review was corrected; tests cover all three projection
conventions and actual focal/projection changes.

TASK-045 automated verification covers source adaptation, nonzero model-space Z, normative
rolled frames, total-flux normalization, dimming, fixed-flux shape changes, numerical integration,
source/area probability accounting, sidedness, order invariance and empty replacement. Actual
fixture triangles verify finite source segments, blockers, the thin partition, baffle/bounce
route and retained clear panes. Owned real DataTextures with mocked GPU boundaries verify
capacity/upload failure, atomic replacement, retained architecture/light resources and cleanup.
Lifecycle tests cover every source input while paused, unchanged presentation/camera,
reordering, depth convention adoption and failure return to Interactive. These tests do not
establish real shader appearance; the browser captures supply separate visual evidence.

Final root `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass, with **2455 tests**
(258 in renderer-three). The existing Vite large-chunk advisory remains. No required command
was omitted, no dependency/lockfile changed, and no extra upstream code was incorporated.
The missing window in the new daytime control found by the finite-segment test was corrected
before its browser review. Human visual acceptance remains the final step. Indirect light and
thin-pane escape paths retain Monte Carlo noise; eight diffuse interactions, hard spot edges,
ideal sheets/points, approximate Kelvin RGB and the qualitative sky/flux scale limit the result.
No calibrated brightness, complete convergence, glossy transport or broader light features
are claimed.

Upstream: **a930973667faf4502b427a01dd338a19522c8f6c**, CC0-1.0 Universal.
[Source provenance, files and material adaptations](../../packages/renderer-three/src/path-tracing/UPSTREAM.md)
and the retained license live beside the adapted modules. No dependencies or lockfile changed.
