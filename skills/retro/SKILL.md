---
name: retro
description: Run retrospective on completed plan - capture lessons and generate fix plan
---

# Retro

Run retrospective on a completed plan to capture lessons learned and generate fix plans.
Closes the feedback loop between code review and the planning system.

## When to Use

- After plan completion when you want to review the implementation
- When you have review findings from a previous conversation
- To capture lessons learned (pattern gaps, planning gaps, process improvements)
- To generate fix plans from actionable findings

## Critical Rules

1. **Start with plan selection** - Find or confirm which completed plan to retro
2. **Determine input mode** - Fresh review (spawn branch-reviewer) OR accept pasted findings
3. **Categorize findings** - Pattern gaps, planning gaps, process improvements, actionable fixes
4. **Generate linked artifacts** - Retro file + fix plan (if actionable items exist)
5. **Support iterations** - Auto-increment iteration number, link to previous retros
6. **Use AskUserQuestion** - For all user interactions after initial selection

## Arguments

The command accepts: `/retro [plan-name] [passes]`

- `plan-name` - Optional. Name of completed plan to review.
- `passes` - Optional. Number of review passes (default: 1). When > 1, runs multi-pass mode.

Examples:
```
/retro 3                    # 3 passes on most recent completed plan
/retro my-feature 3         # 3 passes on specific plan
/retro my-feature           # 1 pass (or paste mode)
/retro                      # Select plan, then 1 pass (or paste mode)
```

## Process

### Phase 0: Argument Parsing

Parse arguments to determine:
1. **plan-name**: First non-numeric argument, or none
2. **passes**: Numeric argument, or default to 1

Examples:
- `/retro 3` → plan-name=none, passes=3
- `/retro my-feature 3` → plan-name="my-feature", passes=3
- `/retro my-feature` → plan-name="my-feature", passes=1
- `/retro` → plan-name=none, passes=1

### Phase 0.5: Plan Selection

If plan-name provided:
- Look in `thoughts/shared/plans/done/` for matching plan
- If ambiguous, use AskUserQuestion to clarify

If no plan-name:
- List recent completed plans from `thoughts/shared/plans/done/`
- Use AskUserQuestion to let user select

### Phase 1: Determine Iteration Number

Check `thoughts/shared/retros/` for existing retros for this plan:
- Pattern: `YYYY-MM-DD-{topic}-retro-{n}.md`
- If none exist, iteration = 1
- If exist, iteration = max(n) + 1

### Phase 2: Input Mode Selection

**If passes > 1:** Skip this phase, go directly to Phase 3-Multi.

**If passes == 1:** Use AskUserQuestion:
```
AskUserQuestion(questions: [{
  question: "How do you want to provide review findings?",
  header: "Review mode",
  options: [
    { label: "Fresh review", description: "Spawn branch-reviewer to analyze the branch" },
    { label: "Paste findings", description: "Provide review findings from earlier conversation" }
  ],
  multiSelect: false
}])
```

### Phase 3-Multi: Multi-Pass Review Mode (when passes > 1)

Run multiple independent reviews sequentially and aggregate findings:

```
all_findings = {
  pattern_gaps: [],
  planning_gaps: [],
  process_improvements: [],
  actionable_fixes: []
}

for i in 1..passes:
  # Display progress
  print "Starting review pass {i}/{passes}..."

  # Spawn branch-reviewer (each gets fresh context via claude-cli)
  Task("branch-reviewer: Review the branch for plan {plan-name}.
  Pass {i} of {passes} - look for issues that might have been missed.")

  # Collect findings from this pass
  pass_findings = parse_branch_reviewer_output()

  # Merge into all_findings
  all_findings.pattern_gaps.extend(pass_findings.pattern_gaps)
  all_findings.planning_gaps.extend(pass_findings.planning_gaps)
  all_findings.process_improvements.extend(pass_findings.process_improvements)
  all_findings.actionable_fixes.extend(pass_findings.actionable_fixes)

  # Display pass summary
  print "Pass {i}/{passes} complete. Found {count} issues."

# Deduplicate findings
all_findings = deduplicate_findings(all_findings)

# Report aggregated stats
print "All {passes} passes complete."
print "Total unique findings: {count}"
print "  - Pattern gaps: {n}"
print "  - Planning gaps: {n}"
print "  - Process improvements: {n}"
print "  - Actionable fixes: {n}"

# Proceed to Phase 4 with aggregated findings
```

