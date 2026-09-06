# TASK-014: Complete Apartment SVG 2.2 Geometric and Domain Migration

## Task Metadata

- **Status:** Completed
- **Created:** 2026-09-06
- **Issued:** 2026-09-06
- **Completed:** 2026-09-07
- **Agent:** Codex
- **Repository:** PlanAxis
- **Description:** `TASK-014-description.md`
- **Related tasks:** TASK-010, TASK-011, TASK-013
- **Related ADRs:** ADR-001
- **Related specifications:** Apartment SVG 2.2
- **Implementation commits:** 1440acc28cad6cca66483e24cd8e76c8033017d6

## Purpose

Complete the implementation migration to Apartment SVG 2.2 after TASK-013 established structural, schema-valid, and reference-valid support.

This task adds the remaining footprint geometry and containment guarantees, corrects level-local Z validation, and carries the canonical footprint into `ValidatedApartment2D`, restoring a fully trusted 2.2 pipeline before renderer-independent 3D work begins.

## Description

The authoritative task description is stored in:

`TASK-014-description.md`

The task was formally issued on 2026-09-06 and is now in progress.

## Execution Record

### Result

Codex completed the Apartment SVG 2.2 geometric and trusted-domain migration.

The implementation:

- added footprint topology, positive-area, exact-orthogonality, and root `viewBox` validation;
- enforced complete stationary placement containment within concave apartment footprints;
- preserved the hinged-door `open-leaf` exception while retaining root `viewBox` containment;
- corrected camera collision checks to use level-local architectural Z consistently;
- added the canonical `ApartmentFootprint` to `ValidatedApartment2D` and its semantic ID index;
- updated fixtures, geometry/domain/CLI regression coverage, and current-state documentation for the completed Apartment SVG 2.2 pipeline.

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

The TASK-014 implementation was accepted as successfully completed.

No additional human-review findings, deviations, or follow-up items were provided during task-record finalization.

### Human Changes After Agent Execution

None.

## Finalization

### Implementation Commits

```text
1440acc28cad6cca66483e24cd8e76c8033017d6
```

### Commit Messages

```text
feat(validator): complete Apartment SVG 2.2 geometric domain migration

Validate footprint topology, exact orthogonality, viewBox bounds, and
complete stationary placement containment across concave boundaries.
Preserve the hinged-door open-leaf containment exception.

Use level-local Z for camera collisions and expose the canonical
ApartmentFootprint in ValidatedApartment2D and its semantic ID index.

Add geometry, domain, and CLI regression coverage, update fixtures,
and document the completed 2.2 pipeline.

Task: TASK-014
```

### Supersession

—

## Notes

This is the second and final planned implementation task in the staged migration of the existing Apartment SVG pipeline from version 2.1 to version 2.2.
