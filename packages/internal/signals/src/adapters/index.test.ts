/**
 * Tests for the adapters index module
 *
 * Validates:
 * - defaultAdapters() returns correct adapters based on options
 * - All exports are correctly wired
 * - Adapter instances work with real signals
 */

import { createSignal } from "@internal/signals-core";
import pino from "pino";
import { describe, expect, it } from "vitest";
import {
	type CreateAdapterConfig,
	createAdapter,
	type DefaultAdaptersOptions,
	defaultAdapters,
	type LogsAdapterOptions,
	logsAdapter,
	type SignalAdapter,
	type TerminalAdapterOptions,
	terminalAdapter,
} from "./index.js";

describe("adapters/index", () => {
	describe("exports", () => {
		it("exports terminalAdapter function", () => {
			expect(terminalAdapter).toBeDefined();
			expect(typeof terminalAdapter).toBe("function");
		});

		it("exports logsAdapter function", () => {
			expect(logsAdapter).toBeDefined();
			expect(typeof logsAdapter).toBe("function");
		});

		it("exports createAdapter function", () => {
			expect(createAdapter).toBeDefined();
			expect(typeof createAdapter).toBe("function");
		});

		it("exports defaultAdapters function", () => {
			expect(defaultAdapters).toBeDefined();
			expect(typeof defaultAdapters).toBe("function");
		});

		it("exports types correctly (type inference test)", () => {
			// These are compile-time type checks - if they compile, types are exported correctly
			const terminalOpts: TerminalAdapterOptions = { showTimestamp: true };
			const logsOpts: LogsAdapterOptions = { logger: pino({ level: "silent" }) };
			const defaultOpts: DefaultAdaptersOptions = { logger: pino({ level: "silent" }) };
			const createConfig: CreateAdapterConfig = {
				name: "test",
				onSignal: () => {},
			};
			const adapter: SignalAdapter = createAdapter(createConfig);

			expect(terminalOpts).toBeDefined();
			expect(logsOpts).toBeDefined();
			expect(defaultOpts).toBeDefined();
			expect(adapter).toBeDefined();
		});
	});

	describe("defaultAdapters()", () => {
		it("returns only terminal adapter when no logger provided", () => {
			const adapters = defaultAdapters({});

			expect(adapters).toHaveLength(1);
			expect(adapters[0].name).toBe("terminal");
		});

		it("returns only terminal adapter with empty options", () => {
			const adapters = defaultAdapters();

			expect(adapters).toHaveLength(1);
			expect(adapters[0].name).toBe("terminal");
		});

		it("returns terminal and logs adapters when logger provided", () => {
			const logger = pino({ level: "silent" });
			const adapters = defaultAdapters({ logger });

			expect(adapters).toHaveLength(2);
			expect(adapters[0].name).toBe("terminal");
			expect(adapters[1].name).toBe("logs");
		});

		it("passes terminal options to terminal adapter", () => {
			const output: string[] = [];
			const adapters = defaultAdapters({
				terminal: {
					write: (text: string) => output.push(text),
					showTimestamp: true,
					colors: false,
				},
			});

			expect(adapters).toHaveLength(1);

			// Process a signal and verify the adapter works
			const signal = createSignal("test:start", { message: "hello" });
			adapters[0].onSignal(signal);

			expect(output.length).toBeGreaterThan(0);
			// Timestamp format appears in output when showTimestamp is true
			expect(output[0]).toMatch(/\[\d/); // [time] format
		});

		it("passes logs options to logs adapter", () => {
			const logMessages: unknown[] = [];
			const logger = pino(
				{ level: "trace" },
				{
					write: (msg: string) => {
						logMessages.push(JSON.parse(msg));
					},
				},
			);

			const adapters = defaultAdapters({
				logger,
				logs: { includePayload: false },
			});

			expect(adapters).toHaveLength(2);

			// Process a signal and verify payload is not included
			const signal = createSignal("test:event", { secret: "data" });
			adapters[1].onSignal(signal);

			expect(logMessages.length).toBeGreaterThan(0);
			// When includePayload is false, payload should not be in log
			const lastLog = logMessages[logMessages.length - 1] as Record<string, unknown>;
			expect(lastLog.payload).toBeUndefined();
		});

		it("returns adapters that subscribe to all signals by default", () => {
			const logger = pino({ level: "silent" });
			const adapters = defaultAdapters({ logger });

			for (const adapter of adapters) {
				expect(adapter.patterns).toContain("*");
			}
		});
	});

	describe("integration - adapters process signals", () => {
		it("terminal adapter processes real signals", () => {
			const output: string[] = [];
			const adapter = terminalAdapter({
				write: (text: string) => output.push(text),
				colors: false,
			});

			const signal = createSignal("task:complete", { taskId: "123" });
			adapter.onSignal(signal);

			expect(output.length).toBe(1);
			expect(output[0]).toContain("task:complete");
		});

		it("logs adapter processes real signals", () => {
			const logMessages: unknown[] = [];
			const logger = pino(
				{ level: "trace" },
				{
					write: (msg: string) => {
						logMessages.push(JSON.parse(msg));
					},
				},
			);

			const adapter = logsAdapter({ logger });
			const signal = createSignal("workflow:start", { workflowId: "wf-1" });
			adapter.onSignal(signal);

			expect(logMessages.length).toBeGreaterThan(0);
			const lastLog = logMessages[logMessages.length - 1] as Record<string, unknown>;
			expect(lastLog.signalName).toBe("workflow:start");
		});

		it("custom adapter via createAdapter processes signals", () => {
			const received: unknown[] = [];
			const adapter = createAdapter({
				name: "test-adapter",
				onSignal: (signal) => received.push(signal),
			});

			const signal = createSignal("custom:event", { data: "test" });
			adapter.onSignal(signal);

			expect(received).toHaveLength(1);
			expect(received[0]).toBe(signal);
		});

		it("defaultAdapters work together on the same signal", () => {
			const terminalOutput: string[] = [];
			const logMessages: unknown[] = [];
			const logger = pino(
				{ level: "trace" },
				{
					write: (msg: string) => {
						logMessages.push(JSON.parse(msg));
					},
				},
			);

			const adapters = defaultAdapters({
				logger,
				terminal: {
					write: (text: string) => terminalOutput.push(text),
					colors: false,
				},
			});

			const signal = createSignal("plan:created", { tasks: 5 });

			// Both adapters process the same signal
			for (const adapter of adapters) {
				adapter.onSignal(signal);
			}

			// Both should have received the signal
			expect(terminalOutput.length).toBeGreaterThan(0);
			expect(logMessages.length).toBeGreaterThan(0);

			// Verify terminal output contains signal info
			expect(terminalOutput[0]).toContain("plan:created");

			// Verify log contains structured signal data
			const lastLog = logMessages[logMessages.length - 1] as Record<string, unknown>;
			expect(lastLog.signalName).toBe("plan:created");
		});
	});

	describe("lifecycle methods", () => {
		it("terminal adapter has lifecycle methods", () => {
			const adapter = terminalAdapter();

			expect(adapter.onStart).toBeDefined();
			expect(adapter.onStop).toBeDefined();
		});

		it("logs adapter has lifecycle methods", () => {
			const logger = pino({ level: "silent" });
			const adapter = logsAdapter({ logger });

			expect(adapter.onStart).toBeDefined();
			expect(adapter.onStop).toBeDefined();
		});

		it("defaultAdapters all have lifecycle methods", () => {
			const logger = pino({ level: "silent" });
			const adapters = defaultAdapters({ logger });

			for (const adapter of adapters) {
				expect(adapter.onStart).toBeDefined();
				expect(adapter.onStop).toBeDefined();
			}
		});
	});
});
