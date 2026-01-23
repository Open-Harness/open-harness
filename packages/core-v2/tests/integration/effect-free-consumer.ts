/**
 * Effect-Free Consumer Verification Test
 *
 * This file imports ONLY from @open-harness/core-v2 and uses all public exports.
 * It is compiled with a separate tsconfig that EXCLUDES the 'effect' package.
 *
 * If this file compiles successfully with `tsc --noEmit`, it proves that:
 * 1. No Effect types (Context, Effect, Layer, Stream, Exit, Cause, Fiber) are exposed
 * 2. All public types are plain TypeScript types
 * 3. Consumers can use the API without Effect knowledge or dependencies
 *
 * Per spec FR-062: "Public API exposes ZERO Effect types"
 */

// =============================================================================
// IMPORTS - All from @open-harness/core-v2 public API
// =============================================================================

// biome-ignore lint/correctness/noUnusedImports: Some imports are used only for type verification at end of file
import {
	// Agent module
	type Agent,
	type AgentCompletedEvent,
	type AgentOptions,
	type AgentRegistry,
	AgentRegistryError,
	type AgentRegistryErrorCode,
	type AgentStartedEvent,
	type AnyEvent,
	agent,
	type ClaudeProviderConfig,
	type ComputeStateOptions,
	type CorsOptions,
	type CreateRendererOptions,
	type CreateWorkflowHandlerOptions,
	computeState,
	createAgentRegistry,
	createEvent,
	createMemoryStore,
	createMultiPatternFilter,
	createPatternFilter,
	createRenderer,
	createRendererRegistry,
	createSqliteStore,
	createTape,
	createTapeFromDefinitions,
	createWorkflow,
	createWorkflowHandler,
	type DefineHandlerOptions,
	defineEvent,
	defineHandler,
	type ErrorOccurredEvent,
	// Event module
	type Event,
	EventBusError,
	type EventDefinition,
	type EventFilter,
	type EventId,
	// Renderer module
	type EventPattern,
	type EventPayload,
	emit,
	emitEvent,
	findMatchingAgents,
	findMatchingPatterns,
	generateSessionId,
	generateSubscriptionId,
	// Handler module
	type Handler,
	type HandlerDefinition,
	HandlerRegistryError,
	type HandlerRegistryErrorCode,
	type HandlerResult,
	MissingOutputSchemaError,
	type MultiRenderer,
	makeSessionId,
	makeSubscriptionId,
	matchesAnyPattern,
	matchesPattern,
	type OnUnknownEventCallback,
	type PromptPart,
	type PromptTemplate,
	ProviderError,
	// Provider module
	type ProviderErrorCode,
	type ProviderInfo,
	type ProviderMessage,
	type ProviderType,
	type PublicAgentRegistry,
	type PublicEventBus,
	type PublicHandlerRegistry,
	type PublicLLMProvider,
	type PublicStore,
	type PublicWorkflowRuntime,
	type QueryOptions,
	type QueryResult,
	type Renderer,
	type RendererRegistry,
	type RenderFunction,
	type RunOptions,
	type RuntimeCallbacks,
	type RuntimeResult,
	type RuntimeRunOptions,
	renderEvent,
	renderEventAsync,
	// Store module
	type SessionId,
	type SessionMetadata,
	type SqliteStoreConfig,
	type StateSnapshot,
	StoreError,
	type StoreErrorCode,
	type StreamChunk,
	type SubscriptionId,
	shouldActivate,
	stateOnly,
	// Tape module
	type Tape,
	type TapeConfig,
	type TapeControls,
	type TapeMetadata,
	type TapeStatus,
	type TextCompleteEvent,
	type TextDeltaEvent,
	type ToolCalledEvent,
	type ToolResultEvent,
	type UnknownEventWarning,
	type UserInputEvent,
	// Workflow module
	type Workflow,
	type WorkflowCallbacks,
	type WorkflowDefinition,
	type WorkflowHandler,
	type WorkflowResult,
	WorkflowRuntimeError,
	type WorkflowRuntimeErrorCode,
} from "../../src/index.js";

