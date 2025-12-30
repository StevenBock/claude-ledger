---
description: List all available plans in thoughts/shared/plans
---

# Plans

List all available plans for review or selection.

## Process

1. Check `thoughts/shared/plans/` directory for `.md` files
2. For each plan, show:
   - Filename
   - Title (first # heading or **Goal:** line)
3. Display as a simple list for reference

## Output Format

```
Available plans in thoughts/shared/plans/:

1. 2025-12-30-feature-auth.md
   "User Authentication Implementation Plan"

2. 2025-12-30-refactor-api.md
   "API Refactoring Plan"

3. 2025-12-29-new-dashboard.md
   "Dashboard Feature Plan"

To execute a plan, run /run-plan or /execute
```

## If No Plans Exist

```
No plans found in thoughts/shared/plans/

Run /planner to create a new plan.
```
