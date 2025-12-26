/**
 * Workflow Builder Tests - Validates the createWorkflow factory function
 *
 * Tests:
 * 1. Workflow creation with config
 * 2. Task list state transitions
 * 3. Workflow state methods
 * 4. Basic execution flow
 */

import { describe, expect, test } from "bun:test";
import type { Options, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { injectable } from "@needle-di/core";
import { BaseAnthropicAgent } from "../../src/providers/anthropic/agents/base-anthropic-agent.js";
import type { IAgentRunner, RunnerCallbacks } from "../../src/core/tokens.js";
import { createWorkflow } from "../../src/factory/workflow-builder.js";

// ============================================================================
// Mock Runner for Testing
// ============================================================================

@injectable()
class MockRunner implements IAgentRunner {
	public callCount = 0;

	async run(args: { prompt: string; options: Options; callbacks?: RunnerCallbacks }): Promise<SDKMessage | undefined> {
		this.callCount++;

		const resultMessage = {
			type: "result",
			subtype: "success",
			session_id: "mock_session",
			duration_ms: 100,
			duration_api_ms: 80,
			is_error: false,
			num_turns: 1,
			total_cost_usd: 0.001,
			usage: { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
			structured_output: { stopReason: "finished", summary: "Done", handoff: "" },
			result: "Done",
			modelUsage: { input_tokens: 10, output_tokens: 20 },
			permission_denials: [],
			uuid: "mock-uuid-123",
		} as unknown as SDKMessage;

		if (args.callbacks?.onMessage) {
			args.callbacks.onMessage(resultMessage);
		}

		return resultMessage;
	}
}

// ============================================================================
// Mock Agent for Testing
// ============================================================================

@injectable()
class MockAgent extends BaseAnthropicAgent {
	constructor() {
		super("MockAgent", new MockRunner(), null);
	}
}

// ============================================================================
// Tests
// ============================================================================

describe("Workflow Builder", () => {
	describe("createWorkflow factory", () => {
		test("creates workflow with correct name", () => {
			const workflow = createWorkflow({
				name: "TestWorkflow",
				tasks: [{ id: "task1", description: "First task" }],
				agents: {},
				execute: async () => {},
			});

			expect(workflow.getName()).toBe("TestWorkflow");
		});

		test("creates workflow with initial tasks", () => {
			const workflow = createWorkflow({
				name: "TaskWorkflow",
				tasks: [
					{ id: "task1", description: "First" },
					{ id: "task2", description: "Second" },
				],
				agents: {},
				execute: async () => {},
			});

			const state = workflow.getState();
			expect(state.tasks.getAll()).toHaveLength(2);
		});
	});

	describe("Task list state transitions", () => {
		test("markInProgress changes task status", () => {
			const workflow = createWorkflow({
				name: "StateWorkflow",
				tasks: [{ id: "task1", description: "Test" }],
				agents: {},
				execute: async () => {},
			});

			const state = workflow.getState();
			const task = state.markInProgress("task1");
			expect(task.status).toBe("in_progress");
		});

		test("markComplete changes task status and sets result", () => {
			const workflow = createWorkflow<Record<string, BaseAnthropicAgent>, string>({
				name: "CompleteWorkflow",
				tasks: [{ id: "task1", description: "Test" }],
				agents: {},
				execute: async () => {},
			});

			const state = workflow.getState();
			state.markInProgress("task1");
			const task = state.markComplete("task1", "Result value");

			expect(task.status).toBe("completed");
			expect(task.result).toBe("Result value");
		});

		test("markFailed changes task status and sets error", () => {
			const workflow = createWorkflow({
				name: "FailWorkflow",
				tasks: [{ id: "task1", description: "Test" }],
				agents: {},
				execute: async () => {},
			});

			const state = workflow.getState();
			state.markInProgress("task1");
			const task = state.markFailed("task1", "Something went wrong");

			expect(task.status).toBe("failed");
			expect(task.error).toBe("Something went wrong");
		});

		test("markSkipped changes task status", () => {
			const workflow = createWorkflow({
				name: "SkipWorkflow",
				tasks: [{ id: "task1", description: "Test" }],
				agents: {},
				execute: async () => {},
			});

			const state = workflow.getState();
			const task = state.markSkipped("task1");
			expect(task.status).toBe("skipped");
		});
	});

	describe("Workflow state methods", () => {
		test("getProgress returns correct counts", () => {
			const workflow = createWorkflow({
				name: "ProgressWorkflow",
				tasks: [
					{ id: "task1", description: "First" },
					{ id: "task2", description: "Second" },
					{ id: "task3", description: "Third" },
				],
				agents: {},
				execute: async () => {},
			});

			const state = workflow.getState();
			state.markComplete("task1");
			state.markInProgress("task2");

			const progress = state.getProgress();
			expect(progress.completed).toBe(1);
			expect(progress.in_progress).toBe(1);
			expect(progress.pending).toBe(1);
			expect(progress.total).toBe(3);
		});

		test("isComplete returns true when all tasks completed", () => {
			const workflow = createWorkflow({
				name: "CompleteCheckWorkflow",
				tasks: [
					{ id: "task1", description: "First" },
					{ id: "task2", description: "Second" },
				],
				agents: {},
				execute: async () => {},
			});

			const state = workflow.getState();
			expect(state.isComplete()).toBe(false);

			state.markComplete("task1");
			state.markComplete("task2");
			expect(state.isComplete()).toBe(true);
		});

		test("hasFailed returns true when any task failed", () => {
			const workflow = createWorkflow({
				name: "FailCheckWorkflow",
				tasks: [
					{ id: "task1", description: "First" },
					{ id: "task2", description: "Second" },
				],
				agents: {},
				execute: async () => {},
			});

			const state = workflow.getState();
			expect(state.hasFailed()).toBe(false);

			state.markInProgress("task1");
			state.markFailed("task1", "Error");
			expect(state.hasFailed()).toBe(true);
		});
	});

	describe("Workflow execution", () => {
		test("run executes the execute function", async () => {
			let executed = false;

			const workflow = createWorkflow({
				name: "ExecuteWorkflow",
				tasks: [{ id: "task1", description: "Test" }],
				agents: {},
				execute: async () => {
					executed = true;
				},
			});

			await workflow.run();
			expect(executed).toBe(true);
		});

		test("run passes context to execute function", async () => {
			const mockAgent = new MockAgent();
			let receivedContext: any = null;

			const workflow = createWorkflow({
				name: "ContextWorkflow",
				tasks: [{ id: "task1", description: "Test" }],
				agents: { mock: mockAgent },
				execute: async (context) => {
					receivedContext = context;
				},
			});

			await workflow.run();

			expect(receivedContext).not.toBeNull();
			expect(receivedContext.agents.mock).toBe(mockAgent);
			expect(receivedContext.tasks).toHaveLength(1);
			expect(receivedContext.state).toBeDefined();
		});

		test("run returns final state", async () => {
			const workflow = createWorkflow({
				name: "ReturnStateWorkflow",
				tasks: [{ id: "task1", description: "Test" }],
				agents: {},
				execute: async ({ state }) => {
					state.markComplete("task1");
				},
			});

			const finalState = await workflow.run();
			expect(finalState.isComplete()).toBe(true);
		});
	});

	describe("Workflow reset", () => {
		test("reset restores all tasks to pending", async () => {
			const workflow = createWorkflow({
				name: "ResetWorkflow",
				tasks: [
					{ id: "task1", description: "First" },
					{ id: "task2", description: "Second" },
				],
				agents: {},
				execute: async ({ state }) => {
					state.markComplete("task1");
					state.markComplete("task2");
				},
			});

			await workflow.run();
			expect(workflow.getState().isComplete()).toBe(true);

			workflow.reset();

			const state = workflow.getState();
			const progress = state.getProgress();
			expect(progress.pending).toBe(2);
			expect(progress.completed).toBe(0);
		});
	});

	describe("Workflow with metadata", () => {
		test("preserves initial metadata", () => {
			const workflow = createWorkflow({
				name: "MetadataWorkflow",
				tasks: [],
				agents: {},
				metadata: { version: "1.0", environment: "test" },
				execute: async () => {},
			});

			const state = workflow.getState();
			expect(state.metadata.version).toBe("1.0");
			expect(state.metadata.environment).toBe("test");
		});

		test("metadata can be modified during execution", async () => {
			const workflow = createWorkflow({
				name: "MutableMetadataWorkflow",
				tasks: [],
				agents: {},
				metadata: { counter: 0 },
				execute: async ({ state }) => {
					state.metadata.counter = 42;
				},
			});

			await workflow.run();
			expect(workflow.getState().metadata.counter).toBe(42);
		});
	});
});
