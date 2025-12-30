import * as fs from "fs";
import * as path from "path";

interface SessionStartInput {
  source: string;
  session_id: string;
}

interface HookOutput {
  result: "continue";
  hookSpecificOutput?: {
    hookEventName: string;
    additionalContext: string;
  };
}

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
  });
}

const CONTEXT_FILES = [
  ".cursorrules",
];

function loadContextFiles(projectDir: string): string[] {
  const contexts: string[] = [];

  for (const file of CONTEXT_FILES) {
    const filePath = path.join(projectDir, file);
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        if (content.trim()) {
          contexts.push(`<context file="${file}">\n${content}\n</context>`);
        }
      } catch {
        // Skip files we can't read
      }
    }
  }

  return contexts;
}

async function main() {
  const _input: SessionStartInput = JSON.parse(await readStdin());
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  const contexts = loadContextFiles(projectDir);

  if (contexts.length === 0) {
    console.log(JSON.stringify({ result: "continue" }));
    return;
  }

  const output: HookOutput = {
    result: "continue",
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: contexts.join("\n\n"),
    },
  };

  console.log(JSON.stringify(output));
}

main().catch((e) => {
  console.error(e);
  console.log(JSON.stringify({ result: "continue" }));
});
