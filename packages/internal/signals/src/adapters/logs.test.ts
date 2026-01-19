/**
 * Tests for logs adapter
 *
 * Uses real Pino logger instances per MUST-001 constitution compliance.
 * Creates in-memory logger streams to capture and verify output.
 */

import { beforeEach, describe, expect, it } from "bun:test";
import { createSignal } from "@internal/signals-core";
import pino, { type Logger } from "pino";
import { logsAdapter } from "./logs.js";

describe("logsAdapter", () => {
	// Capture log output for testing
	let logOutput: string[];
	let testLogger: Logger;

	/**
	 * Create a test logger that captures output to an array
	 * Uses pino's destination API for real structured logging
	 */
	function createTestLogger(level: pino.Level = "trace"): Logger {
		// Create a destination that writes to our array
		const destination = {
			write: (msg: string) => {
				logOutput.push(msg);
			},
		};

		return pino(
			{
				level,
				timestamp: pino.stdTimeFunctions.isoTime,
			},
			destination,
		);
	}

	/**
	 * Parse the last log entry as JSON
	 */
	function getLastLogEntry(): Record<string, unknown> {
		if (logOutput.length === 0) {
			throw new Error("No log entries captured");
		}
		return JSON.parse(logOutput[logOutput.length - 1]) as Record<string, unknown>;
	}

	/**
	 * Get all log entries as parsed JSON
	 */
	function getAllLogEntries(): Record<string, unknown>[] {
		return logOutput.map((line) => JSON.parse(line) as Record<string, unknown>);
	}

	beforeEach(() => {
		logOutput = [];
		testLogger = createTestLogger();
	});

	describe("basic signal logging", () => {
		it("logs signal with name and id", () => {
			const adapter = logsAdapter({ logger: testLogger });
			const signal = createSignal("test:signal", { data: "hello" });

			adapter.onSignal(signal);

			const entry = getLastLogEntry();
			expect(entry.signalName).toBe("test:signal");
			expect(entry.signalId).toBe(signal.id);
			expect(entry.msg).toBe("signal: test:signal");
		});

		it("includes signal timestamp", () => {
			const adapter = logsAdapter({ logger: testLogger });
			const signal = createSignal("test:signal", {});

			adapter.onSignal(signal);

			const entry = getLastLogEntry();
			expect(entry.signalTimestamp).toBe(signal.timestamp);
		});

		it("includes payload by default", () => {
			const adapter = logsAdapter({ logger: testLogger });
			const signal = createSignal("test:signal", { key: "value", count: 42 });

			adapter.onSignal(signal);

			const entry = getLastLogEntry();
			expect(entry.payload).toEqual({ key: "value", count: 42 });
		});

		it("omits payload when includePayload is false", () => {
			const adapter = logsAdapter({ logger: testLogger, includePayload: false });
			const signal = createSignal("test:signal", { sensitive: "data" });

			adapter.onSignal(signal);

			const entry = getLastLogEntry();
			expect(entry.payload).toBeUndefined();
		});

		it("includes source when present", () => {
			const adapter = logsAdapter({ logger: testLogger });
			const signal = createSignal("test:signal", {}, { agent: "test-agent", parent: "parent-id" });

			adapter.onSignal(signal);

			const entry = getLastLogEntry();
			expect(entry.source).toEqual({ agent: "test-agent", parent: "parent-id" });
		});
	});

	describe("log level mapping from signal names", () => {
		it("uses error level for *:error signals", () => {
			const adapter = logsAdapter({ logger: testLogger });
			const signal = createSignal("task:error", { message: "something failed" });

			adapter.onSignal(signal);

			const entry = getLastLogEntry();
			expect(entry.level).toBe(50); // Pino error level
		});

		it("uses warn level for *:fail signals", () => {
			const adapter = logsAdapter({ logger: testLogger });
			const signal = createSignal("connection:fail", {});

			adapter.onSignal(signal);

			const entry = getLastLogEntry();
			expect(entry.level).toBe(40); // Pino warn level
		});

		it("uses info level for *:complete signals", () => {
			const adapter = logsAdapter({ logger: testLogger });
			const signal = createSignal("task:complete", {});

			adapter.onSignal(signal);

			const entry = getLastLogEntry();
			expect(entry.level).toBe(30); // Pino info level
		});

		it("uses info level for *:done signals", () => {
			const adapter = logsAdapter({ logger: testLogger });
			const signal = createSignal("task:done", {});

			adapter.onSignal(signal);

			const entry = getLastLogEntry();
			expect(entry.level).toBe(30); // Pino info level
		});

		it("uses info level for workflow:* signals", () => {
			const adapter = logsAdapter({ logger: testLogger });
			const signal = createSignal("workflow:start", {});

			adapter.onSignal(signal);

			const entry = getLastLogEntry();
			expect(entry.level).toBe(30); // Pino info level
		});

		it("uses trace level for *:delta signals", () => {
			const adapter = logsAdapter({ logger: testLogger });
			const signal = createSignal("text:delta", "chunk");

			adapter.onSignal(signal);

			const entry = getLastLogEntry();
			expect(entry.level).toBe(10); // Pino trace level
		});

		it("uses debug level for tool:* signals", () => {
			const adapter = logsAdapter({ logger: testLogger });
			const signal = createSignal("tool:call", { name: "bash" });

			adapter.onSignal(signal);

			const entry = getLastLogEntry();
			expect(entry.level).toBe(20); // Pino debug level
		});

		it("uses debug level for unknown signal patterns", () => {
			const adapter = logsAdapter({ logger: testLogger });
			const signal = createSignal("custom:something", {});

			adapter.onSignal(signal);

			const entry = getLastLogEntry();
			expect(entry.level).toBe(20); // Pino debug level (default)
		});
	});

	describe("lifecycle methods", () => {
		it("logs adapter start on onStart", () => {
			const adapter = logsAdapter({ logger: testLogger });

			adapter.onStart?.();

			const entry = getLastLogEntry();
			expect(entry.adapter).toBe("logs");
			expect(entry.msg).toContain("started");
		});

		it("logs adapter stop on onStop", () => {
			const adapter = logsAdapter({ logger: testLogger });

			adapter.onStop?.();

			const entry = getLastLogEntry();
			expect(entry.adapter).toBe("logs");
			expect(entry.msg).toContain("stopped");
		});

		it("has correct adapter name", () => {
			const adapter = logsAdapter({ logger: testLogger });

			expect(adapter.name).toBe("logs");
		});

		it("uses default patterns", () => {
			const adapter = logsAdapter({ logger: testLogger });

			expect(adapter.patterns).toEqual(["**"]);
		});

		it("accepts custom patterns", () => {
			const adapter = logsAdapter({ logger: testLogger, patterns: ["task:*", "plan:*"] });

			expect(adapter.patterns).toEqual(["task:*", "plan:*"]);
		});
	});

	describe("logger filtering", () => {
		it("respects logger level filtering", () => {
			// Create logger that only shows info and above
			const infoLogger = createTestLogger("info");
			const adapter = logsAdapter({ logger: infoLogger });

			// This should be logged (info level)
			adapter.onSignal(createSignal("task:complete", {}));

			// This should NOT be logged (debug level, below info)
			adapter.onSignal(createSignal("custom:debug", {}));

			// This should NOT be logged (trace level, below info)
			adapter.onSignal(createSignal("text:delta", "chunk"));

			// Only the info-level signal should appear
			const entries = getAllLogEntries();
			expect(entries).toHaveLength(1);
			expect(entries[0].signalName).toBe("task:complete");
		});
	});

	describe("full workflow simulation", () => {
		it("logs complete workflow sequence with appropriate levels", async () => {
			const adapter = logsAdapter({ logger: testLogger });

			await adapter.onStart?.();

			// Workflow start (info)
			adapter.onSignal(createSignal("workflow:start", { id: "wf-001" }));

			// Plan creation (info - *:complete pattern)
			adapter.onSignal(createSignal("plan:complete", { taskCount: 3 }));

			// Tool call (debug)
			adapter.onSignal(createSignal("tool:call", { name: "bash", args: ["ls"] }));

			// Task progress (debug - no special pattern)
			adapter.onSignal(createSignal("task:progress", { current: 1, total: 3 }));

			// Task complete (info)
			adapter.onSignal(createSignal("task:complete", { taskId: "T-001" }));

			// Task error (error)
			adapter.onSignal(createSignal("task:error", { taskId: "T-002", message: "failed" }));

			// Streaming delta (trace)
			adapter.onSignal(createSignal("text:delta", "chunk"));

			// Workflow complete (info)
			adapter.onSignal(createSignal("workflow:complete", { success: false }));

			await adapter.onStop?.();

			// Get all signal logs (excluding start/stop)
			const entries = getAllLogEntries().filter((e) => e.signalName !== undefined);

			expect(entries).toHaveLength(8);

			// Verify levels
			expect(entries[0].level).toBe(30); // workflow:start -> info
			expect(entries[1].level).toBe(30); // plan:complete -> info
			expect(entries[2].level).toBe(20); // tool:call -> debug
			expect(entries[3].level).toBe(20); // task:progress -> debug
			expect(entries[4].level).toBe(30); // task:complete -> info
			expect(entries[5].level).toBe(50); // task:error -> error
			expect(entries[6].level).toBe(10); // text:delta -> trace
			expect(entries[7].level).toBe(30); // workflow:complete -> info
		});
	});

	describe("edge cases", () => {
		it("handles undefined payload", () => {
			const adapter = logsAdapter({ logger: testLogger });
			const signal = createSignal("test:signal", undefined);

			adapter.onSignal(signal);

			const entry = getLastLogEntry();
			expect(entry.payload).toBeUndefined();
		});

		it("handles null payload", () => {
			const adapter = logsAdapter({ logger: testLogger });
			const signal = createSignal("test:signal", null);

			adapter.onSignal(signal);

			const entry = getLastLogEntry();
			expect(entry.payload).toBeNull();
		});

		it("handles complex nested payload", () => {
			const adapter = logsAdapter({ logger: testLogger });
			const complexPayload = {
				nested: {
					deep: {
						value: [1, 2, 3],
					},
				},
				array: ["a", "b"],
			};
			const signal = createSignal("test:signal", complexPayload);

			adapter.onSignal(signal);

			const entry = getLastLogEntry();
			expect(entry.payload).toEqual(complexPayload);
		});

		it("signals are pure data without display metadata", () => {
			const adapter = logsAdapter({ logger: testLogger });
			const signal = createSignal("test:signal", {});

			adapter.onSignal(signal);

			const entry = getLastLogEntry();
			// Signals are pure data - no display property
			expect(entry.display).toBeUndefined();
		});
	});
});
