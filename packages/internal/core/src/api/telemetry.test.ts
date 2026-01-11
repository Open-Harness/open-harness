/**
 * Tests for telemetry wide events.
 *
 * E5: Telemetry (Wide Events)
 */

import { describe, it, expect } from "vitest";
import {
	createTelemetrySubscriber,
	createWideEvent,
	type WorkflowEvent,
	type WorkflowWideEvent,
	type WorkflowStartEvent,
	type WorkflowErrorEvent,
	type TelemetryInput,
} from "./telemetry.js";
import { createSignal } from "@internal/signals-core";

// ============================================================================
// Test Helpers
// ============================================================================

function createTestSignals() {
	return [
		createSignal("workflow:start", { agents: ["analyst", "executor"] }),
		createSignal("agent:activated", { agent: "analyst", trigger: "workflow:start" }),
		createSignal("harness:start", {}),
		createSignal("text:delta", { delta: "Hello" }),
		createSignal("text:delta", { delta: " world" }),
		createSignal("harness:end", {
			output: "Hello world",
			usage: { inputTokens: 10, outputTokens: 5 },
		}),
		createSignal("analysis:complete", { agent: "analyst" }),
		createSignal("agent:activated", { agent: "executor", trigger: "analysis:complete" }),
		createSignal("harness:start", {}),
		createSignal("harness:end", {
			output: "Executed",
			usage: { inputTokens: 20, outputTokens: 10 },
		}),
		createSignal("workflow:end", { durationMs: 100, activations: 2 }),
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
		it("emits workflow.start event", () => {
			const events: WorkflowEvent[] = [];
			const telemetry = createTelemetrySubscriber({
				emitter: (e) => events.push(e),
			});

			telemetry.emitStart("run-123", ["analyst", "executor"]);

			expect(events).toHaveLength(1);
			const event = events[0] as WorkflowStartEvent;
			expect(event.event).toBe("workflow.start");
			expect(event.runId).toBe("run-123");
			expect(event.agents).toEqual(["analyst", "executor"]);
			expect(event.startedAt).toBeDefined();
		});

		it("includes metadata when provided", () => {
			const events: WorkflowEvent[] = [];
			const telemetry = createTelemetrySubscriber({
				emitter: (e) => events.push(e),
				metadata: { env: "test", version: "1.0" },
			});

			telemetry.emitStart("run-123", ["agent"]);

			const event = events[0] as WorkflowStartEvent;
			expect(event.metadata).toEqual({ env: "test", version: "1.0" });
		});

		it("can be disabled via config", () => {
			const events: WorkflowEvent[] = [];
			const telemetry = createTelemetrySubscriber({
				emitter: (e) => events.push(e),
				emitStart: false,
			});

			telemetry.emitStart("run-123", ["agent"]);

			expect(events).toHaveLength(0);
		});
	});

	describe("emitComplete", () => {
		it("emits workflow.complete wide event", () => {
			const events: WorkflowEvent[] = [];
			const telemetry = createTelemetrySubscriber({
				emitter: (e) => events.push(e),
			});

			const startedAt = new Date().toISOString();
			telemetry.emitComplete("run-123", startedAt, createTestResult());

			expect(events).toHaveLength(1);
			const event = events[0] as WorkflowWideEvent;
			expect(event.event).toBe("workflow.complete");
			expect(event.runId).toBe("run-123");
			expect(event.startedAt).toBe(startedAt);
			expect(event.completedAt).toBeDefined();
			expect(event.durationMs).toBe(100);
			expect(event.outcome).toBe("success");
			expect(event.activations).toBe(2);
		});

		it("extracts activated agents from signals", () => {
			const events: WorkflowEvent[] = [];
			const telemetry = createTelemetrySubscriber({
				emitter: (e) => events.push(e),
			});

			telemetry.emitComplete("run-123", new Date().toISOString(), createTestResult());

			const event = events[0] as WorkflowWideEvent;
			expect(event.agentsActivated).toContain("analyst");
			expect(event.agentsActivated).toContain("executor");
		});

		it("extracts token usage from provider signals", () => {
			const events: WorkflowEvent[] = [];
			const telemetry = createTelemetrySubscriber({
				emitter: (e) => events.push(e),
			});

			telemetry.emitComplete("run-123", new Date().toISOString(), createTestResult());

			const event = events[0] as WorkflowWideEvent;
			expect(event.tokens).toBeDefined();
			expect(event.tokens?.inputTokens).toBe(30); // 10 + 20
			expect(event.tokens?.outputTokens).toBe(15); // 5 + 10
			expect(event.tokens?.totalTokens).toBe(45);
		});

		it("sets outcome to terminated when terminatedEarly is true", () => {
			const events: WorkflowEvent[] = [];
			const telemetry = createTelemetrySubscriber({
				emitter: (e) => events.push(e),
			});

			telemetry.emitComplete(
				"run-123",
				new Date().toISOString(),
				createTestResult({ terminatedEarly: true }),
			);

			const event = events[0] as WorkflowWideEvent;
			expect(event.outcome).toBe("terminated");
			expect(event.terminatedEarly).toBe(true);
		});

		it("sets outcome to error when error is present", () => {
			const events: WorkflowEvent[] = [];
			const telemetry = createTelemetrySubscriber({
				emitter: (e) => events.push(e),
			});

			telemetry.emitComplete(
				"run-123",
				new Date().toISOString(),
				createTestResult({ error: new Error("Something went wrong") }),
			);

			const event = events[0] as WorkflowWideEvent;
			expect(event.outcome).toBe("error");
			expect(event.error).toBe("Something went wrong");
		});

		it("sets outcome to timeout for TimeoutError", () => {
			const events: WorkflowEvent[] = [];
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

			const event = events[0] as WorkflowWideEvent;
			expect(event.outcome).toBe("timeout");
		});

		it("includes signal count", () => {
			const events: WorkflowEvent[] = [];
			const telemetry = createTelemetrySubscriber({
				emitter: (e) => events.push(e),
			});

			telemetry.emitComplete("run-123", new Date().toISOString(), createTestResult());

			const event = events[0] as WorkflowWideEvent;
			expect(event.signalCount).toBe(11); // Count from createTestSignals
		});
	});

	describe("emitError", () => {
		it("emits workflow.error event", () => {
			const events: WorkflowEvent[] = [];
			const telemetry = createTelemetrySubscriber({
				emitter: (e) => events.push(e),
			});

			const error = new Error("Startup failed");
			telemetry.emitError("run-123", error, "startup");

			expect(events).toHaveLength(1);
			const event = events[0] as WorkflowErrorEvent;
			expect(event.event).toBe("workflow.error");
			expect(event.runId).toBe("run-123");
			expect(event.error).toBe("Startup failed");
			expect(event.phase).toBe("startup");
			expect(event.stack).toBeDefined();
		});

		it("can be disabled via config", () => {
			const events: WorkflowEvent[] = [];
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
		const events: WorkflowEvent[] = [];
		const telemetry = createTelemetrySubscriber({
			emitter: (e) => events.push(e),
			sampling: { rate: 1.0 }, // 100% rate for testing
		});

		telemetry.emitComplete("run-123", new Date().toISOString(), createTestResult());

		const event = events[0] as WorkflowWideEvent;
		expect(event.sampledSignals).toBeDefined();
		expect(event.sampledSignals!.length).toBeGreaterThan(0);
	});

	it("excludes signals matching neverInclude patterns", () => {
		const events: WorkflowEvent[] = [];
		const telemetry = createTelemetrySubscriber({
			emitter: (e) => events.push(e),
			sampling: {
				rate: 1.0,
				neverInclude: ["text:delta", "harness:*"],
			},
		});

		telemetry.emitComplete("run-123", new Date().toISOString(), createTestResult());

		const event = events[0] as WorkflowWideEvent;
		const signalNames = event.sampledSignals?.map((s) => s.name) ?? [];

		expect(signalNames).not.toContain("text:delta");
		expect(signalNames).not.toContain("harness:start");
		expect(signalNames).not.toContain("harness:end");
	});

	it("always includes signals matching alwaysInclude patterns", () => {
		const events: WorkflowEvent[] = [];
		const telemetry = createTelemetrySubscriber({
			emitter: (e) => events.push(e),
			sampling: {
				rate: 0, // 0% rate, but alwaysInclude should still work
				alwaysInclude: ["workflow:*", "agent:activated"],
			},
		});

		telemetry.emitComplete("run-123", new Date().toISOString(), createTestResult());

		const event = events[0] as WorkflowWideEvent;
		const signalNames = event.sampledSignals?.map((s) => s.name) ?? [];

		expect(signalNames).toContain("workflow:start");
		expect(signalNames).toContain("workflow:end");
		expect(signalNames).toContain("agent:activated");
	});

	it("includes all signals on error when alwaysOnError is true", () => {
		const events: WorkflowEvent[] = [];
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

		const event = events[0] as WorkflowWideEvent;
		expect(event.sampledSignals?.length).toBe(11); // All signals included
	});

	it("respects maxSignals limit", () => {
		const events: WorkflowEvent[] = [];
		const telemetry = createTelemetrySubscriber({
			emitter: (e) => events.push(e),
			sampling: {
				rate: 1.0,
				maxSignals: 5,
			},
		});

		telemetry.emitComplete("run-123", new Date().toISOString(), createTestResult());

		const event = events[0] as WorkflowWideEvent;
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

		expect(event.event).toBe("workflow.complete");
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
			createSignal("harness:start", {}),
			createSignal("harness:end", { output: "done" }),
		];

		const events: WorkflowEvent[] = [];
		const telemetry = createTelemetrySubscriber({
			emitter: (e) => events.push(e),
		});

		telemetry.emitComplete("run-123", new Date().toISOString(), {
			signals,
			metrics: { durationMs: 50, activations: 1 },
			terminatedEarly: false,
		});

		const event = events[0] as WorkflowWideEvent;
		expect(event.tokens).toBeUndefined();
	});

	it("aggregates tokens from multiple harness:end signals", () => {
		const signals = [
			createSignal("harness:end", { usage: { inputTokens: 100, outputTokens: 50 } }),
			createSignal("harness:end", { usage: { inputTokens: 200, outputTokens: 100 } }),
			createSignal("harness:end", { usage: { inputTokens: 50, outputTokens: 25 } }),
		];

		const events: WorkflowEvent[] = [];
		const telemetry = createTelemetrySubscriber({
			emitter: (e) => events.push(e),
		});

		telemetry.emitComplete("run-123", new Date().toISOString(), {
			signals,
			metrics: { durationMs: 100, activations: 3 },
			terminatedEarly: false,
		});

		const event = events[0] as WorkflowWideEvent;
		expect(event.tokens?.inputTokens).toBe(350);
		expect(event.tokens?.outputTokens).toBe(175);
		expect(event.tokens?.totalTokens).toBe(525);
	});
});
