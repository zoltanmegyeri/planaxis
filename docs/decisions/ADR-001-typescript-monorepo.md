# ADR-001: Adopt a TypeScript Monorepo with Shared Core Packages

- **Status:** Accepted
- **Date:** 2026-08-28

## Context

PlanAxis is intended to become a web-based toolkit and application for validating, interpreting, modeling, visualizing, and later redesigning apartments represented by the Apartment SVG format.

The system requires both browser-side and server-side capabilities.

The browser application is expected to handle interactive functionality such as:

- Apartment SVG loading;
- validation-result presentation;
- interactive Three.js visualization;
- predefined and free-moving cameras;
- runtime date and time changes;
- sunlight simulation;
- artificial light switching and dimming;
- later design exploration workflows.

The server application is expected to handle capabilities such as:

- serving the web application;
- HTTP APIs;
- project persistence;
- file storage;
- versioning;
- future authentication and collaboration;
- AI service integration;
- optional server-side or headless processing.

A major early architectural decision was therefore the choice of implementation language and project structure.

Two primary alternatives were considered.

### Alternative A: Java backend with JavaScript/TypeScript frontend

The server would use:

```text
Java 21
Spring Boot 3
Maven
```

while the browser application would use JavaScript or TypeScript with Three.js.

Advantages considered:

- mature Java XML tooling;
- built-in `BigDecimal`;
- strong static typing;
- mature server-side frameworks;
- access to advanced Java geometry libraries such as JTS;
- well-established enterprise development practices.

Disadvantages considered:

- two application languages;
- duplicated or translated domain contracts between Java and TypeScript;
- separate build ecosystems;
- separate frontend and backend domain implementations where logic cannot be shared directly;
- more integration overhead between browser and server models.

### Alternative B: JavaScript across backend and frontend

The entire application would use JavaScript and Node.js.

Advantages considered:

- one language across the application;
- simple toolchain;
- direct compatibility with Three.js;
- potential reuse of logic between server and browser.

Disadvantages considered:

- weaker static guarantees than desired for a specification-heavy domain model;
- JavaScript `number` is unsuitable for authoritative decimal geometry;
- risk of loosely typed data structures in a complex validation pipeline.

### Refined Alternative B+: TypeScript across backend and frontend

A refined version of Alternative B addresses the main weaknesses of plain JavaScript:

```text
TypeScript
Node.js
pnpm workspaces
Vite
Fastify
Three.js
decimal.js
```

This approach allows the deterministic core of PlanAxis to be implemented once and reused where practical by both browser and server applications.

The Apartment SVG specification defines a strongly structured domain with explicit element types, references, lexical constraints, geometric invariants, and validation stages. This makes strong static typing especially valuable.

The project also requires exact decimal arithmetic for authoritative geometry. This requirement can be addressed independently of the implementation language by using a dedicated decimal representation.

## Decision

PlanAxis will use **TypeScript as the primary implementation language for both browser-side and server-side application code**.

The repository will be organized as a **pnpm workspace monorepo**.

The initial technology direction is:

```text
Language:
    TypeScript

Server runtime:
    Node.js 24 LTS

Package manager / monorepo:
    pnpm workspaces

Backend HTTP framework:
    Fastify

Browser build tooling:
    Vite

Interactive 3D renderer:
    Three.js

Authoritative decimal arithmetic:
    decimal.js

Automated testing:
    Vitest
```

The architecture will favor shared TypeScript packages for deterministic logic that is meaningful in both environments.

Expected shared responsibilities include:

- domain types;
- identifiers and enums;
- exact numeric and geometry primitives;
- Apartment SVG parsing;
- validation;
- reference resolution;
- renderer-independent 2D and 3D models;
- deterministic model transformations.

Environment-specific concerns will remain outside shared core packages.

Examples include:

```text
browser-specific UI
Three.js rendering
Node.js filesystem access
HTTP routing
persistence
external AI integrations
```

The initial repository is expected to contain areas similar to:

```text
apps/
    server/
    web/

packages/
    model/
    geometry/
    parser/
    validator/
    model-3d/
```

The exact package structure may evolve as implementation pressure reveals better boundaries.

The architectural principle is more important than preserving these exact directory names:

> deterministic domain logic should be implemented once and reused across runtime environments where practical.

## Rationale

### Shared domain implementation

The strongest reason for this decision is the ability to share the same deterministic implementation between server and browser environments.

For example, the same validation package may support both:

```text
browser:
    load SVG
    -> validate locally
    -> display errors
    -> build model
```

and:

```text
server:
    receive SVG
    -> validate
    -> persist or process
```

This avoids maintaining parallel implementations of Apartment SVG semantics.

A two-language Java/TypeScript architecture would require additional mapping between domain models and would increase the risk that backend and frontend interpretations diverge.

### Strong typing

