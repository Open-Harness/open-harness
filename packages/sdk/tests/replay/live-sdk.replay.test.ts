/**
 * Live SDK Replay Tests
 *
 * Replay tests for CodingAgent and ReviewAgent using golden recordings.
 * Converted from live-sdk.test.ts to run without network calls.
 *
 * Run with: bun test tests/replay/live-sdk.replay.test.ts
 */

import { describe, expect, test } from "bun:test";
import { CodingAgent } from "../../src/providers/anthropic/agents/coding-agent.js";
import { ReviewAgent } from "../../src/providers/anthropic/agents/review-agent.js";
import { createReplayContainer } from "../helpers/replay-runner.js";

describe("Live SDK Replay", () => {
	test("CodingAgent replays add-two-numbers recording", async () => {
		// Create replay container (uses golden recording)
		const { container, replayer } = await createReplayContainer("golden/coding-agent", "add-two-numbers");
		const coder = container.get(CodingAgent);

		// Track events
		const events: string[] = [];

		// Execute - this will replay the recording
		const result = await coder.execute("Write a function that adds two numbers", "replay_test_session", {
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
		expect(result.stopReason).toBeDefined();
		expect(events).toContain("start");
		expect(events).toContain("complete");

		console.log("[REPLAY] CodingAgent summary:", `${result.summary.substring(0, 100)}...`);
		console.log("[REPLAY] Events captured:", events.length);
		console.log("[REPLAY] Messages replayed:", replayer.getSession()?.messages.length);
	});

	test("ReviewAgent replays review-add-function recording", async () => {
		// Create replay container (uses golden recording)
		const { container, replayer } = await createReplayContainer("golden/review-agent", "review-add-function");
		const reviewer = container.get(ReviewAgent);

		// Track events
		const events: string[] = [];

		// Execute - this will replay the recording
		const result = await reviewer.review(
			"Write a function that adds two numbers",
			"Created an add function that takes two parameters and returns their sum",
			"replay_test_session",
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

		console.log("[REPLAY] ReviewAgent decision:", result.decision);
		console.log("[REPLAY] Feedback length:", result.feedback.length, "chars");
		console.log("[REPLAY] Messages replayed:", replayer.getSession()?.messages.length);
	});
});
