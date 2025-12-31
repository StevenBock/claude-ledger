---
date: 2025-12-31
topic: "Retrospective Workflow for Review-to-Fix Loop"
status: validated
---

## Problem Statement

After a plan completes and moves to done/, there's no structured way to:
1. Run post-completion code reviews
2. Capture lessons learned (pattern gaps, planning gaps, process improvements)
3. Generate fix plans from review findings
4. Track iterative review cycles

Currently, review findings exist only in conversation context and are lost on compaction. There's no feedback loop from code review back into the planning system.

## Constraints

- `/review` is a built-in Claude Code command - cannot use that name
- Reviews often require multiple iterations with fresh context windows
- Fixes from one review can introduce new problems requiring subsequent reviews
- Must integrate with existing plan lifecycle (pending → active → done)
- Must support both fresh reviews (spawn subagents) and accepting existing review findings

## Approach

New `/retro` command invoking a `retro` skill that:
1. Accepts fresh review OR existing findings
2. Categorizes findings into pattern gaps, planning gaps, process improvements, actionable fixes
3. Generates linked artifacts: retro file (lessons) + fix plan (actionable items)
4. Supports iterative retros with automatic iteration numbering and linking

## Architecture

```
Plan completes (done/)
        ↓
   /retro [plan-name]
        ↓
   ┌─────────────────┐
   │   retro skill   │
   └────────┬────────┘
            │
   ┌────────┴────────┐
   │ Fresh review?   │
   └────────┬────────┘
      Yes   │   No (accept paste)
        ↓   ↓
   ┌─────────────────┐
   │ Spawn reviewers │ ←── branch-reviewer, pattern-checker, etc.
   └────────┬────────┘
            ↓
   ┌─────────────────┐
   │ Categorize      │
   │ findings        │
   └────────┬────────┘
            ↓
   ┌────────┴────────┐
   │                 │
   ↓                 ↓
retro.md        fixes-plan.md
(lessons)       (pending/)
```

## Components

### 1. `/retro` Command (`commands/retro.md`)
- Accepts optional `[plan-name]` argument to specify which completed plan
- Invokes the `retro` skill
- If no plan specified, lists recent completed plans to choose from

### 2. `retro` Skill (`skills/retro/SKILL.md`)
**Responsibilities:**
- Determine input mode (fresh review vs accept existing)
- Spawn branch review subagents if fresh
- Parse/accept review findings
- Categorize findings into: pattern gaps, planning gaps, process improvements, actionable fixes
- Generate retro file with iteration number
- Auto-generate fix plan from actionable items
- Link artifacts (original plan ← retro → fix plan; previous retros)

### 3. `branch-reviewer` Skill (new)
**Responsibilities:**
- Review entire branch diff (not just per-task)
- Focus on: correctness, completeness, style, security, patterns
- Can spawn sub-reviewers for specific concerns (security, performance, etc.)
- Return structured findings

### 4. Artifact Structures

**Retro File:** `thoughts/shared/retros/YYYY-MM-DD-{topic}-retro-{n}.md`
```markdown
---
date: YYYY-MM-DD
original-plan: "../plans/done/YYYY-MM-DD-{topic}.md"
previous-retro: "./YYYY-MM-DD-{topic}-retro-{n-1}.md"  # if n > 1
fix-plan: "../plans/pending/YYYY-MM-DD-{topic}-fixes-{n}.md"
iteration: n
---

## Summary
Brief overview of this review iteration

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

**Fix Plan:** `thoughts/shared/plans/pending/YYYY-MM-DD-{topic}-fixes-{n}.md`
```markdown
---
date: YYYY-MM-DD
source-retro: "../retros/YYYY-MM-DD-{topic}-retro-{n}.md"
original-plan: "./done/YYYY-MM-DD-{topic}.md"
---

## Overview
Fixes generated from retro iteration {n}

## Tasks

### Task 1: [Fix description]
- Source finding: [from retro]
- Files: [affected files]
- Approach: [how to fix]

### Task 2: ...
```

## Data Flow

### Fresh Review Mode
1. User runs `/retro auth-feature`
2. Retro skill finds completed plan in done/
3. Detects iteration number (checks existing retros)
4. Asks: fresh review or paste?
5. User chooses "fresh"
6. Spawn branch-reviewer (which may spawn sub-reviewers in parallel)
7. Receive structured findings
8. Categorize into pattern_gaps[], planning_gaps[], process_improvements[], actionable_fixes[]
9. Generate retro-n.md (lessons) and fixes-n.md (pending plan)

### Accept Existing Mode
1. User runs `/retro auth-feature`
2. Retro skill asks: fresh review or paste?
3. User chooses "paste"
4. User pastes review findings from earlier conversation
5. Parse and categorize findings
6. Generate artifacts (same as fresh mode)

### Iteration Chain
```
original-plan.md (done/)
       │
       ├──→ retro-1.md ──→ fixes-1.md (pending/)
       │         │
       │         ↓ (after fixes applied)
       │
       ├──→ retro-2.md ──→ fixes-2.md (pending/)
       │         │
       │         ↓ (after fixes applied)
       │
       └──→ retro-3.md ──→ fixes-3.md (pending/)
                 │
                 ↓ (all clear)
            [chain complete]
```

## Error Handling

| Scenario | Handling |
|----------|----------|
| No completed plan found | List available plans in done/, ask user to specify |
| Plan name ambiguous | Show matching plans, ask user to pick |
| Fresh review fails | Save partial findings, allow retry or switch to paste mode |
| No actionable fixes found | Generate retro file only, no fix plan (lessons only) |
| Paste parsing fails | Ask user to re-format or provide structured format hint |
| Previous retro exists | Auto-increment iteration number, link to previous |
| Fix plan already exists for iteration | Confirm overwrite or increment |

### Recovery
- Retro skill saves intermediate state (findings) before generating artifacts
- If generation fails, user can re-run `/retro` with `--continue` to resume
- Artifacts written atomically

## Testing Strategy

### Manual Testing Scenarios
1. **Fresh review mode**: Run `/retro` on completed plan, verify branch-reviewer spawns, findings categorized, artifacts generated
2. **Paste mode**: Run `/retro`, paste existing review findings, verify parsing and artifact generation
3. **Iteration handling**: Run `/retro` twice on same plan, verify iteration numbers increment and linking works
4. **No fixes case**: Run `/retro` with review that only has lessons, verify retro generated without fix plan
5. **Artifact indexing**: Verify new retros and fix plans are auto-indexed for search

### Verification Checklist
- [ ] Retro file created in `thoughts/shared/retros/`
- [ ] Fix plan created in `thoughts/shared/plans/pending/`
- [ ] Iteration numbers correct
- [ ] Links to original plan present
- [ ] Links to previous retro (if n > 1)
- [ ] Findings properly categorized
- [ ] Fix plan tasks are actionable and specific

## Open Questions

None - design validated through collaborative brainstorming.
