/**
 * Workflow - Public API for Effect-Powered Event-Sourced Workflows
 *
 * The Workflow class is the top-level consumer-facing API that hides all
 * Effect complexity behind a clean Promise-based interface.
 *
 * @module @core-v2/workflow
 */

import { Effect, Layer, ManagedRuntime, Stream } from "effect";
import type { Agent } from "../agent/Agent.js";
import type { AnyEvent } from "../event/Event.js";
import { createEvent } from "../event/Event.js";
import { type EventBus, EventBusLive } from "../event/EventBus.js";
import type { HandlerDefinition } from "../handler/Handler.js";
import { LLMProvider, type LLMProviderService, type ProviderInfo } from "../provider/Provider.js";
import type { Renderer } from "../renderer/Renderer.js";
import type { SessionId, StoreService } from "../store/Store.js";
import { Store } from "../store/Store.js";
import { createTapeFromDefinitions, type Tape } from "../tape/Tape.js";
import { type RuntimeResult, WorkflowRuntime, WorkflowRuntimeError, WorkflowRuntimeLive } from "./WorkflowRuntime.js";

// ============================================================================
// Workflow Callbacks
// ============================================================================

/**
 * Callbacks for workflow execution.
 * Called synchronously during event processing.
 */
export interface WorkflowCallbacks<S = unknown> {
	/** Called when an event is emitted */
	readonly onEvent?: (event: AnyEvent) => void;
	/** Called when state changes */
	readonly onStateChange?: (state: S) => void;
	/** Called on error (non-fatal errors during processing) */
	readonly onError?: (error: Error) => void;
}

// ============================================================================
// Run Options
// ============================================================================

/**
 * Options for running a workflow.
 */
export interface RunOptions<S = unknown> {
	/** User input text to start the workflow */
	readonly input: string;
	/** Whether to record this session (default: false) */
	readonly record?: boolean;
	/** Session ID (auto-generated if not provided when recording) */
	readonly sessionId?: SessionId;
	/** Callbacks for events and state changes */
	readonly callbacks?: WorkflowCallbacks<S>;
	/** Abort signal for cancellation */
	readonly abortSignal?: AbortSignal;
}

// ============================================================================
// Workflow Result
// ============================================================================

/**
 * Result of running a workflow.
 *
 * @typeParam S - The workflow state type
 */
export interface WorkflowResult<S> {
	/** Final state after workflow completion */
	readonly state: S;
	/** All events emitted during execution (in order) */
	readonly events: readonly AnyEvent[];
	/** Session ID (useful if auto-generated) */
	readonly sessionId: SessionId;
	/** Tape for time-travel debugging */
	readonly tape: Tape<S>;
	/** Whether workflow was terminated via until condition */
	readonly terminated: boolean;
}

// ============================================================================
// Workflow Definition
// ============================================================================

/**
 * Workflow definition - configuration for creating a workflow.
 *
 * @typeParam S - The workflow state type
 *
 * @example
 * ```typescript
 * const definition: WorkflowDefinition<ChatState> = {
 *   name: "chat",
 *   initialState: { messages: [], terminated: false },
 *   handlers: [userInputHandler, agentResponseHandler],
 *   agents: [chatAgent],
 *   until: (state) => state.terminated,
 * };
 *
 * const workflow = createWorkflow(definition);
 * ```
 */
export interface WorkflowDefinition<S> {
	/** Unique workflow name */
	readonly name: string;
	/** Initial state for new sessions */
	readonly initialState: S;
	/** Handlers that react to events */
	readonly handlers: readonly HandlerDefinition<AnyEvent, S>[];
	/** AI agents that produce events */
	readonly agents: readonly Agent<S, unknown>[];
	/** Renderers that observe events (executed in parallel, FR-004) */
	readonly renderers?: readonly Renderer<S, unknown>[];
	/** Termination condition - returns true when workflow should stop */
	readonly until: (state: S) => boolean;
	/** Optional store for persistence */
	readonly store?: StoreService;
	/** Default model for agents */
	readonly model?: string;
}

