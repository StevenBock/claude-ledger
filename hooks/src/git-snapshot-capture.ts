import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

interface SessionStartInput {
  source: "resume" | "compact" | "clear" | "startup";
  session_id: string;
}

interface GitSnapshot {
  capturedAt: string;
  source: string;
  branch: string;
  headSha: string;
  headMessage: string;
  staged: string[];
  modified: string[];
  untracked: string[];
}

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
  });
}

function parseGitStatus(porcelain: string): { staged: string[]; modified: string[]; untracked: string[] } {
  const staged: string[] = [];
  const modified: string[] = [];
  const untracked: string[] = [];

  for (const line of porcelain.split("\n").filter(Boolean)) {
    const index = line[0];
    const worktree = line[1];
    const filepath = line.slice(3);

    if (index !== " " && index !== "?") staged.push(filepath);
    if (worktree === "M" || worktree === "D") modified.push(filepath);
    if (index === "?") untracked.push(filepath);
  }

  return { staged, modified, untracked };
}

function captureGitState(projectDir: string, source: string): GitSnapshot | null {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: projectDir, encoding: "utf-8" }).trim();
    const headSha = execSync("git rev-parse HEAD", { cwd: projectDir, encoding: "utf-8" }).trim();
    const headMessage = execSync("git log -1 --format=%s", { cwd: projectDir, encoding: "utf-8" }).trim();
    const status = execSync("git status --porcelain", { cwd: projectDir, encoding: "utf-8" });
    const { staged, modified, untracked } = parseGitStatus(status);

    return {
      capturedAt: new Date().toISOString(),
      source,
      branch,
      headSha,
      headMessage,
      staged,
      modified,
      untracked,
    };
  } catch {
    return null;
  }
}

async function main() {
  const input: SessionStartInput = JSON.parse(await readStdin());
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  const snapshotDir = path.join(projectDir, ".claude", "state", "sessions", input.session_id);
  const snapshotPath = path.join(snapshotDir, "git-snapshot.json");

  if (input.source !== "startup" && fs.existsSync(snapshotPath)) {
    console.log(JSON.stringify({ result: "continue" }));
    return;
  }

  const snapshot = captureGitState(projectDir, input.source);

  if (snapshot) {
    fs.mkdirSync(snapshotDir, { recursive: true });
    fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
  }

  console.log(JSON.stringify({ result: "continue" }));
}

main().catch(() => {
  console.log(JSON.stringify({ result: "continue" }));
});
