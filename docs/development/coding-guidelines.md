# PlanAxis Coding Guidelines

## 1. Purpose

This document defines implementation-level coding guidelines for **PlanAxis**.

It complements:

```text
AGENTS.md
docs/architecture/overview.md
docs/development/testing.md
docs/decisions/
```

Normative external formats are defined by:

```text
docs/specifications/apartment-svg/2.2.md
docs/specifications/planaxis-project/1.0.md
```

These guidelines describe how PlanAxis code should be written. They do not redefine Apartment SVG semantics, PlanAxis Project Format semantics, or architecture.

When a rule in this document conflicts with an applicable normative specification, the specification governs that format behavior. When a rule conflicts with an accepted Architectural Decision Record, the ADR governs the architectural decision.

---

## 2. General Engineering Principles

PlanAxis code should optimize for:

- correctness;
- deterministic behavior;
- readability;
- strong static typing;
- explicit data flow;
- narrow responsibilities;
- testability;
- maintainability;
- predictable failure modes.

Prefer simple and explicit code over clever abstractions.

Do not introduce infrastructure, patterns, or dependencies solely because they may become useful later.

A small amount of duplication is preferable to a premature abstraction whose correct boundary is not yet understood.

Refactor when a concrete pattern has emerged.

---

## 3. Repository Language

English is mandatory for repository artifacts.

Use English for:

- file and directory names;
- identifiers;
- type and interface names;
- classes;
- functions and methods;
- properties and variables;
- comments;
- documentation;
- test names;
- fixture descriptions;
- validation messages;
- developer-facing error messages.

Localized user-facing resources may use other languages when localization is explicitly part of the task.

---

## 4. TypeScript

### 4.1. TypeScript is the default language

Application and library code should be written in TypeScript.

Do not add plain JavaScript source files when TypeScript is practical.

Configuration files may use JavaScript or another supported format when required by the relevant tool.

### 4.2. Strict compiler settings

The project should use strict TypeScript compiler settings.

The shared TypeScript configuration is expected to enable at least the equivalent of:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

Additional strictness options may be enabled when they improve correctness without creating unreasonable friction.

Do not weaken compiler settings to make an implementation compile.

Fix the types or redesign the relevant API instead.

### 4.3. Avoid `any`

Do not use `any` as an escape hatch.

Prefer:

- explicit domain types;
- generics;
- discriminated unions;
- `unknown` at untrusted boundaries;
- narrowing functions;
- parser or validator functions.

`any` is acceptable only when a third-party API makes it unavoidable and the usage is narrowly isolated and documented.

### 4.4. Use `unknown` for untrusted data

External data is not trusted merely because it has been parsed syntactically.

Use `unknown` or suitably raw parsing structures for data whose semantic shape has not yet been validated.

Examples include:

- parsed metadata JSON before schema validation;
- parsed `planaxis.project.json` before Project Format validation;
- external API payloads;
- configuration loaded from unknown sources.

Do not assert unvalidated external data directly into trusted domain types.

Incorrect:

```ts
const metadata = JSON.parse(text) as ApartmentMetadata;
```

Preferred conceptually:

```ts
const raw: unknown = JSON.parse(text);
const metadata = validateApartmentMetadata(raw);
```

The same principle applies to project manifests and future project-local descriptors.

### 4.5. Prefer explicit return types on public APIs

Exported functions, methods, and package-level APIs should normally have explicit return types.

This makes API contracts visible and prevents accidental public type changes caused by implementation details.

Local private functions may rely on inference when the inferred type is clear.

---

## 5. Naming

### 5.1. General naming conventions

Use:

```text
PascalCase    types, interfaces, classes, enums
camelCase     functions, methods, variables, properties
UPPER_SNAKE_CASE
              true module-level constants when appropriate
kebab-case    directories and non-TypeScript filenames where practical
```

Examples:

```ts
interface ValidatedApartment2D {}
type WallId = string;

function validateWallGeometry(): ValidationResult {}

const effectiveWallHeight = ...;
const GEOMETRIC_EPSILON = ...;
```

