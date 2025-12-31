/**
 * Transcript Parser Module
 *
 * Parses JSONL transcript files from Claude Code sessions and extracts
 * high-signal data for use by PreCompact hooks and auto-handoff generation.
 */

import * as fs from "fs";

export interface TodoItem {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed";
}

export interface ToolCall {
  name: string;
  timestamp?: string;
  input?: Record<string, unknown>;
  success?: boolean;
}

export interface TranscriptSummary {
  lastTodos: TodoItem[];
  recentToolCalls: ToolCall[];
  lastAssistantMessage: string;
  filesModified: string[];
  errorsEncountered: string[];
}

interface TranscriptEntry {
  type?: string;
  role?: string;
  content?: unknown;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_result?: unknown;
  timestamp?: string;
  error?: string;
}

interface TodoWriteInput {
  todos?: Array<{
    id?: string;
    content?: string;
    status?: string;
  }>;
}

interface EditWriteInput {
  file_path?: string;
  path?: string;
}

interface BashInput {
  command?: string;
}

interface BashResult {
  exit_code?: number;
  exitCode?: number;
  stderr?: string;
  error?: string;
}

/**
 * Parse a JSONL transcript file and extract high-signal data.
 */
export function parseTranscript(transcriptPath: string): TranscriptSummary {
  const summary: TranscriptSummary = {
    lastTodos: [],
    recentToolCalls: [],
    lastAssistantMessage: "",
    filesModified: [],
    errorsEncountered: [],
  };

  if (!fs.existsSync(transcriptPath)) {
    return summary;
  }

  const content = fs.readFileSync(transcriptPath, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim());

  const allToolCalls: ToolCall[] = [];
  const modifiedFiles = new Set<string>();
  const errors: string[] = [];
  let lastTodoState: TodoItem[] = [];
  let lastAssistant = "";

  for (const line of lines) {
    try {
      const entry: TranscriptEntry = JSON.parse(line);

      // Extract last assistant message
      if (entry.role === "assistant" && typeof entry.content === "string") {
        lastAssistant = entry.content;
      } else if (entry.type === "assistant" && typeof entry.content === "string") {
        lastAssistant = entry.content;
      }

      // Extract tool calls
      if (entry.tool_name || entry.type === "tool_use") {
        const toolName =
          entry.tool_name || ((entry as Record<string, unknown>).name as string);
        if (toolName) {
          const toolCall: ToolCall = {
            name: toolName,
            timestamp: entry.timestamp,
            input: entry.tool_input,
            success: true,
          };

          // Check for TodoWrite to capture state
          if (toolName === "TodoWrite") {
            const input = entry.tool_input as TodoWriteInput | undefined;
            if (input?.todos) {
              lastTodoState = input.todos.map((t, idx) => ({
                id: t.id || `todo-${idx}`,
                content: t.content || "",
                status: (t.status as TodoItem["status"]) || "pending",
              }));
            }
          }

          // Track file modifications from Edit/Write tools
          if (toolName === "Edit" || toolName === "Write") {
            const input = entry.tool_input as EditWriteInput | undefined;
            const filePath = input?.file_path || input?.path;
            if (filePath && typeof filePath === "string") {
              modifiedFiles.add(filePath);
            }
          }

          // Track Bash commands for potential errors
          if (toolName === "Bash") {
            const input = entry.tool_input as BashInput | undefined;
            if (input?.command) {
              toolCall.input = { command: input.command };
            }
          }

          allToolCalls.push(toolCall);
        }
      }

      // Extract tool results and check for failures
      if (entry.type === "tool_result" || entry.tool_result !== undefined) {
        const result = entry.tool_result as BashResult | undefined;

        if (result) {
          const exitCode = result.exit_code ?? result.exitCode;
          if (exitCode !== undefined && exitCode !== 0) {
            if (allToolCalls.length > 0) {
              allToolCalls[allToolCalls.length - 1].success = false;
            }

            const errorMsg = result.stderr || result.error || "Command failed";
            const lastTool = allToolCalls[allToolCalls.length - 1];
            const command =
              (lastTool?.input as BashInput)?.command || "unknown command";
            errors.push(`${command}: ${errorMsg.substring(0, 200)}`);
          }
        }

        if (entry.error) {
          errors.push(entry.error.substring(0, 200));
          if (allToolCalls.length > 0) {
            allToolCalls[allToolCalls.length - 1].success = false;
          }
        }
      }
    } catch {
      continue;
    }
  }

  summary.lastTodos = lastTodoState;
  summary.recentToolCalls = allToolCalls.slice(-5);
  summary.lastAssistantMessage = lastAssistant.substring(0, 500);
  summary.filesModified = Array.from(modifiedFiles);
  summary.errorsEncountered = errors.slice(-5);

  return summary;
}

