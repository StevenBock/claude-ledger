# Pattern-First Execution Implementation Plan

<!-- EXECUTOR STATUS (auto-managed by /execute - do not edit) -->
| Field | Value |
|-------|-------|
| Status | `done` |
| Started | 2025-12-31 10:45 |
| Completed | 2025-12-31 10:56 |
| Progress | 12/12 tasks |
<!-- END EXECUTOR STATUS -->

**Goal:** Add pattern injection and Phase A/B execution to prevent quality degradation in large-scale parallel execution.

**Architecture:** Planner outputs PATTERNS.md alongside plan. Executor detects Phase A (sequential lock-in) vs Phase B (parallel). All implementer/reviewer spawns receive patterns path. Reviewer validates against patterns.

**Design:** [thoughts/shared/designs/2025-12-31-pattern-first-execution-design.md](thoughts/shared/designs/2025-12-31-pattern-first-execution-design.md)

---

## Phase 1: Infrastructure

### Task 1.1: Create patterns directory

**Files:**
- Create: `thoughts/shared/patterns/.gitkeep`

Create the patterns directory to store pattern artifacts.

```bash
mkdir -p thoughts/shared/patterns
touch thoughts/shared/patterns/.gitkeep
```

**Verification:**
```bash
ls -la thoughts/shared/patterns/
```
Expected: `.gitkeep` file exists

---

## Phase 2: Planner Updates

### Task 2.1: Add patterns output section to planner skill

**Files:**
- Modify: `skills/planner/SKILL.md`

Add new section explaining PATTERNS.md output. Insert after the "Output Format" section header (around line 85).

**Changes:**

1. In the "Output Format" section, add note that planner outputs TWO files:
   - Plan file (existing)
   - Patterns file (new)

2. Add new "Patterns File Format" section after the plan template (after line 158) with this template:

```markdown
## Patterns File Format

Write to: `thoughts/shared/patterns/YYYY-MM-DD-{topic}-patterns.md`

```markdown
# Patterns: [Feature Name]

## Naming Conventions
- [Specific naming rules from codebase analysis]
- [Examples of correct names]

## Code Patterns

### [Pattern Category 1]
**When:** [When to use this pattern]
**Example:**
\`\`\`[language]
[Complete code example from codebase or plan]
\`\`\`
**Edge cases:** [How to handle variations]

### [Pattern Category 2]
[Same structure...]

## Edge Cases
- [Situation 1]: [How to handle]
- [Situation 2]: [How to handle]

## Anti-Patterns (Do NOT)
- [What to avoid]: [Why it's problematic]
```

3. In "Process" section, add step to write patterns file alongside plan

**Verification:**
Read `skills/planner/SKILL.md` and verify:
- Patterns output is documented
- Template is complete with all sections

---

## Phase 3: Executor Updates

### Task 3.1: Add patterns path derivation to executor

**Files:**
- Modify: `skills/executor/SKILL.md`

Add logic to derive patterns file path from plan path. Insert in the initialization section (after "FIRST: Activate Plan").

**Changes:**

Add new subsection "Derive Patterns Path":
```markdown
### Derive Patterns Path

From the plan path, derive the patterns path:
- Plan: `thoughts/shared/plans/active/YYYY-MM-DD-{topic}.md`
- Patterns: `thoughts/shared/patterns/YYYY-MM-DD-{topic}-patterns.md`

If patterns file does not exist:
1. Output warning: "No patterns file found. Pattern enforcement disabled."
2. Continue without pattern injection (backwards compatible)
```

**Verification:**
Read `skills/executor/SKILL.md` and verify patterns derivation logic exists.

---

### Task 3.2: Add Phase A detection to executor

**Files:**
- Modify: `skills/executor/SKILL.md`

Add Phase A/B detection logic. Insert after the patterns path derivation section.

**Changes:**

