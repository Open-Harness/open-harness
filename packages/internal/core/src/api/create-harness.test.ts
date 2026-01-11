/**
 * Tests for createHarness factory pattern.
 *
 * These tests validate:
 * 1. DX - the API is ergonomic and type-safe
 * 2. Type safety - `when` guards have typed state access
 * 3. Variance - agents with same TState work together (no TS errors)
 * 4. Runtime behavior - guards actually execute
 */

import { describe, it, expect, vi } from "vitest";
import {
	createHarness,
	TimeoutError,
	type ActivationContext,
} from "./create-harness.js";
import { createSignal, type Signal, type Provider } from "@internal/signals-core";

// ============================================================================
// Test State Types
// ============================================================================

type TradingState = {
	confidence: number;
	position: "long" | "short" | null;
	balance: number;
	ready: boolean;
};

type SimpleState = {
	count: number;
	enabled: boolean;
};

// ============================================================================
// Mock Provider
// ============================================================================

function createMockProvider(output: unknown = { result: "ok" }): Provider {
	return {
		run: async function* (_input, _ctx) {
			yield createSignal("provider:start", {});
			yield createSignal("text:delta", { delta: "Hello" });
			yield createSignal("provider:end", { output });
		},
	};
}

// ============================================================================
// DX Tests - Type Safety
// ============================================================================

describe("createHarness DX", () => {
	it("provides typed state access in when guards", () => {
		// This test validates TypeScript types at compile time
		const { agent } = createHarness<TradingState>();

		// Create agent with typed when guard
		const analyst = agent({
			prompt: "Analyze market",
			activateOn: ["harness:start"],
			emits: ["analysis:complete"],

			// TypeScript should provide autocomplete for:
			// - ctx.state.confidence (number)
			// - ctx.state.position ("long" | "short" | null)
			// - ctx.state.balance (number)
			// - ctx.state.ready (boolean)
			when: (ctx) => {
				// These all typecheck correctly:
				const _conf: number = ctx.state.confidence;
				const _pos: "long" | "short" | null = ctx.state.position;
				const _bal: number = ctx.state.balance;
				const _ready: boolean = ctx.state.ready;

				return ctx.state.balance > 1000 && ctx.state.ready;
			},
		});

		expect(analyst._tag).toBe("Agent");
		expect(analyst._reactive).toBe(true);
	});

	it("allows multiple agents with same state type (no variance error)", () => {
		const { agent } = createHarness<TradingState>();

		// All these agents share TradingState - no variance issues!
		const analyst = agent({
			prompt: "Analyze market",
			activateOn: ["harness:start"],
			when: (ctx) => ctx.state.balance > 1000,
		});

		const executor = agent({
			prompt: "Execute trades",
			activateOn: ["analysis:complete"],
			when: (ctx) => ctx.state.confidence > 0.8,
		});

		const reporter = agent({
			prompt: "Report results",
			activateOn: ["trade:executed"],
			when: (ctx) => ctx.state.position !== null,
		});

		// All can be collected together - TypeScript is happy
		const agents = { analyst, executor, reporter };

		expect(Object.keys(agents)).toEqual(["analyst", "executor", "reporter"]);
	});

	it("signal is typed in activation context", () => {
		const { agent } = createHarness<SimpleState>();

		const handler = agent({
			prompt: "Handle signal",
			activateOn: ["data:received"],
			when: (ctx) => {
				// ctx.signal is typed as Signal
				const _name: string = ctx.signal.name;
				const _payload: unknown = ctx.signal.payload;
				const _ts: number = ctx.signal.timestamp;

				return ctx.signal.name === "data:received";
			},
		});

		expect(handler._reactive).toBe(true);
	});

	it("input is accessible in activation context", () => {
		const { agent } = createHarness<SimpleState>();

		const handler = agent({
			prompt: "Handle input",
			activateOn: ["harness:start"],
			when: (ctx) => {
				// ctx.input is typed as unknown (caller provides any input)
				return ctx.input !== null;
			},
		});

		expect(handler.config.when).toBeDefined();
	});
});

// ============================================================================
// Runtime Behavior Tests
// ============================================================================

