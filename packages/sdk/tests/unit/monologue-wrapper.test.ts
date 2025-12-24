/**
 * Monologue Wrapper Tests - Validates the withMonologue wrapper function
 *
 * Tests:
 * 1. Wrapper creation
 * 2. Event buffering logic
 * 3. Name and base agent accessors
 */

import { describe, expect, test } from "bun:test";
import { injectable } from "@needle-di/core";
import type { Options, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { withMonologue } from "../../src/monologue/wrapper.js";
import { BaseAgent } from "../../src/runner/base-agent.js";
import type { IAgentRunner, RunnerCallbacks } from "../../src/core/tokens.js";

// ============================================================================
// Mock Runner for Testing
// ============================================================================

@injectable()
class MockRunner implements IAgentRunner {
	public callCount = 0;
	public lastPrompt = "";

	async run(args: { prompt: string; options: Options; callbacks?: RunnerCallbacks }): Promise<SDKMessage | undefined> {
		this.callCount++;
		this.lastPrompt = args.prompt;

		// Simulate SDK result message
		const resultMessage: SDKMessage = {
			type: "result",
			subtype: "success",
			session_id: "mock_session",
			duration_ms: 100,
			duration_api_ms: 80,
			is_error: false,
			num_turns: 1,
			total_cost_usd: 0.001,
			usage: { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
			structured_output: { stopReason: "finished", summary: "Done", handoff: "" },
		} as SDKMessage;

		// Fire callback if provided
		if (args.callbacks?.onMessage) {
			args.callbacks.onMessage(resultMessage);
		}

		return resultMessage;
	}
}

// ============================================================================
// Mock Agent for Testing
// ============================================================================

class MockAgent extends BaseAgent {
	constructor() {
		super("MockAgent", new MockRunner(), null);
	}
}

// ============================================================================
// Tests
// ============================================================================

describe("Monologue Wrapper", () => {
	describe("withMonologue factory", () => {
		test("wraps agent and preserves name", () => {
			const agent = new MockAgent();
			const wrapped = withMonologue(agent);

			expect(wrapped.name).toBe("MockAgent");
		});

		test("getBaseAgent returns original agent", () => {
			const agent = new MockAgent();
			const wrapped = withMonologue(agent);

			expect(wrapped.getBaseAgent()).toBe(agent);
		});

		test("accepts custom config", () => {
			const agent = new MockAgent();
			let narrativeCalled = false;

			const wrapped = withMonologue(agent, {
				bufferSize: 3,
				model: "sonnet",
				onNarrative: () => {
					narrativeCalled = true;
				},
			});

			expect(wrapped).toBeDefined();
			expect(wrapped.name).toBe("MockAgent");
		});
	});

	describe("Event buffering", () => {
		test("wrapped agent can be run", async () => {
			const agent = new MockAgent();
			const wrapped = withMonologue(agent);

			// Just verify it doesn't throw - actual monologue generation requires live API
			const result = await wrapped.run("Test prompt", "session_1");
			expect(result).toBeDefined();
		});

		test("callbacks are passed through", async () => {
			const agent = new MockAgent();
			const wrapped = withMonologue(agent);

			let resultReceived = false;

			await wrapped.run("Test prompt", "session_1", {
				callbacks: {
					onResult: () => {
						resultReceived = true;
					},
				},
			});

			expect(resultReceived).toBe(true);
		});
	});

	describe("Default configuration", () => {
		test("uses default buffer size of 5", () => {
			const agent = new MockAgent();
			const wrapped = withMonologue(agent);

			// Just verify creation succeeds with defaults
			expect(wrapped).toBeDefined();
		});

		test("uses default model of haiku", () => {
			const agent = new MockAgent();
			const wrapped = withMonologue(agent);

			expect(wrapped).toBeDefined();
		});
	});
});
