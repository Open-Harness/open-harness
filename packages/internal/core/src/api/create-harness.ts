/**
 * Harness-scoped factory for creating typed reactive agents.
 *
 * This pattern solves the TypeScript variance problem by scoping all agents
 * to a single state type. Agents created from the same factory share the same
 * TState, eliminating contravariance issues in `when` guards.
 *
 * @example
 * ```ts
 * import { createHarness } from "@open-harness/core"
 *
 * type TradingState = {
 *   confidence: number
 *   position: "long" | "short" | null
 *   balance: number
 * }
 *
 * // Create typed factory
 * const { agent, runReactive } = createHarness<TradingState>()
 *
 * // All agents have typed state access in `when`
 * const analyst = agent({
 *   prompt: "Analyze market data",
 *   activateOn: ["harness:start"],
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
import type { Signal, Provider as SignalProvider } from "@internal/signals-core";
import type { SignalPattern, SignalStore, Recording } from "@internal/signals";
import type { SignalRecordingOptions } from "./run-reactive.js";

// ============================================================================
// Timeout Error
// ============================================================================

/**
 * Error thrown when harness execution exceeds the configured timeout.
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
 * - Current harness state (fully typed!)
 * - Input that started the run
 */
export type ActivationContext<TState> = {
	/**
	 * The signal that triggered this activation check.
	 */
	signal: Signal;

	/**
	 * Current harness state (typed based on harness definition).
	 */
	state: Readonly<TState>;

	/**
	 * Original input passed to runReactive.
	 */
	input: unknown;
};

// ============================================================================
// Reactive Agent Config (harness-scoped)
// ============================================================================

/**
 * Configuration for a reactive agent within a harness scope.
 *
 * The TState type parameter is fixed by the harness factory,
 * so all agents share the same state type - no variance issues!
 */
export type ReactiveAgentConfig<TOutput, TState> = {
	/**
	 * System prompt that defines the agent's behavior.
	 */
	prompt: string;

	/**
	 * Optional output configuration with Zod schema.
	 */
	output?: {
		schema?: ZodType<TOutput>;
	};

	/**
	 * Signal patterns that trigger this agent.
	 * Uses glob syntax: "harness:start", "state:*:changed", "trade:**"
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
	 * Has full typed access to harness state!
	 */
	when?: (ctx: ActivationContext<TState>) => boolean;

	/**
	 * Per-agent provider override.
	 */
	signalProvider?: SignalProvider;

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
	 *   activateOn: ["harness:start"],
	 *   emits: ["greeting:created"],
	 *   updates: "greeting",  // state.greeting = output
	 * })
	 * ```
	 */
	updates?: keyof TState & string;
};

/**
 * A reactive agent created from a harness factory.
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
// Harness Run Config
// ============================================================================

/**
 * Configuration for running a reactive harness.
 */
export type ReactiveHarnessConfig<TState> = {
	/**
	 * Named agents to include in the harness.
	 * All agents must be created from the same factory.
	 */
	agents: Record<string, ScopedReactiveAgent<unknown, TState>>;

	/**
	 * Initial state for the harness.
	 */
	state: TState;

	/**
	 * Default provider for agents that don't specify signalProvider.
	 */
	provider?: SignalProvider;

	/**
	 * Abort signal for cancellation.
	 */
	signal?: AbortSignal;

	/**
	 * Timeout in milliseconds for the entire harness run.
	 * If exceeded, throws a TimeoutError.
	 * @default undefined (no timeout)
	 */
	timeout?: number;

	/**
	 * Termination condition that ends the harness early.
	 * When this returns true, the harness stops accepting new signals
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
	 * // No provider calls made - signals injected from recording
	 * ```
	 */
	recording?: SignalRecordingOptions;

	/**
	 * Signal reducers for complex state updates.
	 *
	 * Reducers are called when matching signals are emitted,
	 * allowing state mutations based on signal payloads.
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
	 *       state.greeting = signal.payload.output as string;
	 *       state.count++;
	 *     }
	 *   }
	 * })
	 * ```
	 */
	reducers?: SignalReducers<TState>;
};

/**
 * Signal reducer function type.
 * Receives mutable state and the triggering signal.
 */
