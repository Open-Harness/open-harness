#!/usr/bin/env node
/**
 * Clean ONLY stray build artifacts from src/ directories.
 *
 * This is a fast check that can run before every build to ensure
 * bundlers read .ts source files, not stale .js compiled output.
 *
 * Use `pnpm clean:stray` before builds or in CI.
 */

import { existsSync, readdirSync, statSync, unlinkSync } from "node:fs"
import { join, relative } from "node:path"

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "")
const STRAY_PATTERNS = [".js", ".d.ts", ".js.map", ".d.ts.map"]

function findStrayArtifacts(dir, artifacts = []) {
  if (!existsSync(dir)) return artifacts

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === "dist" || entry === "build") continue
      findStrayArtifacts(fullPath, artifacts)
    } else if (stat.isFile()) {
      const isStray = STRAY_PATTERNS.some((p) => entry.endsWith(p))
      if (isStray) {
        const tsPath = fullPath.replace(/\.(js|d\.ts)(\.map)?$/, ".ts")
        if (existsSync(tsPath)) artifacts.push(fullPath)
      }
    }
  }
  return artifacts
}

const stray = []
for (const base of [join(ROOT, "packages"), join(ROOT, "apps")]) {
  if (!existsSync(base)) continue
  for (const pkg of readdirSync(base)) {
    const srcPath = join(base, pkg, "src")
    findStrayArtifacts(srcPath, stray)
  }
}

if (stray.length > 0) {
  console.error(`\x1b[31mFound ${stray.length} stray build artifact(s) in src/:\x1b[0m\n`)
  for (const f of stray) {
    console.error(`  ${relative(ROOT, f)}`)
    unlinkSync(f)
  }
  console.error(`\n\x1b[33mCleaned. These files should NEVER exist in src/.\x1b[0m`)
  console.error(`\x1b[33mCheck your tsconfig - don't emit to source directories!\x1b[0m\n`)
}
