# Agent Task Workflow

## 1. Purpose

This document defines how PlanAxis development work is performed when a human developer chooses between:

- human-owned development;
- fully delegated coding-agent execution.

Its purpose is to make AI-assisted development explicit, auditable, reproducible, and reviewable without forcing every development activity into the same process.

This document governs the **human workflow**.

Coding-agent behavior is governed by:

```text
AGENTS.md
```

Formal task record structure is governed by:

```text
docs/tasks/TASK-RECORD-SPECIFICATION.md
```

Task descriptions should be prepared using:

```text
docs/tasks/TASK-DESCRIPTION-TEMPLATE.md
```

## 2. Development Modes

Before implementation begins, the human developer MUST choose one of two development modes.

The choice MUST be made before repository implementation changes are started for the intended unit of work.

The two modes are:

```text
Mode A — Human-Owned Development
Mode B — Agent-Delegated Task Execution
```

These modes are intentionally different.

They define who owns implementation responsibility and whether the formal task workflow is required.

## 3. Mode A — Human-Owned Development

### 3.1. Definition

Mode A applies when a human developer owns the implementation.

The human developer may:

- write the code manually;
- use AI for discussion;
- ask AI for explanations;
- ask AI to review code;
- ask AI to generate isolated snippets;
- use AI-assisted completion;
- use AI for debugging ideas;
- use AI for test ideas;
- use other development tools as desired.

The defining property is:

> the human developer remains directly responsible for implementing and integrating the change.

### 3.2. AI use in Mode A

AI assistance in Mode A is considered part of the human developer's own implementation process.

Formal coding-agent task artifacts are not required merely because AI was used.

For example, the following MAY remain Mode A:

```text
human writes implementation
    +
AI suggests a helper function
    +
human reviews and integrates it
```

or:

```text
human owns the change
    +
AI reviews a diff
    +
human decides what to modify
```

### 3.3. Formal task workflow not required

Mode A does NOT require:

```text
docs/tasks/TASK-NNN-record.md
docs/tasks/TASK-NNN-description.md
```

The human developer follows the normal repository development rules instead.

### 3.4. Boundary

Mode A MUST NOT be used as a label for work that has actually been delegated as a complete autonomous repository modification task to a coding agent.

If the coding agent is instructed to independently inspect the repository, modify files, run checks, and complete a defined unit of implementation work, Mode B SHOULD be used.

## 4. Mode B — Agent-Delegated Task Execution

### 4.1. Definition

Mode B applies when a complete, explicitly scoped unit of implementation work is delegated to a coding agent.

The human developer remains responsible for:

- defining the task;
- preparing the task artifacts;
- establishing a clean and sufficiently current repository state;
- authorizing execution;
- reviewing the agent output;
- deciding whether the result is acceptable;
- making any necessary human corrections;
- staging;
- committing;
- pushing;
- finalizing the task record.

The coding agent is responsible for:

- reading the assigned task description;
- following `AGENTS.md`;
- implementing the task within scope;
- running required verification;
- reporting results;
- not performing prohibited Git operations;
- not modifying task artifacts.

### 4.2. Formal task required

Every Mode B unit of work MUST have:

```text
TASK-NNN-record.md
TASK-NNN-description.md
```

stored in its own task directory under:

```text
docs/tasks/
```

The task artifacts MUST conform to:

```text
docs/tasks/TASK-RECORD-SPECIFICATION.md
```

## 5. Development Mode Decision Point

Before implementation begins, the human developer MUST decide:

```text
A) I own this implementation.
```

or:

```text
B) I delegate this complete implementation task to a coding agent.
```

The decision determines the process that follows.

A task MUST NOT begin as informal Mode A implementation and later be retroactively presented as a Mode B delegated task.

Likewise, a Mode B task MUST NOT rely on unrecorded implementation requirements that were communicated only through private conversation.

If the ownership model changes materially before implementation begins, the developer MAY choose the other mode.

Once Mode B execution has been formally issued, the historical task artifacts MUST be preserved according to the task record specification.

## 6. Mode B Overview