Normative filenames and directory names defined by a specification, such as `planaxis.project.json` and the PlanAxis Project Format reserved directories, take precedence over general naming preferences.

### 5.2. Use domain terminology

Names should use terminology from the applicable specification where that terminology already exists.

Prefer:

```ts
openingHeight
sillHeight
northHeading
wallAxis
openLeaf
projectRoot
projectRelativePath
```

over invented synonyms when the specification already defines a precise term.

Consistent vocabulary reduces translation errors between specifications, implementation, tests, and documentation.

### 5.3. Prefer precise names

Avoid vague names such as:

```text
data
info
item
thing
object
helper
utils
manager
processor
handler
```

unless the context makes the responsibility genuinely precise.

Prefer names that describe the domain role:

```text
wallIndex
parsedMetadata
referenceResolver
doorGeometryValidator
geometricComparison
projectFilesystem
projectManifestValidator
```

### 5.4. Boolean names

Boolean values should normally read as predicates:

```ts
isValid
hasLocation
containsPoint
intersectsWall
canRenderSolarPosition
isWithinProjectRoot
```

Avoid ambiguous names when they represent booleans.

---

## 6. Files and Modules

### 6.1. Keep modules focused

A module should have a clear primary responsibility.

Do not combine unrelated parsing, validation, rendering, project-filesystem, HTTP, and persistence concerns in the same file merely to reduce the number of files.

At the same time, do not create a separate file for every trivial function without a concrete organizational benefit.

### 6.2. Prefer cohesive feature-oriented grouping

Group code around domain responsibility rather than generic technical buckets when practical.

Preferred direction:

```text
validator/
    wall/
    window/
    door/
```

over a large set of generic folders such as:

```text
helpers/
utils/
common/
misc/
```

Generic shared modules should exist only when their responsibility is truly cross-cutting.

### 6.3. Avoid catch-all utility modules

Files named `utils.ts`, `helpers.ts`, or `common.ts` tend to accumulate unrelated behavior.

Prefer specific modules such as:

```text
decimal-comparison.ts
rectangle-intersection.ts
id-index.ts
project-path.ts
```

### 6.4. Public package APIs

Packages should expose deliberate public APIs.

Consumers should not rely on deep internal paths unless the package explicitly defines them as public.

Prefer:

```ts
import { validateApartment } from "@planaxis/validator";
```

over a deep internal import.

Internal file layout should remain changeable without breaking consumers.

---

## 7. Domain Modeling

### 7.1. Model domain concepts explicitly

Use domain-specific types when they improve correctness and communication.

Examples include:

```text
ValidatedApartment2D
ArchitecturalModel3D
Wall
Window
Door
Zone
Point2D
Rect2D
ValidationError
```

Avoid passing large anonymous object shapes across architectural boundaries when the shape represents a stable domain concept.

Project-container concepts should also be modeled explicitly when they become stable, but do not move physical filesystem concerns into the apartment domain model.

### 7.2. Prefer discriminated unions for variants

When a domain concept has explicit variants, prefer discriminated unions.

For example, door variants may conceptually be represented using a stable discriminator:

```ts
type Door =
  | HingedDoor
  | SlidingDoor
  | OpeningOnlyDoor;
```

This allows TypeScript to enforce variant-specific data.

Do not force unrelated optional properties onto every variant merely to fit them into one loose interface.

### 7.3. Do not duplicate specification-derived facts unnecessarily

The persistent Apartment SVG intentionally avoids redundant geometric facts.

The in-memory model may expose derived values when they improve downstream code, but those values must remain clearly derived.

Do not create competing authoritative representations of the same geometry.

The PlanAxis project manifest likewise must not duplicate Apartment SVG geometry merely because higher-level project metadata exists.

Specification-defined derivations are not guesses. Implement such derivations exactly as specified rather than introducing alternate interpretations.

### 7.4. Use semantic identifiers where they prevent mistakes

