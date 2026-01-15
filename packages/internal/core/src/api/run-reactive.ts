/**
 * Reactive execution for signal-based agents.
 *
 * Executes a reactive agent in a signal-driven environment where:
 * - Agents subscribe to signals via `activateOn` patterns
 * - Harness calls emit signals to the SignalBus
 * - Declared `emits` signals fire after agent completion
 *
 * @example
 * ```ts
 * import { agent, runReactive } from "@open-harness/core"
 * import { ClaudeHarness } from "@open-harness/claude"
 *
 * const analyst = agent({
 *   prompt: "Analyze the input.",
 *   activateOn: ["workflow:start"],
 *   emits: ["analysis:complete"],
 *   signalHarness: new ClaudeHarness(),
 * })
 *
 * const result = await runReactive(analyst, { data: "market info" })
 * console.log(result.signals) // All signals emitted during execution
 * ```
 */

import {
	SignalBus,
	type SignalPattern,
	type SignalStore,
	type Recording,
} from "@internal/signals";
import {
	createSignal,
	type Harness,
	type HarnessInput,
	type RunContext,
	type Signal,
} from "@internal/signals-core";
import type { ReactiveAgent, LoggingConfig } from "./types.js";
import { createLogger, subscribeSignalLogger } from "../lib/logger/index.js";
import { createSignalConsole } from "../lib/logger/signal-console.js";

// ============================================================================
// Recording Types
// ============================================================================

/**
 * Recording mode for signal capture and replay.
 *
 * - 'live': Execute harness, no recording (default)
 * - 'record': Execute harness, save signals to store
 * - 'replay': Load signals from store, skip harness
 */
export type SignalRecordingMode = "live" | "record" | "replay";

/**
 * Options for signal recording and replay.
 */
export type SignalRecordingOptions = {
	/**
	 * Recording mode.
	 * @default 'live'
	 */
	mode?: SignalRecordingMode;

	/**
	 * Signal store for persistence.
	 * Required for 'record' and 'replay' modes.
	 */
	store?: SignalStore;

	/**
	 * Recording ID for replay mode.
	 * Required when mode is 'replay'.
	 */
	recordingId?: string;

	/**
	 * Name for new recordings (record mode).
	 * Auto-generated if not provided.
	 */
	name?: string;

	/**
	 * Tags for new recordings (record mode).
	 */
	tags?: string[];
};

// ============================================================================
// Types
// ============================================================================

/**
 * Options for runReactive execution.
 */
export type RunReactiveOptions = {
	/**
	 * Default harness if agent doesn't specify signalHarness.
	 * Required if agent has no signalHarness set (unless in replay mode).
	 */
	harness?: Harness;

	/**
	 * Abort signal for cancellation.
	 */
	signal?: AbortSignal;

	/**
	 * Run ID for correlation across signals.
	 * Auto-generated if not provided.
	 */
	runId?: string;

	/**
	 * Recording options for signal capture and replay.
	 *
	 * @example Record mode - save signals to store
	 * ```ts
	 * const result = await runReactive(agent, input, {
	 *   harness,
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
	 * const result = await runReactive(agent, input, {
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
	 * Logging configuration for automatic signal logging.
	 *
	 * Default (batteries included):
	 * - console: true - see what's happening
	 * - file: false - opt-in for persistence
	 * - level: "info" - lifecycle events
	 *
	 * Set to false to disable all logging.
	 *
	 * @example Enable file logging
	 * ```ts
	 * const result = await runReactive(agent, input, {
	 *   harness,
	 *   logging: { file: true }
	 * })
	 * ```
	 *
	 * @example Debug mode
	 * ```ts
	 * const result = await runReactive(agent, input, {
	 *   harness,
	 *   logging: { level: "debug" }
	 * })
	 * ```
	 *
	 * @example Disable logging
	 * ```ts
	 * const result = await runReactive(agent, input, {
	 *   harness,
	 *   logging: false
	 * })
	 * ```
	 */
	logging?: LoggingConfig | false;
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
	 * Includes workflow lifecycle, harness signals, and agent emits.
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

	/**
	 * Recording ID when recording mode was used.
	 * Use this ID for later replay.
	 */
	recordingId?: string;
};

// ============================================================================
// Implementation
// ============================================================================

