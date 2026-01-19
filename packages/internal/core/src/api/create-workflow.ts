/**
 * Workflow-scoped factory for creating typed reactive agents.
 *
 * This pattern solves the TypeScript variance problem by scoping all agents
 * to a single state type. Agents created from the same factory share the same
 * TState, eliminating contravariance issues in `when` guards.
 *
 * @example
 * ```ts
 * import { createWorkflow } from "@open-harness/core"
 *
 * type TradingState = {
 *   confidence: number
 *   position: "long" | "short" | null
 *   balance: number
 * }
 *
 * // Create typed factory
 * const { agent, runReactive } = createWorkflow<TradingState>()
 *
 * // All agents have typed state access in `when`
 * const analyst = agent({
 *   prompt: "Analyze market data",
 *   activateOn: ["workflow:start"],
 *   emits: ["analysis:complete"],
 *   when: (ctx) => ctx.state.balance > 1000,  // ✅ Full autocomplete!
 * })
 *
 * const executor = agent({
 *   prompt: "Execute trades",
 *   activateOn: ["analysis:complete"],
 *   when: (ctx) => ctx.state.confidence > 0.8,  // ✅ Type-safe!
 * })
 *
 * // Run with initial state
 * const result = await runReactive({
 *   agents: { analyst, executor },
 *   state: { confidence: 0, position: null, balance: 5000 },
 * })
 * ```
 */

import type { ZodType } from "zod";
import type { Signal, Harness as SignalHarness } from "@internal/signals-core";
import type { SignalAdapter, SignalPattern, SignalStore, Recording } from "@internal/signals";
import type { SignalRecordingOptions } from "./run-reactive.js";
import { produce } from "immer";

// ============================================================================
// Timeout Error
// ============================================================================

/**
 * Error thrown when workflow execution exceeds the configured timeout.
 */
export class TimeoutError extends Error {
	override readonly name = "TimeoutError" as const;
	readonly timeoutMs: number;

	constructor(message: string, timeoutMs: number) {
		super(message);
		this.timeoutMs = timeoutMs;
	}
}

// ============================================================================
// Activation Context - what `when` guards receive
// ============================================================================

/**
 * Context passed to `when` guard functions.
 *
 * Provides typed access to:
 * - The triggering signal
 * - Current workflow state (fully typed!)
 * - Input that started the run
 */
export type ActivationContext<TState> = {
	/**
	 * The signal that triggered this activation check.
	 */
	signal: Signal;

	/**
	 * Current workflow state (typed based on workflow definition).
	 */
	state: Readonly<TState>;

	/**
	 * Original input passed to runReactive.
	 */
	input: unknown;
};

// ============================================================================
// Reactive Agent Config (workflow-scoped)
// ============================================================================

/**
 * Configuration for a reactive agent within a workflow scope.
 *
 * The TState type parameter is fixed by the workflow factory,
 * so all agents share the same state type - no variance issues!
 */
export type ReactiveAgentConfig<TOutput, TState> = {
	/**
	 * System prompt that defines the agent's behavior.
	 * Can be a static string or a function that receives the activation context.
	 *
	 * @example Static prompt
	 * ```ts
	 * prompt: "You are a helpful assistant."
	 * ```
	 *
	 * @example Dynamic prompt (from defineAgent)
	 * ```ts
	 * prompt: (ctx) => `Analyze: ${ctx.state.data}`
	 * ```
	 */
	prompt: string | ((ctx: ActivationContext<TState>) => string);

	/**
	 * Optional output configuration with Zod schema.
	 */
	output?: {
		schema?: ZodType<TOutput>;
	};

	/**
	 * Signal patterns that trigger this agent.
	 * Uses glob syntax: "workflow:start", "state:*:changed", "trade:**"
	 */
	activateOn: SignalPattern[];

	/**
	 * Signals this agent declares it will emit.
	 */
	emits?: string[];

	/**
	 * Guard condition for activation.
	 * Return true to activate, false to skip.
	 *
	 * Has full typed access to workflow state!
	 */
	when?: (ctx: ActivationContext<TState>) => boolean;

	/**
	 * Per-agent harness override.
	 */
	signalHarness?: SignalHarness;

	/**
	 * State field to update with agent output.
	 *
	 * Simple shorthand for common case where agent output
	 * maps directly to a state field.
	 *
	 * @example
	 * ```ts
	 * const greeter = agent({
	 *   prompt: "Create a greeting",
	 *   activateOn: ["workflow:start"],
	 *   emits: ["greeting:created"],
	 *   updates: "greeting",  // state.greeting = output
	 * })
	 * ```
	 */
	updates?: keyof TState & string;
};

/**
 * A reactive agent created from a workflow factory.
 *
 * The TState is baked in from the factory, ensuring type safety.
 */
