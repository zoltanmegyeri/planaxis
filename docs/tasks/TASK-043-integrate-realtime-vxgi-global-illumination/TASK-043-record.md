# TASK-043: Integrate Realtime VXGI Global Illumination

## Task Metadata

- **Status:** Ready
- **Created:** 2026-10-07
- **Issued:** —
- **Completed:** —
- **Agent:** —
- **Repository:** PlanAxis
- **Description:** `TASK-043-description.md`
- **Related tasks:** TASK-041, TASK-042
- **Related ADRs:** ADR-002, ADR-003
- **Related specifications:** PlanAxis Design 1.1
- **Implementation commits:** —

## Purpose

Advance Phase 4 from direct lighting and HDR bloom to convincing realtime indirect illumination.

TASK-042 established the WebGPU `RenderPipeline` and bloom foundation. TASK-043 implements Stage 4.6 by evaluating and integrating Three.js VXGI for apartment-scale global illumination while preserving PlanAxis's renderer boundaries, event-driven behavior, and WebGL2 fallback.

## Description

The authoritative task description is stored in:

`TASK-043-description.md`

The task is prepared and ready for formal issue.

## Execution Record

### Result

Pending.

### Verification

Pending.

### Deviations from Description

None.

### Agent-Reported Follow-up Items

None.

## Human Review

### Review Status

Pending

### Review Notes

None.

### Human Changes After Agent Execution

None.

## Finalization

### Implementation Commits

—

### Commit Messages

—

### Supersession

—

## Notes

TASK-043 covers Stage 4.6 of the Phase 4 lighting/realism roadmap.

The intended baseline is native-WebGPU VXGI with 256-voxel resolution, directional-radiance leakage reduction, finite temporal convergence, Physical sky-light approximation, and deterministic GI light budgeting.

Linear/area GI is deliberately experimental: a bounded spot-proxy approach should be evaluated, but preserving the existing direct `RectAreaLight` rendering without VXGI contribution is an acceptable fallback if the approximation is visually or computationally unsuitable.

WebGL2 remains a supported degraded path without realtime VXGI.
