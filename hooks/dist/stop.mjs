// hooks/src/stop.ts
import * as fs from "fs";
import * as path from "path";
async function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.on("data", (chunk) => data += chunk);
    process.stdin.on("end", () => resolve(data));
  });
}
function logStopEvent(projectDir, sessionId, transcriptPath) {
  const logDir = path.join(projectDir, ".claude", "state", "sessions", sessionId);
  const logFile = path.join(logDir, "stop-events.jsonl");
  fs.mkdirSync(logDir, { recursive: true });
  const event = {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    sessionId,
    transcriptPath
  };
  fs.appendFileSync(logFile, JSON.stringify(event) + "\n");
}
async function main() {
  const input = JSON.parse(await readStdin());
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  if (input.stop_hook_active) {
    console.log(JSON.stringify({ result: "continue" }));
    return;
  }
  try {
    logStopEvent(projectDir, input.session_id, input.transcript_path);
    const output = {
      result: "continue"
    };
    console.log(JSON.stringify(output));
  } catch (e) {
    console.error("[Stop] Error:", e);
    console.log(JSON.stringify({ result: "continue" }));
  }
}
main().catch((e) => {
  console.error(e);
  console.log(JSON.stringify({ result: "continue" }));
});
