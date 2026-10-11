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