The normal Mode B lifecycle is:

```text
1. Define scope
2. Prepare task record and description
3. Commit task preparation
4. Authorize task execution
5. Commit In Progress state
6. Refresh and verify repository state
7. Invoke coding agent
8. Agent performs initial-execution preflight
9. Agent implements and verifies
10. Human reviews result
10a. If needed, human explicitly requests review continuation
10b. Agent performs continuation preflight, diagnoses or corrects, and re-verifies
10c. Return to human review until accepted or terminated
11. Human creates implementation commit
12. Human finalizes task record
13. Human commits task finalization
```

The boundaries between these stages are deliberate.

Task preparation, task execution, implementation acceptance, and task finalization MUST remain distinguishable in Git history.

## 7. Step 1 — Define the Task Scope

Before creating task artifacts, the human developer MUST define a coherent unit of delegated work.

The scope SHOULD be:

- independently understandable;
- small enough to review coherently;
- large enough to produce meaningful progress;
- bounded by explicit out-of-scope items;
- compatible with existing architecture and specifications.

Examples of suitable task boundaries include:

```text
bootstrap the TypeScript monorepo
implement authoritative decimal geometry primitives
implement Apartment SVG XML parsing
validate wall geometry
```

Avoid tasks such as:

```text
implement the whole project
improve everything
refactor the architecture as needed
```

A task SHOULD have objective acceptance criteria before it reaches `Ready`.

## 8. Step 2 — Prepare Task Artifacts

The developer creates:

```text
docs/tasks/TASK-NNN-<short-title>/
├── TASK-NNN-record.md
└── TASK-NNN-description.md
```

The task record MUST initially have:

```text
Status = Ready
Issued = —
Completed = —
Implementation commits = —
```

unless the task is still being designed, in which case `Draft` MAY be used temporarily.

The task description MUST contain the complete authoritative requirements for coding-agent execution.

The description SHOULD be based on:

```text
docs/tasks/TASK-DESCRIPTION-TEMPLATE.md
```

The description MUST NOT depend on the task record for implementation requirements.

The description SHOULD explicitly reference:

```text
AGENTS.md
```

and any additional architecture, specification, development, or ADR documents relevant to the task.

## 9. Step 3 — Commit Task Preparation

Before agent execution is authorized, the human developer MUST commit the task record and task description.

The preparation commit creates a stable historical definition of what is about to be delegated.

The repository MUST return to a clean working state after this commit.

A suitable Conventional Commits pattern is:

```text
docs(tasks): prepare TASK-NNN <short description>
```

Example:

```text
docs(tasks): prepare TASK-001 monorepo bootstrap
```

The task description remains editable until issue, but substantive changes after the preparation commit SHOULD be handled deliberately and committed before execution authorization.

## 10. Step 4 — Authorize Task Execution

Immediately before delegation, the human developer changes the task record to:

```text
Status = In Progress
```

and populates:

```text
Issued = YYYY-MM-DD
Agent = <selected coding agent>
```

This transition means:

> the committed task description is now formally authorized for coding-agent execution.

From this point onward, the task description is immutable.

The human developer MUST NOT change the task description after issue.

If a material problem is discovered after issue, follow the cancellation or supersession rules rather than rewriting history.

## 11. Step 5 — Commit the In Progress State

The human developer MUST commit the `In Progress` record change before invoking the coding agent.

The repository MUST again be clean after this commit.

A suitable commit message is:

```text
docs(tasks): start TASK-NNN
```

Example:

```text
docs(tasks): start TASK-001
```

This commit forms a clear history boundary between:

```text
task preparation
```

and:

```text
task execution
```

## 12. Step 6 — Refresh and Verify Repository State

Before invoking the coding agent, the human developer is responsible for ensuring the repository is both:

```text
clean
```

and:

```text
sufficiently current
```

### 12.1. Working tree cleanliness

The repository MUST have:

- no staged changes;
- no unstaged changes;
- no untracked files;
- no deleted files;
- no renamed files awaiting commit.

The human developer MAY use any appropriate Git write operations to reach this state, including when necessary:

