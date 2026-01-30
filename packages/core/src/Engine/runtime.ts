/**
 * Effect-based runtime for state-first workflow execution.
 *
 * This module bridges the new state-first DX (AgentDef, PhaseDef, WorkflowDef)
 * to the existing execution infrastructure (ProviderRecorder, EventStore, etc.).
 *
 * Key responsibilities:
 * - Execute workflows with Effect for structured concurrency
 * - Use Immer for state updates (wrapped in Effect.sync)
 * - Emit Events via EventHub (ADR-004) for recording/UI/debugging
 * - Handle parallel agent execution via Effect.forEach
 * - Support HITL via Deferred for pause/resume
 *
 * Per ADR-004: All events flow through EventHub PubSub. Subscribers (EventStore,
 * EventBus, Observer) run as separate fibers with isolated failure handling.
 *
 * @module
 */

import { Deferred, Effect, Match, Queue, Ref, Stream, SubscriptionRef } from "effect"
import type { Draft, Patch } from "immer"
import { enablePatches, produceWithPatches } from "immer"

import type { AgentError, ProviderError, RecordingNotFound, StoreError } from "../Domain/Errors.js"
import type { WorkflowEvent } from "../Domain/Events.js"
import * as Events from "../Domain/Events.js"
import type { SessionId } from "../Domain/Ids.js"
import { EventBus } from "../Services/EventBus.js"
import { EventHub, makeEventHub } from "../Services/EventHub.js"
import { EventStore } from "../Services/EventStore.js"
import type { ProviderModeContext } from "../Services/ProviderMode.js"
import type { ProviderRecorder } from "../Services/ProviderRecorder.js"

import type { HumanInputHandler } from "../helpers/humanInput.js"
import type { AgentDef } from "./agent.js"
import { dispatchToObserver } from "./dispatch.js"
import type { HumanConfig, PhaseDef } from "./phase.js"
import { runAgentDef } from "./provider.js"
// Note: subscribers.ts exports are not used here anymore (see comment in executeWorkflow)
// import { makeBusSubscriber, makeObserverSubscriber, makeStoreSubscriber } from "./subscribers.js"
import {
  type AnyEvent,
  type EventId,
  EVENTS,
  type WorkflowError,
  type WorkflowObserver,
  WorkflowPhaseError,
  type WorkflowResult
} from "./types.js"
import {
  isPhaseWorkflow,
  isSimpleWorkflow,
  type PhaseWorkflowDef,
  type SimpleWorkflowDef,
  type WorkflowDef
} from "./workflow.js"

// Enable Immer patches plugin for incremental replay support
enablePatches()

// Note: dispatchToObserver has been moved to dispatch.ts per ADR-004.
// Observer notifications now happen via the makeObserverSubscriber fiber.

// ─────────────────────────────────────────────────────────────────
// Runtime Context (internal state during execution)
// ─────────────────────────────────────────────────────────────────

/**
 * Internal runtime context for workflow execution.
 * Tracks mutable state, events, and HITL interactions.
 *
 * Per ADR-004: Events are published to EventHub and subscribers handle
 * persistence (EventStore), broadcasting (EventBus), and observer dispatch.
 *
 * Per ADR-006: State is derived from events via StateProjection. The stateRef
 * is a SubscriptionRef that receives updates from the projection fiber when
 * StateIntent events are published. Agents read state from this ref but never
 * mutate it directly - state changes flow through events.
 */
interface RuntimeContext<S> {
  /** Current workflow state (SubscriptionRef backed by StateProjection per ADR-006) */
  readonly stateRef: SubscriptionRef.SubscriptionRef<S>
  /** Accumulated events during execution (for WorkflowResult) */
  readonly eventsRef: Ref.Ref<Array<WorkflowEvent>>
  /** Session ID for this execution */
  readonly sessionId: string
  /** Current phase (for phased workflows) */
  readonly currentPhaseRef: Ref.Ref<string | undefined>
  /** Queue for HITL responses */
  readonly inputQueue: Queue.Queue<string>
  /** Deferred for pausing execution */
  readonly pauseDeferred: Deferred.Deferred<void>
  /** Flag indicating if workflow is paused */
  readonly isPausedRef: Ref.Ref<boolean>
  /** Last event ID for causality tracking (kept for legacy event format) */
  readonly lastEventIdRef: Ref.Ref<EventId | undefined>
  /** Optional real-time event callback for streaming (legacy, also handled by observer subscriber) */
  readonly onEvent?: (event: AnyEvent) => void
  /** Optional observer for structured lifecycle callbacks (handled by makeObserverSubscriber) */
  readonly observer?: WorkflowObserver<unknown>
  /** Optional human input handler for HITL (ADR-002) */
  readonly humanInput?: HumanInputHandler
}

// ─────────────────────────────────────────────────────────────────
// Event Emission Helpers (ADR-004: EventHub-based)
// ─────────────────────────────────────────────────────────────────

