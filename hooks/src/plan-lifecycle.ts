import * as fs from "fs";
import * as path from "path";

interface PostToolUseInput {
  tool_name: string;
  tool_input: {
    file_path?: string;
  };
  session_id: string;
}

interface HookOutput {
  result: "continue";
  message?: string;
}

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
  });
}

function isPlanFile(filePath: string): boolean {
  return (
    filePath.includes("thoughts/shared/plans/") && filePath.endsWith(".md")
  );
}

function getPlanLocation(
  filePath: string
): "pending" | "active" | "done" | null {
  if (filePath.includes("/plans/pending/")) return "pending";
  if (filePath.includes("/plans/active/")) return "active";
  if (filePath.includes("/plans/done/")) return "done";
  return null;
}

function movePlan(
  fromPath: string,
  toFolder: "pending" | "active" | "done"
): string {
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

  // Ensure target directory exists
  fs.mkdirSync(path.dirname(toPath), { recursive: true });

  // Read, move, delete original
  const content = fs.readFileSync(fromPath, "utf-8");
  fs.writeFileSync(toPath, content);
  fs.unlinkSync(fromPath);

  return toPath;
}

function updateStatusBlock(
  filePath: string,
  updates: { status?: string; started?: string; completed?: string }
): void {
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

function isAllTasksComplete(filePath: string): boolean {
  const content = fs.readFileSync(filePath, "utf-8");
  const progressMatch = content.match(/\| Progress \| `?(\d+)\/(\d+) tasks`? \|/);
  if (!progressMatch) return false;

  const completed = parseInt(progressMatch[1], 10);
  const total = parseInt(progressMatch[2], 10);

  return completed === total && total > 0;
}

function getTimestamp(): string {
  const now = new Date();
  return now.toISOString().slice(0, 16).replace("T", " ");
}

async function main() {
  const input: PostToolUseInput = JSON.parse(await readStdin());
  const filePath = input.tool_input.file_path;

  // Only process plan files
  if (!filePath || !isPlanFile(filePath)) {
    console.log(JSON.stringify({ result: "continue" }));
    return;
  }

  const location = getPlanLocation(filePath);
  const toolName = input.tool_name;

  try {
    // On Read of pending plan → activate it
    if (toolName === "Read" && location === "pending") {
      const newPath = movePlan(filePath, "active");
      updateStatusBlock(newPath, {
        status: "active",
        started: getTimestamp(),
      });

      const output: HookOutput = {
        result: "continue",
        message: `[Plan Lifecycle] Activated: ${path.basename(newPath)}`,
      };
      console.log(JSON.stringify(output));
      return;
    }

    // On Edit of active plan with all tasks complete → move to done
    if (toolName === "Edit" && location === "active") {
      if (isAllTasksComplete(filePath)) {
        const newPath = movePlan(filePath, "done");
        updateStatusBlock(newPath, {
          status: "done",
          completed: getTimestamp(),
        });

        const output: HookOutput = {
          result: "continue",
          message: `[Plan Lifecycle] Completed: ${path.basename(newPath)}`,
        };
        console.log(JSON.stringify(output));
        return;
      }
    }
  } catch (e) {
    // Don't fail the hook on errors - just log and continue
    console.error("[Plan Lifecycle] Error:", e);
  }

  console.log(JSON.stringify({ result: "continue" }));
}

main().catch((e) => {
  console.error(e);
  console.log(JSON.stringify({ result: "continue" }));
});
