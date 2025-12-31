---
description: Save plan to thoughts folder and start executor
argument-hint: "[plan-file-path]"
---

# Approve Plan

Save a plan to `thoughts/shared/plans/pending/` and invoke the executor.

Use this command after reviewing a plan when you want:
1. The plan saved to the proper location
2. Execution via the executor (parallel batching, implement->review cycles)

## When to Use

- After plan mode exits and you've reviewed the plan
- When you have a plan file and want to execute it properly
- Instead of letting Claude implement directly

## Process

### Step 1: Locate the Plan

If a path is provided as argument, use that.

Otherwise, find the most recent plan:
1. Check if user just exited plan mode - look for the plan Claude wrote
2. Check `thoughts/shared/plans/pending/` for the most recent file
3. Ask user to specify if unclear

### Step 2: Save to Pending (if not already there)

If the plan is NOT already in `thoughts/shared/plans/pending/`:
1. Read the plan content
2. Generate filename: `YYYY-MM-DD-{topic-from-plan}.md`
3. Write to `thoughts/shared/plans/pending/{filename}`

If plan IS already in pending/, skip this step.

### Step 3: Run Executor

Invoke `/execute` with the plan file path.

## Output

```
Plan saved: thoughts/shared/plans/pending/2025-01-15-feature-name.md
Starting executor...
```

Then the executor takes over.

## Never Do

- Implement the plan directly - always use the executor
- Skip saving the plan to the pending folder
- Modify the plan content when saving