/**
 * Emit a WorkflowEvent via EventHub and track it in the runtime context.
 *
 * Per ADR-004: Events are published to EventHub for SSE subscribers.
 *
 * For synchronous reliability, we also:
 * - Persist to EventStore directly (not via fiber)
 * - Broadcast to EventBus directly (not via fiber)
 * - Dispatch to observer synchronously
 *
 * The fiber-based subscribers still run for additional consumers, but the
 * critical path (persistence, broadcast, observer) is synchronous.
 */
const emitEvent = <S>(
  ctx: RuntimeContext<S>,
  event: WorkflowEvent
): Effect.Effect<void, StoreError, EventHub | EventStore | EventBus> =>
  Effect.gen(function*() {
    const hub = yield* EventHub
    const store = yield* EventStore
    const bus = yield* EventBus

    // Track event in memory for WorkflowResult
    yield* Ref.update(ctx.eventsRef, (events) => [...events, event])

    // Publish to EventHub - fiber subscribers can also process events
    yield* hub.publish(event)

    // Synchronous persistence to EventStore (critical for replay/recovery)
    const serializedEvent = workflowEventToLegacy(event)
    yield* store.append(ctx.sessionId as SessionId, serializedEvent)

    // Synchronous broadcast to EventBus (for SSE clients)
    yield* bus.publish(ctx.sessionId as SessionId, serializedEvent)

    // Synchronous observer dispatch (required for test/user expectations)
    if (ctx.observer) {
      yield* Effect.sync(() => dispatchToObserver(ctx.observer!, event))
    }

    // Legacy onEvent callback (for execute.ts async iterator compatibility)
    if (ctx.onEvent) {
      ctx.onEvent(serializedEvent)
    }
  })

/**
 * Convert a WorkflowEvent (Data.TaggedClass) to legacy AnyEvent format.
 * Used for backward compatibility with onEvent callback and WorkflowResult.events.
 */
const workflowEventToLegacy = (event: WorkflowEvent): AnyEvent => {
  const { _tag, timestamp, ...payload } = event
  const nameMap: Record<WorkflowEvent["_tag"], string> = {
    WorkflowStarted: EVENTS.WORKFLOW_STARTED,
    WorkflowCompleted: EVENTS.WORKFLOW_COMPLETED,
    PhaseEntered: EVENTS.PHASE_ENTERED,
    PhaseExited: EVENTS.PHASE_EXITED,
    AgentStarted: EVENTS.AGENT_STARTED,
    AgentCompleted: EVENTS.AGENT_COMPLETED,
    StateIntent: EVENTS.STATE_UPDATED,
    StateCheckpoint: EVENTS.STATE_UPDATED,
    SessionForked: EVENTS.WORKFLOW_STARTED, // Maps to workflow event
    TextDelta: EVENTS.TEXT_DELTA,
    ThinkingDelta: EVENTS.THINKING_DELTA,
    ToolCalled: EVENTS.TOOL_CALLED,
    ToolResult: EVENTS.TOOL_RESULT,
    InputRequested: EVENTS.INPUT_REQUESTED,
    InputReceived: EVENTS.INPUT_RESPONSE
  }

  // Format payload for backward compatibility with legacy field names
  let finalPayload: unknown = payload
  if (_tag === "StateIntent") {
    const intentPayload = payload as { intentId: string; state: unknown; patches: unknown; inversePatches: unknown }
    finalPayload = {
      state: intentPayload.state,
      patches: intentPayload.patches,
      inversePatches: intentPayload.inversePatches
    }
  } else if (_tag === "InputRequested") {
    // Map new field names to legacy names
    const reqPayload = payload as { id: string; prompt: string; type: string; options?: unknown }
    finalPayload = {
      promptText: reqPayload.prompt,
      inputType: reqPayload.type,
      options: reqPayload.options
    }
  } else if (_tag === "InputReceived") {
    // Map new field names to legacy names
    const recPayload = payload as { id: string; value: string; approved?: boolean }
    finalPayload = {
      response: recPayload.value
    }
  }

  return {
    id: crypto.randomUUID() as EventId,
    name: nameMap[_tag],
    payload: finalPayload,
    timestamp
  }
}

// ─────────────────────────────────────────────────────────────────
// Checkpoint Helpers (ADR-006)
// ─────────────────────────────────────────────────────────────────

/**
 * Get the current event position from the runtime context.
 * Position is the number of events emitted so far, which corresponds
 * to the index where the next event would be inserted.
 */
const getCurrentEventPosition = <S>(
  ctx: RuntimeContext<S>
): Effect.Effect<number> =>
  Effect.gen(function*() {
    const events = yield* Ref.get(ctx.eventsRef)
    return events.length
  })

/**
 * Emit a StateCheckpoint event for replay optimization.
 * Per ADR-006: Checkpoints are emitted on phase change and pause.
 */
const emitStateCheckpoint = <S>(
  ctx: RuntimeContext<S>,
  phase: string
): Effect.Effect<void, StoreError, EventHub | EventStore | EventBus> =>
  Effect.gen(function*() {
    const currentState = yield* SubscriptionRef.get(ctx.stateRef)
    const position = yield* getCurrentEventPosition(ctx)

    yield* emitEvent(
      ctx,
      new Events.StateCheckpoint({
        state: currentState,
        position,
        phase,
        timestamp: new Date()
      })
    )
  })

