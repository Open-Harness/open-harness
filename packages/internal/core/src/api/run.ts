/**
 * Unified run function for executing agents and harnesses.
 *
 * This is the primary entry point for running Open Harness workflows.
 * It handles both single agents and multi-agent harnesses with a
 * consistent interface.
 *
 * @example
 * ```ts
 * import { agent, harness, run } from "@open-harness/core"
 *
 * // Run a single agent
 * const myAgent = agent({ prompt: "You are helpful." })
 * const result = await run(myAgent, { prompt: "Hello!" })
 *
 * // Run with fixture recording
 * const result = await run(myAgent, { prompt: "Hello!" }, {
 *   fixture: "my-test",
 *   mode: "record",
 *   store,
 * })
 *
 * // Run a harness
 * const workflow = harness({ agents: {...}, edges: [...] })
 * const result = await run(workflow, { task: "Build something" })
 * ```
 */

import type {
	Agent,
	Harness,
	RunOptions,
	RunResult,
	RunMetrics,
	FixtureMode,
	AgentInput,
	AgentOutput,
	Provider,
	FixtureStore,
} from "./types.js";
import { isAgent, isHarness } from "./types.js";
import { getDefaultProvider, getDefaultMode, getDefaultStore } from "./defaults.js";
import type { HarnessWithFlow } from "./harness.js";
import type { NodeRunContext } from "../nodes/registry.js";
import type { RuntimeEventPayload, StateStore } from "../state/index.js";
import type { Recording, RecordingMetadata } from "../recording/types.js";
import { z } from "zod";

/**
 * Safely get environment variable (works in Node.js and browsers).
 */
function getEnvVar(name: string): string | undefined {
	if (typeof globalThis !== "undefined" && "process" in globalThis) {
		const proc = (globalThis as { process?: { env?: Record<string, string> } }).process;
		return proc?.env?.[name];
	}
	return undefined;
}

/**
 * Get the fixture mode from options or environment variable.
 *
 * Priority: explicit option > FIXTURE_MODE env var > default mode > "live"
 */
function getFixtureMode(options?: RunOptions): FixtureMode {
	if (options?.mode) {
		return options.mode;
	}

	const envMode = getEnvVar("FIXTURE_MODE");
	if (envMode === "record" || envMode === "replay" || envMode === "live") {
		return envMode;
	}

	// Use default mode from setDefaultMode(), which returns "live" if not set
	return getDefaultMode();
}

/**
 * Generate fixture IDs for multi-agent harnesses.
 *
 * Format: `<fixture>_<agentId>_inv<invocationNumber>`
 *
 * Uses underscores to create flat file-friendly IDs that work with
 * FileRecordingStore's single-directory structure.
 *
 * @param baseFixture - Base fixture name
 * @param agentId - Agent identifier
 * @param invocation - Invocation number (0-indexed)
 * @returns Flat fixture ID
 */
export function generateFixtureId(
	baseFixture: string,
	agentId: string,
	invocation: number,
): string {
	return `${baseFixture}_${agentId}_inv${invocation}`;
}

/**
 * Get provider from options or default.
 * Throws if no provider available.
 */
function getProvider(options?: RunOptions): Provider {
	const provider = options?.provider ?? getDefaultProvider();
	if (!provider) {
		throw new Error(
			"No provider configured. Either pass a provider in run() options or call setDefaultProvider() first.",
		);
	}
	return provider;
}

/**
 * Create a minimal in-memory state store for single agent execution.
 */
