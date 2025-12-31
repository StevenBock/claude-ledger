// hooks/src/subagent-stop.ts
import * as fs from "fs";
import * as path from "path";
async function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.on("data", (chunk) => data += chunk);
    process.stdin.on("end", () => resolve(data));
  });
}
function parseTranscript(transcriptPath) {
  const result = {
    agentType: null,
    task: "",
    agentId: null
  };
  if (!fs.existsSync(transcriptPath)) {
    return result;
  }
  try {
    const content = fs.readFileSync(transcriptPath, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.tool_name === "Task" && entry.tool_input) {
          const subagentType = entry.tool_input.subagent_type;
          const prompt = entry.tool_input.prompt || "";
          const description = entry.tool_input.description || "";
          const knownAgents = [
            "implementer",
            "reviewer",
            "beads-sync",
            "Explore",
            "Plan",
            "general-purpose"
          ];
          if (subagentType && knownAgents.includes(subagentType)) {
            result.agentType = subagentType;
            result.task = (description || prompt).slice(0, 200);
            break;
          }
        }
        if (entry.message?.content) {
          const content2 = typeof entry.message.content === "string" ? entry.message.content : entry.message.content.map((c) => c.text || "").join(" ");
          const skillMatch = content2.match(/skills\/([\w-]+)\/SKILL\.md/);
          if (skillMatch) {
            result.agentType = skillMatch[1];
          }
        }
      } catch {
        continue;
      }
    }
  } catch {
    return result;
  }
  const transcriptName = path.basename(transcriptPath, ".jsonl");
  result.agentId = result.agentType ? `${result.agentType}-${transcriptName.slice(-8)}` : null;
  return result;
}
function writeAgentLog(projectDir, agentInfo) {
  if (!agentInfo.agentType || !agentInfo.agentId) return;
  const logDir = path.join(projectDir, ".claude", "cache", "agents");
  const logFile = path.join(logDir, "agent-log.jsonl");
  fs.mkdirSync(logDir, { recursive: true });
  const logEntry = {
    agentId: agentInfo.agentId,
    type: agentInfo.agentType,
    task: agentInfo.task.slice(0, 500),
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    status: "completed",
    canResume: true
  };
  fs.appendFileSync(logFile, JSON.stringify(logEntry) + "\n");
}
function appendToLedger(projectDir, agentInfo, summary) {
  if (!agentInfo.agentType) return;
  const ledgerDir = path.join(projectDir, "thoughts", "ledgers");
  if (!fs.existsSync(ledgerDir)) return;
  const ledgerFiles = fs.readdirSync(ledgerDir).filter((f) => f.startsWith("CONTINUITY_") && f.endsWith(".md"));
  if (ledgerFiles.length === 0) return;
  const mostRecent = ledgerFiles.sort((a, b) => {
    const statA = fs.statSync(path.join(ledgerDir, a));
    const statB = fs.statSync(path.join(ledgerDir, b));
    return statB.mtime.getTime() - statA.mtime.getTime();
  })[0];
  const ledgerPath = path.join(ledgerDir, mostRecent);
  let content = fs.readFileSync(ledgerPath, "utf-8");
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const taskPreview = agentInfo.task.slice(0, 100);
  const summaryPreview = summary.slice(0, 200);
  const agentReport = `
### ${agentInfo.agentType} (${timestamp})
- Task: ${taskPreview}${agentInfo.task.length > 100 ? "..." : ""}
- Summary: ${summaryPreview}${summary.length > 200 ? "..." : ""}
`;
  const agentReportsMatch = content.match(/## Agent Reports\n/);
  if (agentReportsMatch) {
    const insertPos = content.indexOf("## Agent Reports\n") + "## Agent Reports\n".length;
    content = content.slice(0, insertPos) + agentReport + content.slice(insertPos);
  } else {
    const nextSectionMatch = content.match(/\n## (?!Agent Reports)/);
    if (nextSectionMatch && nextSectionMatch.index) {
      content = content.slice(0, nextSectionMatch.index) + "\n## Agent Reports\n" + agentReport + content.slice(nextSectionMatch.index);
    } else {
      content += "\n## Agent Reports\n" + agentReport;
    }
  }
  fs.writeFileSync(ledgerPath, content);
}
async function main() {
  const input = JSON.parse(await readStdin());
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  if (input.stop_hook_active) {
    console.log(JSON.stringify({ result: "continue" }));
    return;
  }
  try {
    const agentInfo = parseTranscript(input.transcript_path);
    if (!agentInfo.agentType) {
      console.log(JSON.stringify({ result: "continue" }));
      return;
    }
    writeAgentLog(projectDir, agentInfo);
    const summary = `${agentInfo.agentType} completed task`;
    appendToLedger(projectDir, agentInfo, summary);
    const output = {
      result: "continue",
      message: `[SubagentStop] ${agentInfo.agentType} completed. ID: ${agentInfo.agentId}`
    };
    console.log(JSON.stringify(output));
  } catch (e) {
    console.error("[SubagentStop] Error:", e);
    console.log(JSON.stringify({ result: "continue" }));
  }
}
main().catch((e) => {
  console.error(e);
  console.log(JSON.stringify({ result: "continue" }));
});