TypeScript provides significantly stronger static guarantees than plain JavaScript while preserving the ecosystem and runtime compatibility needed for browser and Node.js development.

This is particularly important because Apartment SVG defines:

- explicit semantic element kinds;
- conditional attributes;
- reference types;
- multiple validation stages;
- geometric domain objects;
- discriminated variants;
- structured validation errors.

These concepts map naturally to TypeScript types and discriminated unions.

### Three.js integration

Three.js is a central part of the planned interactive visualization layer.

Using TypeScript throughout the project reduces friction between renderer-independent domain code and the browser renderer while still keeping the renderer behind an architectural boundary.

### Toolchain simplicity

A TypeScript monorepo provides one primary development ecosystem for:

```text
dependency management
build tooling
linting
type checking
testing
package linking
frontend development
backend development
```

This is simpler than maintaining both Maven/JDK and Node.js frontend toolchains for the initial implementation.

### Exact geometry can remain independent of native numeric representation

Java's `BigDecimal` is a strong advantage for exact decimal arithmetic, but it does not require the project to choose Java.

PlanAxis can use an explicit decimal abstraction in TypeScript for authoritative geometry.

The details of that numeric policy are architectural enough to be documented separately and should not be coupled permanently to this ADR.

### Current problem scope does not require a JVM-specific geometry stack

The current Apartment SVG core model is intentionally constrained and does not yet require a full CAD or GIS geometry engine.

If future requirements introduce complex topology, curved geometry, CAD interoperability, heavy server-side computation, or other workloads better served by specialized technology, those requirements can be evaluated independently.

The current architecture must not introduce that complexity preemptively.

## Consequences

### Positive consequences

- One primary implementation language is used across the application.
- Core domain logic can be shared between browser and server.
- Apartment SVG semantics need only one primary implementation.
- Domain contracts can be represented directly as shared TypeScript types.
- Frontend and backend integration requires less translation between language ecosystems.
- Three.js integration is natural.
- Repository tooling can be standardized around pnpm and TypeScript.
- Contributors and coding agents work within a consistent project environment.
- Core packages can remain runtime-independent where appropriate.

### Negative consequences

- TypeScript still requires a build/transpilation toolchain; this is not a compiler-free architecture.
- Exact decimal arithmetic is not provided by the JavaScript language and requires a dedicated library or project abstraction.
- The Node.js ecosystem is less naturally suited than Java to some future heavy geometry, CAD, or enterprise workloads.
- Care must be taken to keep browser-specific and Node.js-specific APIs out of shared core packages.
- Sharing code between environments can create undesirable coupling if package boundaries are not maintained carefully.

### Neutral consequences

- Server-side and browser-side deployment remain separate concerns even though they share a language.
- The architecture does not require every package to run in both environments; sharing is used only where appropriate.
- A later specialized service written in another language is not prohibited if a concrete requirement justifies it.

## Rejected Alternatives

### Java 21 + Spring Boot 3 backend with TypeScript frontend

Rejected for the initial architecture because the benefits of Java do not currently outweigh the additional language boundary, duplicated domain contracts, and multi-toolchain complexity.

This decision does not imply that Java is technically unsuitable for the problem.

The alternative may be reconsidered for a future specialized service if requirements justify it.

### Plain JavaScript for both server and browser

Rejected because PlanAxis has a specification-heavy domain where strong static typing materially improves correctness, maintainability, and refactoring safety.

TypeScript provides the desired single-language architecture without accepting the weaker type guarantees of plain JavaScript.

### Separate repositories for frontend, backend, and core libraries

Rejected for the initial implementation.

The components are expected to evolve together, share types and deterministic domain logic, and require coordinated changes.

A monorepo provides simpler atomic changes, local package linking, shared tooling, and unified CI during this phase of the project.

Repository separation may be reconsidered later if independent lifecycle, ownership, deployment, or distribution requirements emerge.

## Constraints Introduced by This Decision

Unless superseded by a later accepted ADR:

1. application source code should be written in TypeScript;
2. shared deterministic logic should live in reusable packages rather than being duplicated in applications;
3. core packages must avoid unnecessary browser-only or Node.js-only dependencies;
4. frontend and backend must not define incompatible parallel apartment domain models;
5. new language runtimes or major frameworks require a concrete architectural justification;
6. package boundaries must preserve the separation defined in `docs/architecture/overview.md`.

## Follow-up Decisions

This ADR intentionally does not combine every foundational decision into one record.

Related decisions should be documented separately, including:

```text
exact decimal arithmetic for authoritative geometry
Apartment SVG as the canonical external model
renderer-independent ArchitecturalModel3D
Three.js renderer boundary
```

Keeping these decisions separate allows each one to evolve independently and makes their rationale easier to review.

## References

```text
AGENTS.md
docs/architecture/overview.md
docs/development/coding-guidelines.md
docs/development/testing.md
docs/specifications/apartment-svg/2.1.md
```
