/**
 * WorkflowRuntime Service Definition
 *
 * The WorkflowRuntime is the core event loop that orchestrates event processing.
 * It implements: Event → Handler → (State + Events) → Next Event
 *
 * This module defines the WorkflowRuntime service tag and interface for the
 * Effect Layer pattern.
 *
 * @module @core-v2/workflow
 */

import { Context, Effect, Layer, Queue, Ref } from "effect";
import type { Agent } from "../agent/Agent.js";
import type { AnyEvent } from "../event/Event.js";
import { createEvent } from "../event/Event.js";
import { EventBus } from "../event/EventBus.js";
import type { HandlerDefinition } from "../handler/Handler.js";
import { convertZodToJsonSchema } from "../internal/schema.js";
import { LLMProvider, type ProviderError, type QueryOptions } from "../provider/Provider.js";
import { matchesAnyPattern, type Renderer } from "../renderer/Renderer.js";
import type { SessionId } from "../store/Store.js";
import { generateSessionId, Store, type StoreError } from "../store/Store.js";

// ============================================================================
// WorkflowRuntime Error
// ============================================================================

/**
 * WorkflowRuntime error codes for programmatic handling.
 */
export type WorkflowRuntimeErrorCode =
	| "HANDLER_NOT_FOUND"
	| "HANDLER_FAILED"
	| "AGENT_FAILED"
	| "STORE_UNAVAILABLE"
	| "EXECUTION_FAILED"
	| "TERMINATED"
	| "ABORTED";

/**
 * WorkflowRuntime error class with typed error codes.
 * Used as Effect error channel type.
 */
export class WorkflowRuntimeError extends Error {
	readonly _tag = "WorkflowRuntimeError";

	constructor(
		/** Error code for programmatic handling */
		readonly code: WorkflowRuntimeErrorCode,
		/** Human-readable error message */
		message: string,
		/** Original cause if available */
		override readonly cause?: unknown,
	) {
		super(message, { cause });
		this.name = "WorkflowRuntimeError";
	}
}

// ============================================================================
// Runtime Configuration Types
// ============================================================================

/**
 * Callbacks for workflow execution.
 * Callbacks are called synchronously during event processing.
 */
export interface RuntimeCallbacks<S = unknown> {
	/** Called when an event is emitted */
	readonly onEvent?: (event: AnyEvent) => void;
	/** Called when state changes */
	readonly onStateChange?: (state: S) => void;
	/** Called on error (non-fatal errors during processing) */
	readonly onError?: (error: Error) => void;
}

/**
 * Options for running the workflow event loop.
 */
export interface RuntimeRunOptions<S = unknown> {
	/** Initial event to start the workflow (typically user:input) */
	readonly initialEvent: AnyEvent;
	/** Initial state for the workflow */
	readonly initialState: S;
	/** Handler definitions to register */
	readonly handlers: readonly HandlerDefinition<AnyEvent, S>[];
	/** Agents to register */
	readonly agents: readonly Agent<S, unknown>[];
	/** Renderers to receive events (executed in parallel with handlers per FR-004) */
	readonly renderers?: readonly Renderer<S, unknown>[];
	/** Termination condition - returns true when workflow should stop */
	readonly until: (state: S) => boolean;
	/** Whether to record this session (default: false) */
	readonly record?: boolean;
	/** Session ID (auto-generated if not provided when recording) */
	readonly sessionId?: SessionId;
	/** Callbacks for events and state changes */
	readonly callbacks?: RuntimeCallbacks<S>;
	/** Abort signal for cancellation */
	readonly abortSignal?: AbortSignal;
	/** Model to use for agent execution */
	readonly model?: string;
}

/**
 * Result of running the workflow event loop.
 */
export interface RuntimeResult<S = unknown> {
	/** Final state after workflow completion */
	readonly state: S;
	/** All events emitted during execution (in order) */
	readonly events: readonly AnyEvent[];
	/** Session ID (useful if auto-generated) */
	readonly sessionId: SessionId;
	/** Whether workflow was terminated via until condition */
	readonly terminated: boolean;
	/** Whether workflow was aborted via signal */
	readonly aborted: boolean;
}

// ============================================================================
// WorkflowRuntime Service Interface (Effect Internal)
// ============================================================================

/**
 * WorkflowRuntime service interface - defines the core event loop operations.
 *
 * @remarks
 * This is the internal Effect service interface. The WorkflowRuntime
 * implements the event-sourcing pattern:
 *
 * 1. Dequeue event from queue
 * 2. Find handler for event (via HandlerRegistry)
 * 3. Execute handler(event, state) → { state', events[] }
 * 4. Update state to state'
 * 5. Queue emitted events
 * 6. Check agents (via AgentRegistry) for activation
 * 7. Execute matching agents (via LLMProvider)
 * 8. Emit agent events
 * 9. Check termination condition (until)
 * 10. Repeat from step 1 until queue empty or terminated
 *
 * Key invariants:
 * - Events are processed sequentially (FR-003)
 * - Handlers are pure - same inputs always produce same outputs (FR-011)
 * - State is computed by replaying handlers over event log (FR-038)
 * - Recording persists events to Store (FR-042)
 */
