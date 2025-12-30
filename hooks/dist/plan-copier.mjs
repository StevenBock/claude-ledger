#!/usr/bin/env node

// hooks/src/plan-copier.ts
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from "fs";
import { join, basename } from "path";
import { homedir } from "os";
var plansDir = join(homedir(), ".claude", "plans");
var projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
var targetDir = join(projectDir, "thoughts", "shared", "plans");
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
var today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
var originalName = basename(mostRecent.name, ".md");
var targetName = `${today}-${originalName}.md`;
var targetPath = join(targetDir, targetName);
copyFileSync(mostRecent.path, targetPath);
console.log(`Plan copied to ${targetPath}`);
