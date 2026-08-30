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

The Apartment SVG format itself is defined normatively by:

```text
docs/specifications/apartment-svg/2.1.md
```

These guidelines describe how PlanAxis code should be written. They do not redefine Apartment SVG semantics or architecture.

When a rule in this document conflicts with the normative Apartment SVG specification, the specification governs Apartment SVG behavior. When a rule conflicts with an accepted Architectural Decision Record, the ADR governs the architectural decision.

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

### 5.2. Use domain terminology

Names should use terminology from the Apartment SVG specification where that terminology already exists.

Prefer:

```ts
openingHeight
sillHeight
northHeading
wallAxis
openLeaf
```

over invented synonyms such as:

```ts
holeHeight
windowBottom
northAngle
wallDirection
doorTip
```

Consistent vocabulary reduces translation errors between specification, implementation, tests, and documentation.

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
```

### 5.4. Boolean names

Boolean values should normally read as predicates:

```ts
isValid
hasLocation
containsPoint
intersectsWall
canRenderSolarPosition
```

Avoid ambiguous names such as:

```ts
valid
location
collision
```

when they represent booleans.

---

## 6. Files and Modules

### 6.1. Keep modules focused

A module should have a clear primary responsibility.

Do not combine unrelated parsing, validation, rendering, HTTP, and persistence concerns in the same file merely to reduce the number of files.

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
```

### 6.4. Public package APIs

Packages should expose deliberate public APIs.

Consumers should not rely on deep internal paths unless the package explicitly defines them as public.

Prefer:

```ts
import { validateApartment } from "@planaxis/validator";
```

over:

```ts
import { validateApartment } from "@planaxis/validator/src/internal/pipeline/validate-apartment";
```

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

### 7.4. Use semantic identifiers where they prevent mistakes

Typed or branded identifiers may be introduced when they prevent meaningful category errors, for example confusing wall IDs with window IDs.

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

Prefer reusable geometry operations whose semantics are clear, for example:

```ts
isGeometricallyEqual(a, b)
isLessThanOrEqualWithinTolerance(a, b)
```

The implementation must use the normative tolerance defined by the Apartment SVG specification.

### 8.5. Do not encode units in variable names as a substitute for types

The Apartment SVG specification defines centimeters for apartment geometry.

Avoid excessive names such as:

```ts
wallWidthInCentimeters
doorHeightCm
```

when the domain type and surrounding API already establish the unit.

Use explicit unit suffixes when units genuinely differ or conversion boundaries exist, for example:

```ts
elevationMeters
```

because the specification explicitly uses meters for geographic elevation while apartment geometry uses centimeters.

---

## 9. Parsing and Validation Boundaries

### 9.1. Parsing is not validation

The parser should extract and structurally represent source data.

Do not turn parsing functions into broad validators that mix:

- XML parsing;
- schema validation;
- reference resolution;
- geometric checks;
- 3D construction.

The processing stages defined by the architecture should remain observable and testable.

### 9.2. Do not guess

Parser and validator code must not infer missing required information.

Do not use:

- element names;
- CSS;
- colors;
- annotation graphics;
- text labels;
- visual proximity;
- undocumented defaults;

to create semantic facts.

### 9.3. Do not silently repair invalid input

Invalid Apartment SVG should produce validation errors.

Do not silently:

- snap coordinates;
- move openings;
- normalize invalid hinge positions;
- change enum values;
- insert required references;
- delete unsupported attributes.

Normalization is allowed only when the specification explicitly defines equivalent forms and the behavior preserves the exact normative meaning.

### 9.4. Keep raw and trusted representations distinguishable

Types should make it difficult to confuse:

```text
parsed but unvalidated data
```

with:

```text
ValidatedApartment2D
```

A function that requires validated geometry should accept a validated domain type rather than a generic parsed SVG structure.

---

## 10. Validation Code

### 10.1. Validation should produce structured errors

Use structured validation errors rather than plain strings.

Validation errors should support the information required by the Apartment SVG specification, including:

- error code;
- affected element ID where applicable;
- attribute or geometric rule;
- actual value;
- expected condition.

Human-readable messages may be derived from structured information.

### 10.2. Validation failures are expected domain outcomes

Invalid user input is not an exceptional programming failure.

