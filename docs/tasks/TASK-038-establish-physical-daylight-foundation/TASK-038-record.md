# TASK-038: Establish the Physical Daylight Foundation

## Task Metadata

- **Status:** Ready
- **Created:** 2026-09-29
- **Issued:** —
- **Completed:** —
- **Agent:** —
- **Repository:** PlanAxis
- **Description:** `TASK-038-description.md`
- **Related tasks:** TASK-033, TASK-035
- **Related ADRs:** ADR-002, ADR-003
- **Related specifications:** Apartment SVG 2.2
- **Implementation commits:** —

## Purpose

Begin the new Phase 4 lighting work by replacing the renderer's single undifferentiated lighting setup with explicit Studio and Physical modes, while preserving the existing Studio presentation.

This task establishes the renderer-independent solar-simulation boundary, upgrades Three.js to the latest stable compatible release, introduces a geographically oriented physical Sun, and fixes direct-light occlusion so hidden architectural geometry such as the ceiling can still block sunlight.

## Description

The authoritative task description is stored in:

`TASK-038-description.md`

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

TASK-038 is the first implementation task of the new Phase 4 after swapping the previously planned lighting and 3D-asset phases.

It intentionally establishes only the physical daylight foundation. Procedural sky, weather, date/time controls, persistent luminaires, global illumination, bloom, IES photometry, and path tracing remain later work.
