// hooks/src/ledger-loader.ts
import * as fs from "fs";
import * as path from "path";
function pruneLedger(ledgerPath, config = { maxAgentReports: 10, removeSessionEnded: true }) {
  let content = fs.readFileSync(ledgerPath, "utf-8");
  const originalLength = content.length;
  if (config.removeSessionEnded) {
    content = content.replace(
      /### Session Ended.*?\n[\s\S]*?(?=###|## |$)/g,
      ""
    );
  }
  const agentReportsMatch = content.match(
    /## Agent Reports\n([\s\S]*?)(?=\n## |$)/
  );
  if (agentReportsMatch) {
    const reportsSection = agentReportsMatch[1];
    const reports = reportsSection.split(/(?=### )/).filter((r) => r.trim());
    if (reports.length > config.maxAgentReports) {
      const kept = reports.slice(-config.maxAgentReports).join("");
      content = content.replace(
        agentReportsMatch[0],
        `## Agent Reports
${kept}`
      );
    }
  }
  if (content.length !== originalLength) {
    fs.writeFileSync(ledgerPath, content);
    console.error(
      `[ledger-loader] Pruned ledger: ${originalLength} \u2192 ${content.length} bytes`
    );
  }
}
async function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.on("data", (chunk) => data += chunk);
    process.stdin.on("end", () => resolve(data));
  });
}
function findMostRecentLedger(projectDir) {
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
    const filePath2 = path.join(ledgerDir, file);
    const stat = fs.statSync(filePath2);
    if (stat.mtime.getTime() > latestMtime) {
      latestMtime = stat.mtime.getTime();
      latestFile = file;
    }
  }
  const filePath = path.join(ledgerDir, latestFile);
  const content = fs.readFileSync(filePath, "utf-8");
  const sessionName = latestFile.replace("CONTINUITY_", "").replace(".md", "");
  const nowMatch = content.match(/### In Progress\n- \[ \] (.+)/);
  const nowItem = nowMatch ? nowMatch[1] : void 0;
  return { sessionName, filePath, content, nowItem };
}
function formatLedgerContext(ledger) {
  return `<continuity-ledger session="${ledger.sessionName}">
${ledger.content}
</continuity-ledger>

You are resuming from a context clear. Review the ledger above and continue from the "In Progress" item.`;
}
async function main() {
  const input = JSON.parse(await readStdin());
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  if (input.source === "startup") {
    console.log(JSON.stringify({ result: "continue" }));
    return;
  }
  let ledger = findMostRecentLedger(projectDir);
  if (!ledger) {
    const output2 = {
      result: "continue",
      message: "No ledger found. Run /ledger to track session state."
    };
    console.log(JSON.stringify(output2));
    return;
  }
  pruneLedger(ledger.filePath);
  ledger = findMostRecentLedger(projectDir);
  if (!ledger) {
    console.log(JSON.stringify({ result: "continue" }));
    return;
  }
  const output = {
    result: "continue",
    message: `Loaded: ${ledger.sessionName}${ledger.nowItem ? ` | Focus: ${ledger.nowItem}` : ""}`,
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: formatLedgerContext(ledger)
    }
  };
  console.log(JSON.stringify(output));
}
main().catch((e) => {
  console.error(e);
  console.log(JSON.stringify({ result: "continue" }));
});
