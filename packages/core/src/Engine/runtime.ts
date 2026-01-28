/**
 * Effect-based runtime for state-first workflow execution.
 *
 * This module bridges the new state-first DX (AgentDef, PhaseDef, WorkflowDef)
 * to the existing execution infrastructure (ProviderRecorder, EventStore, etc.).
 *
 * Key responsibilities:
 * - Execute workflows with Effect for structured concurrency
 * - Use Immer for state updates (wrapped in Effect.sync)
 * - Emit Events for recording/UI/debugging
 * - Handle parallel agent execution via Effect.forEach
 * - Support HITL via Deferred for pause/resume
 *
 * @module
 */

import { Deferred, Effect, Queue, Ref, Stream } from "effect"
import type { Draft, Patch } from "immer"
import { enablePatches, produceWithPatches } from "immer"

import type { AgentError, ProviderError, RecordingNotFound, StoreError } from "../Domain/Errors.js"
import type { SessionId } from "../Domain/Ids.js"
import { EventBus } from "../Services/EventBus.js"
import { EventStore } from "../Services/EventStore.js"
import type { ProviderModeContext } from "../Services/ProviderMode.js"
import type { ProviderRecorder } from "../Services/ProviderRecorder.js"

import type { AgentDef } from "./agent.js"
import type { PhaseDef } from "./phase.js"
import { type ProviderNotFoundError, type ProviderRegistry, runAgentDef } from "./provider.js"
import {
  type AnyEvent,
  type EventId,
  EVENTS,
  makeEvent,
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

/**
 * Unified dispatch helper for observer callbacks.
 * Handles all event types in one place to avoid duplication.
 */
const dispatchToObserver = (observer: WorkflowObserver<unknown>, event: AnyEvent): void => {
  observer.onEvent?.(event)
  const p = event.payload as Record<string, unknown>
  switch (event.name) {
    case EVENTS.STATE_UPDATED:
      observer.onStateChanged?.(p.state, p.patches as ReadonlyArray<unknown> | undefined)
      break
    case EVENTS.PHASE_ENTERED:
      observer.onPhaseChanged?.(p.phase as string, p.fromPhase as string | undefined)
      break
    case EVENTS.AGENT_STARTED: {
      const info: { agent: string; phase?: string } = { agent: p.agentName as string }
      if (p.phase !== undefined) info.phase = p.phase as string
      observer.onAgentStarted?.(info)
      break
    }
    case EVENTS.AGENT_COMPLETED:
      observer.onAgentCompleted?.({
        agent: p.agentName as string,
        output: p.output,
        durationMs: p.durationMs as number
      })
      break
    case EVENTS.TEXT_DELTA:
      observer.onTextDelta?.({ agent: p.agentName as string, delta: p.delta as string })
      break
    case EVENTS.THINKING_DELTA:
      observer.onThinkingDelta?.({ agent: p.agentName as string, delta: p.delta as string })
      break
    case EVENTS.TOOL_CALLED:
      observer.onToolCall?.({
        agent: p.agentName as string,
        toolId: p.toolId as string,
        toolName: p.toolName as string,
        input: p.input
      })
      break
    case EVENTS.TOOL_RESULT:
      observer.onToolResult?.({
        agent: p.agentName as string,
        toolId: p.toolId as string,
        output: p.output,
        isError: p.isError as boolean
      })
      break
    case EVENTS.WORKFLOW_STARTED:
      observer.onStarted?.(p.sessionId as string)
      break
  }
}

// ─────────────────────────────────────────────────────────────────
// Runtime Context (internal state during execution)
// ─────────────────────────────────────────────────────────────────

/**
 * Internal runtime context for workflow execution.
 * Tracks mutable state, events, and HITL interactions.
 */
interface RuntimeContext<S> {
  /** Current workflow state (Ref for thread-safe updates) */
  readonly stateRef: Ref.Ref<S>
  /** Accumulated events during execution */
  readonly eventsRef: Ref.Ref<Array<AnyEvent>>
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
  /** Last event ID for causality tracking */
  readonly lastEventIdRef: Ref.Ref<EventId | undefined>
  /** Optional real-time event callback for streaming */
  readonly onEvent?: (event: AnyEvent) => void
  /** Optional observer for structured lifecycle callbacks */
  readonly observer?: WorkflowObserver<unknown>
}

// ─────────────────────────────────────────────────────────────────
// Event Emission Helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Emit an event and track it in the runtime context.
 * Persists to EventStore and broadcasts via EventBus on every emit.
 */
const emitEvent = <S>(
  ctx: RuntimeContext<S>,
  name: string,
  payload: unknown
): Effect.Effect<AnyEvent, StoreError, EventStore | EventBus> =>
  Effect.gen(function*() {
    const causedBy = yield* Ref.get(ctx.lastEventIdRef)
    const event = yield* makeEvent(name, payload, causedBy)

    // Update in-memory tracking
    yield* Ref.update(ctx.eventsRef, (events) => [...events, event])
    yield* Ref.set(ctx.lastEventIdRef, event.id)

    // Persist to EventStore and broadcast via EventBus
    const store = yield* EventStore
    const bus = yield* EventBus
    yield* store.append(ctx.sessionId as SessionId, event)
    yield* bus.publish(ctx.sessionId as SessionId, event)

    // Stream event in real-time if callback is provided
    if (ctx.onEvent) {
      ctx.onEvent(event)
    }

    // Dispatch to observer if provided
    if (ctx.observer) dispatchToObserver(ctx.observer, event)

    return event
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
 * Update state using Immer and emit state:updated event.
 *
 * Uses produceWithPatches to capture:
 * - patches: What changed (for incremental replay)
 * - inversePatches: How to undo (for time-travel debugging)
 */
const updateState = <S>(
  ctx: RuntimeContext<S>,
  updater: (draft: Draft<S>) => void
): Effect.Effect<StateUpdateResult<S>, StoreError, EventStore | EventBus> =>
  Effect.gen(function*() {
    const currentState = yield* Ref.get(ctx.stateRef)

    // Use Immer's produceWithPatches to capture patches for incremental replay
    const [newState, patches, inversePatches] = yield* Effect.sync(() => produceWithPatches(currentState, updater))

    // Update the ref
    yield* Ref.set(ctx.stateRef, newState)

    // Emit state:updated event with patches
    yield* emitEvent(ctx, EVENTS.STATE_UPDATED, {
      state: newState,
      patches,
      inversePatches
    })

    return { state: newState, patches, inversePatches }
  })

// ─────────────────────────────────────────────────────────────────
// Agent Execution
// ─────────────────────────────────────────────────────────────────

/**
 * Execute a single agent and update state.
 *
 * This bridges to runAgentDef which handles:
 * - Provider resolution via ProviderRegistry
 * - Recording/playback via ProviderRecorder
 * - Output parsing via Zod schema
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
  WorkflowError | AgentError | ProviderError | StoreError | RecordingNotFound | ProviderNotFoundError,
  ProviderRegistry | ProviderRecorder | ProviderModeContext | EventStore | EventBus
> =>
  Effect.gen(function*() {
    const state = yield* Ref.get(runtimeCtx.stateRef)
    const causedBy = yield* Ref.get(runtimeCtx.lastEventIdRef)

    // Execute agent via provider infrastructure
    const result = yield* runAgentDef(agent, state, agentContext, {
      sessionId: runtimeCtx.sessionId,
      causedBy,
      phase
    })

    // Persist agent events to EventStore, broadcast via EventBus, and track in-memory
    const store = yield* EventStore
    const bus = yield* EventBus
    yield* Ref.update(runtimeCtx.eventsRef, (events) => [...events, ...result.events])

    for (const agentEvent of result.events) {
      // Persist to EventStore (critical for replay)
      yield* store.append(runtimeCtx.sessionId as SessionId, agentEvent)
      // Broadcast via EventBus (for real-time SSE)
      yield* bus.publish(runtimeCtx.sessionId as SessionId, agentEvent)

      // Stream event in real-time if callback is provided
      runtimeCtx.onEvent?.(agentEvent)

      // Dispatch to observer if provided
      if (runtimeCtx.observer) dispatchToObserver(runtimeCtx.observer, agentEvent)
    }

    // Update last event ID from agent's events
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

// ─────────────────────────────────────────────────────────────────
// Phase Execution
// ─────────────────────────────────────────────────────────────────

/**
 * Execute a single phase until its exit condition is met.
 */
const executePhase = <S, Phases extends string>(
  ctx: RuntimeContext<S>,
  phaseName: Phases,
  phaseDef: PhaseDef<S, Phases, unknown>,
  fromPhase?: string
): Effect.Effect<
  Phases | undefined,
  WorkflowError | AgentError | ProviderError | StoreError | RecordingNotFound | ProviderNotFoundError,
  ProviderRegistry | ProviderRecorder | ProviderModeContext | EventStore | EventBus
> =>
  Effect.gen(function*() {
    // Update current phase
    yield* Ref.set(ctx.currentPhaseRef, phaseName)

    // Emit phase:entered
    yield* emitEvent(ctx, EVENTS.PHASE_ENTERED, {
      phase: phaseName,
      fromPhase
    })

    // Terminal phase - exit immediately
    if (phaseDef.terminal) {
      yield* emitEvent(ctx, EVENTS.PHASE_EXITED, {
        phase: phaseName,
        reason: "terminal"
      })
      return undefined // Signal workflow completion
    }

    // Execute phase loop
    let output: unknown
    let shouldContinue = true

    while (shouldContinue) {
      // Check for pause
      const isPaused = yield* Ref.get(ctx.isPausedRef)
      if (isPaused) {
        yield* Deferred.await(ctx.pauseDeferred)
      }

      // Handle human-in-the-loop
      if (phaseDef.human) {
        const state = yield* Ref.get(ctx.stateRef)
        const promptText = phaseDef.human.prompt(state)

        // Emit input:requested
        yield* emitEvent(ctx, EVENTS.INPUT_REQUESTED, {
          promptText,
          inputType: phaseDef.human.type,
          options: phaseDef.human.options
        })

        // Wait for response
        const response = yield* Queue.take(ctx.inputQueue)

        // Emit input:response
        yield* emitEvent(ctx, EVENTS.INPUT_RESPONSE, { response })

        // Process response if handler provided
        if (phaseDef.onResponse) {
          yield* updateState(ctx, (draft) => {
            phaseDef.onResponse!(response, draft)
          })
        }
      }

      // Execute agent if present
      if (phaseDef.run) {
        const state = yield* Ref.get(ctx.stateRef)

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

      // Check until condition
      const currentState = yield* Ref.get(ctx.stateRef)
      if (phaseDef.until) {
        shouldContinue = !phaseDef.until(currentState, output)
      } else {
        shouldContinue = false // Single iteration if no until
      }
    }

    // Emit phase:exited
    yield* emitEvent(ctx, EVENTS.PHASE_EXITED, {
      phase: phaseName,
      reason: "next"
    })

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

    const state = yield* Ref.get(ctx.stateRef)
    const nextPhase = typeof phaseDef.next === "function" ? phaseDef.next(state) : phaseDef.next

    return nextPhase
  })

// ─────────────────────────────────────────────────────────────────
// Simple Workflow Execution
// ─────────────────────────────────────────────────────────────────

/**
 * Execute a simple (single-agent) workflow.
 */
const executeSimpleWorkflow = <S, Input>(
  workflow: SimpleWorkflowDef<S, Input>,
  ctx: RuntimeContext<S>
): Effect.Effect<
  void,
  WorkflowError | AgentError | ProviderError | StoreError | RecordingNotFound | ProviderNotFoundError,
  ProviderRegistry | ProviderRecorder | ProviderModeContext | EventStore | EventBus
> =>
  Effect.gen(function*() {
    let shouldContinue = true

    while (shouldContinue) {
      // Check for pause
      const isPaused = yield* Ref.get(ctx.isPausedRef)
      if (isPaused) {
        yield* Deferred.await(ctx.pauseDeferred)
      }

      // Execute agent
      yield* executeAgent(ctx, workflow.agent, undefined)

      // Check until condition
      if (workflow.until) {
        const state = yield* Ref.get(ctx.stateRef)
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
 */
const executePhaseWorkflow = <S, Input, Phases extends string>(
  workflow: PhaseWorkflowDef<S, Input, Phases>,
  ctx: RuntimeContext<S>
): Effect.Effect<
  string | undefined,
  WorkflowError | AgentError | ProviderError | StoreError | RecordingNotFound | ProviderNotFoundError,
  ProviderRegistry | ProviderRecorder | ProviderModeContext | EventStore | EventBus
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
}

/**
 * Execute a workflow definition and return the result.
 *
 * This is the core Effect program that executes workflows.
 * It handles:
 * - Initializing state with Immer
 * - Running agent loops (simple) or phase state machines (phased)
 * - Emitting events for recording/UI
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
  WorkflowError | AgentError | ProviderError | StoreError | RecordingNotFound | ProviderNotFoundError,
  ProviderRegistry | ProviderRecorder | ProviderModeContext | EventStore | EventBus
> =>
  Effect.gen(function*() {
    // Generate session ID if not provided
    const sessionId = options.sessionId ?? (yield* Effect.sync(() => crypto.randomUUID()))

    // Initialize runtime context
    // If resumeState is provided, use it directly instead of workflow.initialState
    const initialState = (options.resumeState as S | undefined) ?? workflow.initialState
    // Use caller-provided inputQueue (for HITL wiring from execute.ts) or create a new one
    const inputQueue = options.inputQueue ?? (yield* Queue.unbounded<string>())

    const baseCtx = {
      stateRef: yield* Ref.make(initialState),
      eventsRef: yield* Ref.make<Array<AnyEvent>>([]),
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
      ...(options.observer ? { observer: options.observer } : {})
    }

    // Skip start() when resuming from a checkpoint state
    if (!options.resumeState) {
      // Apply start() function with Immer
      yield* updateState(ctx, (draft) => {
        workflow.start(options.input, draft)
      })
    }

    // Emit workflow:started
    yield* emitEvent(ctx, EVENTS.WORKFLOW_STARTED, {
      sessionId,
      workflowName: workflow.name,
      input: options.input
    })

    // Execute based on workflow type
    let exitPhase: string | undefined

    if (isSimpleWorkflow(workflow)) {
      yield* executeSimpleWorkflow(workflow, ctx)
    } else if (isPhaseWorkflow(workflow)) {
      exitPhase = yield* executePhaseWorkflow(workflow, ctx)
    }

    // Get final state
    const finalState = yield* Ref.get(ctx.stateRef)

    // Emit workflow:completed
    yield* emitEvent(ctx, EVENTS.WORKFLOW_COMPLETED, {
      sessionId,
      finalState,
      exitPhase
    })

    // Get updated events (including workflow:completed)
    const allEvents = yield* Ref.get(ctx.eventsRef)

    // Build result with proper optional handling
    const result: WorkflowResult<S> = {
      state: finalState,
      sessionId,
      events: allEvents,
      completed: true
    }

    // Only include exitPhase if defined (exactOptionalPropertyTypes)
    const finalResult = exitPhase !== undefined ? { ...result, exitPhase } : result

    // Dispatch observer.onCompleted with final result
    if (ctx.observer?.onCompleted) {
      ctx.observer.onCompleted({ state: finalResult.state, events: finalResult.events })
    }

    return finalResult
  }).pipe(
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
  WorkflowError | AgentError | ProviderError | StoreError | RecordingNotFound | ProviderNotFoundError,
  ProviderRegistry | ProviderRecorder | ProviderModeContext | EventStore | EventBus
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
