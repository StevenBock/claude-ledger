---
description: List and execute plans from thoughts/shared/plans
---

# Plans

List available plans or execute one by number.

## Usage

- `/plans` - List recent plans (last 7 days) with numbers
- `/plans 2` - Execute plan #2 from the list
- `/plans all` - List all plans
- `/plans today` - List only today's plans
- `/plans month` - List last 30 days

## Process

### Listing Plans
1. Check `thoughts/shared/plans/` directory for `.md` files
2. Parse date from filename prefix (YYYY-MM-DD)
3. Apply filter (default: last 7 days)
4. Sort by date descending (newest first)
5. Number each plan for reference
6. Show filename, title, and age

### Executing a Plan
When user provides a number:
1. Map number to the corresponding plan from the filtered list
2. Read the plan file
3. Invoke `/execute` with the plan content

## Output Format (Listing)

```
Plans (last 7 days):

  1. feature-auth (today)
     "User Authentication Implementation Plan"

  2. refactor-api (today)
     "API Refactoring Plan"

  3. new-dashboard (2 days ago)
     "Dashboard Feature Plan"

Run `/plans <number>` to execute a plan
```

## Output Format (Executing)

```
Executing plan #2: refactor-api
[Invokes /execute with plan content]
```

## If No Plans Match Filter

```
No plans from the last 7 days.

Run `/plans all` to see older plans, or /planner to create one.
```

## If No Plans Exist

```
No plans found. Run /planner to create one.
```