Typed or branded identifiers may be introduced when they prevent meaningful category errors.

Do not introduce branded types mechanically for every string without a demonstrated benefit.

The goal is stronger correctness, not type-level ceremony.

---

## 8. Exact Decimal Arithmetic

### 8.1. Authoritative geometry must not use JavaScript `number`

Authoritative apartment geometry must use the project's decimal abstraction based on `decimal.js`.

This includes values such as:

- coordinates;
- dimensions;
- distances;
- wall thickness;
- opening dimensions;
- Z positions;
- geometric tolerances;
- geometry-derived intermediate values.

### 8.2. Parse decimal values directly from strings

Correct:

```ts
const x = new Decimal(attributeValue);
```

Incorrect:

```ts
const x = new Decimal(Number(attributeValue));
```

Also avoid:

```ts
const x = new Decimal(parseFloat(attributeValue));
```

A binary floating-point conversion must not occur before creation of the authoritative decimal value.

### 8.3. Do not mix `Decimal` and `number` casually

Code performing authoritative geometric calculations should remain in the decimal domain.

Avoid patterns such as:

```ts
decimalValue.toNumber() + anotherDecimal.toNumber()
```

for domain calculations.

Conversion to `number` is appropriate only at explicit boundaries such as renderer APIs.

### 8.4. Centralize geometric comparison

Do not scatter custom epsilon checks throughout the codebase.

Prefer reusable geometry operations whose semantics are clear.

The implementation must use the normative tolerance defined by the Apartment SVG specification.

### 8.5. Do not encode units in variable names as a substitute for types

The Apartment SVG specification defines centimeters for apartment geometry.

Avoid excessive names when the domain type and surrounding API already establish the unit.

Use explicit unit suffixes when units genuinely differ or conversion boundaries exist, for example `elevationMeters`.

---

## 9. Parsing and Validation Boundaries

### 9.1. Parsing is not validation

The parser should extract and structurally represent source data.

Do not turn parsing functions into broad validators that mix:

- XML parsing;
- schema validation;
- reference resolution;
- geometric checks;
- project filesystem traversal;
- 3D construction.

The processing stages defined by the architecture should remain observable and testable.

The same distinction applies to `planaxis.project.json`: JSON parsing is not Project Format validation, and Project Format validation is not Apartment SVG validation.

### 9.2. Do not guess

Parser and validator code must not infer missing required information.

Do not use visual or human-readable hints to create semantic facts that the relevant specification does not define.

### 9.3. Do not silently repair invalid input

Invalid external input should produce validation errors.

Do not silently:

- snap coordinates;
- move openings;
- normalize invalid hinge positions;
- change enum values;
- insert required references;
- delete unsupported attributes;
- rewrite invalid project-relative paths;
- normalize a path containing prohibited `.` or `..` segments into an accepted path;
- add unknown Project Format fields to compensate for missing required fields.

Normalization is allowed only when the applicable specification explicitly defines equivalent forms and the behavior preserves the normative meaning.

### 9.4. Keep raw and trusted representations distinguishable

Types should make it difficult to confuse parsed but unvalidated data with trusted validated data.

A function that requires validated geometry should accept a validated domain type rather than a generic parsed SVG structure.

A project filesystem operation should accept a path representation that has passed the required Project Format validation rather than an arbitrary client string where practical.

---

## 10. Validation Code

### 10.1. Validation should produce structured errors

Use structured validation errors rather than plain strings when a stable validation contract exists.

Apartment SVG validation errors should support the information required by the Apartment SVG specification.

Project Format errors should remain distinguishable from Apartment SVG errors and should identify the relevant manifest or path rule without unnecessarily exposing private machine-local filesystem details to an untrusted client.

### 10.2. Validation failures are expected domain outcomes

Invalid user input is not an exceptional programming failure.

Prefer returning a validation result or structured collection of validation errors where appropriate rather than throwing exceptions for normal conformance failures.

