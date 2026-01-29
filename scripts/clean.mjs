#!/usr/bin/env node
/**
 * Clean build artifacts from the monorepo.
 *
 * This script removes:
 * 1. dist/ and build/ directories (expected build outputs)
 * 2. Stray .js/.d.ts files from src/ directories (the DANGEROUS ones)
 *
 * The stray files in src/ are particularly problematic because bundlers
 * prefer .js files over .ts files, causing them to use stale compiled
 * output instead of current source code.
 */

import { existsSync, readdirSync, rmSync, statSync, unlinkSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

// Patterns for stray build artifacts that should NEVER be in src/
const STRAY_PATTERNS = [".js", ".d.ts", ".js.map", ".d.ts.map"];

function findStrayArtifacts(dir, artifacts = []) {
	if (!existsSync(dir)) return artifacts;

	for (const entry of readdirSync(dir)) {
		const fullPath = join(dir, entry);
		const stat = statSync(fullPath);

		if (stat.isDirectory()) {
			// Skip node_modules, dist, build
			if (entry === "node_modules" || entry === "dist" || entry === "build") {
				continue;
			}
			findStrayArtifacts(fullPath, artifacts);
		} else if (stat.isFile()) {
			// Check if this looks like a stray build artifact
			const isStray = STRAY_PATTERNS.some((pattern) => entry.endsWith(pattern));
			if (isStray) {
				// Only flag as stray if there's a corresponding .ts file
				const tsPath = fullPath.replace(/\.(js|d\.ts)(\.map)?$/, ".ts");
				if (existsSync(tsPath)) {
					artifacts.push(fullPath);
				}
			}
		}
	}

	return artifacts;
}

console.log("Cleaning build artifacts...\n");

// 1. Clean dist/ and build/ directories
const packagesDir = join(ROOT, "packages");
const appsDir = join(ROOT, "apps");

let distCount = 0;
for (const baseDir of [packagesDir, appsDir]) {
	if (!existsSync(baseDir)) continue;

	for (const pkg of readdirSync(baseDir)) {
		const pkgPath = join(baseDir, pkg);
		if (!statSync(pkgPath).isDirectory()) continue;

		for (const buildDir of ["dist", "build"]) {
			const buildPath = join(pkgPath, buildDir);
			if (existsSync(buildPath)) {
				console.log(`  Removing ${relative(ROOT, buildPath)}/`);
				rmSync(buildPath, { recursive: true, force: true });
				distCount++;
			}
		}
	}
}

console.log(`\nRemoved ${distCount} build directories.\n`);

// 2. Find and remove stray artifacts from src/ directories
console.log("Scanning for stray build artifacts in src/ directories...");

const strayArtifacts = [];
for (const baseDir of [packagesDir, appsDir]) {
	if (!existsSync(baseDir)) continue;

	for (const pkg of readdirSync(baseDir)) {
		const srcPath = join(baseDir, pkg, "src");
		findStrayArtifacts(srcPath, strayArtifacts);
	}
}

if (strayArtifacts.length > 0) {
	console.log(`\nFound ${strayArtifacts.length} stray artifact(s):\n`);
	for (const artifact of strayArtifacts) {
		console.log(`  Removing ${relative(ROOT, artifact)}`);
		unlinkSync(artifact);
	}
	console.log(
		`\nRemoved ${strayArtifacts.length} stray artifacts from src/ directories.`,
	);
} else {
	console.log("\nNo stray artifacts found in src/ directories.");
}

console.log("\nClean complete!");
