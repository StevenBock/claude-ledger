#!/usr/bin/env node

// servers/artifact-index/src/server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import * as fs2 from "fs";
import * as path2 from "path";
import * as crypto from "crypto";

// servers/artifact-index/src/index.ts
import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
var DEFAULT_DB_DIR = path.join(os.homedir(), ".config", "claude-code", "artifact-index");
var DB_NAME = "context.db";
var SCHEMA = `
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  title TEXT,
  file_path TEXT UNIQUE NOT NULL,
  overview TEXT,
  approach TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ledgers (
  id TEXT PRIMARY KEY,
  session_name TEXT,
  file_path TEXT UNIQUE NOT NULL,
  goal TEXT,
  state_now TEXT,
  key_decisions TEXT,
  files_read TEXT,
  files_modified TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE VIRTUAL TABLE IF NOT EXISTS plans_fts USING fts5(id, title, overview, approach);
CREATE VIRTUAL TABLE IF NOT EXISTS ledgers_fts USING fts5(id, session_name, goal, state_now, key_decisions);
`;
var ArtifactIndex = class {
  db = null;
  dbPath;
  constructor(dbDir = DEFAULT_DB_DIR) {
    this.dbPath = path.join(dbDir, DB_NAME);
  }
  initialize() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(this.dbPath);
    this.db.exec(SCHEMA);
  }
  indexPlan(record) {
    if (!this.db) throw new Error("Database not initialized");
    const existing = this.db.prepare(`SELECT id FROM plans WHERE file_path = ?`).get(record.filePath);
    if (existing) {
      this.db.prepare(`DELETE FROM plans_fts WHERE id = ?`).run(existing.id);
    }
    this.db.prepare(`
      INSERT INTO plans (id, title, file_path, overview, approach, indexed_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(file_path) DO UPDATE SET
        id = excluded.id,
        title = excluded.title,
        overview = excluded.overview,
        approach = excluded.approach,
        indexed_at = CURRENT_TIMESTAMP
    `).run(record.id, record.title ?? null, record.filePath, record.overview ?? null, record.approach ?? null);
    this.db.prepare(`
      INSERT INTO plans_fts (id, title, overview, approach)
      VALUES (?, ?, ?, ?)
    `).run(record.id, record.title ?? null, record.overview ?? null, record.approach ?? null);
  }
  indexLedger(record) {
    if (!this.db) throw new Error("Database not initialized");
    const existing = this.db.prepare(`SELECT id FROM ledgers WHERE file_path = ?`).get(record.filePath);
    if (existing) {
      this.db.prepare(`DELETE FROM ledgers_fts WHERE id = ?`).run(existing.id);
    }
    this.db.prepare(`
      INSERT INTO ledgers (id, session_name, file_path, goal, state_now, key_decisions, files_read, files_modified, indexed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(file_path) DO UPDATE SET
        id = excluded.id,
        session_name = excluded.session_name,
        goal = excluded.goal,
        state_now = excluded.state_now,
        key_decisions = excluded.key_decisions,
        files_read = excluded.files_read,
        files_modified = excluded.files_modified,
        indexed_at = CURRENT_TIMESTAMP
    `).run(
      record.id,
      record.sessionName ?? null,
      record.filePath,
      record.goal ?? null,
      record.stateNow ?? null,
      record.keyDecisions ?? null,
      record.filesRead ?? null,
      record.filesModified ?? null
    );
    this.db.prepare(`
      INSERT INTO ledgers_fts (id, session_name, goal, state_now, key_decisions)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      record.id,
      record.sessionName ?? null,
      record.goal ?? null,
      record.stateNow ?? null,
      record.keyDecisions ?? null
    );
  }
  search(query, limit = 10, type) {
    if (!this.db) throw new Error("Database not initialized");
    const results = [];
    const escapedQuery = this.escapeFtsQuery(query);
    if (!type || type === "plan") {
      try {
        const plans = this.db.prepare(`
          SELECT p.id, p.file_path, p.title, p.overview, rank
          FROM plans_fts
          JOIN plans p ON plans_fts.id = p.id
          WHERE plans_fts MATCH ?
          ORDER BY rank
          LIMIT ?
        `).all(escapedQuery, limit);
        for (const row of plans) {
          results.push({
            type: "plan",
            id: row.id,
            filePath: row.file_path,
            title: row.title,
            summary: row.overview,
            score: -row.rank
          });
        }
      } catch {
        const plans = this.db.prepare(`
          SELECT id, file_path, title, overview
          FROM plans
          WHERE title LIKE ? OR overview LIKE ? OR approach LIKE ?
          LIMIT ?
        `).all(`%${query}%`, `%${query}%`, `%${query}%`, limit);
        for (const row of plans) {
          results.push({
            type: "plan",
            id: row.id,
            filePath: row.file_path,
            title: row.title,
            summary: row.overview,
            score: 1
          });
        }
      }
    }
    if (!type || type === "ledger") {
      try {
        const ledgers = this.db.prepare(`
          SELECT l.id, l.file_path, l.session_name, l.goal, rank
          FROM ledgers_fts
          JOIN ledgers l ON ledgers_fts.id = l.id
          WHERE ledgers_fts MATCH ?
          ORDER BY rank
          LIMIT ?
        `).all(escapedQuery, limit);
        for (const row of ledgers) {
          results.push({
            type: "ledger",
            id: row.id,
            filePath: row.file_path,
            title: row.session_name,
            summary: row.goal,
            score: -row.rank
          });
        }
      } catch {
        const ledgers = this.db.prepare(`
          SELECT id, file_path, session_name, goal
          FROM ledgers
          WHERE session_name LIKE ? OR goal LIKE ? OR key_decisions LIKE ?
          LIMIT ?
        `).all(`%${query}%`, `%${query}%`, `%${query}%`, limit);
        for (const row of ledgers) {
          results.push({
            type: "ledger",
            id: row.id,
            filePath: row.file_path,
            title: row.session_name,
            summary: row.goal,
            score: 1
          });
        }
      }
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }
  listAll(type) {
    if (!this.db) throw new Error("Database not initialized");
    const results = [];
    if (!type || type === "plan") {
      const plans = this.db.prepare(`
        SELECT id, file_path, title, overview
        FROM plans
        ORDER BY indexed_at DESC
      `).all();
      for (const row of plans) {
        results.push({
          type: "plan",
          id: row.id,
          filePath: row.file_path,
          title: row.title,
          summary: row.overview,
          score: 0
        });
      }
    }
    if (!type || type === "ledger") {
      const ledgers = this.db.prepare(`
        SELECT id, file_path, session_name, goal
        FROM ledgers
        ORDER BY indexed_at DESC
      `).all();
      for (const row of ledgers) {
        results.push({
          type: "ledger",
          id: row.id,
          filePath: row.file_path,
          title: row.session_name,
          summary: row.goal,
          score: 0
        });
      }
    }
    return results;
  }
  escapeFtsQuery(query) {
    return query.replace(/['"]/g, "").split(/\s+/).filter((term) => term.length > 0).map((term) => `"${term}"`).join(" OR ");
  }
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
};
var globalIndex = null;
function getArtifactIndex() {
  if (!globalIndex) {
    globalIndex = new ArtifactIndex();
    globalIndex.initialize();
  }
  return globalIndex;
}

// servers/artifact-index/src/server.ts
var server = new Server(
  {
    name: "artifact-index",
    version: "1.0.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "artifact_search",
        description: "Search past plans and ledgers for relevant precedent. Returns ranked results.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query (keywords to find)"
            },
            limit: {
              type: "number",
              description: "Maximum results to return (default: 10)"
            },
            type: {
              type: "string",
              enum: ["all", "plan", "ledger"],
              description: "Filter by artifact type (default: all)"
            }
          },
          required: ["query"]
        }
      },
      {
        name: "artifact_index",
        description: "Index a plan or ledger file for searching. Call this after creating/updating artifacts.",
        inputSchema: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "Absolute path to the plan or ledger file"
            }
          },
          required: ["file_path"]
        }
      },
      {
        name: "artifact_list",
        description: "List all indexed artifacts (plans and ledgers)",
        inputSchema: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["all", "plan", "ledger"],
              description: "Filter by artifact type (default: all)"
            }
          }
        }
      }
    ]
  };
});
function parsePlanFile(filePath, content) {
  const id = crypto.createHash("md5").update(filePath).digest("hex").slice(0, 12);
  const titleMatch = content.match(/^# (.+)/m);
  const title = titleMatch?.[1];
  const goalMatch = content.match(/\*\*Goal:\*\* (.+)/);
  const overview = goalMatch?.[1];
  const archMatch = content.match(/\*\*Architecture:\*\* (.+)/);
  const approach = archMatch?.[1];
  return { id, filePath, title, overview, approach };
}
function parseLedgerFile(filePath, content) {
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
function detectArtifactType(filePath) {
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
        const query = args?.query;
        const limit = args?.limit || 10;
        const typeFilter = args?.type;
        if (!query) {
          return {
            content: [{ type: "text", text: "Error: query is required" }],
            isError: true
          };
        }
        const type = typeFilter === "plan" || typeFilter === "ledger" ? typeFilter : void 0;
        const results = index.search(query, limit, type);
        if (results.length === 0) {
          return {
            content: [{
              type: "text",
              text: `No results found for "${query}". Try different keywords or check that artifacts have been indexed.`
            }]
          };
        }
        const formatted = results.map((r, i) => {
          return `${i + 1}. [${r.type.toUpperCase()}] ${r.title || path2.basename(r.filePath)}
   File: ${r.filePath}
   ${r.summary ? `Summary: ${r.summary}` : ""}
   Score: ${r.score.toFixed(2)}`;
        }).join("\n\n");
        return {
          content: [{
            type: "text",
            text: `Found ${results.length} result(s) for "${query}":

${formatted}`
          }]
        };
      }
      case "artifact_index": {
        const filePath = args?.file_path;
        if (!filePath) {
          return {
            content: [{ type: "text", text: "Error: file_path is required" }],
            isError: true
          };
        }
        if (!fs2.existsSync(filePath)) {
          return {
            content: [{ type: "text", text: `Error: File not found: ${filePath}` }],
            isError: true
          };
        }
        const artifactType = detectArtifactType(filePath);
        if (!artifactType) {
          return {
            content: [{
              type: "text",
              text: `Error: File is not a recognized artifact (must be in thoughts/ledgers/ or thoughts/shared/plans/)`
            }],
            isError: true
          };
        }
        const content = fs2.readFileSync(filePath, "utf-8");
        if (artifactType === "plan") {
          const record = parsePlanFile(filePath, content);
          index.indexPlan(record);
          return {
            content: [{
              type: "text",
              text: `Indexed plan: ${record.title || path2.basename(filePath)}`
            }]
          };
        } else {
          const record = parseLedgerFile(filePath, content);
          index.indexLedger(record);
          return {
            content: [{
              type: "text",
              text: `Indexed ledger: ${record.sessionName || path2.basename(filePath)}`
            }]
          };
        }
      }
      case "artifact_list": {
        const typeFilter = args?.type;
        const type = typeFilter === "plan" || typeFilter === "ledger" ? typeFilter : void 0;
        const results = index.listAll(type);
        if (results.length === 0) {
          return {
            content: [{
              type: "text",
              text: "No artifacts indexed yet. Use artifact_index to add plans and ledgers."
            }]
          };
        }
        const plans = results.filter((r) => r.type === "plan");
        const ledgers = results.filter((r) => r.type === "ledger");
        let output = "";
        if (plans.length > 0 && (!type || type === "plan")) {
          output += `## Plans (${plans.length})
`;
          for (const p of plans) {
            output += `- ${p.title || path2.basename(p.filePath)}
  ${p.filePath}
`;
          }
          output += "\n";
        }
        if (ledgers.length > 0 && (!type || type === "ledger")) {
          output += `## Ledgers (${ledgers.length})
`;
          for (const l of ledgers) {
            output += `- ${l.title || path2.basename(l.filePath)}
  ${l.filePath}
`;
          }
        }
        return {
          content: [{ type: "text", text: output.trim() }]
        };
      }
      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true
        };
    }
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
});
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Artifact Index MCP server running on stdio");
}
main().catch(console.error);