describe("createHarness runtime", () => {
	it("executes agent when guard returns true", async () => {
		const { agent, runReactive } = createHarness<SimpleState>();
		const provider = createMockProvider();

		const counter = agent({
			prompt: "Count things",
			activateOn: ["harness:start"],
			emits: ["counted"],
			when: (ctx) => ctx.state.enabled, // Will be true
		});

		const result = await runReactive({
			agents: { counter },
			state: { count: 0, enabled: true },
			provider,
		});

		// Agent should have activated
		expect(result.metrics.activations).toBe(1);

		// Should have emitted counted signal
		const countedSignal = result.signals.find((s) => s.name === "counted");
		expect(countedSignal).toBeDefined();
	});

	it("skips agent when guard returns false", async () => {
		const { agent, runReactive } = createHarness<SimpleState>();
		const provider = createMockProvider();

		const counter = agent({
			prompt: "Count things",
			activateOn: ["harness:start"],
			emits: ["counted"],
			when: (ctx) => ctx.state.enabled, // Will be false
		});

		const result = await runReactive({
			agents: { counter },
			state: { count: 0, enabled: false }, // disabled!
			provider,
		});

		// Agent should NOT have activated
		expect(result.metrics.activations).toBe(0);

		// Should have emitted skipped signal
		const skippedSignal = result.signals.find((s) => s.name === "agent:skipped");
		expect(skippedSignal).toBeDefined();
		expect((skippedSignal?.payload as { reason?: string })?.reason).toBe(
			"when guard returned false",
		);
	});

	it("agent without when guard always activates", async () => {
		const { agent, runReactive } = createHarness<SimpleState>();
		const provider = createMockProvider();

		const noGuard = agent({
			prompt: "Always run",
			activateOn: ["harness:start"],
			// No when guard
		});

		const result = await runReactive({
			agents: { noGuard },
			state: { count: 0, enabled: false },
			provider,
		});

		// Should activate regardless of state
		expect(result.metrics.activations).toBe(1);
	});

	it("multiple agents can chain via signals", async () => {
		const { agent, runReactive } = createHarness<TradingState>();
		const provider = createMockProvider();

		const analyst = agent({
			prompt: "Analyze",
			activateOn: ["harness:start"],
			emits: ["analysis:complete"],
			when: (ctx) => ctx.state.ready,
		});

		const executor = agent({
			prompt: "Execute",
			activateOn: ["analysis:complete"],
			emits: ["trade:executed"],
			when: (ctx) => ctx.state.confidence > 0.5,
		});

		const result = await runReactive({
			agents: { analyst, executor },
			state: { confidence: 0.8, position: null, balance: 5000, ready: true },
			provider,
		});

		// Both should activate (analyst on start, executor on analysis:complete)
		expect(result.metrics.activations).toBe(2);

		// Check signal chain
		const signalNames = result.signals.map((s) => s.name);
		expect(signalNames).toContain("harness:start");
		expect(signalNames).toContain("analysis:complete");
		expect(signalNames).toContain("trade:executed");
	});
});

// ============================================================================
// F2: Template Expansion Tests
// ============================================================================

