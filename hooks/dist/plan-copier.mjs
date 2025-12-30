#!/usr/bin/env node

// hooks/src/plan-copier.ts
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, readFileSync } from "fs";
import { join, basename } from "path";
import { homedir } from "os";
var plansDir = join(homedir(), ".claude", "plans");
var projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
var targetDir = join(projectDir, "thoughts", "shared", "plans", "pending");
if (!existsSync(plansDir)) {
  process.exit(0);
}
var files = readdirSync(plansDir).filter((f) => f.endsWith(".md")).map((f) => ({
  name: f,
  path: join(plansDir, f),
  mtime: statSync(join(plansDir, f)).mtime.getTime()
})).sort((a, b) => b.mtime - a.mtime);
if (files.length === 0) {
  process.exit(0);
}
var mostRecent = files[0];
var now = Date.now();
if (now - mostRecent.mtime > 6e4) {
  process.exit(0);
}
if (!existsSync(targetDir)) {
  mkdirSync(targetDir, { recursive: true });
}
function extractTitle(content2) {
  const headingMatch = content2.match(/^#\s+(.+)$/m);
  if (headingMatch) {
    return headingMatch[1].replace(/^Plan:\s*/i, "").trim();
  }
  const goalMatch = content2.match(/\*\*Goal:\*\*\s*(.+)$/m);
  if (goalMatch) {
    return goalMatch[1].trim();
  }
  return null;
}
function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").substring(0, 50);
}
var content = readFileSync(mostRecent.path, "utf-8");
var title = extractTitle(content);
var today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
var targetName;
if (title) {
  const slug = slugify(title);
  targetName = `${today}-${slug}.md`;
} else {
  const originalName = basename(mostRecent.name, ".md");
  targetName = `${today}-${originalName}.md`;
}
var targetPath = join(targetDir, targetName);
var counter = 1;
while (existsSync(targetPath)) {
  const baseName = targetName.replace(".md", "");
  targetPath = join(targetDir, `${baseName}-${counter}.md`);
  counter++;
}
copyFileSync(mostRecent.path, targetPath);
console.log(`Plan copied to ${targetPath}`);
