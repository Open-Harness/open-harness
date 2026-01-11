/**
 * Tests for telemetry wide events.
 *
 * E5: Telemetry (Wide Events)
 */

import { describe, it, expect, vi } from "vitest";
import {
	createTelemetrySubscriber,
	createWideEvent,
	type HarnessEvent,
	type HarnessWideEvent,
	type HarnessStartEvent,
	type HarnessErrorEvent,
	type TelemetryInput,
} from "./telemetry.js";
import { createSignal } from "@internal/signals-core";

// ============================================================================
// Test Helpers
// ============================================================================

function createTestSignals() {
	return [
		createSignal("harness:start", { agents: ["analyst", "executor"] }),
		createSignal("agent:activated", { agent: "analyst", trigger: "harness:start" }),
		createSignal("provider:start", {}),
		createSignal("text:delta", { delta: "Hello" }),
		createSignal("text:delta", { delta: " world" }),
		createSignal("provider:end", {
			output: "Hello world",
			usage: { inputTokens: 10, outputTokens: 5 },
		}),
		createSignal("analysis:complete", { agent: "analyst" }),
		createSignal("agent:activated", { agent: "executor", trigger: "analysis:complete" }),
		createSignal("provider:start", {}),
		createSignal("provider:end", {
			output: "Executed",
			usage: { inputTokens: 20, outputTokens: 10 },
		}),
		createSignal("harness:end", { durationMs: 100, activations: 2 }),
	];
}

function createTestResult(overrides: Partial<TelemetryInput> = {}): TelemetryInput {
	return {
		signals: createTestSignals(),
		metrics: {
			durationMs: 100,
			activations: 2,
		},
		terminatedEarly: false,
		...overrides,
	};
}

// ============================================================================
// createTelemetrySubscriber Tests
// ============================================================================

