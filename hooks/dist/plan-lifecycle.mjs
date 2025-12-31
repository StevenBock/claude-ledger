// hooks/src/plan-lifecycle.ts
import * as fs from "fs";
import * as path from "path";
async function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.on("data", (chunk) => data += chunk);
    process.stdin.on("end", () => resolve(data));
  });
}
function isPlanFile(filePath) {
  return filePath.includes("thoughts/shared/plans/") && filePath.endsWith(".md");
}
function getPlanLocation(filePath) {
  if (filePath.includes("/plans/pending/")) return "pending";
  if (filePath.includes("/plans/active/")) return "active";
  if (filePath.includes("/plans/done/")) return "done";
  return null;
}
function movePlan(fromPath, toFolder) {
  const fileName = path.basename(fromPath);
  const projectDir = fromPath.split("thoughts/shared/plans/")[0];
  const toPath = path.join(
    projectDir,
    "thoughts",
    "shared",
    "plans",
    toFolder,
    fileName
  );
  fs.mkdirSync(path.dirname(toPath), { recursive: true });
  const content = fs.readFileSync(fromPath, "utf-8");
  fs.writeFileSync(toPath, content);
  fs.unlinkSync(fromPath);
  return toPath;
}
function updateStatusBlock(filePath, updates) {
  let content = fs.readFileSync(filePath, "utf-8");
  if (updates.status) {
    content = content.replace(
      /\| Status \| `\w+` \|/,
      `| Status | \`${updates.status}\` |`
    );
  }
  if (updates.started) {
    content = content.replace(
      /\| Started \| .+ \|/,
      `| Started | ${updates.started} |`
    );
  }
  if (updates.completed) {
    content = content.replace(
      /\| Completed \| .+ \|/,
      `| Completed | ${updates.completed} |`
    );
  }
  fs.writeFileSync(filePath, content);
}
function isAllTasksComplete(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const progressMatch = content.match(/\| Progress \| `?(\d+)\/(\d+) tasks`? \|/);
  if (!progressMatch) return false;
  const completed = parseInt(progressMatch[1], 10);
  const total = parseInt(progressMatch[2], 10);
  return completed === total && total > 0;
}
function getTimestamp() {
  const now = /* @__PURE__ */ new Date();
  return now.toISOString().slice(0, 16).replace("T", " ");
}
async function main() {
  const input = JSON.parse(await readStdin());
  const filePath = input.tool_input.file_path;
  if (!filePath || !isPlanFile(filePath)) {
    console.log(JSON.stringify({ result: "continue" }));
    return;
  }
  const location = getPlanLocation(filePath);
  const toolName = input.tool_name;
  try {
    if (toolName === "Read" && location === "pending") {
      const newPath = movePlan(filePath, "active");
      updateStatusBlock(newPath, {
        status: "active",
        started: getTimestamp()
      });
      const output = {
        result: "continue",
        message: `[Plan Lifecycle] Activated: ${path.basename(newPath)}`
      };
      console.log(JSON.stringify(output));
      return;
    }
    if (toolName === "Edit" && location === "active") {
      if (isAllTasksComplete(filePath)) {
        const newPath = movePlan(filePath, "done");
        updateStatusBlock(newPath, {
          status: "done",
          completed: getTimestamp()
        });
        const output = {
          result: "continue",
          message: `[Plan Lifecycle] Completed: ${path.basename(newPath)}`
        };
        console.log(JSON.stringify(output));
        return;
      }
    }
  } catch (e) {
    console.error("[Plan Lifecycle] Error:", e);
  }
  console.log(JSON.stringify({ result: "continue" }));
}
main().catch((e) => {
  console.error(e);
  console.log(JSON.stringify({ result: "continue" }));
});
