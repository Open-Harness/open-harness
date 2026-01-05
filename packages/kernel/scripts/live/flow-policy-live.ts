/**
 * Authoritative live test for policy enforcement (retry/timeout/continueOnError).
 *
 * Usage: bun scripts/live/flow-policy-live.ts
 */

import { HubImpl } from "../../src/engine/hub.js";
import { executeFlow } from "../../src/flow/executor.js";
import { echoNode } from "../../src/flow/nodes/echo.js";
import { NodeRegistry } from "../../src/flow/registry.js";
import type { FlowYaml, NodeTypeDefinition } from "../../src/protocol/flow.js";

async function runLiveTest() {
	console.log("🧪 Running Flow policy live test...");

	let attempts = 0;
	const flakyNode: NodeTypeDefinition<{ label: string }, { label: string }> = {
		type: "flaky",
		inputSchema: { parse: (value: unknown) => value },
		outputSchema: { parse: (value: unknown) => value },
		run: async (_ctx, input) => {
			attempts += 1;
			if (attempts < 2) {
				throw new Error("flaky failure");
			}
			return { label: input.label };
		},
	};

	const registry = new NodeRegistry();
	registry.register(flakyNode);
	registry.register(echoNode);

	const flow: FlowYaml = {
		flow: { name: "flow-policy-live", policy: { failFast: true } },
		nodes: [
			{
				id: "flaky",
				type: "flaky",
				input: { label: "ok" },
				policy: { retry: { maxAttempts: 2, backoffMs: 0 } },
			},
			{
				id: "echo",
				type: "echo",
				input: { text: "{{flaky.label}}" },
			},
		],
		edges: [{ from: "flaky", to: "echo" }],
	};

	const hub = new HubImpl("live-flow-policy");
	const phase = async <T>(name: string, fn: () => Promise<T>) => {
		return hub.scoped({ phase: { name } }, fn);
	};
	const task = async <T>(id: string, fn: () => Promise<T>) => {
		return hub.scoped({ task: { id } }, fn);
	};

	hub.setStatus("running");
	hub.emit({ type: "harness:start", name: flow.flow.name });

	let outputs: Record<string, unknown>;
	try {
		const result = await executeFlow(flow, registry, { hub, phase, task });
		outputs = result.outputs;
	} catch (_error) {
		throw new Error(
			"Policy enforcement failed: retry did not succeed on flaky node",
		);
	} finally {
		hub.emit({ type: "harness:complete", success: true, durationMs: 0 });
		hub.setStatus("complete");
	}

	const echo = outputs.echo as { text?: string } | undefined;
	if (echo?.text !== "ok") {
		throw new Error("Policy enforcement failed: downstream output mismatch");
	}

	console.log("✅ Flow policy live test passed");
}

runLiveTest().catch((error) => {
	console.error("❌ Flow policy live test failed:", error);
	process.exit(1);
});
