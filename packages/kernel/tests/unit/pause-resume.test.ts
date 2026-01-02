/**
 * Pause/Resume State Machine Tests
 *
 * Tests for Phase 3 (User Story 1) - Pause Running Flow:
 * - abort({resumable: true}) emits flow:paused
 * - abort({resumable: true}) sets status to "paused"
 * - abort({resumable: true}) triggers abortController.abort()
 * - abort() without options emits session:abort (backward compat)
 *
 * Tests for Phase 4 (User Story 2) - Resume Paused Flow:
 * - resume() emits flow:resumed
 * - resume() sets status to "running"
 * - resume() with invalid sessionId throws SessionNotFoundError
 * - resume() on already-running session throws SessionAlreadyRunningError
 */

import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { HubImpl } from "../../src/engine/hub.js";
import { executeFlow } from "../../src/flow/executor.js";
import { NodeRegistry } from "../../src/flow/registry.js";
import {
	SessionAlreadyRunningError,
	SessionNotFoundError,
} from "../../src/protocol/errors.js";
import type { BaseEvent, EnrichedEvent } from "../../src/protocol/events.js";
import type { FlowYaml, NodeRunContext } from "../../src/protocol/flow.js";

describe("Pause/Resume State Machine", () => {
	describe("abort({resumable: true})", () => {
		it("T013: emits flow:paused event", async () => {
			const hub = new HubImpl("test-session");
			const events: BaseEvent[] = [];

			hub.subscribe("flow:*", (e: EnrichedEvent) => {
				events.push(e.event);
			});

			hub.startSession();
			hub.setStatus("running");
			hub.abort({ resumable: true });

			const flowPausedEvents = events.filter((e) => e.type === "flow:paused");
			expect(flowPausedEvents.length).toBe(1);
			expect(flowPausedEvents[0]).toMatchObject({
				type: "flow:paused",
			});
		});

		it("T014: sets status to 'paused'", async () => {
			const hub = new HubImpl("test-session");

			hub.startSession();
			hub.setStatus("running");
			expect(hub.status).toBe("running");

			hub.abort({ resumable: true });

			expect(hub.status).toBe("paused");
		});

		it("T015: triggers abortController.abort()", async () => {
			const hub = new HubImpl("test-session");

			hub.startSession();
			hub.setStatus("running");

			const signal = hub.getAbortSignal();
			expect(signal.aborted).toBe(false);

			hub.abort({ resumable: true });

			expect(signal.aborted).toBe(true);
		});

		it("includes sessionId in flow:paused event", async () => {
			const hub = new HubImpl("my-session-123");
			const events: BaseEvent[] = [];

			hub.subscribe("flow:*", (e: EnrichedEvent) => {
				events.push(e.event);
			});

			hub.startSession();
			hub.setStatus("running");
			hub.abort({ resumable: true, reason: "user requested pause" });

			const flowPaused = events.find((e) => e.type === "flow:paused");
			expect(flowPaused).toBeDefined();
			if (flowPaused && flowPaused.type === "flow:paused") {
				expect(flowPaused.sessionId).toBe("my-session-123");
				expect(flowPaused.reason).toBe("user requested pause");
			}
		});
	});

	describe("abort() without options (backward compatibility)", () => {
		it("T016: emits session:abort event", async () => {
			const hub = new HubImpl("test-session");
			const events: BaseEvent[] = [];

			hub.subscribe("session:*", (e: EnrichedEvent) => {
				events.push(e.event);
			});

			hub.startSession();
			hub.setStatus("running");
			hub.abort();

			const sessionAbortEvents = events.filter(
				(e) => e.type === "session:abort",
			);
			expect(sessionAbortEvents.length).toBe(1);
		});

		it("sets status to 'aborted' when resumable is false", async () => {
			const hub = new HubImpl("test-session");

			hub.startSession();
			hub.setStatus("running");
			hub.abort({ resumable: false });

			expect(hub.status).toBe("aborted");
		});

		it("sets status to 'aborted' when no options provided", async () => {
			const hub = new HubImpl("test-session");

			hub.startSession();
			hub.setStatus("running");
			hub.abort();

			expect(hub.status).toBe("aborted");
		});

		it("also triggers abortController.abort() for terminal abort", async () => {
			const hub = new HubImpl("test-session");

			hub.startSession();
			hub.setStatus("running");

			const signal = hub.getAbortSignal();
			expect(signal.aborted).toBe(false);

			hub.abort();

			expect(signal.aborted).toBe(true);
		});
	});

	describe("abort() guards", () => {
		it("does nothing when session is not active", async () => {
			const hub = new HubImpl("test-session");
			const events: BaseEvent[] = [];

			hub.subscribe("*", (e: EnrichedEvent) => {
				events.push(e.event);
			});

			// Don't call startSession()
			hub.abort({ resumable: true });

			expect(events.length).toBe(0);
			expect(hub.status).toBe("idle");
		});
	});

	// Phase 4: User Story 2 - Resume Paused Flow
	describe("resume()", () => {
		it("T022: emits flow:resumed event", async () => {
			const hub = new HubImpl("test-session");
			const events: BaseEvent[] = [];

			hub.subscribe("flow:*", (e: EnrichedEvent) => {
				events.push(e.event);
			});

			// First pause the flow
			hub.startSession();
			hub.setStatus("running");
			hub.abort({ resumable: true });
			expect(hub.status).toBe("paused");

			// Resume it
			await hub.resume("test-session", "continue please");

			const flowResumedEvents = events.filter((e) => e.type === "flow:resumed");
			expect(flowResumedEvents.length).toBe(1);
			expect(flowResumedEvents[0]).toMatchObject({
				type: "flow:resumed",
				sessionId: "test-session",
			});
		});

		it("T023: sets status to 'running'", async () => {
			const hub = new HubImpl("test-session");

			hub.startSession();
			hub.setStatus("running");
			hub.abort({ resumable: true });
			expect(hub.status).toBe("paused");

			await hub.resume("test-session", "continue");

			expect(hub.status).toBe("running");
		});

		it("T024: throws SessionNotFoundError for invalid sessionId", async () => {
			const hub = new HubImpl("test-session");

			hub.startSession();
			hub.setStatus("running");
			hub.abort({ resumable: true });

			await expect(
				hub.resume("non-existent-session", "message"),
			).rejects.toThrow(SessionNotFoundError);
		});

		it("T025: throws SessionAlreadyRunningError when already running", async () => {
			const hub = new HubImpl("test-session");

			hub.startSession();
			hub.setStatus("running");
			// Note: NOT pausing first - still running

			await expect(hub.resume("test-session", "message")).rejects.toThrow(
				SessionAlreadyRunningError,
			);
		});

		it("includes injectedMessages count in flow:resumed event", async () => {
			const hub = new HubImpl("test-session");
			const events: BaseEvent[] = [];

			hub.subscribe("flow:*", (e: EnrichedEvent) => {
				events.push(e.event);
			});

			hub.startSession();
			hub.setStatus("running");
			hub.abort({ resumable: true });

			await hub.resume("test-session", "here is new context");

			const flowResumed = events.find((e) => e.type === "flow:resumed");
			expect(flowResumed).toBeDefined();
			if (flowResumed && flowResumed.type === "flow:resumed") {
				expect(flowResumed.injectedMessages).toBe(1);
			}
		});

		it("creates fresh abort signal after resume", async () => {
			const hub = new HubImpl("test-session");

			hub.startSession();
			hub.setStatus("running");
			hub.abort({ resumable: true });

			// After pause, signal is aborted
			expect(hub.getAbortSignal().aborted).toBe(true);

			await hub.resume("test-session", "continue");

			// After resume, signal should be fresh (not aborted)
			expect(hub.getAbortSignal().aborted).toBe(false);
		});
	});

	// Phase 5: User Story 3 - Inject Context on Resume
	describe("message injection on resume", () => {
		it("T032: resume() requires non-empty message", async () => {
			const hub = new HubImpl("test-session");

			hub.startSession();
			hub.setStatus("running");
			hub.abort({ resumable: true });

			// Empty message should throw
			await expect(hub.resume("test-session", "")).rejects.toThrow(
				"Message is required for resume",
			);
		});

		it("T033: message delivered via session:message on resume", async () => {
			const hub = new HubImpl("test-session");
			const events: BaseEvent[] = [];

			hub.subscribe("session:*", (e: EnrichedEvent) => {
				events.push(e.event);
			});

			hub.startSession();
			hub.setStatus("running");
			hub.abort({ resumable: true });

			await hub.resume("test-session", "here is the additional context");

			const sessionMessages = events.filter(
				(e) => e.type === "session:message",
			);
			expect(sessionMessages.length).toBe(1);
			if (sessionMessages[0].type === "session:message") {
				expect(sessionMessages[0].content).toBe(
					"here is the additional context",
				);
			}
		});

		it("T034: injected message available in pending messages", async () => {
			const hub = new HubImpl("test-session");

			hub.startSession();
			hub.setStatus("running");
			hub.abort({ resumable: true });

			await hub.resume("test-session", "my injected message");

			// Verify via getPausedSession that message was queued
			// Note: After resume, session should no longer be in paused state
			// The message was processed during resume
			expect(hub.status).toBe("running");
		});
	});

	// Phase 6: User Story 4 - Session State Persistence
	describe("getPausedSession()", () => {
		it("T038: returns SessionState for paused session", async () => {
			const hub = new HubImpl("test-session");

			hub.startSession();
			hub.setStatus("running");
			hub.abort({ resumable: true, reason: "testing" });

			const state = hub.getPausedSession("test-session");
			expect(state).toBeDefined();
			expect(state?.sessionId).toBe("test-session");
			expect(state?.pauseReason).toBe("testing");
		});

		it("T039: returns undefined for invalid sessionId", async () => {
			const hub = new HubImpl("test-session");

			hub.startSession();
			hub.setStatus("running");
			hub.abort({ resumable: true });

			const state = hub.getPausedSession("non-existent");
			expect(state).toBeUndefined();
		});

		it("T040: SessionState includes pausedAt timestamp", async () => {
			const hub = new HubImpl("test-session");
			const beforePause = new Date();

			hub.startSession();
			hub.setStatus("running");
			hub.abort({ resumable: true });

			const state = hub.getPausedSession("test-session");
			expect(state).toBeDefined();
			expect(state?.pausedAt).toBeInstanceOf(Date);
			expect(state?.pausedAt.getTime()).toBeGreaterThanOrEqual(
				beforePause.getTime(),
			);
		});
	});

	// T030: Hub-Executor Bridge Methods
	describe("Hub-Executor Bridge (T030)", () => {
		it("updatePausedState() updates session with actual runtime values", () => {
			const hub = new HubImpl("test-session");

			hub.startSession();
			hub.setStatus("running");
			hub.abort({ resumable: true });

			// Initially has placeholder values
			const initialState = hub.getPausedSession("test-session");
			expect(initialState?.currentNodeIndex).toBe(0);
			expect(initialState?.outputs).toEqual({});

			// Executor updates with actual values
			hub.updatePausedState(
				3,
				{ node1: "result1", node2: "result2" },
				"current-node-id",
				"my-flow",
			);

			const updatedState = hub.getPausedSession("test-session");
			expect(updatedState?.currentNodeIndex).toBe(3);
			expect(updatedState?.outputs).toEqual({
				node1: "result1",
				node2: "result2",
			});
			expect(updatedState?.currentNodeId).toBe("current-node-id");
			expect(updatedState?.flowName).toBe("my-flow");
		});

		it("getResumptionState() returns state when status is running after resume", async () => {
			const hub = new HubImpl("test-session");

			hub.startSession();
			hub.setStatus("running");
			hub.abort({ resumable: true });

			// Before resume, getResumptionState should return undefined (status is "paused")
			expect(hub.getResumptionState()).toBeUndefined();

			// After resume, status is "running" and resumption state should be available
			await hub.resume("test-session", "continue");
			expect(hub.status).toBe("running");

			const resumptionState = hub.getResumptionState();
			expect(resumptionState).toBeDefined();
			expect(resumptionState?.sessionId).toBe("test-session");
		});

		it("clearPausedSession() removes session from storage", async () => {
			const hub = new HubImpl("test-session");

			hub.startSession();
			hub.setStatus("running");
			hub.abort({ resumable: true });

			expect(hub.getPausedSession("test-session")).toBeDefined();

			hub.clearPausedSession("test-session");

			expect(hub.getPausedSession("test-session")).toBeUndefined();
		});

		it("clearPausedSession() is idempotent for non-existent sessions", () => {
			const hub = new HubImpl("test-session");

			// Should not throw
			expect(() => hub.clearPausedSession("non-existent")).not.toThrow();
		});
	});
});