// =============================================================================
// TYPE VERIFICATION - Ensure types are plain TypeScript
// =============================================================================

// Event types are plain objects
type VerifyEvent = Event<string, { data: string }>;
type VerifyEventId = EventId;
type VerifyEventPayload = EventPayload<Event<string, { data: string }>>;
type VerifyAnyEvent = AnyEvent;

// Built-in event types are plain interfaces
type VerifyUserInputEvent = UserInputEvent;
type VerifyTextDeltaEvent = TextDeltaEvent;
type VerifyTextCompleteEvent = TextCompleteEvent;
type VerifyAgentStartedEvent = AgentStartedEvent;
type VerifyAgentCompletedEvent = AgentCompletedEvent;
type VerifyToolCalledEvent = ToolCalledEvent;
type VerifyToolResultEvent = ToolResultEvent;
type VerifyErrorOccurredEvent = ErrorOccurredEvent;

// Handler types are plain function types
type VerifyHandler = Handler<AnyEvent, { count: number }>;
type VerifyHandlerResult = HandlerResult<{ count: number }>;
type VerifyHandlerDefinition = HandlerDefinition<AnyEvent, { count: number }>;

// Agent types are plain interfaces
type VerifyAgent = Agent<{ count: number }, { result: string }>;
type VerifyAgentOptions = AgentOptions<{ count: number }, { result: string }>;
type VerifyAgentRegistry = AgentRegistry<{ count: number }>;
type VerifyPromptPart = PromptPart;
type VerifyPromptTemplate = PromptTemplate;

// Workflow types are plain interfaces
type VerifyWorkflow = Workflow<{ count: number }>;
type VerifyWorkflowDefinition = WorkflowDefinition<{ count: number }>;
type VerifyWorkflowResult = WorkflowResult<{ count: number }>;
type VerifyRunOptions = RunOptions<{ count: number }>;
type VerifyWorkflowCallbacks = WorkflowCallbacks<{ count: number }>;
type VerifyWorkflowHandler = WorkflowHandler;
type VerifyCorsOptions = CorsOptions;

// Tape types are plain interfaces
type VerifyTape = Tape<{ count: number }>;
type VerifyTapeControls = TapeControls<{ count: number }>;
type VerifyTapeConfig = TapeConfig<{ count: number }>;
type VerifyTapeStatus = TapeStatus;
type VerifyTapeMetadata = TapeMetadata;
type VerifyComputeStateOptions = ComputeStateOptions;
type VerifyUnknownEventWarning = UnknownEventWarning;

// Store types are plain interfaces
type VerifySessionId = SessionId;
type VerifySessionMetadata = SessionMetadata;
type VerifyStateSnapshot = StateSnapshot<{ count: number }>;
type VerifyPublicStore = PublicStore;
type VerifySqliteStoreConfig = SqliteStoreConfig;

// Provider types are plain interfaces
type VerifyProviderMessage = ProviderMessage;
type VerifyQueryOptions = QueryOptions;
type VerifyQueryResult = QueryResult;
type VerifyStreamChunk = StreamChunk;
type VerifyClaudeProviderConfig = ClaudeProviderConfig;
type VerifyProviderInfo = ProviderInfo;
type VerifyProviderType = ProviderType;
type VerifyPublicLLMProvider = PublicLLMProvider;

// Renderer types are plain interfaces
type VerifyEventPattern = EventPattern;
type VerifyRenderFunction = RenderFunction<{ count: number }, void>;
type VerifyRenderer = Renderer<{ count: number }, void>;
type VerifyRendererRegistry = RendererRegistry<{ count: number }>;

// =============================================================================
// RUNTIME VERIFICATION - Use all exported functions without Effect
// =============================================================================

// State type for our test workflow
interface TestState {
	count: number;
	items: string[];
}

// Define events using TypeScript generics (NO Effect/Schema needed)
interface ItemAddedPayload {
	item: string;
}
const ItemAdded = defineEvent<"item:added", ItemAddedPayload>("item:added");

interface CountIncrementedPayload {
	amount: number;
}
const CountIncremented = defineEvent<"count:incremented", CountIncrementedPayload>("count:incremented");