Prefer returning a validation result or structured collection of validation errors where appropriate rather than throwing exceptions for normal conformance failures.

Exceptions are appropriate for unexpected internal failures, violated programmer assumptions, unavailable infrastructure, or unrecoverable library errors.

### 10.3. Preserve useful error context

Do not replace a precise error with a generic message such as:

```text
Invalid apartment.
```

Errors should identify the relevant rule and element whenever possible.

### 10.4. Validation functions should be deterministic

The same document and validator version must produce the same validation outcome independently of:

- locale;
- current date;
- machine time zone;
- browser state;
- network availability;
- rendering state.

Runtime-dependent simulation belongs outside document validation unless the specification explicitly defines otherwise.

---

## 11. Functions and Classes

### 11.1. Prefer functions for stateless domain operations

Use plain functions for:

- parsing transformations;
- geometric calculations;
- validation rules;
- deterministic model transformations.

Do not create classes merely to group functions.

### 11.2. Use classes when identity or encapsulated state justifies them

Classes are appropriate when an object genuinely owns:

- lifecycle;
- mutable state;
- resource management;
- encapsulated invariants;
- framework-required behavior.

The project does not require object-oriented patterns merely because classes are available.

### 11.3. Keep functions narrow

A function should have one coherent responsibility.

If a function:

- parses XML;
- resolves IDs;
- validates geometry;
- constructs meshes;
- logs HTTP responses;

it almost certainly crosses architectural boundaries.

### 11.4. Prefer explicit inputs over hidden dependencies

Domain functions should receive required inputs through parameters or explicit context objects.

Avoid hidden mutable globals and service locators.

Do not introduce dependency-injection infrastructure without a demonstrated need.

---

## 12. Immutability and Mutation

Prefer immutable domain data where practical.

Functions that conceptually transform a model should normally return a new result rather than mutate unrelated shared state.

Mutation is acceptable when:

- performance or API constraints justify it;
- ownership is local and unambiguous;
- the mutation does not violate architectural invariants.

Do not expose mutable internal collections across package boundaries without a clear reason.

Use `readonly` where it usefully communicates domain intent.

Avoid blanket use of `readonly` when it creates excessive friction without protecting a meaningful invariant.

---

## 13. Optional Values and Nullability

Use optionality deliberately.

Do not treat:

```text
undefined
null
missing property
empty string
zero
```

as interchangeable.

Prefer `undefined` / optional properties for values that are absent in TypeScript APIs unless an external protocol explicitly requires `null`.

Do not use empty strings as substitutes for missing semantic values.

When the Apartment SVG specification defines an optional field, preserve the distinction between:

```text
not provided
```

and:

```text
provided with a valid value
```

Do not synthesize a value unless the specification defines a default.

---

## 14. Error Handling

### 14.1. Distinguish domain errors from programming errors

Examples of expected domain errors:

- malformed Apartment SVG;
- invalid attribute;
- broken reference;
- invalid wall geometry.

Examples of programming or infrastructure errors:

- impossible internal state after successful validation;
- failure to read a required resource;
- unexpected third-party library failure;
- violated internal invariant.

These categories should not be collapsed into one generic exception path.

### 14.2. Do not swallow errors

Avoid empty catch blocks or broad handling that destroys context.

Incorrect:

```ts
try {
  ...
} catch {
  return undefined;
}
```

unless `undefined` is explicitly the documented meaning of every possible failure.

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

Before adding a dependency, check whether:

- the standard library solves the problem;
- an existing project dependency already provides it;
- the functionality is small enough to implement safely in-project.

Do not reimplement specialized, security-sensitive, or standards-heavy functionality merely to avoid a reasonable dependency.

### 16.4. Keep third-party libraries behind boundaries when appropriate

Libraries that materially influence core behavior should not leak unnecessarily throughout the domain.

For example, decimal behavior should be exposed through consistent project conventions rather than allowing arbitrary numeric representations across packages.

Renderer-specific APIs should remain behind renderer boundaries.

### 16.5. Verify dependency versions from current registry data

Dependency versions must be selected using current package-registry information at implementation time.

Do not choose a version solely because it is:

- present in model memory;
- used in an old example;
- copied from a template;
- familiar from a previous project;
- known to belong to a compatible historical major version.

