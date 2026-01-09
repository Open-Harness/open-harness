/**
 * Reactive execution for signal-based agents.
 *
 * Executes a reactive agent in a signal-driven environment where:
 * - Agents subscribe to signals via `activateOn` patterns
 * - Provider calls emit signals to the SignalBus
 * - Declared `emits` signals fire after agent completion
 *
 * @example
 * ```ts
 * import { agent, runReactive } from "@open-harness/core"
 * import { ClaudeProvider } from "@signals/provider-claude"
 *
 * const analyst = agent({
 *   prompt: "Analyze the input.",
 *   activateOn: ["harness:start"],
 *   emits: ["analysis:complete"],
 *   signalProvider: new ClaudeProvider(),
 * })
 *
 * const result = await runReactive(analyst, { data: "market info" })
 * console.log(result.signals) // All signals emitted during execution
 * ```
 */

import {
	SignalBus,
	type SignalPattern,
} from "@signals/bus";
import {
	createSignal,
	type Provider,
	type ProviderInput,
	type RunContext,
	type Signal,
} from "@signals/core";
import type { ReactiveAgent, ActivationContext } from "./types.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Options for runReactive execution.
 */
export type RunReactiveOptions = {
	/**
	 * Default provider if agent doesn't specify signalProvider.
	 * Required if agent has no signalProvider set.
	 */
	provider?: Provider;

	/**
	 * Abort signal for cancellation.
	 */
	signal?: AbortSignal;

	/**
	 * Run ID for correlation across signals.
	 * Auto-generated if not provided.
	 */
	runId?: string;
};

/**
 * Result of reactive execution.
 */
export type RunReactiveResult<T = unknown> = {
	/**
	 * Final output from the agent.
	 */
	output: T;

	/**
	 * All signals emitted during execution.
	 * Includes harness lifecycle, provider signals, and agent emits.
	 */
	signals: readonly Signal[];

	/**
	 * Execution metrics.
	 */
	metrics: {
		/**
		 * Total execution time in milliseconds.
		 */
		durationMs: number;

		/**
		 * Number of times the agent was activated.
		 */
		activations: number;
	};
};

// ============================================================================
// Implementation
// ============================================================================

/**
 * Execute a single reactive agent.
 *
 * Flow:
 * 1. Creates SignalBus for signal routing
 * 2. Subscribes agent based on activateOn patterns
 * 3. Emits harness:start to trigger subscribed agents
 * 4. Checks guard condition (when)
 * 5. Executes provider.run() and emits all signals
 * 6. Emits declared signals from `emits`
 * 7. Emits harness:end
 * 8. Returns result with full signal history
 *
 * @param agent - A reactive agent (must have activateOn defined)
 * @param input - Input to pass to the agent
 * @param options - Execution options
 * @returns Result containing output, signals, and metrics
 *
 * @throws Error if no provider is specified
 */
export async function runReactive<TOutput, TState>(
	agent: ReactiveAgent<TOutput, TState>,
	input: unknown,
	options?: RunReactiveOptions,
): Promise<RunReactiveResult<TOutput>> {
	const startTime = Date.now();
	const runId = options?.runId ?? crypto.randomUUID();
	const bus = new SignalBus();

	// Get provider (agent override or default from options)
	const provider = agent.config.signalProvider ?? options?.provider;
	if (!provider) {
		throw new Error(
			"No provider specified. Set signalProvider on agent or provide default in options.",
		);
	}

	// Track execution state
	let activations = 0;
	let output: TOutput | undefined;
	let activationPromise: Promise<void> | null = null;

	// Get activation patterns (default to harness:start if not specified)
	const patterns: SignalPattern[] = agent.config.activateOn ?? ["harness:start"];

	// Subscribe agent to its activation patterns
	bus.subscribe(patterns, async (triggerSignal) => {
		// Build activation context for guard check
		const ctx: ActivationContext<TState> = {
			signal: triggerSignal,
			state: (agent.config.state ?? {}) as TState,
			input,
		};

		// Check guard condition
		if (agent.config.when && !agent.config.when(ctx)) {
			// Guard blocked activation - emit blocked signal for debugging
			bus.emit(
				createSignal("agent:blocked", {
					reason: "guard",
					trigger: triggerSignal.name,
				}),
			);
			return;
		}

		// Mark activation
		activations++;
		bus.emit(
			createSignal("agent:activated", {
				trigger: triggerSignal.name,
			}),
		);

		// Execute provider and emit all signals
		activationPromise = executeProvider(
			bus,
			provider as Provider,
			input,
			agent.config.prompt,
			{
				signal: options?.signal ?? new AbortController().signal,
				runId,
			},
		).then((result) => {
			output = result as TOutput;

			// Emit declared signals from `emits`
			for (const signalName of agent.config.emits ?? []) {
				bus.emit(
					createSignal(signalName, {
						output: result,
					}),
				);
			}
		});

		await activationPromise;
	});

	// Emit harness:start to trigger subscribed agents
	bus.emit(
		createSignal("harness:start", {
			input,
			runId,
		}),
	);

	// Wait for activation to complete
	// For single agent, we just await the activation promise
	// Multi-agent quiescence detection will be added in E1
	if (activationPromise) {
		await activationPromise;
	}

	// Calculate duration and emit harness:end
	const durationMs = Date.now() - startTime;
	bus.emit(
		createSignal("harness:end", {
			durationMs,
			output,
			runId,
		}),
	);

	return {
		output: output as TOutput,
		signals: bus.history(),
		metrics: {
			durationMs,
			activations,
		},
	};
}

/**
 * Execute a provider and emit all its signals to the bus.
 *
 * The provider is an async generator that yields signals as it streams.
 * We iterate over it, emitting each signal to the bus for subscribers.
 *
 * @param bus - SignalBus to emit signals to
 * @param provider - Provider to execute
 * @param input - User input
 * @param prompt - Agent prompt
 * @param ctx - Run context with abort signal and run ID
 * @returns Final output from the provider
 */
async function executeProvider(
	bus: SignalBus,
	provider: Provider,
	input: unknown,
	prompt: string,
	ctx: RunContext,
): Promise<unknown> {
	// Build provider input
	const providerInput: ProviderInput = {
		system: prompt,
		messages: [
			{
				role: "user",
				content: typeof input === "string" ? input : JSON.stringify(input),
			},
		],
	};

	let output: unknown;

	// Iterate over provider signals and emit to bus
	for await (const signal of provider.run(providerInput, ctx)) {
		bus.emit(signal);

		// Capture final output from provider:end signal
		if (signal.name === "provider:end") {
			const payload = signal.payload as { output?: unknown };
			output = payload.output;
		}
	}

	return output;
}