**Deduplication logic:**
- Same file:line + similar description → merge (keep most detailed)
- Similar description, different lines → keep both
- Completely different findings → keep all

### Phase 3A: Fresh Review Mode (single pass)

If user chose "Fresh review":
1. Spawn branch-reviewer skill using Task tool
2. Wait for structured findings
3. Proceed to Phase 4

### Phase 3B: Paste Mode (single pass)

If user chose "Paste findings":
1. Ask user to paste review findings
2. Parse findings into categories:
   - pattern_gaps[]
   - planning_gaps[]
   - process_improvements[]
   - actionable_fixes[]
3. Proceed to Phase 4

### Phase 4: Generate Retro File

Write to: `thoughts/shared/retros/YYYY-MM-DD-{topic}-retro-{n}.md`

```markdown
---
date: YYYY-MM-DD
original-plan: "../plans/done/YYYY-MM-DD-{topic}.md"
previous-retro: "./YYYY-MM-DD-{topic}-retro-{n-1}.md"  # only if n > 1
fix-plan: "../plans/pending/YYYY-MM-DD-{topic}-fixes-{n}.md"  # only if actionable fixes
iteration: {n}
review-passes: {passes}  # number of review passes performed
---

## Summary
Brief overview of this review iteration.
{If passes > 1: "Performed {passes} independent review passes with findings aggregated and deduplicated."}

## Pattern Gaps
Issues where PATTERNS.md was insufficient or wrong
- [finding]: [why it's a pattern gap]

## Planning Gaps
Things the original plan missed or got wrong
- [finding]: [what should have been planned]

## Process Improvements
How the workflow itself could be better
- [finding]: [suggested improvement]

## Actionable Fixes
Items that generated tasks in the fix plan
- [finding]: [task reference in fix plan]
```

### Phase 5: Generate Fix Plan (if actionable fixes exist)

If actionable_fixes is not empty, write to: `thoughts/shared/plans/pending/YYYY-MM-DD-{topic}-fixes-{n}.md`

```markdown
# {Topic} Fixes (Iteration {n})

<!-- EXECUTOR STATUS (auto-managed by /execute - do not edit) -->
| Field | Value |
|-------|-------|
| Status | `pending` |
| Started | - |
| Completed | - |
| Progress | 0/{N} tasks |
<!-- END EXECUTOR STATUS -->

**Goal:** Fix issues found in retro iteration {n} for {topic}

**Architecture:** Apply targeted fixes from code review findings
{If passes > 1: "**Review Method:** {passes}-pass multi-review (findings aggregated and deduplicated)"}

**Source Retro:** `thoughts/shared/retros/YYYY-MM-DD-{topic}-retro-{n}.md`
**Original Plan:** `thoughts/shared/plans/done/YYYY-MM-DD-{topic}.md`

---

## Task 1: [Fix description from actionable_fixes[0]]

**Files:**
- Modify: `{file from finding}`

**Step 1: Apply fix**
[Description of what to change]

**Step 2: Verify**
Run: `[appropriate test command]`
Expected: Tests pass

---

[Additional tasks from actionable_fixes...]
```

### Phase 6: Summary

Report to user:
- Retro file location
- Fix plan location (if generated)
- Iteration number
- Summary of findings by category
- Next steps (run /execute on fix plan if generated)

## Error Handling

| Scenario | Action |
|----------|--------|
| No completed plan found | List available plans in done/, ask user to specify |
| Plan name ambiguous | Show matching plans, use AskUserQuestion to pick |
| Fresh review fails | Save partial findings, offer retry or switch to paste mode |
| No actionable fixes | Generate retro file only, no fix plan |
| Paste parsing unclear | Ask user to clarify category for each finding |
| Multi-pass review fails mid-way | Save findings from completed passes, report partial results, offer to continue or stop |
| Rate limit during multi-pass | Pause, inform user, offer to continue after delay |

## Never Do

- Skip iteration detection - always check for existing retros
- Generate fix plan with no actionable items
- Forget to link artifacts (original plan, previous retro, fix plan)
- Use plain text questions after Phase 0 - always use AskUserQuestion
- Overwrite existing retro without confirming
