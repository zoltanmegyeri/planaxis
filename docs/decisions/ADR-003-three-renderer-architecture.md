# ADR-003: Introduce the Three.js Renderer Boundary

- **Status:** Accepted
- **Date:** 2026-09-08

## Context

The browser retains validated 2D apartments and the exact architectural model builder
is implemented. Interactive 3D inspection now needs meshes, cameras, lighting, and GPU
resource ownership without coupling these concerns to authoritative geometry or React.

## Decision

Use Three.js directly in the non-React `@planaxis/renderer-three` package. The browser
calls `buildArchitecturalModel3D` only with trusted `ValidatedApartment2D`, selects the
view and camera, and owns mounting and resize observation. The renderer owns all mesh
construction, camera adaptation, controls, materials, lighting, and GPU lifecycle.
The surface foundation refinement below places exact architectural boundary derivation
and finish-target semantics in `model-3d`, before this mesh-construction boundary.
React Three Fiber would introduce another scene/lifecycle abstraction without a current
need; React remains responsible for application UI only.

Use `WebGPURenderer` from `three/webgpu`, with its supported automatic WebGL2 fallback.
Both backends use the same scene and materials. An unavailable backend or unexpected
model/rendering failure becomes an explicit application failure. Three.js 0.186.1 and
matching release-line typings 0.186.0 were selected from npm registry metadata checked on 2026-09-29;
both are stable and non-deprecated, with no conflicting engine or peer constraints.

The centralized renderer boundary converts exact centimeters to meters:

```text
100 PlanAxis centimeters = 1 Three.js world unit
(X, Y, Z) -> (X / 100, Z / 100, Y / 100)
```

This conversion changes handedness to preserve SVG screen layout with architectural Z up.
Surface winding is adjusted so the floor faces upward and the ceiling faces downward.
Model-space Z already includes the level offset;
the renderer must not apply it again. Exact values convert to JavaScript numbers only
inside this package, including geographic metadata supplied to approximate runtime solar
simulation. Renderer and simulation values never flow
back into the authoritative model.

## Geometry and visualization

Triangulate the trusted floor and ceiling polygons with Three.js polygon triangulation. They
have no slab thickness. Floor faces upward; ceiling faces downward for inspection from above while showing the
ceiling from inside. The ceiling casts two-sided shadows independently of visual culling.

### Surface foundation refinement (2026-09-13)

Derive exact architectural surfaces in `@planaxis/model-3d` before constructing meshes.
The model retains validated spaces, and its separate surface builder owns stable base
finish targets, explicit space-override fallback/coverage, wall-side orientation, and
physically existing opening-reveal ownership. This keeps semantic finish identity and
architectural adjacency independent of renderer precision and tessellation. Space
coverage does not add coplanar physical surfaces or assign materials.

For each wall, partition exact longitudinal and vertical extents at opening edges and
omit void cells spanning the validated full wall thickness, including permitted thickness
tolerance. Cancel internal faces and clip boundary rectangles against neighboring retained
cells. Buried/contact faces disappear; coincident exterior patches belong to the earlier
source wall. This preserves the existing solid union and source ownership, including
unequal wall heights, without a generic CSG dependency. Caps and ends without a designable
target remain neutral structural surfaces. No renderer tessellation is stored in `model-3d`.

The adapter triangulates these derived patches, computes normals, and converts shared
coordinates identically to prevent partition seams in shadow maps. One mesh per source
wall retains base finish-target index ranges. Floor and ceiling likewise consume derived
physical surfaces. The texture-capable refinement below adds UVs and runtime assignments.

Windows have transmissive, zero-thickness center planes spanning the trusted opening.
Doors remain openings: physical leaf thickness and sliding-track geometry are absent
from the model. No frames, trim, hardware, or source finishes are inferred. Fixed elements use
their trusted prisms. Utility spheres are explicitly visualization markers, not physical
fixture dimensions or active lights. Source-ID groups retain a practical scene mapping,
including empty groups for cameras and door openings.

