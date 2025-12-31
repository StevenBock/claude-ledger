# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

claudeledger is a Claude Code plugin providing a structured **Brainstorm → Plan → Implement** workflow with session continuity. It includes skills, commands, hooks, and an MCP server for artifact indexing.

## Build Commands

```bash
npm install              # Install deps (auto-runs postinstall for servers/artifact-index)
npm run build            # Build hooks and MCP server
npm run build:hooks      # Build only hooks (esbuild → hooks/dist/*.mjs)
npm run build:server     # Build only artifact-index server (esbuild → servers/artifact-index/dist/server.mjs)
npm run typecheck        # Type check hooks (no emit)
npm run clean            # Remove dist directories
```

## Development Workflow

After modifying hooks or MCP server:
1. Run `npm run build` to rebuild
2. Restart Claude Code to pick up hook/MCP changes
3. Shell hooks (.sh) don't require rebuild, but TypeScript hooks (.ts → .mjs) do

## Architecture

### Plugin Structure
```
.claude-plugin/plugin.json  # Plugin manifest - defines commands, skills, hooks, mcpServers paths
.mcp.json                   # MCP server configurations (context7, artifact-index)
commands/                   # Slash commands (markdown files)
skills/                     # Agent skills (SKILL.md files with frontmatter)
hooks/                      # Event hooks (hooks.json + TypeScript sources)
servers/artifact-index/     # SQLite-backed full-text search MCP server
thoughts/                   # Runtime artifacts (ledgers, designs, plans) - gitignored
```

### Workflow Pipeline
```
brainstorm → planner → executor → implementer/reviewer (cycles)
     ↓           ↓
  research    research
  (locator, analyzer, pattern-finder)
```

Skills spawn research subagents (codebase-locator, codebase-analyzer, pattern-finder) via Task tool for codebase context.

### Skills (skills/*/SKILL.md)
- **brainstorm**: Design exploration, asks one question at a time, NO CODE, spawns research skills in parallel
- **planner**: Creates detailed implementation plans with exact paths, complete code, TDD workflow
- **executor**: Parallel task execution with dependency analysis, max 3 review cycles per task
- **implementer**: Executes single task from plan, stops on mismatch
- **reviewer**: Verifies correctness against plan, runs tests
- **codebase-locator**: Returns file paths only, no content analysis
- **codebase-analyzer**: Explains code with file:line references, traces data flow
- **pattern-finder**: Finds 2-3 best examples of existing patterns

### Commands (commands/*.md)
- `/brainstorm`: Refine ideas into designs through collaborative questioning
- `/planner`: Create detailed implementation plan from a validated design
- `/execute`: Invokes executor skill to run an implementation plan
- `/plans [n|active|done|all]`: List plans or execute plan #n from pending
- `/ledger`: Creates/updates continuity ledger in `thoughts/ledgers/CONTINUITY_{session}.md`
- `/search`: Searches artifact-index for past plans and ledgers

### Hooks (hooks/hooks.json)
| Event | Matcher | Hook | Notes |
|-------|---------|------|-------|
| SessionStart | resume\|compact\|clear | ledger-loader | Loads most recent CONTINUITY_*.md |
| SessionStart | resume\|compact\|clear | context-injector | Injects additional context |
| PostToolUse | Read\|Edit\|Write | file-ops-tracker | Tracks file operations for ledger |
| PostToolUse | Write | artifact-auto-index | Auto-indexes new plans/ledgers |
| PostToolUse | Edit | comment-checker | Checks for inline comments |
| PostToolUse | ExitPlanMode | plan-copier | Copies plan to pending/ |
| PreCompact | * | auto-save-ledger | Saves ledger before compaction |

**Hook Implementation Pattern**: Shell scripts (.sh) call TypeScript (.ts → .mjs via esbuild). Hooks receive JSON on stdin, output JSON with `result: "continue"` and optional `hookSpecificOutput.additionalContext`.

### MCP Server (servers/artifact-index/)
SQLite-backed full-text search across plans and ledgers using FTS5.

**Tools**: `artifact_search`, `artifact_index`, `artifact_list`
**Database**: `~/.config/claude-code/artifact-index/context.db`
**Run manually**: `npm run server:artifact-index`

Artifact detection (in `servers/artifact-index/src/server.ts:122-133`):
- Plans: `thoughts/shared/plans/**/*.md` or `thoughts/shared/designs/**/*.md`
- Ledgers: `thoughts/ledgers/CONTINUITY_*.md`

## Artifact Locations
- Designs: `thoughts/shared/designs/YYYY-MM-DD-{topic}-design.md`
- Plans (lifecycle): `thoughts/shared/plans/{pending|active|done}/YYYY-MM-DD-{topic}.md`
- Handoffs: `thoughts/shared/handoffs/YYYY-MM-DD-{plan-name}-batch-{N}.md`
- Ledgers: `thoughts/ledgers/CONTINUITY_{session-name}.md`

## Plan Lifecycle
```
pending/ → active/ → done/
```
- **pending/**: New plans from planner (via plan-copier hook)
- **active/**: Plans currently being executed
- **done/**: Completed plans (all tasks done)

## Key Patterns

### Skill Frontmatter
```yaml
---
description: One-line description for skill discovery
---
```

### Research Skill Spawning
Skills spawn research subagents in parallel using Task tool in a SINGLE message for true parallelism.

### TDD Workflow (Planner/Implementer)
1. Write failing test
2. Run test to verify failure
3. Implement minimal code
4. Run test to verify pass
5. Commit

### Ledger Format
Used for session continuity across `/clear` or context compaction. Contains: Goal, Constraints, Progress (Done/In Progress/Blocked), Key Decisions, Next Steps, File Operations, Working Set.

## Adding New Components

### New Skill
1. Create `skills/{skill-name}/SKILL.md` with frontmatter:
   ```yaml
   ---
   name: skill-name
   description: One-line for skill discovery
   ---
   ```
2. Skills auto-discovered via `.claude-plugin/plugin.json` → `skills: "./skills/"`

### New Command
1. Create `commands/{command}.md` with frontmatter:
   ```yaml
   ---
   description: One-line for /help
   argument-hint: [optional arg format]
   ---
   ```
2. Commands auto-discovered via `.claude-plugin/plugin.json` → `commands: "./commands/"`

### New Hook
1. Add entry to `hooks/hooks.json` under appropriate event
2. Create shell script in `hooks/` that calls TypeScript if needed
3. If TypeScript needed: create in `hooks/src/`, run `npm run build:hooks`
