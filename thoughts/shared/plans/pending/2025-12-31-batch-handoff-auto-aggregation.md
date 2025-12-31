# Batch Handoff Auto-Aggregation

**Goal:** Eliminate executor token cost for batch handoff generation via hook-based aggregation.

## Current State

- Executor spawns parallel implementers → each writes task handoff to `thoughts/shared/handoffs/{plan}/task-{N}.md`
- Executor manually consolidates task handoffs → writes batch handoff to `thoughts/shared/handoffs/{plan}-batch-{N}.md`
- `batch-handoff-enforcer.ts` blocks batch N+1 until batch N handoff exists

**Problem:** Executor spends tokens reading/consolidating/writing batch handoffs.

## Solution Overview

```
Implementer writes task-{N}.md (with frontmatter)
    ↓
PostToolUse:Write triggers batch-handoff-aggregator hook
    ↓
Hook checks: all tasks in batch complete?
    ↓
If yes: aggregate → write batch-{N}.md automatically
    ↓
Enforcer allows next batch (file now exists)
```

## Phase 1: Enhanced Executor State

### Task 1: Update executor to record batch membership

**File:** `skills/executor/SKILL.md`

Before spawning each batch, executor must update `executor-state.json` with batch→tasks mapping:

```json
{
  "planName": "2025-01-15-feature",
  "currentBatch": 1,
  "batches": {
    "1": { "tasks": [1, 2, 3, 4], "expected": 4 },
    "2": { "tasks": [5, 6, 7], "expected": 3 }
  }
}
```

**Changes to executor/SKILL.md:**
- Add instruction to write batch info before spawning implementers
- Remove batch handoff generation section (lines 345-386)
- Remove "Generate batch handoff document" from execute loop (line 131)

## Phase 2: Task Handoff Frontmatter

### Task 2: Add structured frontmatter to task handoffs

**File:** `skills/implementer/SKILL.md`

Update task handoff template (lines 76-99) to include YAML frontmatter:

```markdown
---
task: 3
batch: 1
plan: 2025-01-15-feature
status: complete
timestamp: 2025-01-15T14:30:00Z
files_modified:
  - src/foo.ts
  - tests/foo.test.ts
---

# Task 3 Handoff: ...
```

**Changes:**
- Add batch number to implementer spawn prompt (executor provides this)
- Add frontmatter section before markdown content
- Add instruction to include batch number in frontmatter

## Phase 3: Aggregator Hook

### Task 3: Create batch-handoff-aggregator.ts

**File:** `hooks/src/batch-handoff-aggregator.ts`

PostToolUse hook on Write that:
1. Checks if written file matches `thoughts/shared/handoffs/{plan}/task-{N}.md`
2. Parses frontmatter to extract batch number
3. Loads executor state to get batch membership
4. Counts completed task handoffs for that batch
5. If count == expected: reads all task handoffs, generates batch handoff

```typescript
interface TaskHandoffMeta {
  task: number;
  batch: number;
  plan: string;
  status: string;
  files_modified: string[];
}

function aggregateBatchHandoff(
  planName: string,
  batchNum: number,
  taskHandoffs: TaskHandoffMeta[]
): string {
  // Generate consolidated markdown from task handoff data
}
```

### Task 4: Create shell wrapper

**File:** `hooks/batch-handoff-aggregator.sh`

```bash
#!/bin/bash
node "$(dirname "$0")/dist/batch-handoff-aggregator.mjs"
```

### Task 5: Register hook

**File:** `hooks/hooks.json`

Add entry under PostToolUse:
```json
{
  "type": "command",
  "command": "./hooks/batch-handoff-aggregator.sh",
  "match_tool_name": "Write"
}
```

## Phase 4: Update Executor Skill

### Task 6: Update executor to pass batch number

**File:** `skills/executor/SKILL.md`

Update implementer spawn examples to include `Batch: N`:
```
Task("implementer: Execute Task 1 from plan.
Plan: thoughts/shared/plans/active/2025-01-15-feature.md
Batch: 1
Task: 1
Beads ID: bd-a1b2.1")
```

### Task 7: Remove manual batch handoff generation

**File:** `skills/executor/SKILL.md`

- Delete lines 345-386 (Batch Handoff Generation section)
- Update line 131: change "Generate batch handoff document" to "Wait for hook to generate batch handoff"
- Remove line 498 about mandatory batch handoff writing

## Files to Modify

| File | Action |
|------|--------|
| `hooks/src/batch-handoff-aggregator.ts` | Create |
| `hooks/batch-handoff-aggregator.sh` | Create |
| `hooks/hooks.json` | Add hook entry |
| `skills/implementer/SKILL.md` | Add frontmatter to handoff format |
| `skills/executor/SKILL.md` | Pass batch number, remove manual handoff gen |

## Verification

1. Run executor on a multi-batch plan
2. Verify task handoffs include frontmatter
3. Verify batch handoffs auto-generated after batch completion
4. Verify enforcer still blocks correctly
5. Confirm executor no longer writes batch handoffs
