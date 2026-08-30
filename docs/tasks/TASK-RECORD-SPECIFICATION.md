# Task Record Specification

- **Version:** 1.0
- **Status:** Normative
- **Language:** English

## 1. Purpose

This specification defines the required structure, semantics, lifecycle, and archival rules for formal coding-agent tasks in the PlanAxis repository.

A formal task is represented by two Markdown documents:

```text
TASK-NNN-record.md
TASK-NNN-description.md
```

The two documents have different responsibilities:

- the **task description** defines the exact work delegated to the coding agent;
- the **task record** documents the task lifecycle, execution result, verification, human review, and implementation commit history.

The task description is the authoritative definition of delegated work.

The task record is the authoritative historical record of how that delegated work progressed and was finalized.

This separation allows the task definition to remain immutable after delegation while the task record continues to evolve through execution, review, and completion.

## 2. Scope

This specification governs:

- task identifiers;
- task directory naming;
- task record filenames;
- task description filenames;
- task title consistency;
- task record structure;
- metadata fields;
- task statuses;
- allowed lifecycle transitions;
- date formats;
- task description immutability;
- execution recording;
- verification recording;
- human review;
- implementation commit recording;
- cancellation;
- supersession;
- historical integrity;
- conformance requirements.

This specification does **not** define:

- the complete internal structure of a task description;
- the human development workflow for choosing between human-owned and agent-delegated development;
- the exact invocation prompt entered into a coding-agent user interface;
- repository-wide coding-agent behavior outside formal task artifacts.

Those concerns are governed by their respective development and agent instructions.

## 3. Normative Language

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**, and **MAY** are normative.

- **MUST / REQUIRED**: mandatory for conformance.
- **MUST NOT**: prohibited.
- **SHOULD**: recommended unless a documented reason justifies otherwise.
- **SHOULD NOT**: discouraged unless a documented reason justifies otherwise.
- **MAY**: optional.

## 4. Repository Location

Formal task artifacts MUST be stored under:

```text
docs/tasks/
```

Each actual task MUST have its own directory.

The `docs/tasks/` directory MAY also contain shared task documentation such as:

```text
TASK-RECORD-SPECIFICATION.md
TASK-RECORD-EXAMPLE.md
TASK-DESCRIPTION-TEMPLATE.md
```

Shared task documentation is not itself a task.

## 5. Terminology

### 5.1. Formal task

A complete unit of development work deliberately delegated to a coding agent under the PlanAxis agent-delegated task process.

### 5.2. Task identifier

A stable identifier in the form:

```text
TASK-NNN
```

where `NNN` is a zero-padded three-digit decimal sequence number.

### 5.3. Task description

The Markdown document that defines the exact delegated work.

Its filename is:

```text
TASK-NNN-description.md
```

### 5.4. Task record

The Markdown document that tracks task metadata, lifecycle state, execution result, verification, human review, and implementation commits.

Its filename is:

```text
TASK-NNN-record.md
```

### 5.5. Invocation prompt

The short instruction entered into the coding-agent interface to initiate execution of an already-defined formal task.

The invocation prompt is not the task definition.

Task requirements MUST reside in the task description rather than only in the invocation prompt.

### 5.6. Issued task

A task that has been formally authorized for coding-agent execution.

A task becomes issued when its record enters the `In Progress` state and the `Issued` field is populated.

### 5.7. Human maintainer

The human developer or contributor responsible for preparing the task, reviewing agent output, performing Git write operations, and finalizing the task record.

### 5.8. Implementation commit

A human-created Git commit containing implementation changes produced by the task and accepted through human review.

A task MAY result in one or more implementation commits.

### 5.9. Terminal state

A task status after which the task MUST NOT return to an active lifecycle state.

Terminal states are:

```text
Completed
Cancelled
Superseded
```

## 6. Task Identifier

### 6.1. Format

Every formal task MUST have exactly one identifier in this form:

```text
TASK-NNN
```

Examples:

```text
TASK-001
TASK-002
TASK-017
TASK-128
```

The numeric component:

