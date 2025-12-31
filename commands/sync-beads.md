---
description: Generate beads epic from an existing plan file
argument-hint: "[plan-file-path]"
---

# Sync Plan to Beads

Generate a beads epic with tasks and phase dependencies from an existing plan file.

## Arguments

- **plan-file-path** (optional): Path to the plan file. If omitted, uses the most recent plan from `thoughts/shared/plans/active/` or `thoughts/shared/plans/pending/`.

## Process

### Step 1: Locate the Plan

If a path is provided as argument, use that.

Otherwise, find the most recent plan:
1. Check `thoughts/shared/plans/active/` for the most recent file
2. Check `thoughts/shared/plans/pending/` for the most recent file
3. Ask user to specify if unclear

### Step 2: Spawn beads-sync Subagent

Use the Task tool to spawn a subagent:

```
Task tool parameters:
- subagent_type: "general-purpose"
- description: "Sync plan to beads epic"
- prompt: |
    You are the beads-sync agent. Your job is to convert a plan file into a Beads epic.

    Plan file: {plan-file-path}

    !`cat ${CLAUDE_PLUGIN_ROOT}/skills/beads-sync/SKILL.md`
```

### Step 3: Report Results

After the subagent completes, report:
- Epic ID created
- Number of tasks synced
- Phase structure

## Never Do

- Process the beads-sync inline (always use subagent to preserve context)
- Modify the plan file
