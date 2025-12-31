---
date: 2025-12-31
topic: "Smart Handoffs"
status: validated
---

## Problem Statement

When sessions end or context compacts, critical decision context is lost. Current ledgers track *what* was done and *what's next*, but not *why* specific approaches were chosen over alternatives. This creates knowledge debt - future sessions must re-discover constraints and re-evaluate rejected alternatives.

## Constraints

1. **Must work with compaction** - Auto-trigger at 95% context before Claude Code compacts
2. **Must integrate with existing hooks** - Leverage PostToolUse, PreCompact, SessionStart patterns
3. **Must be Claude-to-Claude optimized** - Structure for machine parsing, completeness over brevity
4. **Must capture incrementally** - Decisions captured as they happen, not reconstructed later
5. **Single artifact** - Enhanced ledger format, not additional file types

## Approach

**Hybrid: Decision Event Hooks + Structured Decision Logging**

- **Hooks** (reliable baseline): Hook into AskUserQuestion PostToolUse to capture explicit decisions in real-time
- **Structured logging** (richer context): Parse `DECISION:` blocks from skill outputs for decisions with rationale

This gives reliable automated capture plus optional rich context when skills emit structured decision logs.

**Rejected Alternatives:**
- *Retrospective analysis only* - Too expensive, reconstruction errors, may miss implicit decisions
- *Hooks only* - Misses conversational decisions not made via AskUserQuestion
- *Structured logging only* - Depends on Claude consistently logging, no automatic baseline

## Architecture

**Components:**

1. **Decision Capture Hook** (`PostToolUse: AskUserQuestion`)
   - Extracts question, options, selected answer(s)
   - Stores to `.claude/state/sessions/{sessionId}/decisions.json`

2. **Decision Log Parser** (utility function)
   - Scans for `DECISION:` blocks in conversation/artifacts
   - Extracts structured decisions from skill outputs
   - Merges with hook-captured decisions

3. **Enhanced Ledger Generator** (`PreCompact` trigger + `/ledger` command)
   - Pulls from: decisions.json, file-ops.json, git-snapshot.json, active plan
   - Generates unified enhanced ledger with decision history section

4. **Ledger Loader** (existing `SessionStart` hook)
   - Already loads ledgers on resume/compact/clear
   - No changes needed - loads richer content automatically

**Data Flow:**
```
AskUserQuestion → decision-capture hook → decisions.json
         ↓
DECISION: blocks → decision-log-parser → merged decisions
         ↓
PreCompact/command → enhanced-ledger-generator → CONTINUITY_*.md
         ↓
SessionStart → ledger-loader → injected context
```

## Enhanced Ledger Format

```markdown
# Session: {session-name}
Updated: {ISO timestamp}

## Goal
{What we're trying to accomplish}

## Constraints
{Technical requirements, patterns to follow}

## Progress
### Done
- [x] Completed items

### In Progress
- [ ] Current work

### Blocked
- Issues preventing progress

## Decision History
### {decision-topic-1}
- **Question:** What approach for X?
- **Options:** [A, B, C]
- **Chosen:** B
- **Rationale:** {why B was chosen over A and C}
- **Trade-offs:** {what we gave up by choosing B}

### {decision-topic-2}
...

## Discovered Constraints
- {constraint}: {how/when discovered}

## Active Context
### Working Plan
- File: `thoughts/shared/plans/active/...`
- Progress: X/N tasks

### Design Reference
- File: `thoughts/shared/designs/...`

## File Operations
### Read
- `paths`
### Modified
- `paths`

## Next Steps
1. Ordered list of what to do next
```

**Key additions over current format:**
- `Decision History` - structured log of all decisions with rationale and trade-offs
- `Discovered Constraints` - non-obvious limitations found during work
- `Active Context` - links to active plan and design for full traceability

## Error Handling

**Edge Cases:**

1. **No decisions captured** - Skip Decision History section, don't fail
2. **Compaction without explicit decisions** - Still capture progress, file ops, git state
3. **Multiple plans active** - Include all in Active Context
4. **Design file missing** - Note in ledger, still include session decisions
5. **Session state corrupted** - Gracefully degrade, partial handoff > no handoff

**Strategy:** Fail-safe, not fail-fast. Log warnings but don't fail ledger generation.

## Implementation Summary

| Component | File | Type |
|-----------|------|------|
| Decision capture hook | `hooks/src/decision-capture.ts` | New |
| Hook registration | `hooks/hooks.json` | Modify |
| Decision log parser | `hooks/src/utils/decision-parser.ts` | New |
| Enhanced ledger generator | `hooks/src/enhanced-ledger.ts` | New (or modify auto-save-ledger) |
| Ledger command | `commands/ledger.md` | Modify |

## Open Questions

None - design validated through brainstorm session.
