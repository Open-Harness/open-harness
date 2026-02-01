/**
 * Ralph - Task Executor CLI
 *
 * Loads Claude Code task lists and executes them sequentially
 * using the Open Harness workflow engine.
 *
 * @module
 */

import { Args, Command, Options } from "@effect/cli"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { run } from "@open-harness/core"
import { Effect, pipe } from "effect"
import { readFileSync } from "node:fs"

import { type CycleDetectedError, topologicalSort } from "./graph.js"
import { type LoaderError, loadTasks } from "./loader.js"
import { createObserver } from "./observer.js"
import { renderError, renderExecutionOrder, renderOutro, renderTaskComplete, renderTaskHeader } from "./renderer.js"
import { taskWorkflow } from "./workflow.js"

// ─────────────────────────────────────────────────────────────────
// Error Types
// ─────────────────────────────────────────────────────────────────

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
 * Error when a task fails execution.
 */
class TaskFailedError {
  readonly _tag = "TaskFailedError"
  constructor(readonly taskId: string) {}
}

/**
 * Union of all main program errors.
 */
type MainError = PlanReadError | LoaderError | CycleDetectedError | TaskFailedError

/**
 * Convert error to user-friendly message.
 */
const errorToMessage = (error: MainError): string => {
  switch (error._tag) {
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

// ─────────────────────────────────────────────────────────────────
// CLI Definition
// ─────────────────────────────────────────────────────────────────

const tasksPath = Args.path({ name: "tasks-path" }).pipe(
  Args.withDescription("Directory containing task JSON files")
)

const planPath = Args.path({ name: "plan-path" }).pipe(
  Args.withDescription("Path to plan markdown file")
)

const quiet = Options.boolean("quiet").pipe(
  Options.withAlias("q"),
  Options.withDescription("Hide tool calls/results, show only spinner + task boxes"),
  Options.withDefault(false)
)

// ─────────────────────────────────────────────────────────────────
// Main Program
// ─────────────────────────────────────────────────────────────────

/**
 * Read plan file.
 */
const readPlan = (path: string) =>
  Effect.try({
    try: () => readFileSync(path, "utf-8"),
    catch: (e) => new PlanReadError(path, e)
  })

/**
 * Execute all tasks in dependency order.
 */
const executeTasks = (
  tasksPathValue: string,
  planPathValue: string,
  quietMode: boolean
): Effect.Effect<void, MainError> =>
  Effect.gen(function*() {
    // Load plan and tasks in parallel
    const [plan, tasks] = yield* Effect.all([
      readPlan(planPathValue),
      loadTasks(tasksPathValue)
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
      const { observer, stats } = createObserver({ quiet: quietMode })

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

// ─────────────────────────────────────────────────────────────────
// Command Definition
// ─────────────────────────────────────────────────────────────────

const command = Command.make(
  "ralph",
  { tasksPath, planPath, quiet },
  ({ tasksPath: tasksPathValue, planPath: planPathValue, quiet: quietMode }) =>
    pipe(
      executeTasks(tasksPathValue, planPathValue, quietMode),
      Effect.catchAll((error) =>
        Effect.sync(() => {
          process.stdout.write(renderError(new Error(errorToMessage(error))))
          process.exit(1)
        })
      )
    )
).pipe(
  Command.withDescription(
    "Execute Claude Code task lists using the Open Harness workflow engine"
  )
)

// ─────────────────────────────────────────────────────────────────
// CLI Entry Point
// ─────────────────────────────────────────────────────────────────

const cli = Command.run(command, {
  name: "ralph",
  version: "0.0.0"
})

pipe(
  cli(process.argv),
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain
)
