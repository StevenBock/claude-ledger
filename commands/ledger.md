---
description: Create or update continuity ledger for session state
---

# /ledger

Create or update a continuity ledger to preserve session state across context clears.

## Usage

```
/ledger [session-name]
```

## What It Does

The ledger captures essential context needed to resume work seamlessly after `/clear` or context compaction:

1. **Creates new ledger** if none exists for the session
2. **Updates existing ledger** with:
   - New progress (moves In Progress → Done)
   - File operations (deterministically tracked)
   - Key decisions made
   - Updated next steps

## Population Instructions

When creating or updating a ledger:

### Decision History
1. Check for `.claude/state/sessions/{sessionId}/decisions.json`
2. If exists, parse and populate the Decision History table
3. Each entry has: question, options, chosen, rationale
4. Include all decisions from the JSON file

### Active Context
1. Check `thoughts/shared/plans/active/` for any active plan
2. If found, link to the plan file and calculate task progress (done/total)
3. Check if the active plan references a design file
4. If design referenced, link to it in Design Reference section

### Discovered Constraints
1. Document non-obvious limitations found during implementation
2. Include API limitations, library quirks, platform restrictions
3. Note workarounds applied (if any)

## Output

Writes to: `thoughts/ledgers/CONTINUITY_{session-name}.md`

## Ledger Format

```markdown
# Session: {session-name}
Updated: {ISO timestamp}

## Goal
{What we're trying to accomplish}

## Constraints
{Technical requirements, patterns to follow}

## Discovered Constraints
{Non-obvious limitations found during implementation}
- **Constraint**: Why it matters
- **Workaround**: How we addressed it (if applicable)

## Active Context
### Working Plan
- File: `thoughts/shared/plans/active/{plan-name}.md`
- Progress: X of Y tasks complete

### Design Reference
- File: `thoughts/shared/designs/{design-name}.md` (if applicable)

## Progress
### Done
- [x] Completed items

### In Progress
- [ ] Current work

### Blocked
- Issues preventing progress

## Key Decisions
- **Decision**: Rationale

## Decision History
{Auto-populated from .claude/state/sessions/{sessionId}/decisions.json}
| Question | Options | Chosen | Rationale |
|----------|---------|--------|-----------|
| {question} | {options} | {chosen} | {rationale} |

## Next Steps
1. Ordered list

## File Operations
### Read
- `paths that were read`

### Modified
- `paths that were written or edited`

## Critical Context
- Data, examples, references needed to continue

## Working Set
- Branch: `branch-name`
- Key files: `paths`
```

## After Clear

When you resume after `/clear`:
1. The ledger is automatically injected into context
2. Find the "In Progress" item - that's your current focus
3. Continue from where you left off

## Notes

- Keep ledgers concise - essential info only
- Mark uncertain information as UNCONFIRMED
- File operations are tracked automatically by hooks
