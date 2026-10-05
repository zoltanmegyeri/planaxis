# TASK-042: Introduce WebGPU Render Pipeline and Bloom

## Task Metadata

- **Status:** Completed
- **Created:** 2026-10-04
- **Issued:** 2026-10-04
- **Completed:** 2026-10-05
- **Agent:** Codex
- **Repository:** PlanAxis
- **Description:** `TASK-042-description.md`
- **Related tasks:** TASK-041
- **Related ADRs:** ADR-002, ADR-003
- **Related specifications:** —
- **Implementation commits:** 70701cef6cc35123efb9fb4b4112aaf85053c874

## Purpose

Advance Phase 4 rendering realism by establishing PlanAxis's WebGPU post-processing pipeline and adding subtle HDR bloom.

TASK-041 completed persistent artificial-light rendering. The remaining luminaire placement/editing UI from the original Stage 4.4 plan is intentionally deferred; TASK-042 moves directly to Stage 4.5 and creates the post-processing foundation needed for bloom and later renderer effects.

## Description

The authoritative task description is stored in:

`TASK-042-description.md`

The task was formally issued on 2026-10-04 and remained immutable throughout execution.

## Execution Record

### Result

Codex implemented the Stage 4.5 WebGPU render-pipeline and bloom foundation.

The implementation:

- routes final apartment rendering through a renderer-owned Three.js `RenderPipeline`;
- uses an HDR scene pass and full-scene `BloomNode` composition before final output color transformation;
- bypasses bloom processing when bloom is disabled by switching the pipeline output away from the bloom graph;
- adds validated transient post-processing settings with defaults of Bloom enabled `true`, Strength `0.05`, Radius `0.1`, and Threshold `5`;
- exposes Bloom Enabled, Strength, Radius, and Threshold in the existing Rendering panel;
- keeps bloom separate from `RendererQualitySettings` and persistent project/design state;
- applies the agreed named-preset recommendation: Performance -> Bloom Off, Balanced -> Bloom On, High -> Bloom On;
- preserves manual bloom overrides independently from subsequent individual quality-field edits and display/DPR adaptation;
- keeps tone mapping and exposure at the final pipeline output transform;
- integrates post-processing with the existing resize, lifecycle, view, design, lighting, and event-driven rendering behavior;
- adds focused renderer/browser coverage;
- updates README, architecture documentation, agent guidance, and ADR-003 to describe the implemented pipeline and bloom behavior.

### Verification

No verification failures were reported for the completed implementation.

The implementation commit includes focused post-processing, lifecycle, and browser workflow coverage. Command-by-command repository verification results were not separately provided during task-record finalization.

### Deviations from Description

None.

### Agent-Reported Follow-up Items

None.

## Human Review

### Review Status

Accepted

### Review Notes

The TASK-042 implementation was accepted as successful.

PlanAxis now has a WebGPU/WebGL2-compatible post-processing pipeline with configurable HDR bloom. The default bloom tuning is intentionally conservative, and bloom remains transient runtime state independent from persistent design data and manual quality customization.

### Human Changes After Agent Execution

None.

## Finalization

### Implementation Commits

```text
70701cef6cc35123efb9fb4b4112aaf85053c874
```

### Commit Messages

```text
feat(renderer): add HDR render pipeline and bloom controls

Composite configurable bloom before tone mapping and preserve transient
settings across views, designs, and independent quality overrides.

Task: TASK-042
```

### Supersession

—

## Notes

TASK-042 completed Stage 4.5 of the Phase 4 lighting/realism roadmap.

The remaining luminaire placement/editing UI from Stage 4.4 remains intentionally deferred.

The implemented bloom defaults are:

```text
Enabled   true
Strength  0.05
Radius    0.1
Threshold 5
```

Named quality presets provide only an enabled-state recommendation: Performance disables bloom, while Balanced and High enable it. Users may override bloom independently without changing the named quality preset.

Realtime GI, IES photometry, path tracing, and luminaire placement/editing UI remain future work.
