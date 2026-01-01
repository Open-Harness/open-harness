import { describe, expect, test } from "bun:test";
import { createHub } from "../../src/engine/hub.js";
import { executeFlow } from "../../src/flow/executor.js";
import { conditionEqualsNode } from "../../src/flow/nodes/condition.equals.js";
import { constantNode } from "../../src/flow/nodes/constant.js";
import { echoNode } from "../../src/flow/nodes/echo.js";
import { NodeRegistry } from "../../src/flow/registry.js";
import type { FlowYaml } from "../../src/protocol/flow.js";

describe("Flow edge when", () => {
	test("edge when gates downstream nodes", async () => {
		const registry = new NodeRegistry();
		registry.register(constantNode);
		registry.register(conditionEqualsNode);
		registry.register(echoNode);

		const flow: FlowYaml = {
			flow: { name: "edge-when" },
			nodes: [
				{
					id: "facts",
					type: "constant",
					input: { value: "yes" },
				},
				{
					id: "isYes",
					type: "condition.equals",
					input: { left: "{{facts.value}}", right: "yes" },
				},
				{
					id: "sayYes",
					type: "echo",
					input: { text: "Condition matched: yes" },
				},
				{
					id: "sayNo",
					type: "echo",
					input: { text: "Condition matched: no" },
				},
			],
			edges: [
				{ from: "facts", to: "isYes" },
				{
					from: "isYes",
					to: "sayYes",
					when: { equals: { var: "isYes.value", value: true } },
				},
				{
					from: "isYes",
					to: "sayNo",
					when: { equals: { var: "isYes.value", value: false } },
				},
			],
		};

		const hub = createHub("edge-when-test");
		const phase = async <T>(_name: string, fn: () => Promise<T>) => fn();
		const task = async <T>(_id: string, fn: () => Promise<T>) => fn();

		const result = await executeFlow(flow, registry, { hub, phase, task });

		expect(result.outputs.isYes).toEqual({ value: true });
		expect(result.outputs.sayYes).toEqual({ text: "Condition matched: yes" });
		expect(result.outputs.sayNo).toEqual({ skipped: true });
	});
});
