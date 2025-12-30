interface PostToolUseInput {
  tool_name: string;
  tool_input: {
    file_path?: string;
    new_string?: string;
  };
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

const EXCESSIVE_PATTERNS = [
  { pattern: /\/\/\s*(increment|decrement|add|subtract|set|get|return)\s+/i, reason: "Explains what, not why" },
  { pattern: /\/\/\s*[-=]{3,}/, reason: "Section divider" },
  { pattern: /\/\/\s*end\s+(of|function|class|if|for|while)/i, reason: "End marker" },
  { pattern: /\/\/\s*$/, reason: "Empty comment" },
];

const VALID_PATTERNS = [
  /\/\/\s*(TODO|FIXME|NOTE|HACK|XXX|BUG):/i,
  /\/\*\*|\/\/\s*@/,
  /\/\/\s*(eslint|prettier|ts-|@)/i,
  /\/\/\s*https?:\/\//,
  /\/\/\s*(describe|given|when|then|it|should)/i,
];

interface Issue {
  line: number;
  comment: string;
  reason: string;
}

function analyzeComments(content: string): Issue[] {
  const issues: Issue[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const commentMatch = line.match(/\/\/(.*)$/);

    if (!commentMatch) continue;

    const comment = commentMatch[0];

    if (VALID_PATTERNS.some((p) => p.test(comment))) continue;

    for (const { pattern, reason } of EXCESSIVE_PATTERNS) {
      if (pattern.test(comment)) {
        issues.push({
          line: i + 1,
          comment: comment.slice(0, 40) + (comment.length > 40 ? "..." : ""),
          reason,
        });
        break;
      }
    }
  }

  return issues;
}

async function main() {
  const input: PostToolUseInput = JSON.parse(await readStdin());

  if (input.tool_name !== "Edit") {
    console.log(JSON.stringify({ result: "continue" }));
    return;
  }

  const newContent = input.tool_input.new_string;
  if (!newContent) {
    console.log(JSON.stringify({ result: "continue" }));
    return;
  }

  const issues = analyzeComments(newContent);

  if (issues.length > 0) {
    const issueList = issues
      .slice(0, 3)
      .map((i) => `Line ${i.line}: "${i.comment}" (${i.reason})`)
      .join("; ");

    const output: HookOutput = {
      result: "continue",
      message: `Comment check: ${issues.length} potentially unnecessary comment(s). ${issueList}. Comments should explain WHY, not WHAT.`,
    };
    console.log(JSON.stringify(output));
  } else {
    console.log(JSON.stringify({ result: "continue" }));
  }
}

main().catch((e) => {
  console.error(e);
  console.log(JSON.stringify({ result: "continue" }));
});