// ============================================================================
// Workflow Interface
// ============================================================================

/**
 * Workflow interface - the runtime workflow instance.
 *
 * @typeParam S - The workflow state type
 *
 * @remarks
 * The Workflow is created from a WorkflowDefinition and provides:
 * - `run()`: Execute the workflow with input
 * - `load()`: Load a recorded session as a Tape
 * - `dispose()`: Clean up resources
 *
 * No Effect types are exposed - all methods return Promises.
 *
 * @example
 * ```typescript
 * const workflow = createWorkflow({
 *   name: "chat",
 *   initialState: { messages: [] },
 *   handlers: [handleUserInput, handleAgentResponse],
 *   agents: [chatAgent],
 *   until: (state) => state.terminated,
 * });
 *
 * // Run the workflow
 * const result = await workflow.run({
 *   input: "Hello!",
 *   record: true,
 * });
 *
 * // Load a recorded session
 * const tape = await workflow.load(result.sessionId);
 *
 * // Time-travel debug
 * const t1 = tape.stepBack();
 * console.log(t1.state);
 *
 * // Cleanup
 * await workflow.dispose();
 * ```
 */
export interface Workflow<S = unknown> {
	/** Workflow name */
	readonly name: string;

	/**
	 * Run the workflow with the given input.
	 *
	 * @param options - Run options including input, recording settings
	 * @returns Promise resolving to the workflow result
	 * @throws Error if execution fails
	 */
	run(options: RunOptions<S>): Promise<WorkflowResult<S>>;

	/**
	 * Load a recorded session as a Tape.
	 *
	 * @param sessionId - The session to load
	 * @returns Promise resolving to a Tape for the session
	 * @throws Error if session not found or store unavailable
	 */
	load(sessionId: SessionId): Promise<Tape<S>>;

	/**
	 * Dispose of the workflow and release resources.
	 *
	 * @remarks
	 * Should be called when the workflow is no longer needed.
	 * Cleans up Effect runtime, connections, etc.
	 */
	dispose(): Promise<void>;
}

// ============================================================================
// Workflow Implementation
// ============================================================================

/**
 * Internal Workflow implementation class.
 * Manages the Effect ManagedRuntime lifecycle.
 */
class WorkflowImpl<S> implements Workflow<S> {
	readonly name: string;
	private readonly _definition: WorkflowDefinition<S>;
	private readonly _runtime: ManagedRuntime.ManagedRuntime<WorkflowRuntime | Store | LLMProvider | EventBus, never>;

	constructor(definition: WorkflowDefinition<S>) {
		this._definition = definition;
		this.name = definition.name;

		// Build the Layer composition
		// Dependencies: Store, LLMProvider, EventBus
		// Then: WorkflowRuntime (depends on all three)
		const storeLayer = definition.store
			? Layer.succeed(Store, definition.store)
			: Layer.succeed(Store, createNoopStore());

		const providerLayer = Layer.succeed(LLMProvider, createNoopProvider());

		// Compose dependencies
		const dependencies = Layer.mergeAll(storeLayer, providerLayer, EventBusLive);

		// WorkflowRuntimeLive needs its dependencies provided
		const runtimeWithDeps = WorkflowRuntimeLive.pipe(Layer.provide(dependencies));

		// Merge to get all services
		const fullLayer = Layer.merge(runtimeWithDeps, dependencies);

		// Create ManagedRuntime
		this._runtime = ManagedRuntime.make(fullLayer);
	}

