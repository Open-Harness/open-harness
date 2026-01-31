/**
 * Provider infrastructure for the state-first DX.
 *
 * This module bridges the new AgentDef (with model strings) to the
 * existing AgentProvider infrastructure.
 *
 * Key responsibilities:
 * - Resolve model strings to AgentProvider instances
 * - Execute agents with recording/playback support
 * - Return parsed output (not events - new DX handles state updates separately)
 *
 * @module
 */

import { Effect, Stream } from "effect"
import type { ZodType } from "zod"

import { AgentError, RecordingNotFound } from "../Domain/Errors.js"
import type { ProviderError, StoreError } from "../Domain/Errors.js"
import { hashProviderRequest } from "../Domain/Hash.js"
import type { AgentRunResult, AgentStreamEvent, ProviderRunOptions } from "../Domain/Provider.js"
import { ProviderModeContext } from "../Services/ProviderMode.js"
import { ProviderRecorder } from "../Services/ProviderRecorder.js"

import type { SerializedEvent } from "../Domain/Events.js"
import { tagToEventName } from "../Domain/Events.js"
import type { AgentDef } from "./agent.js"
import { type EventId, makeEvent } from "./types.js"

// ─────────────────────────────────────────────────────────────────
// Agent Execution
// ─────────────────────────────────────────────────────────────────

/**
 * Context for agent execution.
 */
export interface AgentExecutionContext {
  /** Session ID for this execution */
  readonly sessionId: string
  /** Last event ID for causality tracking */
  readonly causedBy?: EventId | undefined
  /** Phase name (for phased workflows) */
  readonly phase?: string | undefined
  /** Abort signal for cancelling execution */
  readonly abortSignal?: AbortSignal | undefined
}

/**
 * Result from executing an AgentDef.
 */
export interface AgentExecutionResult<O> {
  /** The parsed output from the agent */
  readonly output: O
  /** Streaming events emitted during execution */
  readonly events: ReadonlyArray<SerializedEvent>
  /** Duration in milliseconds */
  readonly durationMs: number
  /** Text output (if any) */
  readonly text?: string
  /** Thinking output (if any) */
  readonly thinking?: string
}

/**
 * Helper to check if a stream event is a Result.
 */
const isResultEvent = (
  event: AgentStreamEvent
): event is Extract<AgentStreamEvent, { readonly _tag: "Result" }> => event._tag === "Result"

/**
 * Convert a Result stream event to AgentRunResult.
 */
const toRunResult = (
  result: Extract<AgentStreamEvent, { readonly _tag: "Result" }>
): AgentRunResult => ({
  stopReason: result.stopReason,
  ...(result.text ? { text: result.text } : {}),
  ...(result.thinking ? { thinking: result.thinking } : {}),
  ...(result.usage ? { usage: result.usage } : {}),
  ...(result.sessionId ? { sessionId: result.sessionId } : {}),
  output: result.output
})

/**
 * Map a stream event to an internal event.
 *
 * Exported for testing purposes via @open-scaffold/core/internal.
 */
export const mapStreamEventToInternal = (
  agent: string,
  streamEvent: AgentStreamEvent,
  causedBy?: EventId
): Effect.Effect<SerializedEvent | null> => {
  switch (streamEvent._tag) {
    case "TextDelta":
      return makeEvent(
        tagToEventName.TextDelta,
        { agent, delta: streamEvent.delta },
        causedBy
      )

    case "ThinkingDelta":
      return makeEvent(
        tagToEventName.ThinkingDelta,
        { agent, delta: streamEvent.delta },
        causedBy
      )

    case "ToolCall":
      return makeEvent(
        tagToEventName.ToolCalled,
        {
          agent,
          toolId: streamEvent.toolId,
          toolName: streamEvent.toolName,
          input: streamEvent.input
        },
        causedBy
      )

    case "ToolResult":
      return makeEvent(
        tagToEventName.ToolResult,
        {
          agent,
          toolId: streamEvent.toolId,
          output: streamEvent.output,
          isError: streamEvent.isError
        },
        causedBy
      )

    case "Result":
      // Result events are handled separately
      return Effect.succeed(null)

    default:
      return Effect.succeed(null)
  }
}

/**
 * Execute an AgentDef with recording/playback support.
 *
 * This is the core function that bridges the new AgentDef format to
 * the existing provider infrastructure.
 *
 * Unlike the old execution pipeline which returned events, this returns
 * the parsed output directly. State updates are handled by the caller.
 *
 * @template S - State type
 * @template O - Output type
 * @template Ctx - Context type (void if no forEach)
 */
export const runAgentDef = <S, O, Ctx>(
  agent: AgentDef<S, O, Ctx>,
  state: S,
  agentContext: Ctx | undefined,
  executionContext: AgentExecutionContext
): Effect.Effect<
  AgentExecutionResult<O>,
  AgentError | ProviderError | StoreError | RecordingNotFound,
  ProviderRecorder | ProviderModeContext
