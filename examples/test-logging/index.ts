/**
 * Test script to validate v3.1 logging implementation
 *
 * Tests:
 * 1. Default logging (console ON, file OFF)
 * 2. Different log levels (info, debug, trace)
 * 3. Logging disabled
 * 4. Render utility
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

			// Simulate tool call (debug level)
			yield createSignal("tool:call", { tool: "web_search", input: { query: "test" } });
			yield createSignal("tool:result", { tool: "web_search", result: "Search results" });

			// Simulate text streaming (trace level - very verbose)
			yield createSignal(HARNESS_SIGNALS.TEXT_DELTA, { content: "Hello " });
			yield createSignal(HARNESS_SIGNALS.TEXT_DELTA, { content: "World" });
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

async function testDefaultLogging() {
	render.banner("Test 1: Default Logging", "Console ON, File OFF, Level INFO");

	const myAgent = agent({
		prompt: "You are a test agent",
		activateOn: ["workflow:start"],
		emits: ["test:complete"],
		signalHarness: createMockHarness("Test response"),
	});

	if (!isReactiveAgent(myAgent)) {
		throw new Error("Expected ReactiveAgent");
	}

	render.text("Running with default logging (info level)...");
	render.text("You should see: workflow:start, agent:activated, harness:start, harness:end, test:complete, workflow:end");
	render.text("You should NOT see: tool:call, tool:result, text:delta (debug/trace level)");
	render.blank();

	const result = await runReactive(myAgent, "test input");

	render.section("Result");
	render.metric("Duration", `${result.metrics.durationMs}ms`);
	render.metric("Activations", result.metrics.activations);
	render.metric("Signal Count", result.signals.length);
}

async function testDebugLogging() {
	render.banner("Test 2: Debug Logging", "Should show tool calls");

	const myAgent = agent({
		prompt: "You are a test agent",
		activateOn: ["workflow:start"],
		emits: ["test:complete"],
		signalHarness: createMockHarness("Debug test"),
	});

	if (!isReactiveAgent(myAgent)) {
		throw new Error("Expected ReactiveAgent");
	}

	render.text("Running with debug level...");
	render.text("You should see: everything from info PLUS tool:call, tool:result");
	render.text("You should NOT see: text:delta (trace level)");
	render.blank();

	const result = await runReactive(myAgent, "test input", {
		logging: { level: "debug" },
	});

	render.section("Result");
	render.metric("Duration", `${result.metrics.durationMs}ms`);
	render.metric("Signal Count", result.signals.length);
}

async function testTraceLogging() {
	render.banner("Test 3: Trace Logging", "Should show everything including deltas");

	const myAgent = agent({
		prompt: "You are a test agent",
		activateOn: ["workflow:start"],
		emits: ["test:complete"],
		signalHarness: createMockHarness("Trace test"),
	});

	if (!isReactiveAgent(myAgent)) {
		throw new Error("Expected ReactiveAgent");
	}

	render.text("Running with trace level (verbose)...");
	render.text("You should see: EVERYTHING including text:delta signals");
	render.blank();

	const result = await runReactive(myAgent, "test input", {
		logging: { level: "trace" },
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
	render.banner("v3.1 Logging Validation", "Testing signal-to-Pino subscriber");

	await testDefaultLogging();
	render.blank();

	await testDebugLogging();
	render.blank();

	await testTraceLogging();
	render.blank();

	await testLoggingDisabled();

	render.section("All Tests Complete");
	render.text("Check the console output above to verify logging behavior at each level.");
}

main().catch((err) => render.error(err.message));