// Verify EventDefinition has only plain properties
function verifyEventDefinition(): void {
	const eventDef = ItemAdded;

	// Only name, create, and is should exist
	const name: string = eventDef.name;
	const createFn: (payload: ItemAddedPayload, causedBy?: EventId) => Event<"item:added", ItemAddedPayload> =
		eventDef.create;
	const isFn: (event: AnyEvent) => event is Event<"item:added", ItemAddedPayload> = eventDef.is;

	// Create an event - returns plain Event object
	const event = eventDef.create({ item: "test" });

	// Type guard works
	if (eventDef.is(event)) {
		const item: string = event.payload.item;
		console.log(name, createFn, isFn, item);
	}
}

// Define handlers - plain functions
const itemHandler = defineHandler(ItemAdded, {
	name: "item-handler",
	handler: (event, state: TestState): HandlerResult<TestState> => {
		return stateOnly({
			...state,
			items: [...state.items, event.payload.item],
		});
	},
});

const countHandler = defineHandler(CountIncremented, {
	name: "count-handler",
	handler: (event, state: TestState): HandlerResult<TestState> => {
		return emit({ ...state, count: state.count + event.payload.amount }, [
			emitEvent("item:added", { item: `count-${state.count + event.payload.amount}` }),
		]);
	},
});

// Verify handlers are plain objects with plain functions
function verifyHandlerDefinition(): void {
	const def = itemHandler;

	// HandlerDefinition has only name, handles, handler
	const name: string = def.name;
	const handles: string = def.handles;
	const handler: Handler<Event<"item:added", ItemAddedPayload>, TestState> = def.handler;

	// Handler can be called directly - no Effect runtime needed
	const result = handler(ItemAdded.create({ item: "direct-call" }), { count: 0, items: [] });

	// Result is plain object
	const newState: TestState = result.state;
	const emittedEvents: readonly AnyEvent[] = result.events;

	console.log(name, handles, newState, emittedEvents);
}

// Create low-level event
function verifyCreateEvent(): void {
	const event = createEvent("test:event", { data: "hello" });

	// Event is plain object
	const id: EventId = event.id;
	const name: string = event.name;
	const payload: { data: string } = event.payload;
	const timestamp: Date = event.timestamp;
	const causedBy: EventId | undefined = event.causedBy;

	console.log(id, name, payload, timestamp, causedBy);
}

// Verify agent factory (would need Zod for outputSchema, but types are plain)
function verifyAgentFactory(): void {
	// Agent options are plain TypeScript
	const options: AgentOptions<TestState, { result: string }> = {
		name: "test-agent",
		activatesOn: ["item:added"],
		emits: ["count:incremented"],
		outputSchema: { type: "object" } as unknown, // Placeholder - real code uses Zod
		prompt: (state, _event) => `Process ${state.count} items`,
		when: (state) => state.count < 10,
		onOutput: (_output, event) => [emitEvent("count:incremented", { amount: 1 }, event.id)],
	};

	// Verify agent utility functions work
	const registry = createAgentRegistry([]);
	const matching = findMatchingAgents(registry, "item:added", { count: 0, items: [] });

	console.log(options, matching);
}

// Verify workflow creation returns Promise-based API
async function verifyWorkflow(): Promise<void> {
	// Handlers need to be cast to AnyEvent type for array typing
	// This is a TypeScript limitation, not an Effect leak
	const handlers = [itemHandler, countHandler] as unknown as HandlerDefinition<AnyEvent, TestState>[];

	const workflow = createWorkflow<TestState>({
		name: "test-workflow",
		initialState: { count: 0, items: [] },
		handlers,
		agents: [],
		until: (state) => state.count >= 10,
	});

	// Workflow methods return Promises - NOT Effect
	const runResult: Promise<WorkflowResult<TestState>> = workflow.run({ input: "test" });

	// Can await like any Promise
	const result = await runResult;

	// Result is plain object
	const state: TestState = result.state;
	const events: readonly AnyEvent[] = result.events;
	const tape: Tape<TestState> = result.tape;
	const terminated: boolean = result.terminated;

	// Tape controls are plain methods
	const newTape = tape.step();
	const backTape = newTape.stepBack();
	const atPosition = tape.stepTo(5);
	const rewound = tape.rewind();
	const stateAtPos = tape.stateAt(3);

	// Cleanup returns Promise
	const disposeResult: Promise<void> = workflow.dispose();
	await disposeResult;

	console.log(state, events, terminated, backTape, atPosition, rewound, stateAtPos);
}