describe("createTelemetrySubscriber", () => {
	describe("emitStart", () => {
		it("emits harness.start event", () => {
			const events: HarnessEvent[] = [];
			const telemetry = createTelemetrySubscriber({
				emitter: (e) => events.push(e),
			});

			telemetry.emitStart("run-123", ["analyst", "executor"]);

			expect(events).toHaveLength(1);
			const event = events[0] as HarnessStartEvent;
			expect(event.event).toBe("harness.start");
			expect(event.runId).toBe("run-123");
			expect(event.agents).toEqual(["analyst", "executor"]);
			expect(event.startedAt).toBeDefined();
		});

		it("includes metadata when provided", () => {
			const events: HarnessEvent[] = [];
			const telemetry = createTelemetrySubscriber({
				emitter: (e) => events.push(e),
				metadata: { env: "test", version: "1.0" },
			});

			telemetry.emitStart("run-123", ["agent"]);

			const event = events[0] as HarnessStartEvent;
			expect(event.metadata).toEqual({ env: "test", version: "1.0" });
		});

		it("can be disabled via config", () => {
			const events: HarnessEvent[] = [];
			const telemetry = createTelemetrySubscriber({
				emitter: (e) => events.push(e),
				emitStart: false,
			});

			telemetry.emitStart("run-123", ["agent"]);

			expect(events).toHaveLength(0);
		});
	});

	describe("emitComplete", () => {
		it("emits harness.complete wide event", () => {
			const events: HarnessEvent[] = [];
			const telemetry = createTelemetrySubscriber({
				emitter: (e) => events.push(e),
			});

			const startedAt = new Date().toISOString();
			telemetry.emitComplete("run-123", startedAt, createTestResult());

			expect(events).toHaveLength(1);
			const event = events[0] as HarnessWideEvent;
			expect(event.event).toBe("harness.complete");
			expect(event.runId).toBe("run-123");
			expect(event.startedAt).toBe(startedAt);
			expect(event.completedAt).toBeDefined();
			expect(event.durationMs).toBe(100);
			expect(event.outcome).toBe("success");
			expect(event.activations).toBe(2);
		});

		it("extracts activated agents from signals", () => {
			const events: HarnessEvent[] = [];
			const telemetry = createTelemetrySubscriber({
				emitter: (e) => events.push(e),
			});

			telemetry.emitComplete("run-123", new Date().toISOString(), createTestResult());

			const event = events[0] as HarnessWideEvent;
			expect(event.agentsActivated).toContain("analyst");
			expect(event.agentsActivated).toContain("executor");
		});

		it("extracts token usage from provider signals", () => {
			const events: HarnessEvent[] = [];
			const telemetry = createTelemetrySubscriber({
				emitter: (e) => events.push(e),
			});

			telemetry.emitComplete("run-123", new Date().toISOString(), createTestResult());

			const event = events[0] as HarnessWideEvent;
			expect(event.tokens).toBeDefined();
			expect(event.tokens?.inputTokens).toBe(30); // 10 + 20
			expect(event.tokens?.outputTokens).toBe(15); // 5 + 10
			expect(event.tokens?.totalTokens).toBe(45);
		});

		it("sets outcome to terminated when terminatedEarly is true", () => {
			const events: HarnessEvent[] = [];
			const telemetry = createTelemetrySubscriber({
				emitter: (e) => events.push(e),
			});

			telemetry.emitComplete(
				"run-123",
				new Date().toISOString(),
				createTestResult({ terminatedEarly: true }),
			);

			const event = events[0] as HarnessWideEvent;
			expect(event.outcome).toBe("terminated");
			expect(event.terminatedEarly).toBe(true);
		});

		it("sets outcome to error when error is present", () => {
			const events: HarnessEvent[] = [];
			const telemetry = createTelemetrySubscriber({
				emitter: (e) => events.push(e),
			});

			telemetry.emitComplete(
				"run-123",
				new Date().toISOString(),
				createTestResult({ error: new Error("Something went wrong") }),
			);

			const event = events[0] as HarnessWideEvent;
			expect(event.outcome).toBe("error");
			expect(event.error).toBe("Something went wrong");
		});

		it("sets outcome to timeout for TimeoutError", () => {
			const events: HarnessEvent[] = [];
			const telemetry = createTelemetrySubscriber({
				emitter: (e) => events.push(e),
			});

			const timeoutError = new Error("Timeout");
			timeoutError.name = "TimeoutError";

			telemetry.emitComplete(
				"run-123",
				new Date().toISOString(),
				createTestResult({ error: timeoutError }),
			);

			const event = events[0] as HarnessWideEvent;
			expect(event.outcome).toBe("timeout");
		});

		it("includes signal count", () => {
			const events: HarnessEvent[] = [];
			const telemetry = createTelemetrySubscriber({
				emitter: (e) => events.push(e),
			});

			telemetry.emitComplete("run-123", new Date().toISOString(), createTestResult());

			const event = events[0] as HarnessWideEvent;
			expect(event.signalCount).toBe(11); // Count from createTestSignals
		});
	});

	describe("emitError", () => {
		it("emits harness.error event", () => {
			const events: HarnessEvent[] = [];
			const telemetry = createTelemetrySubscriber({
				emitter: (e) => events.push(e),
			});

			const error = new Error("Startup failed");
			telemetry.emitError("run-123", error, "startup");

			expect(events).toHaveLength(1);
			const event = events[0] as HarnessErrorEvent;
			expect(event.event).toBe("harness.error");
			expect(event.runId).toBe("run-123");
			expect(event.error).toBe("Startup failed");
			expect(event.phase).toBe("startup");
			expect(event.stack).toBeDefined();
		});

		it("can be disabled via config", () => {
			const events: HarnessEvent[] = [];
			const telemetry = createTelemetrySubscriber({
				emitter: (e) => events.push(e),
				emitError: false,
			});

			telemetry.emitError("run-123", new Error("Failed"), "execution");

			expect(events).toHaveLength(0);
		});
	});
});

// ============================================================================
// Signal Sampling Tests
// ============================================================================

