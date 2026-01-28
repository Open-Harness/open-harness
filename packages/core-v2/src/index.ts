/**
 * @open-harness/core-v2 Public API
 *
 * This module exports the consumer-facing API for the Effect-based workflow system.
 * All Effect internals (Context, Effect, Layer, Stream, Exit, Cause, Fiber) are hidden
 * behind clean Promise-based interfaces.
 *
 * @example
 * ```typescript
 * import {
 *   createWorkflow,
 *   defineEvent,
 *   defineHandler,
 *   agent,
 *   createMemoryStore,
 *   stateOnly,
 * } from "@open-harness/core-v2";
 *
 * // Define event types (TypeScript generics, no runtime schema needed)
 * interface TaskPayload {
 *   id: string;
 *   title: string;
 * }
 * const TaskCreated = defineEvent<"task:created", TaskPayload>("task:created");
 *
 * // Define handlers
 * const taskHandler = defineHandler(TaskCreated, {
 *   name: "task-handler",
 *   handler: (event, state) => stateOnly({
 *     ...state,
 *     tasks: [...state.tasks, event.payload],
 *   }),
 * });
 *
 * // Create workflow
 * const workflow = createWorkflow({
 *   name: "task-manager",
 *   initialState: { tasks: [] as TaskPayload[] },
 *   handlers: [taskHandler],
 *   agents: [],
 *   until: (state) => state.tasks.length >= 10,
 * });
 *
 * // Run workflow
 * const result = await workflow.run({ input: "Create a task" });
 * console.log(result.state); // { tasks: [...] }
 * ```
 *
 * @module @open-harness/core-v2
 */

// =============================================================================
// EVENT MODULE
// =============================================================================

/**
 * Event types and factories for defining typed, immutable events.
 *
 * @example
 * ```typescript
 * import { defineEvent, createEvent } from "@open-harness/core-v2";
 *
 * // Type-safe event definition using TypeScript generics
 * // NOTE: No Zod schema needed - payload type is compile-time only
 * interface UserLoggedInPayload {
 *   userId: string;
 *   timestamp: Date;
 * }
 * const UserLoggedIn = defineEvent<"user:logged-in", UserLoggedInPayload>("user:logged-in");
 *
 * // Create events with auto-generated ID and timestamp
 * const event = UserLoggedIn.create({ userId: "123", timestamp: new Date() });
 *
 * // Type guard
 * if (UserLoggedIn.is(event)) {
 *   console.log(event.payload.userId); // Type-safe access
 * }
 *
 * // Low-level event creation (for dynamic scenarios)
 * const rawEvent = createEvent("custom:event", { data: "hello" });
 * ```
 */
// EventBus types (for advanced usage)
export type {
	AgentCompletedEvent,
	AgentStartedEvent,
	AnyEvent,
	ErrorOccurredEvent,
	Event,
	EventDefinition,
	EventFilter,
	EventId,
	EventPayload,
	PublicEventBus,
	SubscriptionId,
	TextCompleteEvent,
	TextDeltaEvent,
	ToolCalledEvent,
	ToolResultEvent,
	UserInputEvent,
} from "./event/index.js";
export {
	createEvent,
	createMultiPatternFilter,
	createPatternFilter,
	defineEvent,
	EventBusError,
	generateSubscriptionId,
	makeSubscriptionId,
} from "./event/index.js";

// =============================================================================
// HANDLER MODULE
// =============================================================================

/**
 * Handler types and factories for creating pure event handlers.
 *
 * Handlers are pure functions that:
 * - Receive an event and current state
 * - Return new state and zero or more events to emit
 * - Must be deterministic (same inputs → same outputs)
 * - Must NOT perform I/O or side effects
 *
 * @example
 * ```typescript
 * import { defineHandler, stateOnly, emit } from "@open-harness/core-v2";
 *
 * // Handler that updates state without emitting events
 * const countHandler = defineHandler(IncrementEvent, {
 *   handler: (event, state) => stateOnly({ ...state, count: state.count + 1 }),
 * });
 *
 * // Handler that emits events
 * const completionHandler = defineHandler(TaskDone, {
 *   handler: (event, state) => emit(
 *     { ...state, completed: true },
 *     [{ name: "workflow:complete", payload: {} }]
 *   ),
 * });
 * ```
 */
// HandlerRegistry types (for advanced usage)
export type {
	DefineHandlerOptions,
	Handler,
	HandlerDefinition,
	HandlerRegistryErrorCode,
	HandlerResult,
	PublicHandlerRegistry,
} from "./handler/index.js";
export { defineHandler, emit, emitEvent, HandlerRegistryError, stateOnly } from "./handler/index.js";

// =============================================================================
// AGENT MODULE
// =============================================================================