	async run(options: RunOptions<S>): Promise<WorkflowResult<S>> {
		const { input, record = false, sessionId, callbacks, abortSignal } = options;

		// Create initial user:input event
		const initialEvent = createEvent("user:input", { text: input });

		// Build the Effect program
		const program = Effect.gen(
			function* (this: WorkflowImpl<S>) {
				const runtime = yield* WorkflowRuntime;

				const result: RuntimeResult<S> = yield* runtime.run({
					initialEvent,
					initialState: this._definition.initialState,
					handlers: this._definition.handlers,
					agents: this._definition.agents,
					renderers: this._definition.renderers,
					until: this._definition.until,
					record,
					sessionId,
					callbacks,
					abortSignal,
					model: this._definition.model,
				});

				return result;
			}.bind(this),
		);

		// Run via ManagedRuntime (converts Effect to Promise)
		const result = await this._runtime.runPromise(program);

		// Build Tape from result
		const tape = createTapeFromDefinitions(result.events, this._definition.handlers, this._definition.initialState);

		return {
			state: result.state,
			events: result.events,
			sessionId: result.sessionId,
			tape,
			terminated: result.terminated,
		};
	}

	async load(sessionId: SessionId): Promise<Tape<S>> {
		// Build the Effect program to load events from store
		const program = Effect.gen(
			function* (this: WorkflowImpl<S>) {
				const store = yield* Store;
				const events = yield* store.events(sessionId);

				if (events.length === 0) {
					return yield* Effect.fail(
						new WorkflowRuntimeError("STORE_UNAVAILABLE", `Session "${sessionId}" not found or has no events`),
					);
				}

				return events;
			}.bind(this),
		);

		// Run via ManagedRuntime
		const events = await this._runtime.runPromise(program);

		// Build Tape from loaded events
		return createTapeFromDefinitions(events, this._definition.handlers, this._definition.initialState);
	}

	async dispose(): Promise<void> {
		// Dispose the ManagedRuntime
		await this._runtime.dispose();
	}
}

// ============================================================================
// Noop Services (for when Store/Provider not provided)
// ============================================================================

/**
 * Creates a no-op Store service (fails on all operations).
 * Used when no store is provided in the workflow definition.
 */
function createNoopStore(): StoreService {
	const notConfigured = Effect.fail({
		_tag: "StoreError" as const,
		code: "NOT_FOUND" as const,
		message: "Store not configured for this workflow",
	});

	return {
		append: () => notConfigured as never,
		events: () => notConfigured as never,
		sessions: () => notConfigured as never,
		clear: () => notConfigured as never,
		snapshot: () => notConfigured as never,
	};
}

/**
 * Creates a no-op LLMProvider service (fails on all operations).
 * This is a placeholder - real provider should be injected via layer composition.
 */
function createNoopProvider(): LLMProviderService {
	return {
		query: () =>
			Effect.fail({
				_tag: "ProviderError" as const,
				code: "PROVIDER_ERROR" as const,
				message: "LLM provider not configured",
				retryable: false,
			}) as never,
		stream: () =>
			Stream.fail({
				_tag: "ProviderError" as const,
				code: "PROVIDER_ERROR" as const,
				message: "LLM provider not configured",
				retryable: false,
			}) as never,
		info: () =>
			Effect.succeed({
				type: "custom",
				name: "noop",
				model: "none",
				connected: false,
			} as ProviderInfo),
	};
}

// ============================================================================
// Workflow Factory
// ============================================================================

/**
 * Creates a new Workflow from a definition.
 *
 * @typeParam S - The workflow state type
 * @param definition - The workflow definition
 * @returns A new Workflow instance
 *
 * @remarks
 * This factory creates a Workflow that:
 * - Manages an Effect ManagedRuntime internally
 * - Exposes only Promise-based methods (no Effect types leak)
 * - Provides `run()`, `load()`, and `dispose()` methods
 *
 * Remember to call `dispose()` when done to clean up resources.
 *
 * @example
 * ```typescript
 * const workflow = createWorkflow({
 *   name: "chat",
 *   initialState: { messages: [] },
 *   handlers: [userInputHandler],
 *   agents: [chatAgent],
 *   until: (state) => state.terminated,
 * });
 *
 * try {
 *   const result = await workflow.run({ input: "Hello!" });
 *   console.log(result.state);
 * } finally {
 *   await workflow.dispose();
 * }
 * ```
 */
