/**
 * Logging observer for workflow execution.
 *
 * Implements WorkflowObserver to log all events to console.
 *
 * @module
 */

import type { SerializedEvent, WorkflowObserver } from "@open-scaffold/core"

import type { TaskExecutionState } from "./workflow.js"

/**
 * Create a logging observer that writes all workflow events to console.
 *
 * @returns WorkflowObserver that logs events
 */
export const createObserver = (): WorkflowObserver<TaskExecutionState> => ({
  onStarted: (sessionId) => {
    console.log(`\n[Workflow] Started: ${sessionId}`)
  },

  onCompleted: (result) => {
    console.log("\n[Workflow] Completed")
    if (result.state.result) {
      console.log(`  Success: ${result.state.result.success}`)
      console.log(`  Summary: ${result.state.result.summary}`)
    }
  },

  onError: (error) => {
    console.error("\n[Workflow] Error:", error)
  },

  onStateChanged: (state, patches) => {
    if (patches && patches.length > 0) {
      console.log("\n[State] Changed")
      for (const patch of patches) {
        console.log(`  Patch: ${JSON.stringify(patch)}`)
      }
    }
  },

  onAgentStarted: (info) => {
    console.log(`\n[Agent] Started: ${info.agent}`)
    if (info.phase) {
      console.log(`  Phase: ${info.phase}`)
    }
  },

  onAgentCompleted: (info) => {
    console.log(`\n[Agent] Completed: ${info.agent} (${info.durationMs}ms)`)
    console.log(`  Output: ${JSON.stringify(info.output)}`)
  },

  onTextDelta: (info) => {
    // Stream text directly to stdout (no newline)
    process.stdout.write(info.delta)
  },

  onThinkingDelta: (info) => {
    // Show thinking in a distinct style
    process.stdout.write(`\x1b[90m${info.delta}\x1b[0m`)
  },

  onToolCalled: (info) => {
    console.log(`\n[Tool] ${info.toolName}`)
    const inputStr = JSON.stringify(info.input, null, 2)
    // Truncate long inputs
    if (inputStr.length > 500) {
      console.log(`  Input: ${inputStr.substring(0, 500)}...`)
    } else {
      console.log(`  Input: ${inputStr}`)
    }
  },

  onToolResult: (info) => {
    const outputStr = JSON.stringify(info.output)
    // Truncate long outputs
    if (outputStr.length > 500) {
      console.log(`  Result: ${outputStr.substring(0, 500)}...`)
    } else {
      console.log(`  Result: ${outputStr}`)
    }
    if (info.isError) {
      console.log("  [ERROR]")
    }
  },

  onEvent: (_event: SerializedEvent) => {
    // Optional: log raw events for debugging
    // console.log(`[Event] ${event.name}`)
  }
})