- MUST consist of exactly three decimal digits;
- MUST be zero-padded;
- MUST be unique within the repository;
- MUST NOT be reused for another task;
- SHOULD increase monotonically.

`TASK-000` SHOULD NOT be used for ordinary tasks.

### 6.2. Identifier permanence

Once a task identifier has been committed to the repository, it MUST NOT be reassigned.

Cancelled or superseded task identifiers remain permanently reserved.

Deleting a task does not make its identifier reusable.

## 7. Task Directory and Filenames

### 7.1. Directory name

A task directory MUST follow:

```text
TASK-NNN-<short-kebab-case-title>
```

Example:

```text
TASK-001-bootstrap-typescript-monorepo
```

The title portion:

- MUST use lowercase kebab-case;
- SHOULD be concise;
- SHOULD describe the task's primary goal;
- MUST NOT change merely because task status changes.

### 7.2. Required task files

Every task directory MUST contain exactly one task record and exactly one task description using these names:

```text
TASK-NNN-record.md
TASK-NNN-description.md
```

Example:

```text
docs/tasks/
└── TASK-001-bootstrap-typescript-monorepo/
    ├── TASK-001-record.md
    └── TASK-001-description.md
```

The identifier in:

- the directory name;
- the record filename;
- the description filename;

MUST match.

Additional task-specific supporting files SHOULD NOT be added unless a concrete task requires them.

## 8. Task Title

The task record and task description MUST use the same task title.

The first heading of both files MUST use:

```markdown
# TASK-NNN: Task Title
```

Example:

```markdown
# TASK-001: Bootstrap the PlanAxis TypeScript Monorepo
```

The identifier in the heading MUST match the task directory and filenames.

A title SHOULD remain stable after the task reaches `Ready`.

A title MUST NOT be rewritten after the task is issued merely to improve historical presentation.

## 9. Task Description

### 9.1. Role

`TASK-NNN-description.md` is the authoritative definition of the delegated task.

All requirements necessary for correct agent execution MUST appear in the description or in repository documents explicitly referenced by the description.

The invocation prompt MUST NOT be relied upon to supply missing task requirements.

### 9.2. Content

A task description MAY use any Markdown organization appropriate to the task.

It SHOULD normally make the following clear where relevant:

- task goal;
- required reading;
- scope;
- out-of-scope items;
- implementation constraints;
- architecture constraints;
- testing requirements;
- verification requirements;
- acceptance criteria;
- required final report.

The description SHOULD be self-contained enough that a coding agent can determine what work is required without browsing other task records.

### 9.3. Repository instructions

A task description SHOULD explicitly require compliance with:

```text
AGENTS.md
```

It MAY reference additional repository documentation required for the task.

### 9.4. No hidden task requirements

A requirement that materially affects implementation MUST NOT exist only:

- in a chat conversation;
- in the invocation prompt;
- in a task record;
- in another task's description;
- in an uncommitted personal note.

If the coding agent is expected to follow a requirement, that requirement MUST be present in the assigned task description or an explicitly referenced authoritative repository document.

## 10. Task Description Mutability

### 10.1. Draft

While task status is `Draft`, the description MAY be edited freely.

### 10.2. Ready

When task status is `Ready`, the description is considered finalized for delegation.

Minor corrections MAY be made before issue.

A substantive change to a `Ready` description SHOULD return the task to `Draft` before the revised task is considered ready again.

### 10.3. In Progress and terminal states

Once the task has been issued:

> `TASK-NNN-description.md` MUST NOT be modified.

This prohibition applies in:

```text
In Progress
Completed
Cancelled
Superseded
```

when the task reached `In Progress` before entering the terminal state.

If an issued description contains an error or requirements materially change:

- the historical description MUST remain unchanged;
- the difference MUST be documented in the task record where relevant;
- a replacement or follow-up task SHOULD be created when the change materially alters the delegated work.

The description MUST NOT be rewritten retroactively to make historical instructions appear different from what the coding agent actually received.

## 11. Task Record Structure

