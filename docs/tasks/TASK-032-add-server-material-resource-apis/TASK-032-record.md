# TASK-032: Add Server Material Resource APIs

## Task Metadata

- **Status:** Completed
- **Created:** 2026-09-23
- **Issued:** 2026-09-23
- **Completed:** 2026-09-23
- **Agent:** Codex
- **Repository:** PlanAxis
- **Description:** `TASK-032-description.md`
- **Related tasks:** TASK-031
- **Related ADRs:** ADR-004
- **Related specifications:** PlanAxis Material Format 1.0, PlanAxis Project Format 1.0, PlanAxis Design Format 1.0
- **Implementation commits:** 0351a8d8e992218054d08b6b174e69d596c840bc

## Purpose

Add the controlled read-only server resource boundary required for Phase 3 material loading.

TASK-031 established the pure Material Format 1.0 contract. This task makes explicitly referenced material descriptors and supported texture files safely readable from the selected project while keeping parsing, decoding, browser orchestration, and rendering separate.

## Description

The authoritative task description is stored in:

`TASK-032-description.md`

The task was formally issued on 2026-09-23 and remained immutable throughout execution.

## Execution Record

### Result

Codex implemented the TASK-032 server material-resource boundary.

The implementation includes:

- controlled `GET /api/project/material?path=...` reads for lowercase `.json` files below `assets/materials/`;
- controlled `GET /api/project/material-texture?path=...` reads for lowercase `.png`, `.jpg`, `.jpeg`, and `.webp` files below `assets/materials/`;
- resource-selector validation that keeps material access separate from generic project-file serving;
- raw unchanged byte responses with octet-stream and `nosniff` headers;
- continued enforcement of project-root containment, regular-file checks, symbolic-link protections, and safe project-error responses through the existing filesystem boundary;
- focused server tests covering valid reads, invalid paths/extensions, missing/non-regular resources, symbolic links, repeated boundary checks, query validation, error handling, and absence of material write/discovery APIs;
- README and architecture documentation updates reflecting the implemented server boundary.

Material JSON parsing, texture decoding, browser material resolution, runtime PBR adaptation, and renderer integration remain outside this task.

### Verification

The implementation was reported as successful and accepted by the human maintainer.

Exact command-by-command verification results were not provided in this conversation and are therefore not recorded as PASS here.

### Deviations from Description

None.

### Agent-Reported Follow-up Items

None.

## Human Review

### Review Status

Accepted

### Review Notes

The TASK-032 implementation was accepted as successful. The committed changes match the intended read-only server material-resource scope and preserve the existing project-filesystem security boundary.

### Human Changes After Agent Execution

None.

## Finalization

### Implementation Commits

```text
0351a8d8e992218054d08b6b174e69d596c840bc
```

### Commit Messages

```text
feat(server): add controlled material resource APIs

Serve raw material descriptors and supported textures through the
project filesystem boundary. Add validation, tests, and API docs.

Task: TASK-032
```

### Supersession

—

## Notes

TASK-032 completed the second implementation step of Phase 3.

The server now provides controlled raw access to Material 1.0 descriptors and supported texture resources. Browser material resolution, texture decoding, runtime PBR adaptation, and persistent rendering remain for TASK-033.
