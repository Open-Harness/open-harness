/**
 * Lesson 13: Hub Message Routing with sendToRun
 *
 * Demonstrates run-scoped message injection using Hub events.
 *
 * Scenario: A code review workflow where an external CI system can inject
 * security findings into a running reviewer agent.
 *
 * Primitives used:
 * - createHub() - creates the event bus
 * - AgentDefinition - defines agent behavior
 * - hub.subscribe() - listen for events
 * - hub.sendToRun() - inject message to a specific run
 *
 * Key pattern: sendToRun() emits a session:message event with the runId,
 * allowing agents to filter and receive only their messages.
 */

import { createHub, type AgentDefinition } from "@open-harness/kernel";

interface ReviewInput {
	pullRequestId: string;
	files: string[];
}

interface ReviewOutput {
	pullRequestId: string;
	externalFeedback: string | null;
}

/**
 * Code reviewer agent that can receive external feedback via Hub.
 */
const ReviewerAgent: AgentDefinition<ReviewInput, ReviewOutput> = {
	name: "code-reviewer",
	async execute(input, ctx) {
		console.log(`[Reviewer] Analyzing PR #${input.pullRequestId}`);
		console.log(`[Reviewer] Files: ${input.files.join(", ")}`);

		let externalFeedback: string | null = null;

		// Subscribe to session:message events filtered by runId
		const feedbackPromise = new Promise<string | null>((resolve) => {
			const timeout = setTimeout(() => {
				unsubscribe();
				resolve(null);
			}, 200);

			const unsubscribe = ctx.hub.subscribe("session:message", (event) => {
				const payload = event.event as { runId?: string; content?: string };

				// Only accept messages for this specific run
				if (payload.runId === ctx.runId && payload.content) {
					console.log(`[Reviewer] External feedback received: "${payload.content}"`);
					clearTimeout(timeout);
					unsubscribe();
					resolve(payload.content);
				}
			});
		});

		console.log("[Reviewer] Checking for external security scan results...");
		externalFeedback = await feedbackPromise;

		return { pullRequestId: input.pullRequestId, externalFeedback };
	},
};

async function main() {
	console.log("Lesson 13: Hub Message Routing with sendToRun\n");
	console.log("Scenario: CI system injects security findings into code review\n");

	// Create Hub
	const hub = createHub("review-session");
	hub.startSession();

	// Simulate CI system that injects findings when reviewer starts
	hub.subscribe("agent:start", (event) => {
		const payload = event.event as { runId: string; agentName: string };

		if (payload.agentName === "code-reviewer") {
			// Use queueMicrotask to ensure agent's subscription is set up first
			queueMicrotask(() => {
				console.log("[CI] Security scan detected issue, sending to reviewer...");
				hub.sendToRun(
					payload.runId,
					"SECURITY: SQL injection risk in db-query.ts line 42",
				);
			});
		}
	});

	// Execute the review
	const runId = `run-${Date.now()}`;

	hub.emit({ type: "agent:start", agentName: "code-reviewer", runId });

	const result = await ReviewerAgent.execute(
		{
			pullRequestId: "PR-1234",
			files: ["src/api/handler.ts", "src/db/db-query.ts"],
		},
		{ hub, runId },
	);

	hub.emit({ type: "agent:complete", agentName: "code-reviewer", success: true, runId });

	console.log("\n--- Review Result ---");
	console.log(`PR: #${result.pullRequestId}`);
	console.log(`External Feedback: ${result.externalFeedback || "(none)"}`);

	// Verify
	if (result.externalFeedback?.includes("SECURITY")) {
		console.log("\n✓ External feedback successfully injected via Hub");
	} else {
		console.error("\n✗ Failed to receive external feedback");
		process.exit(1);
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
