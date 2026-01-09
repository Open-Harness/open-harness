/**
 * Tests for ConsoleSignalReporter
 */

import { describe, expect, it, mock } from "bun:test";
import { createSignal } from "@signals/core";
import { SignalBus } from "../src/bus.js";
import { createConsoleReporter, defaultConsoleReporter } from "../src/console-reporter.js";
import { attachReporter } from "../src/reporter.js";

describe("ConsoleSignalReporter", () => {
	describe("createConsoleReporter", () => {
		it("logs signal names with default prefix", () => {
			const logs: string[] = [];
			const reporter = createConsoleReporter({
				log: (msg) => logs.push(msg),
			});

			const bus = new SignalBus();
			attachReporter(bus, reporter);

			bus.emit(createSignal("test:signal", {}));

			expect(logs).toHaveLength(1);
			expect(logs[0]).toContain("[signal]");
			expect(logs[0]).toContain("test:signal");
		});

		it("uses custom prefix", () => {
			const logs: string[] = [];
			const reporter = createConsoleReporter({
				prefix: "[custom]",
				log: (msg) => logs.push(msg),
			});

			const bus = new SignalBus();
			attachReporter(bus, reporter);

			bus.emit(createSignal("test", {}));

			expect(logs[0]).toContain("[custom]");
		});

		it("includes payload in verbose mode", () => {
			const logs: string[] = [];
			const reporter = createConsoleReporter({
				verbose: true,
				log: (msg) => logs.push(msg),
			});

			const bus = new SignalBus();
			attachReporter(bus, reporter);

			bus.emit(createSignal("test", { key: "value" }));

			// logs[0] is the attach message, logs[1] is the signal
			expect(logs[1]).toContain("→");
			expect(logs[1]).toContain("key");
			expect(logs[1]).toContain("value");
		});

		it("includes timestamp when showTimestamp is true", () => {
			const logs: string[] = [];
			const reporter = createConsoleReporter({
				showTimestamp: true,
				log: (msg) => logs.push(msg),
			});

			const bus = new SignalBus();
			attachReporter(bus, reporter);

			const signal = createSignal("test", {});
			bus.emit(signal);

			expect(logs[0]).toContain(signal.timestamp);
		});

		it("includes runId when provided in context", () => {
			const logs: string[] = [];
			const reporter = createConsoleReporter({
				log: (msg) => logs.push(msg),
			});

			const bus = new SignalBus();
			attachReporter(bus, reporter, { runId: "abc12345-long-id" });

			bus.emit(createSignal("test", {}));

			// Should include first 8 characters of run ID
			expect(logs[0]).toContain("[abc12345]");
		});

		it("respects pattern filters", () => {
			const logs: string[] = [];
			const reporter = createConsoleReporter({
				patterns: ["provider:*"],
				log: (msg) => logs.push(msg),
			});

			const bus = new SignalBus();
			attachReporter(bus, reporter);

			bus.emit(createSignal("provider:start", {}));
			bus.emit(createSignal("agent:activated", {}));
			bus.emit(createSignal("provider:end", {}));

			expect(logs).toHaveLength(2);
			expect(logs[0]).toContain("provider:start");
			expect(logs[1]).toContain("provider:end");
		});

		it("truncates long payloads", () => {
			const logs: string[] = [];
			const reporter = createConsoleReporter({
				verbose: true,
				log: (msg) => logs.push(msg),
			});

			const bus = new SignalBus();
			attachReporter(bus, reporter);

			const longPayload = { data: "a".repeat(200) };
			bus.emit(createSignal("test", longPayload));

			// logs[0] is the attach message, logs[1] is the signal
			expect(logs[1]).toContain("...");
			expect(logs[1].length).toBeLessThan(200);
		});

		it("handles non-serializable payloads", () => {
			const logs: string[] = [];
			const reporter = createConsoleReporter({
				verbose: true,
				log: (msg) => logs.push(msg),
			});

			const bus = new SignalBus();
			attachReporter(bus, reporter);

			// Create circular reference
			const circular: Record<string, unknown> = {};
			circular.self = circular;

			bus.emit(createSignal("test", circular));

			// logs[0] is the attach message, logs[1] is the signal
			expect(logs[1]).toContain("[non-serializable payload]");
		});

		it("logs attach/detach in verbose mode", () => {
			const logs: string[] = [];
			const reporter = createConsoleReporter({
				verbose: true,
				log: (msg) => logs.push(msg),
			});

			const bus = new SignalBus();
			const detach = attachReporter(bus, reporter);

			expect(logs[0]).toContain("attached");

			detach();

			expect(logs[1]).toContain("detached");
		});
	});

	describe("defaultConsoleReporter", () => {
		it("has correct default patterns", () => {
			expect(defaultConsoleReporter.patterns).toEqual(["harness:*", "provider:*", "agent:activated"]);
		});

		it("has name 'console'", () => {
			expect(defaultConsoleReporter.name).toBe("console");
		});
	});
});