function createMinimalStateStore(initial: Record<string, unknown> = {}): StateStore {
	const state = { ...initial };
	return {
		get(path: string): unknown {
			if (!path) return state;
			const parts = path.split(".");
			let current: unknown = state;
			for (const part of parts) {
				if (current && typeof current === "object" && part in current) {
					current = (current as Record<string, unknown>)[part];
				} else {
					return undefined;
				}
			}
			return current;
		},
		set(path: string, value: unknown): void {
			if (!path) {
				Object.assign(state, value);
				return;
			}
			const parts = path.split(".");
			let current: Record<string, unknown> = state;
			for (let i = 0; i < parts.length - 1; i++) {
				const part = parts[i];
				if (part === undefined) continue;
				if (!current[part] || typeof current[part] !== "object") {
					current[part] = {};
				}
				current = current[part] as Record<string, unknown>;
			}
			const lastPart = parts[parts.length - 1];
			if (lastPart) {
				current[lastPart] = value;
			}
		},
		patch(patch: { op: "set" | "merge"; path: string; value: unknown }): void {
			if (patch.op === "set") {
				this.set(patch.path, patch.value);
			} else {
				const existing = this.get(patch.path);
				const merged = existing && typeof existing === "object"
					? { ...(existing as Record<string, unknown>), ...(patch.value as Record<string, unknown>) }
					: patch.value;
				this.set(patch.path, merged);
			}
		},
		snapshot(): Record<string, unknown> {
			return { ...state };
		},
	};
}

/**
 * Create execution context for provider.
 */
function createRunContext(agentId: string, state: StateStore): NodeRunContext {
	const controller = new AbortController();
	const runId = typeof globalThis.crypto?.randomUUID === "function"
		? globalThis.crypto.randomUUID()
		: `run-${Date.now()}-${Math.random().toString(36).slice(2)}`;

	return {
		nodeId: agentId,
		runId,
		emit: (_event: RuntimeEventPayload) => {
			// Events are emitted but not stored for simple run()
			// For full event handling, use harness with transport
		},
		signal: controller.signal,
		state,
	};
}

/**
 * Build provider input from agent config and user input.
 */
function buildProviderInput(agent: Agent, userInput: unknown): AgentInput {
	const input: AgentInput = {};

	// Extract prompt from user input or use agent's system prompt
	if (userInput && typeof userInput === "object" && "prompt" in userInput) {
		const promptInput = (userInput as { prompt?: string }).prompt;
		if (typeof promptInput === "string") {
			// User provided a prompt - combine with system prompt
			input.messages = [
				{ role: "user", content: promptInput },
			];
			input.options = { systemPrompt: agent.config.prompt };
		}
	} else if (typeof userInput === "string") {
		input.messages = [{ role: "user", content: userInput }];
		input.options = { systemPrompt: agent.config.prompt };
	} else {
		// Just use agent's prompt as the message
		input.prompt = agent.config.prompt;
	}

	// Extract and convert output schema if present
	if (agent.config.output?.schema) {
		// Zod v4 has native JSON Schema support via z.toJSONSchema()
		const jsonSchema = z.toJSONSchema(agent.config.output.schema);
		input.options = {
			...input.options,
			outputFormat: {
				type: "json_schema" as const,
				schema: jsonSchema,
			},
		};
	}

	return input;
}

/**
 * Extract metrics from provider output.
 */
function extractMetrics(output: AgentOutput, durationMs: number): RunMetrics {
	return {
		latencyMs: output.durationMs ?? durationMs,
		cost: output.totalCostUsd ?? 0,
		tokens: {
			input: output.usage?.inputTokens ?? 0,
			output: output.usage?.outputTokens ?? 0,
		},
	};
}

/**
 * Create a simple hash of the input for fixture identification.
 */
function hashInput(input: unknown): string {
	const str = JSON.stringify(input);
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash = hash & hash; // Convert to 32bit integer
	}
	return Math.abs(hash).toString(16);
}

/**
 * Save a recording to the fixture store.
 */
async function saveRecording<T>(
	store: FixtureStore,
	fixtureId: string,
	input: unknown,
	output: T,
	metrics: RunMetrics,
): Promise<void> {
	const recording: Recording<T> = {
		id: fixtureId,
		metadata: {
			providerType: "agent",
			createdAt: new Date().toISOString(),
			inputHash: hashInput(input),
		},
		events: [], // We store output directly, not events for simple recordings
		output,
	};
	await store.save(recording);
}

/**
 * Load a recording from the fixture store.
 */
async function loadRecording<T>(
	store: FixtureStore,
	fixtureId: string,
): Promise<Recording<T> | null> {
	return store.load<T>(fixtureId);
}

/**
 * Execute a single agent.
 *
 * @param agent - Agent to execute
 * @param input - Input to the agent
 * @param options - Run options
 * @returns Run result
 */