```text
git restore
git stash
git commit
git pull
git rebase
```

These operations remain human responsibilities.

### 12.2. Remote freshness

The human developer is responsible for determining whether the local repository is current relative to its remote.

The developer MAY use:

```text
git fetch
git pull
```

or other appropriate Git operations.

The coding agent MUST NOT be relied upon to establish remote freshness because repository policy prohibits it from running synchronization operations such as `git fetch`.

### 12.3. Final pre-invocation state

Immediately before the coding agent is invoked:

- the working tree MUST be clean;
- the index MUST be clean;
- the developer SHOULD have recently refreshed remote-tracking information;
- the developer SHOULD have resolved known ahead/behind/diverged conditions;
- no uncommitted task preparation changes may remain.

## 13. Step 7 — Invoke the Coding Agent

The invocation prompt SHOULD be intentionally short.

It SHOULD identify only:

- the task identifier;
- the exact task description path;
- the instruction to execute it.

Recommended pattern:

```text
Execute TASK-NNN. Read and follow
docs/tasks/TASK-NNN-<short-title>/TASK-NNN-description.md.
```

Example:

```text
Execute TASK-001. Read and follow
docs/tasks/TASK-001-bootstrap-typescript-monorepo/TASK-001-description.md.
```

The invocation prompt MUST NOT introduce implementation requirements that are absent from the task description or an authoritative repository document referenced by it.

The invocation prompt MUST NOT override the task description.

If an important requirement is missing, the task description MUST be corrected before issue or the task MUST be superseded after issue.

## 14. Step 8 — Coding-Agent Initial-Execution Preflight

Before the coding agent begins the first implementation pass, it MUST perform the **Initial Execution Preflight** defined by `AGENTS.md`.

The agent MUST verify working tree cleanliness using read-only Git operations.

A suitable command is:

```bash
git status --porcelain=v1 --untracked-files=all
```

The expected result is empty output.

The agent MUST also inspect the relationship between `HEAD` and the currently known upstream-tracking reference using read-only Git commands as required by `AGENTS.md`.

However:

> the agent MUST NOT claim that this proves remote freshness.

Without `git fetch`, the agent cannot know whether the remote repository changed after the human developer's last refresh.

### 14.1. Initial-execution preflight failure

If the agent detects:

- staged changes;
- unstaged changes;
- untracked files;
- deleted files;
- renamed files;
- a locally known ahead/behind/diverged condition that violates repository policy;

the agent MUST stop before making task changes.

The agent MUST report the problem to the user.

The agent MUST NOT attempt to repair repository state using:

```text
git stash
git reset
git restore
git checkout
git switch
git clean
git fetch
git pull
git merge
git rebase
```

or equivalent operations.

Repository cleanup belongs to the human developer.

### 14.2. Cleanliness is an initial execution boundary

The clean-working-tree requirement establishes the baseline from which the task begins.

It does **not** require the repository to become clean again between every agent interaction after implementation changes have been produced.

Once the first implementation pass creates uncommitted changes, those changes form the task working set that the human reviews.

Any later agent iteration over that same working set MUST use the review-continuation rules in `AGENTS.md` and Section 20 of this workflow.

## 15. Step 9 — Task Artifact Access Rules

During Mode B execution, the coding agent MAY read only the task description explicitly assigned by the invocation prompt from under:

```text
docs/tasks/
```

For example, when assigned:

```text
docs/tasks/TASK-001-bootstrap-typescript-monorepo/TASK-001-description.md
```

the agent MAY read that file.

The agent MUST NOT read:

```text
TASK-001-record.md
TASK-RECORD-SPECIFICATION.md
TASK-RECORD-EXAMPLE.md
TASK-DESCRIPTION-TEMPLATE.md
```

or any other task directory unless the repository policy is deliberately changed in the future.

The agent MUST NOT:

- enumerate `docs/tasks/`;
- browse other task directories;
- search across `docs/tasks/`;
- infer requirements from historical task records;
- inspect future or previous task descriptions.

