#!/usr/bin/env node
/**
 * Remove stray TypeScript build artifacts from src/ directories.
 *
 * This prebuild script ensures that bundlers don't pick up stale .js files
 * instead of current .ts source files. It does NOT remove dist/ or build/
 * directories - those are intentional build outputs.
 */

import { existsSync, readdirSync, statSync, unlinkSync } from "node:fs"
import { join, relative } from "node:path"

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "")

// Patterns for stray build artifacts that should NEVER be in src/
const STRAY_PATTERNS = [".js", ".d.ts", ".js.map", ".d.ts.map"]

function findStrayArtifacts(dir, artifacts = []) {
  if (!existsSync(dir)) return artifacts

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      // Skip node_modules, dist, build
      if (entry === "node_modules" || entry === "dist" || entry === "build") {
        continue
      }
      findStrayArtifacts(fullPath, artifacts)
    } else if (stat.isFile()) {
      // Check if this looks like a stray build artifact
      const isStray = STRAY_PATTERNS.some((pattern) => entry.endsWith(pattern))
      if (isStray) {
        // Only flag as stray if there's a corresponding .ts file
        const tsPath = fullPath.replace(/\.(js|d\.ts)(\.map)?$/, ".ts")
        if (existsSync(tsPath)) {
          artifacts.push(fullPath)
        }
      }
    }
  }

  return artifacts
}

// Find and remove stray artifacts from src/ directories
const packagesDir = join(ROOT, "packages")
const appsDir = join(ROOT, "apps")

const strayArtifacts = []
for (const baseDir of [packagesDir, appsDir]) {
  if (!existsSync(baseDir)) continue

  for (const pkg of readdirSync(baseDir)) {
    const srcPath = join(baseDir, pkg, "src")
    findStrayArtifacts(srcPath, strayArtifacts)
  }
}

if (strayArtifacts.length > 0) {
  console.log(`Removing ${strayArtifacts.length} stray artifact(s):`)
  for (const artifact of strayArtifacts) {
    console.log(`  ${relative(ROOT, artifact)}`)
    unlinkSync(artifact)
  }
}
