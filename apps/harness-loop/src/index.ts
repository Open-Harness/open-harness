#!/usr/bin/env bun
/**
 * Harness Loop - Task Executor Script
 *
 * Loads Claude Code task lists and executes them sequentially
 * using the Open Harness workflow engine.
 *
 * Usage:
 *   bun run src/index.ts <tasks-path> <plan-path>
 *
 * @module
 */

import { run } from "@open-scaffold/core"
import { Effect } from "effect"
import { readFileSync } from "node:fs"

import { topologicalSort } from "./graph.js"
import { loadTasks } from "./loader.js"
import { createObserver } from "./observer.js"
import {
  renderAllTasksComplete,
  renderError,
  renderExecutionOrder,
  renderTaskComplete,
  renderTaskHeader
} from "./renderer.js"
import { taskWorkflow } from "./workflow.js"

/**
 * Main program - loads tasks, sorts them, and executes each in order.
 */
const main = Effect.gen(function*() {
  const args = process.argv.slice(2)

  if (args.length < 2) {
    console.error("Usage: bun run src/index.ts <tasks-path> <plan-path>")
    console.error("")
    console.error("  tasks-path  Directory containing task JSON files")
    console.error("  plan-path   Path to plan markdown file")
    return yield* Effect.fail(new Error("Missing arguments"))
  }

  const [tasksPath, planPath] = args

  // Load plan
  const plan = yield* Effect.try({
    try: () => readFileSync(planPath, "utf-8"),
    catch: (e) => new Error(`Failed to read plan: ${String(e)}`)
  })

  // Load tasks
  const tasks = yield* loadTasks(tasksPath)

  // Filter to only pending tasks
  const pendingTasks = tasks.filter((t) => t.status === "pending")

  if (pendingTasks.length === 0) {
    console.log("No pending tasks to execute")
    return
  }

  // Sort by dependencies
  const sorted = topologicalSort(pendingTasks)

  // Show execution order
  process.stdout.write(renderExecutionOrder(sorted.map((t) => t.id)))

  // Execute each task
  for (const task of sorted) {
    // Render task header
    process.stdout.write(renderTaskHeader(task.id, task.subject, task.description))

    const result = yield* Effect.promise(() =>
      run(taskWorkflow, {
        input: { plan, task },
        runtime: { mode: "live" },
        observer: createObserver()
      })
    )

    const success = result.state.result?.success ?? false
    const summary = result.state.result?.summary ?? "No summary provided"

    // Render task completion
    process.stdout.write(renderTaskComplete(task.id, success, summary))

    if (!success) {
      return yield* Effect.fail(new Error(`Task ${task.id} failed`))
    }
  }

  // Final success message
  process.stdout.write(renderAllTasksComplete(sorted.length))
})

// Run the program
Effect.runPromise(main).catch((e) => {
  process.stdout.write(renderError(e))
  process.exit(1)
})
