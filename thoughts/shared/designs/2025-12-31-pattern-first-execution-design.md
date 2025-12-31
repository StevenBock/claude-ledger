---
date: 2025-12-31
topic: "Pattern-First Atomic Execution"
status: validated
---

## Problem Statement

Large-scale parallel execution with subagents suffers from quality degradation:
- **Pattern drift**: Parallel subagents interpret plans differently
- **Task overload**: Tasks with 4+ files exceed reliable subagent scope
- **Late detection**: Problems found after hundreds of files created
- **No same-batch sharing**: Parallel implementers cannot share learnings mid-execution

Root cause: Pattern specification insufficient for autonomous parallel execution at scale.

## Constraints

- Subagents cannot compact their context (hard limit)
- No same-batch context sharing (architectural)
- Handoffs only help subsequent batches, not current batch
- Must work within existing executor/implementer/reviewer architecture

## Approach

Two-phase execution with pattern injection:

**Phase A (Pattern Lock-In)**: Execute representative sample sequentially with human validation to establish patterns.

**Phase B (Scaled Execution)**: Apply validated patterns at scale with pattern injection and enforcement.

## Architecture

### New Artifact: PATTERNS.md

Planner creates patterns file alongside plan:
- `thoughts/shared/plans/pending/YYYY-MM-DD-{topic}.md` (plan)
- `thoughts/shared/patterns/YYYY-MM-DD-{topic}-patterns.md` (patterns)

```markdown
# Patterns: [Topic]

## Naming Conventions
- Specific naming rules with examples

## Code Patterns

### [Pattern Category]
[Concrete code example]
[When to use]
[Edge cases]

## Edge Cases
- [Situation]: [How to handle]

## Anti-Patterns (Do NOT)
- [What to avoid and why]
```

### Component Changes

#### Planner Skill
- **New output**: PATTERNS.md alongside plan
- **Content**: Naming conventions, code structure patterns, edge cases, anti-patterns
- **Extraction**: Analyze codebase for existing patterns, document explicitly

#### Implementer Skill
- **New input**: Patterns path
- **Behavior**: Read PATTERNS.md before implementing, follow exactly, flag deviations in handoff notes

#### Reviewer Skill
- **New input**: Patterns path
- **Validation**: Check against patterns (critical, not suggestions), flag pattern insufficiency for human review

#### Executor Skill
- **Phase detection**: Auto-detect first execution, trigger Phase A
- **Pattern injection**: Include patterns path in all implementer/reviewer prompts
- **Pause capability**: Stop execution when reviewer flags pattern issues

### Workflow

```
/planner creates:
  ├─ plan.md (tasks, phases, dependencies)
  └─ patterns.md (conventions, examples, anti-patterns)

/execute auto-detects first run:

Phase A (Lock-In):
  ├─ Select representative tasks (3-5 diverse types)
  │   - Simple CRUD action
  │   - Action with validation
  │   - Action with complex orchestration
  │   - Action returning list/collection
  │   - Action with external service
  ├─ Execute ONE task at a time
  ├─ Human reviews each via AskUserQuestion
  │   - "Does this match expected patterns?"
  │   - "Any adjustments to PATTERNS.md needed?"
  ├─ If issues → iterate on patterns.md
  └─ When 3+ tasks pass cleanly → Phase B unlocks

Phase B (Scaled):
  ├─ Batch remaining tasks (MAX_PARALLEL=4)
  ├─ Each implementer receives: plan + patterns
  ├─ Each reviewer validates: against plan + patterns
  ├─ If reviewer flags pattern insufficiency → PAUSE
  │   └─ Human updates patterns.md
  │   └─ Resume execution
  └─ Continue until done
```

### Task Decomposition Rules

- **Context-dependent grouping**: Simple files group (3-4), complex files separate (1-2)
- **Never split tightly-coupled logic**: Keep Action + DTOs together if simple
- **Separate controller refactors**: Different concerns, easier to review
- **Complexity over count**: Judge by file complexity, not file count

### Error Handling

| Situation | Behavior |
|-----------|----------|
| No patterns file found | Executor prompts: "Run /planner first to generate patterns" |
| Phase A task fails review | Iterate with human until pattern established |
| Reviewer detects pattern drift | Report to human, pause for decision |
| Pattern needs update mid-execution | Human updates, all subsequent batches use new version |

## Data Flow

```
Plan Creation:
  User idea → Brainstorm → Planner → [plan.md, patterns.md]

Execution:
  Executor reads plan.md
    ↓
  Phase A: Sequential + Human Review
    ├─ Implementer(plan, patterns, task) → code
    ├─ Reviewer(plan, patterns, task) → verdict
    └─ Human → approve / refine patterns
    ↓
  Phase B: Parallel + Pattern Enforcement
    ├─ Implementer(plan, patterns, task) → code
    ├─ Reviewer(plan, patterns, task) → verdict
    └─ If pattern issue → PAUSE → Human → Resume
```

## Testing Strategy

1. **Unit test pattern injection**: Verify implementer/reviewer receive patterns path
2. **Integration test Phase A**: Mock human review, verify sequential execution
3. **Integration test Phase B**: Verify parallel execution with patterns
4. **E2E test pause/resume**: Trigger pattern issue, verify pause behavior

## Open Questions

None - design validated through collaborative dialogue.
