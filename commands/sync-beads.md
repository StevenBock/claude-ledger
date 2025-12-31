---
description: Generate beads epic from an existing plan file
argument-hint: "[plan-file-path]"
---

# Sync Plan to Beads

Spawn a subagent to generate a beads epic with tasks and phase dependencies from an existing plan file.

If no path provided, use most recent plan from `thoughts/shared/plans/active/` or `pending/`.

**Important:** Use the Task tool (subagent_type: general-purpose) to run this skill. Do not process inline.

!`cat ${CLAUDE_PLUGIN_ROOT}/skills/beads-sync/SKILL.md`
