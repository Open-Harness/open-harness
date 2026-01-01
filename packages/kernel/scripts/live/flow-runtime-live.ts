/**
 * Authoritative live test for Flow runtime lifecycle + execution.
 *
 * Usage: bun scripts/live/flow-runtime-live.ts
 */

import { HubImpl } from "../../src/engine/hub.js";
import { executeFlow } from "../../src/flow/executor.js";
import { echoNode } from "../../src/flow/nodes/echo.js";
import { NodeRegistry } from "../../src/flow/registry.js";
import type { EnrichedEvent } from "../../src/protocol/events.js";
import type { FlowYaml } from "../../src/protocol/flow.js";

async function runLiveTest() {
	console.log("🧪 Running FlowRuntime live test...");

	const registry = new NodeRegistry();
	registry.register(echoNode);

	const flow: FlowYaml = {
		flow: { name: "flow-runtime-live" },
		nodes: [
			{
				id: "greet",
				type: "echo",
				input: { text: "Hello, Flow Runtime!" },
			},
		],
		edges: [],
	};

	const hub = new HubImpl("live-flow-runtime");
	const events: EnrichedEvent[] = [];
	const unsubscribe = hub.subscribe("*", (event) => {
		events.push(event);
	});

	const phase = async <T>(name: string, fn: () => Promise<T>) => {
		return hub.scoped({ phase: { name } }, async () => {
			hub.emit({ type: "phase:start", name });
			try {
				const result = await fn();
				hub.emit({ type: "phase:complete", name });
				return result;
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				const stack = error instanceof Error ? error.stack : undefined;
				hub.emit({ type: "phase:failed", name, error: message, stack });
				throw error;
			}
		});
	};

	const task = async <T>(id: string, fn: () => Promise<T>) => {
		return hub.scoped({ task: { id } }, async () => {
			hub.emit({ type: "task:start", taskId: id });
			try {
				const result = await fn();
				hub.emit({ type: "task:complete", taskId: id, result });
				return result;
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				const stack = error instanceof Error ? error.stack : undefined;
				hub.emit({ type: "task:failed", taskId: id, error: message, stack });
				throw error;
			}
		});
	};

	hub.setStatus("running");
	hub.emit({ type: "harness:start", name: flow.flow.name });

	const result = await executeFlow(flow, registry, { hub, phase, task });

	hub.emit({ type: "harness:complete", success: true, durationMs: 0 });
	hub.setStatus("complete");
	unsubscribe();

	const outputs = result.outputs;
	if (
		outputs.greet &&
		(outputs.greet as { text?: string }).text === "Hello, Flow Runtime!"
	) {
		// ok
	} else {
		throw new Error("Unexpected output from Flow runtime live test");
	}

	const types = events.map((event) => event.event.type);
	const required = [
		"harness:start",
		"phase:start",
		"task:start",
		"task:complete",
		"phase:complete",
		"harness:complete",
	];
	for (const type of required) {
		if (!types.includes(type)) {
			throw new Error(`Missing event type: ${type}`);
		}
	}

	console.log("✅ FlowRuntime live test passed");
}

runLiveTest().catch((error) => {
	console.error("❌ FlowRuntime live test failed:", error);
	process.exit(1);
});
