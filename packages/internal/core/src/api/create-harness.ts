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
import type { Signal, Provider as SignalProvider } from "@signals/core";
import type { SignalPattern } from "@signals/bus";

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
};

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
		const { SignalBus } = await import("@signals/bus");
		const { createSignal } = await import("@signals/core");

		const startTime = Date.now();
		const bus = new SignalBus();

		// Mutable state - will be updated by agents
		let state = { ...config.state };
		let activations = 0;

		// Track pending activations for quiescence detection
		// Use a Set to handle chained activations properly
		const pending = new Set<Promise<void>>();

		// Subscribe each agent to its activation patterns
		for (const [name, scopedAgent] of Object.entries(config.agents)) {
			const agentConfig = scopedAgent.config;
			const patterns = agentConfig.activateOn;

			bus.subscribe(patterns, async (triggerSignal) => {
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

				// Get provider
				const provider = agentConfig.signalProvider ?? config.provider;
				if (!provider) {
					throw new Error(
						`No provider for agent "${name}". Set signalProvider on agent or provide default.`,
					);
				}

				// Execute provider (simplified for prototype)
				const activationPromise = executeAgent(
					bus,
					provider,
					agentConfig,
					name,
					ctx,
					createSignal,
					activatedSignal.id, // Pass parent signal ID for causality
				).then((result) => {
					// Emit declared signals with causality tracking
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

		return {
			state,
			signals: bus.history(),
			metrics: {
				durationMs,
				activations,
			},
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