/**
 * Agent types and factories for defining LLM-powered agents.
 *
 * Agents:
 * - Activate on specific event types
 * - Use state to generate prompts
 * - MUST provide an outputSchema for structured output
 * - Transform LLM output into events via onOutput
 *
 * @example
 * ```typescript
 * import { agent } from "@open-harness/core-v2";
 * import { z } from "zod";
 *
 * const planner = agent({
 *   name: "planner",
 *   activatesOn: ["workflow:start"],
 *   emits: ["plan:created"],
 *
 *   // REQUIRED: Structured output schema
 *   outputSchema: z.object({
 *     tasks: z.array(z.object({
 *       id: z.string(),
 *       title: z.string(),
 *     })),
 *   }),
 *
 *   prompt: (state, event) => `Create a plan for: ${state.goal}`,
 *
 *   // Optional guard condition
 *   when: (state) => !state.hasPlan,
 *
 *   // Transform output to events
 *   onOutput: (output, event) => [{
 *     name: "plan:created",
 *     payload: { tasks: output.tasks },
 *     causedBy: event.id,
 *   }],
 * });
 * ```
 */
// AgentRegistry types (for advanced usage)
export type {
	Agent,
	AgentOptions,
	AgentRegistry,
	AgentRegistryErrorCode,
	PromptPart,
	PromptTemplate,
	PublicAgentRegistry,
} from "./agent/index.js";
export {
	AgentRegistryError,
	agent,
	createAgentRegistry,
	findMatchingAgents,
	MissingOutputSchemaError,
	shouldActivate,
} from "./agent/index.js";

// =============================================================================
// WORKFLOW MODULE
// =============================================================================

/**
 * Workflow types and factories for creating and running workflows.
 *
 * A workflow combines:
 * - Initial state
 * - Event handlers
 * - Agents (optional)
 * - Termination condition
 *
 * All public methods return Promises (Effect internals are hidden).
 *
 * @example
 * ```typescript
 * import { createWorkflow } from "@open-harness/core-v2";
 *
 * const workflow = createWorkflow({
 *   name: "my-workflow",
 *   initialState: { count: 0, messages: [] },
 *   handlers: [messageHandler, countHandler],
 *   agents: [chatAgent],
 *   until: (state) => state.count >= 100,
 * });
 *
 * // Run workflow
 * const result = await workflow.run({
 *   input: "Hello, world!",
 *   record: true, // Enable recording for replay
 * });
 *
 * // Time-travel debugging with returned Tape
 * const tape = result.tape;
 * tape.stepBack(); // Go back one event
 * console.log(tape.state); // State at previous position
 *
 * // Load recorded session for replay
 * const replayTape = await workflow.load(result.sessionId);
 *
 * // Cleanup
 * await workflow.dispose();
 * ```
 */
// WorkflowRuntime types (for advanced usage)
export type {
	CorsOptions,
	CreateWorkflowHandlerOptions,
	PublicWorkflowRuntime,
	RunOptions,
	RuntimeCallbacks,
	RuntimeResult,
	RuntimeRunOptions,
	Workflow,
	WorkflowCallbacks,
	WorkflowDefinition,
	// Server Integration (FR-059)
	WorkflowHandler,
	WorkflowResult,
	WorkflowRuntimeErrorCode,
} from "./workflow/index.js";
export { createWorkflow, createWorkflowHandler, WorkflowRuntimeError } from "./workflow/index.js";

// =============================================================================
// TAPE MODULE
// =============================================================================

/**
 * Tape types and factories for time-travel debugging.
 *
 * Tape provides VCR-like controls for workflow sessions:
 * - step() / stepBack() - Move forward/backward one event
 * - stepTo(n) - Jump to any position
 * - play() / pause() - Automated playback
 * - stateAt(n) - Inspect state at any position without moving
 *
 * @example
 * ```typescript
 * import { createTape } from "@open-harness/core-v2";
 *
 * // Create tape from recorded events
 * const tape = createTape({
 *   events: recordedEvents,
 *   handlers: handlerMap,
 *   initialState: { count: 0 },
 * });
 *
 * // Navigate through history
 * console.log(tape.position); // 0
 * const t1 = tape.step(); // Move forward
 * console.log(t1.position); // 1
 * const t0 = t1.stepBack(); // THE KEY FEATURE - go back
 * console.log(t0.position); // 0
 *
 * // Jump to any position
 * const t5 = tape.stepTo(5);
 * console.log(t5.state); // State after 5 events
 *
 * // Inspect without moving
 * console.log(tape.stateAt(10)); // State at position 10
 * console.log(tape.position); // Still at current position
 * ```
 */
export type {
	ComputeStateOptions,
	OnUnknownEventCallback,
	Tape,
	TapeConfig,
	TapeControls,
	TapeMetadata,
	TapeStatus,
	UnknownEventWarning,
} from "./tape/index.js";

export { computeState, createTape, createTapeFromDefinitions } from "./tape/index.js";

