/**
 * Integration Tests for Unified Event System
 *
 * T016 (SC-001): Agent events automatically include task context
 * T023 (SC-002): Parallel tasks maintain isolated context
 * T025: Stress test for parallel context isolation
 *
 * These tests verify that the UnifiedEventBus properly propagates context
 * through the async call stack, enabling renderers to correlate agent
 * activity with workflow structure.
 *
 * @module tests/integration/unified-events
 */

import { describe, expect, test } from "bun:test";
import { injectable } from "@needle-di/core";
import { UnifiedEventBus } from "../../src/infra/unified-event-bus.js";
import type { EnrichedEvent } from "../../src/infra/unified-events/types.js";
import { defineHarness } from "../../src/index.js";

// ============================================================================
// MOCK AGENTS - Simple agents that don't need UnifiedEventBus injection
// ============================================================================

/**
 * Simple processing agent.
 */
@injectable()
class MockProcessor {
	async execute(input: string): Promise<{ processed: string }> {
		await new Promise((r) => setTimeout(r, 5));
		return { processed: `Processed: ${input}` };
	}
}

/**
 * Agent with an ID for parallel tests.
 * NOTE: Kept for future use in parallel agent tests
 */
@injectable()
class _IdentifiedProcessor {
	constructor(private id = "default") {}

	async execute(input: string): Promise<{ agentId: string; result: string }> {
		await new Promise((r) => setTimeout(r, Math.random() * 10 + 5));
		return { agentId: this.id, result: `${this.id}: ${input}` };
	}
}

// ============================================================================
// T016: SC-001 - Agent Events Include Task Context
// ============================================================================

describe("T016 SC-001: Agent events include task context", () => {
	test("events emitted within task scope have task context", async () => {
		const bus = new UnifiedEventBus();
		const events: EnrichedEvent[] = [];

		bus.subscribe((e) => {
			events.push(e);
		});

		// Simulate what happens when an agent runs inside a task
		await bus.scoped({ task: { id: "T001-process" } }, async () => {
			// Agent emits events during execution
			bus.emit({ type: "agent:thinking", content: "Analyzing input..." });

			await new Promise((r) => setTimeout(r, 5));

			bus.emit({
				type: "agent:tool:start",
				toolName: "process_data",
				input: { data: "test" },
			});

			await new Promise((r) => setTimeout(r, 5));

			bus.emit({
				type: "agent:tool:complete",
				toolName: "process_data",
				result: "success",
			});

			bus.emit({ type: "agent:text", content: "Processing complete" });
		});

		// All agent events should have task context
		const agentEvents = events.filter((e) => e.event.type.startsWith("agent:"));
		expect(agentEvents.length).toBe(4);

		for (const event of agentEvents) {
			expect(event.context.task?.id).toBe("T001-process");
		}
	});

	test("events outside task scope do not have task context", async () => {
		const bus = new UnifiedEventBus();
		const events: EnrichedEvent[] = [];

		bus.subscribe((e) => {
			events.push(e);
		});

		// Emit event outside any task scope
		bus.emit({ type: "agent:thinking", content: "Orphan thought" });

		expect(events).toHaveLength(1);
		expect(events[0]?.context.task).toBeUndefined();
	});

	test("harness phase() and task() emit context-aware events", async () => {
		const bus = new UnifiedEventBus();
		const events: EnrichedEvent[] = [];

		bus.subscribe((e) => {
			events.push(e);
		});

		const TestHarness = defineHarness({
			name: "ContextPropagationTest",
			agents: { processor: MockProcessor },
			run: async ({ agents, phase, task }) => {
				return await phase("Setup", async () => {
					return await task("T001-init", async () => {
						// Emit custom event inside task - should inherit context
						bus.emit({ type: "agent:thinking", content: "Inside task scope" });
						return await agents.processor.execute("test");
					});
				});
			},
		});

		const instance = TestHarness.create(undefined, { unifiedBus: bus });
		await instance.run();

		// Find the agent:thinking event we emitted
		const thinkingEvent = events.find(
			(e) => e.event.type === "agent:thinking" && (e.event as { content?: string }).content === "Inside task scope",
		);

		expect(thinkingEvent).toBeDefined();
		expect(thinkingEvent?.context.phase?.name).toBe("Setup");
		expect(thinkingEvent?.context.task?.id).toBe("T001-init");
	});

	test("nested task creates new task context that overrides parent", async () => {
		const bus = new UnifiedEventBus();
		const events: EnrichedEvent[] = [];

		bus.subscribe((e) => {
			events.push(e);
		});

		// Simulate nested tasks
		await bus.scoped({ task: { id: "T001-outer" } }, async () => {
			bus.emit({ type: "agent:thinking", content: "outer-thought" });

			await bus.scoped({ task: { id: "T002-inner" } }, async () => {
				bus.emit({ type: "agent:thinking", content: "inner-thought" });
			});

			bus.emit({ type: "agent:text", content: "outer-text" });
		});

		// Find outer events - should have T001-outer context
		const outerThought = events.find((e) => (e.event as { content?: string }).content === "outer-thought");
		const outerText = events.find((e) => (e.event as { content?: string }).content === "outer-text");

		// Find inner event - should have T002-inner context
		const innerThought = events.find((e) => (e.event as { content?: string }).content === "inner-thought");

		expect(outerThought?.context.task?.id).toBe("T001-outer");
		expect(outerText?.context.task?.id).toBe("T001-outer");
		expect(innerThought?.context.task?.id).toBe("T002-inner");
	});
});

