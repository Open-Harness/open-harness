/**
 * Live SDK Integration Test
 *
 * Makes real API calls to verify agents work correctly.
 * Works with both API key and subscription authentication.
 *
 * Run with: bun test tests/integration/live-sdk.test.ts
 */

import { describe, expect, test } from "bun:test";
import { CodingAgent } from "../../src/agents/coding-agent.js";
import { ReviewAgent } from "../../src/agents/review-agent.js";
import { createContainer } from "../../src/core/container.js";

describe("Live SDK Integration", () => {
	test(
		"CodingAgent executes with callbacks",
		async () => {
			// Log authentication method
			if (process.env.ANTHROPIC_API_KEY) {
				console.log("Using API key authentication");
			} else {
				console.log("Using subscription authentication (no API key)");
			}

			// Create live container
			const container = createContainer({ mode: "live" });
			const coder = container.get(CodingAgent);

			console.log("Agent:", coder.name);

			// Track events
			const events: string[] = [];

			// Execute coding task
			const result = await coder.execute("Write a function that adds two numbers", "integration_test_session", {
				callbacks: {
					onStart: () => events.push("start"),
					onText: () => events.push("text"),
					onToolCall: (event) => events.push(`tool:${event.toolName}`),
					onComplete: () => events.push("complete"),
				},
			});

			// Validate
			expect(result).toBeDefined();
			expect(result.summary).toBeDefined();
			expect(events).toContain("start");
			expect(events).toContain("complete");

			console.log("Summary:", result.summary);
			console.log("Events:", events);
		},
		{ timeout: 60000 }, // 60 seconds for coding task
	);

	test(
		"ReviewAgent executes with callbacks",
		async () => {
			// Create live container
			const container = createContainer({ mode: "live" });
			const reviewer = container.get(ReviewAgent);

			console.log("Agent:", reviewer.name);

			// Track events
			const events: string[] = [];

			// Execute review task
			const result = await reviewer.review(
				"Write a function that adds two numbers",
				"Created an add function that takes two parameters and returns their sum",
				"integration_test_session",
				{
					callbacks: {
						onStart: () => events.push("start"),
						onText: () => events.push("text"),
						onComplete: () => events.push("complete"),
					},
				},
			);

			// Validate
			expect(result).toBeDefined();
			expect(result.decision).toMatch(/^(approve|reject)$/);
			expect(result.feedback).toBeDefined();
			expect(events).toContain("start");
			expect(events).toContain("complete");

			console.log("Decision:", result.decision);
			console.log("Feedback:", result.feedback);
			console.log("Events:", events);
		},
		{ timeout: 120000 }, // 120 seconds for review task (uses tools)
	);
});
