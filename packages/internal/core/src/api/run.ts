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
} from "./types.js";
import { isAgent, isHarness } from "./types.js";
import type { HarnessWithFlow } from "./harness.js";

/**
 * Safely get environment variable (works in Node.js and browsers).
 */
function getEnvVar(name: string): string | undefined {
	// Check if we're in a Node.js environment
	if (typeof globalThis !== "undefined" && "process" in globalThis) {
		const proc = (globalThis as { process?: { env?: Record<string, string> } }).process;
		return proc?.env?.[name];
	}
	return undefined;
}

/**
 * Get the fixture mode from options or environment variable.
 *
 * Priority: explicit option > FIXTURE_MODE env var > "live"
 */
function getFixtureMode(options?: RunOptions): FixtureMode {
	if (options?.mode) {
		return options.mode;
	}

	const envMode = getEnvVar("FIXTURE_MODE");
	if (envMode === "record" || envMode === "replay" || envMode === "live") {
		return envMode;
	}

	return "live";
}

/**
 * Generate hierarchical fixture IDs for multi-agent harnesses.
 *
 * Format: `<fixture>/<agentId>/inv<invocationNumber>`
 *
 * @param baseFixture - Base fixture name
 * @param agentId - Agent identifier
 * @param invocation - Invocation number (0-indexed)
 * @returns Hierarchical fixture ID
 */
export function generateFixtureId(
	baseFixture: string,
	agentId: string,
	invocation: number,
): string {
	return `${baseFixture}/${agentId}/inv${invocation}`;
}

/**
 * Create empty metrics for placeholder implementations.
 */
function createEmptyMetrics(): RunMetrics {
	return {
		latencyMs: 0,
		cost: 0,
		tokens: { input: 0, output: 0 },
	};
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

	// Track fixture if recording
	if (mode === "record" && options?.fixture) {
		const fixtureId = generateFixtureId(options.fixture, "agent", 0);
		fixtures.push(fixtureId);
	}

	// Execute the agent
	// For now, this is a placeholder that demonstrates the API shape.
	// Real execution will use the provider infrastructure.
	const startTime = Date.now();

	// Placeholder: In real implementation, this would:
	// 1. Create an execution context
	// 2. Use withRecording() if fixture mode requires it
	// 3. Execute the provider with the agent's prompt + input
	// 4. Collect metrics from the execution

	const endTime = Date.now();

	return {
		output: undefined as unknown as TOutput,
		state: agent.config.state as Record<string, unknown> | undefined,
		metrics: {
			latencyMs: endTime - startTime,
			cost: 0,
			tokens: { input: 0, output: 0 },
		},
		fixtures: fixtures.length > 0 ? fixtures : undefined,
	};
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

	// Access the internal flow definition
	const harnessWithFlow = harness as HarnessWithFlow;
	const flow = harnessWithFlow._flow;

	// Track fixtures for each agent if recording
	if (mode === "record" && options?.fixture) {
		for (const node of flow.nodes) {
			const fixtureId = generateFixtureId(options.fixture, node.id, 0);
			fixtures.push(fixtureId);
		}
	}

	// Execute the harness
	// For now, this is a placeholder that demonstrates the API shape.
	// Real execution will:
	// 1. Use the runtime to execute the flow
	// 2. Coordinate agent recordings
	// 3. Collect aggregate metrics

	const startTime = Date.now();
	const endTime = Date.now();

	return {
		output: undefined as unknown as TOutput,
		state: harness.config.state as Record<string, unknown> | undefined,
		metrics: {
			latencyMs: endTime - startTime,
			cost: 0,
			tokens: { input: 0, output: 0 },
		},
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
 * @param options - Optional run options (fixture, mode, store, variant)
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
	// Validate fixture options
	if (options?.fixture && !options?.store && options?.mode !== "live") {
		throw new Error("Store is required when using fixture with record or replay mode");
	}

	// Dispatch based on target type
	if (isAgent(target)) {
		return runAgent(target as Agent<TOutput>, input, options);
	}

	if (isHarness(target)) {
		return runHarness(target, input, options);
	}

	throw new Error("Target must be an Agent or Harness");
}
