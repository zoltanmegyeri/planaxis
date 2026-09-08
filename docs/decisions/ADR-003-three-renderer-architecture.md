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
React Three Fiber would introduce another scene/lifecycle abstraction without a current
need; React remains responsible for application UI only.

Use `WebGPURenderer` from `three/webgpu`, with its supported automatic WebGL2 fallback.
Both backends use the same scene and materials. An unavailable backend or unexpected
model/rendering failure becomes an explicit application failure. Three.js 0.185.1 and
matching release-line typings 0.185.4 were selected from current npm registry metadata;
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
inside this package, including angles before trigonometry. Renderer values never flow
back into the authoritative model.

## Geometry and visualization

Triangulate the trusted floor and ceiling polygons with Three.js ShapeGeometry. They
have no slab thickness. Floor faces upward; ceiling faces downward and does not cast
shadows, allowing inspection from above while showing the ceiling from inside.

For each wall, collect all associated door/window openings. Partition the longitudinal
and vertical extents at every opening edge and omit cells inside the opening rectangles.
Each retained cell spans the wall thickness. Emit one wall mesh containing only the
boundary faces of the retained-cell union. Cancel shared internal faces and convert
shared boundary coordinates identically, preventing partition seams in shadow maps. This supports multiple openings, different
sill/lintel heights, and either wall axis without a generic CSG dependency. Validated
thickness matches are interpreted as through-openings, including permitted tolerance.
The original exact model remains unchanged. Wall boundary rectangles are clipped against neighboring retained cells, removing
buried/contact faces and assigning coincident exterior patches to one source wall. This
renders the solid union without competing corner caps, including unequal wall heights; no renderer tessellation is stored in `model-3d`.

Windows have transparent, zero-thickness center planes spanning the trusted opening.
Doors remain openings: physical leaf thickness and sliding-track geometry are absent
from the model. No frames, trim, hardware, or finishes are inferred. Fixed elements use
their trusted prisms. Utility spheres are explicitly visualization markers, not physical
fixture dimensions or active lights. Source-ID groups retain a practical scene mapping,
including empty groups for cameras and door openings.

Neutral standard PBR materials, hemisphere illumination, a directional light, and bounded
2048 × 2048 shadow maps are visualization defaults. Opaque surfaces cast front-face
shadows so the shadow map records light-entry surfaces instead of solid exit surfaces;
this prevents bright leaks at wall corners and floor contacts. A renderer-only normal
bias of two shadow texels scales with the apartment bounds to suppress self-shadow
banding without changing architectural meshes. These settings do not describe source
material or luminaire semantics. Free-walk navigation, advanced lighting, materials, and design workflows remain
future work.

## Cameras and lifecycle

OrbitControls supplies orbit, pan, and dolly with mouse and touch input. Initial framing
uses model bounds and viewport aspect. Embedded cameras use trusted heading and pitch
(positive pitch looks downward), with a heading-derived up vector at vertical pitches.
Horizontal FOV becomes vertical FOV using `2 atan(tan(hFOV / 2) / aspect)` on selection
and resize. Returning to inspection reframes the model; navigation never edits source data.

The public lifecycle is create, initialize, setModel, resize, selectCamera, render, dispose.
Rendering is event-driven without a persistent application animation loop. Pixel ratio is
capped at two. Model replacement disposes old mesh geometries and shared materials; final
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
