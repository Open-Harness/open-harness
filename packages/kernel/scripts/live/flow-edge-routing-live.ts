/**
 * Authoritative live test for edge-level `when` routing.
 *
 * Usage: bun scripts/live/flow-edge-routing-live.ts
 */

import { HubImpl } from "../../src/engine/hub.js";
import { executeFlow } from "../../src/flow/executor.js";
import { conditionEqualsNode } from "../../src/flow/nodes/condition.equals.js";
import { constantNode } from "../../src/flow/nodes/constant.js";
import { echoNode } from "../../src/flow/nodes/echo.js";
import { NodeRegistry } from "../../src/flow/registry.js";
import type { FlowYaml } from "../../src/protocol/flow.js";

async function runLiveTest() {
	console.log("🧪 Running Flow edge routing live test...");

	const registry = new NodeRegistry();
	registry.register(constantNode);
	registry.register(conditionEqualsNode);
	registry.register(echoNode);

	const flow: FlowYaml = {
		flow: { name: "flow-edge-routing-live" },
		nodes: [
			{ id: "facts", type: "constant", input: { value: "yes" } },
			{
				id: "isYes",
				type: "condition.equals",
				input: { left: "{{facts.value}}", right: "yes" },
			},
			{ id: "sayYes", type: "echo", input: { text: "Condition matched: yes" } },
			{ id: "sayNo", type: "echo", input: { text: "Condition matched: no" } },
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

	const hub = new HubImpl("live-flow-edge-routing");
	const phase = async <T>(name: string, fn: () => Promise<T>) => {
		return hub.scoped({ phase: { name } }, async () => {
			hub.emit({ type: "phase:start", name });
			const result = await fn();
			hub.emit({ type: "phase:complete", name });
			return result;
		});
	};
	const task = async <T>(id: string, fn: () => Promise<T>) => {
		return hub.scoped({ task: { id } }, async () => {
			hub.emit({ type: "task:start", taskId: id });
			const result = await fn();
			hub.emit({ type: "task:complete", taskId: id, result });
			return result;
		});
	};

	hub.setStatus("running");
	hub.emit({ type: "harness:start", name: flow.flow.name });
	const result = await executeFlow(flow, registry, { hub, phase, task });
	hub.emit({ type: "harness:complete", success: true, durationMs: 0 });
	hub.setStatus("complete");

	const outputs = result.outputs;
	const sayYes = outputs.sayYes as { text?: string } | undefined;
	const sayNo = outputs.sayNo as { skipped?: boolean } | undefined;

	if (sayYes?.text !== "Condition matched: yes") {
		throw new Error("Edge routing did not execute the expected branch");
	}

	if (!sayNo?.skipped) {
		throw new Error("Edge routing did not skip the non-matching branch");
	}

	console.log("✅ Flow edge routing live test passed");
}

runLiveTest().catch((error) => {
	console.error("❌ Flow edge routing live test failed:", error);
	process.exit(1);
});
