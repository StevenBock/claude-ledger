---
description: Generate handoff document capturing session changes
argument-hint: [name]
---

# /handoff

Generate a handoff document capturing git changes since session start.

## Usage

```
/handoff [name]
```

- `name` - Optional name for the handoff (defaults to timestamp-based name)

## Process

### 1. Load Git Snapshot

Read the session's git snapshot from `.claude/state/sessions/{sessionId}/git-snapshot.json`.

If the snapshot file doesn't exist:
- Note that no baseline was available
- Still capture current state for reference

### 2. Capture Current Git State

Run these git commands to get current state:
```bash
git rev-parse --abbrev-ref HEAD    # Current branch
git rev-parse HEAD                  # Current HEAD SHA
git status --porcelain              # Current file changes
```

If baseline exists, also run:
```bash
git log {startSha}..HEAD --oneline  # Commits since start
git diff --stat {startSha}..HEAD    # Diff statistics
git diff --name-status {startSha}..HEAD  # Files changed
```

### 3. Load Ledger Context (Optional)

If a ledger exists at `thoughts/ledgers/CONTINUITY_*.md`, extract:
- Goal
- Key Decisions
- Next Steps

### 4. Generate Handoff Document

Write to `thoughts/shared/handoffs/YYYY-MM-DD-{name}.md` with this format:

```markdown
# Handoff: {name}
Generated: {ISO timestamp}

## Summary
{Brief description - ask user or auto-generate from commits}

## Git Changes

### Branch
- Started: `{start_branch}`
- Current: `{current_branch}`

### Commits Since Session Start
{List commits or note if no baseline}

### Files Changed
{From git diff --name-status, grouped by Added/Modified/Deleted}

### Uncommitted Changes
{Staged, Modified, Untracked sections}

## Session Context
{From ledger if available: Goal, Key Decisions, Next Steps}
```

### 5. Confirm Output

Report: "Handoff generated: thoughts/shared/handoffs/{filename}.md"

## Edge Cases

- **Not a git repo**: Skip git sections, note "Not a git repository"
- **No snapshot**: Capture current state, note baseline unavailable
- **No commits since start**: Show "No new commits"
- **No ledger**: Omit Session Context section
