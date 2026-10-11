# TASK-044: Daylight path-tracing proof of concept

## Task Metadata

- **Status:** Completed
- **Created:** 2026-10-09
- **Issued:** 2026-10-09
- **Completed:** 2026-10-11
- **Agent:** Codex
- **Repository:** PlanAxis
- **Description:** `TASK-044-description.md`
- **Related tasks:** TASK-038, TASK-039, TASK-042, TASK-043
- **Related ADRs:** ADR-002, ADR-003, ADR-004
- **Related specifications:** Apartment SVG 2.2, PlanAxis Project 1.0, PlanAxis Design 1.1, PlanAxis Material 1.1
- **Implementation commits:** 8c9ba10165a94416f657c0b7f8c90905354f87e5

## Purpose

Produce a first integrated daylight path-tracing view so the human maintainer can compare a progressively refined apartment interior with the accepted VXGI implementation.

TASK-043 was completed with known unresolved thin-wall light leakage. Further VXGI development is set aside. PlanAxis prioritizes convincing apartment-renovation images over real-time path-tracing performance; waiting a minute or longer for refinement is acceptable.

This task introduces a limited daylight proof of concept based on erichlof's Three.js path-tracing project. It evaluates Sun and sky illumination through a window in a complete architectural enclosure while retaining the existing renderer for comparison.

## Description

The authoritative task description is stored in:

`TASK-044-description.md`

The task was formally issued on 2026-10-09. The task description is now immutable.

## Execution Record

### Result

Codex implemented an experimental WebGL2 daylight path-tracing view inside the existing Three.js adapter boundary.

The implementation:

- reuses validated architectural meshes and shared navigation, including physical wall openings, two-sided floor/ceiling occlusion, and thin clear-window transmission;
- supports Physical Sunny illumination, neutral defaults, and opaque untextured matte finishes;
- traces direct Sun visibility and indirect diffuse Sun/sky transport without raster GI/fill, artificial luminaires, or bloom;
- progressively accumulates linear HDR with sample-count display, pause/resume, input invalidation, and cleanup;
- applies the existing tone mapping and exposure once and preserves camera/daylight/presentation state when switching views;
- retains the default interactive renderer and accepted VXGI implementation for comparison;
- adds windowed, sealed, and 1 cm partition project fixtures, focused tests, upstream provenance/license notices, and real-browser comparison captures.

The windowed capture shows the expected Sun patch and secondary interior illumination. The sealed room and sealed side of the thin partition remain black in the final path-traced captures. These observations establish the bounded proof of concept, not correctness for every apartment or calibrated daylight prediction.

### Verification

The [implementation report](../../architecture/daylight-path-tracing.md) records successful final repository verification:

```text
PASS  pnpm lint
PASS  pnpm typecheck
PASS  pnpm test
PASS  pnpm build
```

The suite contained 2,441 passing tests, including 13 added renderer tests and two added browser workflow tests. Focused renderer/browser tests, typechecks, and builds also passed after corrections.

Real-browser verification covered the windowed, sealed, and thin-partition projects; interactive GI Off/On comparison; progressive refinement; pause/resume; camera/fullscreen invalidation; renderer switching; and presentation-only redraw with retained samples. Final browser output reported no shader/runtime warnings or errors. An initial reversed-depth camera-ray failure was corrected and retained as diagnostic evidence with regression coverage.

No dependency manifest or lockfile changed, so dependency-change checks were not applicable. Performance benchmarks and render-time thresholds were intentionally excluded. The production build retained Vite's large-chunk advisory without a build failure.

These are the implementation's recorded verification results. Implementation checks were not rerun during this task-record-only finalization.

### Deviations from Description

None.

### Agent-Reported Follow-up Items

The implementation report identifies future review of very small geometry, very large world coordinates, and scenes beyond device texture capacity.

Broader PBR/textures and glazing, artificial luminaires, Studio/Overcast tracing, caustics, denoising, native WebGPU tracing, exports, and persisted jobs remain outside this completed proof of concept. Expansion requires separately defined work and does not reopen TASK-043.

## Human Review

### Review Status

Accepted

### Review Notes

On 2026-10-11, the human maintainer reported that Codex had successfully implemented TASK-044, supplied the accepted implementation commit, and explicitly requested completion of the task record.

Acceptance applies to the documented daylight-only experimental subset. Remaining sampling noise, diffuse/material/sky/glazing approximations, and broader unsupported features remain documented. The default renderer and VXGI baseline are retained.

### Human Changes After Agent Execution

None.

## Finalization

### Implementation Commits

```text
8c9ba10165a94416f657c0b7f8c90905354f87e5
```

### Commit Messages

```text
feat(renderer): add experimental daylight path tracing

Add progressive Sun and sky transport with shared navigation,
occlusion controls, tests, and browser comparison evidence.

Task: TASK-044
```

### Supersession

—

## Notes

TASK-044 was issued on 2026-10-09 and completed by human acceptance on 2026-10-11. The issued description remains immutable.

TASK-043 remains completed. TASK-044 neither reopens it nor requires removal or further tuning of its accepted implementation.

Performance benchmarks and a fixed render-time acceptance threshold are intentionally excluded. This task's visual acceptance concerns architectural occlusion and convincing daylight transport.

Source provenance, supported behavior, limitations, reproduction instructions, and comparison evidence are recorded in [the architecture report](../../architecture/daylight-path-tracing.md).