describe("template expansion", () => {
	it("expands state properties in prompt", async () => {
		const { agent, runReactive } = createHarness<TradingState>();

		// Track what prompt was sent to provider
		let capturedPrompt = "";
		const trackingProvider: Provider = {
			run: async function* (input, _ctx) {
				capturedPrompt = input.system ?? "";
				yield createSignal("provider:start", {});
				yield createSignal("provider:end", { output: "ok" });
			},
		};

		const analyst = agent({
			prompt: "Analyze {{ state.position }} position with confidence {{ state.confidence }}",
			activateOn: ["harness:start"],
		});

		await runReactive({
			agents: { analyst },
			state: { confidence: 0.85, position: "long", balance: 5000, ready: true },
			provider: trackingProvider,
		});

		// Prompt should have been expanded
		expect(capturedPrompt).toBe("Analyze long position with confidence 0.85");
	});

	it("expands signal properties in prompt", async () => {
		const { agent, runReactive } = createHarness<SimpleState>();

		let capturedPrompt = "";
		const trackingProvider: Provider = {
			run: async function* (input, _ctx) {
				capturedPrompt = input.system ?? "";
				yield createSignal("provider:start", {});
				yield createSignal("provider:end", { output: "ok" });
			},
		};

		const handler = agent({
			prompt: "Handling signal {{ signal.name }}",
			activateOn: ["harness:start"],
		});

		await runReactive({
			agents: { handler },
			state: { count: 0, enabled: true },
			provider: trackingProvider,
		});

		expect(capturedPrompt).toBe("Handling signal harness:start");
	});

	it("expands nested state in prompt", async () => {
		type NestedState = {
			user: {
				name: string;
				settings: { theme: string };
			};
		};

		const { agent, runReactive } = createHarness<NestedState>();

		let capturedPrompt = "";
		const trackingProvider: Provider = {
			run: async function* (input, _ctx) {
				capturedPrompt = input.system ?? "";
				yield createSignal("provider:start", {});
				yield createSignal("provider:end", { output: "ok" });
			},
		};

		const greeter = agent({
			prompt: "Hello {{ state.user.name }}, your theme is {{ state.user.settings.theme }}",
			activateOn: ["harness:start"],
		});

		await runReactive({
			agents: { greeter },
			state: { user: { name: "Alice", settings: { theme: "dark" } } },
			provider: trackingProvider,
		});

		expect(capturedPrompt).toBe("Hello Alice, your theme is dark");
	});

	it("leaves prompt unchanged when no templates", async () => {
		const { agent, runReactive } = createHarness<SimpleState>();

		let capturedPrompt = "";
		const trackingProvider: Provider = {
			run: async function* (input, _ctx) {
				capturedPrompt = input.system ?? "";
				yield createSignal("provider:start", {});
				yield createSignal("provider:end", { output: "ok" });
			},
		};

		const simple = agent({
			prompt: "This is a plain prompt with no templates",
			activateOn: ["harness:start"],
		});

		await runReactive({
			agents: { simple },
			state: { count: 0, enabled: true },
			provider: trackingProvider,
		});

		expect(capturedPrompt).toBe("This is a plain prompt with no templates");
	});

	it("handles shorthand state access (without state. prefix)", async () => {
		const { agent, runReactive } = createHarness<TradingState>();

		let capturedPrompt = "";
		const trackingProvider: Provider = {
			run: async function* (input, _ctx) {
				capturedPrompt = input.system ?? "";
				yield createSignal("provider:start", {});
				yield createSignal("provider:end", { output: "ok" });
			},
		};

		const analyst = agent({
			prompt: "Balance is {{ balance }}", // Shorthand for {{ state.balance }}
			activateOn: ["harness:start"],
		});

		await runReactive({
			agents: { analyst },
			state: { confidence: 0.85, position: "long", balance: 5000, ready: true },
			provider: trackingProvider,
		});

		expect(capturedPrompt).toBe("Balance is 5000");
	});
});

// ============================================================================
// E1: Multi-Agent Signals & Causality Tests
// ============================================================================

