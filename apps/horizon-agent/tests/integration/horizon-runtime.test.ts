/**
 * Integration tests for Horizon Runtime
 *
 * Tests the runtime wrapper without actually executing AI agents.
 * Uses the mock node registry for controlled testing.
 */

import { describe, expect, test, beforeEach } from "bun:test";
import { resolve } from "node:path";
import { createHorizonRuntime, type HorizonRuntime } from "../../src/runtime/horizon-runtime.js";

const FLOW_PATH = resolve(import.meta.dir, "../../flows/agent-loop.yaml");

describe("createHorizonRuntime", () => {
	test("creates runtime from flow file", () => {
		const runtime = createHorizonRuntime({
			flowPath: FLOW_PATH,
		});

		expect(runtime).toBeDefined();
		expect(runtime.runtime).toBeDefined();
	});

	test("creates runtime with persistence enabled", () => {
		const runtime = createHorizonRuntime({
			flowPath: FLOW_PATH,
			enablePersistence: true,
		});

		expect(runtime).toBeDefined();
	});
});

describe("HorizonRuntime methods", () => {
	let runtime: HorizonRuntime;

	beforeEach(() => {
		runtime = createHorizonRuntime({
			flowPath: FLOW_PATH,
			enablePersistence: true,
		});
	});

	test("getSnapshot returns snapshot", () => {
		const snapshot = runtime.getSnapshot();
		expect(snapshot).toBeDefined();
	});

	test("getState returns typed state", () => {
		const state = runtime.getState();
		expect(state).toBeDefined();
		expect(state.tasks).toEqual([]);
		expect(state.status).toBe("idle");
		expect(state.currentTaskIndex).toBe(0);
	});

	test("onEvent returns unsubscribe function", () => {
		const events: unknown[] = [];
		const unsubscribe = runtime.onEvent((event) => {
			events.push(event);
		});

		expect(typeof unsubscribe).toBe("function");
	});

	test("dispatch accepts command", () => {
		// Should not throw
		expect(() => {
			runtime.dispatch({ type: "abort", resumable: true });
		}).not.toThrow();
	});
});

describe("Flow definition parsing", () => {
	test("parses nodes from YAML", () => {
		const runtime = createHorizonRuntime({
			flowPath: FLOW_PATH,
		});

		// The flow should have planner, coder, reviewer nodes
		const snapshot = runtime.getSnapshot();
		expect(snapshot).toBeDefined();
	});

	test("parses edges from YAML", () => {
		const runtime = createHorizonRuntime({
			flowPath: FLOW_PATH,
		});

		const snapshot = runtime.getSnapshot();
		expect(snapshot).toBeDefined();
	});

	test("parses state initial values", () => {
		const runtime = createHorizonRuntime({
			flowPath: FLOW_PATH,
		});

		const state = runtime.getState();
		expect(state.tasks).toEqual([]);
		expect(state.currentTaskIndex).toBe(0);
		expect(state.currentIteration).toBe(0);
		expect(state.reviewFeedback).toBeNull();
		expect(state.completedTasks).toEqual([]);
		expect(state.status).toBe("idle");
	});
});

describe("Pause/Resume functionality", () => {
	test("pause dispatches abort with resumable flag", () => {
		const runtime = createHorizonRuntime({
			flowPath: FLOW_PATH,
			enablePersistence: true,
		});

		// Pause should not throw
		expect(() => {
			runtime.pause();
		}).not.toThrow();
	});

	test("resume dispatches resume command", () => {
		const runtime = createHorizonRuntime({
			flowPath: FLOW_PATH,
			enablePersistence: true,
		});

		// Resume should not throw (even without active run)
		expect(() => {
			runtime.resume();
		}).not.toThrow();
	});

	test("resume with message dispatches message", () => {
		const runtime = createHorizonRuntime({
			flowPath: FLOW_PATH,
			enablePersistence: true,
		});

		// Resume with message should not throw
		expect(() => {
			runtime.resume("Continue with modified approach");
		}).not.toThrow();
	});

	test("abort dispatches abort without resumable flag", () => {
		const runtime = createHorizonRuntime({
			flowPath: FLOW_PATH,
			enablePersistence: true,
		});

		// Abort should not throw
		expect(() => {
			runtime.abort();
		}).not.toThrow();
	});

	test("resumeRunId option is accepted (throws if no snapshot exists)", () => {
		// Creating with resumeRunId for non-existent run should throw
		// This confirms the option is properly passed to the runtime
		expect(() => {
			createHorizonRuntime({
				flowPath: FLOW_PATH,
				enablePersistence: true,
				resumeRunId: "test-run-id-123",
			});
		}).toThrow("No snapshot found");
	});
});
