---
description: Execute a plan file with fresh context (use after /clear to save context)
---

# Run Plan

Execute an existing plan file. Use this after `/clear` to start execution with fresh context.

## Usage

After planning, if context is bloated:
1. Note the plan file path
2. Run `/clear`
3. Run `/run-plan` and provide the plan file path

## Process

1. Ask user for the plan file path (e.g., `thoughts/shared/plans/2025-01-15-feature.md`)
2. Read the plan file
3. Invoke `/execute` with the plan

## What This Command Does

- Reads the specified plan file
- Passes it to the executor for parallel task batching
- Implementer/reviewer cycles handle the actual work

## Example

```
User: /run-plan
Assistant: What plan file should I execute?
User: thoughts/shared/plans/2025-12-30-plugin-cards.md
Assistant: [Reads plan, invokes /execute]
```
