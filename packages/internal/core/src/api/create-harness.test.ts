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
import { createHarness, type ActivationContext } from "./create-harness.js";
import { createSignal, type Signal, type Provider } from "@signals/core";

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
