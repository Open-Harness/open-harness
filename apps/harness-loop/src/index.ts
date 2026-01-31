#!/usr/bin/env bun

/**
 * Harness Loop - Task Executor Script
 *
 * Loads Claude Code task lists and executes them sequentially
 * using the Open Harness workflow engine.
 *
 * Usage:
 *   bun run src/index.ts <tasks-path> <plan-path> [--quiet|-q]
 *
 * Flags:
 *   --quiet, -q  Hide tool calls/results, show only spinner + task boxes
 *
 * @module
 */

import { run } from "@open-scaffold/core"
import { Effect, pipe } from "effect"
import { readFileSync } from "node:fs"

import { type CycleDetectedError, topologicalSort } from "./graph.js"
import { type LoaderError, loadTasks } from "./loader.js"
import { createObserver } from "./observer.js"
import { renderError, renderExecutionOrder, renderOutro, renderTaskComplete, renderTaskHeader } from "./renderer.js"
import { taskWorkflow } from "./workflow.js"

/**
 * Error reading the plan file.
 */
class PlanReadError {
  readonly _tag = "PlanReadError"
  constructor(
    readonly path: string,
    readonly cause: unknown
  ) {}
}

/**
 * Error when no arguments provided.
 */
class MissingArgumentsError {
  readonly _tag = "MissingArgumentsError"
}

/**
 * Error when a task fails execution.
 */
class TaskFailedError {
  readonly _tag = "TaskFailedError"
  constructor(readonly taskId: string) {}
}

/**
 * Union of all main program errors.
 */
type MainError = MissingArgumentsError | PlanReadError | LoaderError | CycleDetectedError | TaskFailedError

/**
 * Convert error to user-friendly message.
 */
const errorToMessage = (error: MainError): string => {
  switch (error._tag) {
    case "MissingArgumentsError":
      return "Missing required arguments"
    case "PlanReadError":
      return `Failed to read plan file: ${error.path}`
    case "TaskDirectoryError":
      return `Failed to read tasks directory: ${error.path}`
    case "TaskParseError":
      return `Failed to parse task file: ${error.file} - ${error.cause}`
    case "CycleDetectedError":
      return `Cycle detected in task dependencies: ${error.taskIds.join(", ")}`
    case "TaskFailedError":
      return `Task ${error.taskId} failed`
  }
}

/**
 * Print usage information.
 */
const printUsage = (): void => {
  console.error("Usage: bun run src/index.ts <tasks-path> <plan-path> [--quiet|-q]")
  console.error("")
  console.error("  tasks-path  Directory containing task JSON files")
  console.error("  plan-path   Path to plan markdown file")
  console.error("")
  console.error("Flags:")
  console.error("  --quiet, -q  Hide tool calls/results, show only spinner + task boxes")
}

/**
 * Read plan file.
 */
const readPlan = (path: string) =>
  Effect.try({
    try: () => readFileSync(path, "utf-8"),
    catch: (e) => new PlanReadError(path, e)
  })

/**
 * Main program - loads tasks, sorts them, and executes each in order.
 */
const main: Effect.Effect<void, MainError> = Effect.gen(function*() {
  const args = process.argv.slice(2)

  // Parse flags and positional arguments
  const flags = args.filter((a) => a.startsWith("-"))
  const positional = args.filter((a) => !a.startsWith("-"))
  const quiet = flags.includes("--quiet") || flags.includes("-q")

  if (positional.length < 2) {
    printUsage()
    return yield* Effect.fail(new MissingArgumentsError())
  }

  const [tasksPath, planPath] = positional

  // Load plan and tasks in parallel
  const [plan, tasks] = yield* Effect.all([
    readPlan(planPath),
    loadTasks(tasksPath)
  ])

  // Filter to only pending tasks
  const pendingTasks = tasks.filter((t) => t.status === "pending")

  if (pendingTasks.length === 0) {
    console.log("No pending tasks to execute")
    return
  }

  // Sort by dependencies
  const sorted = yield* topologicalSort(pendingTasks)

  // Show execution order
  process.stdout.write(renderExecutionOrder(sorted.map((t) => t.id)))

  // Track total statistics across all tasks
  let totalToolCalls = 0
  let totalAgentRuns = 0
  const startTime = Date.now()

  // Execute each task
  for (const task of sorted) {
    // Render task header
    process.stdout.write(
      renderTaskHeader(task.id, task.subject, task.description)
    )

    // Create observer with quiet mode setting
    const { observer, stats } = createObserver({ quiet })

    const result = yield* Effect.promise(() =>
      run(taskWorkflow, {
        input: { plan, task },
        runtime: { mode: "live" },
        observer
      })
    )

    // Accumulate statistics
    totalToolCalls += stats.toolCalls
    totalAgentRuns += stats.agentRuns

    const success = result.state.result?.success ?? false
    const summary = result.state.result?.summary ?? "No summary provided"

    // Render task completion
    process.stdout.write(renderTaskComplete(task.id, success, summary))

    if (!success) {
      return yield* Effect.fail(new TaskFailedError(task.id))
    }
  }

  // Final outro with statistics
  const duration = Date.now() - startTime
  process.stdout.write(
    renderOutro({
      tasks: sorted.length,
      duration,
      toolCalls: totalToolCalls,
      agentRuns: totalAgentRuns
    })
  )
})

// Run the program with proper Effect error handling
const program = pipe(
  main,
  Effect.catchAll((error) =>
    Effect.sync(() => {
      process.stdout.write(renderError(new Error(errorToMessage(error))))
      process.exit(1)
    })
  )
)

Effect.runPromise(program)