describe("multi-agent causality", () => {
	it("tracks causality chain through signal passing", async () => {
		const { agent, runReactive } = createHarness<TradingState>();
		const provider = createMockProvider();

		const analyst = agent({
			prompt: "Analyze",
			activateOn: ["harness:start"],
			emits: ["analysis:complete"],
		});

		const executor = agent({
			prompt: "Execute",
			activateOn: ["analysis:complete"],
			emits: ["trade:executed"],
		});

		const result = await runReactive({
			agents: { analyst, executor },
			state: { confidence: 0.9, position: null, balance: 5000, ready: true },
			provider,
		});

		// Find the executor's activation signal
		const executorActivated = result.signals.find(
			(s) =>
				s.name === "agent:activated" &&
				(s.payload as { agent: string }).agent === "executor",
		);

		expect(executorActivated).toBeDefined();
		expect(executorActivated?.source?.agent).toBe("executor");
		expect(executorActivated?.source?.parent).toBeDefined();

		// The parent should be analysis:complete
		const parentSignal = result.signals.find(
			(s) => s.id === executorActivated?.source?.parent,
		);
		expect(parentSignal?.name).toBe("analysis:complete");

		// And analysis:complete's parent should trace back to analyst
		expect(parentSignal?.source?.agent).toBe("analyst");
	});

	it("signals have unique IDs", async () => {
		const { agent, runReactive } = createHarness<SimpleState>();
		const provider = createMockProvider();

		const handler = agent({
			prompt: "Handle",
			activateOn: ["harness:start"],
		});

		const result = await runReactive({
			agents: { handler },
			state: { count: 0, enabled: true },
			provider,
		});

		const ids = result.signals.map((s) => s.id);
		const uniqueIds = new Set(ids);

		expect(uniqueIds.size).toBe(ids.length);
		expect(ids.every((id) => id.startsWith("sig_"))).toBe(true);
	});

	it("three-agent chain maintains causality", async () => {
		const { agent, runReactive } = createHarness<SimpleState>();
		const provider = createMockProvider();

		const first = agent({
			prompt: "First",
			activateOn: ["harness:start"],
			emits: ["first:done"],
		});

		const second = agent({
			prompt: "Second",
			activateOn: ["first:done"],
			emits: ["second:done"],
		});

		const third = agent({
			prompt: "Third",
			activateOn: ["second:done"],
			emits: ["third:done"],
		});

		const result = await runReactive({
			agents: { first, second, third },
			state: { count: 0, enabled: true },
			provider,
		});

		// All three agents should activate
		expect(result.metrics.activations).toBe(3);

		// All custom signals should be present
		const signalNames = result.signals.map((s) => s.name);
		expect(signalNames).toContain("first:done");
		expect(signalNames).toContain("second:done");
		expect(signalNames).toContain("third:done");

		// Verify causality chain
		const thirdDone = result.signals.find((s) => s.name === "third:done");
		const thirdActivated = result.signals.find(
			(s) => s.id === thirdDone?.source?.parent,
		);
		const secondDone = result.signals.find(
			(s) => s.id === thirdActivated?.source?.parent,
		);

		expect(secondDone?.name).toBe("second:done");
	});

	it("parallel agents activated by same signal have same parent", async () => {
		const { agent, runReactive } = createHarness<SimpleState>();
		const provider = createMockProvider();

		// Both agents activate on harness:start
		const agentA = agent({
			prompt: "Agent A",
			activateOn: ["harness:start"],
			emits: ["a:done"],
		});

		const agentB = agent({
			prompt: "Agent B",
			activateOn: ["harness:start"],
			emits: ["b:done"],
		});

		const result = await runReactive({
			agents: { agentA, agentB },
			state: { count: 0, enabled: true },
			provider,
		});

		// Both should activate
		expect(result.metrics.activations).toBe(2);

		// Find both activation signals
		const activations = result.signals.filter((s) => s.name === "agent:activated");
		expect(activations).toHaveLength(2);

		// Both should have harness:start as parent
		const harnessStart = result.signals.find((s) => s.name === "harness:start");
		expect(activations[0].source?.parent).toBe(harnessStart?.id);
		expect(activations[1].source?.parent).toBe(harnessStart?.id);
	});
});

// ============================================================================
// Type Guard Edge Cases
// ============================================================================

describe("when guard edge cases", () => {
	it("guard can access nested state properties", () => {
		type NestedState = {
			user: {
				name: string;
				preferences: {
					notifications: boolean;
				};
			};
		};

		const { agent } = createHarness<NestedState>();

		const notifier = agent({
			prompt: "Send notifications",
			activateOn: ["event:occurred"],
			when: (ctx) => ctx.state.user.preferences.notifications,
		});

		expect(notifier.config.when).toBeDefined();
	});

	it("guard can use signal payload for decisions", async () => {
		const { agent, runReactive } = createHarness<SimpleState>();
		const provider = createMockProvider();

		const selectiveAgent = agent({
			prompt: "Handle specific events",
			activateOn: ["harness:start"],
			when: (ctx) => {
				const payload = ctx.signal.payload as { priority?: string };
				return payload.priority === "high";
			},
		});

		// This won't activate because harness:start doesn't have priority: "high"
		const result = await runReactive({
			agents: { selectiveAgent },
			state: { count: 0, enabled: true },
			provider,
		});

		expect(result.metrics.activations).toBe(0);
	});
});

// ============================================================================
// E3: Parallel Execution & Timeout Tests
// ============================================================================

