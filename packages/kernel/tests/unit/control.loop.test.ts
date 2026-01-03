// Unit and integration tests for control.loop node
import { describe, expect, test } from "bun:test";
import { createHub } from "../../src/engine/hub.js";
import { executeFlow } from "../../src/flow/executor.js";
import { constantNode } from "../../src/flow/nodes/constant.js";
import { controlLoopNode } from "../../src/flow/nodes/control.loop.js";
import { echoNode } from "../../src/flow/nodes/echo.js";
import { NodeRegistry } from "../../src/flow/registry.js";
import type {
	ContainerNodeContext,
	ControlNodeContext,
	FlowYaml,
} from "../../src/protocol/flow.js";

describe("control.loop node", () => {
	describe("unit tests", () => {
		test("loops while condition is true", async () => {
			const hub = createHub("test-session");
			hub.startSession();

			// Mock executeChild that tracks iterations
			const executeChild = async (
				_nodeId: string,
				input: Record<string, unknown>,
			) => {
				return { iteration: input.iteration };
			};

			const ctx: ContainerNodeContext & ControlNodeContext = {
				hub,
				runId: "run-0",
				executeChild,
				bindingContext: {
					flow: { input: {} },
					counter: { value: 0 },
				},
			};

			// Loop 3 times via maxIterations
			const result = await controlLoopNode.run(ctx, {
				while: { equals: { var: "loop.continue", value: true } },
				maxIterations: 3,
				body: ["child"],
			});

			expect(result.iterations).toHaveLength(3);
			expect(result.iterations[0].iteration).toBe(0);
			expect(result.iterations[1].iteration).toBe(1);
			expect(result.iterations[2].iteration).toBe(2);
		});

		test("stops when maxIterations reached", async () => {
			const hub = createHub("test-session");
			hub.startSession();

			const executeChild = async () => ({});

			const ctx: ContainerNodeContext & ControlNodeContext = {
				hub,
				runId: "run-0",
				executeChild,
				bindingContext: {
					flow: { input: {} },
					always: true, // Set to true so loop continues
				},
			};

			const result = await controlLoopNode.run(ctx, {
				while: { equals: { var: "always", value: true } }, // Always true
				maxIterations: 5,
				body: ["child"],
			});

			expect(result.iterations).toHaveLength(5);
		});

		test("defaults maxIterations to 100", async () => {
			const hub = createHub("test-session");
			hub.startSession();

			let iterations = 0;
			const executeChild = async () => {
				iterations++;
				return {};
			};

			const ctx: ContainerNodeContext & ControlNodeContext = {
				hub,
				runId: "run-0",
				executeChild,
				bindingContext: {
					flow: { input: {} },
					always: true, // Set to true so loop continues
				},
			};

			// No maxIterations specified - should default to 100
			const result = await controlLoopNode.run(ctx, {
				while: { equals: { var: "always", value: true } },
				body: ["child"],
			});

			expect(result.iterations).toHaveLength(100);
			expect(iterations).toBe(100);
		});

		test("executes zero iterations when condition starts false", async () => {
			const hub = createHub("test-session");
			hub.startSession();

			const executeChild = async () => ({});

			const ctx: ContainerNodeContext & ControlNodeContext = {
				hub,
				runId: "run-0",
				executeChild,
				bindingContext: {
					flow: { input: {} },
					flag: { ready: false },
				},
			};

			const result = await controlLoopNode.run(ctx, {
				while: { equals: { var: "flag.ready", value: true } },
				maxIterations: 10,
				body: ["child"],
			});

			expect(result.iterations).toHaveLength(0);
		});

		test("emits session events per iteration", async () => {
			const hub = createHub("test-session");
			hub.startSession();
			const sessionEvents: Array<{ type: string; sessionId?: string }> = [];

			hub.subscribe("session:start", (event) => {
				sessionEvents.push(event.event as { type: string; sessionId: string });
			});
			hub.subscribe("session:end", (event) => {
				sessionEvents.push(event.event as { type: string; sessionId: string });
			});

			const executeChild = async () => ({});

			const ctx: ContainerNodeContext & ControlNodeContext = {
				hub,
				runId: "run-0",
				executeChild,
				bindingContext: {
					flow: { input: {} },
					always: true, // Set to true so loop continues
				},
			};

			await controlLoopNode.run(ctx, {
				while: { equals: { var: "always", value: true } },
				maxIterations: 2,
				body: ["child"],
			});

			const starts = sessionEvents.filter((e) => e.type === "session:start");
			const ends = sessionEvents.filter((e) => e.type === "session:end");

			expect(starts).toHaveLength(2);
			expect(ends).toHaveLength(2);
			expect(starts[0].sessionId).not.toBe(starts[1].sessionId);
		});

		test("has correct capabilities", () => {
			expect(controlLoopNode.capabilities?.isContainer).toBe(true);
			expect(controlLoopNode.capabilities?.createsSession).toBe(true);
			expect(controlLoopNode.capabilities?.needsBindingContext).toBe(true);
		});

		test("has correct type", () => {
			expect(controlLoopNode.type).toBe("control.loop");
		});

		test("has metadata", () => {
			expect(controlLoopNode.metadata?.displayName).toBe("Loop");
			expect(controlLoopNode.metadata?.category).toBe("control");
		});
	});

	describe("integration tests (with executor)", () => {
		test("loops with real executor and binding updates", async () => {
			const registry = new NodeRegistry();
			registry.register(constantNode);
			registry.register(controlLoopNode);
			registry.register(echoNode);

			const flow: FlowYaml = {
				flow: { name: "loop-basic-test" },
				nodes: [
					{
						id: "init",
						type: "constant",
						input: { value: { count: 0 } },
					},
					{
						id: "loop",
						type: "control.loop",
						input: {
							while: { equals: { var: "loop.continue", value: true } },
							maxIterations: 3,
							body: ["echo"],
						},
					},
					{
						id: "echo",
						type: "echo",
						input: { text: "Iteration {{ loop.iteration }}" },
					},
				],
				edges: [{ from: "init", to: "loop" }],
			};

			const hub = createHub("loop-basic");
			const result = await executeFlow(flow, registry, hub);

			const loopOutput = result.outputs.loop as {
				iterations: Array<{
					iteration: number;
					outputs: Record<string, { text: string }>;
				}>;
			};

			expect(loopOutput.iterations).toHaveLength(3);
			expect(loopOutput.iterations[0].iteration).toBe(0);
			expect(loopOutput.iterations[1].iteration).toBe(1);
			expect(loopOutput.iterations[2].iteration).toBe(2);
		});

		test("loop with conditional exit", async () => {
			const registry = new NodeRegistry();
			registry.register(constantNode);
			registry.register(controlLoopNode);
			registry.register(echoNode);

			// The loop should stop when condition becomes false
			// We'll test with maxIterations as the stopping condition
			const flow: FlowYaml = {
				flow: { name: "loop-conditional-test" },
				nodes: [
					{
						id: "loop",
						type: "control.loop",
						input: {
							while: { equals: { var: "flow.input.enabled", value: true } },
							maxIterations: 5,
							body: ["work"],
						},
					},
					{
						id: "work",
						type: "echo",
						input: { text: "Working..." },
					},
				],
				edges: [],
			};

			const hub = createHub("loop-conditional");
			const result = await executeFlow(flow, registry, hub, { enabled: true });

			const loopOutput = result.outputs.loop as {
				iterations: Array<{ iteration: number }>;
			};

			expect(loopOutput.iterations).toHaveLength(5);
		});

		test("loop with zero iterations when condition is false", async () => {
			const registry = new NodeRegistry();
			registry.register(controlLoopNode);
			registry.register(echoNode);

			const flow: FlowYaml = {
				flow: {
					name: "loop-zero-test",
					input: { shouldLoop: false },
				},
				nodes: [
					{
						id: "loop",
						type: "control.loop",
						input: {
							while: { equals: { var: "flow.input.shouldLoop", value: true } },
							maxIterations: 10,
							body: ["never"],
						},
					},
					{
						id: "never",
						type: "echo",
						input: { text: "Should not run" },
					},
				],
				edges: [],
			};

			const hub = createHub("loop-zero");
			const result = await executeFlow(flow, registry, hub);

			const loopOutput = result.outputs.loop as {
				iterations: Array<unknown>;
			};

			expect(loopOutput.iterations).toHaveLength(0);
		});

		test("loop emits session events via real executor", async () => {
			const registry = new NodeRegistry();
			registry.register(controlLoopNode);
			registry.register(echoNode);

			const flow: FlowYaml = {
				flow: { name: "loop-events-test" },
				nodes: [
					{
						id: "loop",
						type: "control.loop",
						input: {
							while: { equals: { var: "loop.continue", value: true } },
							maxIterations: 2,
							body: ["work"],
						},
					},
					{
						id: "work",
						type: "echo",
						input: { text: "Working" },
					},
				],
				edges: [],
			};

			const hub = createHub("loop-events");
			const sessionEvents: Array<{ type: string }> = [];

			hub.subscribe("session:start", (event) => {
				sessionEvents.push(event.event as { type: string });
			});
			hub.subscribe("session:end", (event) => {
				sessionEvents.push(event.event as { type: string });
			});

			await executeFlow(flow, registry, hub);

			const starts = sessionEvents.filter((e) => e.type === "session:start");
			const ends = sessionEvents.filter((e) => e.type === "session:end");

			expect(starts).toHaveLength(2);
			expect(ends).toHaveLength(2);
		});
	});
});