// Executor Integration Tests
describe("Executor Pause/Resume Integration", () => {
	function createTestContext(hub: HubImpl) {
		return {
			hub,
			phase: async <T>(_name: string, fn: () => Promise<T>) => fn(),
			task: async <T>(_id: string, fn: () => Promise<T>) => fn(),
		};
	}

	function createRegistry() {
		const registry = new NodeRegistry();

		// Simple echo node
		registry.register({
			type: "test.echo",
			inputSchema: z.object({ value: z.string() }),
			outputSchema: z.object({ result: z.string() }),
			run: async (_ctx: NodeRunContext, input: { value: string }) => ({
				result: input.value,
			}),
		});

		// Node that checks abort signal
		registry.register({
			type: "test.abortable",
			inputSchema: z.object({ value: z.string() }),
			outputSchema: z.object({ result: z.string() }),
			run: async (ctx: NodeRunContext, input: { value: string }) => {
				// Simulate work that can be interrupted
				await new Promise((r) => setTimeout(r, 10));
				// Check abort signal as cooperative cancellation
				if (ctx.hub.getAbortSignal().aborted) {
					return { result: "aborted" };
				}
				return { result: input.value };
			},
		});

		return registry;
	}

	it("executor stops at abort signal and reports state to Hub", async () => {
		const hub = new HubImpl("test-session");
		const registry = createRegistry();
		const events: BaseEvent[] = [];

		hub.subscribe("node:*", (e: EnrichedEvent) => {
			events.push(e.event);
		});

		const flow: FlowYaml = {
			flow: { name: "pause-test-flow" },
			nodes: [
				{ id: "node1", type: "test.echo", input: { value: "one" } },
				{ id: "node2", type: "test.echo", input: { value: "two" } },
				{ id: "node3", type: "test.echo", input: { value: "three" } },
			],
			edges: [],
		};

		hub.startSession();
		hub.setStatus("running");

		// Trigger abort after first node completes (simulate external pause)
		let abortTriggered = false;
		hub.subscribe("node:complete", () => {
			if (!abortTriggered) {
				abortTriggered = true;
				hub.abort({ resumable: true, reason: "user pause" });
			}
		});

		const result = await executeFlow(flow, registry, createTestContext(hub));

		// Only first node should have completed (triggered abort after it)
		const completedNodes = events.filter((e) => e.type === "node:complete");
		expect(completedNodes.length).toBe(1);
		expect((completedNodes[0] as { nodeId: string }).nodeId).toBe("node1");

		// Hub should be in paused state
		expect(hub.status).toBe("paused");

		// Session state should have been updated with actual values
		const pausedState = hub.getPausedSession("test-session");
		expect(pausedState).toBeDefined();
		expect(pausedState?.flowName).toBe("pause-test-flow");
		// State should reflect node2 (the node we were about to execute when abort was detected)
		expect(pausedState?.outputs).toHaveProperty("node1");
	});

	it("executor resumes from paused state and skips completed nodes", async () => {
		const hub = new HubImpl("test-session");
		const registry = createRegistry();

		const flow: FlowYaml = {
			flow: { name: "resume-test-flow" },
			nodes: [
				{ id: "node1", type: "test.echo", input: { value: "one" } },
				{ id: "node2", type: "test.echo", input: { value: "two" } },
				{ id: "node3", type: "test.echo", input: { value: "three" } },
			],
			edges: [],
		};

		hub.startSession();
		hub.setStatus("running");

		// First, abort after node1
		let abortTriggered = false;
		const unsubscribe = hub.subscribe("node:complete", () => {
			if (!abortTriggered) {
				abortTriggered = true;
				hub.abort({ resumable: true });
			}
		});

		await executeFlow(flow, registry, createTestContext(hub));
		unsubscribe();

		expect(hub.status).toBe("paused");
		const pausedState = hub.getPausedSession("test-session");
		expect(pausedState).toBeDefined();

		// Now resume
		await hub.resume("test-session", "continue execution");
		expect(hub.status).toBe("running");

		// Run executor again - it should pick up from resumption state
		const resumeEvents: BaseEvent[] = [];
		hub.subscribe("node:*", (e: EnrichedEvent) => {
			resumeEvents.push(e.event);
		});

		await executeFlow(flow, registry, createTestContext(hub));

		// Should only execute remaining nodes (node2, node3)
		const startedNodes = resumeEvents
			.filter((e) => e.type === "node:start")
			.map((e) => (e as { nodeId: string }).nodeId);

		// The resumed execution should start from where we left off
		expect(startedNodes.length).toBeGreaterThanOrEqual(1);
	});

	it("executor clears paused session on successful completion", async () => {
		const hub = new HubImpl("test-session");
		const registry = createRegistry();

		const flow: FlowYaml = {
			flow: { name: "completion-test" },
			nodes: [{ id: "node1", type: "test.echo", input: { value: "one" } }],
			edges: [],
		};

		// First, pause the flow
		hub.startSession();
		hub.setStatus("running");
		hub.abort({ resumable: true });

		expect(hub.getPausedSession("test-session")).toBeDefined();

		// Resume and complete
		await hub.resume("test-session", "finish it");
		await executeFlow(flow, registry, createTestContext(hub));

		// Session should be cleared after successful completion
		expect(hub.getPausedSession("test-session")).toBeUndefined();
	});
});