async function runAgent<TOutput>(
	agent: Agent<TOutput>,
	input: unknown,
	options?: RunOptions,
): Promise<RunResult<TOutput>> {
	const mode = getFixtureMode(options);
	const fixtures: string[] = [];
	const fixtureId = options?.fixture
		? generateFixtureId(options.fixture, "agent", 0)
		: null;

	// REPLAY MODE: Load from fixture store instead of calling provider
	if (mode === "replay" && fixtureId && options?.store) {
		const recording = await loadRecording<TOutput>(options.store, fixtureId);
		if (!recording) {
			throw new Error(`Fixture not found: ${fixtureId}. Run with FIXTURE_MODE=record first.`);
		}
		return {
			output: recording.output as TOutput,
			// Agents are stateless - state lives on harness level
			state: undefined,
			metrics: {
				latencyMs: 0, // Replay is instant
				cost: 0,
				tokens: { input: 0, output: 0 },
			},
			fixtures: [fixtureId],
		};
	}

	// LIVE or RECORD MODE: Execute the provider
	const provider = getProvider(options);

	// Create execution context (agents are stateless, use empty state)
	const stateStore = createMinimalStateStore({});
	const ctx = createRunContext("agent", stateStore);

	// Build provider input
	const providerInput = buildProviderInput(agent, input);

	// Execute the provider
	const startTime = Date.now();
	const providerOutput = await provider.run(ctx, providerInput) as AgentOutput;
	const endTime = Date.now();

	// Extract output - for TOutput, we try to use structuredOutput if available,
	// otherwise fall back to text
	const output = (providerOutput.structuredOutput ?? providerOutput.text ?? providerOutput) as TOutput;
	const metrics = extractMetrics(providerOutput, endTime - startTime);

	// RECORD MODE: Save to fixture store
	if (mode === "record" && fixtureId && options?.store) {
		await saveRecording(options.store, fixtureId, input, output, metrics);
		fixtures.push(fixtureId);
	}

	return {
		output,
		// Agents are stateless - state lives on harness level
		state: undefined,
		metrics,
		fixtures: fixtures.length > 0 ? fixtures : undefined,
	};
}

/**
 * Harness fixture data structure for recording/replay.
 */
interface HarnessFixtureData<TOutput> {
	output: TOutput;
	state: Record<string, unknown>;
	metrics: RunMetrics;
}

/**
 * Execute a harness (multi-agent workflow).
 *
 * @param harness - Harness to execute
 * @param input - Input to the harness
 * @param options - Run options
 * @returns Run result
 */
