# TASK-009: Validate Apartment SVG Wall and Opening Geometry

## Task Metadata

- **Status:** Ready
- **Created:** 2026-09-03
- **Issued:** —
- **Completed:** —
- **Agent:** —
- **Repository:** PlanAxis
- **Description:** `TASK-009-description.md`
- **Related tasks:** TASK-003, TASK-008
- **Related ADRs:** ADR-001
- **Related specifications:** Apartment SVG 2.1
- **Implementation commits:** —

## Purpose

Advance the Apartment SVG validation pipeline from reference-valid data into its first geometric validation slice.

TASK-008 established `ReferenceValidApartmentSvgDocument`. This task validates wall geometry, opening-to-wall relationships, and hinged-door geometry using the exact-decimal geometry foundation established by TASK-003.

## Description

The authoritative task description is stored in:

`TASK-009-description.md`

The task is ready for formal delegation but has not yet been issued.

## Execution Record

### Result

Pending.

### Verification

Pending.

### Deviations from Description

Pending.

### Agent-Reported Follow-up Items

Pending.

## Human Review

### Review Status

Pending

### Review Notes

Pending.

### Human Changes After Agent Execution

Pending.

## Finalization

### Implementation Commits

—

### Commit Messages

—

### Supersession

—

## Notes

TASK-009 intentionally covers only wall and opening geometry.

Zone topology, overlap validation, utility placement, camera collisions, remaining geometric checks, and construction of `ValidatedApartment2D` remain separate future work.