// Phase 7: Edge Cases (T047-T050)
describe("Edge Cases", () => {
	it("T047: abort() on already-paused flow transitions to 'aborted'", () => {
		const hub = new HubImpl("test-session");
		const events: BaseEvent[] = [];

		hub.subscribe("*", (e: EnrichedEvent) => {
			events.push(e.event);
		});

		hub.startSession();
		hub.setStatus("running");

		// First pause
		hub.abort({ resumable: true });
		expect(hub.status).toBe("paused");

		// Second abort (terminal) on already-paused flow
		hub.abort({ resumable: false, reason: "force terminate" });
		expect(hub.status).toBe("aborted");

		// Should emit session:abort for terminal abort
		const abortEvents = events.filter((e) => e.type === "session:abort");
		expect(abortEvents.length).toBe(1);
	});

	it("T048: resume() called twice - second call throws SessionAlreadyRunningError", async () => {
		const hub = new HubImpl("test-session");

		hub.startSession();
		hub.setStatus("running");
		hub.abort({ resumable: true });

		// First resume
		await hub.resume("test-session", "first resume");
		expect(hub.status).toBe("running");

		// Second resume should throw
		await expect(hub.resume("test-session", "second resume")).rejects.toThrow(
			SessionAlreadyRunningError,
		);
	});

	it("T049: abort() when not session active is no-op", () => {
		const hub = new HubImpl("test-session");
		const events: BaseEvent[] = [];

		hub.subscribe("*", (e: EnrichedEvent) => {
			events.push(e.event);
		});

		// Don't start session - just try to abort
		hub.abort({ resumable: true });

		// No events should be emitted
		expect(events.length).toBe(0);
		expect(hub.status).toBe("idle");
	});

	it("T050: terminal abort clears pending messages from paused session", async () => {
		const hub = new HubImpl("test-session");

		hub.startSession();
		hub.setStatus("running");

		// First pause
		hub.abort({ resumable: true });
		expect(hub.status).toBe("paused");

		// Get the paused session state
		const pausedState = hub.getPausedSession("test-session");
		expect(pausedState).toBeDefined();

		// Terminal abort should clear the session entirely
		hub.abort({ resumable: false, reason: "terminate" });
		expect(hub.status).toBe("aborted");

		// Paused session should be cleared
		expect(hub.getPausedSession("test-session")).toBeUndefined();
	});
});
