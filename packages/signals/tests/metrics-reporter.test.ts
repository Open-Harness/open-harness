/**
 * Tests for MetricsSignalReporter
 */

import { describe, expect, it, mock } from "bun:test";
import { createSignal } from "@signals/core";
import { SignalBus } from "../src/bus.js";
import { createMetricsReporter } from "../src/metrics-reporter.js";
import { attachReporter } from "../src/reporter.js";

describe("MetricsSignalReporter", () => {
	describe("createMetricsReporter", () => {
		it("initializes with zero metrics", () => {
			const reporter = createMetricsReporter();
			const metrics = reporter.getMetrics();

			expect(metrics.totalInputTokens).toBe(0);
			expect(metrics.totalOutputTokens).toBe(0);
			expect(metrics.totalCost).toBe(0);
			expect(metrics.providerCalls).toBe(0);
			expect(metrics.agentActivations).toBe(0);
			expect(metrics.durationMs).toBe(0);
		});

		it("tracks harness:start timestamp", () => {
			const bus = new SignalBus();
			const reporter = createMetricsReporter();
			attachReporter(bus, reporter);

			const signal = createSignal("harness:start", { input: "test" });
			bus.emit(signal);

			const metrics = reporter.getMetrics();
			expect(metrics.startedAt).toBe(signal.timestamp);
		});

		it("tracks harness:end timestamp and duration", () => {
			const bus = new SignalBus();
			const reporter = createMetricsReporter();
			attachReporter(bus, reporter);

			const signal = createSignal("harness:end", { durationMs: 1234 });
			bus.emit(signal);

			const metrics = reporter.getMetrics();
			expect(metrics.endedAt).toBe(signal.timestamp);
			expect(metrics.durationMs).toBe(1234);
		});

		it("counts provider calls", () => {
			const bus = new SignalBus();
			const reporter = createMetricsReporter();
			attachReporter(bus, reporter);

			bus.emit(createSignal("provider:end", {}));
			bus.emit(createSignal("provider:end", {}));
			bus.emit(createSignal("provider:end", {}));

			const metrics = reporter.getMetrics();
			expect(metrics.providerCalls).toBe(3);
		});

		it("aggregates token usage from provider:end", () => {
			const bus = new SignalBus();
			const reporter = createMetricsReporter();
			attachReporter(bus, reporter);

			bus.emit(
				createSignal("provider:end", {
					usage: { inputTokens: 100, outputTokens: 50 },
				}),
			);
			bus.emit(
				createSignal("provider:end", {
					usage: { inputTokens: 200, outputTokens: 75 },
				}),
			);

			const metrics = reporter.getMetrics();
			expect(metrics.totalInputTokens).toBe(300);
			expect(metrics.totalOutputTokens).toBe(125);
		});

		it("aggregates cost from provider:end", () => {
			const bus = new SignalBus();
			const reporter = createMetricsReporter();
			attachReporter(bus, reporter);

			bus.emit(createSignal("provider:end", { cost: 0.01 }));
			bus.emit(createSignal("provider:end", { cost: 0.005 }));

			const metrics = reporter.getMetrics();
			expect(metrics.totalCost).toBeCloseTo(0.015);
		});

		it("counts agent activations", () => {
			const bus = new SignalBus();
			const reporter = createMetricsReporter();
			attachReporter(bus, reporter);

			bus.emit(createSignal("agent:activated", { agent: "analyst" }));
			bus.emit(createSignal("agent:activated", { agent: "trader" }));
			bus.emit(createSignal("agent:activated", { agent: "analyst" }));

			const metrics = reporter.getMetrics();
			expect(metrics.agentActivations).toBe(3);
			expect(metrics.agentCounts).toEqual({
				analyst: 2,
				trader: 1,
			});
		});

		it("handles missing usage data gracefully", () => {
			const bus = new SignalBus();
			const reporter = createMetricsReporter();
			attachReporter(bus, reporter);

			bus.emit(createSignal("provider:end", {}));
			bus.emit(createSignal("provider:end", { usage: {} }));
			bus.emit(createSignal("provider:end", { usage: { inputTokens: 50 } }));

			const metrics = reporter.getMetrics();
			expect(metrics.totalInputTokens).toBe(50);
			expect(metrics.totalOutputTokens).toBe(0);
		});

		it("calls onUpdate callback when metrics change", () => {
			const onUpdate = mock(() => {});
			const reporter = createMetricsReporter({ onUpdate });

			const bus = new SignalBus();
			attachReporter(bus, reporter);

			bus.emit(createSignal("harness:start", {}));
			bus.emit(createSignal("provider:end", { usage: { inputTokens: 100 } }));
			bus.emit(createSignal("harness:end", { durationMs: 500 }));

			expect(onUpdate).toHaveBeenCalledTimes(3);
		});

		it("reset() clears all metrics", () => {
			const bus = new SignalBus();
			const reporter = createMetricsReporter();
			attachReporter(bus, reporter);

			bus.emit(createSignal("provider:end", { usage: { inputTokens: 100 } }));
			bus.emit(createSignal("agent:activated", { agent: "test" }));

			expect(reporter.getMetrics().providerCalls).toBe(1);

			reporter.reset();

			const metrics = reporter.getMetrics();
			expect(metrics.totalInputTokens).toBe(0);
			expect(metrics.providerCalls).toBe(0);
			expect(metrics.agentActivations).toBe(0);
			expect(metrics.agentCounts).toEqual({});
		});

		it("returns a copy of metrics (immutable)", () => {
			const reporter = createMetricsReporter();
			const bus = new SignalBus();
			attachReporter(bus, reporter);

			bus.emit(createSignal("agent:activated", { agent: "test" }));

			const metrics1 = reporter.getMetrics();
			const metrics2 = reporter.getMetrics();

			// Modify the returned object
			metrics1.agentCounts.test = 999;

			// Original should be unchanged
			expect(metrics2.agentCounts.test).toBe(1);
		});
	});
});
