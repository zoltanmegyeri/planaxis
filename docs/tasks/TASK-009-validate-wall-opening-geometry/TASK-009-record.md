# TASK-009: Validate Apartment SVG Wall and Opening Geometry

## Task Metadata

- **Status:** Completed
- **Created:** 2026-09-03
- **Issued:** 2026-09-03
- **Completed:** 2026-09-03
- **Agent:** Codex
- **Repository:** PlanAxis
- **Description:** `TASK-009-description.md`
- **Related tasks:** TASK-003, TASK-008
- **Related ADRs:** ADR-001
- **Related specifications:** Apartment SVG 2.1
- **Implementation commits:** 3e7dec46da5a1e754091dafd34837bb57030a2f3

## Purpose

Advance the Apartment SVG validation pipeline from reference-valid data into its first geometric validation slice.

TASK-008 established `ReferenceValidApartmentSvgDocument`. This task validates wall geometry, opening-to-wall relationships, and hinged-door geometry using the exact-decimal geometry foundation established by TASK-003.

## Description

The authoritative task description is stored in:

`TASK-009-description.md`

The task was formally issued on 2026-09-03 and remained immutable throughout execution.

## Execution Record

### Result

Codex implemented the wall and opening geometric-validation stage in `@planaxis/validator`.

The implementation:

- validates wall-axis geometry and effective wall heights;
- validates window and door relationships to their resolved supporting walls;
- validates window and door vertical opening extents;
- validates hinged-door hinge and open-leaf geometry;
- returns structured Apartment SVG geometry errors;
- uses exact-decimal geometry and normative tolerance behavior;
- preserves `ReferenceValidApartmentSvgDocument` as the successful stage output rather than introducing another partially trusted document type;
- keeps topology, placement, collision, and overlap validation deferred;
- adds focused automated coverage for the implemented rules and stage boundaries.

### Verification

No verification failures were reported for the completed implementation.

Command-by-command verification results were not separately provided during task-record finalization.

### Deviations from Description

None.

### Agent-Reported Follow-up Items

None.

## Human Review

### Review Status

Accepted

### Review Notes

The TASK-009 implementation was reviewed and accepted without objections.

No implementation issues, deviations, or additional follow-up items were identified during human review.

### Human Changes After Agent Execution

None.

## Finalization

### Implementation Commits

```text
3e7dec46da5a1e754091dafd34837bb57030a2f3
```

### Commit Messages

```text
feat(validator): validate wall and opening geometry

Add the reference-valid geometry stage for wall axes, effective wall
heights, window and door footprints, and hinged-door invariants.

Return structured APSVG geometry errors and cover exact-decimal
tolerance boundaries and deferred validation-stage behavior.

Task: TASK-009
```

### Supersession

—

## Notes

TASK-009 completed the first geometric-validation slice after reference validation.

The remaining geometric/topological phase covers topology, placement, collision, overlap, and other deferred spatial rules before construction of `ValidatedApartment2D`.