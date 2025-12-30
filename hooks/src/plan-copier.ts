#!/usr/bin/env node
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from "fs";
import { join, basename } from "path";
import { homedir } from "os";

// Find most recent plan file in ~/.claude/plans/
const plansDir = join(homedir(), ".claude", "plans");
const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const targetDir = join(projectDir, "thoughts", "shared", "plans");

if (!existsSync(plansDir)) {
  process.exit(0);
}

// Get all .md files and sort by mtime
const files = readdirSync(plansDir)
  .filter((f) => f.endsWith(".md"))
  .map((f) => ({
    name: f,
    path: join(plansDir, f),
    mtime: statSync(join(plansDir, f)).mtime.getTime(),
  }))
  .sort((a, b) => b.mtime - a.mtime);

if (files.length === 0) {
  process.exit(0);
}

const mostRecent = files[0];

// Only copy if modified in last 60 seconds (likely the one just created)
const now = Date.now();
if (now - mostRecent.mtime > 60000) {
  process.exit(0);
}

// Ensure target directory exists
if (!existsSync(targetDir)) {
  mkdirSync(targetDir, { recursive: true });
}

// Generate date-prefixed filename
const today = new Date().toISOString().split("T")[0];
const originalName = basename(mostRecent.name, ".md");
const targetName = `${today}-${originalName}.md`;
const targetPath = join(targetDir, targetName);

// Copy the file
copyFileSync(mostRecent.path, targetPath);

console.log(`Plan copied to ${targetPath}`);
