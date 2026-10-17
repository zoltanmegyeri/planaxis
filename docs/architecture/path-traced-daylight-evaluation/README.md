# Sunny daylight calibration — TASK-047

This directory separates agent measurements from human visual acceptance. It retains the actual
browser-rendered images and linear HDR readbacks; prior daylight, luminaire and PBR evidence
remains historical. No private architecture, materials, absolute project path or private capture
belongs in this directory.

## Reproduction and fixed inputs

```bash
pnpm start -- --project fixtures/projects/path-traced-daylight
pnpm dev:web
```

Use the Vite URL printed by `dev:web`, then `/evaluation/daylight.html`. This opt-in engineering
page uses the ordinary relative project/design/architecture/material APIs, existing descriptor
resolution and full SVG validation, then the same physical scene builder, BVH, shaders, backend,
material upload and camera adapter as the product. It is outside the production entrypoint and
adds no product controls or persistent debug fields. The server still owns exactly one root;
project changes require restarting it. Run case, Run source and path audit, or Run material and occlusion matrix invokes real WebGL2 tracing.

The public project has a 900 × 700 × 260 cm enclosure, 20 cm perimeter walls, two south-facing
240 × 180 cm clear windows at 60 cm sills, and no exterior ground. Location is 47.4979° N,
19.0402° E, north heading 270°, Europe/Budapest. The main instant is **2026-06-21 12:00 local**
(10:00 UTC), with actual solar azimuth 155.5210893°, elevation 64.3198286° and scene-to-Sun
PlanAxis vector (0.1795610, 0.3943953, 0.9012270). This solar geometry creates the two floor
patches. No hard-coded direction substitutes for it.

`01-neutral` assigns all floor, ceiling, wall-side and existing reveal targets sRGB
(0.8543058315, 0.8543058315, 0.8543058315), which decodes once to linear (0.7, 0.7, 0.7).
Roughness is 1, metalness 0, with no AO, normal map or lamp. Structural caps retain established
renderer defaults; the fixture does not invent finish targets for them. Other scenarios use
accepted public wood/plaster/normal and AO controls, or rough/polished metals. Four individual
lamp scenarios and one mixed set preserve nominal flux and the original Kelvin/orientation
semantics. The fixture contains real sealed, blocked-opening and 1 cm partition architectures.

The engineering viewport is 800 × 450 at DPR 1, camera `interior` at (820,90,160) cm, heading
135°, pitch 12°, horizontal FOV 75°. Main comparisons use AgX/0 EV, exposure multiplier 1,
without bloom, fill, raster lights or VXGI. Images use the same camera/materials/presentation.
Public source-isolation and path controls are internal engineering inputs; production exposes none.
For another camera, an optional `regions` URL query contains JSON with exactly `shadedWall`,
`shadedFloor` and `directFloor` rectangles. Each is normalized [x,y,width,height], finite,
nonempty in pixels and inside the image. Choose them on the baseline before the comparison;
this changes measurement only, never transport or persistent architecture.

Baseline records use the original source formulas and 8 opaque/24 total interactions, including
the original lower-hemisphere sky continuation. The baseline was captured before source changes.
The harness retains those formulas for reproducible isolated controls. The initial calibrated
reference used a black lower hemisphere as a conservative exterior boundary. The 2026-10-15
review restores horizon continuation; see the lower-sky review below. Earlier evidence retains
its original boundary, and the `upper-only` harness control reproduces that calibrated boundary.

## Linear measurement and uncertainty

Readback is RGBA32F before tone mapping and output conversion. Rec.709
Y = 0.2126 R + 0.7152 G + 0.0722 B. Fixed normalized top-left rectangles are:

| Region | x, y, width, height | Purpose |
| --- | --- | --- |
| shadedWall | 0.70, 0.25, 0.20, 0.15 | Right wall outside direct solar visibility |
| shadedFloor | 0.40, 0.82, 0.18, 0.10 | Foreground floor outside either Sun patch |
| directFloor | 0.20, 0.596, 0.10, 0.014 | Patch and its antialiased boundary, retained identically |

The direct rectangle deliberately includes a patch boundary; its spatial standard deviation
reflects scene variation and must **not** be interpreted as the Monte Carlo standard error.
Each report records cumulative means every 512 samples. Separate consecutive block means
are recovered by differencing N × cumulativeMean; block SD/sqrt(blockCount) estimates the
standard error of the region mean. With eight blocks, the approximate two-sided 95% interval
uses Student t(7)=2.365. Intervals are empirical estimates, not guaranteed independence bounds for the seeded generator. This measures finite-sample uncertainty for these regions, not physical
model accuracy or complete per-pixel convergence. Compare both region confidence intervals
and 2048→4096 stability. Deterministic seeds are recorded by the shader: pixel.x×1973 +
pixel.y×9277 + sampleIndex×26699 + 1, followed by the retained integer generator. Shared
random sequences make matching 8/16/32 and isolated-source comparisons correlated; confidence
intervals computed separately are conservative for their paired differences.

A geometric cavity bound is supplementary: for reflectance 0.7, relative omitted geometric
series tail after 8/16/32 terms is 5.765% / 0.3323% / 0.001104%. The actual PBR, aperture and
geometry controls are measured separately, because this bound does not predict a room image.
No performance or convergence deadline is imposed.