Neutral standard PBR materials, built-in environment illumination, a directional light, and bounded
2048 × 2048 shadow maps are visualization defaults. Opaque surfaces cast front-face
shadows so the shadow map records light-entry surfaces instead of solid exit surfaces;
this prevents bright leaks at wall corners and floor contacts. The directional shadow projection uses the bounds half-diagonal. A renderer-only normal
bias of four shadow texels and positive depth bias of 2.5 texels (normalized by depth
range) balance self-shadowing against wall–ceiling contact leaks without changing
architectural meshes. Broad Overcast filtering can retain faint contact halos.
The single-level floor receives directional shadows but casts only in perspective
local-light passes. It cannot occlude the room above it from the overhead key/Sun;
excluding that impossible occlusion prevents biased wall samples below the floor
from creating dark contact strips. Floor shadow masks preserve alpha masks and
are isolated from shared wall/ceiling materials.
Reversed viewing depth replaces logarithmic depth for VXGI-compatible shadow injection.
An explicit material depth node selects the initialized backend's forward/reversed
perspective or orthographic curve per render camera, avoiding
false self-shadowing when Three.js r186 reuses mapped-material shadow shaders across
directional and perspective luminaire passes. These settings do not describe source
material or luminaire semantics. Advanced lighting, persistent material assets, and design workflows remain future work.

### Texture-capable surface refinement (2026-09-13)

