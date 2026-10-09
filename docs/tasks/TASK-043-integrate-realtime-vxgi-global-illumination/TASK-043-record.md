# TASK-043: Integrate Realtime VXGI Global Illumination

## Task Metadata

- **Status:** Completed
- **Created:** 2026-10-07
- **Issued:** 2026-10-08
- **Completed:** 2026-10-08
- **Agent:** Codex
- **Repository:** PlanAxis
- **Description:** `TASK-043-description.md`
- **Related tasks:** TASK-041, TASK-042
- **Related ADRs:** ADR-002, ADR-003
- **Related specifications:** PlanAxis Design 1.1
- **Implementation commits:** 4aca54d122c1edca1e04c374e342dddcbd1b29e8

## Purpose

Advance Phase 4 from direct lighting and HDR bloom to convincing realtime indirect illumination.

TASK-042 established the WebGPU `RenderPipeline` and bloom foundation. TASK-043 evaluated and integrated Three.js VXGI for apartment-scale global illumination while preserving PlanAxis's renderer boundaries, event-driven behavior, and WebGL2 fallback.

## Description

The authoritative task description is stored in:

`TASK-043-description.md`

The task was formally issued on 2026-10-08 and remained immutable throughout execution.

## Execution Record

### Result

Codex implemented the Stage 4.6 native-WebGPU VXGI integration and evaluation.

The implementation:

- integrates VXGI into the existing render pipeline with depth/normal/velocity prepass data, a GI lighting context, TRAA, HDR bloom, and final output transformation;
- uses architecture-derived voxel bounds and keeps geometry re-voxelization separate from lighting reinjection and camera-only updates;
- adds finite temporal refinement and returns the renderer to idle after a bounded 32-frame convergence burst;
- adds four shadow-aware Physical sky helper lights for qualitative diffuse daylight;
- makes Sun, point, and spot lights contribute to indirect illumination;
- introduces deterministic, device-bounded GI light selection beyond Three.js's stock eight-light allocation;
- exposes transient GI enablement with the agreed Performance/Balanced/High quality recommendation behavior;
- preserves WebGL2 rendering with realtime GI unavailable;
- evaluates bounded linear/area spot proxies and rejects them for production, preserving existing direct `RectAreaLight` rendering without VXGI contribution;
- adds an opt-in engineering evaluation harness, focused tests, architecture documentation, and representative evaluation captures.

The resulting VXGI implementation is functional but does not meet all of the original visual-quality goals. In particular, strong local lights can still leak visibly through thin opaque walls.

### Verification

The implementation reports:

```text
PASS  pnpm lint
PASS  pnpm typecheck
PASS  pnpm test
PASS  pnpm build
PASS  git diff --check
```

The workspace suite contained 2,426 passing tests. Separate focused runs passed 231 renderer tests and 244 browser tests.

Manual native-WebGPU and WebGL2 evaluation covered daylight, artificial lighting, temporal convergence, lifecycle transitions, many-light behavior, leakage scenarios, linear/area proxies, and fallback behavior.

Known failed visual cases remain documented rather than being treated as successful verification.

### Deviations from Description

The original hard visual acceptance target for thin-wall/floor leakage was not fully achieved.

Directional radiance reduces leakage, but strong point/spot sources can still produce obvious illumination through 10 cm opaque partitions. Connected-room transport also remains weaker than desired.

The preferred 32-light GI budget is device-bounded. On the evaluated Apple M1, the hardware limit of 16 samplers per shader stage prevents arbitrary large collections of shadow-casting lights; supported many-light evaluation succeeded with twelve actual lights.

The linear/area proxy experiment was rejected for production because it altered direct appearance and added excessive shadow/light cost. This follows the task's allowed fallback: linear/area lights retain their existing direct `RectAreaLight` rendering and do not contribute to VXGI.

### Agent-Reported Follow-up Items

Further VXGI work remains possible around:

- thin-wall occlusion and light leakage;
- shadow sampler sharing/atlasing and larger light collections;
- temporal sampling noise;
- weak room-to-room/doorway transport;
- broader testing across GPUs and textured designs.

Further VXGI investigation is intentionally set aside for now. A separate follow-up will evaluate path tracing as a potentially higher-quality global-illumination approach.

## Human Review

### Review Status

Accepted

### Review Notes

The TASK-043 implementation was accepted with the known limitations above.

The integration works and provides realtime indirect lighting, but the visual result remains materially below the desired quality level, primarily because of unresolved light leakage through thin walls and other VXGI approximation limits.

No further VXGI refinement is required before closing this task. The next direction is to investigate a path-tracing implementation and determine whether it can provide substantially better global illumination for PlanAxis.

### Human Changes After Agent Execution

None.

## Finalization

### Implementation Commits

```text
4aca54d122c1edca1e04c374e342dddcbd1b29e8
```

### Commit Messages

```text
feat(renderer): integrate realtime VXGI global illumination

Add transient GI controls, sky lighting and finite refinement.
Document accepted leakage and hardware limitations.

Task: TASK-043
```

### Supersession

—

## Notes

TASK-043 completes the VXGI Stage 4.6 implementation as an accepted experimental realtime-GI solution with known limitations; completion does not mean every original visual acceptance criterion passed.

The retained implementation uses native-WebGPU VXGI, 256-voxel resolution, directional radiance, finite temporal refinement, qualitative Physical sky lighting, and deterministic device-bounded light selection. WebGL2 remains the supported degraded path without VXGI.

Linear/area luminaires retain direct `RectAreaLight` rendering and do not inject VXGI.

The principal unresolved visual issue is light leakage through thin opaque partitions. Because the overall VXGI result remains far from the desired realism, the next GI direction will be a separate path-tracing evaluation rather than continued VXGI tuning.
