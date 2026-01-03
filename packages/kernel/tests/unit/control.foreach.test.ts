// Unit and integration tests for control.foreach node
import { describe, expect, test } from "bun:test";
import { createHub } from "../../src/engine/hub.js";
import { executeFlow } from "../../src/flow/executor.js";
import { constantNode } from "../../src/flow/nodes/constant.js";
import { controlForeachNode } from "../../src/flow/nodes/control.foreach.js";
import { controlIfNode } from "../../src/flow/nodes/control.if.js";
import { echoNode } from "../../src/flow/nodes/echo.js";
import { NodeRegistry } from "../../src/flow/registry.js";
import type {
	ContainerNodeContext,
	FlowYaml,
} from "../../src/protocol/flow.js";

describe("control.foreach node", () => {
	test("iterates over array items", async () => {
		const hub = createHub("test-session");
		hub.startSession();
		const events: Array<{ type: string }> = [];

		hub.subscribe("*", (event) => {
			events.push(event.event as { type: string });
		});

		// Mock executeChild that returns item doubled
		const executeChild = async (
			nodeId: string,
			input: Record<string, unknown>,
		) => {
			return { result: `processed-${nodeId}-${input.item}` };
		};

		const ctx: ContainerNodeContext = {
			hub,
			runId: "run-0",
			executeChild,
		};

		const result = await controlForeachNode.run(ctx, {
			items: [1, 2, 3],
			as: "item",
			body: ["process"],
		});

		expect(result.iterations).toHaveLength(3);
		expect(result.iterations[0].item).toBe(1);
		expect(result.iterations[1].item).toBe(2);
		expect(result.iterations[2].item).toBe(3);

		// Each iteration should have outputs
		expect(result.iterations[0].outputs.process).toEqual({
			result: "processed-process-1",
		});
	});

	test("emits session:start and session:end events", async () => {
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

		const ctx: ContainerNodeContext = {
			hub,
			runId: "run-0",
			executeChild,
		};

		await controlForeachNode.run(ctx, {
			items: ["a", "b"],
			as: "letter",
			body: ["child1"],
		});

		// Should have 2 start and 2 end events (one per iteration)
		const starts = sessionEvents.filter((e) => e.type === "session:start");
		const ends = sessionEvents.filter((e) => e.type === "session:end");

		expect(starts).toHaveLength(2);
		expect(ends).toHaveLength(2);

		// Each session should have a unique ID
		expect(starts[0].sessionId).not.toBe(starts[1].sessionId);
	});

	test("handles empty array", async () => {
		const hub = createHub("test-session");
		hub.startSession();

		const executeChild = async () => ({});

		const ctx: ContainerNodeContext = {
			hub,
			runId: "run-0",
			executeChild,
		};

		const result = await controlForeachNode.run(ctx, {
			items: [],
			as: "item",
			body: ["process"],
		});

		expect(result.iterations).toHaveLength(0);
	});

	test("executes multiple child nodes in sequence", async () => {
		const hub = createHub("test-session");
		hub.startSession();
		const executionOrder: string[] = [];

		const executeChild = async (
			nodeId: string,
			input: Record<string, unknown>,
		) => {
			executionOrder.push(`${nodeId}:${input.task}`);
			return { nodeId };
		};

		const ctx: ContainerNodeContext = {
			hub,
			runId: "run-0",
			executeChild,
		};

		await controlForeachNode.run(ctx, {
			items: ["task1", "task2"],
			as: "task",
			body: ["step1", "step2", "step3"],
		});

		// Should execute all children for each item in order
		expect(executionOrder).toEqual([
			"step1:task1",
			"step2:task1",
			"step3:task1",
			"step1:task2",
			"step2:task2",
			"step3:task2",
		]);
	});

	test("passes session context to child nodes", async () => {
		const hub = createHub("test-session");
		hub.startSession();
		const sessionIds: string[] = [];

		const executeChild = async (
			_nodeId: string,
			input: Record<string, unknown>,
		) => {
			sessionIds.push(input.sessionId as string);
			return {};
		};

		const ctx: ContainerNodeContext = {
			hub,
			runId: "run-0",
			executeChild,
		};

		const result = await controlForeachNode.run(ctx, {
			items: [1, 2],
			as: "num",
			body: ["child"],
		});

		// Each iteration should have the same sessionId passed to children
		expect(sessionIds[0]).toBe(result.iterations[0].sessionId);
		expect(sessionIds[1]).toBe(result.iterations[1].sessionId);

		// Different iterations should have different session IDs
		expect(sessionIds[0]).not.toBe(sessionIds[1]);
	});

	test("has correct capabilities", () => {
		expect(controlForeachNode.capabilities?.isContainer).toBe(true);
		expect(controlForeachNode.capabilities?.createsSession).toBe(true);
	});

	describe("integration tests (with executor)", () => {
		test("executes child nodes within foreach via real executor", async () => {
			const registry = new NodeRegistry();
			registry.register(constantNode);
			registry.register(controlForeachNode);
			registry.register(echoNode);

			const flow: FlowYaml = {
				flow: { name: "foreach-real-executor-test" },
				nodes: [
					{
						id: "items",
						type: "constant",
						input: { value: ["apple", "banana", "cherry"] },
					},
					{
						id: "loop",
						type: "control.foreach",
						input: {
							items: "{{ items.value }}",
							as: "fruit",
							body: ["process"],
						},
					},
					{
						id: "process",
						type: "echo",
						input: { text: "Processing fruit" },
					},
				],
				edges: [{ from: "items", to: "loop" }],
			};

			const hub = createHub("foreach-real-test");

			const result = await executeFlow(flow, registry, hub);

			// Verify foreach output structure
			const foreachOutput = result.outputs.loop as {
				iterations: Array<{
					item: unknown;
					sessionId: string;
					outputs: Record<string, unknown>;
				}>;
			};

			expect(foreachOutput.iterations).toHaveLength(3);
			expect(foreachOutput.iterations[0].item).toBe("apple");
			expect(foreachOutput.iterations[1].item).toBe("banana");
			expect(foreachOutput.iterations[2].item).toBe("cherry");

			// Verify each iteration executed the child node
			expect(foreachOutput.iterations[0].outputs.process).toEqual({
				text: "Processing fruit",
			});
			expect(foreachOutput.iterations[1].outputs.process).toEqual({
				text: "Processing fruit",
			});
			expect(foreachOutput.iterations[2].outputs.process).toEqual({
				text: "Processing fruit",
			});
		});

		test("child nodes receive iteration variable in input bindings", async () => {
			const registry = new NodeRegistry();
			registry.register(constantNode);
			registry.register(controlForeachNode);
			registry.register(echoNode);

			const flow: FlowYaml = {
				flow: { name: "foreach-binding-test" },
				nodes: [
					{
						id: "items",
						type: "constant",
						input: {
							value: [
								{ name: "Alice", age: 30 },
								{ name: "Bob", age: 25 },
							],
						},
					},
					{
						id: "loop",
						type: "control.foreach",
						input: {
							items: "{{ items.value }}",
							as: "person",
							body: ["greet"],
						},
					},
					{
						id: "greet",
						type: "echo",
						input: { text: "Hello, {{ person.name }}!" },
					},
				],
				edges: [{ from: "items", to: "loop" }],
			};

			const hub = createHub("foreach-binding");

			const result = await executeFlow(flow, registry, hub);

			const foreachOutput = result.outputs.loop as {
				iterations: Array<{
					item: unknown;
					outputs: Record<string, { text: string }>;
				}>;
			};

			// Verify the person.name binding was resolved
			expect(foreachOutput.iterations[0].outputs.greet.text).toBe(
				"Hello, Alice!",
			);
			expect(foreachOutput.iterations[1].outputs.greet.text).toBe(
				"Hello, Bob!",
			);
		});

		test("emits session events per iteration via real executor", async () => {
			const registry = new NodeRegistry();
			registry.register(constantNode);
			registry.register(controlForeachNode);
			registry.register(echoNode);

			const flow: FlowYaml = {
				flow: { name: "foreach-session-events-test" },
				nodes: [
					{
						id: "items",
						type: "constant",
						input: { value: [1, 2] },
					},
					{
						id: "loop",
						type: "control.foreach",
						input: {
							items: "{{ items.value }}",
							as: "num",
							body: ["echo"],
						},
					},
					{
						id: "echo",
						type: "echo",
						input: { text: "Item" },
					},
				],
				edges: [{ from: "items", to: "loop" }],
			};

			const hub = createHub("foreach-session-events");
			const sessionEvents: Array<{ type: string; sessionId?: string }> = [];

			hub.subscribe("session:start", (event) => {
				sessionEvents.push(event.event as { type: string; sessionId: string });
			});
			hub.subscribe("session:end", (event) => {
				sessionEvents.push(event.event as { type: string; sessionId: string });
			});

			await executeFlow(flow, registry, hub);

			// Should have 2 start and 2 end events (one per iteration)
			const starts = sessionEvents.filter((e) => e.type === "session:start");
			const ends = sessionEvents.filter((e) => e.type === "session:end");

			expect(starts).toHaveLength(2);
			expect(ends).toHaveLength(2);

			// Session IDs should be unique per iteration
			expect(starts[0].sessionId).not.toBe(starts[1].sessionId);
		});

		test("executes multiple children in sequence per iteration", async () => {
			const registry = new NodeRegistry();
			registry.register(constantNode);
			registry.register(controlForeachNode);
			registry.register(echoNode);

			const flow: FlowYaml = {
				flow: { name: "foreach-multi-child-test" },
				nodes: [
					{
						id: "items",
						type: "constant",
						input: { value: ["task1", "task2"] },
					},
					{
						id: "loop",
						type: "control.foreach",
						input: {
							items: "{{ items.value }}",
							as: "task",
							body: ["step1", "step2"],
						},
					},
					{
						id: "step1",
						type: "echo",
						input: { text: "Step 1" },
					},
					{
						id: "step2",
						type: "echo",
						input: { text: "Step 2" },
					},
				],
				edges: [{ from: "items", to: "loop" }],
			};

			const hub = createHub("foreach-multi-child");

			const result = await executeFlow(flow, registry, hub);

			const foreachOutput = result.outputs.loop as {
				iterations: Array<{
					item: unknown;
					outputs: Record<string, { text: string }>;
				}>;
			};

			// Verify all children executed for each iteration
			expect(foreachOutput.iterations[0].outputs.step1.text).toBe("Step 1");
			expect(foreachOutput.iterations[0].outputs.step2.text).toBe("Step 2");
			expect(foreachOutput.iterations[1].outputs.step1.text).toBe("Step 1");
			expect(foreachOutput.iterations[1].outputs.step2.text).toBe("Step 2");
		});

		test("handles empty array via real executor", async () => {
			const registry = new NodeRegistry();
			registry.register(constantNode);
			registry.register(controlForeachNode);
			registry.register(echoNode);

			const flow: FlowYaml = {
				flow: { name: "foreach-empty-test" },
				nodes: [
					{
						id: "items",
						type: "constant",
						input: { value: [] },
					},
					{
						id: "loop",
						type: "control.foreach",
						input: {
							items: "{{ items.value }}",
							as: "item",
							body: ["process"],
						},
					},
					{
						id: "process",
						type: "echo",
						input: { text: "Should not run" },
					},
				],
				edges: [{ from: "items", to: "loop" }],
			};

			const hub = createHub("foreach-empty");

			const result = await executeFlow(flow, registry, hub);

			const foreachOutput = result.outputs.loop as {
				iterations: Array<unknown>;
			};

			expect(foreachOutput.iterations).toHaveLength(0);
		});

		test("foreach with conditional branching in child", async () => {
			const registry = new NodeRegistry();
			registry.register(constantNode);
			registry.register(controlForeachNode);
			registry.register(controlIfNode);
			registry.register(echoNode);

			const flow: FlowYaml = {
				flow: { name: "foreach-with-if-test" },
				nodes: [
					{
						id: "items",
						type: "constant",
						input: {
							value: [
								{ name: "Alice", isVip: true },
								{ name: "Bob", isVip: false },
							],
						},
					},
					{
						id: "loop",
						type: "control.foreach",
						input: {
							items: "{{ items.value }}",
							as: "customer",
							body: ["checkVip"],
						},
					},
					{
						id: "checkVip",
						type: "control.if",
						input: {
							condition: {
								equals: { var: "customer.isVip", value: true },
							},
						},
					},
				],
				edges: [{ from: "items", to: "loop" }],
			};

			const hub = createHub("foreach-with-if");

			const result = await executeFlow(flow, registry, hub);

			const foreachOutput = result.outputs.loop as {
				iterations: Array<{
					item: unknown;
					outputs: Record<string, { condition: boolean }>;
				}>;
			};

			// First customer is VIP, second is not
			expect(foreachOutput.iterations[0].outputs.checkVip.condition).toBe(true);
			expect(foreachOutput.iterations[1].outputs.checkVip.condition).toBe(
				false,
			);
		});
	});
});
