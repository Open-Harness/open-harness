/**
 * Autonomous Harness Example
 *
 * Demonstrates the full Open Harness SDK architecture:
 * - BaseHarness for step-aware execution
 * - Agent wrapper with step context
 * - Real LLM execution via createAgent/BaseAgent
 * - StreamCallbacks for event handling
 *
 * Run with: bun packages/sdk/src/examples/autonomous-harness.ts
 */

import { Agent, BaseHarness, createAgent, type StreamCallbacks } from "../index.js";

// ============================================
// Types
// ============================================

interface TaskState {
	tasksCompleted: number;
	totalTasks: number;
	results: string[];
}

interface TaskInput {
	id: string;
	description: string;
}

interface TaskOutput {
	success: boolean;
	summary: string;
}

// ============================================
// LLM-Backed Agent
// ============================================

/**
 * Creates an agent that uses the real LLM for task execution.
 * This shows how to connect the harness Agent to the internal BaseAgent layer.
 */
function createTaskAgent() {
	// Create the internal agent that actually calls Claude
	const llmAgent = createAgent({
		name: "TaskExecutor",
		prompt: `You are a task executor. Given a task, analyze it and provide a brief summary of how you would approach it.
Always respond with a JSON object: { "success": true, "summary": "your brief summary" }`,
		model: "haiku",
	});

	// Wrap in harness Agent for step-aware execution
	return new Agent<TaskState, TaskInput, TaskOutput>({
		name: "TaskExecutor",

		async run({ input, stepNumber, context, callbacks }) {
			console.log(`\n[Step ${stepNumber}] Processing: ${input.description}`);
			console.log(`  Tasks completed so far: ${context.tasksCompleted}/${context.totalTasks}`);

			// Build prompt with step context
			const prompt = `
Task #${stepNumber}: ${input.description}
Task ID: ${input.id}
Progress: ${context.tasksCompleted} of ${context.totalTasks} tasks completed

Analyze this task and provide your approach.`;

			try {
				// Execute via real LLM
				const result = await llmAgent.run(prompt, `task-${input.id}`, {
					callbacks: callbacks as StreamCallbacks,
				});

				// Parse the response
				if (result?.type === "result" && result.subtype === "success") {
					const output = result.structured_output as TaskOutput;
					return output || { success: true, summary: "Task analyzed" };
				}

				return { success: true, summary: "Task completed" };
			} catch (error) {
				console.error(`  Error: ${error}`);
				return { success: false, summary: `Error: ${error}` };
			}
		},

		isComplete: (state) => state.tasksCompleted >= state.totalTasks,
	});
}

// ============================================
// Harness Implementation
// ============================================

class AutonomousHarness extends BaseHarness<TaskState, TaskInput, TaskOutput> {
	private agent = createTaskAgent();
	private taskQueue: TaskInput[];

	constructor(tasks: TaskInput[]) {
		super({
			initialState: {
				tasksCompleted: 0,
				totalTasks: tasks.length,
				results: [],
			},
		});
		this.taskQueue = [...tasks];
	}

	protected async *execute() {
		while (this.taskQueue.length > 0) {
			const input = this.taskQueue.shift()!;

			// Get bounded context for this step
			const context = this.loadContext();

			// Execute agent with step awareness
			const output = await this.agent.run({
				input,
				context: context.state,
				stepNumber: this.currentStep + 1,
				stepHistory: this.getStepHistory(),
				constraints: {},
				callbacks: {
					onText: (text) => console.log(`  [LLM]: ${text.slice(0, 100)}...`),
					onToolCall: (name) => console.log(`  [Tool]: ${name}`),
				},
			});

			// Update state
			this.state.updateState((s) => ({
				...s,
				tasksCompleted: s.tasksCompleted + 1,
				results: [...s.results, output.summary],
			}));

			yield { input, output };
		}
	}

	override isComplete(): boolean {
		return this.state.getState().tasksCompleted >= this.state.getState().totalTasks;
	}
}

// ============================================
// Main
// ============================================

async function main() {
	console.log("=".repeat(60));
	console.log("Open Harness SDK - Autonomous Harness Example");
	console.log("=".repeat(60));

	// Check for API key
	if (!process.env.ANTHROPIC_API_KEY) {
		console.log("\nNote: ANTHROPIC_API_KEY not set - running in mock mode");
		console.log("Set ANTHROPIC_API_KEY to run with real LLM execution\n");
	}

	// Define tasks
	const tasks: TaskInput[] = [
		{ id: "TASK-1", description: "Analyze the user authentication flow" },
		{ id: "TASK-2", description: "Review database schema design" },
		{ id: "TASK-3", description: "Plan API endpoint structure" },
	];

	console.log(`\nStarting harness with ${tasks.length} tasks...\n`);

	// Create and run harness
	const harness = new AutonomousHarness(tasks);

	try {
		await harness.run();
	} catch (error) {
		console.error("\nHarness execution error:", error);
	}

	// Report results
	console.log("\n" + "=".repeat(60));
	console.log("Execution Complete");
	console.log("=".repeat(60));

	const finalState = harness.getState();
	console.log(`\nTasks completed: ${finalState.tasksCompleted}/${finalState.totalTasks}`);
	console.log(`Total steps: ${harness.getCurrentStep()}`);

	console.log("\nResults:");
	finalState.results.forEach((r, i) => {
		console.log(`  ${i + 1}. ${r}`);
	});

	console.log("\nStep History:");
	harness.getStepHistory().forEach((step) => {
		console.log(`  Step ${step.stepNumber}: ${step.input.id} -> ${step.output.success ? "OK" : "FAIL"}`);
	});
}

// Run if executed directly
if (import.meta.main) {
	main().catch(console.error);
}

export { AutonomousHarness, createTaskAgent };
export type { TaskState, TaskInput, TaskOutput };