export type ScopedReactiveAgent<TOutput = unknown, TState = unknown> = {
	readonly _tag: "Agent";
	readonly _reactive: true;
	readonly _stateType?: TState; // Phantom type for tracking
	readonly config: ReactiveAgentConfig<TOutput, TState>;
};

// ============================================================================
// Workflow Run Config
// ============================================================================

/**
 * Configuration for running a reactive workflow.
 */
export type ReactiveWorkflowConfig<TState> = {
	/**
	 * Named agents to include in the workflow.
	 * All agents must be created from the same factory.
	 */
	agents: Record<string, ScopedReactiveAgent<unknown, TState>>;

	/**
	 * Initial state for the workflow.
	 */
	state: TState;

	/**
	 * Default harness for agents that don't specify signalHarness.
	 */
	harness?: SignalHarness;

	/**
	 * Abort signal for cancellation.
	 */
	signal?: AbortSignal;

	/**
	 * Timeout in milliseconds for the entire workflow run.
	 * If exceeded, throws a TimeoutError.
	 * @default undefined (no timeout)
	 */
	timeout?: number;

	/**
	 * Termination condition that ends the workflow early.
	 * When this returns true, the workflow stops accepting new signals
	 * and waits for pending activations to complete.
	 *
	 * @example
	 * ```ts
	 * endWhen: (state) => state.position !== null
	 * ```
	 */
	endWhen?: (state: Readonly<TState>) => boolean;

	/**
	 * Recording options for signal capture and replay.
	 *
	 * @example Record mode - save signals to store
	 * ```ts
	 * const result = await runReactive({
	 *   agents: { analyzer },
	 *   state: initialState,
	 *   recording: {
	 *     mode: 'record',
	 *     store: new MemorySignalStore(),
	 *     name: 'my-test-001',
	 *   }
	 * })
	 * // result.recordingId contains the ID for later replay
	 * ```
	 *
	 * @example Replay mode - inject recorded signals
	 * ```ts
	 * const result = await runReactive({
	 *   agents: { analyzer },
	 *   state: initialState,
	 *   recording: {
	 *     mode: 'replay',
	 *     store,
	 *     recordingId: 'rec_xxx',
	 *   }
	 * })
	 * // No harness calls made - signals injected from recording
	 * ```
	 */
	recording?: SignalRecordingOptions;

	/**
	 * Signal reducers for complex state updates.
	 *
	 * Reducers are called when matching signals are emitted,
	 * allowing state mutations based on signal payloads.
	 * Reducers run within Immer's `produce`, enabling direct mutations.
	 *
	 * Use for:
	 * - Cross-cutting state updates
	 * - Complex transformations
	 * - Aggregating data from multiple agents
	 *
	 * @example
	 * ```ts
	 * const result = await runReactive({
	 *   agents: { greeter, transformer },
	 *   state: { greeting: null, count: 0 },
	 *   reducers: {
	 *     "greeting:transformed": (state, signal) => {
	 *       // Direct mutation (Immer handles immutability)
	 *       state.greeting = signal.payload.output as string;
	 *       state.count++;
	 *     }
	 *   }
	 * })
	 * ```
	 */
	reducers?: SignalReducers<TState>;

	/**
	 * Process managers for orchestration logic (CQRS pattern).
	 *
	 * Process managers are called AFTER reducers, receiving read-only state
	 * and returning signals to emit. This separates:
	 * - Reducers: State mutations (command side)
	 * - Processes: Signal emission (query side)
	 *
	 * @example
	 * ```ts
	 * const result = await runReactive({
	 *   agents: { planner, executor },
	 *   state: { tasks: [], currentTask: null },
	 *   reducers: {
	 *     "plan:created": (state, signal) => {
	 *       state.tasks = signal.payload.tasks;
	 *     }
	 *   },
	 *   processes: {
	 *     "plan:created": (state, signal) => {
	 *       // Emit signal for first pending task
	 *       const first = state.tasks.find(t => t.status === "pending");
	 *       return first ? [createSignal("task:ready", { taskId: first.id })] : [];
	 *     }
	 *   }
	 * })
	 * ```
	 */
	processes?: ProcessManagers<TState>;

	/**
	 * Signal handlers (unified pattern).
	 *
	 * Handlers combine state mutations and signal emission in a single function.
	 * This is the preferred pattern for workflows where state changes and
	 * orchestration logic are tightly coupled.
	 *
	 * Handlers:
	 * - Receive mutable state (Immer wraps in produce)
	 * - Mutate state directly
	 * - Return Signal[] for follow-up emissions (or undefined/void)
	 *
	 * Execution order: reducers → handlers → processes
	 * (handlers run after reducers but before process managers)
	 *
	 * @example
	 * ```ts
	 * const result = await runReactive({
	 *   agents: { planner, executor },
	 *   state: { tasks: [], currentTask: null },
	 *   handlers: {
	 *     "plan:created": (state, signal) => {
	 *       // MUTATION: Update state
	 *       state.tasks = signal.payload.tasks;
	 *       state.phase = "executing";
	 *
	 *       // EMISSION: Return signals
	 *       const first = state.tasks.find(t => t.status === "pending");
	 *       return first ? [{ name: "task:ready", payload: { taskId: first.id } }] : [];
	 *     }
	 *   }
	 * })
	 * ```
	 */
	handlers?: SignalHandlers<TState>;

	/**
	 * Signal adapters for rendering signals to outputs.
	 *
	 * Adapters receive signals and render them to different destinations
	 * (terminal, logs, web, etc.). The SignalBus is created internally
	 * and NOT exposed - adapters are the public API for signal consumption.
	 *
	 * Lifecycle:
	 * - onStart() is called for each adapter before execution begins
	 * - onSignal() is called for each signal matching the adapter's patterns
	 * - onStop() is called for each adapter after execution completes (even on error)
	 *
	 * @example
	 * ```ts
	 * import { terminalAdapter, logsAdapter } from "@internal/signals/adapters"
	 *
	 * const result = await runReactive({
	 *   agents: { analyzer },
	 *   state: initialState,
	 *   adapters: [terminalAdapter(), logsAdapter({ logger })],
	 * })
	 * ```
	 *
	 * @example Using defaultAdapters helper
	 * ```ts
	 * import { defaultAdapters } from "@internal/signals/adapters"
	 *
	 * const result = await runReactive({
	 *   agents: { analyzer },
	 *   state: initialState,
	 *   adapters: defaultAdapters({ logger: getLogger() }),
	 * })
	 * ```
	 */
	adapters?: SignalAdapter[];
};

