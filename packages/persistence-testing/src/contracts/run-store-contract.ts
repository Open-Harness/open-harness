import { describe, expect, test } from "bun:test";
import type { RuntimeEvent, RunSnapshot, RunStore } from "@open-harness/sdk";

/**
 * Sample event for testing.
 */
export function sampleRuntimeEvent(flowName: string): RuntimeEvent {
	return {
		type: "flow:start",
		flowName,
		timestamp: Date.now(),
	};
}

/**
 * Sample snapshot for testing.
 */
export function sampleRunSnapshot(runId: string): RunSnapshot {
	return {
		runId,
		status: "paused",
		outputs: { a: { value: 1 } },
		state: { counter: 1 },
		nodeStatus: { a: "done" },
		edgeStatus: {},
		loopCounters: {},
		inbox: [],
		agentSessions: {},
	};
}

/**
 * Contract test function for RunStore implementations.
 * Ensures all RunStore implementations behave consistently.
 */
export function runStoreContract(
	name: string,
	createStore: () => {
		store: RunStore;
		cleanup?: () => void;
	},
) {
	describe(name, () => {
		test("append/load events with sequence", () => {
			const { store, cleanup } = createStore();
			store.appendEvent("run-1", sampleRuntimeEvent("one"));
			store.appendEvent("run-1", sampleRuntimeEvent("two"));

			const all = store.loadEvents("run-1");
			expect(all).toHaveLength(2);
			expect(all[0]).toEqual(
				expect.objectContaining({
					type: "flow:start",
					flowName: "one",
				}),
			);
			expect(all[1]).toEqual(
				expect.objectContaining({
					type: "flow:start",
					flowName: "two",
				}),
			);

			const afterFirst = store.loadEvents("run-1", 1);
			expect(afterFirst).toHaveLength(1);
			expect(afterFirst[0]).toEqual(
				expect.objectContaining({
					type: "flow:start",
					flowName: "two",
				}),
			);
			cleanup?.();
		});

		test("save/load snapshots", () => {
			const { store, cleanup } = createStore();
			store.saveSnapshot("run-1", sampleRunSnapshot("run-1"));
			const loaded = store.loadSnapshot("run-1");
			expect(loaded).toEqual(sampleRunSnapshot("run-1"));
			cleanup?.();
		});
	});
}
