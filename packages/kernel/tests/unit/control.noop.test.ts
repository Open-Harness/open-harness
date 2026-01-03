// Unit and integration tests for control.noop node
import { describe, expect, test } from "bun:test";
import { createHub } from "../../src/engine/hub.js";
import { executeFlow } from "../../src/flow/executor.js";
import { constantNode } from "../../src/flow/nodes/constant.js";
import { controlIfNode } from "../../src/flow/nodes/control.if.js";
import { controlNoopNode } from "../../src/flow/nodes/control.noop.js";
import { echoNode } from "../../src/flow/nodes/echo.js";
import { NodeRegistry } from "../../src/flow/registry.js";
import type { FlowYaml, NodeRunContext } from "../../src/protocol/flow.js";

describe("control.noop node", () => {
	test("passes through value unchanged", async () => {
		const hub = createHub("test-session");
		hub.startSession();

		const ctx: NodeRunContext = {
			hub,
			runId: "run-0",
		};

		const result = await controlNoopNode.run(ctx, { value: "hello" });

		expect(result.value).toBe("hello");
	});

	test("handles undefined value", async () => {
		const hub = createHub("test-session");
		hub.startSession();

		const ctx: NodeRunContext = {
			hub,
			runId: "run-0",
		};

		const result = await controlNoopNode.run(ctx, {});

		expect(result.value).toBeUndefined();
	});

	test("passes through complex objects", async () => {
		const hub = createHub("test-session");
		hub.startSession();

		const ctx: NodeRunContext = {
			hub,
			runId: "run-0",
		};

		const complexValue = {
			nested: { deep: { value: [1, 2, 3] } },
			array: ["a", "b"],
		};

		const result = await controlNoopNode.run(ctx, { value: complexValue });

		expect(result.value).toEqual(complexValue);
	});

	test("has no special capabilities", () => {
		// noop is just a passthrough - no container, no session creation
		expect(controlNoopNode.capabilities?.isContainer).toBeFalsy();
		expect(controlNoopNode.capabilities?.createsSession).toBeFalsy();
		expect(controlNoopNode.capabilities?.needsBindingContext).toBeFalsy();
	});

	test("has correct type", () => {
		expect(controlNoopNode.type).toBe("control.noop");
	});

	test("has metadata for visual editor", () => {
		expect(controlNoopNode.metadata?.displayName).toBe("No-Op");
		expect(controlNoopNode.metadata?.category).toBe("control");
	});

	describe("integration tests (with executor)", () => {
		test("works as merge point after divergent branches", async () => {
			const registry = new NodeRegistry();
			registry.register(constantNode);
			registry.register(controlIfNode);
			registry.register(controlNoopNode);
			registry.register(echoNode);

			// Flow: source -> if-check
			//   if-check -> trueBranch (when true)
			//   if-check -> falseBranch (when false)
			//   trueBranch -> merge (noop)
			//   falseBranch -> merge (noop)
			//   merge -> final
			const flow: FlowYaml = {
				flow: { name: "merge-point-test" },
				nodes: [
					{
						id: "source",
						type: "constant",
						input: { value: "trigger" },
					},
					{
						id: "check",
						type: "control.if",
						input: {
							condition: { equals: { var: "source.value", value: "trigger" } },
						},
					},
					{
						id: "trueBranch",
						type: "echo",
						input: { text: "true path" },
					},
					{
						id: "falseBranch",
						type: "echo",
						input: { text: "false path" },
					},
					{
						id: "merge",
						type: "control.noop",
						input: { value: "merged" },
					},
					{
						id: "final",
						type: "echo",
						input: { text: "after merge: {{ merge.value }}" },
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
					{ from: "trueBranch", to: "merge" },
					{ from: "falseBranch", to: "merge" },
					{ from: "merge", to: "final" },
				],
			};

			const hub = createHub("merge-point");

			const result = await executeFlow(flow, registry, hub);

			// Check should evaluate to true (source.value == "trigger")
			expect(result.outputs.check).toEqual({ condition: true });

			// True branch should execute, false branch should be skipped
			expect(result.outputs.trueBranch).toEqual({ text: "true path" });
			expect(result.outputs.falseBranch).toEqual({ skipped: true });

			// Merge should receive the value and pass it through
			expect(result.outputs.merge).toEqual({ value: "merged" });

			// Final should have run after merge
			expect(result.outputs.final).toEqual({ text: "after merge: merged" });
		});

		test("receives data from upstream node via bindings", async () => {
			const registry = new NodeRegistry();
			registry.register(constantNode);
			registry.register(controlNoopNode);
			registry.register(echoNode);

			const flow: FlowYaml = {
				flow: { name: "noop-binding-test" },
				nodes: [
					{
						id: "source",
						type: "constant",
						input: { value: { data: "important-payload" } },
					},
					{
						id: "passthrough",
						type: "control.noop",
						input: { value: "{{ source.value }}" },
					},
					{
						id: "sink",
						type: "echo",
						input: { text: "received" },
					},
				],
				edges: [
					{ from: "source", to: "passthrough" },
					{ from: "passthrough", to: "sink" },
				],
			};

			const hub = createHub("noop-binding");

			const result = await executeFlow(flow, registry, hub);

			// Noop should have received and passed through the bound value
			expect(result.outputs.passthrough).toEqual({
				value: { data: "important-payload" },
			});
		});

		test("works as sync point in sequential flow", async () => {
			const registry = new NodeRegistry();
			registry.register(constantNode);
			registry.register(controlNoopNode);
			registry.register(echoNode);

			const flow: FlowYaml = {
				flow: { name: "sync-point-test" },
				nodes: [
					{
						id: "step1",
						type: "echo",
						input: { text: "step 1" },
					},
					{
						id: "sync",
						type: "control.noop",
						input: {},
					},
					{
						id: "step2",
						type: "echo",
						input: { text: "step 2" },
					},
				],
				edges: [
					{ from: "step1", to: "sync" },
					{ from: "sync", to: "step2" },
				],
			};

			const hub = createHub("sync-point");
			const nodeEvents: string[] = [];

			hub.subscribe("node:complete", (event) => {
				const e = event.event as { nodeId: string };
				nodeEvents.push(e.nodeId);
			});

			const result = await executeFlow(flow, registry, hub);

			// All nodes should have completed in order
			expect(nodeEvents).toEqual(["step1", "sync", "step2"]);

			// Sync point should have empty/undefined value
			expect(result.outputs.sync).toEqual({ value: undefined });
		});

		test("handles noop with no edges (isolated)", async () => {
			const registry = new NodeRegistry();
			registry.register(controlNoopNode);

			const flow: FlowYaml = {
				flow: { name: "isolated-noop-test" },
				nodes: [
					{
						id: "lonely",
						type: "control.noop",
						input: { value: "alone" },
					},
				],
				edges: [],
			};

			const hub = createHub("isolated-noop");

			const result = await executeFlow(flow, registry, hub);

			// Should still execute and return value
			expect(result.outputs.lonely).toEqual({ value: "alone" });
		});
	});
});