`TASK-NNN-record.md` MUST contain the following sections in this order:

```text
# TASK-NNN: Task Title

## Task Metadata
## Purpose
## Description
## Execution Record
## Human Review
## Finalization
## Notes
```

These section headings MUST use the names shown above.

Required subsections are defined by later sections of this specification.

Additional subsections MAY be added only when they do not duplicate, override, or obscure normative fields.

## 12. Task Metadata

The `Task Metadata` section MUST contain the following fields in this order:

```markdown
- **Status:** <status>
- **Created:** <date>
- **Issued:** <date-or-em-dash>
- **Completed:** <date-or-em-dash>
- **Agent:** <agent-or-em-dash>
- **Repository:** PlanAxis
- **Description:** `TASK-NNN-description.md`
- **Related tasks:** <value>
- **Related ADRs:** <value>
- **Related specifications:** <value>
- **Implementation commits:** <value>
```

### 12.1. Status

Allowed values are:

```text
Draft
Ready
In Progress
Completed
Cancelled
Superseded
```

No other value is conforming.

### 12.2. Created

`Created` MUST contain the date on which the task record was created.

### 12.3. Issued

`Issued` records the date on which the human maintainer formally authorized the committed task description for coding-agent execution.

Before issue it MUST be:

```text
—
```

Once the task enters `In Progress`, it MUST contain a valid date.

`Issued` does not require the exact instant at which the invocation prompt was submitted.

### 12.4. Completed

For `Draft`, `Ready`, and `In Progress`, `Completed` MUST be:

```text
—
```

For `Completed`, it MUST contain a valid date.

For `Cancelled` and `Superseded`, it MAY contain the date on which the terminal state was finalized.

### 12.5. Agent

`Agent` identifies the coding agent selected to execute the task.

Before an agent is selected, the value MAY be:

```text
—
```

For `In Progress` and `Completed`, it MUST be populated.

### 12.6. Repository

`Repository` MUST be:

```text
PlanAxis
```

### 12.7. Description

`Description` MUST contain:

```text
`TASK-NNN-description.md`
```

with the matching task identifier.

### 12.8. Related tasks

`Related tasks` MAY contain:

- `—`;
- one task identifier;
- multiple comma-separated task identifiers.

### 12.9. Related ADRs

`Related ADRs` MAY contain:

- `—`;
- one ADR identifier;
- multiple comma-separated ADR identifiers.

### 12.10. Related specifications

`Related specifications` MAY contain:

- `—`;
- one specification reference;
- multiple specification references.

### 12.11. Implementation commits

`Implementation commits` records the Git commit or commits containing accepted implementation produced by the task.

Before accepted implementation commits exist, the value MUST be:

```text
—
```

For `Completed`, it MUST contain at least one Git commit identifier.

Multiple commit identifiers MUST be comma-separated.

The task-record finalization commit MUST NOT be included merely because it updates the record itself.

## 13. Date Format

All dates MUST use:

```text
YYYY-MM-DD
```

Example:

```text
2026-08-29
```

Time-of-day MUST NOT be included.

The em dash:

```text
—
```

MUST represent an intentionally unpopulated metadata value.

The following MUST NOT be used as substitutes:

```text
N/A
TBD
-
none
null
```

## 14. Task Status Model

### 14.1. Draft

The task is still being designed.

Requirements:

```text
Issued                 = —
Completed              = —
Implementation commits = —
```

The description MAY change.

### 14.2. Ready

The task definition is complete and ready for formal delegation, but has not yet been issued.

Requirements:

```text
Issued                 = —
Completed              = —
Implementation commits = —
```

The description SHOULD be treated as stable.

### 14.3. In Progress

The task has been formally authorized for coding-agent execution.

Requirements:

```text
Issued                 = populated
Completed              = —
Agent                   = populated
Implementation commits = —
Description            = immutable
```

The task MAY remain `In Progress` while agent output is being reviewed or corrected against the existing description.

### 14.4. Completed

The coding-agent work has finished, human review has accepted it, accepted implementation changes have been committed by a human maintainer, and the task record has been finalized.

