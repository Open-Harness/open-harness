import { createWorkflow, ClaudeHarness, MemorySignalStore } from "@open-harness/core";

/**
 * Task Executor - Level 2
 *
 * Demonstrates harness-level state that persists across invocations.
 * In v0.3.0, agents are stateless - state lives on the harness.
 *
 * This example shows:
 * - Single agent wrapped in a harness
 * - State defined at harness level
 * - State returned with harness run result
 * - Signal recording for fixture-based testing
 *
 * v0.3.0 Migration:
 * - Uses createWorkflow() for typed agent factory
 * - Uses runReactive() instead of run()
 * - Uses MemorySignalStore for recording
 */

// =============================================================================
// 1. Define state type
// =============================================================================

export interface TaskExecutorState {
	/** User's task prompt */
	prompt: string;
	/** Generated plan */
	plan: string | null;
	/** Track how many tasks processed */
	tasksProcessed: number;
}

/** Initial state for new sessions */
export const initialState: TaskExecutorState = {
	prompt: "",
	plan: null,
	tasksProcessed: 0,
};

// =============================================================================
// 2. Create typed harness factory
// =============================================================================

const { agent, runReactive } = createWorkflow<TaskExecutorState>();

// =============================================================================
// 3. Define the agent
// =============================================================================

/** The task executor agent (stateless) */
export const taskExecutorAgent = agent({
	prompt: `You are a task planning assistant.
Given a task description, create a brief implementation plan.
Format: numbered list of 3-5 steps.

Task: {{ state.prompt }}`,

	activateOn: ["workflow:start"],
	emits: ["plan:complete"],
	updates: "plan",
});

// =============================================================================
// 4. Export runner function
// =============================================================================

const harness = new ClaudeHarness({
	model: "claude-sonnet-4-20250514",
});

export type RecordingMode = "record" | "replay";

export interface RunOptions {
	/** Fixture name for recording/replay */
	fixture?: string;
	/** Recording mode */
	mode?: RecordingMode;
	/** Signal store for recording */
	store?: MemorySignalStore;
}

/**
 * Run the task executor with a prompt.
 *
 * @param prompt - The task description to plan
 * @param options - Optional fixture configuration
 * @returns Result with output, state, and metrics
 */
export async function runTaskExecutor(prompt: string, options: RunOptions = {}) {
	const result = await runReactive({
		agents: { taskExecutor: taskExecutorAgent },
		state: {
			...initialState,
			prompt,
		},
		harness,
		recording: options.fixture
			? {
					mode: options.mode ?? "replay",
					store: options.store,
					name: options.fixture,
				}
			: undefined,
		endWhen: (state) => state.plan !== null,
	});

	// Extract text content from plan
	const planOutput = result.state.plan as { content?: string } | string | null;
	const output = typeof planOutput === "string" ? planOutput : planOutput?.content ?? "";

	return {
		output,
		state: result.state,
		metrics: {
			latencyMs: result.metrics.durationMs,
			activations: result.metrics.activations,
		},
		signals: result.signals,
		recordingId: result.recordingId,
	};
}

// Legacy export for backwards compatibility
export const taskExecutor = {
	run: runTaskExecutor,
};
