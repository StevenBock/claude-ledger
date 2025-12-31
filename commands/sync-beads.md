---
description: Generate beads epic from an existing plan file
argument-hint: "[plan-file-path]"
---

# Sync Plan to Beads

Generate a beads epic with tasks and phase dependencies from an existing plan file.

## Arguments

- **plan-file-path** (optional): Path to the plan file. If omitted, uses the most recent plan from `thoughts/shared/plans/active/` or `thoughts/shared/plans/pending/`.

## Process

!`cat ${CLAUDE_PLUGIN_ROOT}/skills/beads-sync/SKILL.md`