> =>
  Effect.gen(function*() {
    const startTime = Date.now()
    const events: Array<SerializedEvent> = []
    let lastEventId = executionContext.causedBy

    // Helper to emit and track events
    const emitEvent = (name: string, payload: Record<string, unknown>): Effect.Effect<SerializedEvent> =>
      Effect.gen(function*() {
        const event = yield* makeEvent(name, payload, lastEventId)
        events.push(event)
        lastEventId = event.id
        return event
      })

    // Get services
    const recorder = yield* ProviderRecorder
    const { mode } = yield* ProviderModeContext

    // Emit agent:started
    yield* emitEvent(tagToEventName.AgentStarted, {
      agent: agent.name,
      phase: executionContext.phase,
      context: agentContext
    })

    // Generate prompt
    const prompt = agentContext !== undefined
      ? (agent.prompt as (s: S, ctx: Ctx) => string)(state, agentContext)
      : (agent.prompt as (s: S) => string)(state)

    // Build provider options (provider.model + provider.config + agent.options)
    const providerOptions: ProviderRunOptions = {
      prompt,
      outputSchema: agent.output as ZodType<unknown>,
      providerOptions: {
        model: agent.provider.model,
        ...agent.provider.config,
        ...agent.options
      },
      ...(executionContext.abortSignal ? { abortSignal: executionContext.abortSignal } : {})
    }

    // Compute hash for recording/playback
    const hash = hashProviderRequest(providerOptions)

    let streamResult: AgentRunResult | undefined

    // ─────────────────────────────────────────────────────────────────
    // PLAYBACK MODE: Load recorded events from ProviderRecorder
    // ─────────────────────────────────────────────────────────────────
    if (mode === "playback") {
      const entry = yield* recorder.load(hash)
      if (!entry) {
        return yield* Effect.fail(
          new RecordingNotFound({ hash, prompt: prompt.slice(0, 100) })
        )
      }

      // Replay recorded stream events
      for (const streamEvent of entry.streamData) {
        if (!isResultEvent(streamEvent)) {
          const mapped = yield* mapStreamEventToInternal(agent.name, streamEvent, lastEventId)
          if (mapped) {
            events.push(mapped)
            lastEventId = mapped.id
          }
        }
      }

      // Use the recorded result
      streamResult = entry.result
    } else {
      // ─────────────────────────────────────────────────────────────────
      // LIVE MODE: Call provider, record events incrementally
      // ─────────────────────────────────────────────────────────────────
      const provider = agent.provider

      // Start incremental recording (crash-safe)
      const recordingId = yield* recorder.startRecording(hash, {
        prompt,
        provider: provider.name
      }).pipe(
        Effect.catchAll((err) => {
          // Log but don't fail - recording is optional
          return Effect.logWarning("Failed to start recording", { hash, error: String(err) }).pipe(
            Effect.as(null as string | null)
          )
        })
      )

      // Stream from provider with incremental recording
      yield* provider.stream(providerOptions).pipe(
        Stream.mapEffect((streamEvent) =>
          Effect.gen(function*() {
            if (isResultEvent(streamEvent)) {
              streamResult = toRunResult(streamEvent)
            }

            // Append event incrementally (crash-safe)
            if (recordingId) {
              yield* recorder.appendEvent(recordingId, streamEvent).pipe(
                Effect.catchAll((err) =>
                  Effect.logWarning("Failed to append event", { recordingId, error: String(err) })
                )
              )
            }

            // Map and track non-result events
            if (!isResultEvent(streamEvent)) {
              const mapped = yield* mapStreamEventToInternal(agent.name, streamEvent, lastEventId)
              if (mapped) {
                events.push(mapped)
                lastEventId = mapped.id
              }
            }
          })
        ),
        Stream.runDrain
      )

      // Finalize recording after stream completes
      if (recordingId && streamResult) {
        yield* recorder.finalizeRecording(recordingId, streamResult).pipe(
          Effect.catchAll((saveError) =>
            Effect.logWarning("Failed to finalize recording", {
              hash,
              agent: agent.name,
              error: String(saveError)
            })
          )
        )
      }
    }

    // Validate we got a result
    if (!streamResult) {
      return yield* Effect.fail(
        new AgentError({
          agent: agent.name,
          phase: "execution",
          cause: "Provider stream ended without result"
        })
      )
    }

    // Parse output through schema
    const parsed = agent.output.safeParse(streamResult.output)
    if (!parsed.success) {
      return yield* Effect.fail(
        new AgentError({
          agent: agent.name,
          phase: "output",
          cause: parsed.error
        })
      )
    }

    const durationMs = Date.now() - startTime

    // Emit agent:completed
    yield* emitEvent(tagToEventName.AgentCompleted, {
      agent: agent.name,
      output: parsed.data,
      durationMs
    })

    // Build result with proper optional handling
    const result: AgentExecutionResult<O> = {
      output: parsed.data,
      events,
      durationMs
    }

    if (streamResult.text !== undefined) {
      return { ...result, text: streamResult.text }
    }

    if (streamResult.thinking !== undefined) {
      return { ...result, thinking: streamResult.thinking }
    }

    return result
  }).pipe(
    Effect.withSpan("runAgentDef", {
      attributes: { agent: agent.name, model: agent.provider.model }
    })
  )

// ─────────────────────────────────────────────────────────────────
// In-Memory Provider Registry Implementation
