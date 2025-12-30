// hooks/src/context-injector.ts
import * as fs from "fs";
import * as path from "path";
async function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.on("data", (chunk) => data += chunk);
    process.stdin.on("end", () => resolve(data));
  });
}
var CONTEXT_FILES = [
  ".cursorrules"
];
function loadContextFiles(projectDir) {
  const contexts = [];
  for (const file of CONTEXT_FILES) {
    const filePath = path.join(projectDir, file);
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        if (content.trim()) {
          contexts.push(`<context file="${file}">
${content}
</context>`);
        }
      } catch {
      }
    }
  }
  return contexts;
}
async function main() {
  const _input = JSON.parse(await readStdin());
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const contexts = loadContextFiles(projectDir);
  if (contexts.length === 0) {
    console.log(JSON.stringify({ result: "continue" }));
    return;
  }
  const output = {
    result: "continue",
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: contexts.join("\n\n")
    }
  };
  console.log(JSON.stringify(output));
}
main().catch((e) => {
  console.error(e);
  console.log(JSON.stringify({ result: "continue" }));
});