export interface WorkflowRuntimeService {
	/**
	 * Run the workflow event loop.
	 *
	 * @remarks
	 * This is the main entry point for workflow execution. It:
	 * 1. Initializes state and event queue
	 * 2. Registers handlers and agents
	 * 3. Runs the event loop until termination
	 * 4. Returns the final result
	 *
	 * @param options - Runtime options including handlers, agents, and initial state
	 * @returns Effect with runtime result or fails with WorkflowRuntimeError
	 */
	readonly run: <S>(
		options: RuntimeRunOptions<S>,
	) => Effect.Effect<RuntimeResult<S>, WorkflowRuntimeError | StoreError | ProviderError>;

	/**
	 * Process a single event through the handler system.
	 *
	 * @remarks
	 * This is a lower-level API for testing and custom event injection.
	 * Most users should use `run()` instead.
	 *
	 * @param event - The event to process
	 * @param state - Current state
	 * @param handlers - Map of event name to handler
	 * @returns Effect with new state and emitted events
	 */
	readonly processEvent: <S>(
		event: AnyEvent,
		state: S,
		handlers: ReadonlyMap<string, HandlerDefinition<AnyEvent, S>>,
	) => Effect.Effect<{ state: S; events: readonly AnyEvent[] }, WorkflowRuntimeError>;
}

// ============================================================================
// WorkflowRuntime Context Tag
// ============================================================================

/**
 * WorkflowRuntime service tag for Effect dependency injection.
 *
 * @example
 * ```typescript
 * // Using the WorkflowRuntime in an Effect program
 * const program = Effect.gen(function* () {
 *   const runtime = yield* WorkflowRuntime;
 *
 *   const result = yield* runtime.run({
 *     initialEvent: createEvent("user:input", { text: "Hello" }),
 *     initialState: { messages: [] },
 *     handlers: [handleUserInput, handleAgentResponse],
 *     agents: [chatAgent],
 *     until: (state) => state.terminated,
 *   });
 *
 *   return result;
 * });
 *
 * // Providing the WorkflowRuntime layer
 * const runnable = program.pipe(Effect.provide(WorkflowRuntimeLive));
 * ```
 */
export class WorkflowRuntime extends Context.Tag("@core-v2/WorkflowRuntime")<
	WorkflowRuntime,
	WorkflowRuntimeService
>() {}

// ============================================================================
// WorkflowRuntime Live Implementation
// ============================================================================

/**
 * Creates the live WorkflowRuntime service.
 *
 * @remarks
 * This implementation:
 * - Uses Effect Queue for event sequencing
 * - Uses Ref for thread-safe state management
 * - Depends on LLMProvider, Store, EventBus, HandlerRegistry, AgentRegistry
 * - Implements sequential event processing (FR-003)
 * - Supports recording to Store (FR-042)
 * - Handles agent activation with guard conditions (FR-015)
 */
