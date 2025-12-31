---
description: Refine ideas into designs through collaborative questioning
---

# Brainstorm

Turn ideas into fully formed designs through natural collaborative dialogue.
This is DESIGN ONLY. The `/planner` command handles detailed implementation plans.

## When to Use

- Starting a new feature with unclear requirements
- Exploring multiple approaches to a problem
- Need to understand constraints before coding
- Want human buy-in on design decisions

## Critical Rules

1. **Start with open prompt** - First, ask user to describe their idea/problem in their own words
2. **Use AskUserQuestion for clarifying questions** - After user provides details, use AskUserQuestion tool for all follow-up questions with structured options
3. **One question at a time** - Wait for response before continuing
4. **NO CODE** - Never write code examples, stay at design level
5. **Parallel research** - Spawn Task (Explore) agents in parallel for codebase context

**IMPORTANT**: Let user describe their idea first, THEN use `AskUserQuestion` for clarifying questions.

## Research with Parallel Agents

When you need codebase context, spawn multiple Task agents in parallel using `subagent_type=Explore`:

**Parallel spawn example** - In a SINGLE message, spawn all at once:
- Task (Explore): "Find files related to [topic] and explain their purpose"
- Task (Explore): "Analyze how [feature] works in this codebase"
- Task (Explore): "Find patterns for [similar functionality]"

This saves context by offloading research to subagents that return summarized results.

## Using AskUserQuestion

**WRONG - Do NOT do this:**
```
What's the primary pain point?
- Cards feel too cluttered/busy?
- Hard to scan/compare plugins quickly?
- Stats section not informative enough?
```

**RIGHT - Always do this instead:**
```
AskUserQuestion(questions: [
  {
    question: "What's the primary pain point with the current UI?",
    header: "Pain point",
    options: [
      { label: "Too cluttered", description: "Cards have too much information, hard to scan" },
      { label: "Poor visual hierarchy", description: "Can't quickly find what matters" },
      { label: "Confusing actions", description: "Not clear how to deploy or manage plugins" },
      { label: "Missing information", description: "Need more details shown on cards" }
    ],
    multiSelect: true
  }
])
```

**EVERY question to the user MUST use this tool. No exceptions.**

**When to use:**
- Choosing between approaches (always lead with recommended option)
- Clarifying requirements or constraints
- Validating assumptions before proceeding
- Getting sign-off on design sections
- ANY time you need user input

## Process

### Phase 0: Initial Prompt
- Ask user to describe their idea, problem, or feature in their own words
- Wait for their response before proceeding
- Do NOT use AskUserQuestion yet - let them explain freely

### Phase 1: Understanding
- Spawn parallel Task (Explore) agents to gather codebase context based on what user described
- Use `AskUserQuestion` to clarify purpose, constraints, success criteria
- One question at a time, wait for answer

### Phase 2: Exploring
- Propose 2-3 different approaches with trade-offs
- Use `AskUserQuestion` to let user choose approach (recommend one)
- Include risks and dependencies in option descriptions
- Wait for selection before proceeding

### Phase 3: Presenting
- Break design into sections of 200-300 words
- Use `AskUserQuestion` after EACH section to validate
- Cover: Architecture, Components, Data Flow, Error Handling, Testing
- Don't proceed to next section until current one is validated

### Phase 4: Finalizing
- Write validated design to `thoughts/shared/designs/YYYY-MM-DD-{topic}-design.md`
- Use `AskUserQuestion`: "Ready for the planner to create implementation plan?"

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
- **Parallel-research**: Spawn multiple Task (Explore) agents in a SINGLE message
- **One-question**: Ask ONE question at a time, wait for answer
- **YAGNI**: Remove unnecessary features from ALL designs
- **Explore-alternatives**: ALWAYS propose 2-3 approaches before settling
- **Incremental-validation**: Present in sections, validate each before proceeding

## Never Do

- Use AskUserQuestion before user has described their idea (let them explain first)
- Ask clarifying questions as plain text after Phase 0 (use AskUserQuestion)
- Write code snippets or examples
- Provide file paths with line numbers
- Specify exact function signatures
- Jump to implementation details - stay at design level
