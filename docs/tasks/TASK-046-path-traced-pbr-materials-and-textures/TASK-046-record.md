# TASK-046: Opaque PBR materials and textures for path tracing

## Task Metadata

- **Status:** Completed
- **Created:** 2026-10-12
- **Issued:** 2026-10-12
- **Completed:** 2026-10-13
- **Agent:** Codex
- **Repository:** PlanAxis
- **Description:** `TASK-046-description.md`
- **Related tasks:** TASK-044, TASK-045
- **Related ADRs:** ADR-002, ADR-003, ADR-004
- **Related specifications:** Apartment SVG 2.2, PlanAxis Project Format 1.0, PlanAxis Design Format 1.0 and 1.1, PlanAxis Material Format 1.0 and 1.1
- **Implementation commits:** f92b7200ee9a00b81c172877caa44a995b771ee1

## Purpose

Extend the accepted path-tracing experiment so apartment finishes can use the existing opaque PBR material assets and texture maps. The human maintainer accepted TASK-044 daylight transport and TASK-045 design-luminaire lighting and identified material support as the next priority.

This task enables textured, glossy, and metallic finishes while retaining Physical Sunny, the current clear-window approximation, and the existing application workflow. Image correctness and convincing apartment materials take priority over rendering speed.

## Description

The authoritative task definition is the sibling document:

```text
TASK-046-description.md
```

It defines the complete delegated scope, required reading, implementation constraints, verification, and acceptance criteria. The description is finalized for delegation and must remain unchanged after issue.

## Execution Record

### Result

Codex extended the experimental WebGL2 path tracer with opaque Material 1.0/1.1 metallic/roughness PBR shading and all five defined texture roles. GGX reflection, diffuse/specular mixture sampling, and light/BSDF multiple-importance weighting support glossy and metallic transport, including reflected source sheets, architecture, and window/sky paths. AO retains its indirect-shading semantics, while material factors, color/data channels, opaque alpha, and schema compatibility preserve the existing contracts.

Tracing retains the existing physical UVs, finish groups, partitions, and tangent conventions. Native image pixels are copied into a deduplicated tracing-owned atlas with wrapped bilinear sampling. Atomic replacement, readiness/invalidation, capacity diagnostics, cleanup, and source ownership preserve Interactive resources and camera/navigation. The accepted daylight, clear-pane, luminaire, concealed-strip, and sealed/thin-wall behavior remains available within the expanded material model.

Focused tests, valid project/material fixtures, architecture/provenance documentation, and real-browser evidence cover material limits, map roles, orientation, assignment controls, unsupported inputs, and lighting/lifecycle regressions. Review corrections address grazing diffuse/specular energy coupling and allocation failures on larger native 2K/4K texture collections, without downsampling assets or changing persistent formats.

### Verification

Implementation results below are reported in the committed [PBR browser review and verification report](../../architecture/path-traced-pbr-evaluation/README.md):

| Check | Result |
| --- | --- |
| `pnpm lint` | PASS — reported by the implementation review. |
| `pnpm typecheck` | PASS — reported by the implementation review. |
| `pnpm test` | PASS — 2,478 tests reported after renderer/browser coverage and allocation regressions. |
| `pnpm build` | PASS — the existing Vite chunk-size advisory remains. |
| Real-browser material/control review | PASS — reported captures cover textures, dielectric/metallic roughness limits, reflection, normal/AO controls, packed/separate maps, finish replacement, and explicit unsupported-input reasons. |
| Lighting and lifecycle regressions | PASS — reported original daylight/luminaire fixtures retain the Sun patch, concealed bounce route, and dark sealed/thin-wall controls; presentation redraw retains samples and paused input changes clear stale history. |
| Large-texture allocation regression | PASS — the rebuilt application loaded the maintainer's actual Open Space scenario and accumulated 389 samples after compact packing and appropriate byte/float storage corrections. |

[Capture metadata](../../architecture/path-traced-pbr-evaluation/captures.json) records public project/scenario, material assignments, camera, zoned time, sample count, backend, and drawing-buffer settings. No browser warnings or shader/runtime errors were reported in the final production runs. The private Open Space assets and screenshot remain outside the repository; its loading result is recorded in the review report.

Automated coverage separately checks material/color/channel semantics, physical mapping and tangent frames, numerical energy/grazing/endpoint behavior, MIS weights, capacity/partial-upload failures, shared ownership, cleanup, and active/paused material invalidation.

No dependency manifests or lockfile changed, so dependency-change checks were not applicable. Implementation commands and browser cases were not rerun during this task-record-only finalization; the results above are attributed to the committed implementation report.

### Deviations from Description

None.

### Agent-Reported Follow-up Items

None.

## Human Review

### Review Status

Accepted

### Review Notes

On 2026-10-13, the human maintainer confirmed that Codex successfully implemented TASK-046, identified the accepted implementation commit, and requested that the task be marked Completed.

Public material captures use fewer samples than the usual 1,024-sample review guideline; the report records assessable controlled differences alongside remaining grain and bright Monte Carlo samples. The bounded implementation retains single-scattering GGX energy loss on rough metals, a stable polished-limit regularization, normal-map safeguards, bilinear filtering without mipmaps/anisotropy, bounce limits, and explicit device/resource-capacity failures. It does not claim calibrated photometry, complete convergence, or full transparency/glazing/weather support.

### Human Changes After Agent Execution

None.

## Finalization

### Implementation Commits

- `f92b7200ee9a00b81c172877caa44a995b771ee1`

### Commit Messages

```text
feat(renderer-three): support path-traced PBR materials and textures

Add GGX transport, physical texture mapping, and indirect AO.
Preserve resource ownership and verify material and lighting controls.

Task: TASK-046
```

### Supersession

—

## Notes

Intended repository directory:

```text
docs/tasks/TASK-046-path-traced-pbr-materials-and-textures/
```

The task was issued to Codex on 2026-10-12 and completed on 2026-10-13 after human acceptance of the implementation commit. The issued task description remains unchanged and immutable.

Masked/blended transparency, frosted/tinted glazing, additional weather modes, new material properties, material editing/import UI, and performance benchmarking remain outside this task.