// ─────────────────────────────────────────────────────────────────
// State Update with Immer
// ─────────────────────────────────────────────────────────────────

/**
 * Result from updateState including patches for incremental replay.
 */
interface StateUpdateResult<S> {
  readonly state: S
  readonly patches: ReadonlyArray<Patch>
  readonly inversePatches: ReadonlyArray<Patch>
}

/**
 * Update state using Immer and emit state events.
 *
 * Per ADR-006 (Event Sourcing): State mutations emit StateIntent events.
 * The StateProjection fiber subscribes to EventHub and updates the stateRef
 * when it receives StateIntent events. This function does NOT directly mutate
 * the stateRef - state changes flow through events.
 *
 * For backward compatibility with tests and observer.onStateChanged:
 * - Observer dispatch calls onStateChanged via handleStateIntent
 * - Legacy serialization includes full state in payload
 *
 * Uses produceWithPatches to capture:
 * - patches: What changed (for incremental replay)
 * - inversePatches: How to undo (for time-travel debugging)
 *
 * Note: We return newState directly (computed locally) rather than waiting
 * for the projection fiber, since we know the projection will set the same value.
 * This avoids synchronization complexity while maintaining event-sourcing semantics.
 */
const updateState = <S>(
  ctx: RuntimeContext<S>,
  updater: (draft: Draft<S>) => void
): Effect.Effect<StateUpdateResult<S>, StoreError, EventHub | EventStore | EventBus> =>
  Effect.gen(function*() {
    // Read current state from the SubscriptionRef (backed by StateProjection)
    const currentState = yield* SubscriptionRef.get(ctx.stateRef)

    // Use Immer's produceWithPatches to capture patches for incremental replay
    const [newState, patches, inversePatches] = yield* Effect.sync(() => produceWithPatches(currentState, updater))

    // Per ADR-006: Emit StateIntent event. The event is the source of truth for state changes.
    // State is included for backward compatibility with observer.onStateChanged.
    yield* emitEvent(
      ctx,
      new Events.StateIntent({
        intentId: crypto.randomUUID(),
        state: newState,
        patches,
        inversePatches,
        timestamp: new Date()
      })
    )

    // Update the SubscriptionRef directly to ensure state is immediately available.
    // The StateProjection fiber will also update the ref when it processes the event,
    // but we can't rely on fiber scheduling for synchronous state reads within the
    // same workflow execution. This dual-write approach maintains event-sourcing
    // semantics (all state changes have corresponding events) while ensuring
    // correctness for synchronous reads.
    yield* SubscriptionRef.set(ctx.stateRef, newState)

    // Return the computed state.
    return { state: newState, patches, inversePatches }
  })

// ─────────────────────────────────────────────────────────────────
// Agent Execution
// ─────────────────────────────────────────────────────────────────

/**
 * Execute a single agent and update state.
 *
 * This bridges to runAgentDef which handles:
 * - Using the agent's provider directly (per ADR-010)
 * - Recording/playback via ProviderRecorder
 * - Output parsing via Zod schema
 *
 * Per ADR-004: Agent events from runAgentDef (legacy format) are converted
 * to WorkflowEvent (Data.TaggedClass) and published via EventHub. Subscribers
 * handle persistence, broadcast, and observer dispatch.
 *
 * After getting the output, this function calls agent.update
 * with an Immer draft to update state.
 *
 * @template S - State type
 * @template O - Output type
 * @template Ctx - Context type (void if no forEach)
 */
const executeAgent = <S, O, Ctx>(
  runtimeCtx: RuntimeContext<S>,
  agent: AgentDef<S, O, Ctx>,
  agentContext?: Ctx,
  phase?: string
): Effect.Effect<
  O,
  WorkflowError | AgentError | ProviderError | StoreError | RecordingNotFound,
  ProviderRecorder | ProviderModeContext | EventHub | EventStore | EventBus
> =>
  Effect.gen(function*() {
    // Per ADR-006: Read state from SubscriptionRef (backed by StateProjection)
    const state = yield* SubscriptionRef.get(runtimeCtx.stateRef)
    const causedBy = yield* Ref.get(runtimeCtx.lastEventIdRef)

    // Execute agent via provider infrastructure
    // Note: runAgentDef returns legacy AnyEvent format, we convert and publish via EventHub
    const result = yield* runAgentDef(agent, state, agentContext, {
      sessionId: runtimeCtx.sessionId,
      causedBy,
      phase
    })

    // Convert legacy agent events to WorkflowEvent and publish via EventHub
    // Per ADR-004: Subscribers handle persistence (EventStore), broadcast (EventBus),
    // and observer dispatch, so we don't need to do it here
    for (const legacyEvent of result.events) {
      const workflowEvent = legacyEventToWorkflowEvent(legacyEvent, agent.name)
      if (workflowEvent) {
        yield* emitEvent(runtimeCtx, workflowEvent)
      }
    }

    // Update last event ID from agent's events (for causality tracking in legacy format)
    if (result.events.length > 0) {
      const lastAgentEvent = result.events[result.events.length - 1]
      yield* Ref.set(runtimeCtx.lastEventIdRef, lastAgentEvent.id)
    }

    // Update state with Immer using agent's update function
    yield* updateState(runtimeCtx, (draft) => {
      if (agentContext !== undefined) {
        ;(agent.update as (o: O, d: Draft<S>, ctx: Ctx) => void)(result.output, draft, agentContext)
      } else {
        ;(agent.update as (o: O, d: Draft<S>) => void)(result.output, draft)
      }
    })

    return result.output
  })