export function createWorkflow<S>(definition: WorkflowDefinition<S>): Workflow<S> {
	return new WorkflowImpl(definition);
}

// ============================================================================
// Server Integration Types
// ============================================================================

/**
 * Server-side workflow handler for HTTP endpoints.
 *
 * @remarks
 * Created with `createWorkflowHandler(options)` for server integration.
 * Uses Server-Sent Events (SSE) for streaming workflow events to the client.
 *
 * @example
 * ```typescript
 * const handler = createWorkflowHandler({
 *   workflow,
 *   cors: { origin: "http://localhost:3000" },
 * });
 *
 * // With Hono
 * app.post("/api/workflow", (c) => handler.handle(c.req.raw));
 *
 * // With raw Node.js/Bun
 * const response = await handler.handle(request);
 * ```
 */
export interface WorkflowHandler {
	/**
	 * Handle an HTTP request.
	 *
	 * @param request - The incoming HTTP request (standard Fetch API Request)
	 * @returns Response with SSE stream for events
	 */
	handle(request: Request): Promise<Response>;
}

/**
 * CORS configuration options.
 */
export interface CorsOptions {
	/** Allowed origin(s) */
	readonly origin?: string | readonly string[];
	/** Allowed HTTP methods */
	readonly methods?: readonly string[];
}

/**
 * Options for creating a workflow handler.
 */
export interface CreateWorkflowHandlerOptions<S = unknown> {
	/** The workflow to handle */
	readonly workflow: Workflow<S>;
	/** CORS settings */
	readonly cors?: CorsOptions;
	/** Whether to record sessions by default (default: false) */
	readonly record?: boolean;
}

/**
 * Request body format for workflow handler.
 */
interface WorkflowRequestBody {
	/** User input text */
	input: string;
	/** Optional session ID for recording */
	sessionId?: string;
	/** Whether to record this session */
	record?: boolean;
}

/**
 * SSE event data format.
 */
interface SSEEventData {
	/** Event type: "event", "state", "done", "error" */
	type: "event" | "state" | "done" | "error";
	/** Event payload */
	data: unknown;
}

// ============================================================================
// Server Handler Implementation
// ============================================================================

/**
 * Creates an HTTP handler for server-side workflow execution.
 *
 * @typeParam S - The workflow state type
 * @param options - Handler configuration including workflow and CORS settings
 * @returns A WorkflowHandler that can process HTTP requests
 *
 * @remarks
 * The handler:
 * - Accepts POST requests with JSON body `{ input: string, sessionId?: string, record?: boolean }`
 * - Returns Server-Sent Events (SSE) stream with events, state changes, and completion
 * - Handles CORS if configured
 * - Supports preflight OPTIONS requests
 *
 * SSE events are formatted as:
 * ```
 * data: { "type": "event", "data": {...} }
 *
 * data: { "type": "state", "data": {...} }
 *
 * data: { "type": "done", "data": { "sessionId": "...", "terminated": true } }
 * ```
 *
 * @example
 * ```typescript
 * import { createWorkflow, createWorkflowHandler } from "@open-harness/core-v2";
 *
 * const workflow = createWorkflow({
 *   name: "chat",
 *   initialState: { messages: [] },
 *   handlers: [...],
 *   agents: [...],
 *   until: (state) => state.done,
 * });
 *
 * const handler = createWorkflowHandler({
 *   workflow,
 *   cors: { origin: "http://localhost:3000" },
 * });
 *
 * // Use with any framework
 * const response = await handler.handle(request);
 * ```
 */