// ============================================================================
// T023: SC-002 - Parallel Tasks with Correct Context Isolation
// ============================================================================

describe("T023 SC-002: Parallel tasks maintain isolated context", () => {
	test("3 parallel tasks each have isolated context", async () => {
		const bus = new UnifiedEventBus();
		const events: EnrichedEvent[] = [];

		bus.subscribe((e) => {
			events.push(e);
		});

		// Run 3 parallel tasks
		await Promise.all([
			bus.scoped({ task: { id: "T001" } }, async () => {
				await new Promise((r) => setTimeout(r, 10));
				bus.emit({ type: "agent:thinking", content: "T001-thought" });
				await new Promise((r) => setTimeout(r, 10));
				bus.emit({ type: "agent:text", content: "T001-text" });
			}),
			bus.scoped({ task: { id: "T002" } }, async () => {
				await new Promise((r) => setTimeout(r, 5));
				bus.emit({ type: "agent:thinking", content: "T002-thought" });
				await new Promise((r) => setTimeout(r, 15));
				bus.emit({ type: "agent:text", content: "T002-text" });
			}),
			bus.scoped({ task: { id: "T003" } }, async () => {
				await new Promise((r) => setTimeout(r, 15));
				bus.emit({ type: "agent:thinking", content: "T003-thought" });
				await new Promise((r) => setTimeout(r, 5));
				bus.emit({ type: "agent:text", content: "T003-text" });
			}),
		]);

		// Verify each task's events have correct context
		const t001Events = events.filter((e) => (e.event as { content?: string }).content?.startsWith("T001"));
		const t002Events = events.filter((e) => (e.event as { content?: string }).content?.startsWith("T002"));
		const t003Events = events.filter((e) => (e.event as { content?: string }).content?.startsWith("T003"));

		expect(t001Events).toHaveLength(2);
		expect(t002Events).toHaveLength(2);
		expect(t003Events).toHaveLength(2);

		for (const event of t001Events) {
			expect(event.context.task?.id).toBe("T001");
		}
		for (const event of t002Events) {
			expect(event.context.task?.id).toBe("T002");
		}
		for (const event of t003Events) {
			expect(event.context.task?.id).toBe("T003");
		}
	});

	test("harness parallel() maintains isolated task context", async () => {
		const bus = new UnifiedEventBus();
		const events: EnrichedEvent[] = [];

		bus.subscribe((e) => {
			events.push(e);
		});

		const TestHarness = defineHarness({
			name: "ParallelContextTest",
			agents: { processor: MockProcessor },
			run: async ({ agents, task, parallel }) => {
				return await parallel("parallel-tasks", [
					() =>
						task("T001", async () => {
							bus.emit({ type: "agent:thinking", content: "T001-thinking" });
							return await agents.processor.execute("input-1");
						}),
					() =>
						task("T002", async () => {
							bus.emit({ type: "agent:thinking", content: "T002-thinking" });
							return await agents.processor.execute("input-2");
						}),
					() =>
						task("T003", async () => {
							bus.emit({ type: "agent:thinking", content: "T003-thinking" });
							return await agents.processor.execute("input-3");
						}),
				]);
			},
		});

		const instance = TestHarness.create(undefined, { unifiedBus: bus });
		const result = await instance.run();

		expect(result.result).toHaveLength(3);

		// Verify each task's thinking event has correct context
		const t001Event = events.find((e) => (e.event as { content?: string }).content === "T001-thinking");
		const t002Event = events.find((e) => (e.event as { content?: string }).content === "T002-thinking");
		const t003Event = events.find((e) => (e.event as { content?: string }).content === "T003-thinking");

		expect(t001Event?.context.task?.id).toBe("T001");
		expect(t002Event?.context.task?.id).toBe("T002");
		expect(t003Event?.context.task?.id).toBe("T003");
	});

	test("no cross-contamination between parallel contexts", async () => {
		const bus = new UnifiedEventBus();
		const events: EnrichedEvent[] = [];

		bus.subscribe((e) => {
			events.push(e);
		});

		// Run many parallel tasks with varying delays to ensure interleaving
		const taskCount = 5;
		await Promise.all(
			Array.from({ length: taskCount }, (_, i) => {
				const taskId = `TASK-${i}`;
				return bus.scoped({ task: { id: taskId } }, async () => {
					// Random delays to interleave execution
					await new Promise((r) => setTimeout(r, Math.random() * 20));
					bus.emit({ type: "agent:thinking", content: `${taskId}-think` });
					await new Promise((r) => setTimeout(r, Math.random() * 20));
					bus.emit({ type: "agent:text", content: `${taskId}-text` });
				});
			}),
		);

		// Verify no cross-contamination
		for (const event of events) {
			const content = (event.event as { content?: string }).content || "";
			// Extract "TASK-0" from "TASK-0-think"
			const expectedTaskId = content.substring(0, content.lastIndexOf("-"));
			expect(event.context.task?.id).toBe(expectedTaskId);
		}
	});
});

