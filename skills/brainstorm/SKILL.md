---
description: Refines rough ideas into fully-formed designs through collaborative questioning
---

# Brainstorm

Turn ideas into fully formed designs through natural collaborative dialogue.
This is DESIGN ONLY. The planner skill handles detailed implementation plans.

## When to Use

- Starting a new feature with unclear requirements
- Exploring multiple approaches to a problem
- Need to understand constraints before coding
- Want human buy-in on design decisions

## Critical Rules

1. **Ask one question at a time** - Wait for response before continuing
2. **NO CODE** - Never write code examples, stay at design level
3. **Spawn research in parallel** - Use Task tool with codebase-locator, codebase-analyzer, pattern-finder

## Research Subagents

When you need codebase context, spawn these in parallel using Task:

| Subagent | Purpose |
|----------|---------|
| codebase-locator | Find WHERE files are (paths only, no content) |
| codebase-analyzer | Explain HOW code works (with file:line refs) |
| pattern-finder | Find existing patterns to follow |

**Parallel spawn example:**
In a SINGLE message, spawn:
- Task: "codebase-locator: Find files related to [topic]"
- Task: "codebase-analyzer: Analyze existing [feature]"
- Task: "pattern-finder: Find patterns for [similar functionality]"

## Process

### Phase 1: Understanding
- Spawn research skills in parallel to gather context
- Ask focused questions about purpose, constraints, success criteria
- One question at a time, wait for answer

### Phase 2: Exploring
- Propose 2-3 different approaches with trade-offs
- Lead with your recommendation and explain WHY
- Include effort estimate, risks, dependencies
- Wait for feedback before proceeding

### Phase 3: Presenting
- Break design into sections of 200-300 words
- Ask after EACH section: "Does this look right so far?"
- Cover: Architecture, Components, Data Flow, Error Handling, Testing
- Don't proceed to next section until current one is validated

### Phase 4: Finalizing
- Write validated design to `thoughts/shared/designs/YYYY-MM-DD-{topic}-design.md`
- Ask: "Ready for the planner to create a detailed implementation plan?"

## Output Format

Write to: `thoughts/shared/designs/YYYY-MM-DD-{topic}-design.md`

```markdown
---
date: YYYY-MM-DD
topic: "[Design Topic]"
status: draft | validated
---

## Problem Statement
What we're solving and why

## Constraints
Non-negotiables, limitations

## Approach
Chosen approach and why

## Architecture
High-level structure

## Components
Key pieces and responsibilities

## Data Flow
How data moves through the system

## Error Handling
Strategy for failures

## Testing Strategy
How we'll verify correctness

## Open Questions
Unresolved items, if any
```

## Principles

- **Design-only**: NO CODE. Describe components, not implementations.
- **Subagents-first**: ALWAYS use Task for code analysis
- **Parallel-spawn**: Spawn multiple Tasks in a SINGLE message
- **One-question**: Ask ONE question at a time, wait for answer
- **YAGNI**: Remove unnecessary features from ALL designs
- **Explore-alternatives**: ALWAYS propose 2-3 approaches before settling
- **Incremental-validation**: Present in sections, validate each before proceeding

## Never Do

- Write code snippets or examples
- Provide file paths with line numbers
- Specify exact function signatures
- Jump to implementation details - stay at design level
