# TASK-024: Migrate Browser to Active Project

## Task Metadata

- **Status:** Ready
- **Created:** 2026-09-12
- **Issued:** —
- **Completed:** —
- **Agent:** —
- **Repository:** PlanAxis
- **Description:** `TASK-024-description.md`
- **Related tasks:** TASK-017, TASK-022, TASK-023
- **Related ADRs:** ADR-002, ADR-003, ADR-004
- **Related specifications:** PlanAxis Project Format 1.0, Apartment SVG 2.2
- **Implementation commits:** —

## Purpose

Complete Phase 0 by migrating the React application from browser-local SVG file ownership to the single active project already loaded and exposed by the PlanAxis server.

The existing deterministic Apartment SVG validation and 2D/3D viewing workflow should remain browser-side; only the source of the document and the surrounding project-aware application state change.

## Description

The authoritative task description is stored in:

`TASK-024-description.md`

The task is ready for formal delegation.

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

TASK-024 is the third and final implementation task of Phase 0.

TASK-022 established safe project loading and filesystem access, and TASK-023 established one-project-per-server startup plus controlled project APIs. This task migrates the browser to those APIs while preserving the existing Apartment SVG processing and viewer pipeline.