/**
 * Signal reducer function type.
 * Receives mutable state and the triggering signal.
 *
 * Reducers are called within an Immer producer, so you can mutate
 * state directly without spread operators:
 *
 * @example
 * ```ts
 * const reducer: SignalReducer<MyState> = (state, signal) => {
 *   // Direct mutation (Immer handles immutability)
 *   state.planning.phase = "executing";
 *   state.tasks[0].status = "complete";
 * };
 * ```
 */
export type SignalReducer<TState> = (state: TState, signal: Signal) => void;

/**
 * Map of signal patterns to reducer functions.
 */
export type SignalReducers<TState> = Record<string, SignalReducer<TState>>;

// ============================================================================
// Process Manager Types (CQRS Orchestration)
// ============================================================================

/**
 * Process manager function type for CQRS orchestration.
 *
 * Process managers are the "query" side of CQRS - they observe state changes
 * and decide what signals to emit for orchestration, without mutating state.
 *
 * Key principles:
 * - Receives **read-only** state (no mutations allowed)
 * - Receives the triggering signal for context
 * - Returns an array of signals to emit
 * - Must be **pure functions** (deterministic, no side effects)
 *
 * @example
 * ```ts
 * const onPlanCreated: ProcessManager<PRDState> = (state, signal) => {
 *   // Find first pending task and emit ready signal
 *   const firstTask = state.tasks.find(t => t.status === "pending");
 *   if (firstTask) {
 *     return [createSignal("task:ready", { taskId: firstTask.id })];
 *   }
 *   return [];
 * };
 * ```
 *
 * @example Chaining signals
 * ```ts
 * const onTaskComplete: ProcessManager<PRDState> = (state, signal) => {
 *   const allComplete = state.tasks.every(t => t.status === "complete");
 *   if (allComplete) {
 *     return [createSignal("milestone:testable", { milestone: state.currentMilestone })];
 *   }
 *   // Find next pending task
 *   const nextTask = state.tasks.find(t => t.status === "pending");
 *   if (nextTask) {
 *     return [createSignal("task:ready", { taskId: nextTask.id })];
 *   }
 *   return [];
 * };
 * ```
 */
export type ProcessManager<TState> = (
	state: Readonly<TState>,
	signal: Signal,
) => Signal[];

/**
 * Map of signal patterns to process manager functions.
 *
 * Process managers handle orchestration logic separately from state mutations:
 * - Reducers: Update state (command side)
 * - ProcessManagers: Emit signals (query side)
 *
 * This separation enables:
 * - Easier testing of orchestration logic
 * - Clear separation of concerns
 * - Deterministic signal emission
 *
 * @example
 * ```ts
 * const processes: ProcessManagers<PRDState> = {
 *   "plan:created": (state, signal) => {
 *     const first = state.tasks.find(t => t.status === "pending");
 *     return first ? [createSignal("task:ready", { taskId: first.id })] : [];
 *   },
 *   "task:complete": (state, signal) => {
 *     // Check if discoveries need review
 *     if (state.pendingDiscoveries.length > 0) {
 *       return [createSignal("discovery:submitted", { count: state.pendingDiscoveries.length })];
 *     }
 *     return [];
 *   },
 * };
 * ```
 */
