/**
 * Workflow loader using jiti for TypeScript execution.
 *
 * Allows loading workflow definitions from .ts files without
 * requiring users to compile their code first.
 *
 * @module
 */

import { createJiti } from "jiti"
import * as path from "node:path"

/**
 * Load a workflow definition from a TypeScript file.
 *
 * Uses jiti for fast, zero-config TypeScript execution.
 * Looks for a default export or a named 'workflow' export.
 *
 * @param workflowPath - Path to the workflow .ts file
 * @returns The workflow definition
 * @throws Error if the file doesn't export a workflow
 */
export async function loadWorkflow(workflowPath: string): Promise<unknown> {
  const absolutePath = path.isAbsolute(workflowPath)
    ? workflowPath
    : path.resolve(process.cwd(), workflowPath)

  const jiti = createJiti(import.meta.url, {
    interopDefault: true,
    moduleCache: false
  })

  const module = await jiti.import(absolutePath)

  // Check for default export first, then named 'workflow' export
  const mod = module as Record<string, unknown>
  const workflow = mod.default ?? mod.workflow

  if (!workflow) {
    throw new Error(
      `No workflow found in ${workflowPath}. ` +
        `Expected a default export or a named 'workflow' export.`
    )
  }

  // Basic validation
  const w = workflow as { name?: string }
  if (!w.name) {
    throw new Error(
      `Invalid workflow in ${workflowPath}. ` +
        `Workflow must have a 'name' property.`
    )
  }

  return workflow
}
