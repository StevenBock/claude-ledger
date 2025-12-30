# micode for Claude Code

Structured **Brainstorm → Plan → Implement** workflow with session continuity.

## Installation

### From Marketplace

```bash
claude plugin install micode
```

### From Source

```bash
git clone https://github.com/vtemian/micode.git ~/.claude/plugins/micode-claude
cd ~/.claude/plugins/micode-claude
npm install
npm run build
```

Then add to your settings:

```json
{
  "plugins": ["~/.claude/plugins/micode-claude"]
}
```

## Workflow

```
Brainstorm → Plan → Implement
     ↓         ↓        ↓
  research  research  executor
```

Research skills (codebase-locator, codebase-analyzer, pattern-finder) are spawned within brainstorm and plan phases.

### 1. Brainstorm

Refine rough ideas into fully-formed designs through collaborative questioning.

- One question at a time
- 2-3 approaches with trade-offs
- Section-by-section validation
- Spawns research skills to understand codebase
- Output: `thoughts/shared/designs/YYYY-MM-DD-{topic}-design.md`

### 2. Plan

Transform validated designs into comprehensive implementation plans.

- Spawns research skills for exact paths, signatures, patterns
- Bite-sized tasks (2-5 minutes each)
- Exact file paths, complete code examples
- TDD workflow: failing test → verify fail → implement → verify pass → commit
- Output: `thoughts/shared/plans/YYYY-MM-DD-{topic}.md`

### 3. Implement

Execute plan with intelligent parallelization:

- Analyzes task dependencies
- Batches independent tasks for parallel execution
- Per-task implementer → reviewer cycle
- Generates batch handoff documents for context continuity
- Max 3 cycles per task before blocking
- Output: `thoughts/shared/handoffs/YYYY-MM-DD-{plan}-batch-{N}.md`

### 4. Session Continuity

Maintain context across clears with structured compaction:

```
/ledger
```

Creates/updates `thoughts/ledgers/CONTINUITY_{session-name}.md` with:
- Goal and constraints
- Progress tracking (Done/In Progress/Blocked)
- Key decisions with rationale
- File operations (automatically tracked)
- Next steps

The ledger is automatically injected on `/clear`, `/resume`, or context compaction.

## Commands

| Command | Description |
|---------|-------------|
| `/brainstorm` | Refine ideas into designs through collaborative questioning |
| `/planner` | Create detailed implementation plan from a validated design |
| `/execute` | Execute an implementation plan with parallel task batching |
| `/ledger` | Create or update continuity ledger |
| `/search` | Search past plans and ledgers |

## Skills

| Skill | Purpose |
|-------|---------|
| `brainstorm` | Design exploration through questioning |
| `planner` | Create detailed implementation plans |
| `executor` | Execute plan with parallel batching |
| `implementer` | Execute single task from plan |
| `reviewer` | Review implementation correctness |
| `codebase-locator` | Find WHERE files are |
| `codebase-analyzer` | Explain HOW code works |
| `pattern-finder` | Find existing patterns to follow |

## Hooks

| Hook | Event | Description |
|------|-------|-------------|
| ledger-loader | SessionStart | Inject ledger on resume/clear/compact |
| context-injector | SessionStart | Inject .cursorrules if present |
| file-ops-tracker | PostToolUse | Track read/write operations |
| comment-checker | PostToolUse (Edit) | Warn about unnecessary comments |
| artifact-auto-index | PostToolUse (Write) | Index plans and ledgers |
| auto-save-ledger | PreCompact | Save file ops to ledger before compact |

## MCP Servers

| Server | Description |
|--------|-------------|
| context7 | Documentation lookup |
| artifact-index | Full-text search across plans and ledgers |

### Artifact Index Tools

The `artifact-index` MCP server provides:

- **artifact_search** - Full-text search across indexed plans and ledgers
- **artifact_index** - Index a plan or ledger file
- **artifact_list** - List all indexed artifacts

Database stored at: `~/.config/claude-code/artifact-index/context.db`

## Structure

```
micode-claude/
├── .claude-plugin/
│   └── plugin.json         # Plugin manifest
├── .mcp.json               # MCP server config
├── commands/               # Slash commands
│   ├── brainstorm.md
│   ├── planner.md
│   ├── execute.md
│   ├── ledger.md
│   └── search.md
├── skills/                 # Agent skills
│   ├── brainstorm/
│   ├── planner/
│   ├── executor/
│   ├── implementer/
│   ├── reviewer/
│   ├── codebase-locator/
│   ├── codebase-analyzer/
│   └── pattern-finder/
├── hooks/                  # Event hooks
│   ├── hooks.json
│   ├── src/               # TypeScript sources
│   └── dist/              # Compiled JS
├── servers/               # MCP servers
│   └── artifact-index/
│       ├── src/           # TypeScript sources
│       └── dist/          # Compiled JS
└── thoughts/              # Artifacts (gitignored)
    ├── ledgers/
    └── shared/
        ├── designs/
        ├── handoffs/
        └── plans/
```

## Development

```bash
npm install
npm run build      # Build hooks
npm run typecheck  # Type check
```

## Philosophy

1. **Brainstorm first** - Refine ideas before coding
2. **Research before implementing** - Understand the codebase
3. **Plan with human buy-in** - Get approval before coding
4. **Parallel investigation** - Spawn multiple skills for speed
5. **Continuous verification** - Implementer + Reviewer per task
6. **Session continuity** - Never lose context across clears

## Credits

Ported from [micode](https://github.com/vtemian/micode) OpenCode plugin.

Built on techniques from:
- [HumanLayer ACE-FCA](https://github.com/humanlayer/12-factor-agents) - Research → Plan → Implement methodology
- [Factory.ai Context Compression](https://factory.ai/blog/context-compression) - Structured compaction research
