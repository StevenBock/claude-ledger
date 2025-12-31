// hooks/src/auto-save-ledger.ts
import * as fs2 from "fs";
import * as path from "path";

// hooks/src/transcript-parser.ts
import * as fs from "fs";
function parseTranscript(transcriptPath) {
  const summary = {
    lastTodos: [],
    recentToolCalls: [],
    lastAssistantMessage: "",
    filesModified: [],
    errorsEncountered: []
  };
  if (!fs.existsSync(transcriptPath)) {
    return summary;
  }
  const content = fs.readFileSync(transcriptPath, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim());
  const allToolCalls = [];
  const modifiedFiles = /* @__PURE__ */ new Set();
  const errors = [];
  let lastTodoState = [];
  let lastAssistant = "";
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.role === "assistant" && typeof entry.content === "string") {
        lastAssistant = entry.content;
      } else if (entry.type === "assistant" && typeof entry.content === "string") {
        lastAssistant = entry.content;
      }
      if (entry.tool_name || entry.type === "tool_use") {
        const toolName = entry.tool_name || entry.name;
        if (toolName) {
          const toolCall = {
            name: toolName,
            timestamp: entry.timestamp,
            input: entry.tool_input,
            success: true
          };
          if (toolName === "TodoWrite") {
            const input = entry.tool_input;
            if (input?.todos) {
              lastTodoState = input.todos.map((t, idx) => ({
                id: t.id || `todo-${idx}`,
                content: t.content || "",
                status: t.status || "pending"
              }));
            }
          }
          if (toolName === "Edit" || toolName === "Write") {
            const input = entry.tool_input;
            const filePath = input?.file_path || input?.path;
            if (filePath && typeof filePath === "string") {
              modifiedFiles.add(filePath);
            }
          }
          if (toolName === "Bash") {
            const input = entry.tool_input;
            if (input?.command) {
              toolCall.input = { command: input.command };
            }
          }
          allToolCalls.push(toolCall);
        }
      }
      if (entry.type === "tool_result" || entry.tool_result !== void 0) {
        const result = entry.tool_result;
        if (result) {
          const exitCode = result.exit_code ?? result.exitCode;
          if (exitCode !== void 0 && exitCode !== 0) {
            if (allToolCalls.length > 0) {
              allToolCalls[allToolCalls.length - 1].success = false;
            }
            const errorMsg = result.stderr || result.error || "Command failed";
            const lastTool = allToolCalls[allToolCalls.length - 1];
            const command = lastTool?.input?.command || "unknown command";
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
function generateAutoHandoff(summary, sessionName) {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const lines = [];
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
  lines.push("## Files Modified");
  lines.push("");
  if (summary.filesModified.length > 0) {
    summary.filesModified.forEach((f) => lines.push(`- \`${f}\``));
  } else {
    lines.push("No files modified.");
  }
  lines.push("");
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

// hooks/src/auto-save-ledger.ts
async function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.on("data", (chunk) => data += chunk);
    process.stdin.on("end", () => resolve(data));
  });
}
function loadDecisions(projectDir, sessionId) {
  const statePath = path.join(
    projectDir,
    ".claude",
    "state",
    "sessions",
    sessionId,
    "decisions.json"
  );
  if (!fs2.existsSync(statePath)) return [];
  try {
    const data = JSON.parse(fs2.readFileSync(statePath, "utf-8"));
    return data.decisions || [];
  } catch {
    return [];
  }
}
function loadFileOps(projectDir, sessionId) {
  const statePath = path.join(
    projectDir,
    ".claude",
    "state",
    "sessions",
    sessionId,
    "file-ops.json"
  );
  if (!fs2.existsSync(statePath)) {
    return { read: [], modified: [] };
  }
  try {
    const data = JSON.parse(fs2.readFileSync(statePath, "utf-8"));
    return data.files || { read: [], modified: [] };
  } catch {
    return { read: [], modified: [] };
  }
}
function formatDecisionHistory(decisions) {
  if (decisions.length === 0) return "";
  let output = "## Decision History\n";
  for (const d of decisions) {
    const topic = d.header || d.question.slice(0, 30);
    output += `### ${topic}
`;
    output += `- **Question:** ${d.question}
`;
    output += `- **Options:** [${d.options.join(", ")}]
`;
    output += `- **Chosen:** ${d.chosen.join(", ")}

`;
  }
  return output;
}
function findActivePlan(projectDir) {
  const activeDir = path.join(projectDir, "thoughts", "shared", "plans", "active");
  if (!fs2.existsSync(activeDir)) return null;
  const files = fs2.readdirSync(activeDir).filter((f) => f.endsWith(".md"));
  if (files.length === 0) return null;
  let latest = { file: "", mtime: 0 };
  for (const f of files) {
    const stat = fs2.statSync(path.join(activeDir, f));
    if (stat.mtimeMs > latest.mtime) {
      latest = { file: f, mtime: stat.mtimeMs };
    }
  }
  const planPath = path.join(activeDir, latest.file);
  const content = fs2.readFileSync(planPath, "utf-8");
  const progressMatch = content.match(/Progress \| `?(\d+\/\d+ tasks)`?/);
  const progress = progressMatch ? progressMatch[1] : "unknown";
  return { path: `thoughts/shared/plans/active/${latest.file}`, progress };
}
function formatActiveContext(activePlan) {
  if (!activePlan) return "";
  return `## Active Context
### Working Plan
- File: \`${activePlan.path}\`
- Progress: ${activePlan.progress}

`;
}
function findCurrentLedger(projectDir) {
  const ledgerDir = path.join(projectDir, "thoughts", "ledgers");
  if (!fs2.existsSync(ledgerDir)) return null;
  const files = fs2.readdirSync(ledgerDir);
  const ledgerFiles = files.filter(
    (f) => f.startsWith("CONTINUITY_") && f.endsWith(".md")
  );
  if (ledgerFiles.length === 0) return null;
  let latestFile = ledgerFiles[0];
  let latestMtime = 0;
  for (const file of ledgerFiles) {
    const filePath = path.join(ledgerDir, file);
    const stat = fs2.statSync(filePath);
    if (stat.mtime.getTime() > latestMtime) {
      latestMtime = stat.mtime.getTime();
      latestFile = file;
    }
  }
  return path.join(ledgerDir, latestFile);
}
function updateLedger(ledgerPath, fileOps, decisions, activePlan) {
  if (!fs2.existsSync(ledgerPath)) return;
  let content = fs2.readFileSync(ledgerPath, "utf-8");
  const readSection = fileOps.read.length > 0 ? fileOps.read.map((p) => `- \`${p}\``).join("\n") : "- (none this session)";
  const modifiedSection = fileOps.modified.length > 0 ? fileOps.modified.map((p) => `- \`${p}\``).join("\n") : "- (none this session)";
  const fileOpsRegex = /## File Operations[\s\S]*?(?=## |$)/;
  const newFileOps = `## File Operations
### Read
${readSection}

### Modified
${modifiedSection}

`;
  if (fileOpsRegex.test(content)) {
    content = content.replace(fileOpsRegex, newFileOps);
  } else {
    content += "\n" + newFileOps;
  }
  const decisionHistory = formatDecisionHistory(decisions);
  if (decisionHistory) {
    const decisionRegex = /## Decision History[\s\S]*?(?=## |$)/;
    if (decisionRegex.test(content)) {
      content = content.replace(decisionRegex, decisionHistory);
    } else {
      content += decisionHistory;
    }
  }
  const activeContext = formatActiveContext(activePlan);
  if (activeContext) {
    const activeContextRegex = /## Active Context[\s\S]*?(?=## |$)/;
    if (activeContextRegex.test(content)) {
      content = content.replace(activeContextRegex, activeContext);
    } else {
      content += activeContext;
    }
  }
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  content = content.replace(/Updated: .+/, `Updated: ${timestamp}`);
  fs2.writeFileSync(ledgerPath, content);
}
function clearFileOps(projectDir, sessionId) {
  const statePath = path.join(
    projectDir,
    ".claude",
    "state",
    "sessions",
    sessionId,
    "file-ops.json"
  );
  if (fs2.existsSync(statePath)) {
    const data = JSON.parse(fs2.readFileSync(statePath, "utf-8"));
    data.files = { read: [], modified: [] };
    fs2.writeFileSync(statePath, JSON.stringify(data, null, 2));
  }
}
function clearDecisions(projectDir, sessionId) {
  const statePath = path.join(
    projectDir,
    ".claude",
    "state",
    "sessions",
    sessionId,
    "decisions.json"
  );
  if (fs2.existsSync(statePath)) {
    fs2.unlinkSync(statePath);
  }
}
function extractSessionName(ledgerPath) {
  const filename = path.basename(ledgerPath);
  return filename.replace("CONTINUITY_", "").replace(".md", "");
}
function generateComprehensiveHandoff(projectDir, transcriptPath, sessionName) {
  try {
    const summary = parseTranscript(transcriptPath);
    const handoffContent = generateAutoHandoff(summary, sessionName);
    const handoffDir = path.join(
      projectDir,
      "thoughts",
      "shared",
      "handoffs",
      sessionName
    );
    fs2.mkdirSync(handoffDir, { recursive: true });
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const handoffFile = `auto-handoff-${timestamp}.md`;
    const handoffPath = path.join(handoffDir, handoffFile);
    fs2.writeFileSync(handoffPath, handoffContent);
    return `thoughts/shared/handoffs/${sessionName}/${handoffFile}`;
  } catch (e) {
    console.error("Failed to generate auto-handoff:", e);
    return null;
  }
}
async function main() {
  const input = JSON.parse(await readStdin());
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const ledgerPath = findCurrentLedger(projectDir);
  if (!ledgerPath) {
    const output2 = {
      continue: true,
      systemMessage: "[PreCompact] No ledger found. Consider running /ledger to preserve state."
    };
    console.log(JSON.stringify(output2));
    return;
  }
  const fileOps = loadFileOps(projectDir, input.session_id);
  const decisions = loadDecisions(projectDir, input.session_id);
  const activePlan = findActivePlan(projectDir);
  updateLedger(ledgerPath, fileOps, decisions, activePlan);
  clearFileOps(projectDir, input.session_id);
  clearDecisions(projectDir, input.session_id);
  let handoffPath = null;
  if (input.trigger === "auto" && input.transcript_path) {
    const sessionName = extractSessionName(ledgerPath);
    handoffPath = generateComprehensiveHandoff(
      projectDir,
      input.transcript_path,
      sessionName
    );
  }
  let message = `[PreCompact] Ledger updated. State saved to ${path.basename(ledgerPath)}.`;
  if (handoffPath) {
    message += ` Auto-handoff: ${handoffPath}`;
  }
  const output = {
    continue: true,
    systemMessage: message
  };
  console.log(JSON.stringify(output));
}
main().catch((e) => {
  console.error(e);
  console.log(JSON.stringify({ continue: true }));
});