// ============================================================================
// T025: Stress Test - 10 Concurrent Tasks
// ============================================================================

describe("T025: Stress test for parallel context isolation", () => {
	test("10 concurrent tasks maintain isolated context under stress", async () => {
		const bus = new UnifiedEventBus();
		const events: EnrichedEvent[] = [];

		bus.subscribe((e) => {
			events.push(e);
		});

		const taskCount = 10;
		const eventsPerTask = 5;

		// Run 10 parallel tasks, each emitting 5 events
		await Promise.all(
			Array.from({ length: taskCount }, (_, i) => {
				const taskId = `T${String(i + 1).padStart(3, "0")}`;

				return bus.scoped({ task: { id: taskId } }, async () => {
					for (let j = 0; j < eventsPerTask; j++) {
						// Random delay to interleave events from different tasks
						await new Promise((r) => setTimeout(r, Math.random() * 10));
						bus.emit({
							type: "agent:thinking",
							content: `${taskId}-event-${j}`,
						});
					}
				});
			}),
		);

		// Verify: total events = taskCount * eventsPerTask
		expect(events).toHaveLength(taskCount * eventsPerTask);

		// Verify each event has correct task context based on its content
		for (const event of events) {
			const content = (event.event as { content?: string }).content || "";
			const expectedTaskId = content.split("-")[0]; // Extract "T001" from "T001-event-0"
			expect(event.context.task?.id).toBe(expectedTaskId);
		}
	});

	test("rapid context switching preserves isolation", async () => {
		const bus = new UnifiedEventBus();
		const events: EnrichedEvent[] = [];

		bus.subscribe((e) => {
			events.push(e);
		});

		// Rapidly switch between contexts
		const iterations = 50;

		for (let i = 0; i < iterations; i++) {
			const taskId = `rapid-${i % 5}`; // Cycle through 5 task IDs

			await bus.scoped({ task: { id: taskId } }, async () => {
				bus.emit({ type: "agent:text", content: `iteration-${i}` });
			});
		}

		expect(events).toHaveLength(iterations);

		// Verify each event has the correct task context
		for (let i = 0; i < iterations; i++) {
			const expectedTaskId = `rapid-${i % 5}`;
			expect(events[i]?.context.task?.id).toBe(expectedTaskId);
		}
	});
});

// ============================================================================
// T042: Legacy .on() and bus.subscribe() coexist
// ============================================================================