The assigned description MAY reference normal repository documents outside `docs/tasks/`, and the agent MAY read those documents as required.

Examples include:

```text
AGENTS.md
docs/architecture/overview.md
docs/development/coding-guidelines.md
docs/development/testing.md
docs/decisions/
docs/specifications/
```

## 16. Task Artifacts Are Read-Only to Agents

A coding agent executing a formal task MUST NOT modify any file under:

```text
docs/tasks/
```

This includes:

- the assigned description;
- the task record;
- shared task specifications;
- shared task templates;
- examples;
- other task artifacts.

The human maintainer owns all task lifecycle documentation.

The agent MAY report information that the human later copies into the task record.

## 17. Step 10 — Agent Implementation

After successful initial-execution preflight, the coding agent may modify repository files required by the assigned task.

The agent MUST:

- stay within scope;
- follow `AGENTS.md`;
- follow the assigned task description;
- follow referenced specifications and accepted ADRs;
- add or update tests where required;
- avoid unrelated refactors;
- avoid speculative work;
- preserve repository architecture;
- run required verification;
- report deviations explicitly.

The agent MUST NOT perform Git write or synchronization operations.

## 18. Agent Completion Report

At the end of execution, the coding agent SHOULD provide the information required by the task description.

Normally this includes:

- implementation summary;
- files or areas changed;
- tests added or updated;
- verification commands and results;
- deviations from the description;
- follow-up items;
- suggested Conventional Commits message.

The agent's suggested commit message is advisory.

The human maintainer owns the final commit message.

An agent completion report does not itself end the task or make the current working tree immutable.

Until the human accepts the result and creates the implementation commit, the task MAY remain `In Progress` and MAY return to the agent through an explicit review-continuation cycle.

## 19. Step 11 — Human Review

After agent execution, the human maintainer MUST review the complete change set before committing it.

Review SHOULD include:

- `git status`;
- `git diff`;
- architecture compliance;
- specification compliance;
- package boundaries;
- tests;
- dependency changes;
- documentation changes;
- unintended modifications;
- agent-reported deviations;
- agent-reported follow-up items.

The human maintainer SHOULD rerun relevant verification where practical.

The developer SHOULD also perform practical manual or runtime checks that are meaningful for the task, even when automated verification passed. Examples include starting an application, exercising a health endpoint, inspecting generated output, or reproducing an integration path.

The developer MUST NOT commit agent output without meaningful human review.

If review discovers a defect, failed verification step, runtime failure, or other evidence that the current implementation does not satisfy the existing task description, the task SHOULD normally remain `In Progress`.

The human MAY then request an explicit review continuation before any implementation commit is created.

## 20. Review Continuation and Human Corrections

Human review is allowed to be iterative.

The expected review loop is:

```text
agent implementation
    ↓
human review
    ↓
accepted? ── yes → implementation commit
    │
    no
    ↓
explicit review-continuation request
    ↓
agent continuation preflight
    ↓
diagnosis / correction / verification
    ↓
human review
    ↺
```

The task remains `In Progress` throughout this loop.

### 20.1. Task working set

After the first agent implementation pass, the uncommitted repository changes under review form the **task working set**.

The task working set MAY contain:

- changes produced by the coding agent;
- later agent corrections;
- human review corrections;
- untracked files legitimately created by the task.

A dirty working tree is therefore expected during this phase.

The working tree MUST NOT be cleaned or prematurely committed merely to allow the coding agent to investigate or correct a review finding.

### 20.2. Explicit review continuation

The coding agent MUST NOT infer continuation mode solely from the presence of a dirty repository.

The human maintainer MUST explicitly state that the agent is continuing the same formal task on the current review working tree and MUST identify the same assigned task description.

Recommended pattern:

```text
Continue TASK-NNN on the current uncommitted review working tree.

Read and continue to follow
docs/tasks/TASK-NNN-<short-title>/TASK-NNN-description.md.

The human review found:
<failure, defect, or verification evidence>

Diagnose the issue. If it means the existing task requirements are not
satisfied, correct it within the existing task scope and rerun the
relevant verification. Do not introduce new scope.
```

