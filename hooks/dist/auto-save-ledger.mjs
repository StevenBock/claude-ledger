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
function updateLedgerWithFileOps(ledgerPath, fileOps) {
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
  updateLedgerWithFileOps(ledgerPath, fileOps);
  clearFileOps(projectDir, input.session_id);
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
