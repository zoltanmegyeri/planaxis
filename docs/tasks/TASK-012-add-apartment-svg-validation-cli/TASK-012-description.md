# TASK-012: Add Apartment SVG Validation CLI

## Context

TASK-011 completed `ValidatedApartment2D`, and PlanAxis now has the complete reusable Apartment SVG pipeline needed to parse an input document and validate schema, references, geometry, and topology.

Before continuing with the planned 3D-model work, add a small developer-facing command-line application that runs the existing validation pipeline against an Apartment SVG file and reports the result in the console.

## Required Reading

Before making changes, read and follow:

```text
AGENTS.md
docs/architecture/overview.md
docs/development/coding-guidelines.md
docs/development/testing.md
docs/decisions/ADR-001-typescript-monorepo.md
docs/specifications/apartment-svg/2.1.md
```

Do not read any other file under `docs/tasks/`.

## Goal

Add a Node.js command-line application that accepts one Apartment SVG file path, runs the existing parsing and complete validation pipeline, and reports whether the document is valid.

The CLI is an application-layer consumer of the existing shared parser and validator packages. It must not introduce a second validation implementation.

## Scope

Implement:

- a private CLI workspace application under `apps/cli`, using a package name such as `@planaxis/cli`;
- a convenient root-level command:

```text
pnpm validate:svg <path-to-svg>
```

- UTF-8 file loading from the provided path;
- orchestration of the existing public stages in this order:

```text
parseApartmentSvg
    ↓
validateApartmentSvgSchema
    ↓
validateApartmentSvgReferences
    ↓
validateApartmentSvgGeometry
```

- concise console reporting for valid input;
- useful reporting of parse and validation failures;
- non-zero process status for invalid input, usage errors, or file-read failures;
- automated tests covering the CLI behavior;
- documentation of the command and the new application-layer entry point.

## Functional Requirements

### Command input

The command must accept exactly one positional Apartment SVG file path.

Missing or invalid invocation must produce a concise usage/error message and a non-zero process status.

File-read failures must be reported clearly without being misrepresented as Apartment SVG validation errors.

### Validation pipeline

The CLI must reuse the existing public APIs from `@planaxis/parser` and `@planaxis/validator`.

A later validation stage must run only after the preceding stage succeeds. Do not reimplement validation rules, duplicate validator constants, or bypass the typed trust boundaries between stages.

### Valid output

For a fully valid Apartment SVG, print one concise success line, for example:

```text
Apartment SVG is valid.
```

Do not dump the parsed document, geometry-valid representation, or domain model.

### Invalid output

For malformed XML or other parser failures, print the parser error kind and human-readable message, including source location when available.

For validator failures, print every error returned by the failing validation stage. Each displayed validation error must include at least:

- validation code;
- human-readable message.

Include useful structured context such as element ID, attribute, or path when present.

The CLI must not truncate a returned validation-error collection to only the first error.

### Process status

Exit successfully only when the input file is fully valid.

Invalid Apartment SVG input, parser failure, invalid invocation, and file-read failure must produce a non-zero process status.

Exact non-zero values may be chosen by the implementation; tests must verify the success-versus-failure contract.

## Technical and Architectural Constraints

- Keep filesystem access, argument handling, console output, and process-status behavior in the CLI application layer.
- Reuse `@planaxis/parser` and `@planaxis/validator` through their public package APIs.
- Do not add validation behavior to the CLI.
- Do not weaken or change existing parser or validator behavior merely for CLI convenience.
- Do not add a third-party CLI framework; the required argument surface is simple enough for Node.js APIs.
- Preserve the existing TypeScript, ESM, workspace, and strict-typing conventions.
- Keep core parser, validator, geometry, and model packages free of Node.js CLI concerns.
- Do not modify any file under `docs/tasks/`.

## Out of Scope

Do not implement:

- new Apartment SVG validation rules or error codes;
- changes to Apartment SVG 2.1 semantics;
- construction or console serialization of `ValidatedApartment2D`;
- 3D-model construction or rendering;
- interactive prompts or a general-purpose CLI command framework;
- file watching, batch/directory validation, JSON output, or machine-readable report formats;
- server, browser, persistence, or AI functionality.

## Files and Areas Expected to Change

Expected areas include:

```text
apps/cli/
package.json
README.md
docs/architecture/overview.md
```

Other workspace/configuration files may change when required to integrate the new application cleanly.

## Testing Requirements

Add focused automated coverage for at least:

- a valid Apartment SVG producing the one-line success result and successful process status;
- malformed XML producing a parser diagnostic and failure status;
- schema-invalid input reporting the returned validation errors;
- reference-invalid input reporting the returned validation errors;
- geometrically/topologically invalid input reporting the returned validation errors;
- validation output preserving multiple errors returned by a failing stage;
- missing/invalid CLI arguments;
- unreadable or nonexistent input files.

Reuse existing focused fixtures where practical instead of duplicating fixture coverage.

Follow `docs/development/testing.md` and do not weaken existing tests.

## Documentation Requirements

Update `README.md` with the developer-facing validation command and a short usage example.

Update current-state architecture/repository-structure documentation as needed so the CLI application is represented as an application-layer consumer of the shared parser and validator packages.

Do not modify the normative Apartment SVG specification.

## Verification

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Also manually exercise the CLI with at least one valid and one invalid Apartment SVG file and report the observed command results.

## Acceptance Criteria

The task is complete when:

1. `apps/cli` provides a TypeScript command-line application for validating one Apartment SVG file;
2. `pnpm validate:svg <path-to-svg>` invokes the tool from the repository root;
3. the tool runs the existing parse → schema → reference → geometry validation pipeline in order;
4. a valid document produces only a concise success result and a successful process status;
5. parser and validator failures are reported clearly, with all validation errors from the failing stage preserved;
6. invalid input, invocation errors, and file-read failures produce a non-zero process status;
7. no validation semantics are duplicated or moved into the CLI;
8. focused automated tests pass;
9. the standard repository verification commands pass;
10. the CLI is documented in current-state project documentation.

## Final Response

Provide a concise report containing:

1. implementation summary;
2. main files/areas changed;
3. tests added or updated;
4. verification commands and results;
5. manual CLI checks and observed results;
6. deviations from this description, or `None`;
7. follow-up items, or `None`;
8. a suggested Conventional Commits message including:

```text
Task: TASK-012
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.