Exceptions are appropriate for unexpected internal failures, violated programmer assumptions, unavailable infrastructure, or unrecoverable library errors.

### 10.3. Preserve useful error context

Do not replace precise failures with generic messages such as `Invalid apartment.` or `Invalid project.` when actionable structured context is available.

### 10.4. Validation functions should be deterministic

The same input and validator version must produce the same validation outcome independently of locale, current date, machine time zone, browser state, network availability, or rendering state.

Filesystem-dependent project validation must still be explicit about the filesystem facts it depends on and should separate pure manifest/path checks from environment-specific existence/symlink checks where that improves testability.

---

## 11. Functions and Classes

### 11.1. Prefer functions for stateless domain operations

Use plain functions for parsing transformations, geometric calculations, validation rules, and deterministic model transformations.

### 11.2. Use classes when identity or encapsulated state justifies them

Classes are appropriate when an object genuinely owns lifecycle, mutable state, resource management, encapsulated invariants, or framework-required behavior.

A project-filesystem boundary may justify an object/class when it owns one canonical project root and encapsulates safe resource resolution.

### 11.3. Keep functions narrow

A function should have one coherent responsibility.

If a function parses XML, resolves IDs, validates geometry, constructs meshes, resolves project filesystem paths, and logs HTTP responses, it crosses architectural boundaries.

### 11.4. Prefer explicit inputs over hidden dependencies

Domain functions should receive required inputs through parameters or explicit context objects.

Avoid hidden mutable globals and service locators.

Do not introduce dependency-injection infrastructure without a demonstrated need.

---

## 12. Immutability and Mutation

Prefer immutable domain data where practical.

Functions that conceptually transform a model should normally return a new result rather than mutate unrelated shared state.

Mutation is acceptable when performance or API constraints justify it, ownership is local and unambiguous, and the mutation does not violate architectural invariants.

Do not expose mutable internal collections across package boundaries without a clear reason.

Use `readonly` where it usefully communicates domain intent.

---

## 13. Optional Values and Nullability

Use optionality deliberately.

Do not treat `undefined`, `null`, missing property, empty string, and zero as interchangeable.

Prefer `undefined` / optional properties for values that are absent in TypeScript APIs unless an external protocol explicitly requires `null`.

Do not use empty strings as substitutes for missing semantic values.

When a normative specification defines an optional field, preserve the distinction between not provided and provided with a valid value.

Do not synthesize a value unless the applicable specification defines a default.

---

## 14. Error Handling

### 14.1. Distinguish domain errors from programming errors

Examples of expected domain/format errors:

- malformed Apartment SVG;
- invalid attribute;
- broken reference;
- invalid wall geometry;
- malformed Project Format manifest;
- unsupported project schema version;
- invalid project-relative path;
- active architecture missing from a structurally parsed project.

Examples of programming or infrastructure errors:

- impossible internal state after successful validation;
- unexpected filesystem failure after preconditions were established;
- unexpected third-party library failure;
- violated internal invariant.

These categories should not be collapsed into one generic exception path.

### 14.2. Do not swallow errors

Avoid empty catch blocks or broad handling that destroys context.

### 14.3. Preserve causes

When wrapping unexpected errors, preserve the original cause where supported.

---

## 15. Asynchronous Code

Use asynchronous APIs only where the operation is genuinely asynchronous.

Typical asynchronous boundaries include:

- file access;
- HTTP requests;
- persistence;
- AI service calls;
- worker communication.

Pure geometry, parsing transformations after input acquisition, and validation rules should normally remain synchronous unless a concrete implementation requirement dictates otherwise.

Avoid unnecessary `async` functions that merely wrap synchronous code.

Do not mix callbacks and promises without a concrete library requirement.

---

## 16. Imports and Dependencies

### 16.1. Respect package boundaries

Do not import application code into shared domain packages.

Dependency direction must remain consistent with `docs/architecture/overview.md`.

### 16.2. Avoid circular dependencies

Circular dependencies between core packages or modules are a design warning and should normally be removed rather than tolerated.

