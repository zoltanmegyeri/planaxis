# TASK-038: Establish the Physical Daylight Foundation

## Task Metadata

- **Status:** Completed
- **Created:** 2026-09-29
- **Issued:** 2026-09-29
- **Completed:** 2026-09-29
- **Agent:** Codex
- **Repository:** PlanAxis
- **Description:** `TASK-038-description.md`
- **Related tasks:** TASK-033, TASK-035
- **Related ADRs:** ADR-002, ADR-003
- **Related specifications:** Apartment SVG 2.2
- **Implementation commits:** b44e9008169d86ba036dabac91cc478c7dd96a89

## Purpose

Begin the new Phase 4 lighting work by replacing the renderer's single undifferentiated lighting setup with explicit Studio and Physical modes, while preserving the existing Studio presentation.

This task establishes the renderer-independent solar-simulation boundary, upgrades Three.js to the latest stable compatible release, introduces a geographically oriented physical Sun, and fixes direct-light occlusion so hidden architectural geometry such as the ceiling can still block sunlight.

## Description

The authoritative task description is stored in:

`TASK-038-description.md`

The task was formally issued on 2026-09-29 and remained immutable throughout execution.

## Execution Record

### Result

Codex implemented the physical daylight foundation.

The implementation:

- added the renderer-independent `@planaxis/simulation` package with deterministic solar-position calculation;
- added explicit Studio and Physical lighting modes, with Studio remaining the default;
- made Physical mode depend on Apartment SVG geographic location/orientation data;
- integrated a calculated physical Sun into the Three.js renderer;
- separated ceiling inspection visibility from shadow/light occlusion so the ceiling can remain visually suitable for above-Inspection viewing while still blocking direct Sun;
- upgraded the Three.js dependency and adapted renderer behavior to the selected compatible release;
- added focused simulation, renderer lifecycle/scene, and browser workflow coverage;
- updated README, AGENTS, architecture documentation, and ADR-003 for the new lighting foundation.

### Verification

The implementation was reported as successful and accepted by the human maintainer.

Exact command-by-command verification results were not separately provided during task-record finalization and are therefore not recorded as PASS here.

### Deviations from Description

None.

### Agent-Reported Follow-up Items

None.

## Human Review

### Review Status

Accepted

### Review Notes

The TASK-038 implementation was accepted as successful.

The committed changes establish the intended physical daylight foundation while preserving Studio as the default lighting workflow and keeping later Phase 4 features outside this task.

### Human Changes After Agent Execution

None.

## Finalization

### Implementation Commits

```text
b44e9008169d86ba036dabac91cc478c7dd96a89
```

### Commit Messages

```text
feat(lighting): establish physical daylight foundation

Add solar simulation, Studio/Physical modes, and ceiling occlusion.
Upgrade Three.js and cover lighting, lifecycle, and browser behavior.

Task: TASK-038
```

### Supersession

—

## Notes

TASK-038 is the first implementation task of the new Phase 4 after swapping the previously planned lighting and 3D-asset phases.

It establishes the renderer and solar-simulation foundation for subsequent daylight work. Procedural sky, weather, explicit date/time controls, persistent luminaires, global illumination, bloom, IES photometry, and path tracing remain later work.
