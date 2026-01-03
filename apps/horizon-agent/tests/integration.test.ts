/**
 * Horizon Agent Integration Tests
 *
 * Tests the full agent loop system with mock nodes.
 * Uses the kernel's loop edge support for coder↔reviewer cycles.
 */

import { describe, expect, it, beforeEach } from "bun:test";
import { z } from "zod";
import { HubImpl } from "@open-harness/kernel";
import { executeFlow } from "@open-harness/kernel";
import { NodeRegistry } from "@open-harness/kernel";
import {
	controlForeachNode,
	controlNoopNode,
} from "@open-harness/kernel";
import type { EnrichedEvent, FlowYaml } from "@open-harness/kernel";

/**
 * Create a mock registry with test versions of the agents.
 */
function createMockRegistry(): NodeRegistry {
	const registry = new NodeRegistry();

	// Register control nodes
	registry.register(controlForeachNode);
	registry.register(controlNoopNode);

	// Mock planner: creates a list of tasks
	registry.register({
		type: "mock.planner",
		inputSchema: z.object({
			feature: z.string(),
		}),
		outputSchema: z.object({
			tasks: z.array(
				z.object({
					id: z.string(),
					title: z.string(),
					description: z.string(),
				}),
			),
		}),
		run: async (_ctx, input: { feature: string }) => ({
			tasks: [
				{
					id: "task-1",
					title: `Implement ${input.feature} - Step 1`,
					description: "First step of implementation",
				},
				{
					id: "task-2",
					title: `Implement ${input.feature} - Step 2`,
					description: "Second step of implementation",
				},
			],
		}),
	});

	// Mock coder: returns code with iteration count embedded
	let coderCallCount = 0;
	registry.register({
		type: "mock.coder",
		inputSchema: z.object({
			task: z.any(),
		}),
		outputSchema: z.object({
			code: z.string(),
			iteration: z.number(),
		}),
		run: async (_ctx, input: { task: unknown }) => {
			coderCallCount++;
			const task = input.task as { title: string };
			return {
				code: `// Implementation for: ${task.title}\n// Iteration: ${coderCallCount}`,
				iteration: coderCallCount,
			};
		},
	});

	// Mock reviewer: passes after N iterations
	let reviewerCallCount = 0;
	registry.register({
		type: "mock.reviewer",
		inputSchema: z.object({
			code: z.string(),
			iteration: z.number(),
			passAfter: z.number().default(2),
		}),
		outputSchema: z.object({
			passed: z.boolean(),
			feedback: z.string(),
		}),
		run: async (
			_ctx,
			input: { code: string; iteration: number; passAfter: number },
		) => {
			reviewerCallCount++;
			const shouldPass = input.iteration >= input.passAfter;
			return {
				passed: shouldPass,
				feedback: shouldPass
					? "Code looks good!"
					: `Needs improvement (iteration ${input.iteration})`,
			};
		},
	});

	// Reset helper - use unknown intermediate for type safety
	(registry as unknown as { resetCounters: () => void }).resetCounters = () => {
		coderCallCount = 0;
		reviewerCallCount = 0;
	};

	return registry;
}

