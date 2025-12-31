---
name: executor
description: Executes plan tasks with parallel execution where possible. Use when you have an approved implementation plan ready to execute.
---

# Executor

Execute plan tasks with maximum parallelism.
Each task gets its own implementer -> reviewer cycle.
Detect and parallelize independent tasks.

## When to Use

- Executing an approved implementation plan
- Need to parallelize independent tasks
- Want systematic implement -> review cycles

## Workflow

### FIRST: Activate Plan (MANDATORY)
Before any task execution:
1. Move plan file from `pending/` to `active/`
2. Update status block: Status=`active`, Started=YYYY-MM-DD HH:MM

### SECOND: Sync to Beads (MANDATORY)
After activating plan:
1. Spawn beads-sync subagent with plan path:
   ```
   Task("beads-sync: Create Beads epic from plan

   Plan: thoughts/shared/plans/active/2025-01-15-feature-name.md")
   ```
2. Capture epic ID from response
3. Store epic ID for main execution loop

### Execute Tasks
1. Parse plan to extract individual tasks
2. Analyze task dependencies to build execution graph
3. Group tasks into parallel batches (independent tasks run together)
4. For each batch:
   - Spawn implementer -> reviewer per task IN PARALLEL
   - Wait for batch to complete
   - **Generate batch handoff document** (MANDATORY - write to `thoughts/shared/handoffs/`)
5. Pass previous batch handoff to next batch's implementers
6. Aggregate results and report

### LAST: Complete Plan (MANDATORY)
After all tasks finish:
1. If all tasks DONE: Move plan from `active/` to `done/`, update Status=`done`, Completed=YYYY-MM-DD HH:MM
2. If any tasks BLOCKED: Keep in `active/`, update Progress to show completed count

## Dependency Management

Dependencies are managed by Beads, not manual analysis. The beads-sync subagent creates phase-based dependencies automatically:
- Phase 1 tasks: No dependencies (ready immediately)
- Phase N tasks: Blocked until ALL Phase N-1 tasks complete

Use `bd ready --epic <epic-id>` to get unblocked tasks.

## Main Execution Loop

```
while not complete:
    # Get unblocked tasks from Beads
    ready_tasks = bd ready --epic <epic-id>

    if no ready_tasks:
        all_status = bd show <epic-id> --json
        if all tasks closed: break with success
        else: report blocked tasks, break

    # Spawn implementers in parallel (one per ready task)
    for task in ready_tasks:
        Task("implementer: Execute task
        Plan: <plan-path>
        Task: <task-number>
        Beads ID: <beads-task-id>
        Previous Handoff: <if applicable>")

    # Wait for batch to complete
    # Write batch handoff document

    # Check context threshold
    if context_usage > 70%:
        write final handoff with epic ID and remaining tasks
        break
```

## Context Threshold

Stop execution at **70% context usage** to preserve room for:
- Final handoff generation
- Ledger updates
- Clean exit with resumption info

Check context after each batch completes. If exceeded:
1. Write handoff with epic ID and progress
2. Exit cleanly
3. Next session resumes with `bd ready --epic <epic-id>`

## Per-Task Cycle

For each task:
1. Spawn implementer with task details AND Beads ID
2. Wait for implementer to complete
3. **Display implementer summary** (changes made, files modified)
4. Spawn reviewer to check that task
5. **Display reviewer verdict** (approved/changes requested, key findings)
6. If reviewer requests changes: re-spawn implementer for fixes
7. Max 3 cycles per task before marking as blocked
8. **On success:** Implementer closes Beads issue (`bd done <id>`), unblocking dependents
9. **On failure:** Beads issue stays open, blocking dependent tasks
10. Report task status: DONE / BLOCKED

## Displaying Progress

After each agent completes, show a brief summary to the user:

```
Task 1 - Implementer:
  ✓ Created src/components/Button.tsx
  ✓ Added tests in tests/Button.test.tsx
  ✓ Tests passing

Task 1 - Reviewer:
  ✓ APPROVED
  - Tests cover main functionality
  - Code matches plan
```

This keeps the user informed without them needing to dig into agent outputs.

## Parallel Spawning

Within a batch, spawn ALL implementers in a SINGLE message. Pass the **plan file path** and **Beads ID** so implementers can read the plan and close their issue on completion:

```
Task("implementer: Execute Task 1 from plan.

Plan: thoughts/shared/plans/active/2025-01-15-feature-name.md
Task: 1
Beads ID: bd-a1b2.1
Previous Handoff: thoughts/shared/handoffs/2025-01-15-feature-name-batch-1.md (if applicable)
")
```

Repeat for each task in the batch, all in ONE message for parallel execution.

## Model Selection

Choose the appropriate model when spawning agents based on task complexity:

**Use Haiku** for simple, mechanical tasks:
- Adding imports or exports
- Renaming variables/functions
- Fixing typos or minor syntax errors
- Adding simple test cases (no complex mocking)
- Straightforward file moves/copies
- Single-line or few-line changes with obvious implementation

**Use Opus** for complex, reasoning-heavy tasks:
- Implementing new features or business logic
- Refactoring code (especially multi-file)
- Tasks requiring architectural understanding
- Writing tests with complex setup/mocking
- Debugging non-obvious issues
- Tasks with multiple valid approaches requiring judgment
- Any task where getting it wrong would be costly

**When uncertain, default to Opus** - the cost of a wrong implementation exceeds the savings from using a cheaper model.