Unlike the initial invocation prompt, a continuation prompt MAY contain concrete review evidence.

Examples include:

```text
the documented server-start command fails
a required endpoint does not respond
a test fails on the supported runtime
the built application behaves differently from the existing acceptance criteria
```

These statements describe observed conformance problems.

They do not modify the authoritative task description.

### 20.3. Review-continuation preflight

Before diagnosing or modifying the existing task working set, the agent MUST perform the **Review Continuation Preflight** defined by `AGENTS.md`.

In review continuation:

- unstaged changes are allowed;
- untracked task files are allowed;
- a dirty working tree is not itself a failure;
- staged changes remain a hard stop;
- modifications under `docs/tasks/` remain a hard stop;
- a locally known ahead/behind/diverged upstream relationship remains a hard stop;
- unrelated or ambiguous working-tree changes remain a hard stop.

The agent MAY inspect and run the current implementation, including commands required to reproduce a human-reported failure.

The agent MUST NOT use Git write operations to repair, clean, reset, or normalize the working tree.

### 20.4. Scope boundary

Review feedback MAY identify evidence that the current implementation does not satisfy the existing task.

That does not make the feedback a new requirement.

For example:

```text
the server does not start as required
the validator accepts input the task requires it to reject
the build fails on the required runtime
```

may be corrected within the same task when the correction follows directly from the existing description.

By contrast:

```text
add a new endpoint
support another file format
refactor an unrelated package
add a new feature while fixing the issue
```

is new scope unless already required by the issued description.

If the requested correction materially changes the issued task definition, the existing task SHOULD be cancelled or superseded, or a follow-up task SHOULD be created.

The issued description MUST NOT be rewritten.

### 20.5. Human corrections

The human maintainer MAY modify the agent output before accepting it.

Such changes remain part of the Mode B task result.

If the agent later continues the task, it MUST inspect the existing diff and MUST NOT assume that all current changes are agent-authored.

Material manual changes MUST later be recorded in:

```text
Human Changes After Agent Execution
```

inside the task record.

The task description MUST NOT be changed merely because human review required implementation corrections.

If review reveals that the original task definition itself is materially wrong, the developer SHOULD cancel or supersede the task instead of silently redefining it.

## 21. Step 12 — Create the Implementation Commit

After review and any necessary human correction, the human maintainer creates the implementation commit or commits.

Task artifacts under:

```text
docs/tasks/
```

SHOULD NOT be modified in the implementation commit.

This preserves the distinction between:

```text
implementation history
```

and:

```text
task administration history
```

Implementation commit messages SHOULD follow Conventional Commits.

They SHOULD include:

```text
Task: TASK-NNN
```

as a footer or body reference.

Example:

```text
chore(repo): bootstrap TypeScript monorepo

Set up the pnpm workspace, strict TypeScript configuration, application
and shared package skeletons, and repository verification tooling.

Task: TASK-001
```

## 22. Multiple Implementation Commits

One implementation commit is preferred when the task forms one coherent change.

Multiple implementation commits MAY be used when they improve reviewability or when the task naturally spans distinct accepted changes.

Every implementation commit associated with the completed task MUST later be recorded in the task record.

Task-documentation commits MUST NOT be recorded as implementation commits.

## 23. Step 13 — Finalize the Task Record

After accepted implementation commits exist, the human maintainer updates:

```text
TASK-NNN-record.md
```

The task record SHOULD now include:

- `Status = Completed`;
- `Completed = YYYY-MM-DD`;
- implementation commit hash or hashes;
- execution result;
- verification results;
- deviations from description;
- agent-reported follow-up items;
- human review status;
- review notes;
- human changes after agent execution;
- actual implementation commit message or messages.

For a successful task:

```text
Review Status = Accepted
```

or:

```text
Review Status = Accepted with Changes
```

The task description remains unchanged.

## 24. Step 14 — Commit Task Finalization

The final task-record update MUST be committed separately from the implementation commit whenever practical.

A suitable commit message is:

```text
docs(tasks): finalize TASK-NNN
```

Example:

```text
docs(tasks): finalize TASK-001
```

The finalization commit hash is not recorded inside the task record.

The Git history itself identifies that commit.

This avoids self-referential commit metadata.

## 25. Recommended Git History Shape

A normal completed Mode B task SHOULD produce history similar to:

```text
abc100  docs(tasks): prepare TASK-001 monorepo bootstrap
abc101  docs(tasks): start TASK-001
abc102  chore(repo): bootstrap TypeScript monorepo
abc103  docs(tasks): finalize TASK-001
```

This makes four distinct events visible:

```text
task defined
task authorized
implementation accepted
task finalized
```

The exact commit count MAY differ when justified.

The conceptual boundaries SHOULD remain clear.

## 26. Task Failure, Rejection, Cancellation, and Supersession

### 26.1. Agent cannot complete the task

If the coding agent cannot complete the task, the human developer reviews the result.

The task MAY remain `In Progress` if another attempt can be made without changing the authoritative description. If an existing uncommitted task working set remains under review, that attempt MAY use the review-continuation process.

### 26.2. Human review rejects the implementation

Review status MAY become:

```text
Rejected
```

The task MAY:

- remain `In Progress` for another execution attempt or review-continuation cycle;
- become `Cancelled`;
- become `Superseded`.

### 26.3. Task definition is wrong

If the issued description itself is materially wrong, the developer SHOULD NOT rewrite it.

The task SHOULD normally become:

```text
Superseded
```

and a new task should be created.

### 26.4. Task is no longer needed

If no replacement is necessary:

```text
Cancelled
```

is appropriate.

Terminal-state behavior MUST follow:

```text
docs/tasks/TASK-RECORD-SPECIFICATION.md
```

## 27. Follow-Up Work

A coding agent MAY identify follow-up work.

Such recommendations MUST NOT automatically become repository tasks.

A human developer decides whether a recommendation deserves a new formal task.

If so, the new work receives:

```text
a new TASK-NNN identifier
a new record
a new description
```

A completed task MUST NOT be expanded retroactively to absorb unrelated future work.

## 28. Remote Freshness and Agent Limitations

Working tree cleanliness and remote freshness are separate concepts.

### 28.1. Working tree cleanliness

The agent can inspect working tree state reliably using local read-only Git operations.

A completely clean working tree is mandatory for initial task execution.

During an explicitly authorized review continuation, a dirty working tree is expected because it contains the current uncommitted task working set.

Continuation safety is established by inspecting that working set, requiring an empty index, protecting `docs/tasks/`, rejecting unrelated or ambiguous changes, and preserving the locally known upstream relationship as defined by `AGENTS.md`.

### 28.2. Remote freshness

The agent cannot prove current remote freshness without network synchronization.

Because PlanAxis agents MUST NOT run:

```text
git fetch
git pull
```

remote freshness remains a human responsibility.

An agent MAY compare `HEAD` with the locally known upstream-tracking reference.

Such a comparison only proves consistency with locally available Git metadata.

It MUST NOT be presented as proof that no newer remote commits exist.

## 29. Why Task Preparation Must Be Committed Before Execution

A Mode B task description MUST NOT exist only as an uncommitted file when agent execution begins.

If task preparation remained uncommitted:

- initial-execution preflight would fail;
- the agent would start from a dirty repository without an established task working-set boundary;
- the historical task definition would not be stable;
- later review could not prove exactly what was delegated.

Therefore:

> task preparation MUST be committed before task execution is authorized.

## 30. Why In Progress Is a Separate Commit

The `Ready -> In Progress` transition represents a meaningful human authorization event.

It means:

```text
this exact committed description is now approved for agent execution
```

Recording it separately provides a clear boundary between task design and task execution.

It also preserves clean-repository preconditions for the agent.

## 31. Why Task Finalization Is a Separate Commit

The implementation commit records the accepted product change.

The finalization commit records what happened during the delegated process.

Keeping them separate prevents task bookkeeping from being mixed into implementation history and avoids self-referential commit metadata.

## 32. Invocation Prompt Discipline