The surface model owns exact physical mapping frames with outward-oriented U/V directions;
space targets share base frames. A separate runtime-only PBR vocabulary in `model-3d`
allows transient finish assignments without adding presentation state to architecture or
defining a persistent material format. Renderer-side coverage tessellation yields disjoint
material draw groups. UVs divide physical centimeter distances by runtime texture dimensions.
The adapter configures color/data maps and owns cloned textures and materials; callers own
already loaded source textures resolved by in-process references. Window glass uses physical
transmission with zero thickness and qualitative glass-type defaults. This refines the
existing boundary without adding dependencies or changing Apartment SVG semantics. See
[the current runtime contract](../architecture/overview.md#59-renderer-adapter).

### Runtime presentation refinement (2026-09-13)

The renderer generates a deterministic built-in room PMREM after backend initialization,
replacing hemisphere ambient illumination while retaining the directional key/shadow light.
Lighting/reflections use `scene.environment`; the neutral background stays independent.
The renderer-owned presentation contract supports environment intensity, architectural yaw,
AgX (default) / ACES Filmic / Neutral tone mapping, and exposure as EV (`2 ** EV`).
React owns transient toolbar selections; updates render immediately without rebuilding
architecture or creating a persistent loop. Settings survive camera/view changes and model
replacement in the same instance. Generation resources and the owned output target are
released through the renderer lifecycle. This uses the existing Three.js dependency and
preserves the domain/rendering boundary.

Persistent material/environment assets, presentation and design-scenario persistence,
lighting design, and post-processing remain future work.

### Physical daylight refinement (2026-09-29)

Introduce `@planaxis/simulation` for deterministic, renderer-independent solar azimuth,
geometric elevation, and the Apartment SVG 2.2 north-heading conversion. The compact NOAA
fractional-year equations use explicit Unix milliseconds and UTC only. Native numbers here
are approximate runtime simulation values, never authoritative geometry or persistence.

The browser initializes one stable instant and defaults to Studio. Physical requires validated
SVG location/orientation and replaces the arbitrary key with the calculated Sun. The adapter
maps its scene-to-Sun vector from `(X,Y,Z)` to `(X,Z,Y)`, keeps the target at apartment center,
and reframes shadows to cover the apartment. Sun intensity is zero at/below the horizon;
otherwise elevation/weather determine its qualitative intensity and color, without claiming irradiance accuracy.
Physical suppresses RoomEnvironment and ambient fill, and requires shadows even when the
stored Studio preference is Off (effective Low). Mode changes invalidate shadows, render
immediately, and preserve geometry, materials, and navigation. Studio preferences return
unchanged. The daylight-controls refinement adds transient Sunny/Overcast conditions and a
renderer-owned TSL procedural background, driven by the same Sun direction. A simple gradient
and Sun-aligned glow support day/twilight/night without clouds, textures, or environment GI.
The node is reused across updates/model replacement and disposed with the renderer. Overcast
uses weak cool direct Sun and wider resolution-scaled r186 PCF filtering on both backends,
without reducing occlusion strength. Browser session state survives Studio and 2D/3D switches;
explicitly zoned civil-time conversion belongs to simulation. No persistence or solar loop is
introduced. See [solar simulation](../architecture/overview.md#71-solar-simulation) for the
approximation, time-zone/DST policy, and deferred diffuse sky transport.

The visually inward-facing ceiling casts from both sides using a separate shadow-side setting.
Cloned ceiling finishes keep shared wall/floor finish policies unchanged. No slab thickness
or opaque window blocker is invented.

### Persistent luminaire rendering refinement (2026-09-30)

The browser adapts successfully resolved Design 1.1 lights into `RuntimeLuminaire`, excluding
schema, paths and persistence identity. The renderer maps point/spot to PointLight/SpotLight
with luminous power, inverse-square attenuation, no range cutoff and architectural shadows.
Existing shadow quality selects resolution, with Low as the minimum for active design lights.
Spot full beam angles become half-angles with fixed 0.2 penumbra. Linear emitters use a
one-sided RectAreaLight of length × 1 cm; area emitters use their declared dimensions. Both
rectangular types intentionally remain shadowless and use shared reference-counted LTC textures.

Derive the normative Design 1.1 frame before swapping the PlanAxis Y/Z basis; local rectangle
X/Y follow rolledSide/rolledVertical, and -Z follows forward. Convert centimeters once.
Effective lumens include enabled state and dimming. Approximate Kelvin white is converted to
linear RGB without camera white balance. Lights survive daylight and camera changes; replacement,
quality/model changes and final disposal release owned resources. Rendering remains event-driven.
Manual JSON edits followed by reload/reselection are supported; luminaire editing UI, fixture
meshes, IES and rectangular shadows remain deferred. Point/spot VXGI integration is described
below; linear/area GI remains unsupported. See the architecture runtime contract.

### RenderPipeline and HDR bloom refinement (2026-10-04)

Final viewport rendering uses one `RenderPipeline` per existing `WebGPURenderer`. A TSL scene
pass supplies half-float HDR color to full-scene `BloomNode`; the additive scene/bloom result
precedes RenderPipeline's renderer-driven tone mapping/exposure and output color conversion.
The same node graph serves native WebGPU and automatic WebGL2 fallback. Backend/pipeline
failures retain the application failure path; no `EffectComposer` or alternate renderer exists.

Full-scene threshold bloom is deliberate because Design 1.1 luminaires describe idealized
emitters without visible fixture meshes. Do not invent emissive geometry or MRT extraction.
Defaults are enabled, strength 0.05, radius 0.1, threshold 5, favoring soft HDR highlights while
suppressing diffuse surface glow. Bloom supplies neither lighting nor GI.

The renderer owns a separately validated runtime post-processing contract. Uniform edits reuse
the effect; toggles invalidate the output graph and bypass all bloom work when disabled.
The scene/camera, architecture, finishes and lights are retained. Both passes follow effective
drawing-buffer size during event-driven frames; no idle loop is added. Explicit disposal owns
the output material, scene-pass target and BloomNode resources, including in-flight-init cleanup.

React owns session bloom controls independently of quality persistence. Startup maps restored
Performance to Off and Balanced/High/Custom to On. Explicit Performance/Balanced/High selection
recommends Off/On/On, after which manual bloom overrides leave quality unchanged. Quality-field
edits and display/DPR adaptation leave bloom unchanged. State survives design and view changes
but is never written to local storage or any persistent format. Luminaire placement/editing,
IES and path tracing remain deferred.

### Native-WebGPU VXGI integration refinement (2026-10-08)

Keep GI inside the existing renderer and final RenderPipeline. The native-WebGPU graph is
geometry-only depth/packed view normals/velocity → VXGI → neutral geometric AO plus GI context
→ HDR scene → TRAA → optional HDR bloom → output transform. Material AO remains intact.
The prepass excludes renderer light layers and transparency; both GI passes disable MSAA.
WebGL2 retains the existing HDR/bloom graph, with GI unavailable. No persistent format changes.

Architecture-only borrowed meshes define bounds plus 0.25 m; markers, transparent window panes
and light targets are excluded. Model/material replacement re-voxelizes; lighting reinjects;
camera movement changes only screen-space/temporal data. Reset history on discontinuities and
finish an immediate frame plus 32 bounded refinement draws. No GI idle animation loop is added.
Four fixed shadow-aware sky directions derive cool Overcast/weak Sunny/twilight/night strengths
from existing daylight state, separately from the visible sky and Studio environment/fill.

The evaluated integration defaults retain resolution 256 and directional radiance, with one
25° cone, zero additional cached bounces (one screen-space indirect bounce), intensity 8,
step scale 0.5, normal offset 0.5 voxels, unbounded tracing and temporal filtering. Preferred
light budget is 32; native device texture/sampler limits can reduce it. Sun precedes four sky
sources, followed by stable design-local IDs. Provision r186's fixed eight-slot arrays before
building the injection kernel. Request only advertised texture/sampler capacity; the M1's
16-sampler stage limit still excludes large collections of shadow maps.

Review found unity GI intensity too weak. The indirect-only gain is now 8 after comparing
1/4/8/16 in the fixed-buffer harness; direct light power and output exposure are unchanged.
This is qualitative renderer tuning, not photometric calibration. Strong luminaires and
existing voxel leakage become brighter as well; the evaluation records those limitations.

Reversed depth preserves native viewing precision while matching stock VXGI local-light shadow
comparisons. WebGL2 can use forward depth when reversed depth is unsupported. Use per-render
projection/backend uniforms, metric local-light normal bias and zero local depth bias. Floors
cast two-sided local shadows; their existing overhead-directional exclusion remains in place.
Before injection after geometry/light invalidation, warm the exact HDR lighting context offscreen
through the same pipeline, then reinject using completed shadow maps. Advance Three's node frame
for each explicit GI draw; its housekeeping RAF alone cannot guarantee fresh FRAME effects.
Keep these r186 bridges isolated and re-evaluate them when upgrading Three.js.

The [evaluation report](../architecture/realtime-global-illumination.md) records 1080p timings,
matrix results and remaining failures. Strong local lights still leak through thin partitions,
and large shadow-light collections exceed the reference device's sampler limit. Bounded rectangular spot proxies changed
direct appearance and exceeded that limit in the stress case; retain existing direct RectAreaLight
rendering without their GI.

On 2026-10-08, the human maintainer declared TASK-043 completed with these known limitations
and set aside further VXGI work in favor of a separate path-tracing evaluation. The implemented
integration is retained, and the original visual acceptance failures remain documented.
This closes the task without selecting or implementing a replacement rendering architecture.
Placement/editing, IES, path tracing and richer atmosphere remain Phase 4 work.

## Cameras and lifecycle

OrbitControls supplies orbit, pan, and dolly with mouse and touch input. Initial framing
uses model bounds and viewport aspect. Embedded cameras use trusted heading and pitch
(positive pitch looks downward), with a heading-derived up vector at vertical pitches.
Horizontal FOV becomes vertical FOV using `2 atan(tan(hFOV / 2) / aspect)` on selection
and resize. Returning to inspection reframes the model; navigation never edits source data.

The public lifecycle is create, initialize, setModel, resize, selectCamera, render, dispose.
Rendering is event-driven without a persistent application animation loop. Runtime quality
settings now own pixel ratio, shadow resolution, environment enablement, and neutral ambient
fill. The browser's Balanced preset caps DPR at two; High permits native DPR. Quality updates
preserve camera/navigation and PBR resources, with browser-local preferences independent of
project/design persistence. See [the current quality contract](../architecture/overview.md#59-renderer-adapter).
Model replacement disposes old mesh geometries, owned textures, and shared materials; final
disposal also disconnects controls and releases shadow and renderer resources. The React
component disconnects its ResizeObserver. In-flight initialization finishes releasing its
backend after unmount and cannot render a stale scene.

## Consequences and verification

The GPU boundary can be mocked while testing actual Three.js scene geometry and camera
conversion without a physical GPU. Ray tests verify openings, and lifecycle tests cover
replacement, resize, failure, and disposal. Browser tests cover validated gating, switching
without reprocessing, camera choices, and cleanup. Real-browser verification remains
necessary for readable output and backend integration.

The renderer increases browser bundle size and remains subject to GPU precision. It is
an inspection adapter, not a CAD boolean kernel or photometric renderer.

## References

- [Three.js WebGPURenderer](https://threejs.org/manual/en/webgpurenderer)
- [ADR-001](ADR-001-typescript-monorepo.md)
- [ADR-002](ADR-002-react-browser-ui.md)
- [Apartment SVG 2.2](../specifications/apartment-svg/2.2.md)
