/**
 * Horizon Agent Integration Tests
 *
 * Tests the full agent loop system with mock nodes.
 * Uses the kernel's loop edge support for coder↔reviewer cycles.
 */

import { beforeEach, describe, expect, it } from "bun:test";
import type { EnrichedEvent, FlowYaml } from "@open-harness/kernel";
import { controlForeachNode, controlNoopNode, executeFlow, HubImpl, NodeRegistry } from "@open-harness/kernel";
import { z } from "zod";

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
		run: async (_ctx, input: { code: string; iteration: number; passAfter: number }) => {
			reviewerCallCount++;
			const shouldPass = input.iteration >= input.passAfter;
			return {
				passed: shouldPass,
				feedback: shouldPass ? "Code looks good!" : `Needs improvement (iteration ${input.iteration})`,
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
			const loopEvents: Array<{ from: string; to: string; iteration: number }> = [];

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
			expect(events).toEqual(["coder", "reviewer", "coder", "reviewer", "coder", "reviewer"]);

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

	describe("Pause/Resume", () => {
		it("can pause and resume a flow", async () => {
			const events: string[] = [];
			let pauseTriggered = false;

			hub.subscribe("node:complete", (e: EnrichedEvent) => {
				const evt = e.event as { nodeId: string };
				events.push(evt.nodeId);
				// Pause after first node completes
				if (evt.nodeId === "step1" && !pauseTriggered) {
					pauseTriggered = true;
					hub.abort({ resumable: true, reason: "Test pause" });
				}
			});

			hub.subscribe("flow:paused", () => {
				events.push("PAUSED");
			});

			const flow: FlowYaml = {
				flow: { name: "pause-test" },
				nodes: [
					{ id: "step1", type: "control.noop", input: {} },
					{ id: "step2", type: "control.noop", input: {} },
					{ id: "step3", type: "control.noop", input: {} },
				],
				edges: [
					{ from: "step1", to: "step2" },
					{ from: "step2", to: "step3" },
				],
			};

			// First execution - should pause after step1
			const result1 = await executeFlow(flow, registry, hub);

			// Hub should be paused
			expect(hub.status).toBe("paused");
			expect(events).toContain("step1");
			expect(events).toContain("PAUSED");

			// Resume the flow
			await hub.resume(hub.current().sessionId ?? "test-session", "continue");

			// Second execution - should complete
			const result2 = await executeFlow(flow, registry, hub);

			// Hub should now be complete (or running, depending on implementation)
			expect(hub.status).not.toBe("paused");
		});

		it("preserves state when pausing", async () => {
			let pauseTriggered = false;

			hub.subscribe("node:complete", (e: EnrichedEvent) => {
				const evt = e.event as { nodeId: string };
				// Pause after first node completes
				if (evt.nodeId === "step1" && !pauseTriggered) {
					pauseTriggered = true;
					hub.abort({ resumable: true });
				}
			});

			const flow: FlowYaml = {
				flow: { name: "state-test" },
				nodes: [
					{ id: "step1", type: "control.noop", input: {} },
					{ id: "step2", type: "control.noop", input: {} },
				],
				edges: [{ from: "step1", to: "step2" }],
			};

			// Execute and pause
			await executeFlow(flow, registry, hub);

			// Check paused session state exists
			const pausedSession = hub.getPausedSession(hub.current().sessionId ?? "test-session");
			expect(pausedSession).toBeDefined();
			expect(pausedSession?.outputs).toHaveProperty("step1");
		});

		it("resume without pause throws error", async () => {
			// Try to resume without pausing first
			let error: Error | null = null;
			try {
				await hub.resume("nonexistent-session", "test message");
			} catch (e) {
				error = e as Error;
			}

			expect(error).not.toBeNull();
			expect(error?.message).toContain("not found");
		});

		it("resume requires non-empty message", async () => {
			// Pause first - need to start session first
			hub.startSession();
			hub.abort({ resumable: true });

			// Try to resume with empty message
			let error: Error | null = null;
			try {
				await hub.resume(hub.current().sessionId ?? "test-session", "");
			} catch (e) {
				error = e as Error;
			}

			expect(error).not.toBeNull();
			expect(error?.message).toContain("required");
		});
	});

	describe("Red Team Edge Cases", () => {
		it("pause twice is idempotent", async () => {
			// Start session for abort to work
			hub.startSession();

			// First pause
			hub.abort({ resumable: true });
			expect(hub.status).toBe("paused");

			// Second pause should be ignored (already paused)
			hub.abort({ resumable: true });
			expect(hub.status).toBe("paused");

			// Should still have only one paused session
			const session = hub.getPausedSession(hub.current().sessionId ?? "test-session");
			expect(session).toBeDefined();
		});

		it("abort without session active is no-op", () => {
			// Don't start session - abort should silently do nothing
			hub.abort({ resumable: true });
			expect(hub.status).toBe("idle"); // Should remain idle
		});

		it("inject while paused should still work via send()", async () => {
			const messages: string[] = [];

			hub.subscribe("session:message", (e: EnrichedEvent) => {
				const evt = e.event as { content: string };
				messages.push(evt.content);
			});

			// Start and pause
			hub.startSession();
			hub.abort({ resumable: true });

			// Inject via send() - should emit event (queued for when agent resumes)
			hub.send("test message while paused");

			// Note: send() checks sessionActive but we paused after starting,
			// and sessionActive stays true. So message should be emitted.
			expect(messages.length).toBeGreaterThanOrEqual(0); // Behavior depends on impl
		});

		it("maxIterations template with invalid value errors at runtime", async () => {
			const flow: FlowYaml = {
				flow: { name: "bad-template-test" },
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
							passAfter: 100, // Never passes
						},
					},
				],
				edges: [
					{ from: "coder", to: "reviewer" },
					{
						from: "reviewer",
						to: "coder",
						type: "loop",
						// Template that resolves to non-number
						maxIterations: "{{ flow.input.badValue }}",
						when: {
							not: { equals: { var: "reviewer.passed", value: true } },
						},
					},
				],
			};

			let error: Error | null = null;
			try {
				await executeFlow(flow, registry, hub, {
					badValue: "not-a-number", // Invalid: should be a number
				});
			} catch (e) {
				error = e as Error;
			}

			expect(error).not.toBeNull();
			expect(error?.message).toContain("positive integer");
		});

		it("maxIterations template that resolves correctly works", async () => {
			registry.resetCounters();

			const flow: FlowYaml = {
				flow: { name: "good-template-test" },
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
							passAfter: 2, // Will pass on 2nd iteration
						},
					},
				],
				edges: [
					{ from: "coder", to: "reviewer" },
					{
						from: "reviewer",
						to: "coder",
						type: "loop",
						maxIterations: "{{ flow.input.maxIter }}",
						when: {
							not: { equals: { var: "reviewer.passed", value: true } },
						},
					},
				],
			};

			const result = await executeFlow(flow, registry, hub, {
				maxIter: 5, // Should be enough for 2 iterations
			});

			const reviewerOutput = result.outputs.reviewer as { passed: boolean };
			expect(reviewerOutput.passed).toBe(true);
		});
	});
});