export type ProcessManagers<TState> = Record<string, ProcessManager<TState>>;

// ============================================================================
// Signal Handler Type (Unified Pattern)
// ============================================================================

/**
 * Signal handler function type (unified pattern).
 *
 * Handlers are the unified approach to signal handling that combines:
 * - Reducers: State mutations (command side)
 * - Process managers: Signal emission (query side)
 *
 * Key principles:
 * - Receive mutable state (Immer handles immutability)
 * - Receive the triggering signal for context
 * - Mutate state directly
 * - Return new signals to emit (or undefined/void for no emissions)
 *
 * This unified pattern is preferred over separate reducers/processes
 * for workflows where state mutation and signal emission are tightly coupled.
 *
 * @example
 * ```ts
 * const handler: SignalHandler<MyState> = (state, signal) => {
 *   // Direct mutation (Immer handles immutability)
 *   state.tasks[signal.payload.taskId].status = "complete";
 *
 *   // Return signals to emit
 *   return [{ name: "review:start", payload: { taskId: signal.payload.taskId } }];
 * };
 * ```
 *
 * @example No signals to emit
 * ```ts
 * const handler: SignalHandler<MyState> = (state, signal) => {
 *   state.count++;
 *   // Return undefined/void - no signals to emit
 * };
 * ```
 */
export type SignalHandler<TState> = (
	state: TState,
	signal: Signal,
) => Signal[] | void;

/**
 * Map of signal patterns to handler functions.
 *
 * Handlers combine state mutations and signal emission in a single function.
 * This is the preferred pattern for workflows where these concerns are
 * naturally coupled.
 *
 * @example
 * ```ts
 * const handlers: SignalHandlers<PRDWorkflowState> = {
 *   "plan:created": (state, signal) => {
 *     // MUTATION: Update state
 *     const { tasks, milestones, taskOrder } = signal.payload;
 *     state.planning.allTasks = tasks;
 *     state.planning.milestones = milestones;
 *     state.planning.taskOrder = taskOrder;
 *     state.planning.phase = "plan_complete";
 *
 *     // EMISSION: Return signals to emit
 *     const firstTask = taskOrder[0];
 *     if (firstTask) {
 *       return [{ name: "task:ready", payload: { taskId: firstTask } }];
 *     }
 *     return [];
 *   },
 *   "task:complete": (state, signal) => {
 *     const { taskId, outcome } = signal.payload;
 *     state.execution.tasks[taskId].status = outcome;
 *     // No signals to emit
 *   },
 * };
 * ```
 */
export type SignalHandlers<TState> = Record<string, SignalHandler<TState>>;

/**
 * Result from running a reactive workflow.
 */
export type ReactiveWorkflowResult<TState> = {
	/**
	 * Final state after all agents complete.
	 */
	state: TState;

	/**
	 * All signals emitted during execution.
	 */
	signals: readonly Signal[];

	/**
	 * Execution metrics.
	 */
	metrics: {
		durationMs: number;
		activations: number;
	};

	/**
	 * Whether the workflow terminated early due to endWhen condition.
	 */
	terminatedEarly: boolean;

	/**
	 * Recording ID when recording mode was used.
	 * Use this ID for later replay.
	 */
	recordingId?: string;
};

// ============================================================================
// Factory Return Type
// ============================================================================

/**
 * The factory returned by createWorkflow<TState>().
 *
 * Contains typed versions of agent() and runReactive() that
 * are scoped to the workflow state type.
 */
export type WorkflowFactory<TState> = {
	/**
	 * Create a reactive agent with typed state access.
	 *
	 * @example
	 * ```ts
	 * const analyst = agent({
	 *   prompt: "Analyze data",
	 *   activateOn: ["workflow:start"],
	 *   when: (ctx) => ctx.state.ready,  // ✅ Typed!
	 * })
	 * ```
	 */
	agent: <TOutput = unknown>(
		config: ReactiveAgentConfig<TOutput, TState>,
	) => ScopedReactiveAgent<TOutput, TState>;

	/**
	 * Run a set of reactive agents with shared state.
	 *
	 * @example
	 * ```ts
	 * const result = await runReactive({
	 *   agents: { analyst, executor },
	 *   state: { ready: true, data: null },
	 * })
	 * ```
	 */
	runReactive: (
		config: ReactiveWorkflowConfig<TState>,
	) => Promise<ReactiveWorkflowResult<TState>>;
};

