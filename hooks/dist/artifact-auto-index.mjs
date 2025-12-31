// hooks/src/artifact-auto-index.ts
import * as fs from "fs";
import * as path from "path";
async function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.on("data", (chunk) => data += chunk);
    process.stdin.on("end", () => resolve(data));
  });
}
function isArtifact(filePath) {
  if (filePath.includes("thoughts/ledgers/") && filePath.includes("CONTINUITY_")) {
    return { type: "ledger" };
  }
  if (filePath.includes("thoughts/shared/plans/") && filePath.endsWith(".md")) {
    return { type: "plan" };
  }
  if (filePath.includes("thoughts/shared/retros/") && filePath.endsWith(".md")) {
    return { type: "plan" };
  }
  return null;
}
function extractMetadata(filePath, type) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, "utf-8");
  const metadata = { type, filePath };
  if (type === "ledger") {
    const sessionMatch = content.match(/# Session: (.+)/);
    metadata.sessionName = sessionMatch?.[1];
    const goalMatch = content.match(/## Goal\n(.+)/);
    metadata.goal = goalMatch?.[1];
  } else {
    const titleMatch = content.match(/# (.+)/);
    metadata.title = titleMatch?.[1];
    const goalMatch = content.match(/\*\*Goal:\*\* (.+)/);
    metadata.goal = goalMatch?.[1];
  }
  return metadata;
}
function appendToIndex(projectDir, metadata) {
  const indexDir = path.join(projectDir, ".claude", "state");
  const indexFile = path.join(indexDir, "artifact-index.json");
  fs.mkdirSync(indexDir, { recursive: true });
  let index = [];
  if (fs.existsSync(indexFile)) {
    try {
      index = JSON.parse(fs.readFileSync(indexFile, "utf-8"));
    } catch {
      index = [];
    }
  }
  const existingIdx = index.findIndex((a) => a.filePath === metadata.filePath);
  if (existingIdx >= 0) {
    index[existingIdx] = metadata;
  } else {
    index.push(metadata);
  }
  fs.writeFileSync(indexFile, JSON.stringify(index, null, 2));
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
  const artifact = isArtifact(filePath);
  if (!artifact) {
    console.log(JSON.stringify({ result: "continue" }));
    return;
  }
  const metadata = extractMetadata(filePath, artifact.type);
  if (metadata) {
    appendToIndex(projectDir, metadata);
  }
  console.log(JSON.stringify({ result: "continue" }));
}
main().catch((e) => {
  console.error(e);
  console.log(JSON.stringify({ result: "continue" }));
});
