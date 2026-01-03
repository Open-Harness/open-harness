/**
 * Lesson 09: Multi-Turn Agent with Hub Message Routing
 *
 * Demonstrates multi-turn conversation using the V2 SDK pattern:
 * - Agents subscribe to Hub `session:message` events
 * - External systems inject messages via `hub.sendToRun()`
 * - Messages are filtered by `runId` for isolation
 *
 * Scenario: An interactive debugging assistant that receives additional
 * context during execution via Hub message injection.
 *
 * Primitives used:
 * - createHub() - creates the event bus
 * - AgentDefinition - defines agent behavior
 * - hub.subscribe() - listen for events
 * - hub.sendToRun() - inject messages to a specific run
 * - hub.emit() - emit events
 */

import { type AgentDefinition, createHub } from "@open-harness/kernel";

interface BugReport {
	title: string;
	description: string;
}

interface DebugResult {
	additionalContext: string[];
	diagnosis: string;
}

/**
 * Debugging assistant agent.
 * Subscribes to Hub events to receive additional context during execution.
 */
const DebugAgent: AgentDefinition<BugReport, DebugResult> = {
	name: "debug-assistant",
	async execute(input, ctx) {
		console.log(`[Agent] Analyzing: "${input.title}"`);
		console.log(`[Agent] Description: ${input.description}`);

		const additionalContext: string[] = [];

		// V2 SDK Pattern: Subscribe to session:message events
		// Filter by runId to only receive messages for this run
		const contextPromise = new Promise<void>((resolve) => {
			let received = 0;
			const expected = 2;

			const timeout = setTimeout(() => {
				unsubscribe();
				resolve();
			}, 300);

			const unsubscribe = ctx.hub.subscribe("session:message", (event) => {
				const payload = event.event as { runId?: string; content?: string };

				if (payload.runId === ctx.runId && payload.content) {
					console.log(`[Agent] Received context: ${payload.content.slice(0, 40)}...`);
					additionalContext.push(payload.content);
					received++;

					if (received >= expected) {
						clearTimeout(timeout);
						unsubscribe();
						resolve();
					}
				}
			});
		});

		// Signal that we need more context
		ctx.hub.emit({
			type: "agent:text",
			content: "Please provide stack trace and environment info",
			runId: ctx.runId,
		});

		// Wait for context to be injected
		await contextPromise;

		// Analyze with collected context
		const hasStackTrace = additionalContext.some((c) => c.includes("Error:"));
		const hasEnvInfo = additionalContext.some((c) => c.includes("Node"));

		const diagnosis =
			hasStackTrace && hasEnvInfo
				? "Null pointer: user object undefined when accessing email"
				: "Need more context to diagnose";

		return { additionalContext, diagnosis };
	},
};

async function main() {
	console.log("Lesson 09: Multi-Turn Agent with Hub Message Routing\n");

	// Create Hub - the central event bus
	const hub = createHub("debug-session");
	hub.startSession();

	// Track agent runs for message injection
	let currentRunId: string | null = null;

	// Listen for agent requests and inject context
	hub.subscribe("agent:text", (event) => {
		const payload = event.event as { runId?: string; content?: string };
		if (payload.content?.includes("stack trace") && payload.runId) {
			currentRunId = payload.runId;

			// Inject stack trace (defer to ensure agent subscription is ready)
			queueMicrotask(() => {
				console.log("[System] Injecting stack trace...");
				hub.sendToRun(
					currentRunId!,
					`Error: Cannot read property 'email' of undefined
    at validateUser (/app/src/auth/validator.ts:42:15)`,
				);
			});

			// Inject environment info slightly later
			setTimeout(() => {
				console.log("[System] Injecting environment info...");
				hub.sendToRun(currentRunId!, "Node v18.17.0, Production env");
			}, 50);
		}
	});

	// Generate a unique runId
	const runId = `run-${Date.now()}`;

	// Emit agent:start (normally done by runtime)
	hub.emit({ type: "agent:start", agentName: "debug-assistant", runId });

	// Execute the agent
	const result = await DebugAgent.execute(
		{
			title: "Login fails with undefined error",
			description: "App crashes when clicking login button",
		},
		{ hub, runId },
	);

	// Emit agent:complete
	hub.emit({ type: "agent:complete", agentName: "debug-assistant", success: true, runId });

	console.log("\n--- Result ---");
	console.log(`Context items received: ${result.additionalContext.length}`);
	console.log(`Diagnosis: ${result.diagnosis}`);

	// Verify
	if (result.additionalContext.length === 2 && result.diagnosis.includes("Null pointer")) {
		console.log("\n✓ Multi-turn session completed successfully");
		console.log("✓ Hub message injection worked");
	} else {
		console.error("\n✗ Session did not complete as expected");
		process.exit(1);
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
