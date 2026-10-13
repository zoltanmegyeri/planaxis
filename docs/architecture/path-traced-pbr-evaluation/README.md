# Opaque PBR browser review — TASK-046

Agent-observed evidence from 2026-10-12 and the resumed review on 2026-10-13; human visual acceptance is pending. These are actual
Codex in-app browser captures through normal project loading, not mocked GPU output.

## Reproduction

```bash
pnpm start -- --project fixtures/projects/path-traced-pbr
```

Use Physical/Sunny, 2026-10-12 **12:00 Europe/Budapest** (10:00 UTC), AgX/0 EV, DPR 1,
Medium shadows, GI Off and bloom Off. The browser viewport is 1280 × 720 and the apartment
buffer 1280 × 666. Keep the fixture camera's 75° horizontal FOV, Fill aspect and no lens override.
`finish-detail` uses position (550,420,160) cm, heading 225°, pitch 45° for floor controls;
`interior` uses the same position/heading and pitch 8° for walls/ceilings. `sealed-side` views
the opposite partition face. The two normal-orientation scenarios contain an explicit additional
left-chamber point light; all other material controls share the original four effective sources.
The full fixture camera definitions and source settings are in the SVG/scenario descriptors.

The [settings capture](settings.jpg) records daylight and presentation. [Capture metadata](captures.json)
records project, scenario, material assignments, camera, zoned time, actual sample count,
backend and drawing-buffer size. Night controls use 23:00 on the same date.

Select a scenario, choose 3D and its indicated camera, then select Path tracing. Leave it
stationary and pause for inspection. Design selection retains the established 2D loading
workflow; select 3D again after replacement. Tracing pause/view intent and daylight remain
session state. Return to Interactive compares assignment/mapping with the same camera.

## Observations

The material controls show finite glossy/metallic reflection, real source/architecture
reflections, physical texture repeats, independent channel roles, asymmetric normal detail
and indirect-only AO. Different source estimators and exposure scales in the two existing
renderers produce different brightness; no exposure adjustment was used between controls.
Interactive's bright lamp response clips some normal detail in its matched captures, but
assignment/period and the visible pattern remain assessable. These observations are qualitative.

Sample counts vary; these short qualitative captures are below the task's usual 1,024-sample review guideline.
The large controlled changes and sharp source geometry were assessable at those counts;
remaining grain and isolated bright Monte Carlo samples are visible. This does not claim
complete convergence, full material/transparency parity or calibrated photometry. No sample
clamp, denoiser, artistic material gain, fabricated environment or exposure compensation was used.

