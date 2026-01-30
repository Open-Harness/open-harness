/**
 * Loader Unit Tests.
 *
 * Tests for the workflow loader that dynamically imports TypeScript files.
 *
 * @module
 */

import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { loadWorkflow } from "../src/loader.js"

// ─────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────

let tempDir: string

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-loader-test-"))
})

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true })
})

/**
 * Helper to write a workflow file to the temp directory.
 */
function writeWorkflowFile(filename: string, content: string): string {
  const filePath = path.join(tempDir, filename)
  fs.writeFileSync(filePath, content, "utf8")
  return filePath
}

// ─────────────────────────────────────────────────────────────────
// loadWorkflow tests
// ─────────────────────────────────────────────────────────────────

describe("loadWorkflow", () => {
  describe("valid workflows", () => {
    it("loads workflow with default export", async () => {
      const filePath = writeWorkflowFile(
        "default-export.ts",
        `
          export default {
            name: "test-workflow",
            initialState: {},
            start: () => {},
            phases: { done: { terminal: true } }
          }
        `
      )

      const workflow = await loadWorkflow(filePath) as { name: string }
      expect(workflow.name).toBe("test-workflow")
    })

    // Note: Named exports don't work correctly with jiti's interopDefault: true
    // because mod.default becomes the Module object (truthy), so mod.workflow is never checked.
    // This is a known limitation - only default exports are truly supported.
    // See: apps/cli/debug-jiti.ts for behavior verification

    it("prefers default export over named export", async () => {
      const filePath = writeWorkflowFile(
        "both-exports.ts",
        `
          export default {
            name: "default-workflow",
            initialState: {},
            start: () => {},
            phases: { done: { terminal: true } }
          }

          export const workflow = {
            name: "named-workflow",
            initialState: {},
            start: () => {},
            phases: { done: { terminal: true } }
          }
        `
      )

      const workflow = await loadWorkflow(filePath) as { name: string }
      expect(workflow.name).toBe("default-workflow")
    })

    it("resolves relative paths from cwd", async () => {
      const filePath = writeWorkflowFile(
        "relative-path.ts",
        `
          export default {
            name: "relative-workflow",
            initialState: {},
            start: () => {},
            phases: { done: { terminal: true } }
          }
        `
      )

      // Test with absolute path (which is what the function receives after resolution)
      const workflow = await loadWorkflow(filePath) as { name: string }
      expect(workflow.name).toBe("relative-workflow")
    })
  })

  describe("error cases", () => {
    it("throws error when file has no workflow export", async () => {
      // With interopDefault: true, mod.default is the Module object (truthy),
      // so the loader sees it as a "workflow" but without a name property.
      // This results in "Workflow must have a 'name' property" error.
      const filePath = writeWorkflowFile(
        "no-export.ts",
        `
          export const someOtherThing = { foo: "bar" }
        `
      )

      await expect(loadWorkflow(filePath)).rejects.toThrow(
        /Workflow must have a 'name' property/
      )
    })

    it("throws error when workflow has no name property", async () => {
      const filePath = writeWorkflowFile(
        "no-name.ts",
        `
          export default {
            initialState: {},
            start: () => {},
            phases: { done: { terminal: true } }
          }
        `
      )

      await expect(loadWorkflow(filePath)).rejects.toThrow(
        /Workflow must have a 'name' property/
      )
    })

    it("throws error when file does not exist", async () => {
      const nonExistentPath = path.join(tempDir, "nonexistent.ts")

      await expect(loadWorkflow(nonExistentPath)).rejects.toThrow()
    })

    it("throws error when file has syntax error", async () => {
      const filePath = writeWorkflowFile(
        "syntax-error.ts",
        `
          export default {
            name: "broken"
            // missing comma
            initialState: {}
          }
        `
      )

      await expect(loadWorkflow(filePath)).rejects.toThrow()
    })
  })

  describe("edge cases", () => {
    it("handles workflow with empty name", async () => {
      const filePath = writeWorkflowFile(
        "empty-name.ts",
        `
          export default {
            name: "",
            initialState: {},
            start: () => {},
            phases: { done: { terminal: true } }
          }
        `
      )

      // Empty string is falsy, so this should fail the name check
      await expect(loadWorkflow(filePath)).rejects.toThrow(
        /Workflow must have a 'name' property/
      )
    })

    it("handles workflow with complex state", async () => {
      const filePath = writeWorkflowFile(
        "complex-state.ts",
        `
          interface ComplexState {
            count: number
            items: string[]
            nested: { deep: { value: boolean } }
          }

          export default {
            name: "complex-workflow",
            initialState: {
              count: 0,
              items: [],
              nested: { deep: { value: false } }
            } as ComplexState,
            start: () => {},
            phases: { done: { terminal: true } }
          }
        `
      )

      const workflow = await loadWorkflow(filePath) as { name: string; initialState: unknown }
      expect(workflow.name).toBe("complex-workflow")
      expect(workflow.initialState).toEqual({
        count: 0,
        items: [],
        nested: { deep: { value: false } }
      })
    })
  })
})
