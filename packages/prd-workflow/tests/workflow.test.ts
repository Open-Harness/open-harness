/**
 * Tests for PRD Workflow Runner
 *
 * Tests the workflow.ts exports that combine unified handlers
 * into a convenient workflow runner.
 */

import { describe, expect, it } from "bun:test";
import {
	createSignal,
	type Harness,
	type HarnessInput,
	type HarnessOutput,
	type RunContext,
	type Signal,
} from "@internal/signals-core";
import { createInitialState, createPRDWorkflow, PRDWorkflowHandlers, runPRDWorkflow } from "../src/index.js";

/**
 * Create a mock harness for testing that immediately completes
 */
function createMockHarness(): Harness {
	return {
		type: "mock",
		displayName: "Mock Harness",
		capabilities: {
			streaming: false,
			structuredOutput: false,
			tools: false,
			resume: false,
		},
		async *run(_input: HarnessInput, _ctx: RunContext): AsyncGenerator<Signal, HarnessOutput> {
			yield createSignal("harness:start", { input: _input });
			yield createSignal("text:complete", { content: "Mock response" });
			yield createSignal("harness:end", { output: { content: "Mock response" }, durationMs: 1 });
			return { content: "Mock response" };
		},
	};
}

describe("createPRDWorkflow", () => {
	it("returns a workflow factory with agent and runReactive", () => {
		const factory = createPRDWorkflow();

		expect(factory).toBeDefined();
		expect(factory.agent).toBeInstanceOf(Function);
		expect(factory.runReactive).toBeInstanceOf(Function);
	});

	it("creates agents with typed state access", () => {
		const { agent } = createPRDWorkflow();

		const planner = agent({
			prompt: "Create a plan from the PRD",
			activateOn: ["workflow:start"],
			emits: ["plan:created"],
			when: (ctx) => ctx.state.planning.phase === "idle",
		});

		expect(planner._tag).toBe("Agent");
		expect(planner._reactive).toBe(true);
		expect(planner.config.activateOn).toEqual(["workflow:start"]);
		expect(planner.config.emits).toEqual(["plan:created"]);
	});

	it("agent when guard receives typed state", () => {
		const { agent } = createPRDWorkflow();

		// This test verifies TypeScript compilation - the when guard
		// should have full type access to PRDWorkflowState
		const testAgent = agent({
			prompt: "Test",
			activateOn: ["test:signal"],
			when: (ctx) => {
				// These should all be valid property accesses
				const _phase = ctx.state.planning.phase;
				const _prd = ctx.state.planning.prd;
				const _currentTask = ctx.state.execution.currentTaskId;
				const _reviewPhase = ctx.state.review.phase;
				return _phase === "idle";
			},
		});

		// Create mock context for testing the guard
		const state = createInitialState("Test PRD");
		const mockSignal = createSignal("test:signal", {});
		const ctx = { signal: mockSignal, state, input: state };

		// The when guard should work
		const result = testAgent.config.when?.(ctx);
		expect(result).toBe(true);
	});
});

describe("runPRDWorkflow", () => {
	it("creates initial state from PRD string", async () => {
		const prd = "# My PRD\n\nBuild a test app";
		const { agent } = createPRDWorkflow();
		const mockHarness = createMockHarness();

		// Create a minimal agent that activates on workflow:start
		const terminator = agent({
			prompt: "End workflow",
			activateOn: ["workflow:start"],
			when: () => true,
		});

		const result = await runPRDWorkflow({
			prd,
			agents: { terminator },
			harness: mockHarness,
			// endWhen after activation to stop the workflow
			endWhen: (state) => state.planning.phase === "idle",
		});

		expect(result.state.planning.prd).toBe(prd);
		expect(result.state.planning.phase).toBe("idle");
	});

	it("includes workflow:start in signal history", async () => {
		const { agent } = createPRDWorkflow();
		const mockHarness = createMockHarness();

		const terminator = agent({
			prompt: "End workflow",
			activateOn: ["workflow:start"],
			when: () => true,
		});

		const result = await runPRDWorkflow({
			prd: "Test",
			agents: { terminator },
			harness: mockHarness,
			endWhen: () => true,
		});

		const startSignal = result.signals.find((s) => s.name === "workflow:start");
		expect(startSignal).toBeDefined();
		expect(startSignal?.payload).toMatchObject({
			agents: ["terminator"],
		});
	});

	it("includes workflow:end in signal history", async () => {
		const { agent } = createPRDWorkflow();
		const mockHarness = createMockHarness();

		const terminator = agent({
			prompt: "End workflow",
			activateOn: ["workflow:start"],
			when: () => true,
		});

		const result = await runPRDWorkflow({
			prd: "Test",
			agents: { terminator },
			harness: mockHarness,
			endWhen: () => true,
		});

		const endSignal = result.signals.find((s) => s.name === "workflow:end");
		expect(endSignal).toBeDefined();
		expect(endSignal?.payload).toMatchObject({
			activations: expect.any(Number),
			durationMs: expect.any(Number),
		});
	});
});

describe("unified handlers integration", () => {
	it("exports handlers for all signal types", () => {
		// Verify all expected handlers are present (unified pattern combines reducers + processes)
		expect(PRDWorkflowHandlers["plan:start"]).toBeInstanceOf(Function);
		expect(PRDWorkflowHandlers["plan:created"]).toBeInstanceOf(Function);
		expect(PRDWorkflowHandlers["discovery:submitted"]).toBeInstanceOf(Function);
		expect(PRDWorkflowHandlers["discovery:reviewed"]).toBeInstanceOf(Function);
		expect(PRDWorkflowHandlers["task:ready"]).toBeInstanceOf(Function);
		expect(PRDWorkflowHandlers["task:complete"]).toBeInstanceOf(Function);
		expect(PRDWorkflowHandlers["fix:required"]).toBeInstanceOf(Function);
		expect(PRDWorkflowHandlers["milestone:testable"]).toBeInstanceOf(Function);
		expect(PRDWorkflowHandlers["milestone:passed"]).toBeInstanceOf(Function);
		expect(PRDWorkflowHandlers["task:approved"]).toBeInstanceOf(Function);
		expect(PRDWorkflowHandlers["milestone:failed"]).toBeInstanceOf(Function);
		expect(PRDWorkflowHandlers["milestone:retry"]).toBeInstanceOf(Function);
		expect(PRDWorkflowHandlers["workflow:complete"]).toBeInstanceOf(Function);
	});

	it("handlers have correct signature (state, signal) => Signal[] | void", () => {
		const state = createInitialState("Test");
		const signal = createSignal("plan:start", {});

		// Handlers can either return signals or nothing (Immer handles state mutations)
		const result = PRDWorkflowHandlers["plan:start"]?.(state, signal);
		// plan:start handler just mutates state, returns nothing
		expect(result === undefined || Array.isArray(result)).toBe(true);
	});

	it("handlers can return signals for orchestration", () => {
		// Setup: create a state with tasks so plan:created can emit task:ready
		const state = createInitialState("Test");
		const tasks = [{ id: "task1", title: "Task 1", description: "Test task", status: "pending" as const }];
		const signal = createSignal("plan:created", {
			tasks,
			milestones: [],
			taskOrder: ["task1"],
		});

		// plan:created handler should return [task:ready] signal for first task
		const result = PRDWorkflowHandlers["plan:created"]?.(state, signal);
		expect(Array.isArray(result)).toBe(true);
		if (result && result.length > 0) {
			const firstSignal = result[0];
			expect(firstSignal).toBeDefined();
			if (firstSignal) {
				expect(firstSignal.name).toBe("task:ready");
			}
		}
	});
});
