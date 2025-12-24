/**
 * Live SDK Integration Test
 *
 * Makes a real API call to verify the full injection chain works.
 * Run with: bun test tests/integration/live-sdk.test.ts
 */

import { describe, expect, test } from "bun:test";
import { createContainer } from "../../src/core/container.js";
import { IAgentRunnerToken } from "../../src/core/tokens.js";
import { BaseAgent } from "../../src/runner/base-agent.js";

describe("Live SDK Integration", () => {
	test("makes real API call with callbacks", async () => {
		// Create live container (uses real LiveSDKRunner)
		const container = createContainer({ mode: "live" });

		// Get the real runner
		const runner = container.get(IAgentRunnerToken);
		console.log("Runner resolved to:", runner.constructor.name);

		// Create BaseAgent with real runner
		const agent = new BaseAgent("IntegrationTestAgent", runner);

		// Track events
		const events: string[] = [];
		let textContent = "";

		// Make real API call
		const result = await agent.run(
			"Say 'Hello from integration test!' and nothing else.",
			"integration_test_session",
			{
				model: "haiku",
				maxTurns: 1,
				callbacks: {
					onSessionStart: () => events.push("session_start"),
					onText: (content) => {
						events.push("text");
						textContent += content;
					},
					onSessionEnd: () => events.push("session_end"),
				},
			},
		);

		// Validate
		expect(result).toBeDefined();
		expect(events).toContain("session_start");
		expect(events).toContain("text");
		expect(events).toContain("session_end");
		expect(textContent.length).toBeGreaterThan(0);

		console.log("Text received:", textContent);
		console.log("Events:", events);
	});
});
