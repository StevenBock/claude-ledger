---
date: 2025-12-31
topic: "Beads-Integrated Executor"
status: validated
---

## Problem Statement

The current executor has two issues:
1. **Phase ordering violated** - Executor suggests starting Phase N+1 before Phase N is complete
2. **Unnecessary pauses** - Stops to ask user how to proceed when plan already defines the work

Root cause: The executor lacks a dependency graph. It relies on implicit phase ordering that isn't enforced, and defaults to asking for user input at arbitrary points.

## Constraints

- Must preserve human-readable plan files (contain implementation details)
- Must not consume excessive context during setup
- Must integrate with existing Beads installation
- Must support resumption across sessions/compactions

## Approach

**Plan as spec, Beads as execution engine**

The plan file remains the source of truth for *what* to implement. Beads becomes the execution state machine tracking *what's done* and *what's unblocked*.

A new `beads-sync` subagent converts the plan into Beads issues at execution start, then the executor loops on `bd ready` until complete.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Planner   │────▶│  Plan File   │────▶│ beads-sync  │
└─────────────┘     │  (markdown)  │     │  subagent   │
                    └──────────────┘     └──────┬──────┘
                                                │
                                                ▼
                                         ┌─────────────┐
                                         │   Beads     │
                                         │  (issues)   │
                                         └──────┬──────┘
                                                │
                    ┌───────────────────────────┼───────────────────────────┐
                    │                           │                           │
                    ▼                           ▼                           ▼
             ┌─────────────┐            ┌─────────────┐            ┌─────────────┐
             │ Implementer │            │ Implementer │            │ Implementer │
             │  (task 1)   │            │  (task 2)   │            │  (task N)   │
             └──────┬──────┘            └──────┬──────┘            └──────┬──────┘
                    │                           │                           │
                    └───────────────────────────┼───────────────────────────┘
                                                │
                                                ▼
                                         ┌─────────────┐
                                         │  bd done    │
                                         │  (unblocks  │
                                         │   next)     │
                                         └─────────────┘
```

## Components

### beads-sync Skill (NEW)

**Purpose:** Convert plan file to Beads dependency graph

**Input:**
- Plan file path

**Process:**
1. Read and parse plan markdown
2. Extract phases and tasks
3. **Create Beads epic for the plan** (e.g., `bd new "Action Layer Refactoring"` → `bd-a1b2`)
4. Create ALL tasks as children of the epic:
   ```
   bd new "CreateWorkspace action" --parent bd-a1b2
   bd new "UpdateWorkspace action" --parent bd-a1b2
   ...
   ```
   Each task gets:
   - Title: task name from plan
   - Body: full implementation details from plan section
   - Parent: epic ID (ALL tasks belong to the same epic)
5. Add phase dependencies:
   ```
   # Phase 2 tasks depend on all Phase 1 tasks
   bd dep add bd-a1b2.3 bd-a1b2.1  # Task 2.1 depends on Task 1.1
   bd dep add bd-a1b2.3 bd-a1b2.2  # Task 2.1 depends on Task 1.2
   ...
   ```
6. Return summary

**Key invariant:** Every task in the plan becomes a child of the single epic. The executor uses `--epic <id>` to scope all queries to this plan.

**Output:**
- Epic ID
- Task count by phase
- Dependency summary

**Why subagent:** Isolates context consumption. The sync agent reads the full plan, creates issues, then terminates - freeing context for the main executor.

### Modified Executor

**Start:**
1. Move plan to `active/`
2. Spawn `beads-sync` subagent with plan path
3. Receive epic ID and structure

**Main Loop:**
```
while not terminated:
    ready_tasks = bd ready --epic <epic-id>

    if no ready_tasks:
        if all_done: break
        else: report blocked tasks, break

    spawn implementers in parallel (one per ready task)

    for each completed implementer:
        add free-form notes to Beads issue
        bd done <task-id>

    write batch handoff file

    if context > 70%:
        write final handoff
        break
```

**Termination Conditions:**
- All tasks complete
- All remaining tasks blocked (with no ready tasks)
- Context usage > 70% (preserves room for handoff/ledger)

**Never:**
- Pause to ask user how to proceed
- Start Phase N+1 tasks before Phase N complete (enforced by Beads deps)

### Implementer (MODIFIED)

**On completion:**
1. Add free-form notes to Beads issue body (what was done, files created, decisions made)
2. Call `bd done <task-id>` (unblocks dependents)
3. Return result to executor

### Handoff Files (UNCHANGED)

Continue writing batch handoffs for session continuity. Beads comments handle task-level context.

## Data Flow

1. **User runs `/execute`** → Executor starts
2. **Executor spawns `beads-sync`** → Plan parsed, Beads issues created
3. **beads-sync returns** → Context freed, executor has epic ID
4. **Executor calls `bd ready`** → Gets unblocked tasks (Phase 1 initially)
5. **Parallel implementers spawned** → Each works on one task
6. **Implementer completes** → Notes added to issue, `bd done` called
7. **`bd done` unblocks dependents** → Next `bd ready` returns more tasks
8. **Loop continues** → Until complete or context threshold

## Error Handling

**Task failure:**
- Mark Beads issue with failure notes
- Do NOT call `bd done` (leaves it blocking dependents)
- Continue with other ready tasks
- Report failures in final summary

**All tasks blocked:**
- Report which tasks are blocked and why
- Exit with blocked status
- User can investigate and re-run

**Context threshold:**
- Write handoff with progress summary
- Note which tasks remain
- Exit cleanly for session resumption

## Testing Strategy

**beads-sync skill:**
- Parse simple plan (1 phase, 2 tasks)
- Parse multi-phase plan with dependencies
- Verify Beads issues created with correct deps
- Verify implementation details copied to body

**Executor integration:**
- Mock `bd ready` responses
- Verify parallel spawning of implementers
- Verify `bd done` called on completion
- Verify handoff written per batch
- Verify termination at context threshold

**End-to-end:**
- Create small plan (6-8 tasks, 2 phases)
- Run full execution
- Verify phase ordering respected
- Verify no user prompts during execution

## Open Questions

None - design validated through brainstorm session.
