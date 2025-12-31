/**
 * Stop Hook
 *
 * Foundation for stop event tracking. Currently logging only.
 * Future: Can add force-continuation blocking capability.
 */

import * as fs from "fs";
import * as path from "path";

interface StopInput {
  session_id: string;
  transcript_path: string;
  stop_hook_active: boolean;
}

interface HookOutput {
  result: "continue";
  message?: string;
}

interface StopEvent {
  timestamp: string;
  sessionId: string;
  transcriptPath: string;
}

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
  });
}

function logStopEvent(projectDir: string, sessionId: string, transcriptPath: string): void {
  const logDir = path.join(projectDir, ".claude", "state", "sessions", sessionId);
  const logFile = path.join(logDir, "stop-events.jsonl");

  fs.mkdirSync(logDir, { recursive: true });

  const event: StopEvent = {
    timestamp: new Date().toISOString(),
    sessionId,
    transcriptPath,
  };

  fs.appendFileSync(logFile, JSON.stringify(event) + "\n");
}

async function main() {
  const input: StopInput = JSON.parse(await readStdin());
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  if (input.stop_hook_active) {
    console.log(JSON.stringify({ result: "continue" }));
    return;
  }

  try {
    logStopEvent(projectDir, input.session_id, input.transcript_path);

    const output: HookOutput = {
      result: "continue",
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
