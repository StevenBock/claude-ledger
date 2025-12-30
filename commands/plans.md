---
description: List and execute plans from thoughts/shared/plans
---

# Plans

List available plans or execute one by number.

## Folder Structure

```
thoughts/shared/plans/
├── pending/   <- new plans waiting to be executed
├── active/    <- currently being executed
└── done/      <- completed plans
```

## Usage

- `/plans` - List pending plans (default)
- `/plans 2` - Execute plan #2 from pending
- `/plans active` - Show currently executing plan(s)
- `/plans done` - List completed plans
- `/plans all` - List all plans across all folders

## Process

### Listing Plans
1. Check appropriate subfolder based on argument:
   - Default/no arg: `pending/`
   - `active`: `active/`
   - `done`: `done/`
   - `all`: all subfolders
2. Parse date from filename prefix (YYYY-MM-DD)
3. Sort by date descending (newest first)
4. Number each plan for reference
5. Show filename, title, and status folder

### Executing a Plan
When user provides a number:
1. Map number to the corresponding plan from pending list
2. Read the plan file
3. Invoke `/execute` with the plan content

## Output Format (Listing)

```
Pending plans:

  1. feature-auth (today)
     "User Authentication Implementation Plan"

  2. refactor-api (today)
     "API Refactoring Plan"

Run `/plans <number>` to execute a plan
```

## Output Format (Executing)

```
Executing plan #2: refactor-api
[Invokes /execute with plan content]
```

## If No Pending Plans

```
No pending plans.

Run /planner to create one, or `/plans done` to see completed plans.
```
