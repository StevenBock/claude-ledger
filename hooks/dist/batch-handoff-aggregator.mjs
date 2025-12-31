// hooks/src/batch-handoff-aggregator.ts
import * as fs from "fs";
import * as path from "path";
async function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.on("data", (chunk) => data += chunk);
    process.stdin.on("end", () => resolve(data));
  });
}
function isTaskHandoff(filePath) {
  const match = filePath.match(/thoughts\/shared\/handoffs\/([^/]+)\/task-(\d+)\.md$/);
  if (!match) return null;
  return { planName: match[1], taskNum: parseInt(match[2], 10) };
}
function loadExecutorState(projectDir, sessionId) {
  const statePath = path.join(
    projectDir,
    ".claude",
    "state",
    "sessions",
    sessionId,
    "executor-state.json"
  );
  if (!fs.existsSync(statePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf-8"));
  } catch {
    return null;
  }
}
function updateExecutorState(projectDir, sessionId, state) {
  const stateDir = path.join(projectDir, ".claude", "state", "sessions", sessionId);
  const statePath = path.join(stateDir, "executor-state.json");
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}
function parseFrontmatter(content) {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return null;
  const fm = fmMatch[1];
  const meta = {};
  const taskMatch = fm.match(/^task:\s*(\d+)/m);
  if (taskMatch) meta.task = parseInt(taskMatch[1], 10);
  const batchMatch = fm.match(/^batch:\s*(\d+)/m);
  if (batchMatch) meta.batch = parseInt(batchMatch[1], 10);
  const planMatch = fm.match(/^plan:\s*(.+)/m);
  if (planMatch) meta.plan = planMatch[1].trim();
  const statusMatch = fm.match(/^status:\s*(.+)/m);
  if (statusMatch) meta.status = statusMatch[1].trim();
  const timestampMatch = fm.match(/^timestamp:\s*(.+)/m);
  if (timestampMatch) meta.timestamp = timestampMatch[1].trim();
  const filesMatch = fm.match(/^files_modified:\s*\n((?:\s+-\s+.+\n?)*)/m);
  if (filesMatch) {
    meta.files_modified = filesMatch[1].split("\n").map((l) => l.replace(/^\s+-\s+/, "").trim()).filter(Boolean);
  } else {
    meta.files_modified = [];
  }
  if (meta.task === void 0 || meta.batch === void 0) return null;
  return meta;
}
function getTaskHandoffsForBatch(projectDir, planName, batchNum, expectedTasks) {
  const handoffsDir = path.join(projectDir, "thoughts", "shared", "handoffs", planName);
  if (!fs.existsSync(handoffsDir)) return [];
  const handoffs = [];
  for (const taskNum of expectedTasks) {
    const handoffPath = path.join(handoffsDir, `task-${taskNum}.md`);
    if (!fs.existsSync(handoffPath)) continue;
    const content = fs.readFileSync(handoffPath, "utf-8");
    const meta = parseFrontmatter(content);
    if (meta && meta.batch === batchNum) {
      handoffs.push(meta);
    }
  }
  return handoffs;
}
function extractMarkdownSection(content, afterFrontmatter) {
  if (afterFrontmatter) {
    const fmEnd = content.indexOf("---", 4);
    if (fmEnd !== -1) {
      return content.slice(fmEnd + 3).trim();
    }
  }
  return content.trim();
}
function aggregateBatchHandoff(projectDir, planName, batchNum, taskHandoffs) {
  const handoffsDir = path.join(projectDir, "thoughts", "shared", "handoffs", planName);
  const date = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const allFiles = [];
  const taskSummaries = [];
  for (const meta of taskHandoffs) {
    allFiles.push(...meta.files_modified);
    const handoffPath = path.join(handoffsDir, `task-${meta.task}.md`);
    const content = fs.readFileSync(handoffPath, "utf-8");
    const mdContent = extractMarkdownSection(content, true);
    const whatDoneMatch = mdContent.match(/## What Was Done\n([\s\S]*?)(?=\n## |$)/);
    const whatDone = whatDoneMatch ? whatDoneMatch[1].trim() : "See task handoff for details.";
    taskSummaries.push(`### Task ${meta.task}
${whatDone}`);
  }
  const uniqueFiles = [...new Set(allFiles)];
  return `# Batch ${batchNum} Handoff
Status: Complete
Date: ${date}

## What Was Implemented

${taskSummaries.join("\n\n")}

## Files Modified
${uniqueFiles.map((f) => `- \`${f}\``).join("\n")}

## Notes
- Auto-generated from task handoffs by batch-handoff-aggregator hook

## Next Steps
See individual task handoffs for detailed context.
`;
}
async function main() {
  const input = JSON.parse(await readStdin());
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  if (input.tool_name !== "Write") {
    console.log(JSON.stringify({ result: "continue" }));
    return;
  }
  const filePath = input.tool_input.file_path;
  if (!filePath) {
    console.log(JSON.stringify({ result: "continue" }));
    return;
  }
  const handoffInfo = isTaskHandoff(filePath);
  if (!handoffInfo) {
    console.log(JSON.stringify({ result: "continue" }));
    return;
  }
  const { planName, taskNum } = handoffInfo;
  const state = loadExecutorState(projectDir, input.session_id);
  if (!state || state.planName !== planName) {
    console.log(JSON.stringify({ result: "continue" }));
    return;
  }
  if (!state.batches) {
    console.log(JSON.stringify({ result: "continue" }));
    return;
  }
  const content = fs.readFileSync(filePath, "utf-8");
  const meta = parseFrontmatter(content);
  if (!meta) {
    console.log(JSON.stringify({ result: "continue" }));
    return;
  }
  const batchNum = meta.batch;
  const batchInfo = state.batches[String(batchNum)];
  if (!batchInfo) {
    console.log(JSON.stringify({ result: "continue" }));
    return;
  }
  const handoffs = getTaskHandoffsForBatch(projectDir, planName, batchNum, batchInfo.tasks);
  if (handoffs.length < batchInfo.expected) {
    console.log(JSON.stringify({ result: "continue" }));
    return;
  }
  const batchHandoff = aggregateBatchHandoff(projectDir, planName, batchNum, handoffs);
  const batchHandoffPath = path.join(
    projectDir,
    "thoughts",
    "shared",
    "handoffs",
    `${planName}-batch-${batchNum}.md`
  );
  fs.writeFileSync(batchHandoffPath, batchHandoff);
  if (!state.handoffsWritten.includes(batchNum)) {
    state.handoffsWritten.push(batchNum);
    updateExecutorState(projectDir, input.session_id, state);
  }
  console.log(JSON.stringify({ result: "continue" }));
}
main().catch((e) => {
  console.error(e);
  console.log(JSON.stringify({ result: "continue" }));
});
