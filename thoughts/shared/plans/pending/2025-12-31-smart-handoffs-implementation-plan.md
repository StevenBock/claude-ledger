# Smart Handoffs Implementation Plan

<!-- EXECUTOR STATUS (auto-managed by /execute - do not edit) -->
| Field | Value |
|-------|-------|
| Status | `pending` |
| Started | - |
| Completed | - |
| Progress | 0/6 tasks |
<!-- END EXECUTOR STATUS -->

**Goal:** Add `/handoff` command that generates handoff docs showing git changes since session start.

**Architecture:** SessionStart hook captures git state (SHA, branch, staged/modified files) to `.claude/state/sessions/{sessionId}/git-snapshot.json`. Command compares current state vs snapshot and generates markdown doc.

---

## Task 1: Create git-snapshot-capture hook

**Files:**
- Create: `hooks/src/git-snapshot-capture.ts`
- Create: `hooks/git-snapshot-capture.sh`

**Step 1: Create TypeScript hook**

```typescript
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

interface SessionStartInput {
  source: "resume" | "compact" | "clear" | "startup";
  session_id: string;
}

interface GitSnapshot {
  capturedAt: string;
  source: string;
  branch: string;
  headSha: string;
  headMessage: string;
  staged: string[];
  modified: string[];
  untracked: string[];
}

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
  });
}

function parseGitStatus(porcelain: string): { staged: string[]; modified: string[]; untracked: string[] } {
  const staged: string[] = [];
  const modified: string[] = [];
  const untracked: string[] = [];

  for (const line of porcelain.split("\n").filter(Boolean)) {
    const index = line[0];
    const worktree = line[1];
    const filepath = line.slice(3);

    if (index !== " " && index !== "?") staged.push(filepath);
    if (worktree === "M" || worktree === "D") modified.push(filepath);
    if (index === "?") untracked.push(filepath);
  }

  return { staged, modified, untracked };
}

function captureGitState(projectDir: string, source: string): GitSnapshot | null {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: projectDir, encoding: "utf-8" }).trim();
    const headSha = execSync("git rev-parse HEAD", { cwd: projectDir, encoding: "utf-8" }).trim();
    const headMessage = execSync("git log -1 --format=%s", { cwd: projectDir, encoding: "utf-8" }).trim();
    const status = execSync("git status --porcelain", { cwd: projectDir, encoding: "utf-8" });
    const { staged, modified, untracked } = parseGitStatus(status);

    return {
      capturedAt: new Date().toISOString(),
      source,
      branch,
      headSha,
      headMessage,
      staged,
      modified,
      untracked,
    };
  } catch {
    return null;
  }
}

async function main() {
  const input: SessionStartInput = JSON.parse(await readStdin());
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  const snapshotDir = path.join(projectDir, ".claude", "state", "sessions", input.session_id);
  const snapshotPath = path.join(snapshotDir, "git-snapshot.json");

  if (input.source !== "startup" && fs.existsSync(snapshotPath)) {
    console.log(JSON.stringify({ result: "continue" }));
    return;
  }

  const snapshot = captureGitState(projectDir, input.source);

  if (snapshot) {
    fs.mkdirSync(snapshotDir, { recursive: true });
    fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
  }

  console.log(JSON.stringify({ result: "continue" }));
}

main().catch(() => {
  console.log(JSON.stringify({ result: "continue" }));
});
```

**Step 2: Create shell wrapper**

```bash
#!/bin/bash
set -e
cd "${CLAUDE_PLUGIN_ROOT:-$(dirname "$0")/..}/hooks"
cat | node dist/git-snapshot-capture.mjs
```

**Step 3: Make shell script executable**

Run: `chmod +x hooks/git-snapshot-capture.sh`

---

## Task 2: Register hook in hooks.json

**Files:**
- Modify: `hooks/hooks.json`

**Step 1: Add SessionStart entry for git-snapshot-capture**

Add to the `SessionStart` array in hooks.json, BEFORE the existing ledger-loader entry:

```json
{
  "matcher": "startup|resume|compact|clear",
  "hooks": [
    {
      "type": "command",
      "command": "${CLAUDE_PLUGIN_ROOT}/hooks/git-snapshot-capture.sh",
      "timeout": 10
    }
  ]
}
```

The full SessionStart section should have TWO entries now (git-snapshot first, then ledger-loader+context-injector).

---

## Task 3: Create /handoff command

**Files:**
- Create: `commands/handoff.md`

**Step 1: Create command file**

```markdown
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
```

---

## Task 4: Create handoffs directory

**Files:**
- Create: `thoughts/shared/handoffs/.gitkeep`

**Step 1: Create directory with gitkeep**

```bash
mkdir -p thoughts/shared/handoffs
touch thoughts/shared/handoffs/.gitkeep
```

---

## Task 5: Build hooks

**Step 1: Run build**

Run: `npm run build:hooks`
Expected: Compiles `hooks/src/git-snapshot-capture.ts` to `hooks/dist/git-snapshot-capture.mjs`

---

## Task 6: Test manually

**Step 1: Restart Claude Code to pick up hook changes**

**Step 2: Start fresh session and verify snapshot captured**

Check: `.claude/state/sessions/{sessionId}/git-snapshot.json` exists

**Step 3: Make some changes, run /handoff**

Verify: `thoughts/shared/handoffs/YYYY-MM-DD-*.md` generated with correct diff

---

## Files Summary

| File | Action |
|------|--------|
| `hooks/src/git-snapshot-capture.ts` | Create |
| `hooks/git-snapshot-capture.sh` | Create |
| `hooks/hooks.json` | Modify |
| `commands/handoff.md` | Create |
| `thoughts/shared/handoffs/.gitkeep` | Create |
