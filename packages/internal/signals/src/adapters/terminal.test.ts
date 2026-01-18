/**
 * Tests for terminal adapter
 *
 * Uses real signal instances per MUST-001 constitution compliance.
 * No mocks for signal data - only output capture.
 */

import { beforeEach, describe, expect, it } from "bun:test";
import { createSignal } from "@internal/signals-core";
import { terminalAdapter } from "./terminal.js";

describe("terminalAdapter", () => {
	// Capture output for testing
	let output: string[];
	let writeFn: (text: string) => void;

	beforeEach(() => {
		output = [];
		writeFn = (text: string) => {
			output.push(text);
		};
	});

	describe("basic signal rendering", () => {
		it("renders simple signal with name", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal("test:signal", { data: "hello" });

			adapter.onSignal(signal);

			expect(output).toHaveLength(1);
			expect(output[0]).toContain("test:signal");
		});

		it("includes timestamp when showTimestamp is true", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false, showTimestamp: true });
			const signal = createSignal("test:signal", {});

			adapter.onSignal(signal);

			expect(output[0]).toMatch(/\[\d{1,2}:\d{2}:\d{2}/); // Time format
		});

		it("applies ANSI colors when colors is true", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: true });
			const signal = createSignal(
				"test:complete",
				{},
				{
					display: { status: "success" },
				},
			);

			adapter.onSignal(signal);

			// Should contain ANSI escape codes
			expect(output[0]).toContain("\x1b[");
		});

		it("omits ANSI colors when colors is false", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal(
				"test:complete",
				{},
				{
					display: { status: "success" },
				},
			);

			adapter.onSignal(signal);

			// Should NOT contain ANSI escape codes
			expect(output[0]).not.toContain("\x1b[");
		});
	});

	describe("display type rendering", () => {
		it("renders status display type with icon", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal(
				"task:running",
				{},
				{
					display: {
						type: "status",
						status: "active",
						title: "Running task...",
					},
				},
			);

			adapter.onSignal(signal);

			expect(output[0]).toContain("●"); // active icon
			expect(output[0]).toContain("Running task...");
		});

		it("renders notification display type", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal(
				"task:done",
				{},
				{
					display: {
						type: "notification",
						status: "success",
						title: "Task completed successfully",
					},
				},
			);

			adapter.onSignal(signal);

			expect(output[0]).toContain("✓"); // success icon
			expect(output[0]).toContain("Task completed successfully");
		});

		it("renders progress display type with percentage", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal(
				"download:progress",
				{},
				{
					display: {
						type: "progress",
						title: "Downloading",
						progress: 75,
					},
				},
			);

			adapter.onSignal(signal);

			expect(output[0]).toContain("75%");
			expect(output[0]).toContain("Downloading");
		});

		it("renders progress display type with step count", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal(
				"tasks:progress",
				{},
				{
					display: {
						type: "progress",
						title: "Processing tasks",
						progress: { current: 3, total: 10 },
					},
				},
			);

			adapter.onSignal(signal);

			expect(output[0]).toContain("(3/10)");
			expect(output[0]).toContain("Processing tasks");
		});

		it("renders log display type with signal name", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal(
				"debug:info",
				{ message: "test" },
				{
					display: {
						type: "log",
						title: "Debug message",
					},
				},
			);

			adapter.onSignal(signal);

			expect(output[0]).toContain("[debug:info]");
			expect(output[0]).toContain("Debug message");
		});
	});

	describe("display status colors", () => {
		it("uses green for success status", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: true });
			// Use notification type to get colored icon output
			const signal = createSignal(
				"test",
				{},
				{
					display: { type: "notification", status: "success" },
				},
			);

			adapter.onSignal(signal);

			expect(output[0]).toContain("\x1b[32m"); // green
		});

		it("uses red for error status", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: true });
			const signal = createSignal(
				"test",
				{},
				{
					display: { type: "notification", status: "error" },
				},
			);

			adapter.onSignal(signal);

			expect(output[0]).toContain("\x1b[31m"); // red
		});

		it("uses yellow for active status", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: true });
			const signal = createSignal(
				"test",
				{},
				{
					display: { type: "status", status: "active" },
				},
			);

			adapter.onSignal(signal);

			expect(output[0]).toContain("\x1b[33m"); // yellow
		});

		it("uses blue for pending status", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: true });
			const signal = createSignal(
				"test",
				{},
				{
					display: { type: "status", status: "pending" },
				},
			);

			adapter.onSignal(signal);

			expect(output[0]).toContain("\x1b[34m"); // blue
		});
	});

	describe("title and subtitle resolution", () => {
		it("uses static title string", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal(
				"test",
				{},
				{
					display: {
						title: "Static title",
					},
				},
			);

			adapter.onSignal(signal);

			expect(output[0]).toContain("Static title");
		});

		it("resolves dynamic title function with payload", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal(
				"task:complete",
				{ taskName: "Build" },
				{
					display: {
						title: (payload: unknown) => `Completed: ${(payload as { taskName: string }).taskName}`,
					},
				},
			);

			adapter.onSignal(signal);

			expect(output[0]).toContain("Completed: Build");
		});

		it("renders subtitle below title", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal(
				"deploy:complete",
				{},
				{
					display: {
						title: "Deployment Complete",
						subtitle: "Version 1.2.3 deployed to production",
					},
				},
			);

			adapter.onSignal(signal);

			expect(output[0]).toContain("Deployment Complete");
			expect(output[0]).toContain("Version 1.2.3 deployed to production");
		});

		it("resolves dynamic subtitle function with payload", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal(
				"test",
				{ count: 42 },
				{
					display: {
						title: "Test",
						subtitle: (payload: unknown) => `Processed ${(payload as { count: number }).count} items`,
					},
				},
			);

			adapter.onSignal(signal);

			expect(output[0]).toContain("Processed 42 items");
		});

		it("falls back to signal name when title function throws", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal(
				"fallback:test",
				{},
				{
					display: {
						title: () => {
							throw new Error("Title function error");
						},
					},
				},
			);

			adapter.onSignal(signal);

			expect(output[0]).toContain("fallback:test");
		});
	});

	describe("custom icon support", () => {
		it("uses custom icon when provided", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			// Use notification type to get icon-based output instead of log format
			const signal = createSignal(
				"rocket:launch",
				{},
				{
					display: {
						type: "notification",
						title: "Launching",
						icon: "🚀",
					},
				},
			);

			adapter.onSignal(signal);

			expect(output[0]).toContain("🚀");
			expect(output[0]).toContain("Launching");
		});
	});

	describe("convention-based inference", () => {
		it("infers status:active from *:start signal name", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal("task:start", {});

			adapter.onSignal(signal);

			expect(output[0]).toContain("●"); // active icon
		});

		it("infers notification:success from *:complete signal name", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal("task:complete", {});

			adapter.onSignal(signal);

			expect(output[0]).toContain("✓"); // success icon
		});

		it("infers notification:error from *:error signal name", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal("task:error", {});

			adapter.onSignal(signal);

			expect(output[0]).toContain("✗"); // error icon
		});

		it("infers notification:warning from *:warning signal name", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal("task:warning", {});

			adapter.onSignal(signal);

			expect(output[0]).toContain("⚠"); // warning icon
		});

		it("infers stream from *:delta signal name", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal("text:delta", "streaming text");

			adapter.onSignal(signal);

			expect(output[0]).toContain("→"); // stream icon
		});

		it("infers log type for unknown suffixes", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal("custom:something", {});

			adapter.onSignal(signal);

			expect(output[0]).toContain("[custom:something]"); // log format
		});
	});

	describe("explicit display overrides inference", () => {
		it("explicit display overrides inferred display", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			// Signal name suggests "start" (active), but we explicitly set error
			const signal = createSignal(
				"task:start",
				{},
				{
					display: {
						status: "error",
						title: "Task failed to start",
					},
				},
			);

			adapter.onSignal(signal);

			expect(output[0]).toContain("✗"); // error icon, not active
			expect(output[0]).toContain("Task failed to start");
		});
	});

	describe("streaming behavior", () => {
		it("handles stream signals with append mode", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });

			// First stream signal
			const signal1 = createSignal("text:delta", "Hello ", {
				display: { type: "stream", append: true, title: "Streaming" },
			});

			// Second stream signal (continuation)
			const signal2 = createSignal("text:delta", "World", {
				display: { type: "stream", append: true },
			});

			adapter.onStart?.();
			adapter.onSignal(signal1);
			adapter.onSignal(signal2);

			// First signal gets full output with newline (it's the initial signal)
			expect(output[0]).toContain("→");
			expect(output[0]).toContain("Streaming");
			expect(output[0]).toEndWith("\n");

			// Second signal (append) just appends content without newline
			expect(output[1]).toBe("World");
		});

		it("clears streaming state on onStop", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });

			adapter.onStart?.();

			// Create a stream signal
			const signal = createSignal("text:delta", "content", {
				display: { type: "stream", append: true, title: "Stream" },
			});
			adapter.onSignal(signal);

			// Stop and restart
			adapter.onStop?.();
			adapter.onStart?.();

			// New stream should start fresh (output index 1 is append, index 2 is new start)
			adapter.onSignal(signal);

			// First should have initial output format
			expect(output[0]).toContain("→");
			// After restart, should have initial output format again
			expect(output[1]).toContain("→");
		});
	});

	describe("lifecycle methods", () => {
		it("calls onStart before processing signals", async () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });

			expect(adapter.onStart).toBeDefined();
			await adapter.onStart?.();

			// Should not throw
			expect(true).toBe(true);
		});

		it("calls onStop after processing signals", async () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });

			expect(adapter.onStop).toBeDefined();
			await adapter.onStop?.();

			// Should not throw
			expect(true).toBe(true);
		});

		it("has correct adapter name", () => {
			const adapter = terminalAdapter({ write: writeFn });

			expect(adapter.name).toBe("terminal");
		});

		it("uses default patterns", () => {
			const adapter = terminalAdapter({ write: writeFn });

			expect(adapter.patterns).toEqual(["*"]);
		});

		it("accepts custom patterns", () => {
			const adapter = terminalAdapter({ write: writeFn, patterns: ["task:*", "plan:*"] });

			expect(adapter.patterns).toEqual(["task:*", "plan:*"]);
		});
	});

	describe("full workflow simulation", () => {
		it("handles complete workflow sequence", async () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });

			await adapter.onStart?.();

			// Workflow start
			adapter.onSignal(
				createSignal(
					"workflow:start",
					{},
					{
						display: { type: "status", status: "active", title: "Starting workflow..." },
					},
				),
			);

			// Plan creation
			adapter.onSignal(
				createSignal(
					"plan:created",
					{ taskCount: 3 },
					{
						display: {
							type: "notification",
							status: "success",
							title: (p: unknown) => `Plan created with ${(p as { taskCount: number }).taskCount} tasks`,
						},
					},
				),
			);

			// Task progress
			adapter.onSignal(
				createSignal(
					"tasks:progress",
					{},
					{
						display: { type: "progress", title: "Executing tasks", progress: { current: 1, total: 3 } },
					},
				),
			);

			// Task complete
			adapter.onSignal(
				createSignal(
					"task:complete",
					{},
					{
						display: { type: "notification", status: "success", title: "Task 1 complete" },
					},
				),
			);

			// Workflow complete
			adapter.onSignal(
				createSignal(
					"workflow:complete",
					{},
					{
						display: { type: "notification", status: "success", title: "Workflow completed!" },
					},
				),
			);

			await adapter.onStop?.();

			expect(output).toHaveLength(5);
			expect(output[0]).toContain("Starting workflow...");
			expect(output[1]).toContain("Plan created with 3 tasks");
			expect(output[2]).toContain("(1/3)");
			expect(output[3]).toContain("Task 1 complete");
			expect(output[4]).toContain("Workflow completed!");
		});
	});
});
