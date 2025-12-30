---
description: List and execute plans from thoughts/shared/plans
---

# Plans

List available plans or execute one by number.

**IMPORTANT**: Plan numbers refer to files in `thoughts/shared/plans/` folders, NOT beads/bd issues. Do NOT use the `bd` command. Read plan files directly from the filesystem.

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
1. Use Glob tool to find `.md` files in appropriate subfolder:
   - Default/no arg: `thoughts/shared/plans/pending/*.md`
   - `active`: `thoughts/shared/plans/active/*.md`
   - `done`: `thoughts/shared/plans/done/*.md`
   - `all`: `thoughts/shared/plans/**/*.md`
2. Parse date from filename prefix (YYYY-MM-DD)
3. Sort by date descending (newest first)
4. Number each plan (1, 2, 3...) for reference
5. Show filename, title, and status folder

### Executing a Plan
When user provides a number (e.g., `/plans 2`):
1. First list plans from `thoughts/shared/plans/pending/` using Glob
2. Sort by date descending and number them (1, 2, 3...)
3. Map the user's number to the corresponding filename
4. Use Read tool to read that plan file
5. Invoke `/execute` with the plan content

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
