// hooks/src/decision-capture.ts
import * as fs from "fs";
import * as path from "path";
async function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.on("data", (chunk) => data += chunk);
    process.stdin.on("end", () => resolve(data));
  });
}
function getSessionDir(projectDir, sessionId) {
  return path.join(projectDir, ".claude", "state", "sessions", sessionId);
}
function loadDecisions(decisionsFile) {
  if (!fs.existsSync(decisionsFile)) return [];
  try {
    return JSON.parse(fs.readFileSync(decisionsFile, "utf-8"));
  } catch {
    return [];
  }
}
function saveDecisions(decisionsFile, decisions) {
  const dir = path.dirname(decisionsFile);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(decisionsFile, JSON.stringify(decisions, null, 2));
}
async function main() {
  const input = JSON.parse(await readStdin());
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const sessionId = input.session_id || "default";
  if (input.tool_name !== "AskUserQuestion") {
    console.log(JSON.stringify({ result: "continue" }));
    return;
  }
  const toolInput = input.tool_input;
  const toolResponse = input.tool_response;
  if (!toolInput?.options?.length || !toolResponse?.selected?.length) {
    console.log(JSON.stringify({ result: "continue" }));
    return;
  }
  const sessionDir = getSessionDir(projectDir, sessionId);
  const decisionsFile = path.join(sessionDir, "decisions.json");
  const decisions = loadDecisions(decisionsFile);
  const maxSelections = toolInput.maxSelections ?? toolInput.options.length;
  const multiSelect = maxSelections > 1;
  const decision = {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    question: toolInput.question,
    header: toolInput.header,
    options: toolInput.options,
    chosen: toolResponse.selected,
    multiSelect
  };
  decisions.push(decision);
  saveDecisions(decisionsFile, decisions);
  console.log(JSON.stringify({ result: "continue" }));
}
main().catch((e) => {
  console.error(e);
  console.log(JSON.stringify({ result: "continue" }));
});
