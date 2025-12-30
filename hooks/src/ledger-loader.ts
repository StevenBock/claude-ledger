import * as fs from "fs";
import * as path from "path";

interface SessionStartInput {
  source: "resume" | "compact" | "clear" | "startup";
  session_id: string;
}

interface HookOutput {
  result: "continue";
  message?: string;
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

interface LedgerInfo {
  sessionName: string;
  filePath: string;
  content: string;
  nowItem?: string;
}

function findMostRecentLedger(projectDir: string): LedgerInfo | null {
  const ledgerDir = path.join(projectDir, "thoughts", "ledgers");

  if (!fs.existsSync(ledgerDir)) return null;

  const files = fs.readdirSync(ledgerDir);
  const ledgerFiles = files.filter(
    (f) => f.startsWith("CONTINUITY_") && f.endsWith(".md")
  );

  if (ledgerFiles.length === 0) return null;

  let latestFile = ledgerFiles[0];
  let latestMtime = 0;

  for (const file of ledgerFiles) {
    const filePath = path.join(ledgerDir, file);
    const stat = fs.statSync(filePath);
    if (stat.mtime.getTime() > latestMtime) {
      latestMtime = stat.mtime.getTime();
      latestFile = file;
    }
  }

  const filePath = path.join(ledgerDir, latestFile);
  const content = fs.readFileSync(filePath, "utf-8");
  const sessionName = latestFile.replace("CONTINUITY_", "").replace(".md", "");

  const nowMatch = content.match(/### In Progress\n- \[ \] (.+)/);
  const nowItem = nowMatch ? nowMatch[1] : undefined;

  return { sessionName, filePath, content, nowItem };
}

function formatLedgerContext(ledger: LedgerInfo): string {
  return `<continuity-ledger session="${ledger.sessionName}">
${ledger.content}
</continuity-ledger>

You are resuming from a context clear. Review the ledger above and continue from the "In Progress" item.`;
}

async function main() {
  const input: SessionStartInput = JSON.parse(await readStdin());
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  if (input.source === "startup") {
    console.log(JSON.stringify({ result: "continue" }));
    return;
  }

  const ledger = findMostRecentLedger(projectDir);

  if (!ledger) {
    const output: HookOutput = {
      result: "continue",
      message: "No ledger found. Run /ledger to track session state.",
    };
    console.log(JSON.stringify(output));
    return;
  }

  const output: HookOutput = {
    result: "continue",
    message: `Loaded: ${ledger.sessionName}${ledger.nowItem ? ` | Focus: ${ledger.nowItem}` : ""}`,
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: formatLedgerContext(ledger),
    },
  };

  console.log(JSON.stringify(output));
}

main().catch((e) => {
  console.error(e);
  console.log(JSON.stringify({ result: "continue" }));
});
