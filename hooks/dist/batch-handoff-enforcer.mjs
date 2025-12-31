// hooks/src/batch-handoff-enforcer.ts
import * as fs from "fs";
import * as path from "path";
async function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.on("data", (chunk) => data += chunk);
    process.stdin.on("end", () => resolve(data));
  });
}
function extractPlanInfo(prompt) {
  const planMatch = prompt.match(/thoughts\/shared\/plans\/active\/(\d{4}-\d{2}-\d{2}-[^.]+)\.md/);
  if (!planMatch) return null;
  const planName = planMatch[1];
  const taskMatch = prompt.match(/[Tt]ask[:\s]+(\d+)/);
  if (!taskMatch) return null;
  const taskNum = parseInt(taskMatch[1], 10);
  const batch = Math.ceil(taskNum / 3);
  return { planName, taskNum, batch };
}
function isImplementerSpawn(prompt) {
  const lowerPrompt = prompt.toLowerCase();
  return lowerPrompt.includes("implementer") && (lowerPrompt.includes("execute task") || lowerPrompt.includes("implement task"));
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
function saveExecutorState(projectDir, sessionId, state) {
  const stateDir = path.join(projectDir, ".claude", "state", "sessions", sessionId);
  const statePath = path.join(stateDir, "executor-state.json");
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}
function findHandoffFile(projectDir, planName, batchNum) {
  const handoffsDir = path.join(projectDir, "thoughts", "shared", "handoffs");
  if (!fs.existsSync(handoffsDir)) return null;
  const files = fs.readdirSync(handoffsDir);
  const pattern = new RegExp(`${planName}-batch-${batchNum}\\.md$`);
  for (const file of files) {
    if (pattern.test(file)) {
      return path.join(handoffsDir, file);
    }
  }
  return null;
}
async function main() {
  const input = JSON.parse(await readStdin());
  if (input.tool_name !== "Task") {
    process.exit(0);
    return;
  }
  const prompt = input.tool_input.prompt || "";
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const sessionId = input.session_id;
  if (!isImplementerSpawn(prompt)) {
    process.exit(0);
    return;
  }
  const planInfo = extractPlanInfo(prompt);
  if (!planInfo) {
    process.exit(0);
    return;
  }
  const { planName, batch } = planInfo;
  let state = loadExecutorState(projectDir, sessionId);
  if (!state || state.planName !== planName) {
    state = {
      sessionId,
      planName,
      currentBatch: 1,
      handoffsWritten: []
    };
  }
  if (batch > 1) {
    const previousBatch = batch - 1;
    const hasHandoff = state.handoffsWritten.includes(previousBatch);
    if (!hasHandoff) {
      const handoffFile = findHandoffFile(projectDir, planName, previousBatch);
      if (!handoffFile) {
        const output = {
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "deny",
            permissionDecisionReason: `BLOCKED: Missing batch ${previousBatch} handoff. You MUST write the handoff document to thoughts/shared/handoffs/${planName}-batch-${previousBatch}.md before starting batch ${batch} tasks.`
          }
        };
        console.log(JSON.stringify(output));
        process.exit(0);
        return;
      }
      state.handoffsWritten.push(previousBatch);
    }
  }
  state.currentBatch = batch;
  saveExecutorState(projectDir, sessionId, state);
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(0);
});
