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
