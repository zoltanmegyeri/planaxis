# TASK-045: Path-traced design luminaires

## Task Metadata

- **Status:** Completed
- **Created:** 2026-10-11
- **Issued:** 2026-10-11
- **Completed:** 2026-10-12
- **Agent:** Codex
- **Repository:** PlanAxis
- **Description:** `TASK-045-description.md`
- **Related tasks:** TASK-043, TASK-044
- **Related ADRs:** ADR-002, ADR-003, ADR-004
- **Related specifications:** Apartment SVG 2.2, PlanAxis Project Format 1.0, PlanAxis Design Format 1.0 and 1.1, PlanAxis Material Format 1.1
- **Implementation commits:** 5aeea058a535084857d1cd62e81eb522327aef0a

## Purpose

Continue the accepted daylight path-tracing experiment by rendering the artificial lights already defined by PlanAxis Design Format 1.1. The human maintainer tested TASK-044 in several scenarios and found its images substantially more convincing than the current VXGI output.

This task evaluates point, spot, linear, and area light transport, including indirect illumination from a concealed LED strip, within the existing experimental rendering view. Image correctness and convincing apartment lighting take priority over rendering speed.

## Description

The authoritative task definition is the sibling document:

```text
TASK-045-description.md
```

It defines the complete delegated scope, required reading, implementation constraints, verification, and acceptance criteria. The description is finalized for delegation and must remain unchanged after issue.

## Execution Record

### Result

Codex extended the experimental WebGL2 path tracer with flux-normalized direct and diffuse transport for resolved Design 1.1 point, spot, linear, and area luminaires. All effective sources participate through probability-corrected sampling and finite architectural visibility; linear/area sources use renderer-owned one-sided emitting sheets. Existing enabled/dimming, placement/orientation, Kelvin, cone, and dimension semantics are preserved without format changes.

Luminaire replacement invalidates stale accumulation, including while paused, and owns source-resource allocation, capacity failures, and cleanup. Presentation-only redraw and navigation remain intact. The implementation also corrects projection-depth convention changes that previously reset unchanged history when switching rendering views.

Focused tests, valid project/scenario fixtures, architecture documentation, and browser captures cover nighttime and mixed daylight, concealed-strip bounce lighting, matched off controls, sealed/thin-wall occlusion, source sidedness/order, and daylight regressions. The default Interactive renderer and retained VXGI integration remain available.

### Verification

Implementation results below are reported in the accepted [path-tracing architecture and browser evidence](../../architecture/daylight-path-tracing.md#luminaire-browser-evidence), committed with the implementation:

| Check | Result |
| --- | --- |
| `pnpm lint` | PASS — reported by the implementation documentation. |
| `pnpm typecheck` | PASS — reported by the implementation documentation. |
| `pnpm test` | PASS — 2,455 tests, including 258 in renderer-three, reported by the implementation documentation. |
| `pnpm build` | PASS — the existing Vite large-chunk advisory remains. |
| Real-browser visual and lifecycle review | PASS — reported captures cover the required lighting/control cases; concealed-strip capture reached 1,074 samples, and sealed-side controls showed no visible leakage at the reviewed viewpoints. No shader/runtime warnings or errors were reported. |

[Review metadata](../../architecture/path-traced-luminaires-evaluation/metadata.json) records 26 tracing captures and their reproduction settings. Mocked GPU boundary tests separately cover capacity/upload failure, atomic replacement, cleanup, and recovery; no real capability/upload failure occurred during browser review.

No dependency manifests or lockfile changed, so dependency-change checks were not applicable. Implementation commands and browser cases were not rerun during this task-record-only finalization; the results above are attributed to the committed implementation documentation.

### Deviations from Description

None.

### Agent-Reported Follow-up Items

None.

## Human Review

### Review Status

Accepted

### Review Notes

On 2026-10-12, the human maintainer confirmed that Codex successfully implemented TASK-045, identified the accepted implementation commit, and requested that the task be marked Completed.

The bounded experiment retains Monte Carlo noise, eight diffuse interactions, hard-edged spot cones, idealized sources, approximate Kelvin RGB, and a qualitative flux/sky scale. The recorded controls support the reviewed viewpoints; they do not establish calibrated photometry or correctness for every apartment and geometry scale.

### Human Changes After Agent Execution

None.

## Finalization

### Implementation Commits

- `5aeea058a535084857d1cd62e81eb522327aef0a`

### Commit Messages

```text
feat(renderer-three): trace design luminaires

Add flux-normalized direct and diffuse lighting for all four types.
Verify occlusion, lifecycle, and concealed lighting with browser evidence.

Task: TASK-045
```

### Supersession

—

## Notes

Intended repository directory:

```text
docs/tasks/TASK-045-path-traced-design-luminaires/
```

The task was issued to Codex on 2026-10-11 and completed on 2026-10-12 after human acceptance of the implementation commit. The issued task description remains unchanged and immutable.

The accepted scope retains the current Physical Sunny, matte-finish, and thin-clear-pane subset. Luminaire editing, fixture models, broader material support, and performance benchmarking remain outside this task.
