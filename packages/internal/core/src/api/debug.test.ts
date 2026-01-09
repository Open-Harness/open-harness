/**
 * Tests for debug utilities.
 */

import { describe, it, expect } from "vitest";
import { createSignal, type Signal } from "@signals/core";
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
	// harness:start
	//   └─ agent:activated (analyst)
	//      ├─ provider:start
	//      ├─ text:delta
	//      ├─ provider:end
	//      └─ analysis:complete
	//         └─ agent:activated (executor)
	//            ├─ provider:start
	//            └─ provider:end

	const harnessStart = createSignal("harness:start", { runId: "run_123" });

	const analystActivated = createSignal(
		"agent:activated",
		{ agent: "analyst", trigger: "harness:start" },
		{ agent: "analyst", parent: harnessStart.id },
	);

	const providerStart1 = createSignal(
		"provider:start",
		{},
		{ agent: "analyst", parent: analystActivated.id },
	);

	const textDelta = createSignal(
		"text:delta",
		{ content: "Analyzing..." },
		{ agent: "analyst", parent: analystActivated.id },
	);

	const providerEnd1 = createSignal(
		"provider:end",
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

	const providerStart2 = createSignal(
		"provider:start",
		{},
		{ agent: "executor", parent: executorActivated.id },
	);

	const providerEnd2 = createSignal(
		"provider:end",
		{ output: "trade executed" },
		{ agent: "executor", parent: executorActivated.id },
	);

	const harnessEnd = createSignal("harness:end", { durationMs: 1000 });

	return [
		harnessStart,
		analystActivated,
		providerStart1,
		textDelta,
		providerEnd1,
		analysisComplete,
		executorActivated,
		providerStart2,
		providerEnd2,
		harnessEnd,
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
		expect(chain[0].name).toBe("harness:start");
		expect(chain[1].name).toBe("agent:activated");
		expect(chain[2].name).toBe("analysis:complete");
		expect(chain[3].name).toBe("agent:activated");
	});

	it("returns single signal for root signals", () => {
		const signals = createTestSignals();
		const harnessStart = signals[0];

		const chain = getCausalityChain(signals, harnessStart.id);

		expect(chain).toHaveLength(1);
		expect(chain[0].name).toBe("harness:start");
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
		expect(analystSignals.map((s) => s.name)).toContain("provider:start");
		expect(analystSignals.map((s) => s.name)).toContain("text:delta");
		expect(analystSignals.map((s) => s.name)).toContain("provider:end");
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
		expect(children.map((s) => s.name)).toContain("provider:start");
		expect(children.map((s) => s.name)).toContain("text:delta");
		expect(children.map((s) => s.name)).toContain("provider:end");
		expect(children.map((s) => s.name)).toContain("analysis:complete");
	});
});

describe("buildSignalTree", () => {
	it("builds tree structure from flat signals", () => {
		const signals = createTestSignals();
		const trees = buildSignalTree(signals);

		// Should have 2 root signals (harness:start and harness:end)
		expect(trees).toHaveLength(2);
		expect(trees[0].signal.name).toBe("harness:start");

		// harness:start should have agent:activated as child
		expect(trees[0].children).toHaveLength(1);
		expect(trees[0].children[0].signal.name).toBe("agent:activated");
	});
});

describe("formatSignalTree", () => {
	it("formats tree as ASCII", () => {
		const signals = createTestSignals();
		const formatted = formatSignalTree(signals);

		expect(formatted).toContain("harness:start");
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

		expect(summary["harness:start"]).toBe(1);
		expect(summary["harness:end"]).toBe(1);
		expect(summary["agent:activated"]).toBe(2);
		expect(summary["provider:start"]).toBe(2);
		expect(summary["provider:end"]).toBe(2);
		expect(summary["text:delta"]).toBe(1);
		expect(summary["analysis:complete"]).toBe(1);
	});
});

describe("filterSignals", () => {
	it("filters by exact name", () => {
		const signals = createTestSignals();
		const filtered = filterSignals(signals, "harness:start");

		expect(filtered).toHaveLength(1);
		expect(filtered[0].name).toBe("harness:start");
	});

	it("filters by glob pattern with *", () => {
		const signals = createTestSignals();
		const filtered = filterSignals(signals, "provider:*");

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
