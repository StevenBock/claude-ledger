import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const DEFAULT_DB_DIR = path.join(os.homedir(), ".config", "claude-code", "artifact-index");
const DB_NAME = "context.db";

export interface PlanRecord {
  id: string;
  title?: string;
  filePath: string;
  overview?: string;
  approach?: string;
}

export interface LedgerRecord {
  id: string;
  sessionName?: string;
  filePath: string;
  goal?: string;
  stateNow?: string;
  keyDecisions?: string;
  filesRead?: string;
  filesModified?: string;
}

export interface SearchResult {
  type: "plan" | "ledger";
  id: string;
  filePath: string;
  title?: string;
  summary?: string;
  score: number;
}

const SCHEMA = `
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

export class ArtifactIndex {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(dbDir: string = DEFAULT_DB_DIR) {
    this.dbPath = path.join(dbDir, DB_NAME);
  }

  initialize(): void {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(this.dbPath);
    this.db.exec(SCHEMA);
  }

  indexPlan(record: PlanRecord): void {
    if (!this.db) throw new Error("Database not initialized");

    const existing = this.db
      .prepare(`SELECT id FROM plans WHERE file_path = ?`)
      .get(record.filePath) as { id: string } | undefined;

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

  indexLedger(record: LedgerRecord): void {
    if (!this.db) throw new Error("Database not initialized");

    const existing = this.db
      .prepare(`SELECT id FROM ledgers WHERE file_path = ?`)
      .get(record.filePath) as { id: string } | undefined;

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

  search(query: string, limit: number = 10, type?: "plan" | "ledger"): SearchResult[] {
    if (!this.db) throw new Error("Database not initialized");

    const results: SearchResult[] = [];
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
        `).all(escapedQuery, limit) as Array<{
          id: string;
          file_path: string;
          title: string;
          overview: string;
          rank: number;
        }>;

        for (const row of plans) {
          results.push({
            type: "plan",
            id: row.id,
            filePath: row.file_path,
            title: row.title,
            summary: row.overview,
            score: -row.rank,
          });
        }
      } catch {
        // FTS query failed, try simple LIKE search
        const plans = this.db.prepare(`
          SELECT id, file_path, title, overview
          FROM plans
          WHERE title LIKE ? OR overview LIKE ? OR approach LIKE ?
          LIMIT ?
        `).all(`%${query}%`, `%${query}%`, `%${query}%`, limit) as Array<{
          id: string;
          file_path: string;
          title: string;
          overview: string;
        }>;

        for (const row of plans) {
          results.push({
            type: "plan",
            id: row.id,
            filePath: row.file_path,
            title: row.title,
            summary: row.overview,
            score: 1,
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
        `).all(escapedQuery, limit) as Array<{
          id: string;
          file_path: string;
          session_name: string;
          goal: string;
          rank: number;
        }>;

        for (const row of ledgers) {
          results.push({
            type: "ledger",
            id: row.id,
            filePath: row.file_path,
            title: row.session_name,
            summary: row.goal,
            score: -row.rank,
          });
        }
      } catch {
        // FTS query failed, try simple LIKE search
        const ledgers = this.db.prepare(`
          SELECT id, file_path, session_name, goal
          FROM ledgers
          WHERE session_name LIKE ? OR goal LIKE ? OR key_decisions LIKE ?
          LIMIT ?
        `).all(`%${query}%`, `%${query}%`, `%${query}%`, limit) as Array<{
          id: string;
          file_path: string;
          session_name: string;
          goal: string;
        }>;

        for (const row of ledgers) {
          results.push({
            type: "ledger",
            id: row.id,
            filePath: row.file_path,
            title: row.session_name,
            summary: row.goal,
            score: 1,
          });
        }
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  listAll(type?: "plan" | "ledger"): SearchResult[] {
    if (!this.db) throw new Error("Database not initialized");

    const results: SearchResult[] = [];

    if (!type || type === "plan") {
      const plans = this.db.prepare(`
        SELECT id, file_path, title, overview
        FROM plans
        ORDER BY indexed_at DESC
      `).all() as Array<{
        id: string;
        file_path: string;
        title: string;
        overview: string;
      }>;

      for (const row of plans) {
        results.push({
          type: "plan",
          id: row.id,
          filePath: row.file_path,
          title: row.title,
          summary: row.overview,
          score: 0,
        });
      }
    }

    if (!type || type === "ledger") {
      const ledgers = this.db.prepare(`
        SELECT id, file_path, session_name, goal
        FROM ledgers
        ORDER BY indexed_at DESC
      `).all() as Array<{
        id: string;
        file_path: string;
        session_name: string;
        goal: string;
      }>;

      for (const row of ledgers) {
        results.push({
          type: "ledger",
          id: row.id,
          filePath: row.file_path,
          title: row.session_name,
          summary: row.goal,
          score: 0,
        });
      }
    }

    return results;
  }

  private escapeFtsQuery(query: string): string {
    return query
      .replace(/['"]/g, "")
      .split(/\s+/)
      .filter((term) => term.length > 0)
      .map((term) => `"${term}"`)
      .join(" OR ");
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

let globalIndex: ArtifactIndex | null = null;

export function getArtifactIndex(): ArtifactIndex {
  if (!globalIndex) {
    globalIndex = new ArtifactIndex();
    globalIndex.initialize();
  }
  return globalIndex;
}