// ============================================================================
// Factory Implementation
// ============================================================================

/**
 * Create a workflow factory scoped to a specific state type.
 *
 * All agents created from this factory share the same TState type,
 * which eliminates TypeScript variance issues in `when` guards.
 *
 * @example
 * ```ts
 * type MyState = { count: number; ready: boolean }
 *
 * const { agent, runReactive } = createWorkflow<MyState>()
 *
 * const counter = agent({
 *   prompt: "Increment counter",
 *   activateOn: ["workflow:start"],
 *   when: (ctx) => ctx.state.ready,  // Full type safety!
 * })
 *
 * await runReactive({
 *   agents: { counter },
 *   state: { count: 0, ready: true },
 * })
 * ```
 */
export function createWorkflow<TState>(): WorkflowFactory<TState> {
	// Agent factory - creates agents scoped to TState
	function agent<TOutput = unknown>(
		config: ReactiveAgentConfig<TOutput, TState>,
	): ScopedReactiveAgent<TOutput, TState> {
		return {
			_tag: "Agent" as const,
			_reactive: true as const,
			config,
		};
	}

	// Run implementation - executes agents with shared state
	async function runReactive(
		config: ReactiveWorkflowConfig<TState>,
	): Promise<ReactiveWorkflowResult<TState>> {
		// Import at runtime to avoid circular dependencies
		const { SignalBus } = await import("@internal/signals");
		const { createSignal } = await import("@internal/signals-core");

		// ========================================================================
		// Recording Setup
		// ========================================================================
		const recordingMode = config.recording?.mode ?? "live";
		const store = config.recording?.store;

		// Validate recording options
		if (recordingMode === "record" && !store) {
			throw new Error("Recording mode 'record' requires a store.");
		}
		if (recordingMode === "replay" && !store) {
			throw new Error("Recording mode 'replay' requires a store.");
		}
		if (recordingMode === "replay" && !config.recording?.recordingId) {
			throw new Error("Recording mode 'replay' requires a recordingId.");
		}

		// Load recording for replay mode
		let replayRecording: Recording | null = null;
		if (recordingMode === "replay" && store && config.recording?.recordingId) {
			replayRecording = await store.load(config.recording.recordingId);
			if (!replayRecording) {
				throw new Error(`Recording not found: ${config.recording.recordingId}`);
			}
		}

		// Create recording ID for record mode
		let recordingId: string | undefined;
		const recordedSignals: Signal[] = [];
		if (recordingMode === "record" && store) {
			recordingId = await store.create({
				name: config.recording?.name,
				tags: config.recording?.tags,
			});
		}

		// Track position in replay recording
		let replaySignalIndex = 0;

		const startTime = Date.now();
		const bus = new SignalBus();

		// Subscribe to all signals for recording
		if (recordingMode === "record") {
			bus.subscribe(["**"], (signal) => {
				recordedSignals.push(signal);
			});
		}

		// ========================================================================
		// Adapter Setup
		// ========================================================================
		// Adapters receive signals and render to outputs (terminal, logs, web)
		// The SignalBus is internal - adapters are the public API
		const adapters = config.adapters ?? [];
		const adapterUnsubscribes: (() => void)[] = [];

		// Call onStart() for each adapter before execution
		for (const adapter of adapters) {
			if (adapter.onStart) {
				await adapter.onStart();
			}
			// Subscribe adapter to bus based on its patterns
			const unsubscribe = bus.subscribe(adapter.patterns, (signal) => {
				// Call onSignal - handle both sync and async handlers
				const result = adapter.onSignal(signal);
				// If it's a promise, we don't await it to avoid blocking signal emission
				// Adapter implementations should handle their own async concerns
				if (result instanceof Promise) {
					result.catch((err) => {
						// Log but don't propagate adapter errors
						// Note: This is intentional - adapter errors shouldn't break workflow
						// Using getLogger() would create circular dependency, use console.error
						process.stderr.write(`[${adapter.name}] Error in signal handler: ${err}\n`);
					});
				}
			});
			adapterUnsubscribes.push(unsubscribe);
		}

		// Helper to cleanup adapters (called on success or error)
		const cleanupAdapters = async () => {
			// Unsubscribe all adapters from bus
			for (const unsubscribe of adapterUnsubscribes) {
				unsubscribe();
			}
			// Call onStop() for each adapter
			for (const adapter of adapters) {
				if (adapter.onStop) {
					try {
						await adapter.onStop();
					} catch (err) {
						// Log but don't propagate adapter cleanup errors
						process.stderr.write(`[${adapter.name}] Error in onStop: ${err}\n`);
					}
				}
			}
		};

		// Mutable state - will be updated by agents and reducers
		let state = { ...config.state };
		let activations = 0;
		let terminated = false; // Set by endWhen condition

		// Track pending activations for quiescence detection
		// Use a Set to handle chained activations properly
		const pending = new Set<Promise<void>>();

		// Subscribe reducers to apply state mutations on matching signals
		// Reducers run within Immer's produce for clean mutations
		const reducers = config.reducers ?? {};
		for (const [signalPattern, reducer] of Object.entries(reducers)) {
			bus.subscribe([signalPattern], (signal) => {
				// Use Immer's produce for immutable updates with mutable syntax
				state = produce(state, (draft) => {
					reducer(draft as TState, signal);
				});
			});
		}

		// Subscribe unified handlers (Handler pattern)
		// Handlers run within Immer and can return signals to emit
		// Execution order: reducers → handlers → processes
		const handlers = config.handlers ?? {};
		for (const [signalPattern, handler] of Object.entries(handlers)) {
			bus.subscribe([signalPattern], (signal) => {
				// Use Immer's produce and collect returned signals
				let signalsToEmit: Signal[] = [];
				state = produce(state, (draft) => {
					const result = handler(draft as TState, signal);
					if (Array.isArray(result)) {
						signalsToEmit = result;
					}
				});
				// Emit any returned signals
				for (const derivedSignal of signalsToEmit) {
					bus.emit(derivedSignal);
				}
			});
		}

		// Subscribe process managers for orchestration (CQRS pattern)
		// Process managers run AFTER reducers and handlers, emit derived signals
		const processes = config.processes ?? {};
		for (const [signalPattern, processManager] of Object.entries(processes)) {
			bus.subscribe([signalPattern], (signal) => {
				// Process managers receive read-only state and return signals to emit
				const signalsToEmit = processManager(state as Readonly<TState>, signal);
				for (const derivedSignal of signalsToEmit) {
					bus.emit(derivedSignal);
				}
			});
		}

		// Subscribe each agent to its activation patterns
		for (const [name, scopedAgent] of Object.entries(config.agents)) {
			const agentConfig = scopedAgent.config;
			const patterns = agentConfig.activateOn;

			bus.subscribe(patterns, async (triggerSignal) => {
				// Skip new activations if workflow is terminated
				if (terminated) {
					bus.emit(
						createSignal("agent:skipped", {
							agent: name,
							reason: "workflow terminated by endWhen",
							trigger: triggerSignal.name,
						}),
					);
					return;
				}
				// Build activation context with current state
				const ctx: ActivationContext<TState> = {
					signal: triggerSignal,
					state: state as Readonly<TState>,
					input: config.state, // Original input
				};

				// Source tracking: this agent, triggered by parent signal
				const agentSource = { agent: name, parent: triggerSignal.id };

				// Check `when` guard if present
				if (agentConfig.when && !agentConfig.when(ctx)) {
					bus.emit(
						createSignal(
							"agent:skipped",
							{
								agent: name,
								reason: "when guard returned false",
								trigger: triggerSignal.name,
							},
							agentSource,
						),
					);
					return;
				}

				// Mark activation with causality tracking
				activations++;
				const activatedSignal = createSignal(
					"agent:activated",
					{
						agent: name,
						trigger: triggerSignal.name,
					},
					agentSource,
				);
				bus.emit(activatedSignal);

				// Get harness (not required for replay mode)
				const harness = agentConfig.signalHarness ?? config.harness;
				if (recordingMode !== "replay" && !harness) {
					throw new Error(
						`No harness for agent "${name}". Set signalHarness on agent or provide default.`,
					);
				}

				// Execute harness OR replay recorded signals
				const activationPromise = (async () => {
					let result: unknown;

					if (recordingMode === "replay" && replayRecording) {
						// Replay mode: inject recorded harness signals
						result = await replayHarnessSignals(
							bus,
							replayRecording.signals,
							replaySignalIndex,
						);
						// Update index for next activation (find next harness:end)
						for (
							let i = replaySignalIndex;
							i < replayRecording.signals.length;
							i++
						) {
							if (replayRecording.signals[i]?.name === "harness:end") {
								replaySignalIndex = i + 1;
								break;
							}
						}
					} else if (harness) {
						// Live/record mode: execute harness
						// Check if agent has jsonSchema (from defineAgent)
						// TypeScript doesn't know about it at compile time, but it may exist at runtime
						const agentWithSchema = scopedAgent as { jsonSchema?: Record<string, unknown> };
						const jsonSchema = agentWithSchema.jsonSchema;

						result = await executeAgent(
							bus,
							harness,
							agentConfig,
							name,
							ctx,
							createSignal,
							activatedSignal.id,
							jsonSchema,
						);
					}

					return result;
				})().then((executionResult) => {
					// Extract output and structuredOutput from execution result
					// For replay mode, result is still the raw output (unknown)
					// For live mode with new executeAgent, result is AgentExecutionResult
					let output: unknown;
					let structuredOutput: unknown;

					if (
						executionResult &&
						typeof executionResult === "object" &&
						"output" in executionResult
					) {
						// New format: AgentExecutionResult
						const execResult = executionResult as {
							output: unknown;
							structuredOutput?: unknown;
						};
						output = execResult.output;
						structuredOutput = execResult.structuredOutput;
					} else {
						// Legacy/replay format: raw output
						output = executionResult;
					}

					// Apply `updates` field - update state with agent output
					// Prefer structuredOutput if available
					const updateValue = structuredOutput ?? output;
					if (agentConfig.updates && updateValue !== undefined) {
						const field = agentConfig.updates;
						(state as Record<string, unknown>)[field] = updateValue;

						// Emit state change signal for reactive subscribers
						bus.emit(
							createSignal(
								`state:${field}:changed`,
								{
									key: field,
									oldValue: (config.state as Record<string, unknown>)[field],
									newValue: updateValue,
									agent: name,
								},
								{ agent: name, parent: activatedSignal.id },
							),
						);
					}

					// Check endWhen termination condition AFTER state update
					// This allows endWhen to see the updated state
					if (config.endWhen && !terminated && config.endWhen(state)) {
						terminated = true;
						bus.emit(
							createSignal("workflow:terminating", {
								reason: "endWhen condition met",
								agent: name,
								state,
							}),
						);
					}

					// Emit declared signals with causality tracking
					// Use structuredOutput as payload if available, otherwise fall back to wrapper
					for (const signalName of agentConfig.emits ?? []) {
						// If structuredOutput exists, use it directly as the payload
						// This enables type-safe handlers that know the exact payload shape
						const payload = structuredOutput ?? { agent: name, output };
						bus.emit(
							createSignal(signalName, payload, { agent: name, parent: activatedSignal.id }),
						);
					}
				});

				// Track and auto-remove when complete
				pending.add(activationPromise);
				activationPromise.finally(() => pending.delete(activationPromise));
			});
		}

		// Execute workflow with cleanup on error
		// This ensures adapters.onStop() is called even if execution fails
		try {
			// Emit workflow:start to trigger subscribed agents
			bus.emit(
				createSignal("workflow:start", {
					agents: Object.keys(config.agents),
					state,
				}),
			);

			// Wait for quiescence: no pending activations
			// This handles chained activations (agent A triggers agent B)
			const quiescence = async () => {
				while (pending.size > 0) {
					await Promise.all([...pending]);
				}
			};

			// Apply timeout if specified
			if (config.timeout !== undefined && config.timeout > 0) {
				const timeoutPromise = new Promise<never>((_, reject) => {
					setTimeout(() => {
						reject(
							new TimeoutError(
								`Workflow execution exceeded timeout of ${config.timeout}ms`,
								config.timeout!,
							),
						);
					}, config.timeout);
				});

				await Promise.race([quiescence(), timeoutPromise]);
			} else {
				await quiescence();
			}

			// Emit workflow:end
			const durationMs = Date.now() - startTime;
			bus.emit(
				createSignal("workflow:end", {
					durationMs,
					activations,
					state,
				}),
			);

			// Finalize recording - batch append all collected signals
			if (recordingMode === "record" && store && recordingId) {
				if (recordedSignals.length > 0) {
					await store.appendBatch(recordingId, recordedSignals);
				}
				await store.finalize(recordingId, durationMs);
			}

			return {
				state,
				signals: bus.history(),
				metrics: {
					durationMs,
					activations,
				},
				terminatedEarly: terminated,
				recordingId,
			};
		} finally {
			// Cleanup adapters - call onStop() for each
			await cleanupAdapters();
		}
	}

	return { agent, runReactive };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Result from executing an agent's harness.
 * Contains both the raw output and structured output if available.
 */
interface AgentExecutionResult {
	/** Raw output from harness (text content) */
	output: unknown;
	/** Structured output if agent has outputSchema and harness returned it */
	structuredOutput?: unknown;
}

/**
 * Execute an agent's harness and return the result.
 */
async function executeAgent<TOutput, TState>(
	bus: { emit: (signal: Signal) => void },
	harness: SignalHarness,
	config: ReactiveAgentConfig<TOutput, TState>,
	agentName: string,
	ctx: ActivationContext<TState>,
	createSignal: (
		name: string,
		payload: unknown,
		source?: { agent?: string; harness?: string; parent?: string },
	) => Signal,
	parentSignalId: string,
	jsonSchema?: Record<string, unknown>,
): Promise<AgentExecutionResult> {
	// Import template engine
	const { expandTemplate } = await import("./template.js");

	// Resolve prompt: static string or dynamic function (from defineAgent)
	const rawPrompt = typeof config.prompt === "function"
		? config.prompt(ctx)
		: config.prompt;

	// Expand template expressions in prompt
	const expandedPrompt = expandTemplate(rawPrompt, {
		state: ctx.state as Record<string, unknown>,
		signal: {
			name: ctx.signal.name,
			payload: ctx.signal.payload,
		},
		input: ctx.input,
	});

	// Build harness input with expanded prompt
	// Include outputSchema if agent has a JSON schema for structured output
	const harnessInput = {
		system: expandedPrompt,
		messages: [
			{
				role: "user" as const,
				content:
					typeof ctx.input === "string"
						? ctx.input
						: JSON.stringify(ctx.input),
			},
		],
		...(jsonSchema ? { outputSchema: jsonSchema } : {}),
	};

	const runContext = {
		signal: new AbortController().signal,
		runId: crypto.randomUUID(),
	};

	let output: unknown;
	let structuredOutput: unknown;

	// Stream signals from harness
	for await (const signal of harness.run(harnessInput, runContext)) {
		// Tag signal with agent name for debugging
		bus.emit(signal);

		// Capture output from harness:end
		if (signal.name === "harness:end") {
			const payload = signal.payload as {
				output?: { content?: unknown; structuredOutput?: unknown };
			};
			output = payload.output;
			// Extract structuredOutput from harness output if present
			if (
				payload.output &&
				typeof payload.output === "object" &&
				"structuredOutput" in payload.output
			) {
				structuredOutput = payload.output.structuredOutput;
			}
		}
	}

	// Fallback: If agent expects structured output but harness didn't provide it,
	// try to parse the text content as JSON. This handles cases where the SDK
	// doesn't return structured_output even when outputFormat is specified.
	if (structuredOutput === undefined && jsonSchema) {
		const outputObj = output as { content?: string } | undefined;
		if (outputObj?.content && typeof outputObj.content === "string") {
			const content = outputObj.content.trim();
			// Try to extract JSON from the response
			// Look for JSON object/array patterns
			const jsonMatch = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
			if (jsonMatch) {
				try {
					structuredOutput = JSON.parse(jsonMatch[0]);
				} catch {
					// JSON parsing failed, leave structuredOutput undefined
				}
			}
		}
	}

	return { output, structuredOutput };
}

/**
 * Replay recorded harness signals to the bus.
 *
 * Finds harness signals starting from the given index and emits them.
 * Returns the output from the harness:end signal in AgentExecutionResult format.
 *
 * @param bus - SignalBus to emit signals to
 * @param signals - All recorded signals
 * @param startIndex - Index to start searching from
 * @returns AgentExecutionResult with output and structuredOutput
 */
async function replayHarnessSignals(
	bus: { emit: (signal: Signal) => void },
	signals: readonly Signal[],
	startIndex: number,
): Promise<AgentExecutionResult> {
	let output: unknown;
	let structuredOutput: unknown;

	// Harness signal prefixes to replay
	const harnessPrefixes = ["harness:", "text:", "tool:", "thinking:"];

	// Find and emit harness signals from startIndex until harness:end
	let foundStart = false;
	for (let i = startIndex; i < signals.length; i++) {
		const signal = signals[i];
		if (!signal) continue;

		const isHarnessSignal = harnessPrefixes.some((prefix) =>
			signal.name.startsWith(prefix),
		);

		if (isHarnessSignal) {
			foundStart = true;
			bus.emit(signal);

			// Capture output from harness:end
			if (signal.name === "harness:end") {
				const payload = signal.payload as { output?: unknown };
				output = payload.output;

				// Try to extract structuredOutput from the recorded output
				// This mirrors the JSON fallback parsing in executeAgent
				const outputObj = output as { content?: string; structuredOutput?: unknown } | undefined;
				if (outputObj?.structuredOutput) {
					structuredOutput = outputObj.structuredOutput;
				} else if (outputObj?.content && typeof outputObj.content === "string") {
					// Fallback: try to parse JSON from the text content
					const content = outputObj.content.trim();
					if (content.startsWith("{") || content.startsWith("[")) {
						const jsonMatch = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
						if (jsonMatch) {
							try {
								structuredOutput = JSON.parse(jsonMatch[0]);
							} catch {
								// JSON parsing failed, leave structuredOutput undefined
							}
						}
					}
				}

				break; // Stop at first harness:end
			}
		} else if (foundStart) {
			// If we started seeing harness signals but hit a non-harness signal,
			// we've moved past this harness sequence
			break;
		}
	}

	return { output, structuredOutput };
}
