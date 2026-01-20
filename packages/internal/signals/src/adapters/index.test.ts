/**
 * Tests for the adapters index module
 *
 * Validates:
 * - defaultAdapters() returns correct adapters based on options
 * - All exports are correctly wired
 * - Adapter instances work with real signals
 */

import { describe, expect, it } from "bun:test";
import { createSignal } from "@internal/signals-core";
import pino from "pino";
import {
	type CreateAdapterConfig,
	createAdapter,
	type DefaultAdaptersOptions,
	defaultAdapters,
	type LogsAdapterOptions,
	logsAdapter,
	type RendererMap,
	type SignalAdapter,
	type SignalRenderer,
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
			const renderers: RendererMap = {
				test: () => "output",
			};
			const renderer: SignalRenderer = (s) => s.name;
			const terminalOpts: TerminalAdapterOptions = { renderers, showTimestamp: true };
			const logsOpts: LogsAdapterOptions = { logger: pino({ level: "silent" }) };
			const defaultOpts: DefaultAdaptersOptions = {
				renderers,
				logger: pino({ level: "silent" }),
			};
			const createConfig: CreateAdapterConfig = {
				name: "test",
				onSignal: () => {},
			};
			const adapter: SignalAdapter = createAdapter(createConfig);

			expect(terminalOpts).toBeDefined();
			expect(logsOpts).toBeDefined();
			expect(defaultOpts).toBeDefined();
			expect(adapter).toBeDefined();
			expect(renderer).toBeDefined();
		});
	});

	describe("defaultAdapters()", () => {
		it("returns only terminal adapter when no logger provided", () => {
			const renderers: RendererMap = { test: () => "output" };
			const adapters = defaultAdapters({ renderers });

			expect(adapters).toHaveLength(1);
			expect(adapters[0].name).toBe("terminal");
		});

		it("returns terminal and logs adapters when logger provided", () => {
			const renderers: RendererMap = { test: () => "output" };
			const logger = pino({ level: "silent" });
			const adapters = defaultAdapters({ renderers, logger });

			expect(adapters).toHaveLength(2);
			expect(adapters[0].name).toBe("terminal");
			expect(adapters[1].name).toBe("logs");
		});

		it("passes terminal options to terminal adapter", () => {
			const output: string[] = [];
			const renderers: RendererMap = {
				"test:start": () => "Test output",
			};
			const adapters = defaultAdapters({
				renderers,
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
			const renderers: RendererMap = { test: () => "output" };

			const adapters = defaultAdapters({
				renderers,
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
			const renderers: RendererMap = { test: () => "output" };
			const logger = pino({ level: "silent" });
			const adapters = defaultAdapters({ renderers, logger });

			for (const adapter of adapters) {
				expect(adapter.patterns).toContain("**");
			}
		});
	});

	describe("integration - adapters process signals", () => {
		it("terminal adapter renders signals with matching renderer", () => {
			const output: string[] = [];
			const renderers: RendererMap = {
				"task:complete": (s) => `Task ${(s.payload as { taskId: string }).taskId} done`,
			};
			const adapter = terminalAdapter({
				renderers,
				write: (text: string) => output.push(text),
				colors: false,
			});

			const signal = createSignal("task:complete", { taskId: "123" });
			adapter.onSignal(signal);

			expect(output.length).toBe(1);
			expect(output[0]).toContain("Task 123 done");
		});

		it("terminal adapter skips signals without renderer", () => {
			const output: string[] = [];
			const renderers: RendererMap = {
				"task:complete": () => "Done",
			};
			const adapter = terminalAdapter({
				renderers,
				write: (text: string) => output.push(text),
				colors: false,
			});

			const signal = createSignal("unknown:signal", { taskId: "123" });
			adapter.onSignal(signal);

			// No output for signals without renderer
			expect(output.length).toBe(0);
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
				onSignal: (signal) => {
					received.push(signal);
				},
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

			const renderers: RendererMap = {
				"plan:created": (s) => `Plan with ${(s.payload as { tasks: number }).tasks} tasks`,
			};

			const adapters = defaultAdapters({
				renderers,
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

			// Verify terminal output contains rendered string
			expect(terminalOutput[0]).toContain("Plan with 5 tasks");

			// Verify log contains structured signal data
			const lastLog = logMessages[logMessages.length - 1] as Record<string, unknown>;
			expect(lastLog.signalName).toBe("plan:created");
		});
	});

	describe("adapter configuration", () => {
		it("terminal adapter has correct name", () => {
			const renderers: RendererMap = {};
			const adapter = terminalAdapter({ renderers });

			expect(adapter.name).toBe("terminal");
		});

		it("logs adapter has lifecycle methods", () => {
			const logger = pino({ level: "silent" });
			const adapter = logsAdapter({ logger });

			// Logs adapter has lifecycle methods for logging start/stop
			expect(adapter.onStart).toBeDefined();
			expect(adapter.onStop).toBeDefined();
		});

		it("defaultAdapters can be called with optional lifecycle methods", async () => {
			const renderers: RendererMap = {};
			const logger = pino({ level: "silent" });
			const adapters = defaultAdapters({ renderers, logger });

			// All adapters support optional lifecycle via ?.
			for (const adapter of adapters) {
				await adapter.onStart?.();
				await adapter.onStop?.();
			}
			// No error should be thrown
			expect(true).toBe(true);
		});
	});
});
