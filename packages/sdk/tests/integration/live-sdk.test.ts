/**
 * Live SDK Integration Test
 *
 * Makes real API calls to verify agents work correctly and captures golden recordings.
 * Works with Claude Code subscription authentication (no API key needed).
 *
 * Run with: bun test tests/integration/live-sdk.test.ts
 */

import { describe, expect, test } from "bun:test";
import { CodingAgent } from "../../src/providers/anthropic/agents/coding-agent.js";
import { ReviewAgent } from "../../src/providers/anthropic/agents/review-agent.js";
import { createRecordingContainer } from "../helpers/recording-wrapper.js";

describe("Live SDK Integration", () => {
	test(
		"CodingAgent executes with callbacks and captures golden recording",
		async () => {
			// Create recording container
			const { container, recorder } = createRecordingContainer("golden/coding-agent");
			const coder = container.get(CodingAgent);

			console.log("Agent:", coder.name);

			// Track events
			const events: string[] = [];

			// Start capture
			recorder.startCapture("add-two-numbers");

			// Execute coding task
			const result = await coder.execute("Write a function that adds two numbers", "integration_test_session", {
				callbacks: {
					onStart: () => events.push("start"),
					onText: () => events.push("text"),
					onToolCall: (event) => events.push(`tool:${event.toolName}`),
					onComplete: () => events.push("complete"),
				},
			});

			// Save recording
			await recorder.saveCapture({ task: "add-two-numbers" });

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
		"ReviewAgent executes with callbacks and captures golden recording",
		async () => {
			// Create recording container
			const { container, recorder } = createRecordingContainer("golden/review-agent");
			const reviewer = container.get(ReviewAgent);

			console.log("Agent:", reviewer.name);

			// Track events
			const events: string[] = [];

			// Start capture
			recorder.startCapture("review-add-function");

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

			// Save recording
			await recorder.saveCapture({ task: "review-add-function" });

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
