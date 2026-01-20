/**
 * Tests for terminal adapter
 *
 * Tests the renderer map pattern where adapters define how to render signals.
 * Uses real signal instances per MUST-001 constitution compliance.
 * No mocks for signal data - only output capture.
 */

import { beforeEach, describe, expect, it } from "bun:test";
import { createSignal } from "@internal/signals-core";
import { type RendererMap, terminalAdapter } from "./terminal.js";

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

	describe("renderer map behavior", () => {
		it("renders signal when renderer exists in map", () => {
			const renderers: RendererMap = {
				"test:signal": (signal) => `Rendered: ${signal.name}`,
			};
			const adapter = terminalAdapter({ renderers, write: writeFn });
			const signal = createSignal("test:signal", { data: "hello" });

			adapter.onSignal(signal);

			expect(output).toHaveLength(1);
			expect(output[0]).toContain("Rendered: test:signal");
		});

		it("silently skips signal when no renderer exists", () => {
			const renderers: RendererMap = {
				"other:signal": () => "Other",
			};
			const adapter = terminalAdapter({ renderers, write: writeFn });
			const signal = createSignal("unknown:signal", { data: "hello" });

			// Should not throw
			adapter.onSignal(signal);

			// Should produce no output
			expect(output).toHaveLength(0);
		});

		it("only renders signals that have renderers", () => {
			const renderers: RendererMap = {
				"task:start": () => "▶ Starting",
				"task:complete": () => "✓ Done",
			};
			const adapter = terminalAdapter({ renderers, write: writeFn });

			adapter.onSignal(createSignal("task:start", {}));
			adapter.onSignal(createSignal("task:progress", {})); // No renderer
			adapter.onSignal(createSignal("task:complete", {}));
			adapter.onSignal(createSignal("task:unknown", {})); // No renderer

			expect(output).toHaveLength(2);
			expect(output[0]).toContain("▶ Starting");
			expect(output[1]).toContain("✓ Done");
		});

		it("passes full signal to renderer", () => {
			let receivedSignal: unknown;
			const renderers: RendererMap = {
				"test:signal": (signal) => {
					receivedSignal = signal;
					return "rendered";
				},
			};
			const adapter = terminalAdapter({ renderers, write: writeFn });
			const signal = createSignal("test:signal", { foo: "bar" });

			adapter.onSignal(signal);

			expect(receivedSignal).toHaveProperty("name", "test:signal");
			expect(receivedSignal).toHaveProperty("payload", { foo: "bar" });
			expect(receivedSignal).toHaveProperty("id");
			expect(receivedSignal).toHaveProperty("timestamp");
		});
	});

	describe("renderer output", () => {
		it("renders payload data via renderer function", () => {
			const renderers: RendererMap = {
				"task:complete": (signal) => {
					const payload = signal.payload as { taskName: string; outcome: string };
					return `${payload.outcome === "success" ? "✓" : "✗"} ${payload.taskName}`;
				},
			};
			const adapter = terminalAdapter({ renderers, write: writeFn });

			adapter.onSignal(createSignal("task:complete", { taskName: "Build", outcome: "success" }));

			expect(output[0]).toContain("✓ Build");
		});

		it("supports emojis and unicode in renderer output", () => {
			const renderers: RendererMap = {
				"workflow:start": () => "🚀 Starting workflow...",
				"workflow:complete": () => "🎉 All done!",
			};
			const adapter = terminalAdapter({ renderers, write: writeFn });

			adapter.onSignal(createSignal("workflow:start", {}));
			adapter.onSignal(createSignal("workflow:complete", {}));

			expect(output[0]).toContain("🚀 Starting workflow...");
			expect(output[1]).toContain("🎉 All done!");
		});

		it("adds newline after each rendered output", () => {
			const renderers: RendererMap = {
				test: () => "output",
			};
			const adapter = terminalAdapter({ renderers, write: writeFn });

			adapter.onSignal(createSignal("test", {}));

			expect(output[0]).toEndWith("\n");
		});
	});

	describe("timestamp option", () => {
		it("includes timestamp when showTimestamp is true", () => {
			const renderers: RendererMap = {
				test: () => "Test output",
			};
			const adapter = terminalAdapter({ renderers, write: writeFn, showTimestamp: true, colors: false });

			adapter.onSignal(createSignal("test", {}));

			expect(output[0]).toMatch(/\[\d{1,2}:\d{2}:\d{2}/); // Time format [HH:MM:SS
			expect(output[0]).toContain("Test output");
		});

		it("omits timestamp when showTimestamp is false", () => {
			const renderers: RendererMap = {
				test: () => "Test output",
			};
			const adapter = terminalAdapter({ renderers, write: writeFn, showTimestamp: false });

			adapter.onSignal(createSignal("test", {}));

			expect(output[0]).not.toMatch(/\[\d{1,2}:\d{2}:\d{2}/);
			expect(output[0]).toBe("Test output\n");
		});

		it("applies dim color to timestamp when colors is true", () => {
			const renderers: RendererMap = {
				test: () => "Test",
			};
			const adapter = terminalAdapter({ renderers, write: writeFn, showTimestamp: true, colors: true });

			adapter.onSignal(createSignal("test", {}));

			// Should contain dim ANSI code
			expect(output[0]).toContain("\x1b[2m"); // dim
		});

		it("no ANSI in timestamp when colors is false", () => {
			const renderers: RendererMap = {
				test: () => "Test",
			};
			const adapter = terminalAdapter({ renderers, write: writeFn, showTimestamp: true, colors: false });

			adapter.onSignal(createSignal("test", {}));

			// Should NOT contain ANSI escape codes
			expect(output[0]).not.toContain("\x1b[");
		});
	});

	describe("custom write function", () => {
		it("uses custom write function", () => {
			const customOutput: string[] = [];
			const customWrite = (text: string) => {
				customOutput.push(`CUSTOM: ${text}`);
			};
			const renderers: RendererMap = {
				test: () => "output",
			};
			const adapter = terminalAdapter({ renderers, write: customWrite });

			adapter.onSignal(createSignal("test", {}));

			expect(customOutput).toHaveLength(1);
			expect(customOutput[0]).toBe("CUSTOM: output\n");
		});
	});

	describe("adapter configuration", () => {
		it("has correct adapter name", () => {
			const renderers: RendererMap = {};
			const adapter = terminalAdapter({ renderers, write: writeFn });

			expect(adapter.name).toBe("terminal");
		});

		it("uses default patterns", () => {
			const renderers: RendererMap = {};
			const adapter = terminalAdapter({ renderers, write: writeFn });

			expect(adapter.patterns).toEqual(["**"]);
		});

		it("accepts custom patterns", () => {
			const renderers: RendererMap = {};
			const adapter = terminalAdapter({ renderers, write: writeFn, patterns: ["task:*", "plan:*"] });

			expect(adapter.patterns).toEqual(["task:*", "plan:*"]);
		});

		it("optional lifecycle methods can be called safely", async () => {
			const renderers: RendererMap = {};
			const adapter = terminalAdapter({ renderers, write: writeFn });

			// Lifecycle methods are optional - calling with ?. is safe
			await adapter.onStart?.();
			await adapter.onStop?.();
			// No error should be thrown
			expect(true).toBe(true);
		});
	});

	describe("signals without renderers are skipped silently", () => {
		it("does not throw for unknown signal", () => {
			const renderers: RendererMap = {
				"known:signal": () => "Known",
			};
			const adapter = terminalAdapter({ renderers, write: writeFn });

			// Should not throw
			expect(() => {
				adapter.onSignal(createSignal("unknown:signal", {}));
			}).not.toThrow();

			// Should produce no output
			expect(output).toHaveLength(0);
		});

		it("empty renderer map skips all signals", () => {
			const renderers: RendererMap = {};
			const adapter = terminalAdapter({ renderers, write: writeFn });

			adapter.onSignal(createSignal("any:signal", {}));
			adapter.onSignal(createSignal("other:signal", {}));
			adapter.onSignal(createSignal("third:signal", {}));

			expect(output).toHaveLength(0);
		});

		it("handles mix of known and unknown signals correctly", () => {
			const renderers: RendererMap = {
				"task:start": () => "Start",
				"task:end": () => "End",
			};
			const adapter = terminalAdapter({ renderers, write: writeFn });

			adapter.onSignal(createSignal("task:start", {}));
			adapter.onSignal(createSignal("task:middle", {})); // Unknown
			adapter.onSignal(createSignal("task:end", {}));

			expect(output).toHaveLength(2);
			expect(output[0]).toContain("Start");
			expect(output[1]).toContain("End");
		});
	});

	describe("full workflow with renderer map", () => {
		it("handles complete PRD workflow sequence", async () => {
			const renderers: RendererMap = {
				"plan:start": () => "📋 Planning...",
				"plan:created": (s) => {
					const p = s.payload as { tasks: unknown[]; milestones: unknown[] };
					return `✓ Plan created with ${p.tasks.length} tasks (${p.milestones.length} milestones)`;
				},
				"task:ready": (s) => `▶ ${(s.payload as { title: string }).title}`,
				"task:complete": (s) => {
					const p = s.payload as { taskId: string; outcome: string };
					return `${p.outcome === "success" ? "✓" : "✗"} Task ${p.taskId} ${p.outcome}`;
				},
				"workflow:complete": (s) => {
					const p = s.payload as { reason: string };
					return `🎉 ${p.reason === "all_milestones_passed" ? "All milestones passed!" : p.reason}`;
				},
			};
			const adapter = terminalAdapter({ renderers, write: writeFn });

			await adapter.onStart?.();

			adapter.onSignal(createSignal("plan:start", {}));
			adapter.onSignal(createSignal("plan:created", { tasks: [1, 2, 3], milestones: ["M1"] }));
			adapter.onSignal(createSignal("task:ready", { title: "Implement feature" }));
			adapter.onSignal(createSignal("task:progress", { percent: 50 })); // No renderer - skipped
			adapter.onSignal(createSignal("task:complete", { taskId: "T1", outcome: "success" }));
			adapter.onSignal(createSignal("workflow:complete", { reason: "all_milestones_passed" }));

			await adapter.onStop?.();

			expect(output).toHaveLength(5);
			expect(output[0]).toContain("📋 Planning...");
			expect(output[1]).toContain("✓ Plan created with 3 tasks (1 milestones)");
			expect(output[2]).toContain("▶ Implement feature");
			expect(output[3]).toContain("✓ Task T1 success");
			expect(output[4]).toContain("🎉 All milestones passed!");
		});
	});
});