// =============================================================================
// STORE MODULE
// =============================================================================

/**
 * Store types and factories for event persistence.
 *
 * Stores persist events for recording and replay:
 * - MemoryStore: In-memory storage (testing, ephemeral sessions)
 * - SqliteStore: Persistent storage (production, long-term recording)
 *
 * @example
 * ```typescript
 * import { createMemoryStore, createSqliteStore } from "@open-harness/core-v2";
 *
 * // In-memory store for testing
 * const memStore = createMemoryStore();
 *
 * // SQLite store for production
 * const sqlStore = createSqliteStore({ path: "./sessions.db" });
 *
 * // Use with workflow
 * const workflow = createWorkflow({
 *   name: "recorded-workflow",
 *   initialState: {},
 *   handlers: [],
 *   agents: [],
 *   until: () => false,
 *   store: memStore, // Enable recording
 * });
 * ```
 */
export type {
	PublicStore,
	SessionId,
	SessionMetadata,
	SqliteStoreConfig,
	StateSnapshot,
	StoreErrorCode,
} from "./store/index.js";
// Store implementations (Promise-based public API)
export {
	createMemoryStore,
	createSqliteStore,
	generateSessionId,
	makeSessionId,
	StoreError,
} from "./store/index.js";
// Effect-based exports kept internal (MemoryStoreLive, SqliteStoreMemoryLive, makeSqliteStoreLive)
// These are Layer types which expose Effect internals - use createMemoryStore/createSqliteStore instead

// =============================================================================
// PROVIDER MODULE
// =============================================================================

/**
 * LLM Provider types for agent execution.
 *
 * Providers abstract LLM communication:
 * - ClaudeProvider: Anthropic Claude SDK integration
 * - Custom providers: Implement LLMProviderService interface
 *
 * @example
 * ```typescript
 * import type { QueryOptions, QueryResult } from "@open-harness/core-v2";
 *
 * // Provider is typically injected automatically via workflow
 * // For custom providers, implement the PublicLLMProvider interface
 * ```
 */
export type {
	ClaudeProviderConfig,
	LLMProviderService,
	ProviderErrorCode,
	ProviderInfo,
	ProviderMessage,
	ProviderType,
	PublicLLMProvider,
	QueryOptions,
	QueryResult,
	StreamChunk,
} from "./provider/index.js";

export { makeClaudeProviderService, ProviderError } from "./provider/index.js";

// =============================================================================
// RENDERER MODULE
// =============================================================================

/**
 * Renderer types and factories for event output.
 *
 * Renderers are pure observers that transform events for display:
 * - Cannot modify events or state
 * - Cannot emit new events
 * - Support pattern matching (e.g., "error:*" matches all error events)
 *
 * @example
 * ```typescript
 * import { createRenderer } from "@open-harness/core-v2";
 *
 * // Create a terminal renderer
 * const terminalRenderer = createRenderer({
 *   name: "terminal",
 *   renderers: {
 *     "text:delta": (event, state) => {
 *       process.stdout.write(event.payload.delta);
 *     },
 *     "error:*": (event, state) => {
 *       console.error(`Error: ${event.payload.message}`);
 *     },
 *     "*": (event, state) => {
 *       // Catch-all for debugging
 *       console.debug(`[${event.name}]`, event.payload);
 *     },
 *   },
 * });
 *
 * // Use with workflow
 * const workflow = createWorkflow({
 *   name: "rendered-workflow",
 *   initialState: {},
 *   handlers: [],
 *   agents: [],
 *   until: () => false,
 *   renderers: [terminalRenderer],
 * });
 * ```
 */
export type {
	CreateRendererOptions,
	EventPattern,
	MultiRenderer,
	Renderer,
	RendererRegistry,
	RenderFunction,
} from "./renderer/index.js";

export {
	createRenderer,
	createRendererRegistry,
	findMatchingPatterns,
	matchesAnyPattern,
	matchesPattern,
	renderEvent,
	renderEventAsync,
} from "./renderer/index.js";

// =============================================================================
// MESSAGE MODULE
// =============================================================================

/**
 * Message types and projection utilities for AI SDK compatibility.
 *
 * Messages are projected from Events for React integration. The projection
 * accumulates streaming events (text:delta) into complete messages.
 *
 * @example
 * ```typescript
 * import { projectEventsToMessages, type Message } from "@open-harness/core-v2";
 *
 * // Project events into messages
 * const messages = projectEventsToMessages(events);
 *
 * // Use in React component
 * messages.forEach(msg => {
 *   console.log(`${msg.role}: ${msg.content}`);
 * });
 * ```
 */
export type {
	Message,
	MessageRole,
	ProjectionOptions,
	ToolInvocation,
	ToolInvocationState,
} from "./message/index.js";

export { generateMessageId, projectEventsToMessages, resetMessageIdCounter } from "./message/index.js";
