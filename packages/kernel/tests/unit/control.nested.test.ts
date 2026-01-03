// Integration tests for nested control flow patterns
// Tests complex compositions of control nodes to verify they work together correctly
import { describe, expect, test } from "bun:test";
import { createHub } from "../../src/engine/hub.js";
import { executeFlow } from "../../src/flow/executor.js";
import { constantNode } from "../../src/flow/nodes/constant.js";
import { controlFailNode } from "../../src/flow/nodes/control.fail.js";
import { controlForeachNode } from "../../src/flow/nodes/control.foreach.js";
import { controlIfNode } from "../../src/flow/nodes/control.if.js";
import { controlNoopNode } from "../../src/flow/nodes/control.noop.js";
import { controlSwitchNode } from "../../src/flow/nodes/control.switch.js";
import { echoNode } from "../../src/flow/nodes/echo.js";
import { NodeRegistry } from "../../src/flow/registry.js";
import type { FlowYaml } from "../../src/protocol/flow.js";

describe("nested control flow", () => {
	function createRegistry(): NodeRegistry {
		const registry = new NodeRegistry();
		registry.register(constantNode);
		registry.register(controlIfNode);
		registry.register(controlSwitchNode);
		registry.register(controlNoopNode);
		registry.register(controlFailNode);
		registry.register(controlForeachNode);
		registry.register(echoNode);
		return registry;
	}

	describe("foreach containing conditional logic", () => {
		test("foreach with if node - different items take different branches", async () => {
			const registry = createRegistry();

			// Process a list of items, some are VIP, some are not
			const flow: FlowYaml = {
				flow: { name: "foreach-if-branches" },
				nodes: [
					{
						id: "customers",
						type: "constant",
						input: {
							value: [
								{ name: "Alice", isVip: true },
								{ name: "Bob", isVip: false },
								{ name: "Charlie", isVip: true },
							],
						},
					},
					{
						id: "process",
						type: "control.foreach",
						input: {
							items: "{{ customers.value }}",
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
				edges: [{ from: "customers", to: "process" }],
			};

			const hub = createHub("foreach-if");
			const result = await executeFlow(flow, registry, hub);

			const foreachOutput = result.outputs.process as {
				iterations: Array<{
					item: { name: string; isVip: boolean };
					outputs: { checkVip: { condition: boolean } };
				}>;
			};

			// Alice is VIP
			expect(foreachOutput.iterations[0].outputs.checkVip.condition).toBe(true);
			// Bob is not VIP
			expect(foreachOutput.iterations[1].outputs.checkVip.condition).toBe(
				false,
			);
			// Charlie is VIP
			expect(foreachOutput.iterations[2].outputs.checkVip.condition).toBe(true);
		});

		test("foreach with switch node - routes items differently", async () => {
			const registry = createRegistry();

			// Process issues of different types
			const flow: FlowYaml = {
				flow: { name: "foreach-switch-routing" },
				nodes: [
					{
						id: "issues",
						type: "constant",
						input: {
							value: [
								{ id: 1, type: "bug" },
								{ id: 2, type: "feature" },
								{ id: 3, type: "docs" },
								{ id: 4, type: "bug" },
							],
						},
					},
					{
						id: "process",
						type: "control.foreach",
						input: {
							items: "{{ issues.value }}",
							as: "issue",
							body: ["classify"],
						},
					},
					{
						id: "classify",
						type: "control.switch",
						input: {
							value: "{{ issue.type }}",
							cases: [
								{
									when: { equals: { var: "issue.type", value: "bug" } },
									route: "urgent",
								},
								{
									when: { equals: { var: "issue.type", value: "feature" } },
									route: "roadmap",
								},
							],
						},
					},
				],
				edges: [{ from: "issues", to: "process" }],
			};

			const hub = createHub("foreach-switch");
			const result = await executeFlow(flow, registry, hub);

			const foreachOutput = result.outputs.process as {
				iterations: Array<{
					item: { id: number; type: string };
					outputs: { classify: { route: string; value: string } };
				}>;
			};

			expect(foreachOutput.iterations[0].outputs.classify.route).toBe("urgent");
			expect(foreachOutput.iterations[1].outputs.classify.route).toBe(
				"roadmap",
			);
			expect(foreachOutput.iterations[2].outputs.classify.route).toBe(
				"default",
			); // docs not in cases
			expect(foreachOutput.iterations[3].outputs.classify.route).toBe("urgent");
		});
	});

	describe("sequential control nodes", () => {
		test("if followed by switch - chained decisions", async () => {
			const registry = createRegistry();

			// First check if enabled, then route by type
			const flow: FlowYaml = {
				flow: {
					name: "if-then-switch",
					input: { enabled: true, type: "premium" },
				},
				nodes: [
					{
						id: "checkEnabled",
						type: "control.if",
						input: {
							condition: {
								equals: { var: "flow.input.enabled", value: true },
							},
						},
					},
					{
						id: "routeByType",
						type: "control.switch",
						input: {
							value: "{{ flow.input.type }}",
							cases: [
								{
									when: { equals: { var: "flow.input.type", value: "basic" } },
									route: "basic-handler",
								},
								{
									when: {
										equals: { var: "flow.input.type", value: "premium" },
									},
									route: "premium-handler",
								},
							],
						},
					},
					{
						id: "basicHandler",
						type: "echo",
						input: { text: "Basic tier" },
					},
					{
						id: "premiumHandler",
						type: "echo",
						input: { text: "Premium tier" },
					},
					{
						id: "disabledHandler",
						type: "echo",
						input: { text: "Disabled" },
					},
				],
				edges: [
					{
						from: "checkEnabled",
						to: "routeByType",
						when: { equals: { var: "checkEnabled.condition", value: true } },
					},
					{
						from: "checkEnabled",
						to: "disabledHandler",
						when: { equals: { var: "checkEnabled.condition", value: false } },
					},
					{
						from: "routeByType",
						to: "basicHandler",
						when: {
							equals: { var: "routeByType.route", value: "basic-handler" },
						},
					},
					{
						from: "routeByType",
						to: "premiumHandler",
						when: {
							equals: { var: "routeByType.route", value: "premium-handler" },
						},
					},
				],
			};

			const hub = createHub("if-then-switch");
			const result = await executeFlow(flow, registry, hub);

			// Enabled = true, type = premium
			expect(result.outputs.checkEnabled).toEqual({ condition: true });
			expect(result.outputs.routeByType).toEqual({
				route: "premium-handler",
				value: "premium",
			});
			expect(result.outputs.premiumHandler).toEqual({ text: "Premium tier" });
			expect(result.outputs.basicHandler).toEqual({ skipped: true });
			expect(result.outputs.disabledHandler).toEqual({ skipped: true });
		});

		test("switch followed by if - refined routing", async () => {
			const registry = createRegistry();

			// Route by category, then check if priority is high
			const flow: FlowYaml = {
				flow: {
					name: "switch-then-if",
					input: { category: "support", priority: "high" },
				},
				nodes: [
					{
						id: "routeCategory",
						type: "control.switch",
						input: {
							value: "{{ flow.input.category }}",
							cases: [
								{
									when: {
										equals: { var: "flow.input.category", value: "support" },
									},
									route: "support-team",
								},
								{
									when: {
										equals: { var: "flow.input.category", value: "sales" },
									},
									route: "sales-team",
								},
							],
						},
					},
					{
						id: "checkPriority",
						type: "control.if",
						input: {
							condition: {
								equals: { var: "flow.input.priority", value: "high" },
							},
						},
					},
					{
						id: "urgentHandler",
						type: "echo",
						input: { text: "Urgent support case" },
					},
					{
						id: "normalHandler",
						type: "echo",
						input: { text: "Normal support case" },
					},
				],
				edges: [
					{
						from: "routeCategory",
						to: "checkPriority",
						when: {
							equals: { var: "routeCategory.route", value: "support-team" },
						},
					},
					{
						from: "checkPriority",
						to: "urgentHandler",
						when: { equals: { var: "checkPriority.condition", value: true } },
					},
					{
						from: "checkPriority",
						to: "normalHandler",
						when: { equals: { var: "checkPriority.condition", value: false } },
					},
				],
			};

			const hub = createHub("switch-then-if");
			const result = await executeFlow(flow, registry, hub);

			expect(result.outputs.routeCategory).toEqual({
				route: "support-team",
				value: "support",
			});
			expect(result.outputs.checkPriority).toEqual({ condition: true });
			expect(result.outputs.urgentHandler).toEqual({
				text: "Urgent support case",
			});
			expect(result.outputs.normalHandler).toEqual({ skipped: true });
		});
	});

	describe("conditional failure patterns", () => {
		test("if -> fail creates a guard pattern", async () => {
			const registry = createRegistry();

			// Guard: fail if required field is missing
			const flow: FlowYaml = {
				flow: {
					name: "guard-pattern",
					input: { email: "" }, // Empty = invalid
				},
				nodes: [
					{
						id: "checkEmail",
						type: "control.if",
						input: {
							condition: {
								equals: { var: "flow.input.email", value: "" },
							},
						},
					},
					{
						id: "failMissingEmail",
						type: "control.fail",
						input: { message: "Email is required" },
					},
					{
						id: "proceed",
						type: "echo",
						input: { text: "Processing..." },
					},
				],
				edges: [
					{
						from: "checkEmail",
						to: "failMissingEmail",
						when: { equals: { var: "checkEmail.condition", value: true } },
					},
					{
						from: "checkEmail",
						to: "proceed",
						when: { equals: { var: "checkEmail.condition", value: false } },
					},
				],
			};

			const hub = createHub("guard-pattern");

			// Should fail because email is empty
			await expect(executeFlow(flow, registry, hub)).rejects.toThrow(
				"Email is required",
			);
		});

		test("switch -> fail on specific route", async () => {
			const registry = createRegistry();

			// Fail on deprecated route
			const flow: FlowYaml = {
				flow: {
					name: "switch-fail",
					input: { version: "v1" },
				},
				nodes: [
					{
						id: "routeVersion",
						type: "control.switch",
						input: {
							value: "{{ flow.input.version }}",
							cases: [
								{
									when: { equals: { var: "flow.input.version", value: "v1" } },
									route: "deprecated",
								},
								{
									when: { equals: { var: "flow.input.version", value: "v2" } },
									route: "current",
								},
							],
						},
					},
					{
						id: "failDeprecated",
						type: "control.fail",
						input: { message: "API v1 is deprecated" },
					},
					{
						id: "handleV2",
						type: "echo",
						input: { text: "Processing v2 request" },
					},
				],
				edges: [
					{
						from: "routeVersion",
						to: "failDeprecated",
						when: {
							equals: { var: "routeVersion.route", value: "deprecated" },
						},
					},
					{
						from: "routeVersion",
						to: "handleV2",
						when: { equals: { var: "routeVersion.route", value: "current" } },
					},
				],
			};

			const hub = createHub("switch-fail");

			// Should fail because version is v1
			await expect(executeFlow(flow, registry, hub)).rejects.toThrow(
				"API v1 is deprecated",
			);
		});
	});

	describe("noop as synchronization point", () => {
		test("multiple branches merge via noop", async () => {
			const registry = createRegistry();

			// Two branches that merge at a noop before final processing
			const flow: FlowYaml = {
				flow: {
					name: "multi-branch-merge",
					input: { isAdmin: false },
				},
				nodes: [
					{
						id: "checkAdmin",
						type: "control.if",
						input: {
							condition: {
								equals: { var: "flow.input.isAdmin", value: true },
							},
						},
					},
					{
						id: "adminPath",
						type: "echo",
						input: { text: "Admin access" },
					},
					{
						id: "userPath",
						type: "echo",
						input: { text: "User access" },
					},
					{
						id: "sync",
						type: "control.noop",
						input: { value: "synced" },
					},
					{
						id: "final",
						type: "echo",
						input: { text: "Access granted" },
					},
				],
				edges: [
					{
						from: "checkAdmin",
						to: "adminPath",
						when: { equals: { var: "checkAdmin.condition", value: true } },
					},
					{
						from: "checkAdmin",
						to: "userPath",
						when: { equals: { var: "checkAdmin.condition", value: false } },
					},
					{ from: "adminPath", to: "sync" },
					{ from: "userPath", to: "sync" },
					{ from: "sync", to: "final" },
				],
			};

			const hub = createHub("multi-branch-merge");
			const result = await executeFlow(flow, registry, hub);

			// User path taken (isAdmin = false)
			expect(result.outputs.checkAdmin).toEqual({ condition: false });
			expect(result.outputs.adminPath).toEqual({ skipped: true });
			expect(result.outputs.userPath).toEqual({ text: "User access" });
			expect(result.outputs.sync).toEqual({ value: "synced" });
			expect(result.outputs.final).toEqual({ text: "Access granted" });
		});
	});

	describe("complex compositions", () => {
		test("foreach with switch routing and conditional failure", async () => {
			const registry = createRegistry();

			// Process items, route by type, fail on invalid
			const flow: FlowYaml = {
				flow: {
					name: "complex-foreach-switch",
					policy: { failFast: false }, // Continue processing other items
				},
				nodes: [
					{
						id: "items",
						type: "constant",
						input: {
							value: [
								{ id: 1, type: "valid" },
								{ id: 2, type: "unknown" },
							],
						},
					},
					{
						id: "process",
						type: "control.foreach",
						input: {
							items: "{{ items.value }}",
							as: "item",
							body: ["classify"],
						},
					},
					{
						id: "classify",
						type: "control.switch",
						input: {
							value: "{{ item.type }}",
							cases: [
								{
									when: { equals: { var: "item.type", value: "valid" } },
									route: "process",
								},
							],
						},
					},
				],
				edges: [{ from: "items", to: "process" }],
			};

			const hub = createHub("complex-foreach");
			const result = await executeFlow(flow, registry, hub);

			const foreachOutput = result.outputs.process as {
				iterations: Array<{
					item: { id: number; type: string };
					outputs: { classify: { route: string } };
				}>;
			};

			// First item is valid, second is unknown (goes to default)
			expect(foreachOutput.iterations[0].outputs.classify.route).toBe(
				"process",
			);
			expect(foreachOutput.iterations[1].outputs.classify.route).toBe(
				"default",
			);
		});
	});
});
