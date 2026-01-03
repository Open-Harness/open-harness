// Unit and integration tests for control.wait node
import { describe, expect, test } from "bun:test";
import { createHub } from "../../src/engine/hub.js";
import { executeFlow } from "../../src/flow/executor.js";
import { constantNode } from "../../src/flow/nodes/constant.js";
import { controlWaitNode } from "../../src/flow/nodes/control.wait.js";
import { echoNode } from "../../src/flow/nodes/echo.js";
import { NodeRegistry } from "../../src/flow/registry.js";
import type { FlowYaml, NodeRunContext } from "../../src/protocol/flow.js";

describe("control.wait node", () => {
	describe("unit tests", () => {
		test("waits for specified milliseconds", async () => {
			const hub = createHub("test-session");
			hub.startSession();

			const ctx: NodeRunContext = {
				hub,
				runId: "run-0",
			};

			const startTime = Date.now();
			const result = await controlWaitNode.run(ctx, { ms: 50 });
			const elapsed = Date.now() - startTime;

			// Should have waited at least 50ms (with some tolerance)
			expect(elapsed).toBeGreaterThanOrEqual(45);
			expect(result.waitedMs).toBeGreaterThanOrEqual(45);
			expect(result.waitedMs).toBeLessThan(200); // Sanity check
		});

		test("handles zero milliseconds", async () => {
			const hub = createHub("test-session");
			hub.startSession();

			const ctx: NodeRunContext = {
				hub,
				runId: "run-0",
			};

			const result = await controlWaitNode.run(ctx, { ms: 0 });

			expect(result.waitedMs).toBe(0);
		});

		test("handles undefined ms (defaults to 0)", async () => {
			const hub = createHub("test-session");
			hub.startSession();

			const ctx: NodeRunContext = {
				hub,
				runId: "run-0",
			};

			const result = await controlWaitNode.run(ctx, {});

			expect(result.waitedMs).toBe(0);
		});

		test("has correct type", () => {
			expect(controlWaitNode.type).toBe("control.wait");
		});

		test("has no special capabilities", () => {
			// wait is just a delay - no container, no session creation
			expect(controlWaitNode.capabilities?.isContainer).toBeFalsy();
			expect(controlWaitNode.capabilities?.createsSession).toBeFalsy();
			expect(controlWaitNode.capabilities?.needsBindingContext).toBeFalsy();
		});

		test("has metadata for visual editor", () => {
			expect(controlWaitNode.metadata?.displayName).toBe("Wait");
			expect(controlWaitNode.metadata?.category).toBe("control");
		});
	});

	describe("integration tests (with executor)", () => {
		test("wait delays execution in flow", async () => {
			const registry = new NodeRegistry();
			registry.register(constantNode);
			registry.register(controlWaitNode);
			registry.register(echoNode);

			const flow: FlowYaml = {
				flow: { name: "wait-delay-test" },
				nodes: [
					{
						id: "start",
						type: "constant",
						input: { value: "go" },
					},
					{
						id: "wait",
						type: "control.wait",
						input: { ms: 30 },
					},
					{
						id: "end",
						type: "echo",
						input: { text: "done" },
					},
				],
				edges: [
					{ from: "start", to: "wait" },
					{ from: "wait", to: "end" },
				],
			};

			const hub = createHub("wait-delay");
			const startTime = Date.now();
			const result = await executeFlow(flow, registry, hub);
			const elapsed = Date.now() - startTime;

			// Should have taken at least 30ms due to wait
			expect(elapsed).toBeGreaterThanOrEqual(25);
			expect(result.outputs.wait).toHaveProperty("waitedMs");
			expect(result.outputs.end).toEqual({ text: "done" });
		});

		test("wait with binding for ms value", async () => {
			const registry = new NodeRegistry();
			registry.register(constantNode);
			registry.register(controlWaitNode);
			registry.register(echoNode);

			const flow: FlowYaml = {
				flow: {
					name: "wait-binding-test",
					input: { delay: 20 },
				},
				nodes: [
					{
						id: "wait",
						type: "control.wait",
						input: { ms: "{{ flow.input.delay }}" },
					},
					{
						id: "end",
						type: "echo",
						input: { text: "completed" },
					},
				],
				edges: [{ from: "wait", to: "end" }],
			};

			const hub = createHub("wait-binding");
			const result = await executeFlow(flow, registry, hub);

			// Should have waited using the bound value
			const waitOutput = result.outputs.wait as { waitedMs: number };
			expect(waitOutput.waitedMs).toBeGreaterThanOrEqual(15);
		});

		test("multiple waits in sequence", async () => {
			const registry = new NodeRegistry();
			registry.register(controlWaitNode);
			registry.register(echoNode);

			const flow: FlowYaml = {
				flow: { name: "wait-sequence-test" },
				nodes: [
					{
						id: "wait1",
						type: "control.wait",
						input: { ms: 15 },
					},
					{
						id: "wait2",
						type: "control.wait",
						input: { ms: 15 },
					},
					{
						id: "end",
						type: "echo",
						input: { text: "done" },
					},
				],
				edges: [
					{ from: "wait1", to: "wait2" },
					{ from: "wait2", to: "end" },
				],
			};

			const hub = createHub("wait-sequence");
			const startTime = Date.now();
			await executeFlow(flow, registry, hub);
			const elapsed = Date.now() - startTime;

			// Should have taken at least 30ms (2 x 15ms waits)
			expect(elapsed).toBeGreaterThanOrEqual(25);
		});

		test("wait with zero ms proceeds immediately", async () => {
			const registry = new NodeRegistry();
			registry.register(controlWaitNode);
			registry.register(echoNode);

			const flow: FlowYaml = {
				flow: { name: "wait-zero-test" },
				nodes: [
					{
						id: "wait",
						type: "control.wait",
						input: { ms: 0 },
					},
					{
						id: "end",
						type: "echo",
						input: { text: "immediate" },
					},
				],
				edges: [{ from: "wait", to: "end" }],
			};

			const hub = createHub("wait-zero");
			const result = await executeFlow(flow, registry, hub);

			expect(result.outputs.wait).toEqual({ waitedMs: 0 });
			expect(result.outputs.end).toEqual({ text: "immediate" });
		});
	});
});