## Reference assumptions and provenance

The source reference is specified by [the current transport contract](../daylight-path-tracing.md#sunny-reference-calibration-2026-10-13).
These are atmospheric/RGB **assumptions**, not inferred meteorology, measured spectral efficacy,
weather data or a certified building daylight calculation. Source isolation distinguishes correct
expected brightness from finite-sample error. No portal or additional sky estimator is introduced:
[PBRT 4 §12.5.3](https://pbr-book.org/4ed/Light_Sources/Infinite_Area_Lights#sec:portal-lights)
explains why portal proposals can reduce variance without changing the lighting integral.
The baseline's fixed-region means already stabilize adequately for this assessment.

The public texture assets are copies of PlanAxis's existing generated PBR controls. No new
third-party asset, dependency, spectral dataset or external renderer is introduced. Source/math
provenance is recorded beside the tracing modules in `UPSTREAM.md`.

## Retained material energy

`bsdf-reference.py` independently integrates the mathematical alpha=1 GGX/Smith/Schlick
formula over 400 cosine bins × 512 azimuth bins. It does not call the renderer BSDF or its
sampling/PDF code. Its saved [reference values](bsdf-reference.json) separate the analytically
integrated reciprocal Fresnel diffuse term from rough-interface specular. The normal-view
0.7 paint value is 0.6267064 (diffuse 0.6144 + specular 0.0123064); rough 0.7 metal is 0.2148072.
Polished metal converges to the declared 0.7 factor in the independent endpoint control.
The 0.7 rough paint retains 0.6139229 / 0.2869297 / 0.0726720 at view cosines .5 / .1 / .01.
This confirms substantial grazing losses in the accepted bounded interface approximation.
It is **not** realistic full-layer paint reflectance: rough-interface multiple scattering and
internal diffuse reflection remain omitted. No material factor, Fresnel term, AO, shading
normal or lobe PDF is removed to obtain the required daylight improvement. The fixed room
already reaches assessable shaded illumination after correcting source units with that same
model. A fuller rough-interface/substrate model would need a separate passive-energy audit;
these numbers are retained as evidence for that future evaluation.

## Source and path diagnosis

The evidence has three implementation phases. `initial-audit/` retains the first unit-scale,
8/16/32 and roulette/material controls, before the terminal estimator and contact corrections.
`transport-audit/` verifies the completed terminal estimator and adequate 96-interaction
headroom, before conservative continuation-contact termination. `final-audit/` contains the
final matched room, whole-image darkness and production runtime controls. These phases are
labeled explicitly; earlier screenshots are not represented as final code.

The original source values correspond to only **1.89 klx normal Sun** and **0.53 klx upper-sky
horizontal illumination** in the retained lamp convention, plus the old lower-hemisphere
continuation. They were appearance values. The independently fixed atmospheric reference gives
88.55/15.49 klx, with the unchanged Kelvin/lumen convention. Sky color supplies chromaticity,
not its absolute source magnitude. No EV or lamp flux changed.

All values below are pre-presentation linear Y; half-widths are approximate 95% empirical
block intervals. The patch rectangle includes its antialiased boundary.

| Control | Measurement samples | Shaded wall Y | Shaded floor Y | Patch/boundary Y |
| --- | --- | --- | --- | --- |
| Original combined, 8/24 | 4096 | 0.0318284 ± 0.0000388 | 0.0206904 ± 0.0000268 | 0.2967131 ± 0.0001058 |
| Original Sun only | 2048 | 0.0093861 ± 0.0000203 | 0.0056995 ± 0.0000084 | 0.2696454 ± 0.0001903 |
| Original sky only | 2048 | 0.0224160 ± 0.0000357 | 0.0149843 ± 0.0000262 | 0.0270237 ± 0.0001146 |
| Completed estimator, 8/96 | 4096 | 0.8118183 ± 0.0007532 | 0.5139484 ± 0.0006659 | 13.1511169 ± 0.0052173 |
| Completed estimator, 16/96 | 4096 | 0.8251054 ± 0.0007716 | 0.5283072 ± 0.0005835 | 13.1616665 ± 0.0052796 |
| Completed estimator, 32/96 | 3072 | 0.8249456 ± 0.0008253 | 0.5285618 ± 0.0008350 | 13.1593313 ± 0.0052838 |
| **Final code, 16/96** | **4096** | **0.8251052 ± 0.0007716** | **0.5283064 ± 0.0005825** | **13.1616665 ± 0.0052796** |

[Baseline](baseline.jpg) and [final image](final-audit/final-01-neutral-interior-4096s.jpg)
use identical paint, embedded camera and AgX/0 EV. Absolute shaded light rises **25.9× wall /
25.5× floor**. Final shaded-floor/patch Y is **0.04014**, versus original **0.06973**: absolute
illumination improves even though the direct reference grows more. Both patches retain shape;
textured controls assess material response separately. Exterior highlights and patches are
bright, while the rest of the room is assessably illuminated. Grain and the then-explicit black
lower hemisphere remain visible in these historical captures; no exterior ground or denoising
conceals either.

At matched 2048 samples, completed 8/96 Sun and sky means add to combined to float readback
error: wall 0.439608198 + 0.371607725 = 0.811215923; floor 0.266940257 + 0.246794785 =
0.513735042. Differences from combined are about 5e-10 / 1e-9; the patch difference is 1.8e-6.
Both source inputs change, without duplicate Sun/environment energy.

Completing the eighth hit recovers the former omitted sky endpoint; increasing 8→16 then
adds about **1.64% wall / 2.79% floor**. At a matched 3072 prefix, 16→32 adds only **0.0215% /
0.0345%**, below the separate region intervals. Production therefore uses **16 opaque/96 total**
with compensated roulette after three. It is a measured bounded choice, not zero truncation in
all possible high-reflectance enclosures. The 96 total budget leaves pane headroom; separate
32-pane visibility exhaustion occludes.

The 32/96 frame was stopped at **3248 samples** after changing the engineering target below
its current count. Its measurement table uses the last complete **3072** checkpoint, without
selecting a favorable frame; capture count is recorded separately. Later exporter/checkpoint
handling records the final retained count even for such a target change. Pause checkpoints in
the final room are excluded from block statistics; all regular 512-sample boundaries remain.

The initial compensated 32/96 versus roulette-off 2048 reference intervals overlap: off wall
0.8249177 ± 0.0016617, floor 0.5278049 ± 0.0008494, patch 13.1574196 ± 0.0069813.
After completing the terminal estimator, the off control uses **1024** samples: wall
0.8253848 ± 0.0117645, floor 0.5282050 ± 0.0040577, patch 13.1542451 ± 0.0025552.
These broader two-block intervals also overlap the compensated reference. This is an
expectation check, not a claim of full roulette-off/per-pixel convergence. Independent analytic
cavity tests verify reciprocal survival weighting with deterministic sampling and a
four-standard-error tolerance. Removing roulette adds no expected illumination.

The last-hit defect is visible in a one-hit sky control: the old cap gives zero in all three
shaded/patch regions; the completed estimator gives wall **0.2214832 ± 0.0007165**, floor
**0.1338674 ± 0.0004459**, patch **0.4170270 ± 0.0018762** at 2048 samples. The last allowed
BSDF can now reach sky/emitting sheets/panes, while the next opaque hit stops. This also
completes the emitter MIS partition at a finite cap. There is no second sky estimator.

## Contact correction and final stability

HDR readback revealed sparse solar contact errors in visually black sealed images. After
shadow-contact correction, a combined test still exposed a rare sky escape, maximum Y
0.0212086 at 512 samples. Skipping an almost-zero continuation intersection could cross an
adjacent wall/ceiling boundary or shade its opposite side. The current continuation terminates
at uncertain quarter-offset contacts instead of skipping the occluder. Shadow rays include
nonnegative adjacent contacts; scalar points stay within the hit triangle bounds before the
unchanged 0.00001 m normal offset. Ray-aligned common edges, plane distance and conservative
BVH search improve float32 boundary handling without changing authoritative geometry.

The [final sealed readback](final-audit/contact-final.json) is exactly zero over the entire
800×450 HDR image at 512 samples, with combined calibrated Sun and sky. There is no enclosure
mask, sample clamp, extra blocker or brute-force fallback. Longer sealed/blocked/thin controls
are recorded separately below. Float32 still has a bounded precision range; this is not an
exact-intersection proof for all coordinates/devices.

At identical 4096 seeds the final contact policy changes the measured wall/floor means by
only **0.000034% / 0.000147%**, far below their intervals; patch mean is unchanged. It does
not supply the brightness correction. Final 2048→4096 regional changes are **0.086% wall /
0.039% floor / 0.024% patch**. These values separate source-scale correction, small truncation,
numerical visibility and finite-sample variation.

## Runtime verification

The rebuilt production application uses the normal project/design loading workflow. Actual
[DOM observations](final-audit/runtime-controls.json) and [paused reset](final-audit/runtime-reset.jpg)
show input invalidation at local noon while preserving pause; Return to Interactive retains
embedded camera, daylight and GI Off/bloom On intent. The 2D/3D round trip retains Physical,
June 21/noon and Sunny; the established remount selects Inspection again. No design overrides
were saved. No-design transient presentation controls verify exposure/tone redraw from
**2084 retained samples**, with the count unchanged after both edits; see
[redraw capture](final-audit/runtime-redraw.jpg). AgX/0 EV was restored. Overcast remains an
explicit unsupported tracing condition, and Sunny/Interactive remain accessible. Browser
console errors/warnings were empty for these valid production actions.

## Material, lamp, occlusion and private review status

All **18 final public matrix cases** completed through normal project loading, with empty
browser warning/error logs. [The matrix data](final-audit/matrix.json) records source colors,
solar vectors, effective lamp powers, checkpoints and capture filenames. Initial captures
remain historical in `initial-audit/`; intervals and block means are in `summary.json`.

The [textured result](final-audit/final-05-pbr-interior-4096s.jpg) retains wood/plaster detail,
normal response and shaped highlights at 4096 samples: wall/floor/patch Y are
0.409771/0.113958/4.168133. At 2048, AO versus zero-strength AO gives floor
0.286409 ± 0.000499 versus 0.496071 ± 0.000469; defined absorption and map factors are honored.
Rough metal floor Y is 0.404800 ± 0.001163. Polished metal is **not** claimed converged:
floor 0.368826 ± 0.043928 and patch 0.283536 ± 0.119296 retain broad intervals and visible grain.

At 08:00 local the actual Sun is azimuth 86.5903°, elevation 29.4941°; at 16:00 it is
255.5608°/44.6249°. Wall/floor Y are 0.264036/0.176294 and 0.448206/0.291586. The fixed
noon patch rectangle is no longer directly lit; actual geometry/direction moves the patches.
At 23:00, elevation -15.1972° makes Sun and sky zero. The no-lamp whole-image maximum is
**0** at 512 samples. Final sealed, blocked-opening and thin-partition dark-side images each
have whole-image maximum Y **0 at 2048 samples**. The lit side of the same 1 cm partition
remains illuminated (maximum 19.192529 at 1024), ruling out enclosure-wide suppression.

| Night source | Flux | Samples | Shaded wall Y | Shaded floor Y |
| --- | --- | --- | --- | --- |
| Point | 1200 lm | 2048 | 0.003736 | 0.006390 |
| Spot, 60° | 1200 lm | 2048 | 0.002419 | 0.002728 |
| Linear, 120 × 1 cm | 1600 lm | 2048 | 0.005288 | 0.013586 |
| Area, 80 × 60 cm | 2400 lm | 2048 | 0.007908 | 0.020522 |
| Separated mixed set | 6400 lm total | 2048 | 0.019044 | 0.105335 |
| Same set at noon | 6400 lm total | 2048 | 0.839341 | 0.621957 |

All sources keep 3000 K, enabled/dimming and declared orientation. Individual sources share
one reference placement; the mixed set separates sources to avoid coincident sheets. Its
local spotlight placement differs, so region means are not the sum of single-source rows.
Sheets also occlude daylight/other sources. [Linear](final-audit/night-12-linear-interior-2048s.jpg)
and [area](final-audit/night-13-area-interior-2048s.jpg) fronts and window reflections remain
visible, with narrow-source grain retained. Lamp powers are unchanged: clear-day incoming
flux is far larger, while lamps add local illumination. Lower night brightness at AgX/0 EV
is legitimate; no lamp boost or EV offset equalizes day/night.

The supplied **Open Space case was RUN** through the normal server-selected project boundary.
Current original design/materials, validated embedded camera and June 21/noon zoned instant
were fixed. A legacy-formula 8/24 baseline and final 16/96 use AgX/0 EV; additional Neutral/0 EV
redraws retain its stored presentation unchanged. Private regions were chosen on the baseline
outside window pixels and the Sun patch. Shaded illumination improves with stable 1024→2048
means and retained material response/patch shape. All private captures, raw measurements,
camera/location, descriptor context and summary stay **outside the repository**. This is a
reproduction using current private resources, without asserting the historical maintainer
pose/resources were identical. The public proxy does not substitute for this check.

Restart the normal server on `fixtures/projects/path-traced-pbr` and select **Run existing
PBR regressions** for the bounded packed/separate map-role, polished-reflection, concealed-strip
and emitter-front/back batch. Existing fixtures/evidence are unchanged; current captures/data
are recorded in `regressions/`. All **six cases completed**, with empty browser warning/error
logs. [Packed and separate map-role controls](regressions/measurements.json) give identical
three-region means at 1024 samples (0.1209053 / 0.3554077 / 0.4405910). The polished-window
reflection preserves architectural highlights, with visible grain at 1024 samples. The
concealed-strip view at 2048 samples retains light above its baffle and the indirect room route;
the baffle blocks direct floor illumination. The 1024-sample emitter-front/back views retain a
bright emitting front and a dark absorbing back. These camera-specific comparison rectangles
reuse the report's region labels; they are not the public room's physical shaded/Sun regions.
Human visual acceptance of the calibration and firefly fixes was received on 2026-10-15 after
the maintainer tried several locations, camera angles and times. The additional horizon issue
reported in that review is addressed separately below.

No dependency manifest or lockfile changes, third-party assets or version exceptions are
introduced. Source/math provenance is in `UPSTREAM.md`. Required lint, typecheck, test and
build all passed on the initial calibration implementation, including the bounded diagnostic extension:
`pnpm lint`, `pnpm typecheck`, `pnpm test` (**2497 tests**) and `pnpm build`. The production
build retains Vite's bundle-size advisory; it completes successfully.
Detailed results are generated by `summarize.py` in `summary.json`. Follow-up evaluation may
improve grazing paint/rough-metal energy and narrow/glossy-source variance with a separate
passive-energy/PDF audit. Fixed atmosphere/RGB, omitted exterior ground and float32 contacts
remain bounded approximations; the evidence is not certified illuminance prediction.

## Reflected-Sun noise review

The human review identified dense bright speckles in `final-09-metal-polished-interior-2048s.jpg`.
Its floor has metallic factor 1 and roughness 0.08. Rare indirect directions toward its narrow
Sun-reflection lobe produced very large samples, even while broad regional means appeared
stable. The ordinary 2048-sample wall/floor empirical intervals remained wide. This review
addresses the sampling distribution, preserving the calibrated source and original BSDF.

The [current proposal contract](../daylight-path-tracing.md#reflected-sun-sampling-2026-10-14-review-continuation)
mixes reversed visible-GGX directions with the existing BSDF distribution. Its roughness is
derived from actual horizontal smooth-metal triangles. The receiver cosine sets a probability
bounded by 0.5, and the complete mixture density is used in throughput and rectangle-emitter
MIS. Paths still traverse the actual architectural BVH, panes and emitting sheets. No diffuse
gain, roughness override, exterior reflector, image filter or bright-sample clamp is used.

Run **Run reflected-Sun noise audit** on the same public project after builds have finished.
The engineering `unguided` case disables only the proposal; `final` enables it. Inputs retain
June 21/noon, the same materials/camera/800×450/DPR 1, 16/96 interactions, compensated roulette,
and AgX/0 EV. The batch includes a longer 8192-sample reference, isolated sources, the neutral
room and polished-floor sealed/blocked/thin/mixed-light controls. Those visibility variants
deliberately keep a proposal-eligible reflector. The ordinary sky estimator remains unchanged.

`pixelNoiseRms` estimates per-pixel linear-Y error from consecutive 512-sample blocks. It uses
Welford variance of each pixel's recovered block means, divides by the block count, then takes
the RMS across the fixed region. This separates noise from genuine spatial changes in lighting
and reflections; `spatialSd` alone does not do so. At four blocks this is an empirical estimate,
with substantial uncertainty for rare events, not a guaranteed pixel-error bound. Reported
regional intervals use Student t; the 16-block reference uses t(15)=2.131 from
[NIST's critical-value table](https://www.itl.nist.gov/div898/handbook/eda/section3/eda3672.htm).

The initial fixed-0.5 proposal is preserved in `noise-audit/prototype/`. The refined receiver-cosine
proposal's completed measurements before a build-triggered page reload are preserved in
`noise-audit/pre-build-measurements.json`. Builds rewrite workspace modules and therefore reset
the Vite evaluation page; final captures are rerun after building rather than combined across
that reset. All completed 512-sample blocks are retained without choosing favorable frames.

| Matched 2048-sample region | Unguided Y ± 95% half-width | Guided Y ± 95% half-width | Unguided → guided pixel-noise RMS |
| --- | --- | --- | --- |
| Shaded wall | 0.700988 ± 0.041844 | 0.711144 ± 0.003657 | 1.743689 → 0.101066 |
| Shaded floor | 0.368826 ± 0.043928 | 0.384639 ± 0.003113 | 1.166793 → 0.085373 |
| Fixed patch/boundary rectangle | 0.283536 ± 0.119296 | 0.302937 ± 0.020077 | 1.530303 → 0.110454 |

The measured pixel-noise estimates fall about 94% / 93% / 93%. Regional means agree within the
original broad intervals; tighter guided intervals resolve the concentrated contribution more
reliably. This is noise reduction at fixed sample count and presentation, not an exposure
change or a claim of complete per-pixel convergence. Sharp window reflections, material color
and the reflected solar highlight remain. Fine progressive grain is still visible.

The [8192-sample reference](noise-audit/final-09-metal-polished-interior-8192s.jpg) gives wall
Y=0.709517 ± 0.001041, floor Y=0.384134 ± 0.001143 and fixed patch/boundary
Y=0.292830 ± 0.006129. Pixel-noise RMS is 0.050032 / 0.042607 / 0.053700, approximately
half the corresponding guided 2048-sample values. At 4096→8192 the regional changes are
0.0083% wall, 0.341% floor and 1.271% patch; the small patch rectangle remains the less stable
control. This longer reference is kept separately from the matched 2048-sample comparison.

All **12 noise-audit cases** completed with empty browser warning/error logs; see
[the full settings/readbacks](noise-audit/controls.json). The eligible polished-floor sealed,
blocked-opening and thin-partition dark-side images have whole-image maximum Y **0 at 1024
samples**. The lit side remains illuminated (maximum 16.864921 at 512), with the same reflector.
Thus the proposal does not supply light through blockers or suppress the entire enclosure.
Sun-only and sky-only means add back to the combined means within their empirical intervals:
wall/floor/patch differences are -0.000693 / -0.000156 / -0.000304. Sky-only has its configured
guiding flag enabled but no effective Sun, so the proposal is inactive; the different sample
distributions prevent the earlier bitwise source-addback comparison from applying here.
The neutral room is ineligible and retains the previous 2048-sample means exactly.

The four declared lamps are also exercised together with the polished floor: at noon, 1024
samples give wall/floor Y=0.721573/0.387566, with visible emitting sheets and reflected sunlight.
At 23:00 the Sun/sky are zero and guiding is inactive; 512 samples give
0.018824/0.007740, with total declared flux still 6400 lm. This is a bounded visibility/power
regression, not a claim that the small-source night image has converged.

All **six accepted PBR regressions** were rerun on the current sampler with empty browser
warning/error logs; [their records](noise-audit/regressions.json) and native captures are kept
beside the noise controls. Packed/separate map-role means agree exactly at 1024 samples
(0.121797 / 0.358198 / 0.359871). The polished-window reflection retains its architectural
shape and solar highlight. Concealed-strip bounce illumination and emitter front/back
sidedness remain intact; these Night controls retain the earlier regional means exactly.
These camera-specific rectangles remain comparison regions, not the public room's physical
shaded-wall/floor/Sun regions.

The actual Open Space design was rerun at its established camera/regions, June 21/noon,
AgX/0 EV and 2048 samples. It has **no eligible horizontal smooth-metal reflector**; guiding
is inactive and all three HDR region means match the earlier final capture exactly. Its
remaining ordinary pixel-noise RMS is about 0.0300 wall / 0.0311 floor. This bounded proposal
therefore does **not** claim a noise improvement for that private material set. The current
private report/capture stays outside the repository, alongside the earlier reproduction.

Analytical tests preserve known cosine-hemisphere and spherical-cap integrals under the full-support
mixture, compare a reflected-Sun receiver against ordinary sampling within four standard errors,
and require substantially reduced variance. Scene selection ignores panes/vertical surfaces and
does not mutate materials. The final implementation passed `pnpm lint`, `pnpm typecheck`,
`pnpm test` (**2500 tests**) and `pnpm build`; focused fixture validation additionally covers
all polished-floor controls. No dependency, format, exposure or Interactive/VXGI change is added.

The proposal targets smooth horizontal-metal Sun paths. It is not a general caustics integrator:
mapped/tilted reflectors, ordinary window-escape grain and narrow artificial sources can remain
noisy. Window-aware sky sampling and denoising would be separate evaluations; no denoiser or
biased material regularization is included in this TASK-047 review correction. The maintainer
accepted the calibration and firefly fixes on 2026-10-15; acceptance is separate from these measurements.

## Lower-sky visual review (2026-10-15)

After accepting the calibrated illumination and reflected-Sun noise correction, the maintainer
reported a sky-colored upper background and almost-black lower background. The initial
calibration deliberately assigned zero radiance below the horizon because exterior ground was
unmodeled. That conservative boundary applied to camera, reflection and diffuse escape rays,
so its discontinuity was directly visible through windows.

The current boundary restores the original horizon continuation: for mu<=0, L(mu)=Lh, using
the **calibrated** horizon RGB. The upper smoothstep gradient already approaches Lh with zero
slope, so the full environment is continuous at the horizon. All escape rays still use one
evaluation; there is no camera-only backdrop, unoccluded fill, exterior mesh or extra Sun disc.
The existing full-support BSDF/guide mixture samples the additional environment contribution
through actual architecture and panes. No sampling density or BSDF is changed in this review.

This is an explicit approximate exterior boundary, not an outdoor ground-reflectance prediction.
It contributes zero to an upward horizontal receiver and leaves the 88,551.84 lx normal Sun,
15,491.21 lx upper diffuse horizontal sky and 95,296.52 lx global horizontal reference unchanged.
At the public noon palette, its unobstructed contribution is **24,047.76 lx on a downward
receiver**, or **12,023.88 lx on a vertical receiver** (683 pi Yh and 683 pi Yh/2). Interiors can
therefore receive additional light through legitimate downward exterior escape routes; that
change is measured separately below. These plane values assume no architectural obstruction.
The continued horizon follows the existing elevation/twilight scale and is zero at night.

The `upper-only` harness case retains the preceding black boundary with current production
transport and guiding. The new **Run lower-sky review** batch compares it with horizon
continuation at the same 800x450, DPR 1, embedded camera and AgX/0 EV; it also repeats polished
metal, source-isolation, occlusion, morning/afternoon and mixed/night controls. Historical evidence
above remains unchanged. Raw reports and native canvas images belong in `sky-review/`.

The 2048-sample `upper-only` neutral capture is byte-identical to the preceding noise review's
neutral capture, and its HDR region means match exactly. The backend regression checks that
ordinary daylight inputs select continuation, that the historical upper-only control is
explicit, and that returning to default daylight restores continuation. Existing integration
tests retain upper-sky normalization and night/Interactive behavior.

At matched **1024 samples**, the neutral-room linear Y values are:

| Region | Black lower sky | Horizon continuation | Change |
| --- | ---: | ---: | ---: |
| Shaded wall | 0.824258 | 1.118848 | +35.74% |
| Shaded floor | 0.528579 | 0.730581 | +38.22% |
| Sun-patch region | 13.153696 | 13.434586 | +2.14% |

The respective approximate 95% half-widths from the two 512-sample blocks are
0.004384 / 0.004439 / 0.002938 before and 0.002690 / 0.000907 / 0.010972 after. Two blocks
provide limited uncertainty evidence, but the indirect differences are substantially larger.
The earlier black-boundary capture continued to 2048 samples; the matched comparison uses its
1024 checkpoint. The actual [before](sky-review/upper-only-01-neutral-interior-2048s.jpg) and
[after](sky-review/final-01-neutral-interior-1024s.jpg) images retain their own capture counts.
Sun patches remain distinct; the added environment contribution also affects the patch region.

The [polished floor at 2048 samples](sky-review/final-09-metal-polished-interior-2048s.jpg)
has wall/floor/patch-region Y 0.982488 / 0.783121 / 0.395555 and pixel-noise RMS
0.105426 / 0.090930 / 0.111589. The RMS is about 4.3% / 6.5% / 1.0% above the preceding
black-boundary guided result, with greater exterior illumination, while whole-image maximum Y
is 16.8603 versus 16.6660. The bright sparse speckles do not return in the inspected image;
ordinary fine grain remains. The new 512-sample Sun-only HDR checkpoint is **exactly identical**
to the saved Sun-only checkpoint from the preceding noise review. No Sun energy or reflected-Sun
sampling behavior changed. The sky-only control includes the restored lower environment.

All **12 public cases completed** with empty browser warning/error logs. The three polished-floor
occlusion controls (sealed, blocked opening, and sealed side of a 1 cm partition) each have
whole-image maximum linear Y **0 at 512 samples**. Morning and afternoon follow their actual
solar inputs; the morning capture has 600 samples with a complete 512-sample measurement block,
and afternoon has 512. The nighttime four-source mixed capture at 512 samples is **byte-identical**
to the preceding noise-review nighttime capture: Sun and sky remain zero, and all 6400 lamp
lumens retain their meaning. Daytime mixed lighting also completes at 512 samples. These short
regression captures establish behavior at their recorded checkpoints, not complete convergence.
The main neutral and polished comparisons use the longer counts above. Counts in the bounded
batch reproduce the actual captures; partial-block measurements are excluded by `summarize.py`.
See [raw measurements](sky-review/measurements.json), [derived statistics](summary.json) and the
[browser view](sky-review/browser-review.png). Human acceptance of this restored sky remains a
separate review step.

The original private apartment was also checked through the normal configured project APIs at
the same June 21/noon instant, camera, materials, presentation and measurement rectangles as
its preceding run. At a matched 1024 samples, wall/floor/patch-region Y changes from
0.214871 / 0.363093 / 8.164346 to **0.334782 / 0.561236 / 8.245811**, respectively
(+55.81% / +54.57% / +1.00%). The new approximate two-block 95% half-widths are
0.003212 / 0.001813 / 0.015627; this is a checkpoint comparison, not a full convergence claim.
Source RGB, actual solar geometry, path limits, sampling eligibility, effective lamps and AgX/0 EV
match the earlier run exactly. The horizon split is absent in the inspected private capture;
browser warning/error logs are empty. Private raw reports and images remain outside the repository.

Final verification: `pnpm lint`, `pnpm typecheck`, `pnpm test` (**2500 tests**) and `pnpm build`
all pass after this correction. The build retains the existing bundle-size advisory. No dependency,
persistent-format, exposure, material, Interactive/VXGI or navigation change is introduced.

## Lamp-unit review

The maintainer accepted the daylight, continuous sky and reflected-Sun correction, then reported
an almost-dark 560 lm point light and a very weak 10,000 lm source in tracing, despite strong
Interactive illumination. The earlier common-unit claim was wrong: tracing divided lamp
coefficients by **683 and Kelvin Y**, while Interactive uses Three.js photometric RGB directly.
For the reported 5600 K white, linear RGB is (1, 0.865495659, 0.755135967), Y=0.886123312,
so the tracer was **605.222222 times weaker** before any BSDF or path attenuation.

The corrected lamp adapter uses nominal scalar intensity Phi/(4 pi) for point sources,
Phi/Omega for the retained normalized hard spot cone, and Phi/(pi area) for linear/area
rectangles. These multiply the **same unnormalized linear Kelvin RGB as Interactive**, with no
extra radiometric divisor. Nominal lumens, dimming, orientation, dimensions, source selection,
MIS, BSDFs and actual architectural visibility retain their meanings. A 560 lm point source
now has intensity **44.5633841 cd** before the shared color, exactly matching Interactive.

This correction follows Three.js 0.186.1's installed `PointLight`, `RectAreaLight`,
`AnalyticLightNode` and distance-attenuation implementation, checked against the official
[PointLight](https://threejs.org/docs/pages/PointLight.html) and
[RectAreaLight](https://threejs.org/docs/pages/RectAreaLight.html) contracts. BIPM's
[683 lm/W definition](https://www.bipm.org/en/si-base-units/candela) concerns monochromatic
540 THz radiation; it is not an extra divisor for Three.js's photometric RGB lamp coefficients.
No third-party implementation or new dependency is incorporated.

At the maintainer's explicit request, the accepted **Sun/sky buffers, continuous lower sky,
reflected-Sun sampling and AgX/0 EV presentation are preserved**. The 683 daylight factor is
now named and documented as a **daylight-specific render calibration**, independent from lamp
units. The old claim of a common absolute photometric daylight/lamp simulation is withdrawn;
mixed-light balance is an RGB appearance approximation. This is an explicit correction of the
earlier model description, not a spectral efficacy claim or hidden exposure adjustment.

The public `small-sealed.svg` has a 3x3x2.6 m outer enclosure with 20 cm walls, a 2.6x2.6 m
interior, known neutral paint, no openings, and a central point source at 2.3 m. New scenarios
cover 560 and 10,000 lm, all four emitter types, Off, half dimming, polished metal, and a source
across the existing full-height 1 cm partition. All use supported formats and normal project APIs.
The actual [pre-fix report](lamp-review/before/measurements.json) and
[pre-fix image](lamp-review/before/night-19-small-point-560-interior-512s.jpg) were captured at
800x450 / 512 samples before changing the lamp adapter, with the accepted current transport.

For the bounded lamp matrix, open `/evaluation/daylight.html?compact=1` and press **Run lamp-unit
review**. Both sides use 400x225, the same embedded camera and AgX/0 EV; viewport/DPR are
recorded in every report. `lamp-before-night` reproduces the former `/683/Y` coefficients in
the engineering harness only. Production has no new scale setting. `one-hit-night` separates
direct source response from additional tracing bounces. The last matrix case checks the
accepted windowed polished-metal daylight scene with **no lamps**, keeping its actual sky.

Regression tests now compare point and rectangular coefficients directly to Interactive at
2700/5600/10000 K, independently assert the absolute 560 lm point intensity and 1/r² receiving
light, and retain full angular/area source normalization, finite capacity failures, dimming and
source support. Updated flux quadrature integrates the same Kelvin RGB times nominal lumens;
it does not assume a separate Y normalization that Interactive never performed. The tiny-area
capacity fixture remains record-finite but transport-unsafe in the corrected larger units.

The complete [400x225 matrix](lamp-review/compact/measurements.json) contains **13 completed
cases** with no browser warnings/errors. At matched 512 samples, the 560 lm point comparison is:

| Region | Previous `/683/Y` | Corrected photometric RGB | Ratio |
| --- | ---: | ---: | ---: |
| Wall | 0.012395792 | 7.502209005 | 605.222219 |
| Floor | 0.006681563 | 4.043830485 | 605.222225 |
| Reference floor region | 0.009316195 | 5.638368500 | 605.222250 |

This scalar relationship follows the independent source coefficient, not a favorable noisy frame.
The receiving paths/roulette do not depend on lamp emission, so a single-source scale change
retains their sample sequence. The 10,000/560 lm ratio is 17.857142 within float accumulation
precision, and half dimming gives exactly 0.5 in all three regions. At 1024 samples the corrected
560 lm means are 7.501635 / 4.040349 / 5.625089; changes from the halfway checkpoint are
-0.0077% / -0.0861% / -0.2355%. Two complete blocks are limited convergence evidence; no claim
of a noise-free reference is made. `summary.json` records the block statistics.

The one-hit control gives 2.827876 / 0.876067 / 1.506274, separating direct source response
from the additional valid wall/ceiling bounces. Full tracing can therefore be brighter than
Interactive with GI Off even with identical point coefficients. The actual production browser
was also checked at June 21/23:00, Physical Sunny, AgX/0 EV, 1x pixels, GI Off and Bloom Off:
[Interactive](lamp-review/product/interactive-560.png) and
[tracing at 193 samples](lamp-review/product/traced-560.png) both visibly illuminate the enclosed
560 lm room. These product screenshots use their recorded 1280x666 rendering area;
[settings](lamp-review/product/settings.json) are separate from the 400x225 measurement matrix.

Point, spot, linear and area controls all give finite, clearly lit rooms. The disabled source
and chamber behind the 1 cm partition have whole-image maximum Y **0**. The lit side reaches
maximum Y 4.53854. The polished-floor point case has maximum Y 16.0671 at 1024 samples,
without sparse bright outliers in the inspected image; ordinary fine grain remains.
Spot brightness can differ from Interactive because the retained normalized hard cone differs
from Three.js's pi power convention and 0.2 penumbra, not because of a hidden unit divisor.

The [no-lamp polished daylight control](lamp-review/compact/final-09-metal-polished-interior-1024s.jpg)
retains **exactly identical source RGB, solar geometry, camera, 16/96 path limits, guiding and
AgX/0 EV** to the accepted horizon review. Its lower sky is continuous and the concentrated
Sun fireflies do not reappear. Its viewport is deliberately smaller, so per-pixel equality to
the older 800x450 image is not claimed. Whole-image maximum Y is 16.6417 at 1024 samples.
No shader transport, sky distribution or reflected-Sun proposal changed in this correction.

The maintainer's actual private 560 lm / 5600 K point-light design was also loaded through the
configured project boundary, with its disabled linear source retained as disabled. A reproduced
previous-mapping control and corrected run at matched 400x225 / 512 samples give wall/floor/
reference-region Y **0.004716847 / 0.002776835 / 0.001590843** before and
**2.854740599 / 1.680602513 / 0.962813717** after. All three ratios match 605.222222 within
float accumulation precision. Architecture, embedded camera, actual June 21/23:00 instant,
Sun/sky values, path/sampling settings, nominal/effective lamps, materials, regions and AgX/0 EV
are identical. The corrected capture visibly lights the room. Its ceiling hotspot is a spatially
coherent point-light pool, not scattered fireflies; ordinary 512-sample grain is still visible.
Browser warnings/errors are empty. This private before control reproduces the previous adapter;
the actual pre-edit implementation capture is the separate public 800x450 baseline above.
Private descriptors/assets/captures remain outside the repository and were not edited.

Verification passed: `pnpm lint`, `pnpm typecheck`, `pnpm test` (**2503 tests**) and `pnpm build`.
The existing bundle-size advisory remains. No dependency/lockfile, persistent format, Interactive
lamp, exposure or BSDF change is introduced. Human acceptance of the daylight, full sky and
firefly correction is recorded; the lamp correction is ready for the maintainer's visual review.
The review-directed policy adjustment is explicit: preserve accepted Sunny appearance while
correcting lamp compatibility, and withdraw the former common absolute photometry claim.
