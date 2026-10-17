# Path-tracing provenance

Inspected on 2026-10-09:
[erichlof/THREE.js-PathTracing-Renderer](https://github.com/erichlof/THREE.js-PathTracing-Renderer),
`gh-pages` commit **a930973667faf4502b427a01dd338a19522c8f6c**.
The repository's license is **CC0-1.0 Universal**, retained in [LICENSE-CC0.txt](LICENSE-CC0.txt).
The existing PlanAxis and Three.js licenses continue to apply to their respective code.

The bounded adaptation follows these upstream source files at that commit:

- `js/InitCommon.js`: floating-point progressive accumulation and separate output pass.
- `js/GLTF_Model_Viewer.js`: flattened triangle/material records and AABB data textures.
- `shaders/Gltf_Viewer_Fragment.glsl`: Sun visibility, diffuse paths, straight-through glass.
- `js/PathTracingCommon.js`: reviewed triangle intersection, random sampling and camera-ray conventions.

The local modules are a substantial rewrite of this workflow for PlanAxis, rather than a copy
of the demo runtime. They use borrowed PlanAxis meshes, a deterministic median/escape-link BVH,
compact four-texel triangles, two-sided Möller–Trumbore intersection, local PCG-style integer
sampling, eight diffuse interactions, independent Sun visibility at every diffuse hit, and
Russian roulette after three diffuse interactions. Shader code is supplied directly without
mutating `THREE.ShaderChunk`. No glTF round trip, demo ground box, HDR/blue-noise image, demo
controls, loaders, GUI, bundled Three.js build, or external runtime asset is included.

The viewer's thin-pane straight-through approximation is retained deliberately, with
Schlick reflection using IOR 1.5. Its fixed `0.01` scene offset is replaced by **0.00001 m**;
intersection accepts positive distances above one quarter of that offset. This scale is a
renderer numerical choice, independent of Apartment SVG tolerances. Traversal exhaustion
occludes instead of returning exterior light. The demo's short, Sun-terminating diffuse
branch is replaced by Sun next-event estimation plus continued diffuse transport.
No spatial denoising, motion-history mixing, independent Reinhard transform or gamma correction
is carried over. Two RGBA32F targets store a running linear average; Three.js applies the
current PlanAxis tone mapping/exposure and sRGB output exactly once in a separate output shader.

The classic `three` and `three/webgpu` entrypoints share core geometry/camera/math classes.
Only the fullscreen GLSL materials are rendered by `WebGLRenderer`. The architectural node
materials remain owned by the existing scene; only their already-linear base colors and
triangles are extracted. Camera rays unproject the actual near-plane depth, including the
native renderer's reversed depth convention, without mutating that camera or projection.

## Opaque PBR extension (2026-10-12)

TASK-046's `material-shader.ts`, `materials.ts`, `bsdf.ts` and revised scene/backend/integrator
are local renderer code. Mathematical references inspected on 2026-10-12:

- Eric Heitz, [Sampling the GGX Distribution of Visible Normals](https://jcgt.org/published/0007/04/01/paper.pdf),
  JCGT 7(4), 2018, pp. 1–13, equations 1–13 and the reflection PDF derivation.
  The isotropic stretched-view/projected-disk routine is reimplemented from those equations.
- Pharr, Jakob and Humphreys, [PBRT 4, A Better Path Tracer](https://www.pbr-book.org/4ed/Light_Transport_I_Surface_Reflection/A_Better_Path_Tracer),
  2023 edition, next-event estimation and power-heuristic emitter-hit weighting. No PBRT
  source code is incorporated.
- Pharr, Jakob and Humphreys, [PBRT 4, Scattering from Layered Materials](https://pbr-book.org/4ed/Light_Transport_II_Volume_Rendering/Scattering_from_Layered_Materials),
  inspected on 2026-10-13 for the interface/substrate energy distinction. The local bounded
  model uses reciprocal view/light Schlick transmission factors on diffuse, without PBRT
  code, a layered random walk, new coat properties or internal diffuse interreflection.

No additional third-party source file or asset is vendored; the existing CC0 upstream license
and PlanAxis/Three.js licenses remain unchanged. Local texture packing uses native-pixel
GPU copies and role-specific manual wrapped bilinear lookup. The earlier four-texel albedo
records become seven-texel triangles plus a deduplicated PBR table and image rectangles.
The old diffuse-emission partition is replaced by light/BSDF MIS. Scalar roughness uses
alpha = max(0.001, roughness²), with cancellation-resistant GGX evaluation. No artistic gain,
sample clamping, denoising, raster reflection input or persistent material property is added.

The 2026-10-13 allocation correction uses compact local shelf packing and RGBA8 storage for
decoded byte images, retaining RGBA32F for non-byte runtime maps and HDR/record textures.
No packing library or additional upstream code is incorporated. Image resolutions, raw role
channels and source ownership remain unchanged.

## Sunny reference calibration (2026-10-13)

TASK-047 adds local `simulation/clear-sky.ts`, `path-tracing/daylight.ts`, validated engineering
path controls and opt-in linear HDR readback. No third-party code or asset is incorporated.
Primary mathematical references inspected on 2026-10-13:

- ASHRAE 2017 tau model, relative air mass and beam/diffuse exponents as published in
  [EnergyPlus 24.2 Climate Calculations](https://bigladdersoftware.com/epx/docs/24-2/engineering-reference/climate-calculations.html#ashrae-revised-clear-sky-model-tau-model).
  Equations are locally implemented; fixed optical depths .4/2.3 and efficacy assumptions
  100/120 lm/W are PlanAxis reference choices, not site climate coefficients or an implementation
  of EnergyPlus's full Perez efficacy model.
- [NASA GSFC Solar Irradiance Science](https://earth.gsfc.nasa.gov/climate/projects/solar-irradiance/science):
  mean-distance reference 1361 W/m². No spectral or time-series dataset is copied.
- Pharr, Jakob and Humphreys, PBRT 4 (2023),
  [Infinite Area Lights §12.5](https://pbr-book.org/4ed/Light_Sources/Infinite_Area_Lights),
  especially portal §12.5.3: sampling proposals reduce variance without changing expected illumination.
  No portal framework/code is added.
- PBRT 4 [Path Tracing §13.2](https://pbr-book.org/4ed/Light_Transport_I_Surface_Reflection/Path_Tracing):
  compensated roulette and finite-path truncation; and
  [Roughness Using Microfacet Theory §9.6](https://pbr-book.org/4ed/Reflection_Models/Roughness_Using_Microfacet_Theory)
  plus [Layered Materials §14.3](https://pbr-book.org/4ed/Light_Transport_II_Volume_Rendering/Scattering_from_Layered_Materials)
  for the retained single-scattering/interface-substrate approximation. No PBRT code is incorporated.

The sky angular normalization is independently integrated from the local smoothstep gradient:
2 integral mu × smoothstep(0,.8,mu) dmu = .808. Sun is integrated normal irradiance, not disc
radiance. The initial calibration used the then-retained 683 lm/linear-RGB-unit convention and Y
normalization; its lamp/common-unit claim is superseded by the lamp review below. Twilight
(100 lx at the horizon, fading by -6°) is a labeled local assumption; equivalent
watts use the same assumed diffuse efficacy.
The 2026-10-15 horizon review restores the local Interactive gradient's constant horizon-color
continuation below zero elevation. This is a documented exterior boundary assumption, shared
by camera, reflection and lighting escapes; the calibrated upper-horizontal integral is unchanged.
No outdoor geometry, ground albedo model, Sun disc or third-party implementation is added.
No source-clamp, bounce gain, hidden exposure, emitter-window or artificial ambient fill is added.
Existing CC0 upstream and PlanAxis/Three.js licenses remain unchanged. Fixture texture controls
reuse previously generated public PlanAxis assets; no private data enters the repository.

## Contact precision and terminal estimators (2026-10-14)

The TASK-047 audit exposed sparse solar visibility at wall/ceiling contacts after the larger
source scale. The local ray-aligned edge test follows the mathematical translation/permutation/
shear construction in Woop, Benthin and Wald, [Watertight Ray/Triangle Intersection](https://jcgt.org/published/0002/01/05/paper.pdf),
JCGT 2(1), 2013, and [PBRT 4 §6.5, Triangle Meshes](https://pbr-book.org/4ed/Shapes/Triangle_Meshes),
inspected 2026-10-14. No implementation code is copied. Canonical shared-edge operand ordering
keeps reversed edges opposite even under contraction. WebGL2 has no double-precision fallback;
this is a bounded float32 implementation, not a claim of exact intersections at every scale.
The distance uses the triangle plane equation to preserve axis-aligned zero contacts. BVH exit
distances expand by eight float32 epsilons for conservative search; triangle edges are not expanded.

Scalar hit positions are kept inside the hit triangle's component bounds before the retained
0.00001 m normal offset. Reconstructing them from rounded barycentrics can cross an adjacent
face. Continuations terminate at uncertain quarter-offset contacts instead of skipping a tiny
occluder and escaping; shadow queries include nonnegative adjacent contacts.
Barycentrics still address the unchanged material UVs. There is no enclosure mask, photon clamp,
geometry dilation, added blocker, brute-force fallback or scene-specific correction.

The last permitted opaque hit now completes its BSDF-to-sky/emitter estimator; a subsequent
opaque hit stops. This keeps the existing emitter MIS partition complete at the finite limit.
The one-hit sky control directly exposes the former omission. Production uses 16 opaque/96
total interactions, with the original compensated roulette after three. Legacy intersection,
terminal behavior and source values remain available only in opt-in engineering controls to
reproduce the recorded baseline. Temporary contact probes are removed.

## Reflected-Sun proposal (2026-10-14 review continuation)

`sun-guide.ts` and the continuation mixture are local mathematical adaptations using the
existing Heitz 2018 visible-GGX sampler/PDF, BSDF reciprocity and direction reversal about a
horizontal reflector. No new third-party code, assets or dependencies are incorporated. Primary
references inspected during review:

- Heitz, [Sampling the GGX Distribution of Visible Normals](https://jcgt.org/published/0007/04/01/paper.pdf),
  JCGT 7(4), 2018, including the reflection PDF derivation. The existing sampling routine is
  shared; the proposal does not alter material evaluation.
- PBRT 4 [Improving Efficiency §2.2](https://pbr-book.org/4ed/Monte_Carlo_Integration/Improving_Efficiency)
  for mixture densities, preserved support and importance sampling; and
  [A Better Path Tracer §13.4](https://pbr-book.org/4ed/Light_Transport_I_Surface_Reflection/A_Better_Path_Tracer)
  for concentrated indirect-light variance and complete emitter MIS. Its biased path
  regularization is not implemented.

The receiver-cosine mixture is an explicitly bounded local heuristic. Actual visibility and
the original BSDF define the target integral. Captured prototype and current results are
separated in the evidence directory; no image filter or sample clamp supplies the improvement.

## Lamp photometric RGB correction

The maintainer's review identified a mismatch between the old `/683/Y` tracing lamp adapter
and Three.js Interactive lights. The correction follows the installed Three.js **0.186.1**
`PointLight.power`, `RectAreaLight.power`, `AnalyticLightNode.update` and `LightUtils`:
Phi/(4 pi) candela for points, Phi/(pi area) nits for rectangles, shared Kelvin RGB, inverse-square
receiving attenuation. The existing flux-normalized hard spot cone remains Phi/Omega; Three's
spotlight uses a different pi power convention and penumbra distribution.

Primary references inspected during this review:

- Three.js [PointLight](https://threejs.org/docs/pages/PointLight.html) and
  [RectAreaLight](https://threejs.org/docs/pages/RectAreaLight.html), plus the exact installed sources above.
- BIPM [candela definition](https://www.bipm.org/en/si-base-units/candela): 683 lm/W relates to
  monochromatic 540 THz radiation. It is not an extra divisor for native photometric RGB lamps.

No third-party code, asset or dependency is incorporated. Removing the lamp conversion preserves
nominal descriptor lumens/dimming, color, angular normalization and actual visibility. The already
accepted Sun/sky buffers retain the **daylight-specific** 683 reference-lux render mapping;
the old assertion of a common absolute photometric scale is withdrawn. Mixed-light appearance
is an explicit RGB approximation, with no hidden exposure compensation or new source gain control.
