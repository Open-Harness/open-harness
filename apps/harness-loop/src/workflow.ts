/**
 * Task execution workflow.
 *
 * Simple workflow that runs a task executor agent against a plan and task.
 *
 * @module
 */

import { agent, workflow } from "@open-scaffold/core"
import { AnthropicProvider } from "@open-scaffold/server"
import { z } from "zod"

import type { Task } from "./schema.js"

/**
 * State for the task execution workflow.
 */
export interface TaskExecutionState {
  /** The full plan markdown */
  plan: string
  /** The current task being executed */
  currentTask: Task | null
  /** Result from the task executor agent */
  result: {
    success: boolean
    summary: string
  } | null
}

/**
 * Input to start the task execution workflow.
 */
export interface TaskExecutionInput {
  /** The full plan markdown */
  plan: string
  /** The task to execute */
  task: Task
}

/**
 * Output schema for the task executor agent.
 */
const TaskResultSchema = z.object({
  success: z.boolean().describe("Whether the task was completed successfully"),
  summary: z.string().describe("Brief summary of what was accomplished")
})

type TaskResult = z.infer<typeof TaskResultSchema>

/**
 * Task executor agent - executes a single task based on the plan context.
 *
 * Uses Claude Opus with extended thinking and Claude Code tools preset
 * for maximum capability when executing coding tasks.
 */
const taskExecutor = agent<TaskExecutionState, TaskResult>({
  name: "task-executor",
  provider: AnthropicProvider({
    model: "claude-opus-4-5-20251101",
    extendedThinking: true,
    maxTokens: 32000
  }),
  options: {
    tools: { type: "preset", preset: "claude_code" },
    permissionMode: "bypassPermissions"
  },
  output: TaskResultSchema,
  prompt: (state) => {
    const task = state.currentTask
    if (!task) {
      return "No task provided."
    }

    return `## Plan Context
${state.plan}

## Current Task
**${task.subject}**

${task.description}

---

Execute this task completely. Use all available tools to accomplish the goal.

When you have finished executing the task, return:
- success: true if the task was completed successfully, false if it failed
- summary: A brief summary of what was accomplished or why it failed
`
  },
  update: (output, draft) => {
    draft.result = output
  }
})

/**
 * Task execution workflow - runs the task executor agent until it produces a result.
 */
export const taskWorkflow = workflow<TaskExecutionState, TaskExecutionInput>({
  name: "task-execution",
  initialState: {
    plan: "",
    currentTask: null,
    result: null
  },
  start: (input, draft) => {
    draft.plan = input.plan
    draft.currentTask = input.task
  },
  agent: taskExecutor,
  until: (state) => state.result !== null
})