// Verify Tape creation and navigation
function verifyTape(): void {
	// Tape types are all plain TypeScript
	const status: TapeStatus = "idle";
	const metadata: TapeMetadata = {
		sessionId: makeSessionId("test-session"),
		eventCount: 10,
		status: "idle",
	};

	// computeState is a plain function
	const handlers = new Map<string, Handler<AnyEvent, TestState>>();
	const events: AnyEvent[] = [];
	const computed = computeState(events, handlers, { count: 0, items: [] }, 0);

	// createTape returns plain Tape object
	const config: TapeConfig<TestState> = {
		events: [],
		handlers,
		initialState: { count: 0, items: [] },
	};
	const tape = createTape(config);

	// All tape properties are plain types
	const position: number = tape.position;
	const length: number = tape.length;
	const current: AnyEvent | undefined = tape.current;
	const tapeState: TestState = tape.state;
	const tapeEvents: readonly AnyEvent[] = tape.events;
	const isRecording: boolean = tape.isRecording;
	const isReplaying: boolean = tape.isReplaying;
	const tapeStatus: TapeStatus = tape.status;

	console.log(
		status,
		metadata,
		computed,
		position,
		length,
		current,
		tapeState,
		tapeEvents,
		isRecording,
		isReplaying,
		tapeStatus,
	);
}

// Verify Store factories return Promise-based API
async function verifyStore(): Promise<void> {
	// createMemoryStore returns Promise<PublicStore>
	const memStore: Promise<PublicStore> = createMemoryStore();
	const store = await memStore;

	// All store methods return Promises - NOT Effect
	const sessionId = generateSessionId();
	const event = createEvent("test:event", { data: "hello" });

	const appendResult: Promise<void> = store.append(sessionId, event);
	await appendResult;

	const eventsResult: Promise<readonly AnyEvent[]> = store.events(sessionId);
	const events = await eventsResult;

	const sessionsResult: Promise<readonly SessionMetadata[]> = store.sessions();
	const sessions = await sessionsResult;

	const clearResult: Promise<void> = store.clear(sessionId);
	await clearResult;

	console.log(events, sessions);
}

// Verify Renderer creation
function verifyRenderer(): void {
	// Pattern matching utilities are plain functions
	const matches1: boolean = matchesPattern("error:occurred", "error:*");
	const matches2: boolean = matchesAnyPattern("text:delta", ["text:*", "error:*"]);
	const patterns: readonly EventPattern[] = findMatchingPatterns("text:complete", ["text:*", "*:complete", "*"]);

	// createRenderer returns plain Renderer object
	const renderer = createRenderer<TestState, void>({
		name: "test-renderer",
		renderers: {
			"text:delta": (event, _state) => {
				console.log("delta", event.payload);
			},
			"error:*": (event, _state) => {
				console.log("error", event.payload);
			},
		},
	});

	// Renderer is plain object
	const name: string = renderer.name;
	const rendererPatterns: readonly EventPattern[] = renderer.patterns;

	// renderEvent is synchronous, renderEventAsync schedules microtasks (non-blocking)
	const event = createEvent("text:delta", { delta: "hello" });
	renderEvent(event, { count: 0, items: [] }, [renderer]);

	// renderEventAsync returns void (uses queueMicrotask internally for parallel non-blocking execution)
	renderEventAsync(event, { count: 0, items: [] }, [renderer]);

	console.log(matches1, matches2, patterns, name, rendererPatterns);
}