export function createWorkflowHandler<S>(options: CreateWorkflowHandlerOptions<S>): WorkflowHandler {
	const { workflow, cors, record: defaultRecord = false } = options;

	/**
	 * Build CORS headers based on configuration.
	 */
	function buildCorsHeaders(requestOrigin: string | null): Record<string, string> {
		const headers: Record<string, string> = {};

		if (!cors) {
			return headers;
		}

		// Handle origin
		if (cors.origin) {
			const allowedOrigins = Array.isArray(cors.origin) ? cors.origin : [cors.origin];
			if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
				headers["Access-Control-Allow-Origin"] = requestOrigin;
			} else if (allowedOrigins.includes("*")) {
				headers["Access-Control-Allow-Origin"] = "*";
			}
		}

		// Handle methods
		const methods = cors.methods ?? ["POST", "OPTIONS"];
		headers["Access-Control-Allow-Methods"] = methods.join(", ");
		headers["Access-Control-Allow-Headers"] = "Content-Type";
		headers["Access-Control-Max-Age"] = "86400"; // 24 hours

		return headers;
	}

	/**
	 * Format an SSE event for transmission.
	 */
	function formatSSEEvent(data: SSEEventData): string {
		return `data: ${JSON.stringify(data)}\n\n`;
	}

	return {
		async handle(request: Request): Promise<Response> {
			const requestOrigin = request.headers.get("Origin");
			const corsHeaders = buildCorsHeaders(requestOrigin);

			// Handle CORS preflight
			if (request.method === "OPTIONS") {
				return new Response(null, {
					status: 204,
					headers: corsHeaders,
				});
			}

			// Only accept POST
			if (request.method !== "POST") {
				return new Response(JSON.stringify({ error: "Method not allowed" }), {
					status: 405,
					headers: {
						...corsHeaders,
						"Content-Type": "application/json",
					},
				});
			}

			// Parse request body
			let body: WorkflowRequestBody;
			try {
				body = (await request.json()) as WorkflowRequestBody;
			} catch {
				return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
					status: 400,
					headers: {
						...corsHeaders,
						"Content-Type": "application/json",
					},
				});
			}

			// Validate input
			if (!body.input || typeof body.input !== "string") {
				return new Response(JSON.stringify({ error: "Missing or invalid 'input' field" }), {
					status: 400,
					headers: {
						...corsHeaders,
						"Content-Type": "application/json",
					},
				});
			}

			// Create SSE stream
			const stream = new ReadableStream({
				async start(controller) {
					const encoder = new TextEncoder();

					try {
						// Run the workflow with callbacks that stream events
						const result = await workflow.run({
							input: body.input,
							record: body.record ?? defaultRecord,
							sessionId: body.sessionId as SessionId | undefined,
							callbacks: {
								onEvent: (event) => {
									const sseData: SSEEventData = { type: "event", data: event };
									controller.enqueue(encoder.encode(formatSSEEvent(sseData)));
								},
								onStateChange: (state) => {
									const sseData: SSEEventData = { type: "state", data: state };
									controller.enqueue(encoder.encode(formatSSEEvent(sseData)));
								},
								onError: (error) => {
									const sseData: SSEEventData = {
										type: "error",
										data: { message: error.message, name: error.name },
									};
									controller.enqueue(encoder.encode(formatSSEEvent(sseData)));
								},
							},
						});

						// Send completion event
						const doneData: SSEEventData = {
							type: "done",
							data: {
								sessionId: result.sessionId,
								terminated: result.terminated,
								finalState: result.state,
							},
						};
						controller.enqueue(encoder.encode(formatSSEEvent(doneData)));
						controller.close();
					} catch (error) {
						// Send error event
						const errorData: SSEEventData = {
							type: "error",
							data: {
								message: error instanceof Error ? error.message : "Unknown error",
								name: error instanceof Error ? error.name : "Error",
							},
						};
						controller.enqueue(encoder.encode(formatSSEEvent(errorData)));
						controller.close();
					}
				},
			});

			// Return SSE response
			return new Response(stream, {
				status: 200,
				headers: {
					...corsHeaders,
					"Content-Type": "text/event-stream",
					"Cache-Control": "no-cache",
					Connection: "keep-alive",
				},
			});
		},
	};
}
