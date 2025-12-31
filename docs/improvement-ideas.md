# Plugin Improvement Ideas

## Workflow Intelligence

### 1. Smart Auto-Resume
On session start, analyze incomplete plans + ledgers and proactively offer "Continue implementing user-auth plan? (3/7 tasks done)"

### 2. Semantic Plan Suggestions ⭐
When user describes a task, search past plans for similar work and suggest "Found similar plan from 12/15 - adapt it?"

### 3. Dependency-Aware Parallelism
Executor could build a DAG from plan tasks, visualize critical path, maximize parallel execution

## Context Enhancement

### 4. Working Set Persistence
Track files user cares about across sessions, auto-load them on resume (beyond current ledger approach)

### 5. Pattern Learning
Index successful implementations by category (auth, API, testing), suggest patterns: "You've done JWT auth 3x - want the standard approach?"

### 6. Codebase Snapshot Diffing
Compare current state vs plan's starting state, detect drift that might affect implementation

## Developer Experience

### 7. Plan Preview Mode
`/plan --preview` shows what planner would generate without committing, lets user iterate on scope

### 8. Progress Dashboard
`/status` command showing ASCII art progress bars, blockers, recent activity across all active plans

### 9. Time-Travel Debugging
Link ledger entries to git commits, enable "show me the codebase when this task was done"

### 10. Smart Handoffs
Auto-generate handoff docs with context diff between sessions (what changed, what's pending)

## Integration Ideas

### 11. GitHub Issue Sync
`/sync-issues` pulls open issues, converts to brainstorm seeds or plan tasks

### 12. Test Coverage Delta
Track coverage before/after each plan, show impact

### 13. PR Description Generator
Auto-generate PR descriptions from plan + ledger history
