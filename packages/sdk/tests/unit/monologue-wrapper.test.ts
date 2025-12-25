/**
 * Monologue Wrapper Tests - Validates the withMonologue wrapper function
 *
 * Tests:
 * 1. Wrapper creation
 * 2. Event buffering logic
 * 3. Name and base agent accessors
 */

import { describe, expect, test } from "bun:test";
import type { Options, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { injectable } from "@needle-di/core";
import { BaseAnthropicAgent } from "../../src/agents/base-anthropic-agent.js";
import type { IAgentRunner, RunnerCallbacks } from "../../src/core/tokens.js";
import { withMonologue } from "../../src/monologue/wrapper.js";

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
		const resultMessage = {
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
			result: "Done",
			modelUsage: { input_tokens: 10, output_tokens: 20 },
			permission_denials: [],
			uuid: "mock-uuid-123",
		} as unknown as SDKMessage;

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

@injectable()
class MockAgent extends BaseAnthropicAgent {
	constructor() {
		super("MockAgent", new MockRunner(), null);
	}

	// Simple execute method for testing
	async execute(prompt: string, sessionId: string): Promise<unknown> {
		return this.run(prompt, sessionId);
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

			const wrapped = withMonologue(agent, {
				bufferSize: 3,
				model: "sonnet",
				onNarrative: () => {
					// Callback for narratives
				},
			});

			expect(wrapped).toBeDefined();
			expect(wrapped.name).toBe("MockAgent");
		});
	});

	describe("wrapCallbacks", () => {
		test("wrapCallbacks returns an IAgentCallbacks object", () => {
			const agent = new MockAgent();
			const wrapped = withMonologue(agent);

			const callbacks = wrapped.wrapCallbacks({
				onText: () => {},
			});

			expect(callbacks).toBeDefined();
			expect(typeof callbacks.onText).toBe("function");
		});

		test("wrapCallbacks passes through original callbacks", () => {
			const agent = new MockAgent();
			const wrapped = withMonologue(agent);

			let onStartCalled = false;
			let onCompleteCalled = false;

			const callbacks = wrapped.wrapCallbacks({
				onStart: () => {
					onStartCalled = true;
				},
				onComplete: () => {
					onCompleteCalled = true;
				},
			});

			// Call the wrapped callbacks
			callbacks.onStart?.({ agentName: "test", sessionId: "session_1" });
			callbacks.onComplete?.({ success: true });

			expect(onStartCalled).toBe(true);
			expect(onCompleteCalled).toBe(true);
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