/**
 * Convert a legacy AnyEvent to a WorkflowEvent (Data.TaggedClass).
 * Returns undefined for events that don't have a direct mapping.
 */
const legacyEventToWorkflowEvent = (event: AnyEvent, agentName: string): WorkflowEvent | undefined => {
  const timestamp = event.timestamp
  const p = event.payload as Record<string, unknown>

  switch (event.name) {
    case EVENTS.AGENT_STARTED: {
      const agentStartedProps: { agent: string; timestamp: Date; phase?: string; context?: unknown } = {
        agent: agentName,
        timestamp
      }
      if (p.phase !== undefined) agentStartedProps.phase = p.phase as string
      if (p.context !== undefined) agentStartedProps.context = p.context
      return new Events.AgentStarted(agentStartedProps)
    }
    case EVENTS.AGENT_COMPLETED:
      return new Events.AgentCompleted({
        agent: agentName,
        output: p.output,
        durationMs: p.durationMs as number,
        timestamp
      })
    case EVENTS.TEXT_DELTA:
      return new Events.TextDelta({
        agent: agentName,
        delta: p.delta as string,
        timestamp
      })
    case EVENTS.THINKING_DELTA:
      return new Events.ThinkingDelta({
        agent: agentName,
        delta: p.delta as string,
        timestamp
      })
    case EVENTS.TOOL_CALLED:
      return new Events.ToolCalled({
        agent: agentName,
        toolId: p.toolId as string,
        toolName: p.toolName as string,
        input: p.input,
        timestamp
      })
    case EVENTS.TOOL_RESULT:
      return new Events.ToolResult({
        agent: agentName,
        toolId: p.toolId as string,
        output: p.output,
        isError: p.isError as boolean,
        timestamp
      })
    default:
      // Other events are emitted directly via emitEvent, not from runAgentDef
      return undefined
  }
}

// ─────────────────────────────────────────────────────────────────
// Phase Execution
// ─────────────────────────────────────────────────────────────────

/**
 * Execute a single phase until its exit condition is met.
 *
 * Per ADR-004: Phase events are published via EventHub using Data.TaggedClass events.
 */
const executePhase = <S, Phases extends string>(
  ctx: RuntimeContext<S>,
  phaseName: Phases,
  phaseDef: PhaseDef<S, Phases, unknown>,
  fromPhase?: string
): Effect.Effect<
  Phases | undefined,
  WorkflowError | AgentError | ProviderError | StoreError | RecordingNotFound,
  ProviderRecorder | ProviderModeContext | EventHub | EventStore | EventBus
