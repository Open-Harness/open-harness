/**
 * @open-harness/core-v2 Public API (Browser-Safe)
 *
 * This module exports the consumer-facing API for the Effect-based workflow system.
 * All Effect internals (Context, Effect, Layer, Stream, Exit, Cause, Fiber) are hidden
 * behind clean Promise-based interfaces.
 *
 * This is the browser-safe version that excludes SqliteStore (which requires Node.js
 * native modules). For server-side code that needs SqliteStore, import from the
 * main entry point or use the /server subpath.
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
	WorkflowHandler,
	WorkflowResult,
	WorkflowRuntimeErrorCode,
} from "./workflow/index.js";
export { createWorkflow, createWorkflowHandler, WorkflowRuntimeError } from "./workflow/index.js";

// =============================================================================
// TAPE MODULE
// =============================================================================

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
// STORE MODULE (Browser-Safe - NO SqliteStore)
// =============================================================================

/**
 * Store types and factories for event persistence.
 *
 * NOTE: This browser-safe export only includes MemoryStore.
 * For SqliteStore, import from "@open-harness/core-v2" in a Node.js environment.
 */
export type {
	PublicStore,
	SessionId,
	SessionMetadata,
	SqliteStoreConfig,
	StateSnapshot,
	StoreErrorCode,
} from "./store/index.browser.js";
export {
	createMemoryStore,
	generateSessionId,
	makeSessionId,
	StoreError,
} from "./store/index.browser.js";
// NOTE: createSqliteStore is NOT exported here - it requires Node.js native modules

// =============================================================================
// PROVIDER MODULE
// =============================================================================

export type {
	ClaudeProviderConfig,
	ProviderErrorCode,
	ProviderInfo,
	ProviderMessage,
	ProviderType,
	PublicLLMProvider,
	QueryOptions,
	QueryResult,
	StreamChunk,
} from "./provider/index.js";

export { ProviderError } from "./provider/index.js";

// =============================================================================
// RENDERER MODULE
// =============================================================================

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
