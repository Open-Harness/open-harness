#!/usr/bin/env bun
/**
 * Update README metadata in YAML frontmatter
 *
 * Scans packages/**\/*.md files and updates frontmatter with:
 * - lastUpdated: Current ISO 8601 timestamp with seconds
 * - lastCommit: Git commit hash (HEAD)
 * - lastCommitDate: Date of last commit
 *
 * Usage:
 *   bun scripts/update-readme-metadata.ts [--changed-only]
 *
 * --changed-only: Only update staged or modified files (default for pre-commit hook)
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import path from "path";

interface FrontmatterData {
  title?: string;
  lastUpdated?: string;
  lastCommit?: string;
  lastCommitDate?: string;
  scope?: string | string[];
  [key: string]: unknown;
}

/**
 * Get current ISO 8601 timestamp with seconds precision
 */
function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Get last commit hash and date
 */
function getGitInfo(): { hash: string; date: string } {
  try {
    const hash = execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
    const date = execSync("git log -1 --format=%aI HEAD", {
      encoding: "utf-8",
    }).trim();
    return { hash, date };
  } catch {
    console.error("❌ Failed to get git info. Are you in a git repository?");
    process.exit(1);
  }
}

/**
 * Parse YAML frontmatter from markdown content
 */
function parseFrontmatter(content: string): {
  data: FrontmatterData;
  rest: string;
  exists: boolean;
} {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { data: {}, rest: content, exists: false };
  }

  const yamlStr = match[1];
  const rest = match[2];

  // Simple YAML parser for our use case
  const data: FrontmatterData = {};
  const lines = yamlStr.split("\n");
  let currentArray: string[] | null = null;
  let currentArrayKey: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.startsWith("#")) continue;

    // Check if this is an array item (indented with "- ")
    if (line.startsWith("  - ")) {
      if (currentArray !== null) {
        currentArray.push(line.substring(4).trim());
      }
      continue;
    }

    // If we were building an array and now we're on a non-array line, save it
    if (currentArray !== null && currentArrayKey !== null) {
      data[currentArrayKey] = currentArray;
      currentArray = null;
      currentArrayKey = null;
    }

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.substring(0, colonIdx).trim();
    const value = line.substring(colonIdx + 1).trim();

    // Check if this starts an array
    if (value === "" && i + 1 < lines.length && lines[i + 1].startsWith("  - ")) {
      currentArray = [];
      currentArrayKey = key;
      continue;
    }

    // Handle quoted strings
    if (value.startsWith('"') && value.endsWith('"')) {
      data[key] = value.slice(1, -1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      data[key] = value.slice(1, -1);
    } else if (value === "[]") {
      data[key] = [];
    } else if (value === "{}") {
      data[key] = {};
    } else if (value.toLowerCase() === "true") {
      data[key] = true;
    } else if (value.toLowerCase() === "false") {
      data[key] = false;
    } else {
      data[key] = value;
    }
  }

  // Save any remaining array
  if (currentArray !== null && currentArrayKey !== null) {
    data[currentArrayKey] = currentArray;
  }

  return { data, rest, exists: true };
}

/**
 * Stringify YAML frontmatter
 */
function stringifyFrontmatter(data: FrontmatterData): string {
  const lines: string[] = [];

  // Maintain order: title, lastUpdated, lastCommit, lastCommitDate, scope, others
  const orderedKeys = [
    "title",
    "lastUpdated",
    "lastCommit",
    "lastCommitDate",
    "scope",
  ];

  // Add ordered keys first
  for (const key of orderedKeys) {
    if (key in data) {
      const value = data[key];
      if (Array.isArray(value)) {
        lines.push(`${key}:`);
        for (const item of value) {
          lines.push(`  - ${item}`);
        }
      } else if (typeof value === "string") {
        lines.push(`${key}: "${value}"`);
      } else {
        lines.push(`${key}: ${value}`);
      }
    }
  }

  // Add remaining keys
  for (const key of Object.keys(data)) {
    if (!orderedKeys.includes(key)) {
      const value = data[key];
      if (Array.isArray(value)) {
        lines.push(`${key}:`);
        for (const item of value) {
          lines.push(`  - ${item}`);
        }
      } else if (typeof value === "string") {
        lines.push(`${key}: "${value}"`);
      } else {
        lines.push(`${key}: ${value}`);
      }
    }
  }

  return lines.join("\n");
}

/**
 * Update file with new frontmatter
 */
function updateFile(
  filePath: string,
  timestamp: string,
  gitHash: string,
  gitDate: string
): boolean {
  try {
    const content = readFileSync(filePath, "utf-8");
    const { data, rest, exists } = parseFrontmatter(content);

    // Update metadata
    data.lastUpdated = timestamp;
    data.lastCommit = gitHash;
    data.lastCommitDate = gitDate;

    // Ensure scope is array if it exists
    if (data.scope && typeof data.scope === "string") {
      data.scope = [data.scope];
    }

    const newFrontmatter = stringifyFrontmatter(data);
    const newContent = `---\n${newFrontmatter}\n---\n${rest}`;

    writeFileSync(filePath, newContent, "utf-8");
    return true;
  } catch (error) {
    console.error(`❌ Failed to update ${filePath}:`, error);
    return false;
  }
}

/**
 * Get list of changed files in staging area
 */
function getChangedFiles(): string[] {
  try {
    const output = execSync("git diff --cached --name-only", {
      encoding: "utf-8",
    });
    return output
      .split("\n")
      .filter((f) => f.endsWith(".md") && f.startsWith("packages/"));
  } catch {
    return [];
  }
}

/**
 * Recursively find all README.md files in a directory
 */
function findReadmes(dir: string, results: string[] = []): string[] {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip node_modules, .git, etc.
        if (![".git", "node_modules", ".next", "dist", "build", ".turbo"].includes(entry.name)) {
          findReadmes(fullPath, results);
        }
      } else if (entry.name === "README.md") {
        results.push(fullPath);
      }
    }
  } catch {
    // Ignore permission errors
  }
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const changedOnly = args.includes("--changed-only");

  console.log("📝 Updating README metadata...");

  const { hash: gitHash, date: gitDate } = getGitInfo();
  const timestamp = getCurrentTimestamp();

  let files: string[] = [];

  if (changedOnly) {
    files = getChangedFiles();
    if (files.length === 0) {
      console.log("✅ No changed READMEs to update");
      return;
    }
  } else {
    // Find all READMEs in packages/**
    files = findReadmes("packages");
  }

  let updated = 0;
  for (const file of files) {
    if (await updateFile(file, timestamp, gitHash, gitDate)) {
      updated++;
      console.log(`✅ ${file}`);
    }
  }

  console.log(`\n✨ Updated ${updated} README(s)`);
  console.log(`   Timestamp: ${timestamp}`);
  console.log(`   Commit: ${gitHash}`);
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