async function runHarness<TOutput>(
	harness: Harness,
	input: unknown,
	options?: RunOptions,
): Promise<RunResult<TOutput>> {
	const mode = getFixtureMode(options);
	const fixtures: string[] = [];
	const fixtureId = options?.fixture
		? generateFixtureId(options.fixture, "harness", 0)
		: null;

	// Access the internal flow definition
	const harnessWithFlow = harness as HarnessWithFlow;
	const flow = harnessWithFlow._flow;

	// REPLAY MODE: Load from fixture store instead of executing
	if (mode === "replay" && fixtureId && options?.store) {
		const recording = await loadRecording<HarnessFixtureData<TOutput>>(options.store, fixtureId);
		if (!recording) {
			throw new Error(`Fixture not found: ${fixtureId}. Run with FIXTURE_MODE=record first.`);
		}
		const data = recording.output as HarnessFixtureData<TOutput>;
		return {
			output: data.output,
			state: data.state,
			metrics: {
				latencyMs: 0, // Replay is instant
				cost: 0,
				tokens: { input: 0, output: 0 },
			},
			fixtures: [fixtureId],
		};
	}

	// LIVE or RECORD MODE: Execute the harness

	// For harness execution, we need the full runtime.
	// Import dynamically to avoid circular dependencies.
	const { createRuntime } = await import("../runtime/execution/runtime.js");
	const { DefaultNodeRegistry } = await import("../nodes/registry.js");

	// Build registry from harness agents
	const registry = new DefaultNodeRegistry();
	const provider = getProvider(options);

	// Register the provider for each agent type
	// Each agent in the harness uses the same provider
	registry.register({
		type: "agent",
		run: async (ctx, nodeInput) => {
			// Build input from agent config + node input
			const agentId = ctx.nodeId;
			const agentDef = harness.config.agents[agentId];
			if (!agentDef) {
				throw new Error(`Agent not found in harness: ${agentId}`);
			}
			const providerInput = buildProviderInput(agentDef, nodeInput);
			return provider.run(ctx, providerInput);
		},
	});

	// Create and run the runtime
	const runtime = createRuntime({
		flow,
		registry,
		store: undefined, // RunStore for persistence, not FixtureStore
	});

	const startTime = Date.now();
	const snapshot = await runtime.run(input as Record<string, unknown>);
	const endTime = Date.now();

	// Extract output from the last completed node
	let output: TOutput | undefined;
	let totalCost = 0;
	let totalInputTokens = 0;
	let totalOutputTokens = 0;

	for (const nodeId of Object.keys(snapshot.outputs)) {
		const nodeOutput = snapshot.outputs[nodeId] as AgentOutput | undefined;
		if (nodeOutput) {
			output = (nodeOutput.structuredOutput ?? nodeOutput.text ?? nodeOutput) as TOutput;
			totalCost += nodeOutput.totalCostUsd ?? 0;
			totalInputTokens += nodeOutput.usage?.inputTokens ?? 0;
			totalOutputTokens += nodeOutput.usage?.outputTokens ?? 0;
		}
	}

	const metrics: RunMetrics = {
		latencyMs: endTime - startTime,
		cost: totalCost,
		tokens: { input: totalInputTokens, output: totalOutputTokens },
	};

	// RECORD MODE: Save the entire harness result to fixture store
	if (mode === "record" && fixtureId && options?.store) {
		const fixtureData: HarnessFixtureData<TOutput> = {
			output: output as TOutput,
			state: (snapshot.state as Record<string, unknown>) ?? {},
			metrics,
		};
		await saveRecording(options.store, fixtureId, input, fixtureData, metrics);
		fixtures.push(fixtureId);
	}

	return {
		output: output as TOutput,
		state: snapshot.state as Record<string, unknown> | undefined,
		metrics,
		fixtures: fixtures.length > 0 ? fixtures : undefined,
	};
}

/**
 * Run an agent or harness.
 *
 * This is the unified entry point for all Open Harness execution.
 * It automatically detects whether the target is an Agent or Harness
 * and dispatches to the appropriate execution path.
 *
 * @param target - Agent or Harness to execute
 * @param input - Input to pass to the target
 * @param options - Optional run options (fixture, mode, store, variant, provider)
 * @returns Run result with output, state, metrics, and fixtures
 *
 * @example
 * ```ts
 * // Simple execution
 * const result = await run(myAgent, { prompt: "Hello" })
 *
 * // With fixture recording
 * const result = await run(myAgent, { prompt: "Hello" }, {
 *   fixture: "test-1",
 *   mode: "record",
 *   store: myStore,
 * })
 *
 * // Replay from fixture
 * const result = await run(myAgent, { prompt: "Hello" }, {
 *   fixture: "test-1",
 *   mode: "replay",
 *   store: myStore,
 * })
 * ```
 */
export async function run<TOutput = unknown>(
	target: Agent<TOutput> | Harness,
	input: unknown,
	options?: RunOptions,
): Promise<RunResult<TOutput>> {
	// Merge with defaults: use default store if not provided
	const store = options?.store ?? getDefaultStore();
	const effectiveOptions: RunOptions | undefined = store
		? { ...options, store }
		: options;

	// Validate fixture options
	const mode = getFixtureMode(effectiveOptions);
	if (effectiveOptions?.fixture && !effectiveOptions?.store && mode !== "live") {
		throw new Error("Store is required when using fixture with record or replay mode");
	}

	// Dispatch based on target type
	if (isAgent(target)) {
		return runAgent(target as Agent<TOutput>, input, effectiveOptions);
	}

	if (isHarness(target)) {
		return runHarness(target, input, effectiveOptions);
	}

	throw new Error("Target must be an Agent or Harness");
}
