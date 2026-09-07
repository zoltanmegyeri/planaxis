# TASK-016: Implement ArchitecturalModel3D

## Task Metadata

- **Status:** Completed
- **Created:** 2026-09-07
- **Issued:** 2026-09-07
- **Completed:** 2026-09-07
- **Agent:** Codex
- **Repository:** PlanAxis
- **Description:** `TASK-016-description.md`
- **Related tasks:** TASK-014, TASK-015
- **Related ADRs:** ADR-001
- **Related specifications:** Apartment SVG 2.2
- **Implementation commits:** 7ce4fb068d51a8dac72ec35c2421f33c32e562ba

## Purpose

Implement the renderer-independent `ArchitecturalModel3D` and its deterministic transformation from trusted `ValidatedApartment2D`.

The task converts validated level-local architectural data into exact model-space floor, ceiling, wall, opening, fixed-element, utility, and camera geometry while preserving semantic relationships and leaving renderer-specific mesh construction for the next stage.

## Description

The authoritative task description is stored in:

`TASK-016-description.md`

The task was formally issued on 2026-09-07 and is now in progress.

## Execution Record

### Result

Codex completed the renderer-independent `ArchitecturalModel3D` implementation.

The implementation:

- defined public architectural 3D domain contracts in `@planaxis/model-3d`;
- added deterministic `buildArchitecturalModel3D(ValidatedApartment2D)` construction;
- derived exact floor and default ceiling surfaces, wall envelopes, window and door opening prisms, and fixed-element volumes;
- converted level-local architectural Z values into exact model-space Z coordinates by applying `metadata.level.baseZ` exactly once;
- preserved utility and camera positions, camera orientation/FOV values, source semantics, and resolved relationships;
- added a consistent source-semantic ID index whose values are the same constructed 3D instances exposed through typed collections;
- added focused tests for geometry, level offsets, exact decimal precision, semantics, and relationship identity;
- updated package wiring and documentation to identify renderer adaptation as the next stage.

### Verification

The implementation was completed successfully.

Command-by-command agent verification results were not separately provided during task-record finalization.

### Deviations from Description

None.

### Agent-Reported Follow-up Items

None.

## Human Review

### Review Status

Accepted

### Review Notes

The TASK-016 implementation was accepted as successfully completed.

No additional human-review findings, deviations, or follow-up items were provided during task-record finalization.

### Human Changes After Agent Execution

None.

## Finalization

### Implementation Commits

```text
7ce4fb068d51a8dac72ec35c2421f33c32e562ba
```

### Commit Messages

```text
feat(model-3d): build exact architectural models from validated apartments

Define renderer-independent architectural contracts and a deterministic
builder using shared exact-decimal 3D geometry primitives.

Derive floor and ceiling surfaces, wall envelopes, opening prisms,
fixed-element volumes, and utility and camera positions. Preserve source
semantics, exact camera angles, and relationships between constructed
objects through a consistent source-semantic ID index.

Add focused tests for level offsets, decimal precision, geometry,
semantics, and relationship identity. Update package wiring and
documentation to identify renderer adaptation as the next stage.

Task: TASK-016
```

### Supersession

—

## Notes

This task is the renderer-independent architectural 3D-model milestone following the exact 3D geometry foundations established by TASK-015.