### 16.3. Prefer existing capabilities

Before adding a dependency, check whether the standard library solves the problem, an existing project dependency already provides it, or the functionality is small enough to implement safely in-project.

Do not reimplement specialized, security-sensitive, or standards-heavy functionality merely to avoid a reasonable dependency.

### 16.4. Keep third-party libraries behind boundaries when appropriate

Libraries that materially influence core behavior should not leak unnecessarily throughout the domain.

Renderer-specific APIs should remain behind renderer boundaries. Filesystem-specific APIs should remain behind backend/project-filesystem boundaries rather than leaking into reusable apartment-domain packages.

### 16.5. Verify dependency versions from current registry data

Dependency versions must be selected using current package-registry information at implementation time.

Do not choose a version solely because it is present in model memory, used in an old example, copied from a template, familiar from a previous project, or known to belong to a compatible historical major version.

For every newly introduced or deliberately updated direct dependency, inspect current distribution tags, newest stable version, deprecation status, engine requirements, peer dependencies, and relevant official compatibility documentation.

If current registry information is unavailable, do not invent or guess a supposedly current version. Report the limitation.

### 16.6. Prefer the newest mutually compatible stable release

Use the newest stable, non-deprecated release that is mutually compatible with the repository.

Evaluate the current stable major release first.

Do not use prerelease or deprecated versions unless the task explicitly requires it and the reason is documented.

### 16.7. Evaluate compatibility explicitly

Relevant constraints may include Node.js runtime support, pnpm requirements, peer dependencies, TypeScript/build-tool compatibility, framework/plugin versions, and accepted ADRs.

Successful installation alone is not sufficient evidence of compatibility.

Do not suppress incompatibilities using forced installation, ignored peer-dependency errors, arbitrary overrides, or speculative resolution rules.

If the newest stable release cannot be used, select the newest mutually compatible stable version and report the evidence-backed reason.

### 16.8. Dependency declaration policy

For private applications and repository tooling, prefer exact direct dependency versions so that the package manifest communicates the dependency version actually selected and verified.

The committed `pnpm-lock.yaml` remains mandatory.

For published package dependencies, use a semantic version range that accurately expresses the supported compatibility contract.

### 16.9. Keep workspace versions consistent

When the same external dependency is used in multiple workspaces, avoid duplicated version literals that can drift independently.

Use pnpm catalogs when they provide a useful single source of truth for shared dependency versions.

### 16.10. Verify dependency changes

When a change adds or updates dependencies:

1. install the selected dependency set and update the lockfile;
2. run the complete repository verification sequence;
3. run `pnpm install --frozen-lockfile`;
4. review `pnpm outdated --recursive`.

`pnpm outdated --recursive` is a review signal, not a requirement that its output be empty. Evidence-backed compatibility exceptions are permitted.

---

## 17. Comments and Documentation in Code

### 17.1. Explain why, not what

Do not comment obvious syntax.

Useful comments explain specification-driven invariants, subtle coordinate conventions, tolerance rules, project-root security boundaries, intentionally unusual implementations, third-party API mismatches, or renderer/domain boundaries.

### 17.2. Document non-obvious invariants

Comments are valuable when explaining behavior whose correctness depends on an architectural or normative constraint.

### 17.3. Link to normative sections when useful

When implementation logic directly corresponds to a non-obvious normative rule, a concise reference to the relevant specification section is appropriate.

Do not duplicate entire specification paragraphs in source comments.

### 17.4. Avoid stale commentary

Delete comments that merely describe an older implementation.

Code and documentation must evolve together.

---

## 18. Formatting

Formatting should be automated.

The repository uses Prettier for formatting and ESLint for linting.

Do not manually maintain stylistic differences that automated tooling can normalize.

When changing executable project files:

- follow the repository formatter;
- follow the repository linter;
- do not disable rules without a concrete reason;
- keep rule suppressions as narrow as possible;
- explain non-obvious suppressions.

Do not perform large formatting-only rewrites as part of unrelated functional changes.

