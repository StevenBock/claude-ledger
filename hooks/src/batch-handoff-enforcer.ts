import * as fs from "fs";
import * as path from "path";

interface PreToolUseInput {
  hook_event_name: "PreToolUse";
  tool_name: string;
  tool_input: {
    prompt?: string;
    description?: string;
    subagent_type?: string;
  };
  session_id: string;
}

interface HookOutput {
  hookSpecificOutput?: {
    hookEventName: "PreToolUse";
    permissionDecision: "allow" | "deny" | "ask";
    permissionDecisionReason: string;
  };
}

interface ExecutorState {
  sessionId: string;
  planName: string;
  currentBatch: number;
  handoffsWritten: number[];
}

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
  });
}

function extractPlanInfo(prompt: string): { planName: string; taskNum: number; batch: number } | null {
  // Look for plan path pattern: thoughts/shared/plans/active/YYYY-MM-DD-name.md
  const planMatch = prompt.match(/thoughts\/shared\/plans\/active\/(\d{4}-\d{2}-\d{2}-[^.]+)\.md/);
  if (!planMatch) return null;

  const planName = planMatch[1];

  // Look for task number pattern: Task: N or Task N or task N
  const taskMatch = prompt.match(/[Tt]ask[:\s]+(\d+)/);
  if (!taskMatch) return null;

  const taskNum = parseInt(taskMatch[1], 10);

  // Estimate batch from task number (simple heuristic: batch = ceil(task/3))
  // This is a simplification - ideally the executor would track this explicitly
  const batch = Math.ceil(taskNum / 3);

  return { planName, taskNum, batch };
}

function isImplementerSpawn(prompt: string): boolean {
  const lowerPrompt = prompt.toLowerCase();
  return (
    lowerPrompt.includes("implementer") &&
    (lowerPrompt.includes("execute task") || lowerPrompt.includes("implement task"))
  );
}

function loadExecutorState(projectDir: string, sessionId: string): ExecutorState | null {
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

function saveExecutorState(projectDir: string, sessionId: string, state: ExecutorState): void {
  const stateDir = path.join(projectDir, ".claude", "state", "sessions", sessionId);
  const statePath = path.join(stateDir, "executor-state.json");

  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function findHandoffFile(projectDir: string, planName: string, batchNum: number): string | null {
  const handoffsDir = path.join(projectDir, "thoughts", "shared", "handoffs");

  if (!fs.existsSync(handoffsDir)) return null;

  const files = fs.readdirSync(handoffsDir);

  // Look for pattern: YYYY-MM-DD-planname-batch-N.md
  const pattern = new RegExp(`${planName}-batch-${batchNum}\\.md$`);

  for (const file of files) {
    if (pattern.test(file)) {
      return path.join(handoffsDir, file);
    }
  }

  return null;
}

async function main() {
  const input: PreToolUseInput = JSON.parse(await readStdin());

  // Only process Task tool calls
  if (input.tool_name !== "Task") {
    process.exit(0);
    return;
  }

  const prompt = input.tool_input.prompt || "";
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const sessionId = input.session_id;

  // Only check implementer spawns
  if (!isImplementerSpawn(prompt)) {
    process.exit(0);
    return;
  }

  // Extract plan info from prompt
  const planInfo = extractPlanInfo(prompt);
  if (!planInfo) {
    // Can't determine plan info - allow to proceed
    process.exit(0);
    return;
  }

  const { planName, batch } = planInfo;

  // Load current executor state
  let state = loadExecutorState(projectDir, sessionId);

  // If this is a new plan or different plan, reset state
  if (!state || state.planName !== planName) {
    state = {
      sessionId,
      planName,
      currentBatch: 1,
      handoffsWritten: [],
    };
  }

  // If starting batch > 1, check if previous batch handoff exists
  if (batch > 1) {
    const previousBatch = batch - 1;
    const hasHandoff = state.handoffsWritten.includes(previousBatch);

    if (!hasHandoff) {
      // Check filesystem for handoff file
      const handoffFile = findHandoffFile(projectDir, planName, previousBatch);

      if (!handoffFile) {
        // Block! Missing handoff for previous batch
        const output: HookOutput = {
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "deny",
            permissionDecisionReason: `BLOCKED: Missing batch ${previousBatch} handoff. You MUST write the handoff document to thoughts/shared/handoffs/${planName}-batch-${previousBatch}.md before starting batch ${batch} tasks.`,
          },
        };
        console.log(JSON.stringify(output));
        process.exit(0);
        return;
      }

      // Handoff exists on disk - update state
      state.handoffsWritten.push(previousBatch);
    }
  }

  // Update current batch
  state.currentBatch = batch;
  saveExecutorState(projectDir, sessionId, state);

  // Allow the Task to proceed
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(0);
});