> =>
  Effect.gen(function*() {
    // Update current phase
    yield* Ref.set(ctx.currentPhaseRef, phaseName)

    // Emit PhaseEntered event
    const phaseEnteredProps: { phase: string; timestamp: Date; fromPhase?: string } = {
      phase: phaseName,
      timestamp: new Date()
    }
    if (fromPhase !== undefined) phaseEnteredProps.fromPhase = fromPhase
    yield* emitEvent(ctx, new Events.PhaseEntered(phaseEnteredProps))

    // Terminal phase - exit immediately
    if (phaseDef.terminal) {
      yield* emitEvent(
        ctx,
        new Events.PhaseExited({
          phase: phaseName,
          reason: "terminal",
          timestamp: new Date()
        })
      )
      // Per ADR-006: Emit StateCheckpoint on phase exit for replay optimization
      yield* emitStateCheckpoint(ctx, phaseName)
      return undefined // Signal workflow completion
    }

    // Execute phase loop
    let output: unknown
    let shouldContinue = true
    // Track human response for routing (available to next() function via state)
    let humanResponse: { value: string; approved?: boolean } | undefined

    while (shouldContinue) {
      // Check for pause
      const isPaused = yield* Ref.get(ctx.isPausedRef)
      if (isPaused) {
        // Per ADR-006: Emit StateCheckpoint on pause for resume optimization
        yield* emitStateCheckpoint(ctx, phaseName)
        yield* Deferred.await(ctx.pauseDeferred)
      }

      // Execute agent if present
      if (phaseDef.run) {
        // Per ADR-006: Read state from SubscriptionRef (backed by StateProjection)
        const state = yield* SubscriptionRef.get(ctx.stateRef)

        if (phaseDef.forEach) {
          // Parallel execution with forEach
          const contexts = phaseDef.forEach(state)
          const concurrency = phaseDef.parallel ?? 1

          // Execute agents in parallel with limited concurrency
          yield* Effect.forEach(
            contexts,
            (agentCtx) => executeAgent(ctx, phaseDef.run!, agentCtx, phaseName),
            { concurrency }
          )
        } else {
          // Single agent execution
          output = yield* executeAgent(ctx, phaseDef.run, undefined, phaseName)
        }
      }

      // Per ADR-002: Handle human-in-the-loop AFTER agent completes
      // Evaluate phase.human config (static or function that receives state and agent output)
      if (phaseDef.human) {
        const state = yield* SubscriptionRef.get(ctx.stateRef)

        // Resolve human config: could be static or a function returning config (or null to skip)
        const humanConfig: HumanConfig<S> | null = typeof phaseDef.human === "function"
          ? phaseDef.human(state, output)
          : phaseDef.human

        if (humanConfig) {
          // Resolve prompt (static string or function)
          const prompt = typeof humanConfig.prompt === "function"
            ? humanConfig.prompt(state)
            : humanConfig.prompt

          // Resolve options if type is "choice" (static array or function)
          const resolvedOptions = humanConfig.options
            ? (typeof humanConfig.options === "function"
              ? humanConfig.options(state)
              : humanConfig.options)
            : undefined

          const requestId = crypto.randomUUID()

          // Emit InputRequested event
          const inputRequestedProps: {
            id: string
            prompt: string
            type: "approval" | "choice"
            timestamp: Date
            options?: ReadonlyArray<string>
          } = {
            id: requestId,
            prompt,
            type: humanConfig.type,
            timestamp: new Date()
          }
          if (resolvedOptions !== undefined) inputRequestedProps.options = resolvedOptions
          yield* emitEvent(ctx, new Events.InputRequested(inputRequestedProps))

          // Get response: prefer humanInput handler (ADR-002), fall back to inputQueue
          let response: string
          let approved: boolean | undefined

          if (ctx.humanInput) {
            // Use ADR-002 humanInput handler
            if (humanConfig.type === "approval") {
              approved = yield* Effect.promise(() => ctx.humanInput!.approval(prompt))
              response = approved ? "yes" : "no"
            } else {
              // type === "choice"
              response = yield* Effect.promise(() =>
                ctx.humanInput!.choice(prompt, resolvedOptions ? [...resolvedOptions] : [])
              )
            }
          } else {
            // Fall back to inputQueue (for execute.ts compatibility)
            response = yield* Queue.take(ctx.inputQueue)
            // For approval type from queue, interpret "yes"/"y" as approved
            if (humanConfig.type === "approval") {
              approved = response.toLowerCase().startsWith("y")
            }
          }

          // Emit InputReceived event
          const inputReceivedProps: {
            id: string
            value: string
            timestamp: Date
            approved?: boolean
          } = {
            id: requestId,
            value: response,
            timestamp: new Date()
          }
          if (approved !== undefined) inputReceivedProps.approved = approved
          yield* emitEvent(ctx, new Events.InputReceived(inputReceivedProps))

          // Store human response for routing (can be accessed via state.humanResponse)
          // Use conditional spreading to satisfy exactOptionalPropertyTypes
          humanResponse = approved !== undefined
            ? { value: response, approved }
            : { value: response }

          // Update state with human response so it's available to next() and until()
          yield* updateState(ctx, (draft) => {
            // Store response in state for routing decisions
            ;(draft as Record<string, unknown>).humanResponse = humanResponse
          })

          // Process response if handler provided
          if (phaseDef.onResponse) {
            yield* updateState(ctx, (draft) => {
              phaseDef.onResponse!(response, draft)
            })
          }
        }
      }

      // Check until condition
      // Per ADR-006: Read state from SubscriptionRef (backed by StateProjection)
      const currentState = yield* SubscriptionRef.get(ctx.stateRef)
      if (phaseDef.until) {
        shouldContinue = !phaseDef.until(currentState, output)
      } else {
        shouldContinue = false // Single iteration if no until
      }
    }

    // Emit PhaseExited event
    yield* emitEvent(
      ctx,
      new Events.PhaseExited({
        phase: phaseName,
        reason: "next",
        timestamp: new Date()
      })
    )

    // Per ADR-006: Emit StateCheckpoint on phase exit for replay optimization
    yield* emitStateCheckpoint(ctx, phaseName)

    // Determine next phase
    if (!phaseDef.next) {
      return yield* Effect.fail(
        new WorkflowPhaseError({
          fromPhase: phaseName,
          toPhase: "unknown",
          message: `Phase "${phaseName}" has no 'next' transition and is not terminal`
        })
      )
    }

    // Per ADR-006: Read state from SubscriptionRef (backed by StateProjection)
    const state = yield* SubscriptionRef.get(ctx.stateRef)
    const nextPhase = typeof phaseDef.next === "function" ? phaseDef.next(state) : phaseDef.next

    return nextPhase
  })

// ─────────────────────────────────────────────────────────────────
// Simple Workflow Execution
// ─────────────────────────────────────────────────────────────────

/**
 * Execute a simple (single-agent) workflow.
 *
 * Per ADR-004: Uses EventHub for all event emission.
 */
