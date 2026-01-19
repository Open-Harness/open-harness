/**
 * Terminal Adapter Display Type Inference Tests
 *
 * Validates that the terminal adapter correctly infers display type and status
 * from signal naming conventions when explicit display metadata is absent.
 *
 * This ensures backward compatibility and convention-based rendering works
 * correctly for signals that don't have display metadata.
 *
 * Inference conventions tested:
 * - *:start, *:started, *:begin → status (active)
 * - *:complete, *:completed, *:done, *:success → notification (success)
 * - *:error, *:failed, *:failure → notification (error)
 * - *:warning, *:warn → notification (warning)
 * - *:delta, *:chunk, *:stream → stream (append)
 * - *:progress → progress (active)
 * - unknown suffix → log type
 *
 * Per MUST-001: Uses real signal instances, not mocks.
 */

import { beforeEach, describe, expect, it } from "bun:test";
import { createSignal } from "@internal/signals-core";
import { terminalAdapter } from "./terminal.js";

describe("terminal adapter display type inference", () => {
	// Capture output for testing
	let output: string[];
	let writeFn: (text: string) => void;

	beforeEach(() => {
		output = [];
		writeFn = (text: string) => {
			output.push(text);
		};
	});

	// Icons for reference
	const ICONS = {
		pending: "○",
		active: "●",
		success: "✓",
		error: "✗",
		warning: "⚠",
		stream: "→",
		info: "ℹ",
	};

	// ANSI codes for reference
	const ANSI = {
		green: "\x1b[32m",
		red: "\x1b[31m",
		yellow: "\x1b[33m",
		blue: "\x1b[34m",
	};

	describe("start/begin conventions → status (active)", () => {
		it("infers status:active from :start suffix", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal("workflow:start", { workflowId: "wf-123" });

			adapter.onSignal(signal);

			expect(output[0]).toContain(ICONS.active);
			expect(output[0]).toContain("workflow:start");
		});

		it("infers status:active from :started suffix", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal("agent:started", { agentId: "agent-1" });

			adapter.onSignal(signal);

			expect(output[0]).toContain(ICONS.active);
		});

		it("infers status:active from :begin suffix", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal("task:begin", { taskId: "task-1" });

			adapter.onSignal(signal);

			expect(output[0]).toContain(ICONS.active);
		});

		it("applies yellow color for active status when colors enabled", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: true });
			const signal = createSignal("process:start", {});

			adapter.onSignal(signal);

			expect(output[0]).toContain(ANSI.yellow);
		});

		it("handles namespaced start signals", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal("harness:agent:start", { nested: true });

			adapter.onSignal(signal);

			expect(output[0]).toContain(ICONS.active);
		});
	});

	describe("complete/done/success conventions → notification (success)", () => {
		it("infers notification:success from :complete suffix", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal("task:complete", { taskId: "task-1" });

			adapter.onSignal(signal);

			expect(output[0]).toContain(ICONS.success);
		});

		it("infers notification:success from :completed suffix", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal("workflow:completed", { duration: 1500 });

			adapter.onSignal(signal);

			expect(output[0]).toContain(ICONS.success);
		});

		it("infers notification:success from :done suffix", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal("build:done", { artifacts: [] });

			adapter.onSignal(signal);

			expect(output[0]).toContain(ICONS.success);
		});

		it("infers notification:success from :success suffix", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal("deploy:success", { environment: "prod" });

			adapter.onSignal(signal);

			expect(output[0]).toContain(ICONS.success);
		});

		it("applies green color for success status when colors enabled", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: true });
			const signal = createSignal("operation:complete", {});

			adapter.onSignal(signal);

			expect(output[0]).toContain(ANSI.green);
		});
	});

	describe("error/failed/failure conventions → notification (error)", () => {
		it("infers notification:error from :error suffix", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal("task:error", { message: "Failed" });

			adapter.onSignal(signal);

			expect(output[0]).toContain(ICONS.error);
		});

		it("infers notification:error from :failed suffix", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal("build:failed", { exitCode: 1 });

			adapter.onSignal(signal);

			expect(output[0]).toContain(ICONS.error);
		});

		it("infers notification:error from :failure suffix", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal("test:failure", { testName: "unit-1" });

			adapter.onSignal(signal);

			expect(output[0]).toContain(ICONS.error);
		});

		it("applies red color for error status when colors enabled", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: true });
			const signal = createSignal("process:error", {});

			adapter.onSignal(signal);

			expect(output[0]).toContain(ANSI.red);
		});
	});

	describe("warning/warn conventions → notification (warning)", () => {
		it("infers notification:warning from :warning suffix", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal("task:warning", { level: "medium" });

			adapter.onSignal(signal);

			expect(output[0]).toContain(ICONS.warning);
		});

		it("infers notification:warning from :warn suffix", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal("resource:warn", { usage: 85 });

			adapter.onSignal(signal);

			expect(output[0]).toContain(ICONS.warning);
		});

		it("applies yellow color for warning status when colors enabled", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: true });
			const signal = createSignal("memory:warning", {});

			adapter.onSignal(signal);

			expect(output[0]).toContain(ANSI.yellow);
		});
	});

	describe("delta/chunk/stream conventions → stream (append)", () => {
		it("infers stream from :delta suffix", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal("text:delta", "streaming content");

			adapter.onSignal(signal);

			expect(output[0]).toContain(ICONS.stream);
		});

		it("infers stream from :chunk suffix", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal("response:chunk", "partial data");

			adapter.onSignal(signal);

			expect(output[0]).toContain(ICONS.stream);
		});

		it("infers stream from :stream suffix", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal("data:stream", { bytes: [1, 2, 3] });

			adapter.onSignal(signal);

			expect(output[0]).toContain(ICONS.stream);
		});

		it("handles append mode correctly for sequential stream signals", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });

			adapter.onStart?.();

			// First delta signal
			const signal1 = createSignal("text:delta", "Hello ");
			adapter.onSignal(signal1);

			// Second delta signal (should append)
			const signal2 = createSignal("text:delta", "World");
			adapter.onSignal(signal2);

			// First output has the icon and newline
			expect(output[0]).toContain(ICONS.stream);
			expect(output[0]).toEndWith("\n");

			// Second output is just the content without newline (append mode)
			expect(output[1]).toBe("World");
		});
	});

	describe("progress convention → progress (active)", () => {
		it("infers progress type from :progress suffix", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal("download:progress", { percent: 50 });

			adapter.onSignal(signal);

			// Progress type uses the active icon by default
			expect(output[0]).toContain(ICONS.active);
		});

		it("renders progress percentage when provided via display", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			// Inference gives progress type, but we still need display.progress for the bar
			const signal = createSignal(
				"task:progress",
				{},
				{
					display: { progress: 60 },
				},
			);

			adapter.onSignal(signal);

			expect(output[0]).toContain("60%");
		});
	});

	describe("unknown suffix → log type", () => {
		it("infers log type for unrecognized suffix", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal("custom:unknown", { data: "test" });

			adapter.onSignal(signal);

			// Log type shows signal name in brackets
			expect(output[0]).toContain("[custom:unknown]");
		});

		it("infers log type for no suffix (single segment name)", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal("something", { value: 42 });

			adapter.onSignal(signal);

			expect(output[0]).toContain("[something]");
		});

		it("infers log type for numeric suffix", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal("request:123", {});

			adapter.onSignal(signal);

			expect(output[0]).toContain("[request:123]");
		});

		it("infers log type for arbitrary words", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal("user:action:clicked", {});

			adapter.onSignal(signal);

			expect(output[0]).toContain("[user:action:clicked]");
		});
	});

	describe("case insensitivity", () => {
		it("handles uppercase suffix :START", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal("workflow:START", {});

			adapter.onSignal(signal);

			expect(output[0]).toContain(ICONS.active);
		});

		it("handles mixed case suffix :Complete", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal("task:Complete", {});

			adapter.onSignal(signal);

			expect(output[0]).toContain(ICONS.success);
		});

		it("handles uppercase suffix :ERROR", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal("operation:ERROR", {});

			adapter.onSignal(signal);

			expect(output[0]).toContain(ICONS.error);
		});
	});

	describe("explicit display overrides inference", () => {
		it("explicit status overrides inferred status from :start", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			// Name suggests active, but explicit display says error
			const signal = createSignal(
				"task:start",
				{},
				{
					display: { status: "error" },
				},
			);

			adapter.onSignal(signal);

			// Should use explicit error status (✗), not inferred active (●)
			expect(output[0]).toContain(ICONS.error);
		});

		it("explicit type overrides inferred type from :delta", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			// Name suggests stream, but explicit display says notification
			const signal = createSignal(
				"text:delta",
				{},
				{
					display: {
						type: "notification",
						status: "success",
						title: "Streaming complete",
					},
				},
			);

			adapter.onSignal(signal);

			// Should use notification type with success icon, not stream arrow
			expect(output[0]).toContain(ICONS.success);
			expect(output[0]).toContain("Streaming complete");
		});

		it("explicit title overrides signal name", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal(
				"generic:complete",
				{},
				{
					display: { title: "Custom Title Message" },
				},
			);

			adapter.onSignal(signal);

			expect(output[0]).toContain("Custom Title Message");
		});

		it("partial display merges with inference", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			// Name infers notification:success, but we only override subtitle
			const signal = createSignal(
				"task:complete",
				{},
				{
					display: {
						subtitle: "Extra details here",
					},
				},
			);

			adapter.onSignal(signal);

			// Should still use inferred success icon (from :complete)
			expect(output[0]).toContain(ICONS.success);
			// And include the explicit subtitle
			expect(output[0]).toContain("Extra details here");
		});
	});

	describe("edge cases and boundary conditions", () => {
		it("handles empty signal name", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal("", { data: "empty name" });

			adapter.onSignal(signal);

			// Should not crash, defaults to log type
			expect(output[0]).toBeDefined();
		});

		it("handles colon-only signal name", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal(":", {});

			adapter.onSignal(signal);

			expect(output[0]).toBeDefined();
		});

		it("handles signal name ending in colon", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal("prefix:", {});

			adapter.onSignal(signal);

			// Empty suffix after colon → log type
			expect(output[0]).toContain("[prefix:]");
		});

		it("handles deeply nested signal names", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal("a:b:c:d:e:start", {});

			adapter.onSignal(signal);

			// Should use the last segment for inference
			expect(output[0]).toContain(ICONS.active);
		});

		it("preserves payload data through inference", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const payload = { count: 42, items: ["a", "b", "c"] };
			const signal = createSignal("data:complete", payload);

			adapter.onSignal(signal);

			// Should infer success and use signal name as title
			expect(output[0]).toContain(ICONS.success);
			expect(output[0]).toContain("data:complete");
		});

		it("handles signals with undefined payload", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal("event:start", undefined);

			adapter.onSignal(signal);

			expect(output[0]).toContain(ICONS.active);
		});

		it("handles signals with null payload", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });
			const signal = createSignal("event:error", null);

			adapter.onSignal(signal);

			expect(output[0]).toContain(ICONS.error);
		});
	});

	describe("inference vs explicit display comparison", () => {
		it("inference produces same icon as equivalent explicit display for :start", () => {
			const adapter1 = terminalAdapter({ write: writeFn, colors: false });
			const adapter2 = terminalAdapter({ write: writeFn, colors: false });

			// Inference-based
			const inferredSignal = createSignal("test:start", {});
			adapter1.onSignal(inferredSignal);
			const inferredOutput = output[0];

			output = [];

			// Explicit display
			const explicitSignal = createSignal(
				"test:explicit",
				{},
				{
					display: { type: "status", status: "active" },
				},
			);
			adapter2.onSignal(explicitSignal);
			const explicitOutput = output[0];

			// Both should contain the active icon
			expect(inferredOutput).toContain(ICONS.active);
			expect(explicitOutput).toContain(ICONS.active);
		});

		it("inference produces same icon as equivalent explicit display for :complete", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });

			// Inference-based
			const inferredSignal = createSignal("test:complete", {});
			adapter.onSignal(inferredSignal);
			const inferredOutput = output[0];

			output = [];

			// Explicit display
			const explicitSignal = createSignal(
				"test:explicit",
				{},
				{
					display: { type: "notification", status: "success" },
				},
			);
			adapter.onSignal(explicitSignal);
			const explicitOutput = output[0];

			// Both should contain the success icon
			expect(inferredOutput).toContain(ICONS.success);
			expect(explicitOutput).toContain(ICONS.success);
		});

		it("inference produces same icon as equivalent explicit display for :error", () => {
			const adapter = terminalAdapter({ write: writeFn, colors: false });

			// Inference-based
			const inferredSignal = createSignal("test:error", {});
			adapter.onSignal(inferredSignal);
			const inferredOutput = output[0];

			output = [];

			// Explicit display
			const explicitSignal = createSignal(
				"test:explicit",
				{},
				{
					display: { type: "notification", status: "error" },
				},
			);
			adapter.onSignal(explicitSignal);
			const explicitOutput = output[0];

			// Both should contain the error icon
			expect(inferredOutput).toContain(ICONS.error);
			expect(explicitOutput).toContain(ICONS.error);
		});
	});
});
