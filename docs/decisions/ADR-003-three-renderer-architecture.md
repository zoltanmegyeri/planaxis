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
this prevents bright leaks at wall corners and floor contacts. A renderer-only normal
bias of two shadow texels scales with the apartment bounds to suppress self-shadow
banding without changing architectural meshes. These settings do not describe source
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
