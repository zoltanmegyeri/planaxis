# Experimental daylight path tracing

Implemented 2026-10-09 for TASK-044. This is a bounded qualitative experiment for human
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
Design luminaires do not contribute, and bloom is bypassed. The UI states these omissions.
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
reversed depth. Selecting a rendering view does not reframe or change focal length/aspect,
Physical instant, weather or presentation. See the dated [ADR-003 refinement](../decisions/ADR-003-three-renderer-architecture.md).

Model/finish/glazing replacement rebuilds the BVH. Camera pose/projection, viewport/effective
buffer dimensions (including DPR), architecture and daylight invalidate accumulation. Stationary
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
ignored luminaires, camera/presentation retention, pause/resume, invalidation, hidden/disposed
cancellation and failure recovery. Mocked GPU tests establish lifecycle/contracts, not shader
appearance; browser evidence is separate.

Final repository verification: `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build`
all pass. The test run includes **2,441 passing tests**, including 13 added renderer tests and
two added browser workflow tests. Focused renderer/browser test and typecheck runs and
renderer/browser builds also pass after corrections. Earlier development failures (minimal
canvas mocks, the extra Rendering control count, a stale test camera matrix and a device-loss
test payload) were corrected without weakening the prior behavior assertions. The production
build retains Vite's large-chunk advisory; it is not a build failure. No required check was
omitted. No dependency manifest/lockfile changed, so dependency-change checks do not apply.

This experiment supports daylight only. Studio/Overcast tracing, artificial luminaires,
full PBR/textures, caustics, denoising, native WebGPU tracing, exports and persisted jobs remain
outside scope. There is no performance target or benchmark. Very small geometry, very large
world coordinates and scenes beyond device texture capacity require further review. Diffuse
bounce limits/Russian roulette and the idealized sky/panes are approximations. Human review
must decide whether broader path-tracing work is warranted.

Upstream: **a930973667faf4502b427a01dd338a19522c8f6c**, CC0-1.0 Universal.
[Source provenance, files and material adaptations](../../packages/renderer-three/src/path-tracing/UPSTREAM.md)
and the retained license live beside the adapted modules. No dependencies or lockfile changed.