export type SignalReducer<TState> = (state: TState, signal: Signal) => void;

/**
 * Map of signal patterns to reducer functions.
 */
export type SignalReducers<TState> = Record<string, SignalReducer<TState>>;

/**
 * Result from running a reactive harness.
 */
export type ReactiveHarnessResult<TState> = {
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
	 * Whether the harness terminated early due to endWhen condition.
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
 * The factory returned by createHarness<TState>().
 *
 * Contains typed versions of agent() and runReactive() that
 * are scoped to the harness state type.
 */
export type HarnessFactory<TState> = {
	/**
	 * Create a reactive agent with typed state access.
	 *
	 * @example
	 * ```ts
	 * const analyst = agent({
	 *   prompt: "Analyze data",
	 *   activateOn: ["harness:start"],
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
		config: ReactiveHarnessConfig<TState>,
	) => Promise<ReactiveHarnessResult<TState>>;
};

// ============================================================================
// Factory Implementation
// ============================================================================

/**
 * Create a harness factory scoped to a specific state type.
 *
 * All agents created from this factory share the same TState type,
 * which eliminates TypeScript variance issues in `when` guards.
 *
 * @example
 * ```ts
 * type MyState = { count: number; ready: boolean }
 *
 * const { agent, runReactive } = createHarness<MyState>()
 *
 * const counter = agent({
 *   prompt: "Increment counter",
 *   activateOn: ["harness:start"],
 *   when: (ctx) => ctx.state.ready,  // Full type safety!
 * })
 *
 * await runReactive({
 *   agents: { counter },
 *   state: { count: 0, ready: true },
 * })
 * ```
 */
export function createHarness<TState>(): HarnessFactory<TState> {
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
		config: ReactiveHarnessConfig<TState>,
	): Promise<ReactiveHarnessResult<TState>> {
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

		// Mutable state - will be updated by agents and reducers
		let state = { ...config.state };
		let activations = 0;
		let terminated = false; // Set by endWhen condition

		// Track pending activations for quiescence detection
		// Use a Set to handle chained activations properly
		const pending = new Set<Promise<void>>();

		// Subscribe reducers to apply state mutations on matching signals
		const reducers = config.reducers ?? {};
		for (const [signalPattern, reducer] of Object.entries(reducers)) {
			bus.subscribe([signalPattern], (signal) => {
				reducer(state, signal);
			});
		}

		// Subscribe each agent to its activation patterns
		for (const [name, scopedAgent] of Object.entries(config.agents)) {
			const agentConfig = scopedAgent.config;
			const patterns = agentConfig.activateOn;

			bus.subscribe(patterns, async (triggerSignal) => {
				// Skip new activations if harness is terminated
				if (terminated) {
					bus.emit(
						createSignal("agent:skipped", {
							agent: name,
							reason: "harness terminated by endWhen",
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

				// Get provider (not required for replay mode)
				const provider = agentConfig.signalProvider ?? config.provider;
				if (recordingMode !== "replay" && !provider) {
					throw new Error(
						`No provider for agent "${name}". Set signalProvider on agent or provide default.`,
					);
				}

				// Execute provider OR replay recorded signals
				const activationPromise = (async () => {
					let result: unknown;

					if (recordingMode === "replay" && replayRecording) {
						// Replay mode: inject recorded provider signals
						result = await replayProviderSignals(
							bus,
							replayRecording.signals,
							replaySignalIndex,
						);
						// Update index for next activation (find next provider:end)
						for (
							let i = replaySignalIndex;
							i < replayRecording.signals.length;
							i++
						) {
							if (replayRecording.signals[i]?.name === "provider:end") {
								replaySignalIndex = i + 1;
								break;
							}
						}
					} else if (provider) {
						// Live/record mode: execute provider
						result = await executeAgent(
							bus,
							provider,
							agentConfig,
							name,
							ctx,
							createSignal,
							activatedSignal.id,
						);
					}

					return result;
				})().then((result) => {
					// Apply `updates` field - update state with agent output
					if (agentConfig.updates && result !== undefined) {
						const field = agentConfig.updates;
						(state as Record<string, unknown>)[field] = result;

						// Emit state change signal for reactive subscribers
						bus.emit(
							createSignal(
								`state:${field}:changed`,
								{
									key: field,
									oldValue: (config.state as Record<string, unknown>)[field],
									newValue: result,
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
							createSignal("harness:terminating", {
								reason: "endWhen condition met",
								agent: name,
								state,
							}),
						);
					}

					// Emit declared signals with causality tracking
					// These may be skipped by handlers if terminated is true
					for (const signalName of agentConfig.emits ?? []) {
						bus.emit(
							createSignal(
								signalName,
								{
									agent: name,
									output: result,
								},
								{ agent: name, parent: activatedSignal.id },
							),
						);
					}
				});

				// Track and auto-remove when complete
				pending.add(activationPromise);
				activationPromise.finally(() => pending.delete(activationPromise));
			});
		}

		// Emit harness:start to trigger subscribed agents
		bus.emit(
			createSignal("harness:start", {
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
							`Harness execution exceeded timeout of ${config.timeout}ms`,
							config.timeout!,
						),
					);
				}, config.timeout);
			});

			await Promise.race([quiescence(), timeoutPromise]);
		} else {
			await quiescence();
		}

		// Emit harness:end
		const durationMs = Date.now() - startTime;
		bus.emit(
			createSignal("harness:end", {
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
	}

	return { agent, runReactive };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Execute an agent's provider and return the result.
 */
async function executeAgent<TOutput, TState>(
	bus: { emit: (signal: Signal) => void },
	provider: SignalProvider,
	config: ReactiveAgentConfig<TOutput, TState>,
	agentName: string,
	ctx: ActivationContext<TState>,
	createSignal: (
		name: string,
		payload: unknown,
		source?: { agent?: string; provider?: string; parent?: string },
	) => Signal,
	parentSignalId: string,
): Promise<unknown> {
	// Import template engine
	const { expandTemplate } = await import("./template.js");

	// Expand template expressions in prompt
	const expandedPrompt = expandTemplate(config.prompt, {
		state: ctx.state as Record<string, unknown>,
		signal: {
			name: ctx.signal.name,
			payload: ctx.signal.payload,
		},
		input: ctx.input,
	});

	// Build provider input with expanded prompt
	const providerInput = {
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
	};

	const runContext = {
		signal: new AbortController().signal,
		runId: crypto.randomUUID(),
	};

	let output: unknown;

	// Stream signals from provider
	for await (const signal of provider.run(providerInput, runContext)) {
		// Tag signal with agent name for debugging
		bus.emit(signal);

		// Capture output from provider:end
		if (signal.name === "provider:end") {
			const payload = signal.payload as { output?: unknown };
			output = payload.output;
		}
	}

	return output;
}

/**
 * Replay recorded provider signals to the bus.
 *
 * Finds provider signals starting from the given index and emits them.
 * Returns the output from the provider:end signal.
 *
 * @param bus - SignalBus to emit signals to
 * @param signals - All recorded signals
 * @param startIndex - Index to start searching from
 * @returns Final output from the provider:end signal
 */
async function replayProviderSignals(
	bus: { emit: (signal: Signal) => void },
	signals: readonly Signal[],
	startIndex: number,
): Promise<unknown> {
	let output: unknown;

	// Provider signal prefixes to replay
	const providerPrefixes = ["provider:", "text:", "tool:", "thinking:"];

	// Find and emit provider signals from startIndex until provider:end
	let foundStart = false;
	for (let i = startIndex; i < signals.length; i++) {
		const signal = signals[i];
		if (!signal) continue;

		const isProviderSignal = providerPrefixes.some((prefix) =>
			signal.name.startsWith(prefix),
		);

		if (isProviderSignal) {
			foundStart = true;
			bus.emit(signal);

			// Capture output from provider:end
			if (signal.name === "provider:end") {
				const payload = signal.payload as { output?: unknown };
				output = payload.output;
				break; // Stop at first provider:end
			}
		} else if (foundStart) {
			// If we started seeing provider signals but hit a non-provider signal,
			// we've moved past this provider sequence
			break;
		}
	}

	return output;
}
