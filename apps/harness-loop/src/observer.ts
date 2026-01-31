/**
 * Workflow observer with rich terminal rendering.
 *
 * Uses renderer.ts for beautiful, readable output.
 *
 * @module
 */

import type { WorkflowObserver } from "@open-scaffold/core"

import {
  renderAgentCompleted,
  renderAgentStarted,
  renderError,
  renderStateChanged,
  renderTextDelta,
  renderThinkingDelta,
  renderThinkingEnd,
  renderThinkingStart,
  renderToolCall,
  renderToolResult,
  renderWorkflowStarted
} from "./renderer.js"
import type { TaskExecutionState } from "./workflow.js"

/**
 * Create an observer with rich terminal output.
 *
 * @returns WorkflowObserver that renders events beautifully
 */
export const createObserver = (): WorkflowObserver<TaskExecutionState> => {
  // Track thinking state for start/end delimiters
  let isInThinking = false

  return {
    onStarted: (sessionId) => {
      process.stdout.write(renderWorkflowStarted(sessionId))
    },

    onCompleted: () => {
      // Task completion is handled in index.ts
    },

    onError: (error) => {
      process.stdout.write(renderError(error))
    },

    onStateChanged: (_state, patches) => {
      // Extract what changed from patches
      if (patches && patches.length > 0) {
        const firstPatch = patches[0] as { path?: Array<string> }
        const changedKey = firstPatch.path?.[0]
        // Only show state changes for result, not for initial setup
        if (changedKey === "result") {
          process.stdout.write(renderStateChanged(changedKey))
        }
      }
    },

    onAgentStarted: (info) => {
      process.stdout.write(renderAgentStarted(info.agent))
    },

    onAgentCompleted: (info) => {
      // End thinking block if we were in one
      if (isInThinking) {
        process.stdout.write(renderThinkingEnd())
        isInThinking = false
      }
      process.stdout.write(renderAgentCompleted(info.agent, info.durationMs))
    },

    onTextDelta: (info) => {
      // End thinking block if we were in one
      if (isInThinking) {
        process.stdout.write(renderThinkingEnd())
        isInThinking = false
      }
      process.stdout.write(renderTextDelta(info.delta))
    },

    onThinkingDelta: (info) => {
      // Start thinking block if not already in one
      if (!isInThinking) {
        process.stdout.write(renderThinkingStart())
        isInThinking = true
      }
      process.stdout.write(renderThinkingDelta(info.delta))
    },

    onToolCalled: (info) => {
      // End thinking block if we were in one
      if (isInThinking) {
        process.stdout.write(renderThinkingEnd())
        isInThinking = false
      }
      process.stdout.write(renderToolCall(info.toolName, info.input))
    },

    onToolResult: (info) => {
      process.stdout.write(renderToolResult(info.output, info.isError))
    }
  }
}