For every newly introduced or deliberately updated direct dependency, inspect the information relevant to selection, including where available:

- current distribution tags;
- the newest stable version;
- deprecation status;
- package engine requirements;
- peer dependency requirements;
- official compatibility or migration documentation when a major version changed.

A registry command such as `pnpm view` may be used to inspect current metadata.

If current registry information is unavailable, do not invent or guess a supposedly current version. Report the limitation.

### 16.6. Prefer the newest mutually compatible stable release

The default selection rule is:

> use the newest stable, non-deprecated release that is mutually compatible with the repository.

Evaluate the current stable major release first.

Do not remain on an older major merely because it is familiar or because the agent or developer already knows its API.

A version is not considered stable merely because it can be installed.

When semantic versioning is used, versions with prerelease identifiers such as:

```text
alpha
beta
rc
next
canary
nightly
```

are not stable releases.

The registry `latest` tag may be used as the initial stable-release candidate only when the version it identifies is non-prerelease and non-deprecated.

Do not use a prerelease or deprecated version unless the task explicitly requires it and the reason is documented.

### 16.7. Evaluate compatibility explicitly

Before accepting a dependency version, check compatibility with the parts of the repository that constrain it.

Relevant constraints may include:

- Node.js runtime support;
- pnpm or package-manager requirements where applicable;
- peer dependencies;
- TypeScript or build-tool compatibility;
- related framework or plugin versions;
- accepted ADRs and architecture baselines;
- known regressions documented by the project or dependency maintainers.

Successful installation alone is not sufficient evidence of compatibility.

Do not suppress or bypass incompatibilities using:

- forced installation;
- ignored peer-dependency errors;
- arbitrary overrides;
- speculative resolution rules.

If the newest stable release cannot be used, select the newest mutually compatible stable version.

The implementation or task execution report must identify:

- the dependency;
- the newest stable version considered;
- the selected version;
- the concrete incompatibility;
- the registry metadata or official documentation supporting the exception.

### 16.8. Dependency declaration policy

For private applications and repository tooling, prefer exact direct dependency versions so that the package manifest communicates the dependency version actually selected and verified.

The committed `pnpm-lock.yaml` remains mandatory and records the complete resolved dependency graph.

Do not use a broad version range in a private application merely to preserve an arbitrary older lower bound while the lockfile resolves a newer version.

Packages intended for publication have a different responsibility.

For published package dependencies, use a semantic version range that accurately expresses the supported compatibility contract. Do not automatically pin an exact version when doing so would unnecessarily restrict consumers.

Peer dependency ranges must describe the compatibility contract rather than only the version used during local development.

### 16.9. Keep workspace versions consistent

When the same external dependency is used in multiple workspaces, avoid duplicated version literals that can drift independently.

Use pnpm catalogs when they provide a useful single source of truth for shared dependency versions.

Do not introduce a catalog entry solely for ceremony when a dependency appears only once.

### 16.10. Verify dependency changes

When a change adds or updates dependencies:

1. install the selected dependency set and update the lockfile;
2. run the complete repository verification sequence;
3. run:

```bash
pnpm install --frozen-lockfile
```

to verify that the committed manifests and lockfile are consistent;
4. review:

```bash
pnpm outdated --recursive
```

to identify direct dependencies for which newer releases exist.

`pnpm outdated --recursive` is a review signal, not a requirement that its output be empty.

A newer release may legitimately remain unselected when it is incompatible. Such an exception must be explicitly justified with evidence.

The lockfile does not replace dependency-version review. A manifest that names an arbitrary older lower bound while the lockfile happens to resolve a newer release does not accurately communicate the reviewed dependency baseline.

---

## 17. Comments and Documentation in Code

### 17.1. Explain why, not what

Do not comment obvious syntax.

Poor:

```ts
// Add width to x.
const maxX = x.plus(width);
```

Useful:

```ts
// Window containment is checked along the wall's longitudinal axis;
// wall-thickness equality is validated separately.
const maxX = x.plus(width);
```

### 17.2. Document non-obvious invariants

Comments are valuable when explaining:

