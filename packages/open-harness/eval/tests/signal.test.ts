/**
 * Signal assertion tests.
 *
 * Tests for signal.contains, signal.not, signal.count, signal.trajectory,
 * signal.first, and signal.last assertions.
 */

import type { Signal } from "@signals/core";
import { describe, expect, it } from "vitest";
import {
	evaluateSignalContains,
	evaluateSignalCount,
	evaluateSignalFirst,
	evaluateSignalLast,
	evaluateSignalNot,
	evaluateSignalTrajectory,
} from "../src/assertions/signal.js";
import type {
	SignalContainsAssertion,
	SignalCountAssertion,
	SignalFirstAssertion,
	SignalLastAssertion,
	SignalNotAssertion,
	SignalTrajectoryAssertion,
} from "../src/assertions/types.js";

// Helper to create test signals
let signalCounter = 0;
function signal(name: string, payload?: Record<string, unknown>): Signal {
	return {
		id: `sig_test_${++signalCounter}`,
		name,
		timestamp: new Date().toISOString(),
		payload: payload ?? {},
	};
}

describe("signal.contains", () => {
	it("passes when signal exists", () => {
		const signals = [signal("agent.start"), signal("tool.call"), signal("agent.end")];

		const assertion: SignalContainsAssertion = {
			type: "signal.contains",
			pattern: "tool.call",
		};

		const result = evaluateSignalContains(assertion, signals);
		expect(result.passed).toBe(true);
	});

	it("fails when signal does not exist", () => {
		const signals = [signal("agent.start"), signal("agent.end")];

		const assertion: SignalContainsAssertion = {
			type: "signal.contains",
			pattern: "tool.call",
		};

		const result = evaluateSignalContains(assertion, signals);
		expect(result.passed).toBe(false);
		expect(result.message).toContain("No signal matching pattern");
	});

	it("supports glob patterns", () => {
		// Signal names use : as segment separator per @signals/bus convention
		const signals = [signal("agent:start"), signal("tool:call:read_file"), signal("agent:end")];

		const assertion: SignalContainsAssertion = {
			type: "signal.contains",
			pattern: "tool:call:*",
		};

		const result = evaluateSignalContains(assertion, signals);
		expect(result.passed).toBe(true);
	});

	it("supports double-star glob patterns", () => {
		// ** matches across : segments
		const signals = [signal("agent:start"), signal("tool:call:nested:deep:value"), signal("agent:end")];

		const assertion: SignalContainsAssertion = {
			type: "signal.contains",
			pattern: "tool:**",
		};

		const result = evaluateSignalContains(assertion, signals);
		expect(result.passed).toBe(true);
	});

	it("validates payload when specified", () => {
		const signals = [signal("tool.call", { name: "read_file", path: "/test.txt" })];

		const assertion: SignalContainsAssertion = {
			type: "signal.contains",
			pattern: "tool.call",
			payload: { name: "read_file" },
		};

		const result = evaluateSignalContains(assertion, signals);
		expect(result.passed).toBe(true);
	});

	it("fails when payload does not match", () => {
		const signals = [signal("tool.call", { name: "write_file" })];

		const assertion: SignalContainsAssertion = {
			type: "signal.contains",
			pattern: "tool.call",
			payload: { name: "read_file" },
		};

		const result = evaluateSignalContains(assertion, signals);
		expect(result.passed).toBe(false);
		expect(result.message).toContain("payload didn't match");
	});
});

describe("signal.not", () => {
	it("passes when signal does not exist", () => {
		const signals = [signal("agent.start"), signal("agent.end")];

		const assertion: SignalNotAssertion = {
			type: "signal.not",
			pattern: "error.*",
		};

		const result = evaluateSignalNot(assertion, signals);
		expect(result.passed).toBe(true);
	});

	it("fails when signal exists", () => {
		// Use : separator for glob patterns
		const signals = [signal("agent:start"), signal("error:api_failure"), signal("agent:end")];

		const assertion: SignalNotAssertion = {
			type: "signal.not",
			pattern: "error:*",
		};

		const result = evaluateSignalNot(assertion, signals);
		expect(result.passed).toBe(false);
		expect(result.message).toContain("Found 1 signal(s)");
	});
});

