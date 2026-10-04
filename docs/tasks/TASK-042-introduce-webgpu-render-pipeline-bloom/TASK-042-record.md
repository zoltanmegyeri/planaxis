# TASK-042: Introduce WebGPU Render Pipeline and Bloom

## Task Metadata

- **Status:** Ready
- **Created:** 2026-10-04
- **Issued:** —
- **Completed:** —
- **Agent:** —
- **Repository:** PlanAxis
- **Description:** `TASK-042-description.md`
- **Related tasks:** TASK-041
- **Related ADRs:** ADR-002, ADR-003
- **Related specifications:** —
- **Implementation commits:** —

## Purpose

Advance Phase 4 rendering realism by establishing PlanAxis's WebGPU post-processing pipeline and adding subtle HDR bloom.

TASK-041 completed persistent artificial-light rendering. The remaining luminaire placement/editing UI from the original Stage 4.4 plan is intentionally deferred; TASK-042 moves directly to Stage 4.5 and creates the post-processing foundation needed for bloom and later renderer effects.

## Description

The authoritative task description is stored in:

`TASK-042-description.md`

The task is ready for formal delegation and has not yet been issued.

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

TASK-042 is Stage 4.5 of the Phase 4 lighting/realism roadmap.

The task introduces a Three.js `RenderPipeline` and full-scene HDR bloom. Bloom is runtime renderer state, not persistent design/project data.

Named quality presets provide only a lightweight bloom recommendation: Performance disables bloom, Balanced enables it, and High enables it. The user may immediately override bloom independently; bloom edits must not change the quality preset.

The exact default strength, radius, and threshold are to be calibrated conservatively during implementation/manual verification so ordinary diffusely lit surfaces do not visibly glow.
