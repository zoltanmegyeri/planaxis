# PlanAxis

**Structured apartment modeling, deterministic validation, interactive 3D visualization, and AI-assisted redesign.**

**PlanAxis** is a TypeScript-based toolkit and web application for validating, interpreting, visualizing, and eventually redesigning apartments described by a structured SVG floor-plan format.

The project is built around the versioned, normative [Apartment SVG 2.1 specification](docs/specifications/apartment-svg/2.1.md), where an SVG document is not merely a drawing: it is the canonical, machine-readable representation of an apartment's geometry and semantics.

> [!NOTE]
> The executable TypeScript monorepo foundation, exact-decimal geometry primitives, Apartment SVG parser, and complete document/semantic schema validator are in place. Schema validation now produces a typed intermediate representation with unresolved references. Reference, geometric, and topological validation will be added incrementally before a trusted apartment domain model is produced.

## Project Goals

The long-term workflow is:

```text
Apartment SVG
    ↓
validation
    ↓
validated 2D domain model
    ↓
renderer-independent 3D architectural model
    ↓
interactive Three.js visualization
    ↓
design exploration and redesign
    ↓
updated floor plan and interior design
    ↓
technical and AI-assisted photorealistic renders
```

The initial implementation focuses on establishing a deterministic and testable foundation for:

- parsing Apartment SVG documents;
- validating schema, references, geometry, and topology;
- producing a strongly typed in-memory 2D domain model;
- deriving a renderer-independent 3D architectural model;
- rendering and exploring the apartment interactively in the browser;
- simulating runtime conditions such as date, time, sunlight, and artificial lighting.

AI-assisted redesign and photorealistic rendering are later stages built on top of this deterministic geometry pipeline.

## Core Principles

### The SVG is the source of truth

The Apartment SVG document is the canonical external model.

Geometry must not be inferred from CSS, visual appearance, annotations, natural-language labels, or other non-normative information. Missing required information must result in validation errors rather than guesses.

### Validation precedes 3D generation

A 3D model may only be created from a fully validated Apartment SVG document.

The intended processing pipeline is:

```text
SVG
  → parse
  → schema validation
  → reference validation
  → geometric validation
  → ValidatedApartment2D
  → ArchitecturalModel3D
  → renderer adapter
```

`ValidatedApartment2D` is an in-memory domain representation of the validated SVG. It is not a second source of truth and is not a separate persistence format.

### Authoritative geometry uses exact decimal arithmetic

Apartment geometry is expressed in centimeters and must not rely on JavaScript binary floating-point arithmetic for authoritative calculations.

Exact decimal arithmetic is used throughout the domain and validation layers. Conversion to native JavaScript `number` values is allowed only at explicitly defined boundaries where required by external systems such as Three.js.

### Rendering is separate from domain logic

The architectural model must remain independent of Three.js or any other renderer.

Renderer-specific objects such as `THREE.Scene`, `THREE.Mesh`, materials, lights, and cameras belong exclusively to renderer adapter layers.

## Planned Technology Stack

The project is intended to use:

- **TypeScript** for all application code;
- **Node.js** for server-side execution;
- **pnpm workspaces** for the monorepo;
- **Fastify** for the backend HTTP layer;
- **Vite** for the browser application;
- **Three.js** for interactive 3D rendering;
- **decimal.js** for authoritative decimal arithmetic;
- **Vitest** for automated testing.

The exact dependency set may evolve through documented architectural decisions.

## Repository Structure

PlanAxis is a pnpm workspace monorepo organized around the following areas:

```text
.
├── .github/
│   ├── workflows/
│   └── ISSUE_TEMPLATE/
│
├── apps/
│   ├── server/
│   └── web/
│
├── packages/
│   ├── model/
│   ├── geometry/
│   ├── parser/
│   ├── validator/
│   └── model-3d/
│
├── examples/
│
├── fixtures/
│   ├── valid/
│   └── invalid/
│
├── docs/
│   ├── specifications/
│   │   └── apartment-svg/
│   ├── architecture/
│   ├── development/
│   ├── decisions/
│   └── tasks/
│
├── AGENTS.md
├── CONTRIBUTING.md
├── LICENSE
├── README.md
├── .editorconfig
├── .gitattributes
└── .gitignore
```