describe("parallel execution", () => {
	it("executes multiple agents concurrently on same trigger", async () => {
		const { agent, runReactive } = createHarness<SimpleState>();

		// Track execution times
		const executionLog: Array<{ agent: string; event: string; time: number }> =
			[];
		const startTime = Date.now();

		const createDelayedProvider = (
			name: string,
			delayMs: number,
		): Provider => ({
			run: async function* (_input, _ctx) {
				executionLog.push({
					agent: name,
					event: "start",
					time: Date.now() - startTime,
				});
				yield createSignal("provider:start", {});

				await new Promise((r) => setTimeout(r, delayMs));

				executionLog.push({
					agent: name,
					event: "end",
					time: Date.now() - startTime,
				});
				yield createSignal("provider:end", { output: name });
			},
		});

		// Two agents that each take 50ms
		const agentA = agent({
			prompt: "Agent A",
			activateOn: ["harness:start"],
			signalProvider: createDelayedProvider("A", 50),
		});

		const agentB = agent({
			prompt: "Agent B",
			activateOn: ["harness:start"],
			signalProvider: createDelayedProvider("B", 50),
		});

		const result = await runReactive({
			agents: { agentA, agentB },
			state: { count: 0, enabled: true },
		});

		// Both should have activated
		expect(result.metrics.activations).toBe(2);

		// Verify parallel execution: total time should be ~50ms, not ~100ms
		// If they ran sequentially, it would take 100ms+
		// Give some buffer for test overhead (< 80ms means parallel)
		expect(result.metrics.durationMs).toBeLessThan(80);

		// Both should start before either ends (parallel execution)
		const aStart = executionLog.find(
			(e) => e.agent === "A" && e.event === "start",
		);
		const bStart = executionLog.find(
			(e) => e.agent === "B" && e.event === "start",
		);
		const aEnd = executionLog.find((e) => e.agent === "A" && e.event === "end");
		const bEnd = executionLog.find((e) => e.agent === "B" && e.event === "end");

		expect(aStart).toBeDefined();
		expect(bStart).toBeDefined();

		// Both should start before the other ends
		expect(aStart!.time).toBeLessThan(bEnd!.time);
		expect(bStart!.time).toBeLessThan(aEnd!.time);
	});

	it("waits for all parallel agents before emitting harness:end", async () => {
		const { agent, runReactive } = createHarness<SimpleState>();

		// Agent B takes longer than A
		const createDelayedProvider = (delayMs: number): Provider => ({
			run: async function* (_input, _ctx) {
				yield createSignal("provider:start", {});
				await new Promise((r) => setTimeout(r, delayMs));
				yield createSignal("provider:end", { output: "done" });
			},
		});

		const fastAgent = agent({
			prompt: "Fast",
			activateOn: ["harness:start"],
			signalProvider: createDelayedProvider(10),
		});

		const slowAgent = agent({
			prompt: "Slow",
			activateOn: ["harness:start"],
			signalProvider: createDelayedProvider(50),
		});

		const result = await runReactive({
			agents: { fastAgent, slowAgent },
			state: { count: 0, enabled: true },
		});

		// Both should complete
		expect(result.metrics.activations).toBe(2);

		// harness:end should be the last signal (after all agent work)
		const lastSignal = result.signals[result.signals.length - 1];
		expect(lastSignal.name).toBe("harness:end");

		// Duration should reflect the slowest agent
		expect(result.metrics.durationMs).toBeGreaterThanOrEqual(50);
	});

	it("handles mixed parallel and sequential agents", async () => {
		const { agent, runReactive } = createHarness<SimpleState>();

		const createDelayedProvider = (delayMs: number): Provider => ({
			run: async function* (_input, _ctx) {
				yield createSignal("provider:start", {});
				await new Promise((r) => setTimeout(r, delayMs));
				yield createSignal("provider:end", { output: "done" });
			},
		});

		// Two parallel agents on start
		const parallel1 = agent({
			prompt: "Parallel 1",
			activateOn: ["harness:start"],
			emits: ["phase1:done"],
			signalProvider: createDelayedProvider(30),
		});

		const parallel2 = agent({
			prompt: "Parallel 2",
			activateOn: ["harness:start"],
			emits: ["phase1:done"],
			signalProvider: createDelayedProvider(30),
		});

		// Sequential agent triggered after phase 1
		const sequential = agent({
			prompt: "Sequential",
			activateOn: ["phase1:done"],
			signalProvider: createDelayedProvider(20),
		});

		const result = await runReactive({
			agents: { parallel1, parallel2, sequential },
			state: { count: 0, enabled: true },
		});

		// All three should activate
		// parallel1 and parallel2 on start, sequential on phase1:done (2x)
		// Sequential activates twice because both parallel agents emit phase1:done
		expect(result.metrics.activations).toBe(4);
	});
});

