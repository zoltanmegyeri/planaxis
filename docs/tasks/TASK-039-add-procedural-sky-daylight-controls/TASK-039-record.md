# TASK-039: Add Procedural Sky and Daylight Simulation Controls

## Task Metadata

- **Status:** In Progress
- **Created:** 2026-09-29
- **Issued:** 2026-09-29
- **Completed:** —
- **Agent:** Codex
- **Repository:** PlanAxis
- **Description:** `TASK-039-description.md`
- **Related tasks:** TASK-038
- **Related ADRs:** ADR-002, ADR-003
- **Related specifications:** Apartment SVG 2.2
- **Implementation commits:** —

## Purpose

Continue Phase 4 from TASK-038's physical-Sun foundation by making Physical lighting useful for daylight exploration.

This task adds a procedural exterior sky, transient date/time and Sunny/Overcast controls, believable day/twilight/night transitions, elevation- and weather-dependent Sun color, and softened overcast shadows without introducing persistent simulation data or pretending that realtime global illumination already exists.

## Description

The authoritative task description is stored in:

`TASK-039-description.md`

The task was formally issued on 2026-09-29 and remains immutable throughout execution.

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

TASK-038 established Studio/Physical lighting, deterministic solar position, direct Sun, and correct architectural occlusion.

TASK-039 deliberately keeps daylight simulation visually believable rather than astronomically or meteorologically exhaustive. The only weather states are Sunny and Overcast. Procedural sky is visible exterior scenery, not a substitute for later global illumination.

Simulation settings remain transient. Sunny is the default weather condition, and switching from Physical to Studio and back must restore the previous Physical date, time, and weather state.
