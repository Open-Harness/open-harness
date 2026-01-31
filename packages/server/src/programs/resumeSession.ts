/**
 * resumeSession - Resume a paused session from its current position.
 *
 * Flow:
 * 1. Load events from store
 * 2. Compute current state from event log (pure scan)
 * 3. Execute workflow from resumed state via executeWorkflow
 *
 * Mental model: This is "RESUME" on the VCR after PAUSE.
 *
 * @module
 */

import { Effect } from "effect"

import {
  type AgentError,
  computeStateAt,
  type ProviderError,
  type RecordingNotFound,
  type SessionId,
  type SessionNotFound,
  type StoreError,
  type WorkflowDef,
  type WorkflowError,
  type WorkflowResult
} from "@open-scaffold/core"
// executeWorkflow, ExecuteOptions, and Services are internal API (ADR-001) - import from internal entrypoint
import { type ExecuteOptions, executeWorkflow, type Services } from "@open-scaffold/core/internal"

import { loadSession } from "./loadSession.js"

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export interface ResumeConfig<S, Input = string, Phases extends string = never> {
  readonly sessionId: SessionId
  readonly workflow: WorkflowDef<S, Input, Phases>
  readonly input: Input
  readonly initialState: S // Fallback if no state events exist
  readonly resumePhase?: string // Phase to resume from (for phased workflows)
}

// ─────────────────────────────────────────────────────────────────
// Program
// ─────────────────────────────────────────────────────────────────

/**
 * Resume a paused session.
 *
 * Loads existing events, computes current state, then delegates to
 * `executeWorkflow` with the `resumeState` option so the runtime
 * skips `start()` and begins from the checkpoint.
 */
export const resumeSession = <S, Input = string, Phases extends string = never>(
  config: ResumeConfig<S, Input, Phases>
): Effect.Effect<
  WorkflowResult<S>,
  | StoreError
  | SessionNotFound
  | WorkflowError
  | AgentError
  | ProviderError
  | RecordingNotFound,
  Services.ProviderRecorder | Services.ProviderModeContext | Services.EventStore | Services.EventBus
> =>
  Effect.gen(function*() {
    const { initialState, input, resumePhase, sessionId, workflow } = config

    // Load session events
    const { events } = yield* loadSession(sessionId)

    // Compute current state by scanning for last state event
    const currentState = computeStateAt<S>(events, events.length) ?? initialState

    yield* Effect.log("Session resuming", {
      sessionId,
      eventCount: events.length
    })

    // Execute workflow from resumed state
    const options: ExecuteOptions<Input> = {
      input,
      sessionId,
      resumeState: currentState,
      ...(resumePhase !== undefined ? { resumePhase } : {})
    }

    return yield* executeWorkflow(workflow, options)
  }).pipe(
    Effect.withSpan("resumeSession", {
      attributes: { sessionId: config.sessionId }
    })
  )
