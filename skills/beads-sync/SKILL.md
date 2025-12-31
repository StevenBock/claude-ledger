---
name: beads-sync
description: Converts plan file to Beads dependency graph. Spawned by executor at plan execution start.
---

# Beads Sync

Parse plan markdown and create Beads epic with tasks and phase dependencies.

## When to Use

- Called by executor at plan execution start
- Converts plan phases/tasks into Beads issues
- Sets up phase-based dependencies automatically

## Input

Plan file path (e.g., `thoughts/shared/plans/active/2025-01-15-feature.md`)

## Process

### Step 1: Read and Parse Plan

1. Read the plan file
2. Extract plan title from first H1 heading (`# Title`)
3. Find all task sections (H2 headings starting with `## Task` or `## Phase`)
4. For each task, extract:
   - Task name from heading
   - Phase number (from `Phase N:` or sequential order)
   - Description (content under heading until next H2)

### Step 2: Create Beads Epic

```bash
bd new "Plan Title" --type epic
```

Capture the epic ID from output (e.g., `bd-a1b2`).

### Step 3: Create Child Tasks

For each task in the plan:

```bash
bd new "Task Name" --parent <epic-id> --body "Implementation details from plan..."
```

Track: `{task_number: beads_id, phase: N}`

### Step 4: Add Phase Dependencies

All Phase N tasks depend on ALL Phase N-1 tasks completing:

```bash
# For each Phase 2 task, add dependency on each Phase 1 task
bd dep add <phase2-task-id> <phase1-task-id>
```

Example for 3-phase plan:
- Phase 1: Tasks A, B (no deps)
- Phase 2: Tasks C, D (each depends on A AND B)
- Phase 3: Task E (depends on C AND D)

### Step 5: Return Summary

Report epic ID and structure to executor.

## Plan Parsing Rules

| Markdown | Interpretation |
|----------|----------------|
| `# Title` | Epic name |
| `## Phase 1: Setup` | Phase 1 task named "Setup" |
| `## Task 1: Create X` | Task 1 (phase inferred from order) |
| `## Task 2.1: Subtask` | Task in Phase 2 |
| Content under H2 | Task description/body |

### Phase Detection

1. **Explicit**: `## Phase N:` or `## Task N.M:` (N = phase, M = task within phase)
2. **Section headers**: `## Phase 1` followed by `### Task:` subsections
3. **Implicit**: Sequential tasks without phase markers = Phase 1

### Handling Large Plans

For plans with many tasks:
- Process in chunks to avoid command timeouts
- Report progress: "Created 10/50 tasks..."
- Continue on individual task creation failure (report at end)

## Output Format

```markdown
## Beads Sync Complete

**Epic:** bd-a1b2
**Plan:** thoughts/shared/plans/active/2025-01-15-feature.md
**Tasks:** 12 total

| Phase | Tasks | Dependencies |
|-------|-------|--------------|
| 1     | 3     | None (ready) |
| 2     | 5     | Blocked by Phase 1 |
| 3     | 4     | Blocked by Phase 2 |

### Task Mapping

| Plan Task | Beads ID | Phase |
|-----------|----------|-------|
| Task 1    | bd-a1b2.1 | 1 |
| Task 2    | bd-a1b2.2 | 1 |
| Task 3    | bd-a1b2.3 | 1 |
| Task 4    | bd-a1b2.4 | 2 |
| ...       | ...       | ... |

Ready for execution. Use `bd ready --epic bd-a1b2` to get unblocked tasks.
```

## Error Handling

### Plan Parsing Errors

```markdown
## Beads Sync Failed

**Error:** Could not parse plan structure
**Details:** No task headings found (expected ## Task or ## Phase)
**File:** thoughts/shared/plans/active/2025-01-15-feature.md

Please ensure plan follows expected format with H2 task headings.
```

### Beads Command Errors

```markdown
## Beads Sync Failed

**Error:** bd command failed
**Command:** bd new "Task 1" --parent bd-a1b2
**Output:** [error message]

Check that beads is installed and .beads/ is initialized.
```

### Partial Success

If some tasks created but others fail:
- Report what was created
- Report what failed
- Include epic ID so executor can decide to proceed or abort

## Never Do

- Modify the plan file
- Execute any plan tasks
- Create dependencies within same phase (same-phase tasks are parallel)
- Continue silently on critical errors (epic creation failure)
- Skip dependency creation (breaks phase ordering)
