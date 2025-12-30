---
description: List available plans in thoughts/shared/plans (default: last 7 days)
---

# Plans

List available plans with filtering options.

## Arguments

- No args: Show plans from the last 7 days (default)
- `all`: Show all plans
- `N` (number): Show last N plans
- `today`: Show only today's plans
- `week`: Show last 7 days (same as default)
- `month`: Show last 30 days

## Process

1. Check `thoughts/shared/plans/` directory for `.md` files
2. Parse date from filename prefix (YYYY-MM-DD)
3. Apply filter based on argument
4. Sort by date descending (newest first)
5. For each plan, show:
   - Filename
   - Title (first # heading or **Goal:** line)
   - Age indicator (e.g., "today", "2 days ago")

## Output Format

```
Plans from last 7 days (3 found):

1. 2025-12-30-feature-auth.md (today)
   "User Authentication Implementation Plan"

2. 2025-12-30-refactor-api.md (today)
   "API Refactoring Plan"

3. 2025-12-28-new-dashboard.md (2 days ago)
   "Dashboard Feature Plan"

To execute a plan, run /run-plan or /execute
Tip: Use `/plans all` to see all plans, `/plans 5` for last 5
```

## If No Plans Match Filter

```
No plans from the last 7 days.

Older plans exist - run `/plans all` to see all plans.
Or run /planner to create a new plan.
```

## If No Plans Exist

```
No plans found in thoughts/shared/plans/

Run /planner to create a new plan.
```
