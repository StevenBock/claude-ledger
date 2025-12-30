---
description: Execute a plan file with fresh context (use after /clear to save context)
---

# Run Plan

Execute an existing plan file. Use this after `/clear` to start execution with fresh context.

## Usage

After planning, if context is bloated:
1. Note the plan file path
2. Run `/clear`
3. Run `/run-plan` and select or provide the plan

## Process

### If plan path provided by user:
1. Read the specified plan file
2. Invoke `/execute` with the plan

### If no plan path provided:
1. Check `thoughts/shared/plans/` for available plans
2. If multiple plans exist, use `AskUserQuestion` to let user select one
3. If one plan exists, confirm with user before executing
4. If no plans exist, tell user to run `/planner` first
5. Read the selected plan and invoke `/execute`

## Example with selection

```
User: /run-plan
Assistant: Found 3 plans. Which would you like to execute?
[Uses AskUserQuestion with plan options]
User: [Selects plan]
Assistant: [Reads plan, invokes /execute]
```

## Example with direct path

```
User: /run-plan thoughts/shared/plans/2025-12-30-feature.md
Assistant: [Reads plan, invokes /execute]
```