See [the implementation contract](../daylight-path-tracing.md#opaque-pbr-materials-2026-10-12)
for native-pixel bilinear filtering without mipmaps, single-scattering GGX energy loss on rough
metals, alpha/glazing/weather restrictions, normal safeguards and bounce limits.

## Verification

Focused tests cover channel/color semantics, native sizes/shared ownership, actual geometry
and finish groups, physical tangent frames, numerical energy/quadrature/endpoint/grazing
controls, MIS complement weights, capacity/partial-upload failures and active/paused mapped
input invalidation. Browser evidence separately verifies real shader appearance.

Repository checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. The test suite
includes 2,478 tests after the added renderer/browser coverage and allocation regressions. No dependency manifest or
lockfile changes; dependency-change checks do not apply. Vite retains its existing chunk-size
advisory. Task artifacts and Git state remain untouched.

## Material and control captures

| Control | Capture | Agent observation |
| --- | --- | --- |
| Textured day / Interactive | [Tracing](01-textured-day-final.jpg), [Interactive](01-textured-interactive.jpg) | Wood, tile and plaster assignment/period remain visible; source alpha does not punch holes in opaque wood. Normal detail and floor finish partitions remain stable. |
| Dielectric rough / polished | [Rough](02-dielectric-rough.jpg), [Polished](03-dielectric-polished.jpg) | Diffuse response remains; the polished surface adds a bounded source reflection/highlights. |
| Metal rough / polished | [Rough](04-metal-rough.jpg), [Polished](05-metal-polished.jpg) | Colored reflection replaces full diffuse response. The panel/column/baffle are reflected; roughness spreads their response. |
| Zero / near-zero roughness | [Zero](06-metal-zero.jpg), [Near zero](07-metal-near-zero.jpg) | Sharp finite source and architecture reflections, without persistent invalid output. |
| Intermediate metalness | [Mixed](08-mixed.jpg) | Diffuse and reflective contributions coexist at metalness 0.5. |
| Independent roughness / metalness | [Green](09-roughness.jpg), [Blue](10-metalness.jpg) | Reflection spread changes with green; alternating metallic response follows blue. |
| Normal / neutral | [Detail](11-normal.jpg), [Neutral](15-neutral-normal.jpg) | Asymmetric detail changes the reflection/shading pattern; neutral preserves the unperturbed surface. Silhouette and column shadow remain architectural. |
| AO / zero / white | [AO](12-ao.jpg), [Zero](13-ao-zero.jpg), [White](14-ao-white.jpg) | Dark indirect bands disappear in zero/white controls. Explicit Sun/lamp patches and column cast shadow retain their geometry. |
| Packed / separate roles | [ORM](16-packed.jpg), [Separate](17-separate.jpg) | Equivalent channel patterns and source-reflection distribution with different image dimensions; noise differs with sample count. |
| Floor/wall/ceiling orientation | [Detail](24-orientation.jpg), [Interactive](24-orientation-interactive.jpg), [Neutral](25-neutral.jpg) | The same physical pattern/phase appears in both views. Asymmetric normal detail is present on all three plane orientations. |
| Opposing wall face | [Detail](24-opposing-wall.jpg), [Neutral](25-opposing-neutral.jpg) | The explicit left control lamp reveals the opposing face's correctly oriented pattern; neutral removes it. This lamp is absent in sealed controls. |
| Real window/sky reflection | [Reflection](05-window-reflection.jpg) | The actual opening and escaped sky appear in metal through a real reflective route. |
| Sunny nighttime | [Night](01-textured-night.jpg) | Sun patch disappears; warm lamp illumination, material detail and geometric shadows remain. |
| Empty finishes | [Neutral replacement](26-no-finishes.jpg) | Old wood/tile maps are replaced by established neutral finishes while the declared lamps remain. |
| Design 1.0 / No design | [Legacy](27-design-1.0-night.jpg), [No design](no-design-night.jpg) | Nighttime scenes contain no retained artificial sources; No design also clears finish state. |
| Concealed / lights off / thin-wall | [Concealed](29-concealed.jpg), [Off](28-lights-off.jpg), [Sealed side](29-thin-wall-sealed.jpg) | The concealed strip illuminates via ceiling bounce; lights-off and the opposite chamber remain black with no visible leak. |
| Unsupported inputs | [Mask](18-mask-unavailable.jpg), [Blend](19-blend-unavailable.jpg), [Frosted](30-frosted-unavailable.jpg), [Overcast](overcast-unavailable.jpg) | Explicit reasons disable tracing without invalidating architecture; Interactive remains usable. |
| Paused input / presentation | [Time reset](paused-time-reset.jpg), [Presentation](regression-presentation-neutral.jpg) | Paused time edit clears stale image/count to zero and retains pause. Tone mapping redraw keeps 119 samples in the visible daylight control. |

The final normal tracing pairs include the isolated left-chamber control lamp. The Interactive
orientation capture predates that addition; the opaque partition blocks the lamp from its
main-room view. Both tracing pairs use matching source sets. Earlier accepted daylight and
luminaire captures in their separate evidence directories are unchanged.

The resumed review corrected diffuse/specular energy coupling after a grazing white-furnace
check found excess reflected energy. The final model attenuates diffuse by reciprocal view/light
Fresnel transmission, documented in the implementation contract. `transportRevision` in the
capture index marks refreshed material/reflection/normal/AO/lighting images from this shader.
Earlier lifecycle, unavailable-input and Interactive captures exercise unchanged behavior.

## Original fixture regressions

These controls reload the original accepted projects through `pnpm start -- --project <path>`.
They retain Physical/Sunny, AgX/0 EV, the same viewport/DPR and each original camera's FOV.
Daylight controls use **2026-10-09 12:00 Europe/Budapest**; the concealed-strip control uses
**2026-10-11 23:00 Europe/Budapest**, matching the earlier review conditions.

| Project/scenario | Capture and count | Agent observation |
| --- | --- | --- |
| `daylight-path-tracing-windowed`, No design, `interior` | [Windowed, 119](regression-windowed.jpg) | The Sun patch and cool secondary daylight remain visible through the actual clear opening. |
| `daylight-path-tracing-sealed`, No design, `interior` | [Sealed, 77](regression-sealed.jpg) | The enclosed room remains black. |
| `daylight-path-tracing-thin-wall`, No design | [Lit interior, 84](regression-thin-lit.jpg), [sealed-side, 73](regression-thin-sealed.jpg) | The lit chamber receives daylight; the chamber across the 1 cm partition remains black. |
| `path-traced-luminaires`, `07-concealed.json` | [Interior, 70](regression-original-concealed.jpg), [sealed-side, 82](regression-original-concealed-sealed.jpg) | The original strip lights the ceiling and room through the open bounce route. Its baffle and opposite chamber retain occlusion. |

No browser warnings or shader/runtime errors were reported in the final production runs.
The visible AgX-to-Neutral windowed redraw retained 119 samples. Returning from 2D cleared
history to zero while retaining pause intent; Return to Interactive retained the selected
camera and daylight. Capacity/upload failures and cancellation/cleanup are covered by the
focused automated tests, separately from this real-shader appearance evidence.

## Material storage allocation regression (2026-10-13)

A maintainer's Open Space scenario reproduced `Material image framebuffer allocation failed`
with its larger native 2K/4K material set. The original allocator used RGBA32F for byte images
and filled shelves up to the maximum device texture width, leaving unused areas. A synthetic
header-only test with the same size mix (five 4096², three 2048², three 2048 × 1024, one 600²,
one 1000 × 333) required 16384 × 9216 / 2304 MiB in that layout. Compact placement plus RGBA8
uses 8192 × 14936 / 466.75 MiB. Native source dimensions, role references and filtering are
unchanged; this is storage reduction, not image downsampling. Non-byte runtime images retain
floating-point storage, independently of the unchanged floating-point HDR accumulation.

The rebuilt production browser application loaded the actual scenario through its existing
project server and accumulated 389 samples without shader/runtime warnings or errors. This
allocation check used Physical/Sunny, 2026-10-13 08:44 Europe/Budapest, Neutral/0 EV,
`camera-entrance-door`, DPR 1 and the default browser viewport. It verifies successful loading,
copying and tracing of the large map set; no complete convergence or calibrated lighting is
claimed. Private project assets/architecture and the local screenshot are kept outside the
repository. Earlier public fixture captures are retained.

Additional tests verify compact packing, nonoverlapping native-size regions and stable image
IDs, byte/float storage selection, allocation diagnostics and preservation of the previous
scene when allocation fails. Root lint, typecheck, all 2,478 tests and build pass. Allocation
failure now reports dimensions, image count, requested storage and GPU status/cause. Actual
free GPU memory is not exposed by WebGL; oversized sets can still fail explicitly, with
Interactive accessible and no maps silently removed.