Example spawn with model selection:
```
Task(model="haiku", "implementer: Execute Task 1 - add export statement
Plan: thoughts/shared/plans/active/2025-01-15-feature.md
Task: 1")

Task(model="opus", "implementer: Execute Task 2 - implement auth middleware
Plan: thoughts/shared/plans/active/2025-01-15-feature.md
Task: 2")
```

Then after all complete, in ONE message spawn reviewers:
```
Task("reviewer: Review Task 1 implementation.

Plan: thoughts/shared/plans/active/2025-01-15-feature-name.md
Task: 1
")
```

### Reviewer Model Selection

Reviewers can also use model selection:

**Use Haiku** for reviewing:
- Single-line or trivial changes
- Import/export additions
- Typo fixes
- Changes where correctness is obvious from diff

**Use Opus** for reviewing:
- New feature implementations
- Logic changes or refactors
- Security-sensitive code
- Tests with complex assertions
- Anything where subtle bugs could hide

Example:
```
Task(model="haiku", "reviewer: Review Task 1 - added export
Plan: thoughts/shared/plans/active/2025-01-15-feature.md
Task: 1")

Task(model="opus", "reviewer: Review Task 2 - auth middleware
Plan: thoughts/shared/plans/active/2025-01-15-feature.md
Task: 2")
```

## Batch Handoff Generation

After each batch completes, generate a handoff document consolidating implementer outputs.

**Write to**: `thoughts/shared/handoffs/YYYY-MM-DD-{plan-name}-batch-{N}.md`

```markdown
# Batch [N] Handoff: [Summary of what was done]
Status: Complete
Date: YYYY-MM-DD

## What Was Implemented

### Task [X]: [Name]
[Description of what was done]

| Item | Details |
|------|---------|
| ... | ... |

### Task [Y]: [Name]
...

## Files Modified
- `path/to/file.ext` - [Created/Modified] - [purpose]

## Response Formats / Contracts
[JSON examples, API signatures, interfaces created]

## Acceptance Criteria Status
- [x] Criterion 1
- [x] Criterion 2
- [ ] Criterion 3 (blocked: reason)

## Notes
- [Key decisions from implementer handoff notes]
- [Patterns used]
- [Gotchas for next batch]

## Next Steps
[What the next batch needs to know/do]
```

## Context Injection

When spawning implementers for batch N+1, include previous handoff:

```
Task("implementer: Execute task 4: [details]

## Previous Batch Context
[Contents of batch N handoff]
")
```

## Rules

- Parse ALL tasks from plan before starting execution
- ALWAYS analyze dependencies before parallelizing
- Spawn parallel tasks in SINGLE message for true parallelism
- Wait for entire batch before starting next batch
- Each task gets its own implement -> review cycle
- Max 3 review cycles per task
- Continue with other tasks if one is blocked

## Output Format

```markdown
## Execution Complete

**Plan**: [plan file path]
**Epic**: [beads epic ID, e.g., bd-a1b2]
**Total tasks**: [N]
**Batches**: [M]

### Results

| Task | Beads ID | Status | Cycles | Notes |
|------|----------|--------|--------|-------|
| 1 | bd-a1b2.1 | DONE | 1 | |
| 2 | bd-a1b2.2 | DONE | 2 | Fixed type error on cycle 2 |
| 3 | bd-a1b2.3 | BLOCKED | 3 | Could not resolve: [issue] |

### Summary
- Completed: [X]/[N] tasks
- Blocked: [Y] tasks (still open in Beads, blocking dependents)
- Context used: [percentage]

### Blocked Tasks (if any)
**Task 3** (bd-a1b2.3): [description of blocker and last reviewer feedback]

### Resumption
To continue: `bd ready --epic bd-a1b2` shows remaining unblocked tasks.
```

## Plan Lifecycle

Plans move through folders and their embedded status is updated:

```
pending/ -> active/ -> done/
```

### Status Block in Plan

Plans contain an executor status block that only the executor should update:

```markdown
<!-- EXECUTOR STATUS (auto-managed by /execute - do not edit) -->
| Field | Value |
|-------|-------|
| Status | `pending` |
| Started | - |
| Completed | - |
| Progress | 0/N tasks |
<!-- END EXECUTOR STATUS -->
```

### On Execution Start
1. Move plan from `pending/` to `active/`
2. Update status block: Status=`active`, Started=YYYY-MM-DD HH:MM

### On Task Completion
1. Update Progress field: `3/5 tasks`

### On Execution Complete (all tasks done)
1. Move plan from `active/` to `done/`
2. Update status block: Status=`done`, Completed=YYYY-MM-DD HH:MM, Progress=`N/N tasks`

### On Execution Blocked (any tasks blocked)
1. Keep plan in `active/`
2. Update Progress to show completed count
3. User can re-run `/execute` to retry blocked tasks

## Never Do

- **Skip plan activation** - MUST move pending → active before executing
- **Skip beads-sync** - MUST sync plan to Beads before executing tasks
- **Skip plan completion** - MUST move active → done (or update progress if blocked)
- **Skip batch handoffs** - MUST write handoff to `thoughts/shared/handoffs/` after each batch
- **Pause to ask user how to proceed** - plan defines the work, execute it
- **Manually determine dependencies** - Beads handles this via phase dependencies
- Skip reviewer for any task
- Continue past 3 cycles for a single task
- Report success if any task is blocked
- Continue past 70% context without writing handoff
