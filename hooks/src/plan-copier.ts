#!/usr/bin/env node
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, readFileSync } from "fs";
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

// Extract title from plan content
function extractTitle(content: string): string | null {
  // Try first # heading
  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch) {
    return headingMatch[1].replace(/^Plan:\s*/i, "").trim();
  }
  // Try **Goal:** line
  const goalMatch = content.match(/\*\*Goal:\*\*\s*(.+)$/m);
  if (goalMatch) {
    return goalMatch[1].trim();
  }
  return null;
}

// Slugify a title
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50);
}

// Read plan content and extract title
const content = readFileSync(mostRecent.path, "utf-8");
const title = extractTitle(content);

// Generate date-prefixed filename
const today = new Date().toISOString().split("T")[0];
let targetName: string;

if (title) {
  const slug = slugify(title);
  targetName = `${today}-${slug}.md`;
} else {
  const originalName = basename(mostRecent.name, ".md");
  targetName = `${today}-${originalName}.md`;
}

// Avoid duplicates by appending number
let targetPath = join(targetDir, targetName);
let counter = 1;
while (existsSync(targetPath)) {
  const baseName = targetName.replace(".md", "");
  targetPath = join(targetDir, `${baseName}-${counter}.md`);
  counter++;
}

// Copy the file
copyFileSync(mostRecent.path, targetPath);

console.log(`Plan copied to ${targetPath}`);