Requirements:

```text
Issued                 = populated
Completed              = populated
Agent                   = populated
Implementation commits = one or more commit identifiers
Review Status           = Accepted OR Accepted with Changes
Description            = immutable
```

### 14.5. Cancelled

The task will not be completed and no direct replacement task is required.

A cancellation reason MUST be recorded.

If the task was previously issued, the description remains immutable.

### 14.6. Superseded

The task is no longer authoritative because another formal task replaces it.

The replacement task MUST be identified.

If the task was previously issued, the description remains immutable.

## 15. Allowed Status Transitions

Normal lifecycle:

```text
Draft
  ↓
Ready
  ↓
In Progress
  ↓
Completed
```

Allowed transitions:

```text
Draft       -> Ready
Draft       -> Cancelled
Draft       -> Superseded

Ready       -> Draft
Ready       -> In Progress
Ready       -> Cancelled
Ready       -> Superseded

In Progress -> Completed
In Progress -> Cancelled
In Progress -> Superseded
```

Terminal states MUST NOT return to active states.

If additional work is needed after a terminal state, a new task MUST be created.

## 16. Purpose Section

The `Purpose` section MUST briefly explain why the task exists.

It SHOULD describe the larger project objective and relevant historical context.

It MUST NOT contain execution requirements absent from the task description.

## 17. Description Section

The record's `Description` section MUST reference the sibling description file.

It SHOULD state that the description is authoritative.

The record MUST NOT duplicate the complete task description.

## 18. Execution Record

The `Execution Record` section MUST contain these subsections in this order:

```text
### Result
### Verification
### Deviations from Description
### Agent-Reported Follow-up Items
```

### 18.1. Result

`Result` MUST summarize what the coding agent actually changed.

Before execution results exist, it MAY contain:

```text
Pending.
```

### 18.2. Verification

`Verification` MUST record commands actually executed and their outcomes.

Preferred result labels:

```text
PASS
FAIL
NOT RUN
```

A step MUST NOT be marked `PASS` unless it actually completed successfully.

Before verification occurs, this subsection MAY contain:

```text
Pending.
```

### 18.3. Deviations from Description

Material differences between description and actual execution MUST be recorded here.

If there were none:

```text
None.
```

The issued description MUST NOT be rewritten to hide a deviation.

### 18.4. Agent-Reported Follow-up Items

Agent-identified future work MUST be recorded here.

If none:

```text
None.
```

A follow-up item is not a formal task until a new task identifier is assigned.

## 19. Human Review

The `Human Review` section MUST contain:

```text
### Review Status
### Review Notes
### Human Changes After Agent Execution
```

### 19.1. Review Status

Allowed values:

```text
Pending
Accepted
Accepted with Changes
Rejected
```

A task MUST NOT become `Completed` while review status is `Pending` or `Rejected`.

### 19.2. Review Notes

Important human observations SHOULD be recorded.

If none are needed:

```text
None.
```

### 19.3. Human Changes After Agent Execution

Material manual changes made after agent execution and before accepted implementation commit MUST be recorded.

If none:

```text
None.
```

## 20. Finalization

The `Finalization` section MUST contain:

```text
### Implementation Commits
### Commit Messages
### Supersession
```

### 20.1. Implementation Commits

For `Completed`, this subsection MUST list accepted implementation commit identifiers.

They MUST match the metadata field.

The finalization commit that only updates the task record MUST NOT be listed.

### 20.2. Commit Messages

For every implementation commit, the actual human-created commit message MUST be recorded.

It SHOULD follow Conventional Commits.

It SHOULD identify the task with:

```text
Task: TASK-NNN
```

when consistent with repository commit conventions.

### 20.3. Supersession

For `Superseded`:

```text
Superseded by: TASK-NNN
```

For all other statuses:

```text
—
```

## 21. Human Ownership of Task Artifacts

Task records and descriptions are human-controlled repository artifacts.

During formal delegated execution, coding agents MUST NOT modify:

```text
docs/tasks/
```