The invocation prompt SHOULD remain minimal.

A short invocation reduces the risk that:

- requirements exist only in chat;
- the agent receives undocumented scope;
- chat instructions conflict with the committed description;
- later historical review cannot reconstruct the delegated task.

A good invocation prompt points to the authoritative description and does not redefine it.

Recommended:

```text
Execute TASK-001. Read and follow
docs/tasks/TASK-001-bootstrap-typescript-monorepo/TASK-001-description.md.
```

Discouraged:

```text
Read TASK-001, but also make sure you change X, skip Y, use package Z,
and while you are there refactor the parser too.
```

If such requirements matter, they belong in the task description before issue.

### Review-continuation prompts

A review-continuation prompt is different from the initial invocation prompt because the human may need to report evidence discovered during review.

It SHOULD still identify the same task and the same authoritative description.

It MAY describe observed failures, diagnostics, or review findings that indicate the existing implementation may not satisfy the issued task.

It MUST NOT introduce new implementation requirements.

Recommended:

```text
Continue TASK-001 on the current uncommitted review working tree.

Read and continue to follow
docs/tasks/TASK-001-bootstrap-typescript-monorepo/TASK-001-description.md.

The human review found that the documented server-start command fails.
Diagnose the failure and, if TASK-001 is not satisfied, correct it within
the existing scope and rerun the relevant verification. Do not introduce
new scope.
```

The distinction is:

```text
review evidence
    = information about whether the existing task was implemented correctly

new requirement
    = a change to what the task is supposed to implement
```

Only the first belongs in a continuation prompt.

## 33. Responsibility Summary

### Human developer

Responsible for:

- choosing Mode A or Mode B;
- task scope;
- task artifacts;
- repository freshness;
- repository cleanliness before initial invocation;
- execution authorization;
- explicitly authorizing review continuation when needed;
- identifying review findings without silently changing task scope;
- human review;
- manual corrections;
- Git write operations;
- implementation commits;
- finalization.

### Coding agent

Responsible for:

- initial-execution preflight;
- review-continuation preflight when explicitly authorized;
- reading the assigned description;
- inspecting the current task working set during continuation;
- following repository instructions;
- implementation and in-scope review corrections;
- tests;
- verification;
- execution reporting;
- remaining within scope.

### Coding agent is not responsible for

- task lifecycle changes;
- modifying task artifacts;
- staging;
- committing;
- pushing;
- pulling;
- fetching;
- cleaning a dirty repository;
- deciding on its own that a dirty repository represents a valid review continuation;
- proving remote freshness.

## 34. Process Integrity

The Mode B process is designed to preserve five guarantees:

### 34.1. Stable input

The exact delegated task is committed before execution.

### 34.2. Clean initial execution boundary

The agent begins the first implementation pass only from a clean repository prepared by the human maintainer.

### 34.3. Controlled review continuation

After implementation begins, the uncommitted task working set may remain dirty during human review and agent correction cycles.

Continuation is explicit, remains bound to the same immutable task description, protects Git history and task artifacts, and does not permit unrelated scope.

### 34.4. Human-controlled history

No agent creates or rewrites Git history.

### 34.5. Auditable result

The final task record connects:

```text
task definition
agent execution
review-continuation iterations
verification
human review
implementation commits
```

without rewriting historical instructions.

## 35. Summary

Use Mode A when the human developer owns the implementation.

Use Mode B when a complete implementation task is formally delegated to a coding agent.

For Mode B:

```text
define
    ↓
document
    ↓
commit preparation
    ↓
authorize
    ↓
commit In Progress
    ↓
refresh and verify repository
    ↓
invoke agent
    ↓
initial-execution preflight
    ↓
agent implementation
    ↓
human review
    ↕
explicit review continuation when needed
    ↕
continuation preflight + diagnosis/correction/re-verification
    ↓
human acceptance
    ↓
implementation commit
    ↓
record finalization
    ↓
finalization commit
```

This workflow intentionally keeps task definition, clean initial execution, iterative review correction, human acceptance, and Git history under clear and separate responsibility boundaries.
