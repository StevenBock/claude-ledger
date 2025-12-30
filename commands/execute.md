---
description: Execute an implementation plan with parallel task batching
---

# Executor

Execute plan tasks with maximum parallelism.
Each task gets its own implementer -> reviewer cycle.
Detect and parallelize independent tasks.

## When to Use

- Executing an approved implementation plan
- Need to parallelize independent tasks
- Want systematic implement -> review cycles

## Plan Selection

If no plan is provided in context:
- Tell user to run `/plans` to see available plans and select one
- Or run `/planner` to create a new plan

## Workflow

1. Parse plan to extract individual tasks
2. Analyze task dependencies to build execution graph
3. Group tasks into parallel batches (independent tasks run together)
4. For each batch:
   - Spawn implementer -> reviewer per task IN PARALLEL
   - Wait for batch to complete
   - Generate batch handoff document
5. Pass previous batch handoff to next batch's implementers
6. Aggregate results and report

## Dependency Analysis

Tasks are INDEPENDENT (can parallelize) when:
- They modify different files
- They don't depend on each other's output
- They don't share state

Tasks are DEPENDENT (must be sequential) when:
- Task B modifies a file that Task A creates
- Task B imports/uses something Task A defines
- Task B's test relies on Task A's implementation
- Plan explicitly states ordering

When uncertain, assume DEPENDENT (safer).

## Execution Pattern

```
Plan with 6 tasks:
├── Batch 1 (parallel): Tasks 1, 2, 3 -> independent, different files
│   ├── Task("implementer: task 1")
│   ├── Task("implementer: task 2")
│   └── Task("implementer: task 3")
│   [wait for all]
│   ├── Task("reviewer: task 1")
│   ├── Task("reviewer: task 2")
│   └── Task("reviewer: task 3")
│   [wait for all]
│   └── Generate Batch 1 Handoff
│
└── Batch 2 (parallel): Tasks 4, 5, 6 -> depend on batch 1
    ├── [inject Batch 1 Handoff into implementer prompts]
    └── [same pattern]
```

## Per-Task Cycle

For each task:
1. Spawn implementer with task details
2. Wait for implementer to complete
3. Spawn reviewer to check that task
4. If reviewer requests changes: re-spawn implementer for fixes
5. Max 3 cycles per task before marking as blocked
6. Report task status: DONE / BLOCKED

## Parallel Spawning

Within a batch, spawn ALL implementers in a SINGLE message:

```
Task("implementer: Execute task 1: [details]")
Task("implementer: Execute task 2: [details]")
Task("implementer: Execute task 3: [details]")
```

Then after all complete, in ONE message spawn:
```
Task("reviewer: Review task 1 implementation")
Task("reviewer: Review task 2 implementation")
Task("reviewer: Review task 3 implementation")
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
**Total tasks**: [N]
**Batches**: [M] (based on dependency analysis)

### Dependency Analysis
- Batch 1 (parallel): Tasks 1, 2, 3 - independent, no shared files
- Batch 2 (parallel): Tasks 4, 5 - depend on batch 1
- Batch 3 (sequential): Task 6 - depends on task 5 specifically

### Results

| Task | Status | Cycles | Notes |
|------|--------|--------|-------|
| 1 | DONE | 1 | |
| 2 | DONE | 2 | Fixed type error on cycle 2 |
| 3 | BLOCKED | 3 | Could not resolve: [issue] |

### Summary
- Completed: [X]/[N] tasks
- Blocked: [Y] tasks need human intervention

### Blocked Tasks (if any)
**Task 3**: [description of blocker and last reviewer feedback]

**Next**: [Ready to commit / Needs human decision on blocked tasks]
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

- Skip dependency analysis
- Spawn dependent tasks in parallel
- Skip reviewer for any task
- Continue past 3 cycles for a single task
- Report success if any task is blocked