describe("signal.count", () => {
	it("passes with exact count", () => {
		const signals = [signal("tool.call"), signal("tool.call"), signal("tool.call")];

		const assertion: SignalCountAssertion = {
			type: "signal.count",
			pattern: "tool.call",
			exact: 3,
		};

		const result = evaluateSignalCount(assertion, signals);
		expect(result.passed).toBe(true);
	});

	it("fails with wrong exact count", () => {
		const signals = [signal("tool.call"), signal("tool.call")];

		const assertion: SignalCountAssertion = {
			type: "signal.count",
			pattern: "tool.call",
			exact: 3,
		};

		const result = evaluateSignalCount(assertion, signals);
		expect(result.passed).toBe(false);
		expect(result.actual).toBe(2);
	});

	it("passes with min constraint", () => {
		const signals = [signal("tool.call"), signal("tool.call"), signal("tool.call")];

		const assertion: SignalCountAssertion = {
			type: "signal.count",
			pattern: "tool.call",
			min: 2,
		};

		const result = evaluateSignalCount(assertion, signals);
		expect(result.passed).toBe(true);
	});

	it("passes with max constraint", () => {
		const signals = [signal("tool.call"), signal("tool.call")];

		const assertion: SignalCountAssertion = {
			type: "signal.count",
			pattern: "tool.call",
			max: 5,
		};

		const result = evaluateSignalCount(assertion, signals);
		expect(result.passed).toBe(true);
	});

	it("passes with min and max range", () => {
		const signals = [signal("tool.call"), signal("tool.call"), signal("tool.call")];

		const assertion: SignalCountAssertion = {
			type: "signal.count",
			pattern: "tool.call",
			min: 2,
			max: 5,
		};

		const result = evaluateSignalCount(assertion, signals);
		expect(result.passed).toBe(true);
	});

	it("fails when count below min", () => {
		const signals = [signal("tool.call")];

		const assertion: SignalCountAssertion = {
			type: "signal.count",
			pattern: "tool.call",
			min: 2,
		};

		const result = evaluateSignalCount(assertion, signals);
		expect(result.passed).toBe(false);
	});

	it("fails when count above max", () => {
		const signals = [signal("tool.call"), signal("tool.call"), signal("tool.call"), signal("tool.call")];

		const assertion: SignalCountAssertion = {
			type: "signal.count",
			pattern: "tool.call",
			max: 2,
		};

		const result = evaluateSignalCount(assertion, signals);
		expect(result.passed).toBe(false);
	});
});

describe("signal.trajectory", () => {
	it("passes when signals appear in order (non-strict)", () => {
		const signals = [
			signal("agent.start"),
			signal("tool.call"),
			signal("tool.result"),
			signal("agent.response"),
			signal("agent.end"),
		];

		const assertion: SignalTrajectoryAssertion = {
			type: "signal.trajectory",
			patterns: ["agent.start", "tool.call", "agent.end"],
		};

		const result = evaluateSignalTrajectory(assertion, signals);
		expect(result.passed).toBe(true);
		expect(result.trajectory).toEqual(["agent.start", "tool.call", "agent.end"]);
	});

	it("fails when signals appear out of order", () => {
		const signals = [signal("agent.end"), signal("tool.call"), signal("agent.start")];

		const assertion: SignalTrajectoryAssertion = {
			type: "signal.trajectory",
			patterns: ["agent.start", "tool.call", "agent.end"],
		};

		const result = evaluateSignalTrajectory(assertion, signals);
		expect(result.passed).toBe(false);
		expect(result.message).toContain("incomplete");
	});

	it("fails when pattern is missing", () => {
		const signals = [signal("agent.start"), signal("agent.end")];

		const assertion: SignalTrajectoryAssertion = {
			type: "signal.trajectory",
			patterns: ["agent.start", "tool.call", "agent.end"],
		};

		const result = evaluateSignalTrajectory(assertion, signals);
		expect(result.passed).toBe(false);
		expect(result.message).toContain("missing patterns");
	});

	it("strict mode fails on unexpected signals between patterns", () => {
		const signals = [signal("agent.start"), signal("unexpected.signal"), signal("agent.end")];

		const assertion: SignalTrajectoryAssertion = {
			type: "signal.trajectory",
			patterns: ["agent.start", "agent.end"],
			strict: true,
		};

		const result = evaluateSignalTrajectory(assertion, signals);
		expect(result.passed).toBe(false);
		expect(result.message).toContain("Unexpected signal");
	});

	it("non-strict mode allows signals between patterns", () => {
		const signals = [signal("agent.start"), signal("tool.call"), signal("logging.debug"), signal("agent.end")];

		const assertion: SignalTrajectoryAssertion = {
			type: "signal.trajectory",
			patterns: ["agent.start", "agent.end"],
			strict: false,
		};

		const result = evaluateSignalTrajectory(assertion, signals);
		expect(result.passed).toBe(true);
	});

	it("supports payload matching in trajectory", () => {
		const signals = [
			signal("tool.call", { name: "read_file" }),
			signal("tool.call", { name: "write_file" }),
			signal("agent.end"),
		];

		const assertion: SignalTrajectoryAssertion = {
			type: "signal.trajectory",
			patterns: [
				{ pattern: "tool.call", payload: { name: "read_file" } },
				{ pattern: "tool.call", payload: { name: "write_file" } },
				"agent.end",
			],
		};

		const result = evaluateSignalTrajectory(assertion, signals);
		expect(result.passed).toBe(true);
	});

	it("supports glob patterns in trajectory", () => {
		// Use : separator for glob patterns to work correctly
		const signals = [
			signal("agent:start"),
			signal("tool:call:read_file"),
			signal("tool:call:write_file"),
			signal("agent:end"),
		];

		const assertion: SignalTrajectoryAssertion = {
			type: "signal.trajectory",
			patterns: ["agent:start", "tool:call:*", "tool:call:*", "agent:end"],
		};

		const result = evaluateSignalTrajectory(assertion, signals);
		expect(result.passed).toBe(true);
	});
});

