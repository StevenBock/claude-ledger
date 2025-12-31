// hooks/src/auto-save-ledger.ts
import * as fs from "fs";
import * as path from "path";
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
  if (!fs.existsSync(statePath)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(statePath, "utf-8"));
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
  if (!fs.existsSync(statePath)) {
    return { read: [], modified: [] };
  }
  try {
    const data = JSON.parse(fs.readFileSync(statePath, "utf-8"));
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
  if (!fs.existsSync(activeDir)) return null;
  const files = fs.readdirSync(activeDir).filter((f) => f.endsWith(".md"));
  if (files.length === 0) return null;
  let latest = { file: "", mtime: 0 };
  for (const f of files) {
    const stat = fs.statSync(path.join(activeDir, f));
    if (stat.mtimeMs > latest.mtime) {
      latest = { file: f, mtime: stat.mtimeMs };
    }
  }
  const planPath = path.join(activeDir, latest.file);
  const content = fs.readFileSync(planPath, "utf-8");
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
  if (!fs.existsSync(ledgerDir)) return null;
  const files = fs.readdirSync(ledgerDir);
  const ledgerFiles = files.filter(
    (f) => f.startsWith("CONTINUITY_") && f.endsWith(".md")
  );
  if (ledgerFiles.length === 0) return null;
  let latestFile = ledgerFiles[0];
  let latestMtime = 0;
  for (const file of ledgerFiles) {
    const filePath = path.join(ledgerDir, file);
    const stat = fs.statSync(filePath);
    if (stat.mtime.getTime() > latestMtime) {
      latestMtime = stat.mtime.getTime();
      latestFile = file;
    }
  }
  return path.join(ledgerDir, latestFile);
}
function updateLedger(ledgerPath, fileOps, decisions, activePlan) {
  if (!fs.existsSync(ledgerPath)) return;
  let content = fs.readFileSync(ledgerPath, "utf-8");
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
  fs.writeFileSync(ledgerPath, content);
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
  if (fs.existsSync(statePath)) {
    const data = JSON.parse(fs.readFileSync(statePath, "utf-8"));
    data.files = { read: [], modified: [] };
    fs.writeFileSync(statePath, JSON.stringify(data, null, 2));
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
  if (fs.existsSync(statePath)) {
    fs.unlinkSync(statePath);
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
  const output = {
    continue: true,
    systemMessage: `[PreCompact] Ledger updated with file operations. State saved to ${path.basename(ledgerPath)}.`
  };
  console.log(JSON.stringify(output));
}
main().catch((e) => {
  console.error(e);
  console.log(JSON.stringify({ continue: true }));
});
