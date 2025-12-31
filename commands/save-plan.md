---
description: Save plan to thoughts folder without executing
argument-hint: "[plan-file-path]"
---

# Save Plan

Save a plan to `thoughts/shared/plans/pending/` without executing.

Use this when you want to save the plan for later execution.

## Process

### Step 1: Locate the Plan

If a path is provided as argument, use that.

Otherwise, find the most recent plan:
1. Check if user just exited plan mode - look for the plan Claude wrote
2. Ask user to specify if unclear

### Step 2: Save to Pending

1. Read the plan content
2. Generate filename: `YYYY-MM-DD-{topic-from-plan}.md`
3. Write to `thoughts/shared/plans/pending/{filename}`

## Output

```
Plan saved: thoughts/shared/plans/pending/2025-01-15-feature-name.md
```

## Never Do

- Start executing the plan - only save it
- Modify the plan content when saving