- a specification-driven invariant;
- a subtle coordinate convention;
- a tolerance rule;
- an intentionally unusual implementation;
- a third-party API mismatch;
- a renderer/domain boundary.

### 17.3. Link to normative sections when useful

When implementation logic directly corresponds to a non-obvious normative rule, a concise reference to the relevant specification section is appropriate.

Do not duplicate entire specification paragraphs in source comments.

### 17.4. Avoid stale commentary

Delete comments that merely describe an older implementation.

Code and documentation must evolve together.

---

## 18. Formatting

Formatting should be automated.

The repository bootstrap is expected to configure a formatter and linter.

Do not manually maintain stylistic differences that automated tooling can normalize.

Once the project configuration exists:

- follow the repository formatter;
- follow the repository linter;
- do not disable rules without a concrete reason;
- keep rule suppressions as narrow as possible;
- explain non-obvious suppressions.

Do not perform large formatting-only rewrites as part of unrelated functional changes.

---

## 19. Logging

Logging is an application and infrastructure concern.

Core domain libraries should not print directly to:

```ts
console.log(...)
console.error(...)
```

for normal operation.

Domain code should return values or structured errors.

Applications may log those outcomes using the application's logging mechanism.

Temporary debugging output must not remain in committed production code.

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

---

## 21. Renderer Code

Renderer code may use native JavaScript numeric values where required by Three.js or GPU-facing APIs.

The conversion boundary must remain explicit.

Renderer code must not:

- redefine Apartment SVG semantics;
- perform source-document validation as its primary responsibility;
- write floating-point rendering values back as canonical geometry;
- infer missing domain data from visual results.

Prefer transformation functions that clearly map:

```text
ArchitecturalModel3D
    +
runtime simulation state
    ↓
renderer-specific scene
```

---

## 22. HTTP and API Code

HTTP-specific concepts belong in the server application or a dedicated adapter layer.

Do not put:

- HTTP status codes;
- Fastify request objects;
- response objects;
- route schemas;

inside core domain models.

Translate between transport contracts and domain contracts at explicit boundaries.

Validation errors may be serialized for APIs, but the domain error model should not depend on HTTP.

---

## 23. Security and Untrusted Input

Treat uploaded or externally supplied Apartment SVG documents as untrusted input.

Do not assume that syntactically valid XML is safe or schema-conformant.

Parsing libraries and configuration should avoid unnecessary external-resource resolution or other behavior that expands the attack surface.

Do not execute content from apartment documents.

Never commit:

- credentials;
- API keys;
- tokens;
- passwords;
- private local paths;
- secret environment values.

Environment secrets belong outside version control.

---

## 24. Performance

Correctness and clear architecture take priority over speculative micro-optimization.

Do not convert authoritative geometry to native floating point merely for assumed performance gains.

Optimize only after:

1. identifying a measurable problem;
2. locating the actual bottleneck;
3. preserving correctness through tests.

Renderer-specific optimization may use renderer-appropriate data structures after the authoritative model boundary.

Avoid repeatedly parsing, resolving, or deriving the same data when a validated model can safely retain a deterministic derived representation.

---

## 25. TODOs and Temporary Code

Avoid vague TODO comments.

Poor:

```ts
// TODO fix this
```

Prefer a concrete description:

```ts
// TODO: Support multi-level references when Apartment SVG adds
// formal multi-level semantics.
```

Do not leave temporary hacks undocumented.

If temporary behavior intentionally violates a desired future architecture, document the constraint and ensure it does not violate the current specification.

Do not use TODO comments to postpone correctness required by the current task.

---

## 26. Generated Files

Do not manually edit generated output when another file or generator is the source of truth.

Generated artifacts should be clearly identifiable and reproducible.

Do not commit generated build output unless the repository explicitly requires it.

---

## 27. Code Review Checklist

Before considering an implementation change complete, verify:

- the code uses English naming and comments;
- TypeScript types remain strict;
- no unnecessary `any` was introduced;
- authoritative geometry remains decimal-based;
- raw external input is not treated as trusted domain data;
- parsing, validation, domain, rendering, and HTTP responsibilities remain separated;
- Apartment SVG semantics match the normative specification;
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
- documentation and ADRs are updated when the change affects them.

Detailed testing requirements are defined in:

```text
docs/development/testing.md
```
