# TASK-004: Parse Apartment SVG Documents

## Task Metadata

- **Status:** In Progress
- **Created:** 2026-08-31
- **Issued:** 2026-09-01
- **Completed:** —
- **Agent:** Codex
- **Repository:** PlanAxis
- **Description:** `TASK-004-description.md`
- **Related tasks:** TASK-003
- **Related ADRs:** ADR-001
- **Related specifications:** Apartment SVG 2.1
- **Implementation commits:** —

## Purpose

Implement the Apartment SVG parsing stage that follows the completed numeric and geometric foundations.

This task establishes the boundary that converts untrusted SVG/XML source text into a project-owned parsed representation suitable for later schema validation while preserving the distinction between XML parsing and Apartment SVG conformance checking.

## Description

The authoritative task description is stored in:

`TASK-004-description.md`

The description was formally issued on 2026-09-01 and is now immutable.

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

TASK-004 begins the Apartment SVG parsing phase after the authoritative decimal geometry foundation.

The task intentionally does not perform Apartment SVG schema validation, numeric lexical validation, reference resolution, geometric validation, or construction of trusted domain models. Parsed numeric-looking values remain lexical strings until a later validation stage establishes that they conform to the Apartment SVG numeric grammar.
