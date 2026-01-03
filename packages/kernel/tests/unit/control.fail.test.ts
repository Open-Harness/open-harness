// Unit and integration tests for control.fail node
import { describe, expect, test } from "bun:test";
import { createHub } from "../../src/engine/hub.js";
import { executeFlow } from "../../src/flow/executor.js";
import { constantNode } from "../../src/flow/nodes/constant.js";
import {
	controlFailNode,
	FlowFailError,
} from "../../src/flow/nodes/control.fail.js";
import { controlIfNode } from "../../src/flow/nodes/control.if.js";
import { echoNode } from "../../src/flow/nodes/echo.js";
import { NodeRegistry } from "../../src/flow/registry.js";
import type { FlowYaml, NodeRunContext } from "../../src/protocol/flow.js";

describe("control.fail node", () => {
	test("throws FlowFailError with message", async () => {
		const hub = createHub("test-session");
		hub.startSession();

		const ctx: NodeRunContext = {
			hub,
			runId: "run-0",
		};

		await expect(
			controlFailNode.run(ctx, { message: "Something went wrong" }),
		).rejects.toThrow("Something went wrong");
	});

	test("throws FlowFailError instance", async () => {
		const hub = createHub("test-session");
		hub.startSession();

		const ctx: NodeRunContext = {
			hub,
			runId: "run-0",
		};

		try {
			await controlFailNode.run(ctx, { message: "Test failure" });
			expect.unreachable("Should have thrown");
		} catch (error) {
			expect(error).toBeInstanceOf(FlowFailError);
			expect((error as FlowFailError).isFlowFailError).toBe(true);
			expect((error as FlowFailError).name).toBe("FlowFailError");
		}
	});

	test("FlowFailError has discriminator property", () => {
		const error = new FlowFailError("test");

		expect(error.isFlowFailError).toBe(true);
		expect(error.message).toBe("test");
		expect(error.name).toBe("FlowFailError");
	});

	test("has correct type", () => {
		expect(controlFailNode.type).toBe("control.fail");
	});

	test("has metadata with danger color", () => {
		expect(controlFailNode.metadata?.displayName).toBe("Fail");
		expect(controlFailNode.metadata?.category).toBe("control");
		expect(controlFailNode.metadata?.color).toBe("#ef4444"); // Red
	});

	test("has no special capabilities", () => {
		expect(controlFailNode.capabilities?.isContainer).toBeFalsy();
		expect(controlFailNode.capabilities?.needsBindingContext).toBeFalsy();
	});

	describe("integration tests (with executor)", () => {
		test("FlowFailError propagates and stops execution (failFast default)", async () => {
			const registry = new NodeRegistry();
			registry.register(constantNode);
			registry.register(controlFailNode);
			registry.register(echoNode);

			const flow: FlowYaml = {
				flow: { name: "fail-propagates-test" },
				nodes: [
					{
						id: "source",
						type: "constant",
						input: { value: "start" },
					},
					{
						id: "fail",
						type: "control.fail",
						input: { message: "Intentional failure" },
					},
					{
						id: "unreachable",
						type: "echo",
						input: { text: "This should not run" },
					},
				],
				edges: [
					{ from: "source", to: "fail" },
					{ from: "fail", to: "unreachable" },
				],
			};

			const hub = createHub("fail-propagates");

			// The executor should throw the error
			await expect(executeFlow(flow, registry, hub)).rejects.toThrow(
				"Intentional failure",
			);
		});

		test("failFast: false continues after error and marks node failed", async () => {
			const registry = new NodeRegistry();
			registry.register(constantNode);
			registry.register(controlFailNode);
			registry.register(echoNode);

			const flow: FlowYaml = {
				flow: {
					name: "fail-continue-test",
					policy: { failFast: false },
				},
				nodes: [
					{
						id: "source",
						type: "constant",
						input: { value: "start" },
					},
					{
						id: "fail",
						type: "control.fail",
						input: { message: "Intentional failure" },
					},
					{
						id: "after",
						type: "echo",
						input: { text: "This should still run" },
					},
				],
				edges: [
					{ from: "source", to: "fail" },
					{ from: "fail", to: "after" },
				],
			};

			const hub = createHub("fail-continue");

			// With failFast: false, should not throw
			const result = await executeFlow(flow, registry, hub);

			// The failed node should have an error marker
			const failOutput = result.outputs.fail as {
				failed: boolean;
				error: { message: string };
			};
			expect(failOutput.failed).toBe(true);
			expect(failOutput.error.message).toBe("Intentional failure");

			// The subsequent node should still have run
			expect(result.outputs.after).toEqual({ text: "This should still run" });
		});

		test("control.fail used as guard node (conditional failure)", async () => {
			const registry = new NodeRegistry();
			registry.register(constantNode);
			registry.register(controlIfNode);
			registry.register(controlFailNode);
			registry.register(echoNode);

			// Flow: check condition -> fail if invalid, proceed if valid
			const flow: FlowYaml = {
				flow: {
					name: "guard-node-test",
					input: { isValid: false },
				},
				nodes: [
					{
						id: "check",
						type: "control.if",
						input: {
							condition: {
								equals: { var: "flow.input.isValid", value: false },
							},
						},
					},
					{
						id: "guard",
						type: "control.fail",
						input: { message: "Validation failed: input is invalid" },
					},
					{
						id: "proceed",
						type: "echo",
						input: { text: "Proceeding with valid input" },
					},
				],
				edges: [
					{
						from: "check",
						to: "guard",
						when: { equals: { var: "check.condition", value: true } },
					},
					{
						from: "check",
						to: "proceed",
						when: { equals: { var: "check.condition", value: false } },
					},
				],
			};

			const hub = createHub("guard-node");

			// With isValid: false, the guard should trigger
			await expect(executeFlow(flow, registry, hub)).rejects.toThrow(
				"Validation failed: input is invalid",
			);
		});

		test("control.fail with valid input does not execute", async () => {
			const registry = new NodeRegistry();
			registry.register(constantNode);
			registry.register(controlIfNode);
			registry.register(controlFailNode);
			registry.register(echoNode);

			// Same flow but with valid input
			const flow: FlowYaml = {
				flow: {
					name: "guard-passes-test",
					input: { isValid: true },
				},
				nodes: [
					{
						id: "check",
						type: "control.if",
						input: {
							condition: {
								equals: { var: "flow.input.isValid", value: false },
							},
						},
					},
					{
						id: "guard",
						type: "control.fail",
						input: { message: "Should not fail" },
					},
					{
						id: "proceed",
						type: "echo",
						input: { text: "Proceeding with valid input" },
					},
				],
				edges: [
					{
						from: "check",
						to: "guard",
						when: { equals: { var: "check.condition", value: true } },
					},
					{
						from: "check",
						to: "proceed",
						when: { equals: { var: "check.condition", value: false } },
					},
				],
			};

			const hub = createHub("guard-passes");

			// With isValid: true, should proceed without failure
			const result = await executeFlow(flow, registry, hub);

			// Guard should be skipped
			expect(result.outputs.guard).toEqual({ skipped: true });
			// Proceed should have run
			expect(result.outputs.proceed).toEqual({
				text: "Proceeding with valid input",
			});
		});

		test("emits node:error event on failure", async () => {
			const registry = new NodeRegistry();
			registry.register(constantNode);
			registry.register(controlFailNode);

			const flow: FlowYaml = {
				flow: { name: "fail-error-event-test" },
				nodes: [
					{
						id: "source",
						type: "constant",
						input: { value: "start" },
					},
					{
						id: "fail",
						type: "control.fail",
						input: { message: "Error event test" },
					},
				],
				edges: [{ from: "source", to: "fail" }],
			};

			const hub = createHub("fail-error-event");
			const errorEvents: Array<{
				type: string;
				nodeId: string;
				error: string;
			}> = [];

			hub.subscribe("node:error", (event) => {
				errorEvents.push(
					event.event as { type: string; nodeId: string; error: string },
				);
			});

			// Execute (will throw)
			try {
				await executeFlow(flow, registry, hub);
			} catch {
				// Expected
			}

			// Should have emitted node:error event
			expect(errorEvents).toHaveLength(1);
			expect(errorEvents[0].nodeId).toBe("fail");
			expect(errorEvents[0].error).toBe("Error event test");
		});
	});
});