const executeSimpleWorkflow = <S, Input>(
  workflow: SimpleWorkflowDef<S, Input>,
  ctx: RuntimeContext<S>
): Effect.Effect<
  void,
  WorkflowError | AgentError | ProviderError | StoreError | RecordingNotFound,
  ProviderRecorder | ProviderModeContext | EventHub | EventStore | EventBus
> =>
  Effect.gen(function*() {
    let shouldContinue = true

    while (shouldContinue) {
      // Check for pause
      const isPaused = yield* Ref.get(ctx.isPausedRef)
      if (isPaused) {
        // Per ADR-006: Emit StateCheckpoint on pause for resume optimization
        // Simple workflows don't have phases, use workflow name as phase identifier
        yield* emitStateCheckpoint(ctx, workflow.name)
        yield* Deferred.await(ctx.pauseDeferred)
      }

      // Execute agent
      yield* executeAgent(ctx, workflow.agent, undefined)

      // Check until condition
      if (workflow.until) {
        // Per ADR-006: Read state from SubscriptionRef (backed by StateProjection)
        const state = yield* SubscriptionRef.get(ctx.stateRef)
        shouldContinue = !workflow.until(state)
      } else {
        shouldContinue = false // Single iteration if no until
      }
    }
  })

// ─────────────────────────────────────────────────────────────────
// Phase Workflow Execution
// ─────────────────────────────────────────────────────────────────

/**
 * Execute a phased workflow (state machine).
 *
 * Per ADR-004: Uses EventHub for all event emission.
 */
const executePhaseWorkflow = <S, Input, Phases extends string>(
  workflow: PhaseWorkflowDef<S, Input, Phases>,
  ctx: RuntimeContext<S>
): Effect.Effect<
  string | undefined,
  WorkflowError | AgentError | ProviderError | StoreError | RecordingNotFound,
  ProviderRecorder | ProviderModeContext | EventHub | EventStore | EventBus
> =>
  Effect.gen(function*() {
    // Determine starting phase — prefer resumePhase from context if set
    const phaseNames = Object.keys(workflow.phases) as Array<Phases>
    const resumedPhase = yield* Ref.get(ctx.currentPhaseRef)
    let currentPhase: Phases | undefined = (resumedPhase as Phases | undefined) ?? workflow.startPhase ?? phaseNames[0]

    // Execute phases until we hit a terminal
    let prevPhase: Phases | undefined = undefined
    while (currentPhase !== undefined) {
      const currentPhaseDef: PhaseDef<S, Phases, unknown> = workflow.phases[currentPhase]
      if (!currentPhaseDef) {
        return yield* Effect.fail(
          new WorkflowPhaseError({
            fromPhase: currentPhase,
            toPhase: "unknown",
            message: `Phase "${currentPhase}" not found in workflow`
          })
        )
      }

      const thisPhase: Phases = currentPhase
      currentPhase = yield* executePhase(ctx, currentPhase, currentPhaseDef, prevPhase)
      prevPhase = thisPhase
    }

    // Return the exit phase (last phase before undefined)
    const exitPhase = yield* Ref.get(ctx.currentPhaseRef)
    return exitPhase
  })

// ─────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────

/**
 * Options for workflow execution.
 */
export interface ExecuteOptions<Input> {
  /** Input to the workflow's start() function */
  readonly input: Input
  /** Optional session ID (generates new UUID if not provided) */
  readonly sessionId?: string
  /**
   * Optional pre-created input queue for HITL responses.
   * When provided, the runtime uses this queue instead of creating its own.
   * This allows the caller (e.g. execute.ts) to feed responses into the queue
   * via Queue.offer, which the runtime reads via Queue.take.
   */
  readonly inputQueue?: Queue.Queue<string>
  /**
   * Optional callback invoked synchronously for each event as it is emitted.
   * Used by execute() to stream events in real-time via the async iterator,
   * rather than buffering them until workflow completion.
   */
  readonly onEvent?: (event: AnyEvent) => void
  /**
   * Optional pre-existing state to resume from.
   * When provided, the runtime skips calling workflow.start(input)
   * and uses this state directly as the initial state.
   * Used for resuming workflows from a previously persisted checkpoint.
   */
  readonly resumeState?: unknown
  /**
   * Optional phase name to resume from.
   * When provided alongside resumeState, the phased workflow
   * starts execution from this phase instead of the first phase.
   */
  readonly resumePhase?: string
  /**
   * Optional observer for structured lifecycle callbacks.
   * Receives typed callbacks for state changes, phase transitions,
   * agent lifecycle, streaming chunks, and workflow completion.
   * All methods are fire-and-forget (void) except inputRequested (async).
   */
  readonly observer?: WorkflowObserver<unknown>
  /**
   * Optional human input handler for HITL (Human-in-the-Loop) interactions.
   *
   * Per ADR-002: When a phase's human config is triggered, this handler is
   * called to get the human response. The handler provides approval() and
   * choice() callbacks for different input types.
   *
   * If not provided but phase.human is configured, the runtime falls back
   * to the inputQueue-based approach (for execute.ts compatibility).
   */
  readonly humanInput?: HumanInputHandler
}

