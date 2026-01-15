/**
 * Test script to validate signal-console logging levels
 *
 * Tests the three verbosity levels:
 * 1. quiet  - Just workflow start/end (CI/CD, batch jobs)
 * 2. normal - All signals with truncated content (default for development)
 * 3. verbose - Full content including streaming deltas (debugging)
 */

import {
	agent,
	runReactive,
	isReactiveAgent,
	createSignal,
	HARNESS_SIGNALS,
	type Harness,
	type HarnessInput,
	type HarnessOutput,
	type RunContext,
	type Signal,
} from "@open-harness/core";
import { render } from "../lib/render.js";

// ============================================================================
// Mock Harness (doesn't require Claude Code)
// ============================================================================

function createMockHarness(response: string): Harness {
	return {
		type: "mock",
		displayName: "Mock Harness",
		capabilities: {
			streaming: true,
			structuredOutput: false,
			tools: false,
			resume: false,
		},
		async *run(
			input: HarnessInput,
			ctx: RunContext,
		): AsyncGenerator<Signal, HarnessOutput> {
			// Emit various signals to test logging
			yield createSignal(HARNESS_SIGNALS.START, { agent: "test-agent" });

			// Tool call with long input (truncated at normal, full at verbose)
			yield createSignal("tool:call", {
				name: "web_search",
				input: {
					query: "test query with some extra parameters that make this longer",
					limit: 10,
					includeImages: false,
				},
			});

			// Tool result with multiline content (truncated at normal, full at verbose)
			const multilineResult = `Found 5 results:
1. Example.com - This is a test result with some content
2. Another.com - More content here for the second result
3. Third.com - Even more content on the third line
4. Fourth.com - Additional information here
5. Fifth.com - Final result in the list`;

			yield createSignal("tool:result", {
				result: multilineResult,
			});

			// Simulate text streaming (only shown at verbose level)
			yield createSignal(HARNESS_SIGNALS.TEXT_DELTA, { content: "Based " });
			yield createSignal(HARNESS_SIGNALS.TEXT_DELTA, { content: "on " });
			yield createSignal(HARNESS_SIGNALS.TEXT_DELTA, { content: "my " });
			yield createSignal(HARNESS_SIGNALS.TEXT_DELTA, { content: "search, " });
			yield createSignal(HARNESS_SIGNALS.TEXT_DELTA, { content: "I found..." });

			// Complete text (truncated at normal, full at verbose)
			yield createSignal(HARNESS_SIGNALS.TEXT_COMPLETE, { content: response });

			yield createSignal(HARNESS_SIGNALS.END, {
				output: { content: response },
				durationMs: 100,
			});

			return {
				content: response,
				usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
			};
		},
	};
}

// ============================================================================
// Test Cases
// ============================================================================

async function testQuietLevel() {
	render.banner("Test 1: Quiet Level", "Minimal output for CI/CD");

	const myAgent = agent({
		prompt: "You are a test agent",
		activateOn: ["workflow:start"],
		emits: ["test:complete"],
		signalHarness: createMockHarness("Quiet test response"),
	});

	if (!isReactiveAgent(myAgent)) {
		throw new Error("Expected ReactiveAgent");
	}

	render.text("Running with QUIET level...");
	render.text("You should ONLY see: workflow:start, workflow:end");
	render.text("You should NOT see: agent, harness, tool, text signals");
	render.blank();

	const result = await runReactive(myAgent, "test input", {
		logging: { level: "quiet" },
	});

	render.section("Result");
	render.metric("Duration", `${result.metrics.durationMs}ms`);
	render.metric("Signal Count", result.signals.length);
}

async function testNormalLevel() {
	render.banner("Test 2: Normal Level (Default)", "All signals, truncated content");

	const myAgent = agent({
		prompt: "You are a test agent",
		activateOn: ["workflow:start"],
		emits: ["test:complete"],
		signalHarness: createMockHarness(
			"Based on my search, I found that the quick brown fox jumps over the lazy dog. This is a complete multi-line response that demonstrates truncation behavior.",
		),
	});

	if (!isReactiveAgent(myAgent)) {
		throw new Error("Expected ReactiveAgent");
	}

	render.text("Running with NORMAL level (default)...");
	render.text("You should see: ALL signals with TRUNCATED content");
	render.text("  - tool:call input truncated to ~60 chars");
	render.text("  - tool:result truncated to ~80 chars with line count hint");
	render.text("  - text:complete truncated to ~80 chars");
	render.text("You should NOT see: text:delta (streaming)");
	render.blank();

	const result = await runReactive(myAgent, "test input", {
		logging: { level: "normal" },
	});

	render.section("Result");
	render.metric("Duration", `${result.metrics.durationMs}ms`);
	render.metric("Signal Count", result.signals.length);
}

async function testVerboseLevel() {
	render.banner("Test 3: Verbose Level", "Full content including streaming");

	const myAgent = agent({
		prompt: "You are a test agent",
		activateOn: ["workflow:start"],
		emits: ["test:complete"],
		signalHarness: createMockHarness(
			"Based on my search, I found that the quick brown fox jumps over the lazy dog.\nThis is a complete multi-line response.\nIt demonstrates verbose output with full content.",
		),
	});

	if (!isReactiveAgent(myAgent)) {
		throw new Error("Expected ReactiveAgent");
	}

	render.text("Running with VERBOSE level...");
	render.text("You should see: EVERYTHING with FULL content");
	render.text("  - text:delta streaming tokens");
	render.text("  - Full tool inputs (indented)");
	render.text("  - Full tool results (indented)");
	render.text("  - Full text:complete content (indented)");
	render.blank();

	const result = await runReactive(myAgent, "test input", {
		logging: { level: "verbose" },
	});

	render.section("Result");
	render.metric("Duration", `${result.metrics.durationMs}ms`);
	render.metric("Signal Count", result.signals.length);
}

async function testLoggingDisabled() {
	render.banner("Test 4: Logging Disabled", "No signal logging output");

	const myAgent = agent({
		prompt: "You are a test agent",
		activateOn: ["workflow:start"],
		emits: ["test:complete"],
		signalHarness: createMockHarness("Silent test"),
	});

	if (!isReactiveAgent(myAgent)) {
		throw new Error("Expected ReactiveAgent");
	}

	render.text("Running with logging disabled...");
	render.text("You should see NO signal logging output between these lines");
	render.blank();

	const result = await runReactive(myAgent, "test input", {
		logging: false,
	});

	render.blank();
	render.section("Result");
	render.metric("Duration", `${result.metrics.durationMs}ms`);
	render.metric("Signal Count", result.signals.length);
	render.text("If you only saw the render output and no signal logs, logging is properly disabled!");
}

// ============================================================================
// Main
// ============================================================================

async function main() {
	render.banner("Signal Console Level Validation", "Testing quiet/normal/verbose levels");

	await testQuietLevel();
	render.blank();

	await testNormalLevel();
	render.blank();

	await testVerboseLevel();
	render.blank();

	await testLoggingDisabled();

	render.section("All Tests Complete");
	render.text("Check the console output above to verify logging behavior at each level.");
	render.blank();
	render.text("Level Summary:");
	render.text("  quiet   → workflow:start + workflow:end only");
	render.text("  normal  → all signals, truncated content (default)");
	render.text("  verbose → all signals, full content + streaming");
}

main().catch((err) => render.error(err.message));