export const makeWorkflowRuntimeService = Effect.gen(function* () {
	// Get dependencies from context
	const llmProvider = yield* LLMProvider;
	const store = yield* Store;
	const eventBus = yield* EventBus;

	const service: WorkflowRuntimeService = {
		run: <S>(options: RuntimeRunOptions<S>) =>
			Effect.gen(function* () {
				const {
					initialEvent,
					initialState,
					handlers,
					agents,
					renderers = [],
					until,
					record = false,
					sessionId: providedSessionId,
					callbacks,
					abortSignal,
					model,
				} = options;

				// Generate session ID if recording and not provided
				const sessionId = record ? (providedSessionId ?? generateSessionId()) : generateSessionId();

				// Build handler map for fast lookup
				const handlerMap = new Map<string, HandlerDefinition<AnyEvent, S>>();
				for (const handler of handlers) {
					handlerMap.set(handler.handles, handler);
				}

				// Build agent list for activation checks
				const agentList = [...agents];

				// Create event queue (bounded for backpressure)
				const eventQueue = yield* Queue.bounded<AnyEvent>(1000);

				// Create state ref
				const stateRef = yield* Ref.make<S>(initialState);

				// Track all events for result
				const allEventsRef = yield* Ref.make<AnyEvent[]>([]);

				// Track termination/abort status
				const terminatedRef = yield* Ref.make<boolean>(false);
				const abortedRef = yield* Ref.make<boolean>(false);

				// Enqueue initial event
				yield* Queue.offer(eventQueue, initialEvent);

				// Helper: Record event to store if recording
				// CRITICAL: When record:true, Store failures MUST fail fast per spec edge case FR-xxx
				// We do NOT swallow errors here - events must not be lost silently
				const maybeRecord = (event: AnyEvent) =>
					record
						? store
								.append(sessionId, event)
								.pipe(
									Effect.catchAll((storeError) =>
										Effect.fail(
											new WorkflowRuntimeError(
												"STORE_UNAVAILABLE",
												`Store unavailable - cannot record session. Event "${event.name}" would be lost. Original error: ${storeError.message}`,
												storeError,
											),
										),
									),
								)
						: Effect.void;

				// Helper: Send event to all matching renderers (non-blocking, FR-004)
				// Renderers execute in parallel with handler processing
				const renderEvent = (event: AnyEvent, state: S) =>
					Effect.gen(function* () {
						for (const renderer of renderers) {
							// Check if this renderer's patterns match the event
							if (matchesAnyPattern(event.name, renderer.patterns)) {
								// Fork renderer execution - runs in parallel, doesn't block
								// Using forkDaemon to ensure the fiber survives parent scope completion
								// This is important when running via ManagedRuntime
								yield* Effect.forkDaemon(
									Effect.sync(() => {
										try {
											renderer.render(event, state);
										} catch {
											// Swallow renderer errors - they should not affect event processing
											// Per FR-018/FR-019, renderers are pure observers
										}
									}),
								);
							}
						}
					});

				// Helper: Check abort signal
				const checkAbort = Effect.gen(function* () {
					if (abortSignal?.aborted) {
						yield* Ref.set(abortedRef, true);
						return true;
					}
					return false;
				});

				// Helper: Process a single event
				const processOneEvent = (event: AnyEvent) =>
					Effect.gen(function* () {
						// Get current state
						const currentState = yield* Ref.get(stateRef);

						// Send to renderers IN PARALLEL with handler processing (FR-004)
						// Forked so it doesn't block - renderers run concurrently
						yield* renderEvent(event, currentState);

						// Find handler for this event
						const handlerDef = handlerMap.get(event.name);

						let newState = currentState;
						const emittedEvents: AnyEvent[] = [];

						if (handlerDef) {
							try {
								// Execute handler (pure, synchronous)
								const result = handlerDef.handler(event, currentState);
								newState = result.state;
								emittedEvents.push(...result.events);
							} catch (error) {
								// Handler threw - emit error event and continue (FR edge case)
								const errorEvent = createEvent("error:occurred", {
									code: "HANDLER_FAILED",
									message: error instanceof Error ? error.message : String(error),
									recoverable: true,
									context: { eventName: event.name, handlerName: handlerDef.name },
								});
								emittedEvents.push(errorEvent);

								// Notify callback
								callbacks?.onError?.(error instanceof Error ? error : new Error(String(error)));
							}
						}

						// Update state
						yield* Ref.set(stateRef, newState);

						// Notify state change callback
						callbacks?.onStateChange?.(newState);

						// Record event if recording (fails fast if Store unavailable per spec edge case)
						yield* maybeRecord(event);

						// Track event
						yield* Ref.update(allEventsRef, (events) => [...events, event]);

						// Notify event callback
						callbacks?.onEvent?.(event);

						// Emit to EventBus
						yield* eventBus.emit(event);

						// Check for agent activation
						for (const agent of agentList) {
							// Check if agent activates on this event
							const activates = agent.activatesOn.includes(event.name);
							if (!activates) continue;

							// Check guard condition if present
							const guardPasses = agent.when ? agent.when(newState) : true;
							if (!guardPasses) continue;

							// Execute agent via LLMProvider
							try {
								// Build prompt
								const prompt = agent.prompt(newState, event);
								const promptText =
									typeof prompt === "string"
										? prompt
										: (prompt as readonly { content: string }[]).map((p) => p.content).join("\n");

								// Build query options with structured output if agent has outputSchema
								const queryOptions: QueryOptions = agent.outputSchema
									? {
											messages: [{ role: "user", content: promptText }],
											model: agent.model ?? model,
											outputFormat: {
												type: "json_schema",
												schema: convertZodToJsonSchema(
													agent.outputSchema as Parameters<typeof convertZodToJsonSchema>[0],
												),
											},
										}
									: {
											messages: [{ role: "user", content: promptText }],
											model: agent.model ?? model,
										};

								// Emit agent started event
								const startedEvent = createEvent("agent:started", {
									agentName: agent.name,
									reason: event.name,
								});
								emittedEvents.push(startedEvent);

								// Query provider
								const result = yield* llmProvider.query(queryOptions as QueryOptions);

								// Transform output to events via onOutput
								if (result.output && agent.onOutput) {
									const outputEvents = agent.onOutput(result.output, event);
									emittedEvents.push(...outputEvents);
								}

								// Emit agent completed event
								const completedEvent = createEvent("agent:completed", {
									agentName: agent.name,
									outcome: "success" as const,
								});
								emittedEvents.push(completedEvent);
							} catch (error) {
								// Agent failed - emit error event
								const errorEvent = createEvent("error:occurred", {
									code: "AGENT_FAILED",
									message: error instanceof Error ? error.message : String(error),
									recoverable: true,
									context: { agentName: agent.name, triggerEvent: event.name },
								});
								emittedEvents.push(errorEvent);

								// Emit agent completed with failure
								const completedEvent = createEvent("agent:completed", {
									agentName: agent.name,
									outcome: "failure" as const,
								});
								emittedEvents.push(completedEvent);

								// Notify callback
								callbacks?.onError?.(error instanceof Error ? error : new Error(String(error)));
							}
						}

						// Queue emitted events for processing
						for (const emitted of emittedEvents) {
							yield* Queue.offer(eventQueue, emitted);
						}

						// Check termination condition
						if (until(newState)) {
							yield* Ref.set(terminatedRef, true);
						}
					});

				// Main event loop
				yield* Effect.gen(function* () {
					// Process events until queue empty, terminated, or aborted
					// eslint-disable-next-line no-constant-condition
					while (true) {
						// Check abort
						const isAborted = yield* checkAbort;
						if (isAborted) break;

						// Check terminated
						const isTerminated = yield* Ref.get(terminatedRef);
						if (isTerminated) break;

						// Try to take next event (non-blocking check if empty)
						const maybeEvent = yield* Queue.poll(eventQueue);

						if (maybeEvent._tag === "None") {
							// Queue is empty - we're done
							break;
						}

						// Process the event
						yield* processOneEvent(maybeEvent.value);
					}
				});

				// Build result
				const finalState = yield* Ref.get(stateRef);
				const allEvents = yield* Ref.get(allEventsRef);
				const terminated = yield* Ref.get(terminatedRef);
				const aborted = yield* Ref.get(abortedRef);

				return {
					state: finalState,
					events: allEvents,
					sessionId,
					terminated,
					aborted,
				} as RuntimeResult<S>;
			}),

		processEvent: <S>(event: AnyEvent, state: S, handlers: ReadonlyMap<string, HandlerDefinition<AnyEvent, S>>) =>
			Effect.gen(function* () {
				const handlerDef = handlers.get(event.name);

				if (!handlerDef) {
					// No handler - return unchanged state, no events
					return { state, events: [] as readonly AnyEvent[] };
				}

				try {
					const result = handlerDef.handler(event, state);
					return { state: result.state, events: result.events };
				} catch (error) {
					return yield* Effect.fail(
						new WorkflowRuntimeError(
							"HANDLER_FAILED",
							`Handler "${handlerDef.name}" failed: ${error instanceof Error ? error.message : String(error)}`,
							error,
						),
					);
				}
			}),
	};

	return service;
});