---

## 19. Logging

Logging is an application and infrastructure concern.

Core domain libraries should not print directly to `console.log` or `console.error` for normal operation.

Domain code should return values or structured errors.

Applications may log those outcomes using the application's logging mechanism.

Temporary debugging output must not remain in committed production code.

Do not log sensitive absolute filesystem paths to browser-visible responses without a concrete diagnostic need and appropriate sanitization.

---

## 20. Environment-Specific Code

Shared packages should avoid assumptions about:

- browser globals;
- Node.js globals;
- filesystem availability;
- DOM availability;
- process environment;
- network access.

When environment-specific behavior is required, isolate it in an adapter or application layer.

This preserves reuse of deterministic TypeScript core logic across browser and Node.js environments.

Project manifest/path validation that is purely deterministic may be shareable. Actual filesystem resolution, canonicalization, symbolic-link inspection, and file I/O belong in the Node.js/backend boundary.

---

## 21. Renderer Code

Renderer code may use native JavaScript numeric values where required by Three.js or GPU-facing APIs.

The conversion boundary must remain explicit.

Renderer code must not:

- redefine Apartment SVG semantics;
- redefine Project Format semantics;
- perform source-document validation as its primary responsibility;
- write floating-point rendering values back as canonical geometry;
- infer missing domain data from visual results.

Prefer transformation functions that clearly map:

```text
ArchitecturalModel3D
    +
runtime/presentation state
    ↓
renderer-specific scene
```

---

## 22. HTTP and API Code

HTTP-specific concepts belong in the server application or a dedicated adapter layer.

Do not put HTTP status codes, Fastify request objects, response objects, or route schemas inside core domain models.

Translate between transport contracts and domain contracts at explicit boundaries.

Validation errors may be serialized for APIs, but domain/format error models should not depend on HTTP.

Project APIs must expose deliberate resource contracts rather than a generic static view of the complete project root.

Do not accept a browser-supplied absolute filesystem path as a project resource selector.

---

## 23. PlanAxis Project Filesystem and Persistent Paths

The normative rules are defined by `docs/specifications/planaxis-project/1.0.md` and ADR-004. This section gives implementation guidance without redefining those contracts.

### 23.1. Centralize project filesystem access

Project filesystem resolution must go through a narrow backend boundary that owns the canonical project root.

Routes, asset processors, AI integrations, thumbnail generation, and future persistence code must not independently concatenate or resolve client-controlled paths against the filesystem.

Conceptually prefer:

```ts
projectFilesystem.read(projectRelativePath)
```

over ad hoc `path.join(projectRoot, requestValue)` calls scattered across routes.

The exact API should be designed from implementation requirements; do not introduce unnecessary framework abstractions.

### 23.2. Persistent project references are canonical project-relative paths

Durable project descriptors must use the Project Format's `/`-separated project-relative syntax.

Do not persist:

- absolute POSIX paths;
- Windows drive paths;
- `file:` URLs;
- host-native backslash paths;
- paths containing prohibited `.` or `..` segments.

Do not "sanitize" a non-conforming persistent path into a different accepted path. Reject it according to the specification.

### 23.3. Root containment is a security invariant

Every project filesystem operation derived from project data or client input must prove that its resolved target remains inside the canonical project root.

String-prefix checks against uncanonicalized paths are insufficient.

Follow the Project Format symbolic-link policy. In Project Format 1.0, project resource resolution must not traverse symbolic links below the canonical root.

### 23.4. Separate pure path validation from filesystem facts

Where practical, keep canonical project-relative path syntax validation deterministic and separately testable from environment-specific checks such as:

- target existence;
- regular-file type;
- canonical physical root;
- symbolic-link inspection;
- filesystem permissions.

Do not weaken the final boundary merely to make the pure portion convenient.

### 23.5. `.planaxis/` is disposable

No authoritative or irreplaceable project fact may exist only under `.planaxis/`.

Caches and temporary derived resources may be freely rebuilt or removed.