Add new section "Phase Detection":
```markdown
### Phase Detection

**Auto-detect first execution:**
Check plan status block - if `Started: -` (never executed), this is Phase A.

**Phase A Selection (3-5 representative tasks):**
1. Parse all tasks from plan
2. Select diverse sample:
   - 1 simple task (few files, straightforward logic)
   - 1 task with validation/error handling
   - 1 complex task (multiple files, orchestration)
   - 1-2 additional for coverage if plan is large (50+ tasks)
3. Mark selected task numbers as Phase A in executor state

**Phase A vs Phase B:**
- Phase A: Execute selected tasks SEQUENTIALLY with human review after each
- Phase B: Execute remaining tasks in PARALLEL batches (existing behavior)

**Transition condition:**
When 3+ Phase A tasks pass review cleanly → unlock Phase B
```

**Verification:**
Read `skills/executor/SKILL.md` and verify Phase A detection logic exists.

---

### Task 3.3: Add Phase A execution loop to executor

**Files:**
- Modify: `skills/executor/SKILL.md`

Add the Phase A sequential execution loop with human review. Insert before the existing parallel execution section.

**Changes:**

Add new section "Phase A Execution":
```markdown
### Phase A: Sequential Pattern Lock-In

For each Phase A task (ONE AT A TIME, not parallel):

1. **Spawn implementer** (single task, blocking):
   ```
   Task("implementer: Execute Task N from plan.
   Plan: thoughts/shared/plans/active/YYYY-MM-DD-{topic}.md
   Patterns: thoughts/shared/patterns/YYYY-MM-DD-{topic}-patterns.md
   Task: N
   Beads ID: bd-xxx.N")
   ```

2. **Wait for completion**, display summary

3. **Spawn reviewer** (single task, blocking):
   ```
   Task("reviewer: Review Task N implementation.
   Plan: thoughts/shared/plans/active/YYYY-MM-DD-{topic}.md
   Patterns: thoughts/shared/patterns/YYYY-MM-DD-{topic}-patterns.md
   Task: N")
   ```

4. **Handle reviewer verdict:**
   - APPROVED → Ask user (via AskUserQuestion):
     "Task N passed review. Does implementation match expected patterns? Any PATTERNS.md adjustments needed?"
     Options: [Continue, Update patterns first]
   - CHANGES REQUESTED → Re-spawn implementer (max 3 cycles)
   - PATTERN INSUFFICIENCY flagged → PAUSE, ask user to update PATTERNS.md

5. **Track Phase A progress:**
   - After 3+ tasks approved cleanly → Output "Phase A complete. Unlocking Phase B."
   - Proceed to Phase B execution
```

**Verification:**
Read `skills/executor/SKILL.md` and verify Phase A execution loop with human review exists.

---

### Task 3.4: Update Phase B spawns to include patterns path

**Files:**
- Modify: `skills/executor/SKILL.md`

Update all implementer and reviewer spawn examples to include patterns path.

**Changes:**

Find all Task spawn examples in the executor skill and add `Patterns:` line:

Implementer spawns (around lines 167-189):
```
Task("implementer: Execute Task 1 from plan.
Plan: thoughts/shared/plans/active/YYYY-MM-DD-{topic}.md
Patterns: thoughts/shared/patterns/YYYY-MM-DD-{topic}-patterns.md
Task: 1
Beads ID: bd-xxx.1")
```

Reviewer spawns (around lines 227-238):
```
Task("reviewer: Review Task 1 implementation.
Plan: thoughts/shared/plans/active/YYYY-MM-DD-{topic}.md
Patterns: thoughts/shared/patterns/YYYY-MM-DD-{topic}-patterns.md
Task: 1")
```

**Verification:**
Grep `skills/executor/SKILL.md` for "Task(" and verify all spawns include Patterns line.

---

### Task 3.5: Add pattern insufficiency pause to executor

**Files:**
- Modify: `skills/executor/SKILL.md`

Add handling for when reviewer flags pattern issues during Phase B.

**Changes:**

Add new section after main execution loop:
```markdown
### Pattern Insufficiency Handling (Phase B)

If reviewer flags pattern drift or insufficiency:

1. **Pause execution** - do not spawn next batch
2. **Report to user** via AskUserQuestion:
   "Reviewer detected pattern issue: [specific issue from reviewer output]
   Please update PATTERNS.md and confirm when ready to resume."
   Options: [Resume execution, Abort]
3. **On resume** - continue with updated patterns for all subsequent batches
```

**Verification:**
Read `skills/executor/SKILL.md` and verify pause logic exists.

---

## Phase 4: Implementer Updates

### Task 4.1: Add patterns input to implementer skill

**Files:**
- Modify: `skills/implementer/SKILL.md`

Add patterns as an input parameter and update the process to read it.

**Changes:**

1. In "Input" section (around line 76), add:
   ```markdown
   5. **Patterns** (optional) - Path to patterns file (e.g., `thoughts/shared/patterns/YYYY-MM-DD-{topic}-patterns.md`)
   ```

2. In "First Steps" section (around line 84), add:
   ```markdown
   4. If patterns path provided, read the patterns file using the Read tool
   ```

3. Add new section after "First Steps":
   ```markdown
   ### Pattern Compliance

   When patterns file is provided:
   - Follow naming conventions exactly as documented
   - Use code structure patterns from the file
   - Handle edge cases as specified
   - Avoid anti-patterns listed

   If you must deviate from patterns:
   - Document the deviation in handoff notes
   - Explain why the deviation was necessary
   ```

4. In "Handoff Notes" section of output format (around line 126), add:
   ```markdown
   - Pattern deviations (if any, with justification)
   ```

**Verification:**
Read `skills/implementer/SKILL.md` and verify patterns input and compliance section exist.

---

## Phase 5: Reviewer Updates

### Task 5.1: Add patterns input to reviewer skill

**Files:**
- Modify: `skills/reviewer/SKILL.md`

Add patterns as an input and update process to read it.

**Changes:**

1. In "Input" section (around line 54), add:
   ```markdown
   3. **Patterns** (optional) - Path to patterns file
   ```

2. In "Process" section (around line 60), add step:
   ```markdown
   4. If patterns path provided, read the patterns file
   ```

**Verification:**
Read `skills/reviewer/SKILL.md` and verify patterns input exists.

---

### Task 5.2: Add pattern validation checklist to reviewer

**Files:**
- Modify: `skills/reviewer/SKILL.md`

Add new validation category for patterns compliance.

**Changes:**

1. In "Checklist" section (after Safety, around line 52), add:
   ```markdown
   ### Patterns (if patterns file provided)
   - Naming conventions followed?
   - Code structure matches documented patterns?
   - No anti-patterns used?
   - Edge cases handled as specified?
   - Pattern insufficiency detected? (patterns file incomplete for this task)
   ```

2. In output format (around line 77), add to Critical section:
   ```markdown
   - `file:line` - Pattern violation: [which pattern, how violated]
   ```

3. Add new section before Summary in output:
   ```markdown
   ### Pattern Status
   - [x] Patterns followed / [ ] Deviations noted
   - [ ] Pattern insufficiency: [describe what's missing from PATTERNS.md]
   ```

**Verification:**
Read `skills/reviewer/SKILL.md` and verify pattern validation checklist and output sections exist.

---

## Phase 6: Optional Enhancements

### Task 6.1: Update MCP server artifact detection for patterns

**Files:**
- Modify: `servers/artifact-index/src/server.ts`

Add pattern detection to the artifact indexer so patterns files are searchable.

**Changes:**

In `detectArtifactType` function (around line 122), add:
```typescript
if (filePath.includes("thoughts/shared/patterns/") && filePath.endsWith(".md")) {
  return "plan";  // Index patterns as searchable artifacts (same as designs)
}
```

**Verification:**
```bash
grep -n "thoughts/shared/patterns" servers/artifact-index/src/server.ts
```
Expected: Pattern detection logic present

---

### Task 6.2: Rebuild MCP server

**Files:**
- Run build command

Rebuild the artifact-index server to include the pattern detection change.

```bash
npm run build:server
```

**Verification:**
```bash
ls -la servers/artifact-index/dist/server.mjs
```
Expected: File exists with recent timestamp

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1.1 | Create patterns directory |
| 2 | 2.1 | Update planner with patterns output |
| 3 | 3.1-3.5 | Update executor with phase detection, patterns injection, Phase A loop |
| 4 | 4.1 | Update implementer with patterns input |
| 5 | 5.1-5.2 | Update reviewer with patterns validation |
| 6 | 6.1-6.2 | Optional: Update MCP server for pattern indexing |

**Total: 12 tasks**

**Execution order:** Infrastructure → Planner → Executor → Implementer → Reviewer → MCP Server
