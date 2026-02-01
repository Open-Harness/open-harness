/**
 * Workflow observer with rich terminal rendering.
 *
 * Supports quiet mode (spinner only) and verbose mode (full tool output).
 * Uses tool-specific renderers for beautiful, semantic output.
 *
 * @module
 */

import type { WorkflowObserver } from "@open-harness/core"

import {
  hasToolRenderer,
  renderAgentCompleted,
  renderAgentStarted,
  renderAgentTextGap,
  renderError,
  renderStateChanged,
  renderTextDelta,
  renderThinkingDelta,
  renderThinkingEnd,
  renderThinkingStart,
  renderToolCall,
  renderToolResult,
  renderToolSpecific,
  renderWorkflowStarted
} from "./renderer.js"
import { Spinner } from "./spinner.js"
import type { TaskExecutionState } from "./workflow.js"

/**
 * Observer configuration options.
 */
export interface ObserverOptions {
  /** Hide tool calls and results, show only spinner */
  quiet?: boolean
}

/**
 * Statistics tracked during workflow execution.
 */
export interface ObserverStats {
  /** Total tool calls made */
  toolCalls: number
  /** Total agent runs */
  agentRuns: number
  /** Workflow start time */
  startTime: number
}

/**
 * Result of creating an observer.
 */
export interface ObserverResult {
  /** The workflow observer */
  observer: WorkflowObserver<TaskExecutionState>
  /** Statistics collector */
  stats: ObserverStats
  /** Spinner instance for quiet mode */
  spinner: Spinner
}

/**
 * Create an observer with rich terminal output.
 *
 * @param options - Observer configuration
 * @returns WorkflowObserver, stats collector, and spinner
 */
export const createObserver = (options: ObserverOptions = {}): ObserverResult => {
  const { quiet = false } = options

  // Track thinking state for start/end delimiters
  let isInThinking = false

  // Track if we just finished a tool call (for gap before agent text)
  let justFinishedTool = false

  // Track pending tool call for combined rendering
  let pendingToolCall: { name: string; input: unknown } | null = null

  // Statistics
  const stats: ObserverStats = {
    toolCalls: 0,
    agentRuns: 0,
    startTime: Date.now()
  }

  // Spinner for quiet mode
  const spinner = new Spinner()

  const observer: WorkflowObserver<TaskExecutionState> = {
    onStarted: (sessionId) => {
      process.stdout.write(renderWorkflowStarted(sessionId))
    },

    onCompleted: () => {
      // Task completion is handled in index.ts
      spinner.stop()
    },

    onError: (error) => {
      spinner.stop()
      process.stdout.write(renderError(error))
    },

    onStateChanged: (_state, patches) => {
      // Extract what changed from patches
      if (patches && patches.length > 0) {
        const firstPatch = patches[0] as { path?: Array<string> }
        const changedKey = firstPatch.path?.[0]
        // Only show state changes for result, not for initial setup
        if (changedKey === "result" && !quiet) {
          process.stdout.write(renderStateChanged(changedKey))
        }
      }
    },

    onAgentStarted: (info) => {
      stats.agentRuns++
      process.stdout.write(renderAgentStarted(info.agent))

      // Always start spinner - shows progress in both modes
      spinner.start("Running...")
    },

    onAgentCompleted: (info) => {
      spinner.stop()

      // End thinking block if we were in one
      if (isInThinking) {
        process.stdout.write(renderThinkingEnd())
        isInThinking = false
      }
      process.stdout.write(renderAgentCompleted(info.agent, info.durationMs))
    },

    onTextDelta: (info) => {
      // Update spinner with context (always visible)
      spinner.update("Generating text...")

      if (quiet) return

      // Stop spinner before writing verbose output
      spinner.stop()

      // End thinking block if we were in one
      if (isInThinking) {
        process.stdout.write(renderThinkingEnd())
        isInThinking = false
      }

      // Add gap after tool calls for visual separation
      if (justFinishedTool) {
        process.stdout.write(renderAgentTextGap())
        justFinishedTool = false
      }

      process.stdout.write(renderTextDelta(info.delta))
    },

    onThinkingDelta: (info) => {
      // Update spinner with context (always visible)
      spinner.update("Thinking...")

      if (quiet) return

      // Stop spinner before writing verbose output
      spinner.stop()

      // Start thinking block if not already in one
      if (!isInThinking) {
        process.stdout.write(renderThinkingStart())
        isInThinking = true
      }
      process.stdout.write(renderThinkingDelta(info.delta))
    },

    onToolCalled: (info) => {
      stats.toolCalls++

      // Update spinner with tool name (always visible)
      spinner.update(`Running ${info.toolName}...`)

      // Store pending call for when we get the result
      pendingToolCall = { name: info.toolName, input: info.input }

      if (quiet) return

      // Stop spinner before writing verbose output
      spinner.stop()

      // End thinking block if we were in one
      if (isInThinking) {
        process.stdout.write(renderThinkingEnd())
        isInThinking = false
      }

      // For tools without specific renderers, show call immediately
      if (!hasToolRenderer(info.toolName)) {
        process.stdout.write(renderToolCall(info.toolName, info.input))
        pendingToolCall = null
      }
    },

    onToolResult: (info) => {
      // Update spinner (always visible)
      spinner.update("Processing result...")

      if (quiet) {
        // Reset spinner to generic message
        spinner.update("Running...")
        pendingToolCall = null
        return
      }

      // Stop spinner before writing verbose output
      spinner.stop()

      justFinishedTool = true

      // Use tool-specific renderer if available
      if (pendingToolCall && hasToolRenderer(pendingToolCall.name)) {
        const output = renderToolSpecific(
          pendingToolCall.name,
          pendingToolCall.input,
          info.output,
          info.isError
        )
        // Always clear pending before returning
        pendingToolCall = null
        // Tool-specific renderer always returns non-empty for registered tools
        process.stdout.write(output)
        return
      }

      // Fallback to generic result rendering - only if no specific renderer was used
      // This handles tools that don't have specific renderers (already rendered call in onToolCalled)
      if (pendingToolCall === null) {
        // Tool call was already rendered in onToolCalled, just show result
        process.stdout.write(renderToolResult(info.output, info.isError))
      }
      pendingToolCall = null
    }
  }

  return { observer, stats, spinner }
}