/**
 * Generate a markdown auto-handoff document from a transcript summary.
 */
export function generateAutoHandoff(
  summary: TranscriptSummary,
  sessionName: string
): string {
  const timestamp = new Date().toISOString();
  const lines: string[] = [];

  lines.push("---");
  lines.push(`date: ${timestamp}`);
  lines.push("type: auto-handoff");
  lines.push("trigger: pre-compact-auto");
  lines.push(`session: ${sessionName}`);
  lines.push("---");
  lines.push("");

  lines.push("# Auto-Handoff (PreCompact)");
  lines.push("");
  lines.push(
    "This handoff was automatically generated before context compaction."
  );
  lines.push("");

  // In Progress section (TodoWrite state)
  lines.push("## In Progress");
  lines.push("");
  if (summary.lastTodos.length > 0) {
    const inProgress = summary.lastTodos.filter(
      (t) => t.status === "in_progress"
    );
    const pending = summary.lastTodos.filter((t) => t.status === "pending");
    const completed = summary.lastTodos.filter((t) => t.status === "completed");

    if (inProgress.length > 0) {
      lines.push("**Active:**");
      inProgress.forEach((t) => lines.push(`- [>] ${t.content}`));
      lines.push("");
    }

    if (pending.length > 0) {
      lines.push("**Pending:**");
      pending.forEach((t) => lines.push(`- [ ] ${t.content}`));
      lines.push("");
    }

    if (completed.length > 0) {
      lines.push("**Completed this session:**");
      completed.forEach((t) => lines.push(`- [x] ${t.content}`));
      lines.push("");
    }
  } else {
    lines.push("No TodoWrite state captured.");
    lines.push("");
  }

  // Recent Actions section
  lines.push("## Recent Actions");
  lines.push("");
  if (summary.recentToolCalls.length > 0) {
    summary.recentToolCalls.forEach((tc) => {
      const status = tc.success ? "OK" : "FAILED";
      let inputSummary = "";
      if (tc.input) {
        const jsonStr = JSON.stringify(tc.input);
        inputSummary = ` - ${jsonStr.substring(0, 80)}${jsonStr.length > 80 ? "..." : ""}`;
      }
      lines.push(`- ${tc.name} [${status}]${inputSummary}`);
    });
  } else {
    lines.push("No tool calls recorded.");
  }
  lines.push("");

  // Files Modified section
  lines.push("## Files Modified");
  lines.push("");
  if (summary.filesModified.length > 0) {
    summary.filesModified.forEach((f) => lines.push(`- \`${f}\``));
  } else {
    lines.push("No files modified.");
  }
  lines.push("");

  // Errors section
  if (summary.errorsEncountered.length > 0) {
    lines.push("## Errors Encountered");
    lines.push("");
    summary.errorsEncountered.forEach((e) => {
      lines.push("```");
      lines.push(e);
      lines.push("```");
    });
    lines.push("");
  }

  // Last Context section
  lines.push("## Last Context");
  lines.push("");
  if (summary.lastAssistantMessage) {
    lines.push("```");
    lines.push(summary.lastAssistantMessage);
    if (summary.lastAssistantMessage.length >= 500) {
      lines.push("[... truncated]");
    }
    lines.push("```");
  } else {
    lines.push("No assistant message captured.");
  }
  lines.push("");

  lines.push("## Suggested Next Steps");
  lines.push("");
  lines.push('1. Review the "In Progress" section for current task state');
  lines.push('2. Check "Errors Encountered" if debugging issues');
  lines.push("3. Read modified files to understand recent changes");
  lines.push("4. Continue from where session left off");
  lines.push("");

  return lines.join("\n");
}
