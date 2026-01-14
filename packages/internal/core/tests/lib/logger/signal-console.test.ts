import { describe, expect, test } from "bun:test";
import { createSignal } from "@internal/signals-core";
import { createSignalConsole } from "../../../src/lib/logger/signal-console.js";

describe("signal-console", () => {
	describe("format", () => {
		test("formats timestamp as HH:MM:SS", () => {
			const output: string[] = [];
			const signalConsole = createSignalConsole({
				colors: false,
				output: (msg) => output.push(msg),
			});

			const signal = createSignal("workflow:start", {});
			const testSignal = {
				...signal,
				timestamp: "2024-01-15T05:59:18.000Z",
			};

			signalConsole(testSignal);

			expect(output[0]).toMatch(/^\d{2}:\d{2}:\d{2} workflow:start$/);
		});

		test("formats workflow signals with duration", () => {
			const output: string[] = [];
			const signalConsole = createSignalConsole({
				colors: false,
				output: (msg) => output.push(msg),
			});

			signalConsole(createSignal("workflow:start", {}));
			signalConsole(createSignal("workflow:end", { durationMs: 35 }));

			expect(output.length).toBe(2);
			expect(output[0]).toMatch(/^\d{2}:\d{2}:\d{2} workflow:start$/);
			expect(output[1]).toMatch(/^\d{2}:\d{2}:\d{2} workflow:end 35ms$/);
		});

		test("formats harness signals with duration", () => {
			const output: string[] = [];
			const signalConsole = createSignalConsole({
				colors: false,
				output: (msg) => output.push(msg),
			});

			signalConsole(createSignal("harness:start", {}));
			signalConsole(createSignal("harness:end", { durationMs: 100 }));

			expect(output.length).toBe(2);
			expect(output[0]).toMatch(/^\d{2}:\d{2}:\d{2} harness:start$/);
			expect(output[1]).toMatch(/^\d{2}:\d{2}:\d{2} harness:end 100ms$/);
		});

		test("formats agent:activated with source", () => {
			const output: string[] = [];
			const signalConsole = createSignalConsole({
				colors: false,
				output: (msg) => output.push(msg),
			});

			const signal = createSignal("agent:activated", { trigger: "workflow:start" }, { agent: "analyzer" });
			signalConsole(signal);

			expect(output.length).toBe(1);
			expect(output[0]).toMatch(/agent:activated \[analyzer\]$/);
		});

		test("formats tool:call with name and truncated input", () => {
			const output: string[] = [];
			const signalConsole = createSignalConsole({
				colors: false,
				level: "normal",
				output: (msg) => output.push(msg),
			});

			signalConsole(
				createSignal("tool:call", {
					name: "web_search",
					input: { query: "test query" },
				})
			);

			expect(output.length).toBe(1);
			expect(output[0]).toMatch(/tool:call web_search\(/);
			expect(output[0]).toContain("test query");
		});

		test("formats tool:result with truncated result", () => {
			const output: string[] = [];
			const signalConsole = createSignalConsole({
				colors: false,
				level: "normal",
				output: (msg) => output.push(msg),
			});

			signalConsole(
				createSignal("tool:result", {
					result: "Search results found 5 items",
				})
			);

			expect(output.length).toBe(1);
			expect(output[0]).toMatch(/tool:result "Search results/);
		});

		test("formats tool:result error", () => {
			const output: string[] = [];
			const signalConsole = createSignalConsole({
				colors: false,
				level: "normal",
				output: (msg) => output.push(msg),
			});

			signalConsole(
				createSignal("tool:result", {
					error: "Tool failed",
				})
			);

			expect(output.length).toBe(1);
			expect(output[0]).toMatch(/tool:result error: Tool failed/);
		});

		test("formats text:complete with truncated content", () => {
			const output: string[] = [];
			const signalConsole = createSignalConsole({
				colors: false,
				level: "normal",
				output: (msg) => output.push(msg),
			});

			signalConsole(
				createSignal("text:complete", {
					content: "This is the agent response that could be very long",
				})
			);

			expect(output.length).toBe(1);
			expect(output[0]).toMatch(/text:complete "This is the agent response/);
		});

		test("does not include runId in output", () => {
			const output: string[] = [];
			const signalConsole = createSignalConsole({
				colors: false,
				output: (msg) => output.push(msg),
			});

			signalConsole(createSignal("workflow:start", { runId: "abc123" }));

			expect(output.length).toBe(1);
			expect(output[0]).not.toContain("runId");
			expect(output[0]).not.toContain("abc123");
		});
	});

	describe("truncation", () => {
		test("truncates long tool inputs at normal level", () => {
			const output: string[] = [];
			const signalConsole = createSignalConsole({
				colors: false,
				level: "normal",
				output: (msg) => output.push(msg),
			});

			const longInput = { query: "a".repeat(100) };
			signalConsole(
				createSignal("tool:call", {
					name: "search",
					input: longInput,
				})
			);

			expect(output.length).toBe(1);
			expect(output[0]).toContain("...");
			expect(output[0].length).toBeLessThan(150);
		});

		test("truncates multiline text:complete showing line count", () => {
			const output: string[] = [];
			const signalConsole = createSignalConsole({
				colors: false,
				level: "normal",
				output: (msg) => output.push(msg),
			});

			const multiline = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5";
			signalConsole(
				createSignal("text:complete", {
					content: multiline,
				})
			);

			expect(output.length).toBe(1);
			expect(output[0]).toContain("(5 lines)");
		});

		test("shows full content at verbose level", () => {
			const output: string[] = [];
			const signalConsole = createSignalConsole({
				colors: false,
				level: "verbose",
				output: (msg) => output.push(msg),
			});

			const longResult = "a".repeat(200);
			signalConsole(
				createSignal("tool:result", {
					result: longResult,
				})
			);

			expect(output.length).toBe(1);
			expect(output[0]).toContain(longResult);
			expect(output[0]).not.toContain("...");
		});
	});

	describe("quiet level", () => {
		test("shows only workflow:start and workflow:end", () => {
			const output: string[] = [];
			const signalConsole = createSignalConsole({
				colors: false,
				level: "quiet",
				output: (msg) => output.push(msg),
			});

			signalConsole(createSignal("workflow:start", {}));
			signalConsole(createSignal("agent:activated", {}));
			signalConsole(createSignal("harness:start", {}));
			signalConsole(createSignal("tool:call", { name: "test" }));
			signalConsole(createSignal("tool:result", { result: "ok" }));
			signalConsole(createSignal("text:complete", { content: "response" }));
			signalConsole(createSignal("harness:end", { durationMs: 100 }));
			signalConsole(createSignal("workflow:end", { durationMs: 200 }));

			expect(output.length).toBe(2);
			expect(output[0]).toMatch(/workflow:start/);
			expect(output[1]).toMatch(/workflow:end 200ms/);
		});

		test("shows error signals even in quiet mode", () => {
			const output: string[] = [];
			const signalConsole = createSignalConsole({
				colors: false,
				level: "quiet",
				output: (msg) => output.push(msg),
			});

			signalConsole(createSignal("workflow:start", {}));
			signalConsole(createSignal("error:harness", { message: "Failed" }));
			signalConsole(createSignal("workflow:end", { durationMs: 100 }));

			expect(output.length).toBe(3);
			expect(output[1]).toMatch(/error:harness/);
		});
	});

	describe("normal level", () => {
		test("shows all signals except text:delta", () => {
			const output: string[] = [];
			const signalConsole = createSignalConsole({
				colors: false,
				level: "normal",
				output: (msg) => output.push(msg),
			});

			signalConsole(createSignal("workflow:start", {}));
			signalConsole(createSignal("agent:activated", {}));
			signalConsole(createSignal("harness:start", {}));
			signalConsole(createSignal("text:delta", { content: "Hello" }));
			signalConsole(createSignal("text:delta", { content: " world" }));
			signalConsole(createSignal("tool:call", { name: "test" }));
			signalConsole(createSignal("tool:result", { result: "ok" }));
			signalConsole(createSignal("text:complete", { content: "Hello world" }));
			signalConsole(createSignal("harness:end", { durationMs: 100 }));
			signalConsole(createSignal("workflow:end", { durationMs: 200 }));

			// Should have all except the 2 text:delta signals
			expect(output.length).toBe(8);
			expect(output.some((o) => o.includes("text:delta"))).toBe(false);
			expect(output.some((o) => o.includes("tool:call"))).toBe(true);
			expect(output.some((o) => o.includes("text:complete"))).toBe(true);
		});

		test("is the default level", () => {
			const output: string[] = [];
			const signalConsole = createSignalConsole({
				colors: false,
				output: (msg) => output.push(msg),
			});

			signalConsole(createSignal("tool:call", { name: "test" }));
			signalConsole(createSignal("text:delta", { content: "Hi" }));

			// tool:call should show (normal shows it), text:delta should not
			expect(output.length).toBe(1);
			expect(output[0]).toMatch(/tool:call/);
		});
	});

	describe("verbose level", () => {
		test("shows all signals including text:delta", () => {
			const output: string[] = [];
			const signalConsole = createSignalConsole({
				colors: false,
				level: "verbose",
				output: (msg) => output.push(msg),
			});

			signalConsole(createSignal("workflow:start", {}));
			signalConsole(createSignal("text:delta", { content: "Hello" }));
			signalConsole(createSignal("text:delta", { content: " world" }));
			signalConsole(createSignal("text:complete", { content: "Hello world" }));
			signalConsole(createSignal("workflow:end", { durationMs: 100 }));

			expect(output.length).toBe(5);
			expect(output[1]).toMatch(/text:delta "Hello"/);
			expect(output[2]).toMatch(/text:delta " world"/);
		});

		test("shows full multiline content with indentation", () => {
			const output: string[] = [];
			const signalConsole = createSignalConsole({
				colors: false,
				level: "verbose",
				output: (msg) => output.push(msg),
			});

			const multiline = "Line 1\nLine 2\nLine 3";
			signalConsole(
				createSignal("text:complete", {
					content: multiline,
				})
			);

			expect(output.length).toBe(1);
			expect(output[0]).toContain("Line 1");
			expect(output[0]).toContain("Line 2");
			expect(output[0]).toContain("Line 3");
		});
	});

	describe("backward compatibility", () => {
		test("maps 'info' to 'normal'", () => {
			const output: string[] = [];
			const signalConsole = createSignalConsole({
				colors: false,
				level: "info",
				output: (msg) => output.push(msg),
			});

			signalConsole(createSignal("tool:call", { name: "test" }));
			signalConsole(createSignal("text:delta", { content: "Hi" }));

			// info → normal: tool:call shows, text:delta hidden
			expect(output.length).toBe(1);
			expect(output[0]).toMatch(/tool:call/);
		});

		test("maps 'debug' to 'verbose'", () => {
			const output: string[] = [];
			const signalConsole = createSignalConsole({
				colors: false,
				level: "debug",
				output: (msg) => output.push(msg),
			});

			signalConsole(createSignal("text:delta", { content: "Hi" }));

			// debug → verbose: text:delta shows
			expect(output.length).toBe(1);
			expect(output[0]).toMatch(/text:delta/);
		});

		test("maps 'trace' to 'verbose'", () => {
			const output: string[] = [];
			const signalConsole = createSignalConsole({
				colors: false,
				level: "trace",
				output: (msg) => output.push(msg),
			});

			signalConsole(createSignal("text:delta", { content: "Hi" }));

			// trace → verbose: text:delta shows
			expect(output.length).toBe(1);
			expect(output[0]).toMatch(/text:delta/);
		});
	});

	describe("typical workflow output", () => {
		test("normal level shows complete story with truncated content", () => {
			const output: string[] = [];
			const signalConsole = createSignalConsole({
				colors: false,
				level: "normal",
				output: (msg) => output.push(msg),
			});

			signalConsole(createSignal("workflow:start", {}));
			signalConsole(createSignal("agent:activated", { trigger: "workflow:start" }, { agent: "analyzer" }));
			signalConsole(createSignal("harness:start", {}));
			signalConsole(createSignal("tool:call", { name: "web_search", input: { query: "test" } }));
			signalConsole(createSignal("tool:result", { result: "Found 5 results" }));
			signalConsole(createSignal("text:complete", { content: "Based on my search..." }));
			signalConsole(createSignal("harness:end", { durationMs: 100 }));
			signalConsole(createSignal("workflow:end", { durationMs: 200 }));

			expect(output.length).toBe(8);
			expect(output[0]).toMatch(/workflow:start$/);
			expect(output[1]).toMatch(/agent:activated \[analyzer\]$/);
			expect(output[2]).toMatch(/harness:start$/);
			expect(output[3]).toMatch(/tool:call web_search\(.*test.*\)/);
			expect(output[4]).toMatch(/tool:result "Found 5 results"/);
			expect(output[5]).toMatch(/text:complete "Based on my search/);
			expect(output[6]).toMatch(/harness:end 100ms$/);
			expect(output[7]).toMatch(/workflow:end 200ms$/);
		});
	});

	describe("edge cases", () => {
		test("handles undefined payload gracefully", () => {
			const output: string[] = [];
			const signalConsole = createSignalConsole({
				colors: false,
				output: (msg) => output.push(msg),
			});

			signalConsole(createSignal("workflow:start", undefined));

			expect(output.length).toBe(1);
			expect(output[0]).toMatch(/workflow:start$/);
		});

		test("handles null payload gracefully", () => {
			const output: string[] = [];
			const signalConsole = createSignalConsole({
				colors: false,
				output: (msg) => output.push(msg),
			});

			signalConsole(createSignal("workflow:start", null));

			expect(output.length).toBe(1);
			expect(output[0]).toMatch(/workflow:start$/);
		});

		test("handles circular reference in tool input", () => {
			const output: string[] = [];
			const signalConsole = createSignalConsole({
				colors: false,
				level: "normal",
				output: (msg) => output.push(msg),
			});

			const circular: Record<string, unknown> = { name: "test" };
			circular.self = circular;

			signalConsole(
				createSignal("tool:call", {
					name: "test",
					input: circular,
				})
			);

			expect(output.length).toBe(1);
			expect(output[0]).toMatch(/tool:call test\(\[complex\]\)/);
		});

		test("handles unknown signal types", () => {
			const output: string[] = [];
			const signalConsole = createSignalConsole({
				colors: false,
				level: "normal",
				output: (msg) => output.push(msg),
			});

			signalConsole(createSignal("custom:signal", { data: "test" }));

			expect(output.length).toBe(1);
			expect(output[0]).toMatch(/custom:signal$/);
		});

		test("handles empty text:complete content", () => {
			const output: string[] = [];
			const signalConsole = createSignalConsole({
				colors: false,
				level: "normal",
				output: (msg) => output.push(msg),
			});

			signalConsole(createSignal("text:complete", { content: "" }));

			expect(output.length).toBe(1);
			expect(output[0]).toMatch(/text:complete$/);
		});
	});
});
