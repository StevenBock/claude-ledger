# Retro Workflow Implementation Plan

<!-- EXECUTOR STATUS (auto-managed by /execute - do not edit) -->
| Field | Value |
|-------|-------|
| Status | `pending` |
| Started | - |
| Completed | - |
| Progress | 0/8 tasks |
<!-- END EXECUTOR STATUS -->

**Goal:** Implement `/retro` command and supporting skills to close the feedback loop between code review and planning system.

**Architecture:** New `/retro` command invokes `retro` skill which can spawn `branch-reviewer` for fresh reviews or accept pasted findings. Outputs: retro file (lessons learned) + fix plan (actionable items). Supports iterative retros with linking.

**Design:** `thoughts/shared/designs/2025-12-31-retro-workflow-design.md`

---

## Task 1: Create retros directory

**Files:**
- Create: `thoughts/shared/retros/.gitkeep`

Create the retros directory to store retrospective files.

```bash
mkdir -p thoughts/shared/retros && touch thoughts/shared/retros/.gitkeep
```

**Verify:**
```bash
ls -la thoughts/shared/retros/
```
Expected: Directory exists with `.gitkeep` file

---

## Task 2: Create `/retro` command

**Files:**
- Create: `commands/retro.md`

**Content:**
```markdown
---
description: Run retrospective on completed plan - capture lessons and generate fix plan
argument-hint: "[plan-name]"
---

!`cat ${CLAUDE_PLUGIN_ROOT}/skills/retro/SKILL.md`
```

**Verify:**
```bash
cat commands/retro.md
```
Expected: File exists with frontmatter and skill invocation

---

## Task 3: Create `branch-reviewer` skill

**Files:**
- Create: `skills/branch-reviewer/SKILL.md`

**Content:**
```markdown
---
name: branch-reviewer
description: Review entire branch diff for correctness, completeness, style, security, and patterns
---

# Branch Reviewer

Review entire branch diff (not per-task) and return structured findings.

## When to Use

- Spawned by retro skill for fresh review mode
- When you need comprehensive branch-level code review
- After plan completion to find issues before merging

## Critical Rules

1. **Review the ENTIRE branch diff** - not individual tasks
2. **Return structured findings** - categorized for retro skill to process
3. **Spawn sub-reviewers in parallel** - for specialized concerns
4. **Be thorough but actionable** - every finding should be fixable

## Process

### Step 1: Get Branch Diff
```bash
git diff main..HEAD
git diff --stat main..HEAD
git log main..HEAD --oneline
```

### Step 2: Spawn Sub-Reviewers (parallel)
In ONE message, spawn multiple Task agents:
- Task: "Review for correctness - logic errors, edge cases, regressions"
- Task: "Review for completeness - missing tests, incomplete implementations"
- Task: "Review for style - naming, formatting, patterns consistency"
- Task: "Review for security - injection, secrets, validation"

### Step 3: Collect and Categorize Findings

Organize findings into categories:
- **pattern_gaps**: PATTERNS.md insufficient or wrong
- **planning_gaps**: Original plan missed something
- **process_improvements**: Workflow could be better
- **actionable_fixes**: Specific code issues to fix

### Step 4: Return Structured Output

```markdown
## Branch Review: [branch-name]

**Commits reviewed:** [N commits]
**Files changed:** [N files]

