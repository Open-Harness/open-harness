// Unit and integration tests for control.if node
import { describe, expect, test } from "bun:test";
import { createHub } from "../../src/engine/hub.js";
import { executeFlow } from "../../src/flow/executor.js";
import { constantNode } from "../../src/flow/nodes/constant.js";
import { controlIfNode } from "../../src/flow/nodes/control.if.js";
import { echoNode } from "../../src/flow/nodes/echo.js";
import { NodeRegistry } from "../../src/flow/registry.js";
import type {
	ControlNodeContext,
	FlowYaml,
	NodeRunContext,
} from "../../src/protocol/flow.js";

describe("control.if node", () => {
	describe("unit tests", () => {
		test("evaluates equals condition to true", async () => {
			const hub = createHub("test-session");
			hub.startSession();

			const ctx: ControlNodeContext = {
				hub,
				runId: "run-0",
				bindingContext: {
					flow: { input: {} },
					upstream: { status: "success" },
				},
			};

			const result = await controlIfNode.run(ctx, {
				condition: {
					equals: { var: "upstream.status", value: "success" },
				},
			});

			expect(result.condition).toBe(true);
		});

		test("evaluates equals condition to false", async () => {
			const hub = createHub("test-session");
			hub.startSession();

			const ctx: ControlNodeContext = {
				hub,
				runId: "run-0",
				bindingContext: {
					flow: { input: {} },
					upstream: { status: "failed" },
				},
			};

			const result = await controlIfNode.run(ctx, {
				condition: {
					equals: { var: "upstream.status", value: "success" },
				},
			});

			expect(result.condition).toBe(false);
		});

		test("evaluates not condition", async () => {
			const hub = createHub("test-session");
			hub.startSession();

			const ctx: ControlNodeContext = {
				hub,
				runId: "run-0",
				bindingContext: {
					flow: { input: {} },
					upstream: { enabled: false },
				},
			};

			const result = await controlIfNode.run(ctx, {
				condition: {
					not: { equals: { var: "upstream.enabled", value: true } },
				},
			});

			expect(result.condition).toBe(true);
		});

		test("evaluates and condition", async () => {
			const hub = createHub("test-session");
			hub.startSession();

			const ctx: ControlNodeContext = {
				hub,
				runId: "run-0",
				bindingContext: {
					flow: { input: {} },
					upstream: { a: 1, b: 2 },
				},
			};

			const result = await controlIfNode.run(ctx, {
				condition: {
					and: [
						{ equals: { var: "upstream.a", value: 1 } },
						{ equals: { var: "upstream.b", value: 2 } },
					],
				},
			});

			expect(result.condition).toBe(true);
		});

		test("evaluates or condition", async () => {
			const hub = createHub("test-session");
			hub.startSession();

			const ctx: ControlNodeContext = {
				hub,
				runId: "run-0",
				bindingContext: {
					flow: { input: {} },
					upstream: { status: "partial" },
				},
			};

			const result = await controlIfNode.run(ctx, {
				condition: {
					or: [
						{ equals: { var: "upstream.status", value: "success" } },
						{ equals: { var: "upstream.status", value: "partial" } },
					],
				},
			});

			expect(result.condition).toBe(true);
		});

		test("throws without binding context", async () => {
			const hub = createHub("test-session");
			hub.startSession();

			// Regular NodeRunContext without bindingContext
			const ctx: NodeRunContext = {
				hub,
				runId: "run-0",
			};

			await expect(
				controlIfNode.run(ctx, {
					condition: { equals: { var: "x", value: 1 } },
				}),
			).rejects.toThrow("control.if requires binding context");
		});

		test("has needsBindingContext capability", () => {
			expect(controlIfNode.capabilities?.needsBindingContext).toBe(true);
		});

		test("has correct type", () => {
			expect(controlIfNode.type).toBe("control.if");
		});

		test("has metadata", () => {
			expect(controlIfNode.metadata?.displayName).toBe("If");
			expect(controlIfNode.metadata?.category).toBe("control");
		});
	});

	describe("integration tests (with executor)", () => {
		test("branches flow based on condition", async () => {
			const registry = new NodeRegistry();
			registry.register(constantNode);
			registry.register(controlIfNode);
			registry.register(echoNode);

			const flow: FlowYaml = {
				flow: { name: "if-branch-test" },
				nodes: [
					{
						id: "source",
						type: "constant",
						input: { value: "yes" },
					},
					{
						id: "check",
						type: "control.if",
						input: {
							condition: {
								equals: { var: "source.value", value: "yes" },
							},
						},
					},
					{
						id: "trueBranch",
						type: "echo",
						input: { text: "Condition was true" },
					},
					{
						id: "falseBranch",
						type: "echo",
						input: { text: "Condition was false" },
					},
				],
				edges: [
					{ from: "source", to: "check" },
					{
						from: "check",
						to: "trueBranch",
						when: { equals: { var: "check.condition", value: true } },
					},
					{
						from: "check",
						to: "falseBranch",
						when: { equals: { var: "check.condition", value: false } },
					},
				],
			};

			const hub = createHub("if-test");
			const phase = async <T>(_name: string, fn: () => Promise<T>) => fn();
			const task = async <T>(_id: string, fn: () => Promise<T>) => fn();

			const result = await executeFlow(flow, registry, { hub, phase, task });

			expect(result.outputs.check).toEqual({ condition: true });
			expect(result.outputs.trueBranch).toEqual({
				text: "Condition was true",
			});
			expect(result.outputs.falseBranch).toEqual({ skipped: true });
		});

		test("false condition skips true branch", async () => {
			const registry = new NodeRegistry();
			registry.register(constantNode);
			registry.register(controlIfNode);
			registry.register(echoNode);

			const flow: FlowYaml = {
				flow: { name: "if-false-test" },
				nodes: [
					{
						id: "source",
						type: "constant",
						input: { value: "no" },
					},
					{
						id: "check",
						type: "control.if",
						input: {
							condition: {
								equals: { var: "source.value", value: "yes" },
							},
						},
					},
					{
						id: "trueBranch",
						type: "echo",
						input: { text: "Condition was true" },
					},
					{
						id: "falseBranch",
						type: "echo",
						input: { text: "Condition was false" },
					},
				],
				edges: [
					{ from: "source", to: "check" },
					{
						from: "check",
						to: "trueBranch",
						when: { equals: { var: "check.condition", value: true } },
					},
					{
						from: "check",
						to: "falseBranch",
						when: { equals: { var: "check.condition", value: false } },
					},
				],
			};

			const hub = createHub("if-false-test");
			const phase = async <T>(_name: string, fn: () => Promise<T>) => fn();
			const task = async <T>(_id: string, fn: () => Promise<T>) => fn();

			const result = await executeFlow(flow, registry, { hub, phase, task });

			expect(result.outputs.check).toEqual({ condition: false });
			expect(result.outputs.trueBranch).toEqual({ skipped: true });
			expect(result.outputs.falseBranch).toEqual({
				text: "Condition was false",
			});
		});

		test("checks flow.input values", async () => {
			const registry = new NodeRegistry();
			registry.register(controlIfNode);
			registry.register(echoNode);

			const flow: FlowYaml = {
				flow: {
					name: "if-flow-input-test",
					input: { enabled: true },
				},
				nodes: [
					{
						id: "check",
						type: "control.if",
						input: {
							condition: {
								equals: { var: "flow.input.enabled", value: true },
							},
						},
					},
					{
						id: "output",
						type: "echo",
						input: { text: "Enabled!" },
					},
				],
				edges: [
					{
						from: "check",
						to: "output",
						when: { equals: { var: "check.condition", value: true } },
					},
				],
			};

			const hub = createHub("if-flow-input");
			const phase = async <T>(_name: string, fn: () => Promise<T>) => fn();
			const task = async <T>(_id: string, fn: () => Promise<T>) => fn();

			const result = await executeFlow(flow, registry, { hub, phase, task });

			expect(result.outputs.check).toEqual({ condition: true });
			expect(result.outputs.output).toEqual({ text: "Enabled!" });
		});
	});
});
