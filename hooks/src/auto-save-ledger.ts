import * as fs from "fs";
import * as path from "path";
import { parseTranscript, generateAutoHandoff } from "./transcript-parser.js";

interface PreCompactInput {
  trigger: "auto" | "manual";
  session_id: string;
  transcript_path?: string;
}

interface HookOutput {
  continue: boolean;
  systemMessage?: string;
}

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
  });
}

interface FileOps {
  read: string[];
  modified: string[];
}

interface Decision {
  timestamp: string;
  question: string;
  header?: string;
  options: string[];
  chosen: string[];
  multiSelect: boolean;
}

interface DecisionsState {
  sessionId: string;
  started: string;
  decisions: Decision[];
}

function loadDecisions(projectDir: string, sessionId: string): Decision[] {
  const statePath = path.join(
    projectDir, ".claude", "state", "sessions", sessionId, "decisions.json"
  );
  if (!fs.existsSync(statePath)) return [];
  try {
    const data: DecisionsState = JSON.parse(fs.readFileSync(statePath, "utf-8"));
    return data.decisions || [];
  } catch {
    return [];
  }
}

function loadFileOps(projectDir: string, sessionId: string): FileOps {
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

function formatDecisionHistory(decisions: Decision[]): string {
  if (decisions.length === 0) return "";

  let output = "## Decision History\n";
  for (const d of decisions) {
    const topic = d.header || d.question.slice(0, 30);
    output += `### ${topic}\n`;
    output += `- **Question:** ${d.question}\n`;
    output += `- **Options:** [${d.options.join(", ")}]\n`;
    output += `- **Chosen:** ${d.chosen.join(", ")}\n\n`;
  }
  return output;
}

function findActivePlan(projectDir: string): { path: string; progress: string } | null {
  const activeDir = path.join(projectDir, "thoughts", "shared", "plans", "active");
  if (!fs.existsSync(activeDir)) return null;

  const files = fs.readdirSync(activeDir).filter(f => f.endsWith(".md"));
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

function formatActiveContext(activePlan: { path: string; progress: string } | null): string {
  if (!activePlan) return "";
  return `## Active Context
### Working Plan
- File: \`${activePlan.path}\`
- Progress: ${activePlan.progress}

`;
}

function findCurrentLedger(projectDir: string): string | null {
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

function updateLedger(
  ledgerPath: string,
  fileOps: FileOps,
  decisions: Decision[],
  activePlan: { path: string; progress: string } | null
): void {
  if (!fs.existsSync(ledgerPath)) return;

  let content = fs.readFileSync(ledgerPath, "utf-8");

  const readSection = fileOps.read.length > 0
    ? fileOps.read.map((p) => `- \`${p}\``).join("\n")
    : "- (none this session)";

  const modifiedSection = fileOps.modified.length > 0
    ? fileOps.modified.map((p) => `- \`${p}\``).join("\n")
    : "- (none this session)";

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

  const timestamp = new Date().toISOString();
  content = content.replace(/Updated: .+/, `Updated: ${timestamp}`);

  fs.writeFileSync(ledgerPath, content);
}

function clearFileOps(projectDir: string, sessionId: string): void {
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

function clearDecisions(projectDir: string, sessionId: string): void {
  const statePath = path.join(
    projectDir, ".claude", "state", "sessions", sessionId, "decisions.json"
  );
  if (fs.existsSync(statePath)) {
    fs.unlinkSync(statePath);
  }
}

function extractSessionName(ledgerPath: string): string {
  const filename = path.basename(ledgerPath);
  return filename.replace("CONTINUITY_", "").replace(".md", "");
}

function generateComprehensiveHandoff(
  projectDir: string,
  transcriptPath: string,
  sessionName: string
): string | null {
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
    fs.mkdirSync(handoffDir, { recursive: true });

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    const handoffFile = `auto-handoff-${timestamp}.md`;
    const handoffPath = path.join(handoffDir, handoffFile);

    fs.writeFileSync(handoffPath, handoffContent);

    return `thoughts/shared/handoffs/${sessionName}/${handoffFile}`;
  } catch (e) {
    console.error("Failed to generate auto-handoff:", e);
    return null;
  }
}

async function main() {
  const input: PreCompactInput = JSON.parse(await readStdin());
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  const ledgerPath = findCurrentLedger(projectDir);

  if (!ledgerPath) {
    const output: HookOutput = {
      continue: true,
      systemMessage: "[PreCompact] No ledger found. Consider running /ledger to preserve state.",
    };
    console.log(JSON.stringify(output));
    return;
  }

  const fileOps = loadFileOps(projectDir, input.session_id);
  const decisions = loadDecisions(projectDir, input.session_id);
  const activePlan = findActivePlan(projectDir);

  updateLedger(ledgerPath, fileOps, decisions, activePlan);

  clearFileOps(projectDir, input.session_id);
  clearDecisions(projectDir, input.session_id);

  let handoffPath: string | null = null;
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

  const output: HookOutput = {
    continue: true,
    systemMessage: message,
  };
  console.log(JSON.stringify(output));
}

main().catch((e) => {
  console.error(e);
  console.log(JSON.stringify({ continue: true }));
});