/**
 * Live WorkflowRuntime layer for dependency injection.
 *
 * @remarks
 * This layer depends on:
 * - LLMProvider (for agent execution)
 * - Store (for recording)
 * - EventBus (for event emission to subscribers)
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const runtime = yield* WorkflowRuntime;
 *   const result = yield* runtime.run(options);
 *   return result;
 * });
 *
 * const runnable = program.pipe(
 *   Effect.provide(WorkflowRuntimeLive),
 *   Effect.provide(LLMProviderLive),
 *   Effect.provide(StoreLive),
 *   Effect.provide(EventBusLive),
 * );
 * await Effect.runPromise(runnable);
 * ```
 */
export const WorkflowRuntimeLive = Layer.effect(WorkflowRuntime, makeWorkflowRuntimeService);

// ============================================================================
// Consumer-Facing WorkflowRuntime Interface (Promise-based)
// ============================================================================

/**
 * Consumer-facing WorkflowRuntime interface with Promise-based methods.
 * This is what the public API exposes - no Effect types.
 */
export interface PublicWorkflowRuntime {
	/**
	 * Run the workflow event loop.
	 *
	 * @param options - Runtime options
	 * @returns Promise with runtime result
	 * @throws WorkflowRuntimeError if execution fails
	 */
	run<S>(options: RuntimeRunOptions<S>): Promise<RuntimeResult<S>>;

	/**
	 * Process a single event through the handler system.
	 *
	 * @param event - The event to process
	 * @param state - Current state
	 * @param handlers - Map of event name to handler
	 * @returns Promise with new state and emitted events
	 */
	processEvent<S>(
		event: AnyEvent,
		state: S,
		handlers: ReadonlyMap<string, HandlerDefinition<AnyEvent, S>>,
	): Promise<{ state: S; events: readonly AnyEvent[] }>;
}