// Verify Error classes are standard Error subclasses
function verifyErrors(): void {
	// All error classes extend Error
	const storeError = new StoreError("NOT_FOUND", "Session not found");
	const providerError = new ProviderError("NETWORK_ERROR", "Connection failed", true);
	const runtimeError = new WorkflowRuntimeError("EXECUTION_FAILED", "Workflow failed");
	const registryError = new HandlerRegistryError("HANDLER_NOT_FOUND", "Handler not found");
	const agentError = new AgentRegistryError("AGENT_NOT_FOUND", "Agent not found");
	const busError = new EventBusError("EMIT_FAILED", "Emit failed");
	const schemaError = new MissingOutputSchemaError("test-agent");

	// All are instanceof Error
	const isError1: boolean = storeError instanceof Error;
	const isError2: boolean = providerError instanceof Error;
	const isError3: boolean = runtimeError instanceof Error;
	const isError4: boolean = registryError instanceof Error;
	const isError5: boolean = agentError instanceof Error;
	const isError6: boolean = busError instanceof Error;
	const isError7: boolean = schemaError instanceof Error;

	// Error properties are standard
	const message: string = storeError.message;
	const name: string = storeError.name;
	const code: StoreErrorCode = storeError.code;

	console.log(isError1, isError2, isError3, isError4, isError5, isError6, isError7, message, name, code);
}

// Verify WorkflowHandler for server-side execution (FR-059)
function verifyWorkflowHandler(): void {
	const workflow = createWorkflow<TestState>({
		name: "server-workflow",
		initialState: { count: 0, items: [] },
		handlers: [],
		agents: [],
		until: () => false,
	});

	// createWorkflowHandler options are plain TypeScript
	const options: CreateWorkflowHandlerOptions<TestState> = {
		workflow,
		cors: {
			origin: ["http://localhost:3000"],
			methods: ["POST", "OPTIONS"],
		},
		record: true,
	};

	// Creates plain handler object
	const handler = createWorkflowHandler(options);

	// Handler.handle takes standard Request, returns Promise<Response>
	const handleFn: (request: Request) => Promise<Response> = handler.handle;

	console.log(handleFn);
}

// Verify EventBus utilities
function verifyEventBusUtilities(): void {
	// Subscription ID utilities
	const subId1 = generateSubscriptionId();
	const subId2 = makeSubscriptionId("custom-id");

	// Pattern filter utilities
	const filter1 = createPatternFilter("error:*");
	const filter2 = createMultiPatternFilter(["text:*", "error:*"]);

	// Filters are plain functions
	const matches1: boolean = filter1(createEvent("error:occurred", {}));
	const matches2: boolean = filter2(createEvent("text:delta", {}));

	console.log(subId1, subId2, matches1, matches2);
}

// Verify all callback types are plain TypeScript
function verifyCallbacks(): void {
	// WorkflowCallbacks are plain function types
	const callbacks: WorkflowCallbacks<TestState> = {
		onEvent: (event: AnyEvent) => {
			console.log("event", event.name);
		},
		onStateChange: (state: TestState) => {
			console.log("state", state.count);
		},
		onError: (error: Error) => {
			console.log("error", error.message);
		},
	};

	// RuntimeCallbacks are plain function types
	const runtimeCallbacks: RuntimeCallbacks<TestState> = {
		onEvent: (event: AnyEvent) => {
			console.log("event", event.name);
		},
		onStateChange: (state: TestState) => {
			console.log("state", state.count);
		},
		onError: (error: Error) => {
			console.log("error", error.message);
		},
	};

	// OnUnknownEventCallback is plain function type
	const unknownCallback: OnUnknownEventCallback = (warning: UnknownEventWarning) => {
		console.log("unknown", warning.event.name, warning.position);
	};

	console.log(callbacks, runtimeCallbacks, unknownCallback);
}

// =============================================================================
// MAIN - Run all verifications
// =============================================================================

async function main(): Promise<void> {
	console.log("Verifying Effect-free public API...\n");

	verifyEventDefinition();
	verifyHandlerDefinition();
	verifyCreateEvent();
	verifyAgentFactory();
	await verifyWorkflow();
	verifyTape();
	await verifyStore();
	verifyRenderer();
	verifyErrors();
	verifyWorkflowHandler();
	verifyEventBusUtilities();
	verifyCallbacks();

	console.log("\nAll verifications passed!");
	console.log("The public API is 100% Effect-free (FR-062 compliant).");
}

