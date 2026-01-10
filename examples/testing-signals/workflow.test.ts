/**
 * Testing Signals Example
 *
 * Demonstrates how to test reactive agent workflows using @open-harness/vitest
 * custom matchers for signal assertions.
 *
 * Run: bun test examples/testing-signals/
 */

import { signalMatchers } from "@open-harness/vitest";
import { createSignal, type Signal } from "@signals/core";
import { beforeAll, describe, expect, it } from "vitest";

// Set up signal matchers before all tests
beforeAll(() => {
	expect.extend(signalMatchers);
});

// =============================================================================
// Example 1: Simulated Reactive Workflow Signals
// =============================================================================

/**
 * Simulate a reactive workflow's signal output.
 *
 * In real tests, you'd use `runReactive()` to get actual signals.
 * This example shows the signal patterns without requiring live API calls.
 */
function simulateAnalysisWorkflow(): Signal[] {
	return [
		// Harness lifecycle
		createSignal("harness:start", {
			agents: ["analyst", "trader"],
			state: { symbol: "AAPL", confidence: 0 },
		}),

		// Agent activation
		createSignal("agent:activated", {
			agent: "analyst",
			trigger: "harness:start",
		}),

		// Provider lifecycle
		createSignal("provider:start", {
			provider: "claude",
			model: "claude-sonnet-4-20250514",
		}),

		// Streaming text
		createSignal("text:delta", { content: "Based on" }),
		createSignal("text:delta", { content: " the market" }),
		createSignal("text:delta", { content: " analysis..." }),

		// Provider completion
		createSignal("provider:end", {
			output: "Based on the market analysis...",
			usage: { inputTokens: 150, outputTokens: 50 },
			durationMs: 1234,
		}),

		// Agent output signal
		createSignal("analysis:complete", {
			agent: "analyst",
			output: {
				trend: "bullish",
				confidence: 0.85,
				summary: "Strong momentum",
			},
		}),

		// Second agent activates
		createSignal("agent:activated", {
			agent: "trader",
			trigger: "analysis:complete",
		}),

		createSignal("provider:start", { provider: "claude" }),
		createSignal("provider:end", {
			output: "Recommend: BUY 10 shares",
			usage: { inputTokens: 200, outputTokens: 30 },
		}),

		createSignal("trade:proposed", {
			agent: "trader",
			output: { action: "buy", quantity: 10, price: 185.5 },
		}),

		// Harness completion
		createSignal("harness:end", {
			durationMs: 2500,
			activations: 2,
			state: { symbol: "AAPL", confidence: 0.85 },
		}),
	];
}

// =============================================================================
// Test Suite: Signal Assertions
// =============================================================================

describe("Testing Reactive Workflows", () => {
	const signals = simulateAnalysisWorkflow();

	describe("toContainSignal - Basic Pattern Matching", () => {
		it("matches exact signal names", () => {
			// Assert specific signals exist
			expect(signals).toContainSignal("harness:start");
			expect(signals).toContainSignal("analysis:complete");
			expect(signals).toContainSignal("trade:proposed");
		});

		it("matches signals with glob wildcards", () => {
			// Single segment wildcard (*)
			expect(signals).toContainSignal("agent:*");
			expect(signals).toContainSignal("provider:*");

			// Multi-segment wildcard (**)
			expect(signals).toContainSignal("harness:**");
		});

		it("detects missing signals", () => {
			// Negation for signals that should NOT exist
			expect(signals).not.toContainSignal("error:*");
			expect(signals).not.toContainSignal("provider:error");
			expect(signals).not.toContainSignal("trade:rejected");
		});
	});

	describe("toContainSignal - Payload Matching", () => {
		it("matches signals with partial payload", () => {
			// Match by agent name only
			expect(signals).toContainSignal({
				name: "agent:activated",
				payload: { agent: "analyst" },
			});

			// Match by trigger signal
			expect(signals).toContainSignal({
				name: "agent:activated",
				payload: { trigger: "analysis:complete" },
			});
		});

		it("matches signals with nested payload values", () => {
			// Match nested output structure
			expect(signals).toContainSignal({
				name: "analysis:complete",
				payload: {
					output: {
						trend: "bullish",
						confidence: 0.85,
					},
				},
			});
		});

		it("rejects non-matching payloads", () => {
			// Wrong agent name
			expect(signals).not.toContainSignal({
				name: "agent:activated",
				payload: { agent: "wrong-agent" },
			});

			// Wrong confidence value
			expect(signals).not.toContainSignal({
				name: "analysis:complete",
				payload: { output: { confidence: 0.5 } },
			});
		});
	});

	describe("toHaveSignalCount - Counting Signals", () => {
		it("counts exact signal occurrences", () => {
			// Two agents activated
			expect(signals).toHaveSignalCount("agent:activated", 2);

			// Two provider calls
			expect(signals).toHaveSignalCount("provider:start", 2);
			expect(signals).toHaveSignalCount("provider:end", 2);
		});

		it("counts signals matching glob patterns", () => {
			// All provider lifecycle signals (start + end = 4)
			expect(signals).toHaveSignalCount("provider:*", 4);

			// All agent signals (activated only = 2)
			expect(signals).toHaveSignalCount("agent:*", 2);
		});

		it("counts zero for non-existent patterns", () => {
			expect(signals).toHaveSignalCount("error:*", 0);
			expect(signals).toHaveSignalCount("nonexistent", 0);
		});

		it("counts signals with payload conditions", () => {
			// Only one analyst activation
			expect(signals).toHaveSignalCount({ name: "agent:activated", payload: { agent: "analyst" } }, 1);

			// Only one trader activation
			expect(signals).toHaveSignalCount({ name: "agent:activated", payload: { agent: "trader" } }, 1);
		});
	});

	describe("toHaveSignalsInOrder - Sequence Validation", () => {
		it("validates expected signal flow", () => {
			// Core workflow sequence
			expect(signals).toHaveSignalsInOrder([
				"harness:start",
				"agent:activated",
				"analysis:complete",
				"trade:proposed",
				"harness:end",
			]);
		});

		it("validates provider lifecycle ordering", () => {
			// Provider signals must be properly paired
			expect(signals).toHaveSignalsInOrder(["provider:start", "provider:end", "provider:start", "provider:end"]);
		});

		it("validates causality chain", () => {
			// First agent triggers second agent
			expect(signals).toHaveSignalsInOrder([
				{ name: "agent:activated", payload: { agent: "analyst" } },
				"analysis:complete",
				{ name: "agent:activated", payload: { agent: "trader" } },
				"trade:proposed",
			]);
		});

		it("works with glob patterns in sequence", () => {
			expect(signals).toHaveSignalsInOrder(["harness:*", "agent:*", "provider:*", "*:complete", "harness:*"]);
		});
	});
});

