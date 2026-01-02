/**
 * Authoritative live test for agent node inbox + runId behavior.
 *
 * Usage: bun scripts/live/flow-agent-nodes-live.ts
 */

import { HubImpl } from "../../src/engine/hub.js";
import type { AgentInboxImpl } from "../../src/engine/inbox.js";
import { executeFlow } from "../../src/flow/executor.js";
import { NodeRegistry } from "../../src/flow/registry.js";
import type { FlowYaml, NodeTypeDefinition } from "../../src/protocol/flow.js";

async function runLiveTest() {
	console.log("🧪 Running Flow agent nodes live test...");

	const runInboxes = new Map<string, AgentInboxImpl>();

	const agentNode: NodeTypeDefinition<{ label: string }, { received: string }> =
		{
			type: "agent.echo",
			inputSchema: { parse: (value: unknown) => value },
			outputSchema: { parse: (value: unknown) => value },
			capabilities: { supportsInbox: true, isStreaming: false },
			run: async (ctx, input) => {
				const inbox = ctx.inbox;
				if (!inbox) {
					throw new Error("Agent node missing inbox");
				}

				runInboxes.set(ctx.runId, inbox as AgentInboxImpl);
				ctx.hub.emit({
					type: "agent:start",
					agentName: "agent.echo",
					runId: ctx.runId,
				});

				const message = await Promise.race([
					inbox.pop(),
					new Promise<{ content: string; timestamp: Date }>((resolve) => {
						setTimeout(
							() =>
								resolve({
									content: `timeout:${input.label}`,
									timestamp: new Date(),
								}),
							100,
						);
					}),
				]);

				ctx.hub.emit({
					type: "agent:complete",
					agentName: "agent.echo",
					success: true,
					runId: ctx.runId,
				});

				return { received: message.content };
			},
		};

	const registry = new NodeRegistry();
	registry.register(agentNode);

	const flow: FlowYaml = {
		flow: { name: "flow-agent-nodes-live" },
		nodes: [
			{
				id: "agent",
				type: "agent.echo",
				input: { label: "live" },
			},
		],
		edges: [],
	};

	const hub = new HubImpl("live-flow-agent-nodes");
	hub.startSession();

	const unsubscribe = hub.subscribe("session:message", (event) => {
		const payload = event.event as { runId?: string; content?: string };
		if (!payload.runId || payload.content === undefined) return;
		const inbox = runInboxes.get(payload.runId);
		if (inbox) {
			inbox.push(payload.content);
		}
	});

	const phase = async <T>(name: string, fn: () => Promise<T>) => {
		return hub.scoped({ phase: { name } }, fn);
	};
	const task = async <T>(id: string, fn: () => Promise<T>) => {
		return hub.scoped({ task: { id } }, fn);
	};

	let runId: string | null = null;
	const unsubscribeAgent = hub.subscribe("agent:start", (event) => {
		runId = (event.event as { runId: string }).runId;
		hub.sendToRun(runId, "hello from sendToRun");
	});

	hub.setStatus("running");
	hub.emit({ type: "harness:start", name: flow.flow.name });
	const result = await executeFlow(flow, registry, { hub, phase, task });
	hub.emit({ type: "harness:complete", success: true, durationMs: 0 });
	hub.setStatus("complete");

	unsubscribeAgent();
	unsubscribe();

	const output = result.outputs.agent as { received?: string } | undefined;
	if (output?.received !== "hello from sendToRun") {
		throw new Error("Agent node did not receive injected message");
	}

	if (!runId) {
		throw new Error("Agent runId was not observed");
	}

	console.log("✅ Flow agent nodes live test passed");
}

runLiveTest().catch((error) => {
	console.error("❌ Flow agent nodes live test failed:", error);
	process.exit(1);
});
