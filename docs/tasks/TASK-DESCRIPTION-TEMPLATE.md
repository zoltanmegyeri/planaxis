# TASK-NNN: Task Title

## Context

Briefly describe the project context needed to understand this task.

Include only information that helps the coding agent make correct implementation decisions.

Do not place requirements only in conversational instructions outside this file.

## Required Reading

Before making changes, read and follow:

```text
AGENTS.md
```

Also read the repository documents relevant to this task:

```text
<path/to/relevant-document>
<path/to/relevant-adr>
<path/to/relevant-specification>
```

Only include documents that are genuinely relevant to the task.

Do not instruct the agent to browse other task records or other task descriptions under `docs/tasks/`.

## Goal

State the concrete outcome this task must achieve.

Describe the desired end state rather than only listing implementation steps.

## Scope

The task includes:

- <required change>;
- <required change>;
- <required change>.

Keep the scope coherent and narrow enough to review as one unit of delegated work.

## Out of Scope

The task explicitly does **not** include:

- <excluded change>;
- <future work>;
- <related but intentionally deferred concern>.

Do not implement speculative follow-up work merely because it appears adjacent to this task.

## Functional Requirements

Define the required behavior.

Use precise, testable statements.

Examples:

- the implementation MUST ...;
- the implementation MUST NOT ...;
- when `<condition>` occurs, the system MUST ...;
- invalid input MUST ...;
- existing public behavior MUST remain unchanged unless explicitly stated otherwise.

Remove this section if the task has no functional behavior.

## Technical and Architectural Constraints

The implementation MUST comply with the repository architecture and development rules.

Task-specific constraints:

- <constraint>;
- <constraint>;
- <required package or boundary>;
- <prohibited dependency or approach>.

Do not duplicate large sections of architecture or coding documentation here. Reference authoritative repository documents instead.

## Files and Areas Expected to Change

Expected areas include:

```text
<path>
<path>
```

This list is guidance, not permission to ignore a better location already established by the repository architecture.

Do not modify unrelated files.

Remove this section when file locations cannot reasonably be predicted in advance.

## Dependencies

Expected dependency policy for this task:

- reuse existing repository dependencies where practical;
- add a new dependency only when the task genuinely requires it;
- do not introduce competing frameworks or duplicate core capabilities;
- document any newly added dependency in the final report.

Task-specific dependency requirements:

```text
<dependency or "None.">
```

## Testing Requirements

Add or update automated tests for all behavior introduced or changed by this task.

Where relevant, include:

- positive cases;
- negative cases;
- boundary cases;
- regression coverage;
- valid fixtures;
- invalid fixtures;
- exact decimal or tolerance edge cases.

Tests MUST follow:

```text
docs/development/testing.md
```

Do not weaken, skip, or delete existing tests merely to make the task pass.

## Documentation Requirements

Update repository documentation when this task makes existing documentation inaccurate.

Required documentation changes:

- <document/change>;
- <document/change>.

Use:

```text
None.
```

when no documentation change is required.

Do not modify task artifacts under `docs/tasks/`.

## Verification

Run the repository checks required by `AGENTS.md` and any task-specific checks.

Expected verification:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Add focused commands here when the task requires them:

```bash
<focused verification command>
```

Do not report a verification step as successful unless it was actually executed successfully.

If a required command cannot be run, report exactly which command was not run and why.

## Acceptance Criteria

The task is complete only when all applicable criteria below are satisfied:

1. <observable completion criterion>;
2. <observable completion criterion>;
3. required tests pass;
4. required repository verification passes;
5. architecture and package boundaries remain intact;
6. no unrelated changes are introduced;
7. no out-of-scope functionality is implemented.

Acceptance criteria SHOULD be objective enough that a human reviewer can determine whether the task was completed correctly.

## Final Response

When finished, provide a concise execution report containing:

1. a summary of the implementation;
2. the main files or areas changed;
3. tests added or updated;
4. verification commands actually run and their results;
5. deviations from this task description, or `None`;
6. follow-up work identified during execution, or `None`;
7. a suggested Conventional Commits message that includes:

```text
Task: TASK-NNN
```

Do not stage, commit, push, pull, fetch, or otherwise perform Git write or synchronization operations.

Do not modify any file under:

```text
docs/tasks/
```