unless a future repository policy explicitly defines an exception.

The human maintainer is responsible for:

- creating task artifacts;
- changing lifecycle status;
- recording review;
- performing Git write operations;
- recording implementation commits;
- finalizing the record.

## 22. Git Commit Semantics

This specification distinguishes implementation commits from task-documentation commits.

### 22.1. Implementation commits

Implementation commits contain accepted implementation work resulting from the delegated task.

They MUST be recorded when the task becomes `Completed`.

### 22.2. Task-documentation commits

Commits that prepare, start, or finalize task records are task-documentation commits.

They MUST NOT be listed as implementation commits unless they also contain implementation changes, which SHOULD normally be avoided.

### 22.3. No self-referential finalization commit

A task record MUST NOT attempt to record the hash of the commit containing that same final record update.

Only implementation commits are required inside the record.

## 23. Cancelled Tasks

For `Cancelled`:

- a cancellation reason MUST be recorded;
- `Implementation commits` MAY remain `—`;
- `Completed` MAY contain the cancellation date;
- `Supersession` MUST be `—`.

If cancellation occurred after issue, the description remains immutable.

## 24. Superseded Tasks

For `Superseded`:

- `Supersession` MUST identify the replacement task;
- `Completed` MAY contain the supersession date;
- `Implementation commits` MAY remain `—`.

The replacement MUST receive a new task identifier.

## 25. Historical Integrity

Formal task artifacts MUST preserve development history.

Therefore:

- issued descriptions MUST NOT be rewritten;
- terminal records SHOULD NOT be rewritten merely to reflect later preferences;
- factual archival errors MAY be corrected;
- later implementation changes MUST NOT alter what an earlier task originally required;
- new units of delegated work MUST receive new task identifiers.

A future reader SHOULD be able to reconstruct what was delegated, when it was issued, which agent executed it, what changed, how it was verified, what deviated, what a human changed, and which implementation commits were accepted.

## 26. Conditional Metadata Requirements

### 26.1. Draft

```text
Status                 = Draft
Created                = populated
Issued                 = —
Completed              = —
Implementation commits = —
Description            = editable
```

### 26.2. Ready

```text
Status                 = Ready
Created                = populated
Issued                 = —
Completed              = —
Implementation commits = —
Description            = finalized for delegation
```

### 26.3. In Progress

```text
Status                 = In Progress
Created                = populated
Issued                 = populated
Completed              = —
Agent                   = populated
Implementation commits = —
Description            = immutable
```

### 26.4. Completed

```text
Status                 = Completed
Created                = populated
Issued                 = populated
Completed              = populated
Agent                   = populated
Implementation commits = one or more commit identifiers
Description            = immutable
Review Status           = Accepted OR Accepted with Changes
Supersession            = —
```

### 26.5. Cancelled

```text
Status              = Cancelled
Created             = populated
Cancellation reason = recorded
Supersession         = —
```

### 26.6. Superseded

```text
Status         = Superseded
Created        = populated
Supersession   = populated
```

## 27. Task Record Conformance

A task record conforms only if all applicable requirements are satisfied.

At minimum:

1. the identifier is valid and unique;
2. directory and filenames follow the naming rules;
3. record and description identifiers match;
4. record and description titles match;
5. required sections are present in order;
6. required metadata fields are present in order;
7. metadata values are valid for the current status;
8. dates use the required format;
9. description immutability is preserved after issue;
10. execution results are truthful;
11. verification results reflect commands actually executed;
12. deviations are recorded without rewriting history;
13. human review status is valid;
14. completed tasks contain at least one implementation commit;
15. implementation commit details are internally consistent;
16. superseded tasks identify their replacement;
17. terminal tasks do not return to active states;
18. historical integrity is preserved.

## 28. Conforming Example

A complete conforming example is maintained separately in:

```text
docs/tasks/TASK-RECORD-EXAMPLE.md
```

The example is informative in its task-specific content.

The structure and field semantics it demonstrates MUST conform to this specification.

If the example and this specification conflict, this specification is authoritative.