### Pattern Gaps
- `file:line` - [finding]: [why it's a pattern gap]

### Planning Gaps
- [finding]: [what should have been planned]

### Process Improvements
- [finding]: [suggested improvement]

### Actionable Fixes
- `file:line` - [issue]: [how to fix]
- `file:line` - [issue]: [how to fix]

### Summary
[1-2 sentences overall assessment]
```

## Output Format

Return structured findings as markdown that retro skill can parse. Each finding should have:
- Location (file:line when applicable)
- Description of the issue
- Category (pattern gap, planning gap, process improvement, actionable fix)
- Suggested resolution

## Never Do

- Skip files or commits
- Return vague findings without actionable resolution
- Miss security issues
- Ignore test coverage gaps
```

**Verify:**
```bash
cat skills/branch-reviewer/SKILL.md | head -20
```
Expected: Skill file with frontmatter and content

---

## Task 4: Create `retro` skill

**Files:**
- Create: `skills/retro/SKILL.md`

**Content:**
```markdown
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

## Process

### Phase 0: Plan Selection

If plan-name argument provided:
- Look in `thoughts/shared/plans/done/` for matching plan
- If ambiguous, use AskUserQuestion to clarify

If no argument:
- List recent completed plans from `thoughts/shared/plans/done/`
- Use AskUserQuestion to let user select

### Phase 1: Determine Iteration Number

Check `thoughts/shared/retros/` for existing retros for this plan:
- Pattern: `YYYY-MM-DD-{topic}-retro-{n}.md`
- If none exist, iteration = 1
- If exist, iteration = max(n) + 1

### Phase 2: Input Mode Selection

Use AskUserQuestion:
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

### Phase 3A: Fresh Review Mode

If user chose "Fresh review":
1. Spawn branch-reviewer skill using Task tool
2. Wait for structured findings
3. Proceed to Phase 4

### Phase 3B: Paste Mode

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

## Never Do

- Skip iteration detection - always check for existing retros
- Generate fix plan with no actionable items
- Forget to link artifacts (original plan, previous retro, fix plan)
- Use plain text questions after Phase 0 - always use AskUserQuestion
- Overwrite existing retro without confirming
```

**Verify:**
```bash
wc -l skills/retro/SKILL.md
```
Expected: ~180 lines

---

## Task 5: Update artifact-auto-index hook for retros

**Files:**
- Modify: `hooks/src/artifact-auto-index.ts`

Add retro detection to `isArtifact` function (around line 19-27):

**Current:**
```typescript
function isArtifact(filePath: string): { type: "ledger" | "plan" } | null {
  if (filePath.includes("thoughts/ledgers/") && filePath.includes("CONTINUITY_")) {
    return { type: "ledger" };
  }
  if (filePath.includes("thoughts/shared/plans/") && filePath.endsWith(".md")) {
    return { type: "plan" };
  }
  return null;
}
```

**Change to:**
```typescript
function isArtifact(filePath: string): { type: "ledger" | "plan" } | null {
  if (filePath.includes("thoughts/ledgers/") && filePath.includes("CONTINUITY_")) {
    return { type: "ledger" };
  }
  if (filePath.includes("thoughts/shared/plans/") && filePath.endsWith(".md")) {
    return { type: "plan" };
  }
  if (filePath.includes("thoughts/shared/retros/") && filePath.endsWith(".md")) {
    return { type: "plan" };
  }
  return null;
}
```

**Verify:**
```bash
grep -A 15 "function isArtifact" hooks/src/artifact-auto-index.ts
```
Expected: Shows retro detection added

---

## Task 6: Update MCP server for retro indexing

**Files:**
- Modify: `servers/artifact-index/src/server.ts`

Add retro detection to artifact type detection (around line 122-133):

**Find the section with:**
```typescript
if (filePath.includes("thoughts/shared/plans/") && filePath.endsWith(".md")) {
  return "plan";
}
```

**Add after it:**
```typescript
if (filePath.includes("thoughts/shared/retros/") && filePath.endsWith(".md")) {
  return "plan";
}
```

**Verify:**
```bash
grep -B 2 -A 2 "thoughts/shared/retros" servers/artifact-index/src/server.ts
```
Expected: Shows retro detection added

---

## Task 7: Rebuild hooks and server

**Files:**
- None (build only)

```bash
npm run build
```

**Verify:**
```bash
ls -la hooks/dist/*.mjs servers/artifact-index/dist/*.mjs
```
Expected: Recent timestamps on compiled files

---

## Task 8: Commit all changes

```bash
git add thoughts/shared/retros/.gitkeep commands/retro.md skills/branch-reviewer/SKILL.md skills/retro/SKILL.md hooks/src/artifact-auto-index.ts servers/artifact-index/src/server.ts
git commit -m "feat(retro): add retrospective workflow for review-to-fix loop

- Add /retro command to invoke retro skill
- Add retro skill for capturing lessons and generating fix plans
- Add branch-reviewer skill for comprehensive branch review
- Add retro artifact indexing to hooks and MCP server
- Create thoughts/shared/retros/ directory for retro files

Closes feedback loop: plan completion → review → lessons → fix plan"
```

**Verify:**
```bash
git log -1 --oneline
```
Expected: Commit with retro feature message