// Export for potential test runner usage
export {
	verifyEventDefinition,
	verifyHandlerDefinition,
	verifyCreateEvent,
	verifyAgentFactory,
	verifyWorkflow,
	verifyTape,
	verifyStore,
	verifyRenderer,
	verifyErrors,
	verifyWorkflowHandler,
	verifyEventBusUtilities,
	verifyCallbacks,
	main,
};

// Suppress unused type warnings - these are intentional type verifications
void (null as unknown as VerifyEvent);
void (null as unknown as VerifyEventId);
void (null as unknown as VerifyEventPayload);
void (null as unknown as VerifyAnyEvent);
void (null as unknown as VerifyUserInputEvent);
void (null as unknown as VerifyTextDeltaEvent);
void (null as unknown as VerifyTextCompleteEvent);
void (null as unknown as VerifyAgentStartedEvent);
void (null as unknown as VerifyAgentCompletedEvent);
void (null as unknown as VerifyToolCalledEvent);
void (null as unknown as VerifyToolResultEvent);
void (null as unknown as VerifyErrorOccurredEvent);
void (null as unknown as VerifyHandler);
void (null as unknown as VerifyHandlerResult);
void (null as unknown as VerifyHandlerDefinition);
void (null as unknown as VerifyAgent);
void (null as unknown as VerifyAgentOptions);
void (null as unknown as VerifyAgentRegistry);
void (null as unknown as VerifyPromptPart);
void (null as unknown as VerifyPromptTemplate);
void (null as unknown as VerifyWorkflow);
void (null as unknown as VerifyWorkflowDefinition);
void (null as unknown as VerifyWorkflowResult);
void (null as unknown as VerifyRunOptions);
void (null as unknown as VerifyWorkflowCallbacks);
void (null as unknown as VerifyWorkflowHandler);
void (null as unknown as VerifyCorsOptions);
void (null as unknown as VerifyTape);
void (null as unknown as VerifyTapeControls);
void (null as unknown as VerifyTapeConfig);
void (null as unknown as VerifyTapeStatus);
void (null as unknown as VerifyTapeMetadata);
void (null as unknown as VerifyComputeStateOptions);
void (null as unknown as VerifyUnknownEventWarning);
void (null as unknown as VerifySessionId);
void (null as unknown as VerifySessionMetadata);
void (null as unknown as VerifyStateSnapshot);
void (null as unknown as VerifyPublicStore);
void (null as unknown as VerifySqliteStoreConfig);
void (null as unknown as VerifyProviderMessage);
void (null as unknown as VerifyQueryOptions);
void (null as unknown as VerifyQueryResult);
void (null as unknown as VerifyStreamChunk);
void (null as unknown as VerifyClaudeProviderConfig);
void (null as unknown as VerifyProviderInfo);
void (null as unknown as VerifyProviderType);
void (null as unknown as VerifyPublicLLMProvider);
void (null as unknown as VerifyEventPattern);
void (null as unknown as VerifyRenderFunction);
void (null as unknown as VerifyRenderer);
void (null as unknown as VerifyRendererRegistry);
void (null as unknown as EventFilter);
void (null as unknown as SubscriptionId);
void (null as unknown as PublicEventBus);
void (null as unknown as DefineHandlerOptions<AnyEvent, TestState>);
void (null as unknown as HandlerRegistryErrorCode);
void (null as unknown as PublicHandlerRegistry<TestState>);
void (null as unknown as AgentRegistryErrorCode);
void (null as unknown as PublicAgentRegistry<TestState>);
void (null as unknown as WorkflowRuntimeErrorCode);
void (null as unknown as PublicWorkflowRuntime);
void (null as unknown as RuntimeCallbacks<TestState>);
void (null as unknown as RuntimeResult<TestState>);
void (null as unknown as RuntimeRunOptions<TestState>);
void (null as unknown as CreateWorkflowHandlerOptions<TestState>);
void (null as unknown as ProviderErrorCode);
void (null as unknown as CreateRendererOptions<TestState, void>);
void (null as unknown as MultiRenderer<TestState, void>);