describe("T042: Legacy .on() and bus.subscribe() coexist", () => {
	test("both legacy .on() and unified bus.subscribe() receive events", async () => {
		const bus = new UnifiedEventBus();
		const legacyEvents: string[] = [];
		const unifiedEvents: string[] = [];

		bus.subscribe((e) => {
			unifiedEvents.push(e.event.type);
		});

		const TestHarness = defineHarness({
			name: "CoexistenceTest",
			agents: { processor: MockProcessor },
			run: async ({ agents, phase, task }) => {
				return await phase("TestPhase", async () => {
					return await task("T001", async () => {
						return await agents.processor.execute("test");
					});
				});
			},
		});

		const instance = TestHarness.create(undefined, { unifiedBus: bus });

		// Subscribe via legacy .on() API
		instance.on("*", (e) => {
			legacyEvents.push(e.type);
		});

		await instance.run();

		// Legacy events should include fluent event types
		expect(legacyEvents).toContain("phase");
		expect(legacyEvents).toContain("task");

		// Unified bus events should include unified event types
		expect(unifiedEvents).toContain("phase:start");
		expect(unifiedEvents).toContain("phase:complete");
		expect(unifiedEvents).toContain("task:start");
		expect(unifiedEvents).toContain("task:complete");
	});

	test("unified bus events have context, legacy events do not", async () => {
		const bus = new UnifiedEventBus();
		const unifiedEvents: EnrichedEvent[] = [];

		bus.subscribe((e) => {
			unifiedEvents.push(e);
		});

		interface LegacyEvent {
			type: string;
			id?: string;
		}
		const legacyEvents: LegacyEvent[] = [];

		const TestHarness = defineHarness({
			name: "ContextDifferenceTest",
			agents: { processor: MockProcessor },
			run: async ({ agents, task }) => {
				return await task("T001-context", async () => {
					return await agents.processor.execute("data");
				});
			},
		});

		const instance = TestHarness.create(undefined, { unifiedBus: bus });
		instance.on("task", (e) => {
			legacyEvents.push({ type: e.type, id: (e as { id?: string }).id });
		});

		await instance.run();

		// Unified events have context with task info
		const unifiedTaskStart = unifiedEvents.find((e) => e.event.type === "task:start");
		expect(unifiedTaskStart).toBeDefined();
		expect(unifiedTaskStart?.context.task?.id).toBe("T001-context");

		// Legacy events have their own structure (id at root level)
		const legacyTaskStart = legacyEvents.find((e) => e.type === "task" && e.id);
		expect(legacyTaskStart).toBeDefined();
	});

	test("can use both APIs simultaneously without interference", async () => {
		const bus = new UnifiedEventBus();
		let unifiedCount = 0;
		let legacyCount = 0;

		bus.subscribe(() => {
			unifiedCount++;
		});

		const TestHarness = defineHarness({
			name: "SimultaneousTest",
			agents: { processor: MockProcessor },
			run: async ({ agents, phase }) => {
				return await phase("Work", async () => {
					return await agents.processor.execute("work");
				});
			},
		});

		const instance = TestHarness.create(undefined, { unifiedBus: bus });
		instance.on("*", () => {
			legacyCount++;
		});

		await instance.run();

		// Both should have received events
		expect(unifiedCount).toBeGreaterThan(0);
		expect(legacyCount).toBeGreaterThan(0);

		// They may have different counts since unified has more granular types
		// (e.g., phase:start, phase:complete vs single 'phase' event twice)
	});
});

// ============================================================================
// Phase/Task Context Inheritance
// ============================================================================

describe("Phase and Task context inheritance", () => {
	test("task inherits phase context", async () => {
		const bus = new UnifiedEventBus();
		const events: EnrichedEvent[] = [];

		bus.subscribe((e) => {
			events.push(e);
		});

		// Simulate phase containing a task
		await bus.scoped({ phase: { name: "Setup" } }, async () => {
			await bus.scoped({ task: { id: "T001-init" } }, async () => {
				bus.emit({ type: "agent:thinking", content: "Thinking inside task" });
			});
		});

		// Event should have both phase and task context
		expect(events).toHaveLength(1);
		expect(events[0]?.context.phase?.name).toBe("Setup");
		expect(events[0]?.context.task?.id).toBe("T001-init");
	});

	test("session ID is consistent across all events", async () => {
		const bus = new UnifiedEventBus();
		const events: EnrichedEvent[] = [];

		bus.subscribe((e) => {
			events.push(e);
		});

		const expectedSessionId = bus.current().sessionId;

		// Emit events in various scopes
		bus.emit({ type: "harness:start", sessionId: expectedSessionId, mode: "live", taskCount: 3 });

		await bus.scoped({ phase: { name: "P1" } }, async () => {
			bus.emit({ type: "phase:start", name: "P1" });

			await bus.scoped({ task: { id: "T1" } }, async () => {
				bus.emit({ type: "task:start", taskId: "T1" });
				bus.emit({ type: "agent:thinking", content: "..." });
			});
		});

		// All events should have the same sessionId
		for (const event of events) {
			expect(event.context.sessionId).toBe(expectedSessionId);
		}
	});

	test("harness integrates with unified bus for phase/task", async () => {
		const bus = new UnifiedEventBus();
		const events: EnrichedEvent[] = [];

		bus.subscribe((e) => {
			events.push(e);
		});

		const TestHarness = defineHarness({
			name: "PhaseTaskIntegration",
			agents: { processor: MockProcessor },
			run: async ({ agents, phase, task }) => {
				return await phase("Init", async () => {
					return await task("T001", async () => {
						bus.emit({ type: "agent:thinking", content: "working" });
						return await agents.processor.execute("test");
					});
				});
			},
		});

		const instance = TestHarness.create(undefined, { unifiedBus: bus });
		await instance.run();

		// Find the thinking event - should have both phase and task
		const thinkingEvent = events.find(
			(e) => e.event.type === "agent:thinking" && (e.event as { content?: string }).content === "working",
		);

		expect(thinkingEvent).toBeDefined();
		expect(thinkingEvent?.context.phase?.name).toBe("Init");
		expect(thinkingEvent?.context.task?.id).toBe("T001");
	});
});