describe("timeout handling", () => {
	it("throws TimeoutError when execution exceeds timeout", async () => {
		const { agent, runReactive } = createHarness<SimpleState>();

		// Create a slow provider that takes 200ms
		const slowProvider: Provider = {
			run: async function* (_input, _ctx) {
				yield createSignal("provider:start", {});
				await new Promise((r) => setTimeout(r, 200));
				yield createSignal("provider:end", { output: "done" });
			},
		};

		const slowAgent = agent({
			prompt: "Slow agent",
			activateOn: ["harness:start"],
		});

		await expect(
			runReactive({
				agents: { slowAgent },
				state: { count: 0, enabled: true },
				provider: slowProvider,
				timeout: 50, // 50ms timeout, agent takes 200ms
			}),
		).rejects.toThrow(TimeoutError);
	});

	it("TimeoutError includes timeout duration", async () => {
		const { agent, runReactive } = createHarness<SimpleState>();

		const slowProvider: Provider = {
			run: async function* (_input, _ctx) {
				yield createSignal("provider:start", {});
				await new Promise((r) => setTimeout(r, 200));
				yield createSignal("provider:end", { output: "done" });
			},
		};

		const slowAgent = agent({
			prompt: "Slow agent",
			activateOn: ["harness:start"],
		});

		try {
			await runReactive({
				agents: { slowAgent },
				state: { count: 0, enabled: true },
				provider: slowProvider,
				timeout: 50,
			});
			expect.fail("Should have thrown TimeoutError");
		} catch (error) {
			expect(error).toBeInstanceOf(TimeoutError);
			expect((error as TimeoutError).timeoutMs).toBe(50);
			expect((error as TimeoutError).message).toContain("50ms");
		}
	});

	it("completes successfully when within timeout", async () => {
		const { agent, runReactive } = createHarness<SimpleState>();

		const fastProvider: Provider = {
			run: async function* (_input, _ctx) {
				yield createSignal("provider:start", {});
				await new Promise((r) => setTimeout(r, 10));
				yield createSignal("provider:end", { output: "done" });
			},
		};

		const fastAgent = agent({
			prompt: "Fast agent",
			activateOn: ["harness:start"],
		});

		// Should complete successfully with generous timeout
		const result = await runReactive({
			agents: { fastAgent },
			state: { count: 0, enabled: true },
			provider: fastProvider,
			timeout: 5000,
		});

		expect(result.metrics.activations).toBe(1);
	});

	it("ignores timeout when not specified", async () => {
		const { agent, runReactive } = createHarness<SimpleState>();

		const provider: Provider = {
			run: async function* (_input, _ctx) {
				yield createSignal("provider:start", {});
				await new Promise((r) => setTimeout(r, 10));
				yield createSignal("provider:end", { output: "done" });
			},
		};

		const handler = agent({
			prompt: "Handler",
			activateOn: ["harness:start"],
		});

		// No timeout specified - should complete normally
		const result = await runReactive({
			agents: { handler },
			state: { count: 0, enabled: true },
			provider,
			// timeout: undefined
		});

		expect(result.metrics.activations).toBe(1);
	});

	it("ignores timeout of 0", async () => {
		const { agent, runReactive } = createHarness<SimpleState>();

		const provider: Provider = {
			run: async function* (_input, _ctx) {
				yield createSignal("provider:start", {});
				await new Promise((r) => setTimeout(r, 10));
				yield createSignal("provider:end", { output: "done" });
			},
		};

		const handler = agent({
			prompt: "Handler",
			activateOn: ["harness:start"],
		});

		// timeout: 0 means no timeout
		const result = await runReactive({
			agents: { handler },
			state: { count: 0, enabled: true },
			provider,
			timeout: 0,
		});

		expect(result.metrics.activations).toBe(1);
	});
});

// ============================================================================
// E4: Harness API - endWhen Termination Tests
// ============================================================================