/**
 * Execute a workflow definition and return the result.
 *
 * Per ADR-004: This is the core Effect program that executes workflows using
 * EventHub for all event emission. Subscribers (EventStore, EventBus, Observer)
 * run as separate fibers with automatic cleanup via Effect.scoped.
 *
 * It handles:
 * - Creating EventHub and forking subscriber fibers
 * - Initializing state with Immer
 * - Running agent loops (simple) or phase state machines (phased)
 * - Emitting events via EventHub.publish
 * - HITL pause/resume
 *
 * @template S - State type
 * @template Input - Input type
 * @template Phases - Phase names (for phased workflows)
 *
 * @example
 * ```typescript
 * const result = yield* executeWorkflow(myWorkflow, {
 *   input: "Build a REST API",
 *   sessionId: "abc123"
 * })
 * ```
 */
export const executeWorkflow = <S, Input, Phases extends string = never>(
  workflow: WorkflowDef<S, Input, Phases>,
  options: ExecuteOptions<Input>
): Effect.Effect<
  WorkflowResult<S>,
  WorkflowError | AgentError | ProviderError | StoreError | RecordingNotFound,
  ProviderRecorder | ProviderModeContext | EventStore | EventBus
> =>
  // Wrap in Effect.scoped per ADR-004: subscriber fibers are automatically
  // cleaned up when the scope closes
  Effect.scoped(
    Effect.gen(function*() {
      // Generate session ID if not provided
      const sessionId = options.sessionId ?? (yield* Effect.sync(() => crypto.randomUUID()))

      // ─────────────────────────────────────────────────────────────────
      // ADR-004: Create EventHub and fork subscriber fibers
      // ─────────────────────────────────────────────────────────────────

      // Create EventHub (scoped to this execution)
      const hub = yield* makeEventHub

      // Note: Per ADR-004, we originally planned to use fiber-based subscribers.
      // However, for synchronous reliability (ensuring events are persisted/dispatched
      // before workflow returns), we now do synchronous dispatch in emitEvent().
      //
      // The fiber-based subscribers (makeStoreSubscriber, makeBusSubscriber,
      // makeObserverSubscriber) are NOT used here because:
      // 1. Scope closes before async fibers finish processing
      // 2. Tests and users expect synchronous behavior
      //
      // The subscribers.ts module is kept for future use cases like:
      // - SSE-only consumers that connect mid-workflow
      // - Background analytics processing
      // - Eventual consistency scenarios

      // Initialize runtime context
      // If resumeState is provided, use it directly instead of workflow.initialState
      const initialState = (options.resumeState as S | undefined) ?? workflow.initialState
      // Use caller-provided inputQueue (for HITL wiring from execute.ts) or create a new one
      const inputQueue = options.inputQueue ?? (yield* Queue.unbounded<string>())

      // Per ADR-006: Create SubscriptionRef for state and fork a projection fiber
      // that updates it when StateIntent events are received from EventHub.
      const stateRef = yield* SubscriptionRef.make(initialState)

      // Fork StateProjection fiber (scoped - cleaned up when workflow ends)
      // This fiber subscribes to EventHub and updates stateRef when StateIntent arrives.
      const eventStream = yield* hub.subscribe()
      yield* Effect.forkScoped(
        eventStream.pipe(
          Stream.runForEach((event) =>
            Match.value(event).pipe(
              Match.tag("StateIntent", (e: Events.StateIntent) =>
                // Set state from intent (includes full state for compatibility)
                SubscriptionRef.set(stateRef, e.state as S)),
              Match.tag("StateCheckpoint", (e: Events.StateCheckpoint) =>
                // Set state directly from checkpoint
                SubscriptionRef.set(stateRef, e.state as S)),
              Match.orElse(() => Effect.void) // Ignore other events
            )
          )
        )
      )

      const baseCtx = {
        stateRef,
        eventsRef: yield* Ref.make<Array<WorkflowEvent>>([]),
        sessionId,
        currentPhaseRef: yield* Ref.make<string | undefined>(options.resumePhase),
        inputQueue,
        pauseDeferred: yield* Deferred.make<void>(),
        isPausedRef: yield* Ref.make(false),
        lastEventIdRef: yield* Ref.make<EventId | undefined>(undefined)
      }

      // exactOptionalPropertyTypes requires conditional spreading
      const ctx: RuntimeContext<S> = {
        ...baseCtx,
        ...(options.onEvent ? { onEvent: options.onEvent } : {}),
        ...(options.observer ? { observer: options.observer } : {}),
        ...(options.humanInput ? { humanInput: options.humanInput } : {})
      }

      // Provide EventHub to the rest of the execution
      const runWithHub = <A, E, R>(effect: Effect.Effect<A, E, R | EventHub>) =>
        Effect.provideService(effect, EventHub, hub)

      // Skip start() when resuming from a checkpoint state
      if (!options.resumeState) {
        // Apply start() function with Immer
        yield* runWithHub(
          updateState(ctx, (draft) => {
            workflow.start(options.input, draft)
          })
        )
      }

      // Emit WorkflowStarted event
      yield* runWithHub(
        emitEvent(
          ctx,
          new Events.WorkflowStarted({
            sessionId,
            workflow: workflow.name,
            input: options.input,
            timestamp: new Date()
          })
        )
      )

      // Execute based on workflow type
      let exitPhase: string | undefined

      if (isSimpleWorkflow(workflow)) {
        yield* runWithHub(executeSimpleWorkflow(workflow, ctx))
      } else if (isPhaseWorkflow(workflow)) {
        exitPhase = yield* runWithHub(executePhaseWorkflow(workflow, ctx))
      }

      // Per ADR-006: Get final state from SubscriptionRef (backed by StateProjection)
      const finalState = yield* SubscriptionRef.get(ctx.stateRef)

      // Emit WorkflowCompleted event
      const workflowCompletedProps: {
        sessionId: string
        finalState: unknown
        timestamp: Date
        exitPhase?: string
      } = {
        sessionId,
        finalState,
        timestamp: new Date()
      }
      if (exitPhase !== undefined) workflowCompletedProps.exitPhase = exitPhase
      yield* runWithHub(emitEvent(ctx, new Events.WorkflowCompleted(workflowCompletedProps)))

      // Get all workflow events for the result
      const allWorkflowEvents = yield* Ref.get(ctx.eventsRef)

      // Convert WorkflowEvents to legacy AnyEvent format for the result
      // This maintains backward compatibility with existing code expecting AnyEvent[]
      const allEvents = allWorkflowEvents.map(workflowEventToLegacy)

      // Build result with proper optional handling
      const result: WorkflowResult<S> = {
        state: finalState,
        sessionId,
        events: allEvents,
        completed: true
      }

      // Only include exitPhase if defined (exactOptionalPropertyTypes)
      const finalResult = exitPhase !== undefined ? { ...result, exitPhase } : result

      // Note: observer.onCompleted is now handled by makeObserverSubscriber
      // when it receives WorkflowCompleted event. We keep this call for
      // backward compatibility to ensure the full result (with state and events)
      // is passed to onCompleted, not just the event payload.
      if (ctx.observer?.onCompleted) {
        ctx.observer.onCompleted({ state: finalResult.state, events: finalResult.events })
      }

      return finalResult
    })
  ).pipe(
    // Dispatch observer.onErrored on failure
    Effect.tapError((error) =>
      Effect.sync(() => {
        options.observer?.onErrored?.(error)
      })
    ),
    Effect.withSpan("executeWorkflow", {
      attributes: { workflowName: workflow.name }
    })
  )