describe("signal sampling", () => {
	it("samples signals at configured rate", () => {
		const events: HarnessEvent[] = [];
		const telemetry = createTelemetrySubscriber({
			emitter: (e) => events.push(e),
			sampling: { rate: 1.0 }, // 100% rate for testing
		});

		telemetry.emitComplete("run-123", new Date().toISOString(), createTestResult());

		const event = events[0] as HarnessWideEvent;
		expect(event.sampledSignals).toBeDefined();
		expect(event.sampledSignals!.length).toBeGreaterThan(0);
	});

	it("excludes signals matching neverInclude patterns", () => {
		const events: HarnessEvent[] = [];
		const telemetry = createTelemetrySubscriber({
			emitter: (e) => events.push(e),
			sampling: {
				rate: 1.0,
				neverInclude: ["text:delta", "provider:*"],
			},
		});

		telemetry.emitComplete("run-123", new Date().toISOString(), createTestResult());

		const event = events[0] as HarnessWideEvent;
		const signalNames = event.sampledSignals?.map((s) => s.name) ?? [];

		expect(signalNames).not.toContain("text:delta");
		expect(signalNames).not.toContain("provider:start");
		expect(signalNames).not.toContain("provider:end");
	});

	it("always includes signals matching alwaysInclude patterns", () => {
		const events: HarnessEvent[] = [];
		const telemetry = createTelemetrySubscriber({
			emitter: (e) => events.push(e),
			sampling: {
				rate: 0, // 0% rate, but alwaysInclude should still work
				alwaysInclude: ["harness:*", "agent:activated"],
			},
		});

		telemetry.emitComplete("run-123", new Date().toISOString(), createTestResult());

		const event = events[0] as HarnessWideEvent;
		const signalNames = event.sampledSignals?.map((s) => s.name) ?? [];

		expect(signalNames).toContain("harness:start");
		expect(signalNames).toContain("harness:end");
		expect(signalNames).toContain("agent:activated");
	});

	it("includes all signals on error when alwaysOnError is true", () => {
		const events: HarnessEvent[] = [];
		const telemetry = createTelemetrySubscriber({
			emitter: (e) => events.push(e),
			sampling: {
				rate: 0, // 0% rate
				alwaysOnError: true,
			},
		});

		telemetry.emitComplete(
			"run-123",
			new Date().toISOString(),
			createTestResult({ error: new Error("Failed") }),
		);

		const event = events[0] as HarnessWideEvent;
		expect(event.sampledSignals?.length).toBe(11); // All signals included
	});

	it("respects maxSignals limit", () => {
		const events: HarnessEvent[] = [];
		const telemetry = createTelemetrySubscriber({
			emitter: (e) => events.push(e),
			sampling: {
				rate: 1.0,
				maxSignals: 5,
			},
		});

		telemetry.emitComplete("run-123", new Date().toISOString(), createTestResult());

		const event = events[0] as HarnessWideEvent;
		expect(event.sampledSignals?.length).toBeLessThanOrEqual(5);
	});
});

// ============================================================================
// createWideEvent Helper Tests
// ============================================================================

describe("createWideEvent", () => {
	it("creates wide event without subscriber", () => {
		const startedAt = new Date().toISOString();
		const event = createWideEvent("run-123", startedAt, createTestResult());

		expect(event.event).toBe("harness.complete");
		expect(event.runId).toBe("run-123");
		expect(event.startedAt).toBe(startedAt);
		expect(event.outcome).toBe("success");
		expect(event.activations).toBe(2);
		expect(event.signalCount).toBe(11);
	});

	it("applies sampling configuration", () => {
		const event = createWideEvent(
			"run-123",
			new Date().toISOString(),
			createTestResult(),
			{ rate: 1.0, neverInclude: ["text:delta"] },
		);

		const signalNames = event.sampledSignals?.map((s) => s.name) ?? [];
		expect(signalNames).not.toContain("text:delta");
	});
});

// ============================================================================
// Token Extraction Tests
// ============================================================================

describe("token extraction", () => {
	it("returns undefined when no usage data", () => {
		const signals = [
			createSignal("provider:start", {}),
			createSignal("provider:end", { output: "done" }),
		];

		const events: HarnessEvent[] = [];
		const telemetry = createTelemetrySubscriber({
			emitter: (e) => events.push(e),
		});

		telemetry.emitComplete("run-123", new Date().toISOString(), {
			signals,
			metrics: { durationMs: 50, activations: 1 },
			terminatedEarly: false,
		});

		const event = events[0] as HarnessWideEvent;
		expect(event.tokens).toBeUndefined();
	});

	it("aggregates tokens from multiple provider:end signals", () => {
		const signals = [
			createSignal("provider:end", { usage: { inputTokens: 100, outputTokens: 50 } }),
			createSignal("provider:end", { usage: { inputTokens: 200, outputTokens: 100 } }),
			createSignal("provider:end", { usage: { inputTokens: 50, outputTokens: 25 } }),
		];

		const events: HarnessEvent[] = [];
		const telemetry = createTelemetrySubscriber({
			emitter: (e) => events.push(e),
		});

		telemetry.emitComplete("run-123", new Date().toISOString(), {
			signals,
			metrics: { durationMs: 100, activations: 3 },
			terminatedEarly: false,
		});

		const event = events[0] as HarnessWideEvent;
		expect(event.tokens?.inputTokens).toBe(350);
		expect(event.tokens?.outputTokens).toBe(175);
		expect(event.tokens?.totalTokens).toBe(525);
	});
});
