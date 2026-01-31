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
import { Console, Effect } from "effect"
import { readFileSync } from "node:fs"

import { topologicalSort } from "./graph.js"
import { loadTasks } from "./loader.js"
import { createObserver } from "./observer.js"
import { taskWorkflow } from "./workflow.js"

/**
 * Main program - loads tasks, sorts them, and executes each in order.
 */
const main = Effect.gen(function*() {
  const args = process.argv.slice(2)

  if (args.length < 2) {
    yield* Console.error("Usage: bun run src/index.ts <tasks-path> <plan-path>")
    yield* Console.error("")
    yield* Console.error("  tasks-path  Directory containing task JSON files")
    yield* Console.error("  plan-path   Path to plan markdown file")
    return yield* Effect.fail(new Error("Missing arguments"))
  }

  const [tasksPath, planPath] = args

  // Load plan
  yield* Console.log(`Loading plan from: ${planPath}`)
  const plan = yield* Effect.try({
    try: () => readFileSync(planPath, "utf-8"),
    catch: (e) => new Error(`Failed to read plan: ${String(e)}`)
  })

  // Load tasks
  yield* Console.log(`Loading tasks from: ${tasksPath}`)
  const tasks = yield* loadTasks(tasksPath)
  yield* Console.log(`Loaded ${tasks.length} tasks`)

  // Filter to only pending tasks
  const pendingTasks = tasks.filter((t) => t.status === "pending")
  yield* Console.log(`Found ${pendingTasks.length} pending tasks`)

  if (pendingTasks.length === 0) {
    yield* Console.log("No pending tasks to execute")
    return
  }

  // Sort by dependencies
  const sorted = topologicalSort(pendingTasks)
  yield* Console.log(`Execution order: ${sorted.map((t) => t.id).join(" -> ")}`)

  // Execute each task
  for (const task of sorted) {
    yield* Console.log(`\n${"=".repeat(60)}`)
    yield* Console.log(`Task ${task.id}: ${task.subject}`)
    yield* Console.log("=".repeat(60))

    const result = yield* Effect.promise(() =>
      run(taskWorkflow, {
        input: { plan, task },
        runtime: { mode: "live" },
        observer: createObserver()
      })
    )

    if (!result.state.result?.success) {
      yield* Console.error(`\nTask ${task.id} failed`)
      if (result.state.result?.summary) {
        yield* Console.error(`Reason: ${result.state.result.summary}`)
      }
      return yield* Effect.fail(new Error(`Task ${task.id} failed`))
    }

    yield* Console.log(`\nTask ${task.id} completed successfully`)
  }

  yield* Console.log(`\n${"=".repeat(60)}`)
  yield* Console.log("All tasks completed successfully")
  yield* Console.log("=".repeat(60))
})

// Run the program
Effect.runPromise(main).catch((e) => {
  console.error("Fatal error:", e)
  process.exit(1)
})
