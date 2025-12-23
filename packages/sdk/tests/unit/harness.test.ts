/**
 * Harness Types Tests
 *
 * Tests for TypeScript type interfaces used in the harness system.
 * Following TDD: tests written first, implementation follows.
 */

import { describe, expect, test } from "bun:test";
import { PersistentState } from "../../src/harness/state.js";
import type {
	Constraints,
	HarnessConfig,
	LoadedContext,
	StateDelta,
	Step,
	StepYield,
} from "../../src/harness/types.js";

describe("Harness Types", () => {
	test("Step interface has required fields", () => {
		const step: Step<string, number> = {
			stepNumber: 1,
			timestamp: Date.now(),
			input: "test",
			output: 42,
			stateDelta: { modified: [] },
		};
		expect(step.stepNumber).toBe(1);
		expect(step.timestamp).toBeGreaterThan(0);
		expect(step.input).toBe("test");
		expect(step.output).toBe(42);
		expect(step.stateDelta).toBeDefined();
	});

	test("StateDelta tracks modifications", () => {
		const delta: StateDelta = {
			modified: ["balance", "position"],
			summary: "Updated portfolio",
		};
		expect(delta.modified).toContain("balance");
		expect(delta.modified).toContain("position");
		expect(delta.summary).toBe("Updated portfolio");
	});

	test("StateDelta summary is optional", () => {
		const delta: StateDelta = {
			modified: ["balance"],
		};
		expect(delta.modified).toContain("balance");
		expect(delta.summary).toBeUndefined();
	});

	test("LoadedContext provides bounded state", () => {
		const context: LoadedContext<{ count: number }> = {
			state: { count: 5 },
			recentSteps: [],
			relevantKnowledge: {},
		};
		expect(context.state.count).toBe(5);
		expect(context.recentSteps).toEqual([]);
		expect(context.relevantKnowledge).toEqual({});
	});

	test("LoadedContext includes recentSteps", () => {
		const step: Step<string, number> = {
			stepNumber: 1,
			timestamp: Date.now(),
			input: "test",
			output: 42,
			stateDelta: { modified: [] },
		};
		const context: LoadedContext<{ count: number }> = {
			state: { count: 5 },
			recentSteps: [step],
			relevantKnowledge: {},
		};
		expect(context.recentSteps).toHaveLength(1);
		expect(context.recentSteps[0]?.stepNumber).toBe(1);
	});

	test("HarnessConfig has initialState", () => {
		const config: HarnessConfig<{ count: number }> = {
			initialState: { count: 0 },
		};
		expect(config.initialState.count).toBe(0);
	});

	test("HarnessConfig maxContextSteps is optional", () => {
		const config: HarnessConfig<{ count: number }> = {
			initialState: { count: 0 },
		};
		expect(config.maxContextSteps).toBeUndefined();
	});

	test("HarnessConfig can have maxContextSteps", () => {
		const config: HarnessConfig<{ count: number }> = {
			initialState: { count: 0 },
			maxContextSteps: 10,
		};
		expect(config.maxContextSteps).toBe(10);
	});

	test("StepYield has input and output fields", () => {
		const yieldValue: StepYield<string, number> = {
			input: "test",
			output: 42,
		};
		expect(yieldValue.input).toBe("test");
		expect(yieldValue.output).toBe(42);
	});

	test("Constraints provides flexible key-value structure", () => {
		const constraints: Constraints = {
			maxIterations: 10,
			timeout: 5000,
			allowRetries: true,
		};
		expect(constraints.maxIterations).toBe(10);
		expect(constraints.timeout).toBe(5000);
		expect(constraints.allowRetries).toBe(true);
	});

	test("Constraints can have string values", () => {
		const constraints: Constraints = {
			mode: "strict",
			level: "high",
		};
		expect(constraints.mode).toBe("strict");
		expect(constraints.level).toBe("high");
	});

	test("Constraints can have mixed types", () => {
		const constraints: Constraints = {
			maxIterations: 10,
			mode: "strict",
			enabled: true,
		};
		expect(constraints.maxIterations).toBe(10);
		expect(constraints.mode).toBe("strict");
		expect(constraints.enabled).toBe(true);
	});
});

describe("PersistentState", () => {
	test("initializes with provided state", () => {
		const state = new PersistentState({ initialState: { count: 0 } });
		expect(state.getState()).toEqual({ count: 0 });
	});

	test("updateState modifies state immutably", () => {
		const state = new PersistentState({ initialState: { count: 0 } });
		state.updateState((s) => ({ count: s.count + 1 }));
		expect(state.getState()).toEqual({ count: 1 });
	});

	test("record adds step to history", () => {
		const state = new PersistentState({ initialState: {} });
		state.record(1, "input-a", "output-a", { modified: [] });
		state.record(2, "input-b", "output-b", { modified: [] });

		const history = state.getStepHistory();
		expect(history.length).toBe(2);
		expect(history[0]?.stepNumber).toBe(1);
		expect(history[1]?.stepNumber).toBe(2);
	});

	test("loadContext returns bounded context", () => {
		const state = new PersistentState({
			initialState: { count: 0 },
			maxContextSteps: 5,
		});

		// Record 10 steps
		for (let i = 1; i <= 10; i++) {
			state.record(i, `input-${i}`, `output-${i}`, { modified: [] });
		}

		const context = state.loadContext();
		expect(context.recentSteps.length).toBe(5); // Bounded to maxContextSteps
		expect(context.recentSteps[0]?.stepNumber).toBe(6); // Most recent 5
		expect(context.state).toEqual({ count: 0 });
	});

	test("getRecentSteps returns last N steps", () => {
		const state = new PersistentState({ initialState: {} });
		state.record(1, "a", "A", { modified: [] });
		state.record(2, "b", "B", { modified: [] });
		state.record(3, "c", "C", { modified: [] });

		const recent = state.getRecentSteps(2);
		expect(recent.length).toBe(2);
		expect(recent[0]?.input).toBe("b");
		expect(recent[1]?.input).toBe("c");
	});
});
