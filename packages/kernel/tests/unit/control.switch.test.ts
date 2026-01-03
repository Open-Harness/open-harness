// Unit and integration tests for control.switch node
import { describe, expect, test } from "bun:test";
import { createHub } from "../../src/engine/hub.js";
import { executeFlow } from "../../src/flow/executor.js";
import { constantNode } from "../../src/flow/nodes/constant.js";
import { controlSwitchNode } from "../../src/flow/nodes/control.switch.js";
import { echoNode } from "../../src/flow/nodes/echo.js";
import { NodeRegistry } from "../../src/flow/registry.js";
import type {
	ControlNodeContext,
	FlowYaml,
	NodeRunContext,
} from "../../src/protocol/flow.js";

describe("control.switch node", () => {
	describe("unit tests", () => {
		test("matches first case", async () => {
			const hub = createHub("test-session");
			hub.startSession();

			const ctx: ControlNodeContext = {
				hub,
				runId: "run-0",
				bindingContext: {
					flow: { input: {} },
					classifier: { type: "bug" },
				},
			};

			const result = await controlSwitchNode.run(ctx, {
				value: "bug",
				cases: [
					{
						when: { equals: { var: "classifier.type", value: "bug" } },
						route: "bug-handler",
					},
					{
						when: { equals: { var: "classifier.type", value: "feature" } },
						route: "feature-handler",
					},
				],
			});

			expect(result.route).toBe("bug-handler");
			expect(result.value).toBe("bug");
		});

		test("matches second case", async () => {
			const hub = createHub("test-session");
			hub.startSession();

			const ctx: ControlNodeContext = {
				hub,
				runId: "run-0",
				bindingContext: {
					flow: { input: {} },
					classifier: { type: "feature" },
				},
			};

			const result = await controlSwitchNode.run(ctx, {
				value: "feature",
				cases: [
					{
						when: { equals: { var: "classifier.type", value: "bug" } },
						route: "bug-handler",
					},
					{
						when: { equals: { var: "classifier.type", value: "feature" } },
						route: "feature-handler",
					},
				],
			});

			expect(result.route).toBe("feature-handler");
			expect(result.value).toBe("feature");
		});

		test("returns default when no case matches", async () => {
			const hub = createHub("test-session");
			hub.startSession();

			const ctx: ControlNodeContext = {
				hub,
				runId: "run-0",
				bindingContext: {
					flow: { input: {} },
					classifier: { type: "unknown" },
				},
			};

			const result = await controlSwitchNode.run(ctx, {
				value: "unknown",
				cases: [
					{
						when: { equals: { var: "classifier.type", value: "bug" } },
						route: "bug-handler",
					},
					{
						when: { equals: { var: "classifier.type", value: "feature" } },
						route: "feature-handler",
					},
				],
			});

			expect(result.route).toBe("default");
			expect(result.value).toBe("unknown");
		});

		test("first match wins (order matters)", async () => {
			const hub = createHub("test-session");
			hub.startSession();

			const ctx: ControlNodeContext = {
				hub,
				runId: "run-0",
				bindingContext: {
					flow: { input: {} },
					data: { priority: "high", urgent: true },
				},
			};

			// Both cases would match, but first one wins
			const result = await controlSwitchNode.run(ctx, {
				value: "task",
				cases: [
					{
						when: { equals: { var: "data.priority", value: "high" } },
						route: "high-priority",
					},
					{
						when: { equals: { var: "data.urgent", value: true } },
						route: "urgent",
					},
				],
			});

			expect(result.route).toBe("high-priority");
		});

		test("passes through complex value", async () => {
			const hub = createHub("test-session");
			hub.startSession();

			const complexValue = { nested: { data: [1, 2, 3] } };

			const ctx: ControlNodeContext = {
				hub,
				runId: "run-0",
				bindingContext: {
					flow: { input: {} },
					upstream: { match: true },
				},
			};

			const result = await controlSwitchNode.run(ctx, {
				value: complexValue,
				cases: [
					{
						when: { equals: { var: "upstream.match", value: true } },
						route: "matched",
					},
				],
			});

			expect(result.value).toEqual(complexValue);
		});

		test("throws without binding context", async () => {
			const hub = createHub("test-session");
			hub.startSession();

			const ctx: NodeRunContext = {
				hub,
				runId: "run-0",
			};

			await expect(
				controlSwitchNode.run(ctx, {
					value: "test",
					cases: [{ when: { equals: { var: "x", value: 1 } }, route: "r1" }],
				}),
			).rejects.toThrow("control.switch requires binding context");
		});

		test("has needsBindingContext capability", () => {
			expect(controlSwitchNode.capabilities?.needsBindingContext).toBe(true);
		});

		test("has correct type", () => {
			expect(controlSwitchNode.type).toBe("control.switch");
		});

		test("has metadata", () => {
			expect(controlSwitchNode.metadata?.displayName).toBe("Switch");
			expect(controlSwitchNode.metadata?.category).toBe("control");
		});

		// Edge case tests
		test("returns default with empty cases array", async () => {
			const hub = createHub("test-session");
			hub.startSession();

			const ctx: ControlNodeContext = {
				hub,
				runId: "run-0",
				bindingContext: {
					flow: { input: {} },
				},
			};

			const result = await controlSwitchNode.run(ctx, {
				value: "anything",
				cases: [],
			});

			// With no cases, should always return default
			expect(result.route).toBe("default");
			expect(result.value).toBe("anything");
		});

		test("treats null value in binding context as not found", async () => {
			// Note: This is intentional behavior - null values are treated as "missing"
			// by the binding system. See bindings.ts resolveBindingPath lines 29-31.
			const hub = createHub("test-session");
			hub.startSession();

			const ctx: ControlNodeContext = {
				hub,
				runId: "run-0",
				bindingContext: {
					flow: { input: {} },
					data: { status: null },
				},
			};

			const result = await controlSwitchNode.run(ctx, {
				value: "test",
				cases: [
					{
						when: { equals: { var: "data.status", value: "active" } },
						route: "active",
					},
					// Can't match null directly - null is treated as "not found"
					// so this case won't match
					{
						when: { equals: { var: "data.status", value: null } },
						route: "null-handler",
					},
				],
			});

			// Neither case matches because null is treated as "not found"
			// This goes to default - documenting this edge case behavior
			expect(result.route).toBe("default");
		});

		test("handles undefined variable path gracefully", async () => {
			const hub = createHub("test-session");
			hub.startSession();

			const ctx: ControlNodeContext = {
				hub,
				runId: "run-0",
				bindingContext: {
					flow: { input: {} },
					// data.nonexistent will be undefined
				},
			};

			const result = await controlSwitchNode.run(ctx, {
				value: "test",
				cases: [
					{
						when: { equals: { var: "data.nonexistent", value: "something" } },
						route: "found",
					},
				],
			});

			// Undefined != "something", should go to default
			expect(result.route).toBe("default");
		});

		test("handles many cases (stress test)", async () => {
			const hub = createHub("test-session");
			hub.startSession();

			const ctx: ControlNodeContext = {
				hub,
				runId: "run-0",
				bindingContext: {
					flow: { input: {} },
					data: { value: 50 },
				},
			};

			// Create 100 cases, only the 50th should match
			const cases = Array.from({ length: 100 }, (_, i) => ({
				when: { equals: { var: "data.value", value: i } },
				route: `route-${i}`,
			}));

			const result = await controlSwitchNode.run(ctx, {
				value: "payload",
				cases,
			});

			expect(result.route).toBe("route-50");
			expect(result.value).toBe("payload");
		});

		test("works with boolean values", async () => {
			const hub = createHub("test-session");
			hub.startSession();

			const ctx: ControlNodeContext = {
				hub,
				runId: "run-0",
				bindingContext: {
					flow: { input: {} },
					config: { enabled: true },
				},
			};

			const result = await controlSwitchNode.run(ctx, {
				value: "data",
				cases: [
					{
						when: { equals: { var: "config.enabled", value: false } },
						route: "disabled",
					},
					{
						when: { equals: { var: "config.enabled", value: true } },
						route: "enabled",
					},
				],
			});

			expect(result.route).toBe("enabled");
		});

		test("works with numeric values", async () => {
			const hub = createHub("test-session");
			hub.startSession();

			const ctx: ControlNodeContext = {
				hub,
				runId: "run-0",
				bindingContext: {
					flow: { input: {} },
					counter: { count: 42 },
				},
			};

			const result = await controlSwitchNode.run(ctx, {
				value: "result",
				cases: [
					{
						when: { equals: { var: "counter.count", value: 0 } },
						route: "zero",
					},
					{
						when: { equals: { var: "counter.count", value: 42 } },
						route: "answer",
					},
				],
			});

			expect(result.route).toBe("answer");
		});
	});

	describe("integration tests (with executor)", () => {
		test("routes to matching case", async () => {
			const registry = new NodeRegistry();
			registry.register(constantNode);
			registry.register(controlSwitchNode);
			registry.register(echoNode);

			const flow: FlowYaml = {
				flow: { name: "switch-route-test" },
				nodes: [
					{
						id: "classifier",
						type: "constant",
						input: { value: "bug" },
					},
					{
						id: "router",
						type: "control.switch",
						input: {
							value: "{{ classifier.value }}",
							cases: [
								{
									when: { equals: { var: "classifier.value", value: "bug" } },
									route: "bug-handler",
								},
								{
									when: {
										equals: { var: "classifier.value", value: "feature" },
									},
									route: "feature-handler",
								},
							],
						},
					},
					{
						id: "bugHandler",
						type: "echo",
						input: { text: "Handling bug..." },
					},
					{
						id: "featureHandler",
						type: "echo",
						input: { text: "Handling feature..." },
					},
					{
						id: "defaultHandler",
						type: "echo",
						input: { text: "Unknown type" },
					},
				],
				edges: [
					{ from: "classifier", to: "router" },
					{
						from: "router",
						to: "bugHandler",
						when: { equals: { var: "router.route", value: "bug-handler" } },
					},
					{
						from: "router",
						to: "featureHandler",
						when: { equals: { var: "router.route", value: "feature-handler" } },
					},
					{
						from: "router",
						to: "defaultHandler",
						when: { equals: { var: "router.route", value: "default" } },
					},
				],
			};

			const hub = createHub("switch-test");
			const phase = async <T>(_name: string, fn: () => Promise<T>) => fn();
			const task = async <T>(_id: string, fn: () => Promise<T>) => fn();

			const result = await executeFlow(flow, registry, { hub, phase, task });

			expect(result.outputs.router).toEqual({
				route: "bug-handler",
				value: "bug",
			});
			expect(result.outputs.bugHandler).toEqual({ text: "Handling bug..." });
			expect(result.outputs.featureHandler).toEqual({ skipped: true });
			expect(result.outputs.defaultHandler).toEqual({ skipped: true });
		});

		test("routes to default when no match", async () => {
			const registry = new NodeRegistry();
			registry.register(constantNode);
			registry.register(controlSwitchNode);
			registry.register(echoNode);

			const flow: FlowYaml = {
				flow: { name: "switch-default-test" },
				nodes: [
					{
						id: "classifier",
						type: "constant",
						input: { value: "question" },
					},
					{
						id: "router",
						type: "control.switch",
						input: {
							value: "{{ classifier.value }}",
							cases: [
								{
									when: { equals: { var: "classifier.value", value: "bug" } },
									route: "bug-handler",
								},
								{
									when: {
										equals: { var: "classifier.value", value: "feature" },
									},
									route: "feature-handler",
								},
							],
						},
					},
					{
						id: "bugHandler",
						type: "echo",
						input: { text: "Bug" },
					},
					{
						id: "defaultHandler",
						type: "echo",
						input: { text: "Default handler" },
					},
				],
				edges: [
					{ from: "classifier", to: "router" },
					{
						from: "router",
						to: "bugHandler",
						when: { equals: { var: "router.route", value: "bug-handler" } },
					},
					{
						from: "router",
						to: "defaultHandler",
						when: { equals: { var: "router.route", value: "default" } },
					},
				],
			};

			const hub = createHub("switch-default");
			const phase = async <T>(_name: string, fn: () => Promise<T>) => fn();
			const task = async <T>(_id: string, fn: () => Promise<T>) => fn();

			const result = await executeFlow(flow, registry, { hub, phase, task });

			expect(result.outputs.router).toEqual({
				route: "default",
				value: "question",
			});
			expect(result.outputs.bugHandler).toEqual({ skipped: true });
			expect(result.outputs.defaultHandler).toEqual({
				text: "Default handler",
			});
		});

		test("passes value through to downstream nodes", async () => {
			const registry = new NodeRegistry();
			registry.register(constantNode);
			registry.register(controlSwitchNode);
			registry.register(echoNode);

			const flow: FlowYaml = {
				flow: { name: "switch-passthrough-test" },
				nodes: [
					{
						id: "source",
						type: "constant",
						input: { value: "important-data" },
					},
					{
						id: "router",
						type: "control.switch",
						input: {
							value: "{{ source.value }}",
							cases: [
								{
									when: {
										equals: { var: "source.value", value: "important-data" },
									},
									route: "handler",
								},
							],
						},
					},
					{
						id: "handler",
						type: "echo",
						input: { text: "Received: {{ router.value }}" },
					},
				],
				edges: [
					{ from: "source", to: "router" },
					{
						from: "router",
						to: "handler",
						when: { equals: { var: "router.route", value: "handler" } },
					},
				],
			};

			const hub = createHub("switch-passthrough");
			const phase = async <T>(_name: string, fn: () => Promise<T>) => fn();
			const task = async <T>(_id: string, fn: () => Promise<T>) => fn();

			const result = await executeFlow(flow, registry, { hub, phase, task });

			expect(result.outputs.handler).toEqual({
				text: "Received: important-data",
			});
		});
	});
});
