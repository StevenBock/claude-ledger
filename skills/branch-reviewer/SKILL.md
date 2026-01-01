---
name: branch-reviewer
description: Review entire branch diff for correctness, completeness, style, security, and patterns
model: haiku
---

# Branch Reviewer

Review entire branch diff via Claude CLI with extended thinking.

## When to Use

- Spawned by retro skill for fresh review mode
- When you need comprehensive branch-level code review
- After plan completion to find issues before merging

## Process

### Step 1: Get Branch Info

```bash
git diff --stat main..HEAD
git log main..HEAD --oneline
```

Capture the file list and commit count.

### Step 2: Invoke claude-cli for Deep Review

Spawn the claude-cli skill to perform comprehensive branch review with extended thinking:

```
Task("claude-cli: Invoke CLI for branch review.
task: ultrathink. Review the entire branch diff from main to HEAD.

Run these commands first:
- git diff main..HEAD (full diff)
- git diff --stat main..HEAD (file summary)
- git log main..HEAD --oneline (commits)

Then analyze ALL changes for:
1. Security issues (injection, secrets, validation)
2. Correctness (logic errors, edge cases, regressions)
3. Completeness (missing tests, incomplete implementations)
4. Consistency (match existing codebase patterns - file headers, imports, naming)
5. Style (naming, dead code, complexity)

For consistency: Find similar existing files and compare patterns. Flag ANY deviation.

Categorize findings into:
- pattern_gaps: PATTERNS.md insufficient or wrong
- planning_gaps: Original plan missed something
- process_improvements: Workflow could be better
- actionable_fixes: Specific code issues to fix

system_prompt: You are reviewing an entire branch for a retrospective. Think deeply about each file changed. Be thorough - this is the last check before merge. Find similar existing files for consistency comparison.

allowed_tools: Read,Glob,Grep,Bash(git*)
model: opus")
```

### Step 3: Return Structured Findings

The CLI output should follow this format for the retro skill to parse:

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

### Summary
[1-2 sentences overall assessment]
```

## Why claude-cli?

The Task tool spawns subagents **without extended thinking**. Branch review needs deep analysis across many files - extended thinking catches issues that shallow passes miss.

## Rules

- This skill is haiku (just orchestration)
- Actual review runs as opus via claude-cli with thinking
- Review ENTIRE branch diff, not individual tasks
- Every finding must be actionable
- Never skip files or commits
- Security issues are always critical
