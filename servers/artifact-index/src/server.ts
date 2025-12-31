#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { ArtifactIndex, getArtifactIndex, type PlanRecord, type LedgerRecord } from "./index.js";

const server = new Server(
  {
    name: "artifact-index",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "artifact_search",
        description: "Search past plans and ledgers for relevant precedent. Returns ranked results.",
        inputSchema: {
          type: "object" as const,
          properties: {
            query: {
              type: "string",
              description: "Search query (keywords to find)",
            },
            limit: {
              type: "number",
              description: "Maximum results to return (default: 10)",
            },
            type: {
              type: "string",
              enum: ["all", "plan", "ledger"],
              description: "Filter by artifact type (default: all)",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "artifact_index",
        description: "Index a plan or ledger file for searching. Call this after creating/updating artifacts.",
        inputSchema: {
          type: "object" as const,
          properties: {
            file_path: {
              type: "string",
              description: "Absolute path to the plan or ledger file",
            },
          },
          required: ["file_path"],
        },
      },
      {
        name: "artifact_list",
        description: "List all indexed artifacts (plans and ledgers)",
        inputSchema: {
          type: "object" as const,
          properties: {
            type: {
              type: "string",
              enum: ["all", "plan", "ledger"],
              description: "Filter by artifact type (default: all)",
            },
          },
        },
      },
    ],
  };
});

function parsePlanFile(filePath: string, content: string): PlanRecord {
  const id = crypto.createHash("md5").update(filePath).digest("hex").slice(0, 12);

  const titleMatch = content.match(/^# (.+)/m);
  const title = titleMatch?.[1];

  const goalMatch = content.match(/\*\*Goal:\*\* (.+)/);
  const overview = goalMatch?.[1];

  const archMatch = content.match(/\*\*Architecture:\*\* (.+)/);
  const approach = archMatch?.[1];

  return { id, filePath, title, overview, approach };
}

function parseLedgerFile(filePath: string, content: string): LedgerRecord {
  const id = crypto.createHash("md5").update(filePath).digest("hex").slice(0, 12);

  const sessionMatch = content.match(/# Session: (.+)/);
  const sessionName = sessionMatch?.[1];

  const goalMatch = content.match(/## Goal\n(.+)/);
  const goal = goalMatch?.[1];

  const inProgressMatch = content.match(/### In Progress\n([\s\S]*?)(?=\n##|\n###|$)/);
  const stateNow = inProgressMatch?.[1]?.trim();

  const decisionsMatch = content.match(/## Key Decisions\n([\s\S]*?)(?=\n##|$)/);
  const keyDecisions = decisionsMatch?.[1]?.trim();

  const readMatch = content.match(/### Read\n([\s\S]*?)(?=\n###|\n##|$)/);
  const filesRead = readMatch?.[1]?.trim();

  const modifiedMatch = content.match(/### Modified\n([\s\S]*?)(?=\n###|\n##|$)/);
  const filesModified = modifiedMatch?.[1]?.trim();

  return { id, filePath, sessionName, goal, stateNow, keyDecisions, filesRead, filesModified };
}

function detectArtifactType(filePath: string): "plan" | "ledger" | null {
  if (filePath.includes("thoughts/ledgers/") && filePath.includes("CONTINUITY_")) {
    return "ledger";
  }
  if (filePath.includes("thoughts/shared/plans/") && filePath.endsWith(".md")) {
    return "plan";
  }
  if (filePath.includes("thoughts/shared/designs/") && filePath.endsWith(".md")) {
    return "plan";
  }
  if (filePath.includes("thoughts/shared/patterns/") && filePath.endsWith(".md")) {
    return "plan";
  }
  return null;
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const index = getArtifactIndex();

    switch (name) {
      case "artifact_search": {
        const query = args?.query as string;
        const limit = (args?.limit as number) || 10;
        const typeFilter = args?.type as string;

        if (!query) {
          return {
            content: [{ type: "text", text: "Error: query is required" }],
            isError: true,
          };
        }

        const type = typeFilter === "plan" || typeFilter === "ledger" ? typeFilter : undefined;
        const results = index.search(query, limit, type);

        if (results.length === 0) {
          return {
            content: [{
              type: "text",
              text: `No results found for "${query}". Try different keywords or check that artifacts have been indexed.`,
            }],
          };
        }

        const formatted = results.map((r, i) => {
          return `${i + 1}. [${r.type.toUpperCase()}] ${r.title || path.basename(r.filePath)}
   File: ${r.filePath}
   ${r.summary ? `Summary: ${r.summary}` : ""}
   Score: ${r.score.toFixed(2)}`;
        }).join("\n\n");

        return {
          content: [{
            type: "text",
            text: `Found ${results.length} result(s) for "${query}":\n\n${formatted}`,
          }],
        };
      }

      case "artifact_index": {
        const filePath = args?.file_path as string;

        if (!filePath) {
          return {
            content: [{ type: "text", text: "Error: file_path is required" }],
            isError: true,
          };
        }

        if (!fs.existsSync(filePath)) {
          return {
            content: [{ type: "text", text: `Error: File not found: ${filePath}` }],
            isError: true,
          };
        }

        const artifactType = detectArtifactType(filePath);
        if (!artifactType) {
          return {
            content: [{
              type: "text",
              text: `Error: File is not a recognized artifact (must be in thoughts/ledgers/ or thoughts/shared/plans/)`,
            }],
            isError: true,
          };
        }

        const content = fs.readFileSync(filePath, "utf-8");

        if (artifactType === "plan") {
          const record = parsePlanFile(filePath, content);
          index.indexPlan(record);
          return {
            content: [{
              type: "text",
              text: `Indexed plan: ${record.title || path.basename(filePath)}`,
            }],
          };
        } else {
          const record = parseLedgerFile(filePath, content);
          index.indexLedger(record);
          return {
            content: [{
              type: "text",
              text: `Indexed ledger: ${record.sessionName || path.basename(filePath)}`,
            }],
          };
        }
      }

      case "artifact_list": {
        const typeFilter = args?.type as string;
        const type = typeFilter === "plan" || typeFilter === "ledger" ? typeFilter : undefined;

        const results = index.listAll(type);

        if (results.length === 0) {
          return {
            content: [{
              type: "text",
              text: "No artifacts indexed yet. Use artifact_index to add plans and ledgers.",
            }],
          };
        }

        const plans = results.filter(r => r.type === "plan");
        const ledgers = results.filter(r => r.type === "ledger");

        let output = "";

        if (plans.length > 0 && (!type || type === "plan")) {
          output += `## Plans (${plans.length})\n`;
          for (const p of plans) {
            output += `- ${p.title || path.basename(p.filePath)}\n  ${p.filePath}\n`;
          }
          output += "\n";
        }

        if (ledgers.length > 0 && (!type || type === "ledger")) {
          output += `## Ledgers (${ledgers.length})\n`;
          for (const l of ledgers) {
            output += `- ${l.title || path.basename(l.filePath)}\n  ${l.filePath}\n`;
          }
        }

        return {
          content: [{ type: "text", text: output.trim() }],
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error: ${error instanceof Error ? error.message : String(error)}`,
      }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Artifact Index MCP server running on stdio");
}

main().catch(console.error);