/**
 * Execute a single reactive agent.
 *
 * Flow:
 * 1. Creates SignalBus for signal routing
 * 2. (Record mode) Creates recording in store
 * 3. (Replay mode) Loads recording from store
 * 4. Subscribes agent based on activateOn patterns
 * 5. Emits workflow:start to trigger subscribed agents
 * 6. Executes harness.run() OR replays signals
 * 7. Emits declared signals from `emits`
 * 8. Emits workflow:end
 * 9. (Record mode) Finalizes recording
 * 10. Returns result with full signal history
 *
 * @param agent - A reactive agent (must have activateOn defined)
 * @param input - Input to pass to the agent
 * @param options - Execution options
 * @returns Result containing output, signals, and metrics
 *
 * @throws Error if no harness is specified (live/record mode)
 * @throws Error if no store is specified (record/replay mode)
 * @throws Error if recording not found (replay mode)
 */
export async function runReactive<TOutput>(
	agent: ReactiveAgent<TOutput>,
	input: unknown,
	options?: RunReactiveOptions,
): Promise<RunReactiveResult<TOutput>> {
	const startTime = Date.now();
	const runId = options?.runId ?? crypto.randomUUID();
	const bus = new SignalBus();

	// Setup logging (v3.2 - batteries included with pretty signal console)
	// Default: console: true (pretty signal console), file: false
	let unsubscribeLogger: (() => void) | undefined;
	let unsubscribeSignalConsole: (() => void) | undefined;
	if (options?.logging !== false) {
		const loggingConfig = options?.logging ?? {};
		const consoleMode = loggingConfig.console ?? true;
		const level = loggingConfig.level ?? "info";

		// Console output: pretty signal console (default), JSON (Pino), or disabled
		if (consoleMode === true || consoleMode === "pretty") {
			// v3.2: Pretty signal console - clean, color-coded output
			// Note: createSignalConsole accepts both old (info/debug/trace) and new (quiet/normal/verbose)
			// level names and normalizes internally for backward compatibility
			const signalConsole = createSignalConsole({ level });
			unsubscribeSignalConsole = bus.subscribe(["**"], signalConsole);
		} else if (consoleMode === "json") {
			// JSON mode: use Pino for structured logging
			const logger = createLogger({
				console: true,
				file: loggingConfig.file ?? false,
				level,
				logDir: loggingConfig.logDir ?? ".open-harness/logs",
			});
			unsubscribeLogger = subscribeSignalLogger(bus, logger, { runId });
		}

		// File logging (if enabled, always uses Pino)
		if (loggingConfig.file && consoleMode !== "json") {
			// Only create file logger if we're not already using JSON mode (which handles both)
			const logger = createLogger({
				console: false, // Don't duplicate console output
				file: true,
				level,
				logDir: loggingConfig.logDir ?? ".open-harness/logs",
			});
			unsubscribeLogger = subscribeSignalLogger(bus, logger, { runId });
		}
	}

	// Determine recording mode
	const recordingMode = options?.recording?.mode ?? "live";
	const store = options?.recording?.store;

	// Validate recording options
	if (recordingMode === "record" && !store) {
		throw new Error("Recording mode 'record' requires a store.");
	}
	if (recordingMode === "replay" && !store) {
		throw new Error("Recording mode 'replay' requires a store.");
	}
	if (recordingMode === "replay" && !options?.recording?.recordingId) {
		throw new Error("Recording mode 'replay' requires a recordingId.");
	}

	// Load recording for replay mode
	let replayRecording: Recording | null = null;
	if (recordingMode === "replay" && store && options?.recording?.recordingId) {
		replayRecording = await store.load(options.recording.recordingId);
		if (!replayRecording) {
			throw new Error(`Recording not found: ${options.recording.recordingId}`);
		}
	}

	// Get harness (not required for replay mode)
	const harness = agent.config.signalHarness ?? options?.harness;
	if (recordingMode !== "replay" && !harness) {
		throw new Error(
			"No harness specified. Set signalHarness on agent or provide default in options.",
		);
	}

	// Create recording for record mode
	let recordingId: string | undefined;
	const recordedSignals: Signal[] = [];
	if (recordingMode === "record" && store) {
		recordingId = await store.create({
			name: options?.recording?.name,
			tags: options?.recording?.tags,
		});

		// Collect signals synchronously for batch append later
		// (bus.subscribe handlers don't block emission, so we collect instead)
		// Use "**" pattern to match all signals across segments
		bus.subscribe(["**"], (signal) => {
			recordedSignals.push(signal);
		});
	}

	// Track execution state
	let activations = 0;
	let output: TOutput | undefined;
	let activationPromise: Promise<void> | null = null;

	// Get activation patterns (default to workflow:start if not specified)
	const patterns: SignalPattern[] = agent.config.activateOn ?? ["workflow:start"];

	// Subscribe agent to its activation patterns
	bus.subscribe(patterns, async (triggerSignal) => {
		// Mark activation
		activations++;
		bus.emit(
			createSignal("agent:activated", {
				trigger: triggerSignal.name,
			}),
		);

		if (recordingMode === "replay" && replayRecording) {
			// Replay mode: emit recorded signals instead of calling harness
			activationPromise = replaySignals(bus, replayRecording.signals).then(
				(result) => {
					output = result as TOutput;

					// Emit declared signals from `emits`
					for (const signalName of agent.config.emits ?? []) {
						bus.emit(
							createSignal(signalName, {
								output: result,
							}),
						);
					}
				},
			);
		} else {
			// Live/record mode: execute harness
			activationPromise = executeHarness(
				bus,
				harness as Harness,
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
		}

		await activationPromise;
	});

	// Emit workflow:start to trigger subscribed agents
	bus.emit(
		createSignal("workflow:start", {
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

	// Calculate duration and emit workflow:end
	const durationMs = Date.now() - startTime;
	bus.emit(
		createSignal("workflow:end", {
			durationMs,
			output,
			runId,
		}),
	);

	// Finalize recording - batch append all collected signals
	if (recordingMode === "record" && store && recordingId) {
		if (recordedSignals.length > 0) {
			await store.appendBatch(recordingId, recordedSignals);
		}
		await store.finalize(recordingId, durationMs);
	}

	// Cleanup logger subscriptions
	if (unsubscribeLogger) {
		unsubscribeLogger();
	}
	if (unsubscribeSignalConsole) {
		unsubscribeSignalConsole();
	}

	return {
		output: output as TOutput,
		signals: bus.history(),
		metrics: {
			durationMs,
			activations,
		},
		recordingId,
	};
}

/**
 * Execute a harness and emit all its signals to the bus.
 *
 * The harness is an async generator that yields signals as it streams.
 * We iterate over it, emitting each signal to the bus for subscribers.
 *
 * @param bus - SignalBus to emit signals to
 * @param harness - Harness to execute
 * @param input - User input
 * @param prompt - Agent prompt
 * @param ctx - Run context with abort signal and run ID
 * @returns Final output from the harness
 */
async function executeHarness(
	bus: SignalBus,
	harness: Harness,
	input: unknown,
	prompt: string,
	ctx: RunContext,
): Promise<unknown> {
	// Build harness input
	const harnessInput: HarnessInput = {
		system: prompt,
		messages: [
			{
				role: "user",
				content: typeof input === "string" ? input : JSON.stringify(input),
			},
		],
	};

	let output: unknown;

	// Iterate over harness signals and emit to bus
	for await (const signal of harness.run(harnessInput, ctx)) {
		bus.emit(signal);

		// Capture final output from harness:end signal
		if (signal.name === "harness:end") {
			const payload = signal.payload as { output?: unknown };
			output = payload.output;
		}
	}

	return output;
}

/**
 * Replay recorded signals to the bus.
 *
 * Filters out workflow lifecycle signals (workflow:start, workflow:end, agent:activated)
 * since those are generated fresh during replay. Only emits harness signals.
 *
 * @param bus - SignalBus to emit signals to
 * @param signals - Recorded signals to replay
 * @returns Final output from the harness:end signal
 */
async function replaySignals(
	bus: SignalBus,
	signals: readonly Signal[],
): Promise<unknown> {
	let output: unknown;

	// Harness signal prefixes to replay
	const harnessPrefixes = ["harness:", "text:", "tool:", "thinking:"];

	for (const signal of signals) {
		// Only replay harness signals, skip workflow lifecycle
		const isHarnessSignal = harnessPrefixes.some((prefix) =>
			signal.name.startsWith(prefix),
		);

		if (isHarnessSignal) {
			bus.emit(signal);

			// Capture final output from harness:end signal
			if (signal.name === "harness:end") {
				const payload = signal.payload as { output?: unknown };
				output = payload.output;
			}
		}
	}

	return output;
}