describe("signal.first", () => {
	it("finds first matching signal", () => {
		const signals = [
			signal("agent.start"),
			signal("tool.call", { name: "first" }),
			signal("tool.call", { name: "second" }),
		];

		const assertion: SignalFirstAssertion = {
			type: "signal.first",
			pattern: "tool.call",
		};

		const result = evaluateSignalFirst(assertion, signals);
		expect(result.passed).toBe(true);
		expect(result.actual).toEqual({ name: "first" });
	});

	it("fails when no signal matches", () => {
		const signals = [signal("agent.start"), signal("agent.end")];

		const assertion: SignalFirstAssertion = {
			type: "signal.first",
			pattern: "tool.call",
		};

		const result = evaluateSignalFirst(assertion, signals);
		expect(result.passed).toBe(false);
	});

	it("validates payload of first signal", () => {
		const signals = [signal("tool.call", { name: "expected_tool" })];

		const assertion: SignalFirstAssertion = {
			type: "signal.first",
			pattern: "tool.call",
			payload: { name: "expected_tool" },
		};

		const result = evaluateSignalFirst(assertion, signals);
		expect(result.passed).toBe(true);
	});

	it("fails when first signal payload does not match", () => {
		const signals = [signal("tool.call", { name: "wrong_tool" })];

		const assertion: SignalFirstAssertion = {
			type: "signal.first",
			pattern: "tool.call",
			payload: { name: "expected_tool" },
		};

		const result = evaluateSignalFirst(assertion, signals);
		expect(result.passed).toBe(false);
		expect(result.message).toContain("payload didn't match");
	});
});

describe("signal.last", () => {
	it("finds last matching signal", () => {
		const signals = [
			signal("tool.call", { name: "first" }),
			signal("tool.call", { name: "second" }),
			signal("agent.end"),
		];

		const assertion: SignalLastAssertion = {
			type: "signal.last",
			pattern: "tool.call",
		};

		const result = evaluateSignalLast(assertion, signals);
		expect(result.passed).toBe(true);
		expect(result.actual).toEqual({ name: "second" });
	});

	it("fails when no signal matches", () => {
		const signals = [signal("agent.start"), signal("agent.end")];

		const assertion: SignalLastAssertion = {
			type: "signal.last",
			pattern: "tool.call",
		};

		const result = evaluateSignalLast(assertion, signals);
		expect(result.passed).toBe(false);
	});

	it("validates payload of last signal", () => {
		const signals = [signal("tool.call", { name: "first" }), signal("tool.call", { name: "expected_tool" })];

		const assertion: SignalLastAssertion = {
			type: "signal.last",
			pattern: "tool.call",
			payload: { name: "expected_tool" },
		};

		const result = evaluateSignalLast(assertion, signals);
		expect(result.passed).toBe(true);
	});

	it("fails when last signal payload does not match", () => {
		const signals = [signal("tool.call", { name: "expected_tool" }), signal("tool.call", { name: "wrong_tool" })];

		const assertion: SignalLastAssertion = {
			type: "signal.last",
			pattern: "tool.call",
			payload: { name: "expected_tool" },
		};

		const result = evaluateSignalLast(assertion, signals);
		expect(result.passed).toBe(false);
		expect(result.message).toContain("payload didn't match");
	});
});