The exact package structure may be refined during implementation. Architectural boundaries are more important than preserving a particular directory layout.

`fixtures/` is intended for automated verification and may contain intentionally invalid or synthetic Apartment SVG documents. `examples/` is intended for valid, user-facing samples suitable for learning and demonstration.

## Documentation

Project documentation lives under [`docs/`](docs/).

### Specifications

[`docs/specifications/`](docs/specifications/) contains normative domain specifications.

The current normative format definition is the [Apartment SVG 2.1 specification](docs/specifications/apartment-svg/2.1.md). It defines the external file format, validation rules, geometric invariants, reference semantics, and canonical interpretation rules.

### Architecture

[`docs/architecture/`](docs/architecture/) describes the current software architecture and the responsibilities and boundaries of the major components.

The primary entry point is:

```text
docs/architecture/overview.md
```

### Development

[`docs/development/`](docs/development/) contains implementation and contribution guidance, including:

```text
docs/development/coding-guidelines.md
docs/development/testing.md
docs/development/agent-task-workflow.md
```

### Architectural Decision Records

[`docs/decisions/`](docs/decisions/) contains Architectural Decision Records (ADRs).

ADRs document significant technical decisions, their context, considered alternatives, and consequences. They preserve the reasoning behind the architecture without turning the current architecture documentation into a historical log.

### Formal Agent Tasks

[`docs/tasks/`](docs/tasks/) contains the repository artifacts used for formally delegated coding-agent tasks.

A formal task consists of a task record and an authoritative task description. Shared task-process documents define the record format and provide task-description guidance.

The human-facing workflow for creating, executing, reviewing, and finalizing delegated tasks is documented in:

```text
docs/development/agent-task-workflow.md
```

## Repository Language

**English is the mandatory language of the repository.**

This applies to:

- documentation;
- source code;
- identifiers;
- type, class, function, method, and variable names;
- comments;
- commit-facing technical terminology;
- validation messages intended for developers;
- tests and fixture descriptions.

Natural-language discussion outside the repository may use any language, but repository artifacts must remain in English unless a future requirement explicitly defines a localized user-facing resource.

## Development Status

The initial implementation is being developed incrementally. Apartment SVG parsing and complete document/semantic schema validation are implemented. Reference, geometric, and topological validation remain ahead of the trusted 2D model, 3D generation, rendering, and AI-assisted features.

Each implementation phase should have explicit acceptance criteria and automated tests.

## Development Workflow

PlanAxis distinguishes between two development modes:

```text
Mode A — Human-Owned Development
Mode B — Agent-Delegated Task Execution
```

In **Mode A**, a human developer owns the implementation. AI may be used for assistance, review, explanations, code suggestions, debugging, or similar support without requiring formal task artifacts.

In **Mode B**, a complete unit of implementation work is formally delegated to a coding agent. The task is defined and tracked in committed artifacts under `docs/tasks/`, execution begins only from a clean human-prepared repository state, the resulting changes receive human review, and Git history remains human-controlled.

The complete Mode B process is defined in:

```text
docs/development/agent-task-workflow.md
```

Formal task record structure is defined in:

```text
docs/tasks/TASK-RECORD-SPECIFICATION.md
```

Task descriptions should be prepared using:

```text
docs/tasks/TASK-DESCRIPTION-TEMPLATE.md
```

The project exposes these standard workspace commands:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

These commands must remain reliable because they are part of both human development and formal coding-agent verification.

Detailed development rules belong under `docs/development/` rather than in this README.

## Coding Agents

Coding agents working directly in this repository must read and follow [`AGENTS.md`](AGENTS.md).

`AGENTS.md` defines repository-level agent behavior, including architectural constraints, mandatory Git preflight, Git write restrictions, verification expectations, and the access rules for formal task artifacts.

For a formal Mode B task, the coding agent receives one authoritative `TASK-NNN-description.md` under `docs/tasks/`. The short invocation prompt points to that committed description rather than redefining the task in chat.

Task records, task lifecycle changes, Git operations, implementation acceptance, and task finalization remain human responsibilities.

## License

PlanAxis is licensed under the **Apache License 2.0**.

See [`LICENSE`](LICENSE) for the full license text.