Code consuming durable project state must not require a cache file to interpret architecture, assets, or designs correctly.

### 23.6. Durable writes should be failure-safe

When PlanAxis writes durable JSON descriptors or manifests, use an atomic replacement strategy where the host filesystem permits it.

Do not overwrite user-valued outputs implicitly unless the operation explicitly requests replacement.

### 23.7. Network exposure

Filesystem-backed project serving binds to loopback by default under ADR-004.

Do not change the default to all interfaces as a convenience for development without a deliberate architectural/security change.

---

## 24. Security and Untrusted Input

Treat uploaded, externally supplied, and project-contained inputs as untrusted until the relevant format and boundary checks succeed.

This includes:

- Apartment SVG documents;
- `planaxis.project.json`;
- project-relative resource paths;
- future material/design/model descriptors;
- external API payloads.

Do not assume syntactically valid XML or JSON is schema-conformant or safe.

Parsing libraries and configuration should avoid unnecessary external-resource resolution or other behavior that expands the attack surface.

Do not execute content from apartment documents or arbitrary project files.

Never commit credentials, API keys, tokens, passwords, private local paths, or secret environment values.

Environment secrets belong outside version control.

---

## 25. Performance

Correctness and clear architecture take priority over speculative micro-optimization.

Do not convert authoritative geometry to native floating point merely for assumed performance gains.

Optimize only after identifying a measurable problem, locating the actual bottleneck, and preserving correctness through tests.

Renderer-specific optimization may use renderer-appropriate data structures after the authoritative model boundary.

Avoid repeatedly parsing, resolving, or deriving the same data when a validated model can safely retain a deterministic derived representation.

Caches under `.planaxis/` may improve performance but must remain reconstructible and non-authoritative.

---

## 26. TODOs and Temporary Code

Avoid vague TODO comments.

Prefer concrete descriptions tied to a real deferred capability.

Do not leave temporary hacks undocumented.

If temporary behavior intentionally differs from a desired future architecture, document the constraint and ensure it does not violate current accepted specifications or ADRs.

Do not use TODO comments to postpone correctness required by the current task.

---

## 27. Generated Files

Do not manually edit generated output when another file or generator is the source of truth.

Generated artifacts should be clearly identifiable and reproducible.

Do not commit generated build output unless the repository explicitly requires it.

Project-generated output under a user's `outputs/` directory is user-valued project data and is conceptually different from repository build output.

---

## 28. Code Review Checklist

Before considering an implementation change complete, verify:

- the code uses English naming and comments;
- TypeScript types remain strict;
- no unnecessary `any` was introduced;
- authoritative geometry remains decimal-based;
- raw external input is not treated as trusted domain data;
- parsing, validation, domain, rendering, project-filesystem, and HTTP responsibilities remain separated;
- Apartment SVG semantics match the normative specification when applicable;
- PlanAxis Project Format semantics match the normative specification when applicable;
- project-format validity remains separate from Apartment SVG validity;
- project paths are canonical, portable, and confined to the canonical root;
- no project resource symlink traversal was introduced contrary to Project Format 1.0;
- `.planaxis/` remains disposable;
- the project root is not exposed as an unrestricted static directory;
- filesystem-backed server exposure remains loopback by default unless deliberately changed by architecture;
- no unsupported inference or silent repair was introduced;
- package boundaries and dependency direction remain valid;
- new dependencies are justified;
- new or updated dependency versions were checked against current registry metadata;
- selected dependencies use the newest mutually compatible stable, non-deprecated releases unless an evidence-backed exception is documented;
- repeated workspace dependency versions do not drift unnecessarily;
- dependency manifest changes are consistent with `pnpm-lock.yaml` and a frozen-lockfile installation succeeds;
- errors preserve useful structured context;
- automated tests cover behavior changes;
- lint, typecheck, test, and build checks pass when available;
- documentation, specifications, and ADRs are updated when the change affects them.

Detailed testing requirements are defined in:

```text
docs/development/testing.md
```