// ─────────────────────────────────────────────────────────────────
// Stream API (for real-time event consumption)
// ─────────────────────────────────────────────────────────────────

/**
 * Execute a workflow and stream events as they occur.
 *
 * Unlike executeWorkflow which returns all events at the end,
 * this streams events in real-time for UI updates.
 *
 * Per ADR-004: Uses EventHub for event emission. The stream collects
 * events from the result. For true real-time streaming, use execute()
 * from execute.ts which provides an async iterator interface.
 *
 * @template S - State type
 * @template Input - Input type
 *
 * @example
 * ```typescript
 * const stream = streamWorkflow(myWorkflow, { input: "Build API" })
 *
 * yield* stream.pipe(
 *   Stream.tap((event) => Effect.log(`Event: ${event.name}`)),
 *   Stream.runDrain
 * )
 * ```
 */
export const streamWorkflow = <S, Input, Phases extends string = never>(
  workflow: WorkflowDef<S, Input, Phases>,
  options: ExecuteOptions<Input>
): Stream.Stream<
  AnyEvent,
  WorkflowError | AgentError | ProviderError | StoreError | RecordingNotFound,
  ProviderRecorder | ProviderModeContext | EventStore | EventBus
> =>
  // Note: Real-time streaming requires modifying the runtime to push events
  // to a queue as they occur. Currently, events are collected and returned
  // at the end of execution. For real-time UI updates, use execute() from
  // execute.ts which provides an async iterator interface.
  Stream.unwrap(
    Effect.gen(function*() {
      // Execute workflow and collect all events
      const result = yield* executeWorkflow(workflow, options)

      // Return events as a stream
      return Stream.fromIterable(result.events)
    })
  )

// ─────────────────────────────────────────────────────────────────
// HITL Control Functions
// ─────────────────────────────────────────────────────────────────

/**
 * Handle for controlling a running workflow execution.
 * Returned by execute() for HITL and pause/resume functionality.
 */
export interface WorkflowHandle<S> {
  /** Promise that resolves when workflow completes */
  readonly result: Promise<WorkflowResult<S>>
  /** Provide input for HITL prompt */
  readonly respond: (value: string) => Effect.Effect<void>
  /** Pause workflow execution */
  readonly pause: () => Effect.Effect<void>
  /** Resume paused workflow */
  readonly resume: () => Effect.Effect<void>
  /** Get current state */
  readonly getState: () => Effect.Effect<S>
  /** Get all events so far */
  readonly getEvents: () => Effect.Effect<ReadonlyArray<AnyEvent>>
}

// Note: WorkflowHandle implementation would require maintaining
// a reference to the RuntimeContext, which is an advanced pattern
// that will be implemented in Phase 6 (Execute/Run API).
