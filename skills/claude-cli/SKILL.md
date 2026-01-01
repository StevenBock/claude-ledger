---
name: claude-cli
description: Invokes Claude Code CLI for tasks requiring extended thinking. Use when subagent thinking limitations are insufficient.
model: haiku
---

# Claude CLI Invoker

Launches a separate Claude Code process with full extended thinking enabled.

## When to Use

- Code review requiring deep analysis
- Complex debugging that needs extended reasoning
- Any task where subagent thinking limitations hurt quality
- When you need a fresh, unbiased perspective

## Why This Exists

The Task tool spawns subagents **without extended thinking**. This skill invokes the Claude CLI directly, which:
- Gets full extended thinking (opus default)
- Fresh context = unbiased analysis
- Can be restricted to read-only tools
- Isolated from parent conversation

## Input

You will receive:
1. **task** - What you want Claude to do (the prompt)
2. **system_prompt** - Additional instructions to append (optional)
3. **allowed_tools** - Tool restrictions (optional, default: "Read,Glob,Grep,Bash(git*)")
4. **model** - Model to use (optional, default: "opus")
5. **working_dir** - Directory to run in (optional, default: current directory)

## Process

### Step 1: Construct CLI Command

Build the command with all optimal flags:

```bash
claude --print --model [model] \
  --no-session-persistence \
  --no-chrome \
  --max-turns 50 \
  --fallback-model sonnet \
  --allowedTools "[allowed_tools]" \
  --append-system-prompt "[system_prompt]" \
  "[task]"
```

### Flags Explained

| Flag | Purpose |
|------|---------|
| `--print` | Non-interactive mode |
| `--model opus` | Use opus for extended thinking |
| `--no-session-persistence` | Don't save one-off review sessions |
| `--no-chrome` | Disable browser (not needed for reviews) |
| `--max-turns 50` | Prevent runaway (50 turns is generous) |
| `--fallback-model sonnet` | Fall back if opus overloaded |
| `--allowedTools` | Restrict to safe tools |
| `--append-system-prompt` | Add instructions, keep default tooling |

### Step 2: Execute via Bash

Run the command and capture output:

```bash
cd [working_dir] && claude --print --model opus \
  --no-session-persistence \
  --no-chrome \
  --max-turns 50 \
  --fallback-model sonnet \
  --allowedTools "Read,Glob,Grep,Bash(git*)" \
  --append-system-prompt "Think deeply about this task." \
  "Your task prompt here"
```

**Timeout:** Set appropriate timeout (default 10 minutes for complex tasks).

### Step 3: Return Output

Return the CLI output directly. The invoking skill handles parsing.

## Example Invocations

The claude-cli skill will construct the full command with all optimal flags. You just provide the task-specific parameters:

### Code Review
```
Task("claude-cli: Invoke CLI for code review.
task: ultrathink. Review these files for security, correctness, and consistency: [files]
system_prompt: You are a thorough code reviewer. Check security, correctness, completeness, consistency with existing patterns, and style. Find similar existing files to compare against.
allowed_tools: Read,Glob,Grep,Bash(git diff*)
model: opus")
```

### Complex Debugging
```
Task("claude-cli: Invoke CLI for debugging.
task: ultrathink. Debug why [test] is failing. Trace the code path and identify root cause.
system_prompt: You are debugging a test failure. Think step by step through the code.
allowed_tools: Read,Glob,Grep,Bash(npm test*)
model: opus")
```

### Architecture Analysis
```
Task("claude-cli: Invoke CLI for architecture review.
task: ultrathink. Analyze the architecture of [component] and identify potential issues.
system_prompt: You are a software architect reviewing code structure.
allowed_tools: Read,Glob,Grep
model: opus")
```

## Tool Restriction Patterns

| Use Case | Allowed Tools |
|----------|---------------|
| Read-only review | `Read,Glob,Grep` |
| Review with git | `Read,Glob,Grep,Bash(git*)` |
| Review with tests | `Read,Glob,Grep,Bash(npm test*),Bash(php*)` |
| Full access | (omit --allowedTools) |

## Rules

- Always include all optimal flags (see Flags Explained table)
- Always use `--append-system-prompt` to keep default tooling
- Always use `--print` for non-interactive mode
- Always use `--no-session-persistence` for one-off tasks
- Always use `--no-chrome` unless browser needed
- Always use `--max-turns 50` to prevent runaway
- Always use `--fallback-model sonnet` for resilience
- Default to opus for thinking-heavy tasks
- Set reasonable timeout for complex tasks (10 min default)
- Return CLI output verbatim - let caller parse
- This skill uses haiku since it's just orchestration

## Notes

- CLI invocation has ~5-10 second startup overhead
- Fresh context means CLI must read all files itself
- Cost is separate API call (not shared with parent)
- Extended thinking makes this worthwhile for complex analysis
