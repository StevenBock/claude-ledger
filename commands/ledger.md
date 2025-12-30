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

## Progress
### Done
- [x] Completed items

### In Progress
- [ ] Current work

### Blocked
- Issues preventing progress

## Key Decisions
- **Decision**: Rationale

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