// =============================================================================
// Test Suite: Edge Cases and Error Scenarios
// =============================================================================

describe("Testing Error Scenarios", () => {
	function simulateFailedWorkflow(): Signal[] {
		return [
			createSignal("harness:start", { agents: ["analyst"] }),
			createSignal("agent:activated", { agent: "analyst" }),
			createSignal("provider:start", { provider: "claude" }),
			createSignal("provider:error", {
				error: "Rate limit exceeded",
				code: "RATE_LIMIT",
			}),
			createSignal("harness:end", {
				durationMs: 500,
				error: "Workflow failed",
			}),
		];
	}

	it("detects error signals", () => {
		const signals = simulateFailedWorkflow();

		expect(signals).toContainSignal("provider:error");
		expect(signals).toContainSignal({
			name: "provider:error",
			payload: { code: "RATE_LIMIT" },
		});
	});

	it("validates error flow sequence", () => {
		const signals = simulateFailedWorkflow();

		expect(signals).toHaveSignalsInOrder(["harness:start", "provider:start", "provider:error", "harness:end"]);

		// Should NOT contain successful completion
		expect(signals).not.toContainSignal("provider:end");
		expect(signals).not.toContainSignal("analysis:complete");
	});

	it("counts partial completions", () => {
		const signals = simulateFailedWorkflow();

		// Only one provider call started
		expect(signals).toHaveSignalCount("provider:start", 1);

		// No successful provider completions
		expect(signals).toHaveSignalCount("provider:end", 0);

		// One error occurred
		expect(signals).toHaveSignalCount("provider:error", 1);
	});
});

// =============================================================================
// Test Suite: Parallel Execution Patterns
// =============================================================================

describe("Testing Parallel Execution", () => {
	function simulateParallelAgents(): Signal[] {
		return [
			createSignal("harness:start", {
				agents: ["analyst", "risk-assessor"],
			}),

			// Both agents activate on harness:start (parallel)
			createSignal("agent:activated", {
				agent: "analyst",
				trigger: "harness:start",
			}),
			createSignal("agent:activated", {
				agent: "risk-assessor",
				trigger: "harness:start",
			}),

			// Interleaved provider calls (parallel execution)
			createSignal("provider:start", { agent: "analyst" }),
			createSignal("provider:start", { agent: "risk-assessor" }),

			createSignal("provider:end", { agent: "risk-assessor" }),
			createSignal("provider:end", { agent: "analyst" }),

			// Both complete
			createSignal("analysis:complete", { agent: "analyst" }),
			createSignal("risk:assessed", { agent: "risk-assessor" }),

			createSignal("harness:end", { activations: 2 }),
		];
	}

	it("detects parallel agent activations", () => {
		const signals = simulateParallelAgents();

		// Both agents activated
		expect(signals).toHaveSignalCount("agent:activated", 2);

		// Both triggered by same signal
		expect(signals).toHaveSignalCount({ name: "agent:activated", payload: { trigger: "harness:start" } }, 2);
	});

	it("validates both agents complete", () => {
		const signals = simulateParallelAgents();

		expect(signals).toContainSignal("analysis:complete");
		expect(signals).toContainSignal("risk:assessed");
	});

	it("confirms parallel provider calls", () => {
		const signals = simulateParallelAgents();

		// Two provider calls made
		expect(signals).toHaveSignalCount("provider:start", 2);
		expect(signals).toHaveSignalCount("provider:end", 2);
	});
});