describe("endWhen termination", () => {
	it("terminates harness when endWhen returns true immediately", async () => {
		const { agent, runReactive } = createHarness<SimpleState>();
		const provider = createMockProvider();

		const first = agent({
			prompt: "First agent",
			activateOn: ["harness:start"],
			emits: ["first:done"],
		});

		// This agent should NOT activate because endWhen triggers after first completes
		const second = agent({
			prompt: "Second agent (should be skipped)",
			activateOn: ["first:done"],
		});

		const result = await runReactive({
			agents: { first, second },
			state: { count: 0, enabled: true },
			provider,
			endWhen: () => true, // Always true - terminates after first agent
		});

		// Should terminate early
		expect(result.terminatedEarly).toBe(true);

		// First agent should run, second should be skipped
		expect(result.metrics.activations).toBe(1);

		// Should see harness:terminating signal
		const terminatingSignal = result.signals.find(
			(s) => s.name === "harness:terminating",
		);
		expect(terminatingSignal).toBeDefined();
		expect(
			(terminatingSignal?.payload as { reason: string }).reason,
		).toBe("endWhen condition met");
	});

	it("skips new activations after termination", async () => {
		const { agent, runReactive } = createHarness<SimpleState>();

		// Track which agents actually ran
		const agentsRun: string[] = [];

		const createTrackingProvider = (name: string): Provider => ({
			run: async function* (_input, _ctx) {
				agentsRun.push(name);
				yield createSignal("provider:start", {});
				yield createSignal("provider:end", { output: name });
			},
		});

		const step1 = agent({
			prompt: "Step 1",
			activateOn: ["harness:start"],
			emits: ["step1:done"],
			signalProvider: createTrackingProvider("step1"),
		});

		const step2 = agent({
			prompt: "Step 2 (should be skipped)",
			activateOn: ["step1:done"],
			signalProvider: createTrackingProvider("step2"),
		});

		const result = await runReactive({
			agents: { step1, step2 },
			state: { count: 0, enabled: true },
			endWhen: () => true, // Always true - terminates after step1
		});

		// Only step1 should run
		expect(agentsRun).toContain("step1");
		expect(agentsRun).not.toContain("step2");

		// step2 should be skipped with the right reason
		const skippedSignals = result.signals.filter(
			(s) =>
				s.name === "agent:skipped" &&
				(s.payload as { reason: string }).reason ===
					"harness terminated by endWhen",
		);
		expect(skippedSignals.length).toBeGreaterThan(0);

		// The harness:terminating signal should be present
		expect(result.terminatedEarly).toBe(true);
	});

	it("returns terminatedEarly: false when endWhen not triggered", async () => {
		const { agent, runReactive } = createHarness<SimpleState>();
		const provider = createMockProvider();

		const handler = agent({
			prompt: "Handler",
			activateOn: ["harness:start"],
		});

		const result = await runReactive({
			agents: { handler },
			state: { count: 0, enabled: true },
			provider,
			endWhen: (state) => state.count > 100, // Never true
		});

		expect(result.terminatedEarly).toBe(false);
		expect(result.metrics.activations).toBe(1);
	});

	it("returns terminatedEarly: false when no endWhen specified", async () => {
		const { agent, runReactive } = createHarness<SimpleState>();
		const provider = createMockProvider();

		const handler = agent({
			prompt: "Handler",
			activateOn: ["harness:start"],
		});

		const result = await runReactive({
			agents: { handler },
			state: { count: 0, enabled: true },
			provider,
			// No endWhen
		});

		expect(result.terminatedEarly).toBe(false);
	});

	it("allows pending activations to complete before terminating", async () => {
		type CompleteState = { done: boolean };

		const { agent, runReactive } = createHarness<CompleteState>();

		// Track completion
		const completions: string[] = [];

		// Slow provider that takes time
		const createSlowProvider = (name: string, delayMs: number): Provider => ({
			run: async function* (_input, _ctx) {
				yield createSignal("provider:start", {});
				await new Promise((r) => setTimeout(r, delayMs));
				completions.push(name);
				yield createSignal("provider:end", { output: name });
			},
		});

		// Two parallel agents on start - one fast, one slow
		const fast = agent({
			prompt: "Fast agent",
			activateOn: ["harness:start"],
			signalProvider: createSlowProvider("fast", 10),
		});

		const slow = agent({
			prompt: "Slow agent",
			activateOn: ["harness:start"],
			signalProvider: createSlowProvider("slow", 50),
		});

		const result = await runReactive({
			agents: { fast, slow },
			state: { done: false },
			endWhen: () => true, // Always true - terminates immediately
		});

		// Both agents should still complete (pending activations finish)
		expect(completions).toContain("fast");
		expect(completions).toContain("slow");
		expect(result.metrics.activations).toBe(2);
		expect(result.terminatedEarly).toBe(true);
	});
});
