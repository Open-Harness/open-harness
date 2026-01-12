/**
 * Tests for debug utilities.
 */

import { describe, it, expect } from "vitest";
import { createSignal, type Signal } from "@internal/signals-core";
import {
	getCausalityChain,
	getAgentSignals,
	getChildSignals,
	buildSignalTree,
	formatSignalTree,
	getSignalSummary,
	filterSignals,
} from "./debug.js";

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestSignals(): Signal[] {
	// Create a realistic signal chain:
	// workflow:start (orchestration level)
	//   └─ agent:activated (analyst)
	//      ├─ harness:start (SDK adapter call)
	//      ├─ text:delta
	//      ├─ harness:end
	//      └─ analysis:complete
	//         └─ agent:activated (executor)
	//            ├─ harness:start (SDK adapter call)
	//            └─ harness:end

	const workflowStart = createSignal("workflow:start", { runId: "run_123" });

	const analystActivated = createSignal(
		"agent:activated",
		{ agent: "analyst", trigger: "workflow:start" },
		{ agent: "analyst", parent: workflowStart.id },
	);

	const harnessStart1 = createSignal(
		"harness:start",
		{},
		{ agent: "analyst", parent: analystActivated.id },
	);

	const textDelta = createSignal(
		"text:delta",
		{ content: "Analyzing..." },
		{ agent: "analyst", parent: analystActivated.id },
	);

	const harnessEnd1 = createSignal(
		"harness:end",
		{ output: "analysis result" },
		{ agent: "analyst", parent: analystActivated.id },
	);

	const analysisComplete = createSignal(
		"analysis:complete",
		{ result: "bullish" },
		{ agent: "analyst", parent: analystActivated.id },
	);

	const executorActivated = createSignal(
		"agent:activated",
		{ agent: "executor", trigger: "analysis:complete" },
		{ agent: "executor", parent: analysisComplete.id },
	);

	const harnessStart2 = createSignal(
		"harness:start",
		{},
		{ agent: "executor", parent: executorActivated.id },
	);

	const harnessEnd2 = createSignal(
		"harness:end",
		{ output: "trade executed" },
		{ agent: "executor", parent: executorActivated.id },
	);

	const workflowEnd = createSignal("workflow:end", { durationMs: 1000 });

	return [
		workflowStart,
		analystActivated,
		harnessStart1,
		textDelta,
		harnessEnd1,
		analysisComplete,
		executorActivated,
		harnessStart2,
		harnessEnd2,
		workflowEnd,
	];
}

// ============================================================================
// Tests
// ============================================================================

describe("getCausalityChain", () => {
	it("returns chain from root to target", () => {
		const signals = createTestSignals();
		const executorActivated = signals.find(
			(s) =>
				s.name === "agent:activated" &&
				(s.payload as { agent: string }).agent === "executor",
		)!;

		const chain = getCausalityChain(signals, executorActivated.id);

		expect(chain).toHaveLength(4);
		expect(chain[0].name).toBe("workflow:start");
		expect(chain[1].name).toBe("agent:activated");
		expect(chain[2].name).toBe("analysis:complete");
		expect(chain[3].name).toBe("agent:activated");
	});

	it("returns single signal for root signals", () => {
		const signals = createTestSignals();
		const workflowStart = signals[0];

		const chain = getCausalityChain(signals, workflowStart.id);

		expect(chain).toHaveLength(1);
		expect(chain[0].name).toBe("workflow:start");
	});

	it("returns empty for unknown signal ID", () => {
		const signals = createTestSignals();
		const chain = getCausalityChain(signals, "nonexistent");
		expect(chain).toHaveLength(0);
	});
});

describe("getAgentSignals", () => {
	it("returns all signals from an agent", () => {
		const signals = createTestSignals();
		const analystSignals = getAgentSignals(signals, "analyst");

		expect(analystSignals).toHaveLength(5);
		expect(analystSignals.map((s) => s.name)).toContain("agent:activated");
		expect(analystSignals.map((s) => s.name)).toContain("harness:start");
		expect(analystSignals.map((s) => s.name)).toContain("text:delta");
		expect(analystSignals.map((s) => s.name)).toContain("harness:end");
		expect(analystSignals.map((s) => s.name)).toContain("analysis:complete");
	});

	it("returns empty for unknown agent", () => {
		const signals = createTestSignals();
		const unknownSignals = getAgentSignals(signals, "unknown");
		expect(unknownSignals).toHaveLength(0);
	});
});

describe("getChildSignals", () => {
	it("returns direct children of a signal", () => {
		const signals = createTestSignals();
		const analystActivated = signals.find(
			(s) =>
				s.name === "agent:activated" &&
				(s.payload as { agent: string }).agent === "analyst",
		)!;

		const children = getChildSignals(signals, analystActivated.id);

		expect(children).toHaveLength(4);
		expect(children.map((s) => s.name)).toContain("harness:start");
		expect(children.map((s) => s.name)).toContain("text:delta");
		expect(children.map((s) => s.name)).toContain("harness:end");
		expect(children.map((s) => s.name)).toContain("analysis:complete");
	});
});

describe("buildSignalTree", () => {
	it("builds tree structure from flat signals", () => {
		const signals = createTestSignals();
		const trees = buildSignalTree(signals);

		// Should have 2 root signals (workflow:start and workflow:end)
		expect(trees).toHaveLength(2);
		expect(trees[0].signal.name).toBe("workflow:start");

		// workflow:start should have agent:activated as child
		expect(trees[0].children).toHaveLength(1);
		expect(trees[0].children[0].signal.name).toBe("agent:activated");
	});
});

describe("formatSignalTree", () => {
	it("formats tree as ASCII", () => {
		const signals = createTestSignals();
		const formatted = formatSignalTree(signals);

		expect(formatted).toContain("workflow:start");
		expect(formatted).toContain("agent:activated");
		expect(formatted).toContain("(analyst)");
		expect(formatted).toContain("analysis:complete");
		expect(formatted).toContain("(executor)");
	});
});

describe("getSignalSummary", () => {
	it("counts signals by type", () => {
		const signals = createTestSignals();
		const summary = getSignalSummary(signals);

		expect(summary["workflow:start"]).toBe(1);
		expect(summary["workflow:end"]).toBe(1);
		expect(summary["agent:activated"]).toBe(2);
		expect(summary["harness:start"]).toBe(2);
		expect(summary["harness:end"]).toBe(2);
		expect(summary["text:delta"]).toBe(1);
		expect(summary["analysis:complete"]).toBe(1);
	});
});

describe("filterSignals", () => {
	it("filters by exact name", () => {
		const signals = createTestSignals();
		const filtered = filterSignals(signals, "workflow:start");

		expect(filtered).toHaveLength(1);
		expect(filtered[0].name).toBe("workflow:start");
	});

	it("filters by glob pattern with *", () => {
		const signals = createTestSignals();
		const filtered = filterSignals(signals, "harness:*");

		expect(filtered).toHaveLength(4); // 2 start + 2 end
	});

	it("filters by glob pattern with **", () => {
		const signals = createTestSignals();
		const filtered = filterSignals(signals, "**:complete");

		expect(filtered).toHaveLength(1);
		expect(filtered[0].name).toBe("analysis:complete");
	});

	it("filters by regex", () => {
		const signals = createTestSignals();
		const filtered = filterSignals(signals, /^agent:/);

		expect(filtered).toHaveLength(2);
	});
});
