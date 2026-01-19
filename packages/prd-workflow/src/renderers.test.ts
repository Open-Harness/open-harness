/**
 * Tests for PRD Workflow Signal Renderers
 *
 * Verifies that all 13 PRD workflow signals have renderers defined
 * and that they produce correct formatted output.
 */

import { describe, expect, it } from "bun:test";
import { createSignal } from "@internal/signals-core";
import { prdRenderers } from "./renderers.js";
import { PRD_SIGNAL_NAMES } from "./signals/index.js";

// ============================================================================
// ANSI escape codes for verification
// ============================================================================

const ANSI = {
	reset: "\x1b[0m",
	green: "\x1b[32m",
	red: "\x1b[31m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
} as const;

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a test signal with the given name and payload
 */
function testSignal<T>(name: string, payload: T) {
	return createSignal(name, payload);
}

/**
 * Get a renderer by name, throwing if not found.
 * This is used in tests where we expect the renderer to exist.
 */
function getRenderer(name: string) {
	const renderer = prdRenderers[name];
	if (!renderer) {
		throw new Error(`Renderer not found for signal: ${name}`);
	}
	return renderer;
}

// ============================================================================
// Tests
// ============================================================================

describe("prdRenderers", () => {
	describe("coverage", () => {
		it("should have renderers for all 13 PRD signal names", () => {
			const signalNames = Object.values(PRD_SIGNAL_NAMES);
			expect(signalNames.length).toBe(13);

			for (const name of signalNames) {
				expect(prdRenderers[name]).toBeDefined();
				expect(typeof prdRenderers[name]).toBe("function");
			}
		});

		it("should have exactly 13 renderers", () => {
			expect(Object.keys(prdRenderers).length).toBe(13);
		});
	});

	describe("planning phase renderers", () => {
		it("plan:start renders with blue icon", () => {
			const signal = testSignal("plan:start", { prd: "test prd" });
			const output = getRenderer("plan:start")(signal);

			expect(output).toContain("📋");
			expect(output).toContain("Planning...");
			expect(output).toContain(ANSI.blue);
		});

		it("plan:created renders task and milestone counts", () => {
			const signal = testSignal("plan:created", {
				tasks: [
					{ id: "T-001", title: "Task 1", description: "", definitionOfDone: [] },
					{ id: "T-002", title: "Task 2", description: "", definitionOfDone: [] },
				],
				milestones: [{ id: "M-001", title: "Milestone 1", taskIds: ["T-001", "T-002"] }],
				taskOrder: ["T-001", "T-002"],
			});
			const output = getRenderer("plan:created")(signal);

			expect(output).toContain("✓");
			expect(output).toContain("2 tasks");
			expect(output).toContain("1 milestone");
			expect(output).toContain(ANSI.green);
		});

		it("plan:created handles singular task/milestone", () => {
			const signal = testSignal("plan:created", {
				tasks: [{ id: "T-001", title: "Task 1", description: "", definitionOfDone: [] }],
				milestones: [{ id: "M-001", title: "Milestone 1", taskIds: ["T-001"] }],
				taskOrder: ["T-001"],
			});
			const output = getRenderer("plan:created")(signal);

			expect(output).toContain("1 task");
			expect(output).toContain("1 milestone");
			expect(output).not.toContain("tasks");
			expect(output).not.toContain("milestones");
		});
	});

	describe("discovery phase renderers", () => {
		it("discovery:submitted renders task count", () => {
			const signal = testSignal("discovery:submitted", {
				discoveries: [
					{ title: "New task", description: "desc" },
					{ title: "Another task", description: "desc" },
				],
				count: 2,
				sourceTaskId: "T-001",
			});
			const output = getRenderer("discovery:submitted")(signal);

			expect(output).toContain("🔍");
			expect(output).toContain("2 tasks discovered");
			expect(output).toContain(ANSI.yellow);
		});

		it("discovery:submitted handles singular task", () => {
			const signal = testSignal("discovery:submitted", {
				discoveries: [{ title: "New task", description: "desc" }],
				count: 1,
				sourceTaskId: "T-001",
			});
			const output = getRenderer("discovery:submitted")(signal);

			expect(output).toContain("1 task discovered");
			expect(output).not.toContain("tasks discovered");
		});

		it("discovery:reviewed renders accepted and rejected counts", () => {
			const signal = testSignal("discovery:reviewed", {
				accepted: 3,
				rejected: 1,
			});
			const output = getRenderer("discovery:reviewed")(signal);

			expect(output).toContain("✓");
			expect(output).toContain("3 accepted");
			expect(output).toContain("1 rejected");
			expect(output).toContain(ANSI.green);
		});
	});

	describe("task execution renderers", () => {
		it("task:ready renders task title", () => {
			const signal = testSignal("task:ready", {
				taskId: "T-001",
				title: "Implement feature X",
				description: "desc",
				definitionOfDone: ["Done"],
			});
			const output = getRenderer("task:ready")(signal);

			expect(output).toContain("▶");
			expect(output).toContain("Implement feature X");
			expect(output).toContain(ANSI.yellow);
		});

		it("task:complete renders success with green icon", () => {
			const signal = testSignal("task:complete", {
				taskId: "T-001",
				outcome: "success",
				summary: "Completed successfully",
			});
			const output = getRenderer("task:complete")(signal);

			expect(output).toContain("✓");
			expect(output).toContain("Task T-001 success");
			expect(output).toContain(ANSI.green);
		});

		it("task:complete renders failure with red icon", () => {
			const signal = testSignal("task:complete", {
				taskId: "T-001",
				outcome: "failure",
				summary: "Failed",
			});
			const output = getRenderer("task:complete")(signal);

			expect(output).toContain("✗");
			expect(output).toContain("Task T-001 failure");
			expect(output).toContain(ANSI.red);
		});

		it("task:approved renders with task ID", () => {
			const signal = testSignal("task:approved", {
				taskId: "T-001",
			});
			const output = getRenderer("task:approved")(signal);

			expect(output).toContain("✓");
			expect(output).toContain("Task T-001 approved");
			expect(output).toContain(ANSI.green);
		});

		it("task:approved handles null task ID", () => {
			const signal = testSignal("task:approved", {
				taskId: null,
			});
			const output = getRenderer("task:approved")(signal);

			expect(output).toContain("✓");
			expect(output).toContain("Task approved");
			expect(output).not.toContain("null");
		});

		it("fix:required renders task ID and attempt", () => {
			const signal = testSignal("fix:required", {
				taskId: "T-001",
				milestoneId: "M-001",
				attempt: 2,
			});
			const output = getRenderer("fix:required")(signal);

			expect(output).toContain("🔧");
			expect(output).toContain("Fixing task T-001");
			expect(output).toContain("(attempt 2)");
			expect(output).toContain(ANSI.yellow);
		});
	});

	describe("milestone renderers", () => {
		it("milestone:testable renders milestone ID", () => {
			const signal = testSignal("milestone:testable", {
				milestoneId: "M-001",
				taskIds: ["T-001", "T-002"],
			});
			const output = getRenderer("milestone:testable")(signal);

			expect(output).toContain("🧪");
			expect(output).toContain("Testing milestone M-001");
			expect(output).toContain(ANSI.blue);
		});

		it("milestone:passed renders with green icon", () => {
			const signal = testSignal("milestone:passed", {
				milestoneId: "M-001",
			});
			const output = getRenderer("milestone:passed")(signal);

			expect(output).toContain("✓");
			expect(output).toContain("Milestone M-001 passed");
			expect(output).toContain(ANSI.green);
		});

		it("milestone:failed renders with red icon", () => {
			const signal = testSignal("milestone:failed", {
				milestoneId: "M-001",
			});
			const output = getRenderer("milestone:failed")(signal);

			expect(output).toContain("✗");
			expect(output).toContain("Milestone M-001 failed");
			expect(output).toContain(ANSI.red);
		});

		it("milestone:retry renders milestone ID", () => {
			const signal = testSignal("milestone:retry", {
				milestoneId: "M-001",
			});
			const output = getRenderer("milestone:retry")(signal);

			expect(output).toContain("🔄");
			expect(output).toContain("Retrying milestone M-001");
			expect(output).toContain(ANSI.yellow);
		});
	});

	describe("workflow renderers", () => {
		it("workflow:complete renders success message for all_milestones_passed", () => {
			const signal = testSignal("workflow:complete", {
				reason: "all_milestones_passed",
			});
			const output = getRenderer("workflow:complete")(signal);

			expect(output).toContain("🎉");
			expect(output).toContain("All milestones passed!");
			expect(output).toContain(ANSI.green);
		});

		it("workflow:complete renders custom reason", () => {
			const signal = testSignal("workflow:complete", {
				reason: "no_tasks_to_execute",
			});
			const output = getRenderer("workflow:complete")(signal);

			expect(output).toContain("🎉");
			expect(output).toContain("no_tasks_to_execute");
			expect(output).toContain(ANSI.green);
		});
	});

	describe("unknown signals", () => {
		it("should not have renderers for unknown signal names", () => {
			expect(prdRenderers["unknown:signal"]).toBeUndefined();
			expect(prdRenderers["foo:bar"]).toBeUndefined();
		});
	});
});