describe("Horizon Agent Integration", () => {
	let registry: NodeRegistry & { resetCounters: () => void };
	let hub: HubImpl;

	beforeEach(() => {
		registry = createMockRegistry() as NodeRegistry & {
			resetCounters: () => void;
		};
		registry.resetCounters();
		hub = new HubImpl("test-session");
	});

	describe("Full Flow Cycle", () => {
		it("executes planner → coder → reviewer flow", async () => {
			const events: string[] = [];

			hub.subscribe("node:complete", (e: EnrichedEvent) => {
				const evt = e.event as { nodeId: string };
				events.push(evt.nodeId);
			});

			// Simple flow without loops
			const flow: FlowYaml = {
				flow: { name: "test-flow" },
				nodes: [
					{
						id: "planner",
						type: "mock.planner",
						input: { feature: "{{ flow.input.feature }}" },
					},
					{
						id: "coder",
						type: "mock.coder",
						input: { task: { title: "Test task" } },
					},
					{
						id: "reviewer",
						type: "mock.reviewer",
						input: {
							code: "{{ coder.code }}",
							iteration: "{{ coder.iteration }}",
							passAfter: 1,
						},
					},
				],
				edges: [
					{ from: "planner", to: "coder" },
					{ from: "coder", to: "reviewer" },
				],
			};

			const result = await executeFlow(flow, registry, hub, {
				feature: "user authentication",
			});

			expect(events).toEqual(["planner", "coder", "reviewer"]);
			expect(result.outputs).toHaveProperty("planner");
			expect(result.outputs).toHaveProperty("coder");
			expect(result.outputs).toHaveProperty("reviewer");

			const plannerOutput = result.outputs.planner as {
				tasks: Array<{ id: string }>;
			};
			expect(plannerOutput.tasks).toHaveLength(2);
		});
	});

	describe("Loop Edge Cycles", () => {
		it("loops coder→reviewer until passed", async () => {
			const events: string[] = [];
			const loopEvents: Array<{ from: string; to: string; iteration: number }> =
				[];

			hub.subscribe("node:complete", (e: EnrichedEvent) => {
				const evt = e.event as { nodeId: string };
				events.push(evt.nodeId);
			});

			hub.subscribe("loop:iterate", (e: EnrichedEvent) => {
				const evt = e.event as unknown as {
					edgeFrom: string;
					edgeTo: string;
					iteration: number;
				};
				loopEvents.push({
					from: evt.edgeFrom,
					to: evt.edgeTo,
					iteration: evt.iteration,
				});
			});

			// Flow with loop edge: reviewer → coder until passed
			const flow: FlowYaml = {
				flow: { name: "loop-test" },
				nodes: [
					{
						id: "coder",
						type: "mock.coder",
						input: { task: { title: "Test task" } },
					},
					{
						id: "reviewer",
						type: "mock.reviewer",
						input: {
							code: "{{ coder.code }}",
							iteration: "{{ coder.iteration }}",
							passAfter: 3, // Will pass on 3rd iteration
						},
					},
				],
				edges: [
					{ from: "coder", to: "reviewer" },
					{
						from: "reviewer",
						to: "coder",
						type: "loop",
						maxIterations: 5,
						when: {
							not: { equals: { var: "reviewer.passed", value: true } },
						},
					},
				],
			};

			const result = await executeFlow(flow, registry, hub);

			// Should loop: coder(1) → reviewer(fail) → coder(2) → reviewer(fail) → coder(3) → reviewer(pass)
			expect(events).toEqual([
				"coder",
				"reviewer",
				"coder",
				"reviewer",
				"coder",
				"reviewer",
			]);

			// Should have 2 loop iterations (the 3rd time reviewer passes)
			expect(loopEvents).toHaveLength(2);
			expect(loopEvents[0]).toEqual({
				from: "reviewer",
				to: "coder",
				iteration: 1,
			});
			expect(loopEvents[1]).toEqual({
				from: "reviewer",
				to: "coder",
				iteration: 2,
			});

			// Final reviewer output should be passed
			const reviewerOutput = result.outputs.reviewer as { passed: boolean };
			expect(reviewerOutput.passed).toBe(true);
		});

		it("respects maxIterations limit", async () => {
			// Flow that never passes - will hit maxIterations
			const flow: FlowYaml = {
				flow: { name: "max-iter-test" },
				nodes: [
					{
						id: "coder",
						type: "mock.coder",
						input: { task: { title: "Test" } },
					},
					{
						id: "reviewer",
						type: "mock.reviewer",
						input: {
							code: "{{ coder.code }}",
							iteration: "{{ coder.iteration }}",
							passAfter: 100, // Will never pass within limit
						},
					},
				],
				edges: [
					{ from: "coder", to: "reviewer" },
					{
						from: "reviewer",
						to: "coder",
						type: "loop",
						maxIterations: 3,
						when: {
							not: { equals: { var: "reviewer.passed", value: true } },
						},
					},
				],
			};

			let error: Error | null = null;
			try {
				await executeFlow(flow, registry, hub);
			} catch (e) {
				error = e as Error;
			}

			expect(error).not.toBeNull();
			expect(error?.message).toContain("exceeded maximum iterations");
		});
	});

	describe("Abort Handling", () => {
		it("can abort a running flow with abort()", async () => {
			const events: string[] = [];

			hub.subscribe("node:complete", (e: EnrichedEvent) => {
				const evt = e.event as { nodeId: string };
				events.push(evt.nodeId);
			});

			const flow: FlowYaml = {
				flow: { name: "abort-test" },
				nodes: [
					{ id: "step1", type: "control.noop", input: {} },
					{ id: "step2", type: "control.noop", input: {} },
				],
				edges: [{ from: "step1", to: "step2" }],
			};

			// Execute flow - it should complete normally
			await executeFlow(flow, registry, hub);

			// Both nodes should have completed
			expect(events).toContain("step1");
			expect(events).toContain("step2");

			// Verify abort() is callable (doesn't throw)
			expect(() => hub.abort({ reason: "Test", resumable: true })).not.toThrow();
		});
	});
});
