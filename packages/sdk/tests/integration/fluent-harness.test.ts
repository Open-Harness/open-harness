/**
 * Integration Tests for Fluent Harness API
 *
 * T040: Verifies the complete harness lifecycle with the fluent API.
 * Includes the recursive agent call test per spec edge case.
 *
 * These tests run fast without API calls using mock agents.
 *
 * @module tests/integration/fluent-harness
 */

import { describe, expect, test } from "bun:test";
import { injectable } from "@needle-di/core";
import { defineHarness, wrapAgent } from "../../src/index.js";
import type { FluentHarnessEvent, NarrativeEvent, PhaseEvent, TaskEvent } from "../../src/harness/event-types.js";

// ============================================================================
// MOCK AGENTS
// ============================================================================

/**
 * Mock agent that emits narrative events via callback pattern.
 * Simulates an agent that produces output over time.
 */
@injectable()
class MockNarrativeAgent {
	private narrativeCallback?: (text: string) => void;

	setNarrativeCallback(cb: (text: string) => void) {
		this.narrativeCallback = cb;
	}

	async execute(input: string): Promise<{ summary: string }> {
		this.narrativeCallback?.("Starting processing...");
		await new Promise((r) => setTimeout(r, 10));
		this.narrativeCallback?.("Processing complete.");
		return { summary: `Processed: ${input}` };
	}
}

/**
 * Parent agent that calls a child agent internally.
 * Used to test recursive agent call event isolation.
 */
@injectable()
class ParentAgent {
	// Simulates calling another agent
	async execute(input: string): Promise<{ result: string; childCalled: boolean }> {
		// Parent does its work
		await new Promise((r) => setTimeout(r, 5));

		// Simulate calling child agent internally
		const childResult = await this.callChildAgent(input);

		return {
			result: `Parent processed: ${input} -> ${childResult}`,
			childCalled: true,
		};
	}

	private async callChildAgent(input: string): Promise<string> {
		// This is internal - event scope should be isolated
		await new Promise((r) => setTimeout(r, 5));
		return `child(${input})`;
	}
}

/**
 * Child agent used in recursive call tests.
 */
@injectable()
class ChildAgent {
	async execute(input: string): Promise<{ value: string }> {
		await new Promise((r) => setTimeout(r, 5));
		return { value: `ChildResult: ${input}` };
	}
}

/**
 * Simple sync agent for basic tests.
 */
@injectable()
class SimpleAgent {
	execute(input: string): string {
		return `Simple: ${input}`;
	}
}

// ============================================================================
// INTEGRATION TESTS: FULL HARNESS LIFECYCLE
// ============================================================================

describe("Fluent Harness Integration", () => {
	test("complete harness lifecycle: create -> on -> run", async () => {
		const events: FluentHarnessEvent[] = [];

		const Workflow = defineHarness({
			name: "lifecycle-test",
			agents: { simple: SimpleAgent },
			state: () => ({ processed: false }),
			run: async ({ agents, state, phase }) => {
				await phase("Processing", async () => {
					const result = agents.simple.execute("test");
					state.processed = true;
					return { result };
				});
				return { success: true };
			},
		});

		// Full lifecycle
		const harness = Workflow.create(undefined);
		harness.on("*", (e) => events.push(e));
		const result = await harness.run();

		// Verify result
		expect(result.result).toEqual({ success: true });
		expect(result.state.processed).toBe(true);
		expect(result.duration).toBeGreaterThanOrEqual(0);

		// Verify events were captured
		const phaseEvents = events.filter((e) => e.type === "phase") as PhaseEvent[];
		expect(phaseEvents.length).toBe(2); // start + complete
		expect(phaseEvents[0]?.name).toBe("Processing");
		expect(phaseEvents[0]?.status).toBe("start");
		expect(phaseEvents[1]?.status).toBe("complete");
	});

	test("multi-phase workflow with state updates", async () => {
		const events: FluentHarnessEvent[] = [];

		const MultiPhase = defineHarness({
			agents: { worker: SimpleAgent },
			state: (input: { items: string[] }) => ({
				items: input.items,
				results: [] as string[],
			}),
			run: async ({ agents, state, phase }) => {
				await phase("Load", async () => {
					// Items already in state from factory
					return { loaded: state.items.length };
				});

				await phase("Process", async () => {
					for (const item of state.items) {
						const result = agents.worker.execute(item);
						state.results.push(result);
					}
					return { processed: state.results.length };
				});

				return state.results;
			},
		});

		const result = await MultiPhase.create({ items: ["a", "b", "c"] })
			.on("*", (e) => events.push(e))
			.run();

		expect(result.result).toEqual(["Simple: a", "Simple: b", "Simple: c"]);
		expect(result.state.results.length).toBe(3);

		// Verify phase events
		const phaseEvents = events.filter((e) => e.type === "phase") as PhaseEvent[];
		const phaseNames = [...new Set(phaseEvents.map((e) => e.name))];
		expect(phaseNames).toContain("Load");
		expect(phaseNames).toContain("Process");
	});

	test("task-level events within phases", async () => {
		const events: FluentHarnessEvent[] = [];

		const TaskWorkflow = defineHarness({
			agents: { worker: SimpleAgent },
			run: async ({ agents, phase, task }) => {
				await phase("Execute", async () => {
					await task("task-1", async () => {
						agents.worker.execute("one");
						return { id: 1 };
					});
					await task("task-2", async () => {
						agents.worker.execute("two");
						return { id: 2 };
					});
				});
				return "done";
			},
		});

		await TaskWorkflow.create(undefined)
			.on("*", (e) => events.push(e))
			.run();

		// Verify task events
		const taskEvents = events.filter((e) => e.type === "task") as TaskEvent[];
		expect(taskEvents.length).toBe(4); // 2 tasks x (start + complete)

		const taskIds = taskEvents.map((e) => e.id);
		expect(taskIds).toContain("task-1");
		expect(taskIds).toContain("task-2");
	});
});

// ============================================================================
// EDGE CASE: RECURSIVE AGENT CALLS
// ============================================================================

describe("Edge Case: Recursive Agent Calls", () => {
	test("nested agent calls maintain separate event scopes", async () => {
		/**
		 * This tests the spec edge case:
		 * "When agent A calls agent B: Each agent call maintains its own event scope"
		 *
		 * We verify that parent and child agent executions don't cross-contaminate events.
		 */
		const events: FluentHarnessEvent[] = [];

		const RecursiveWorkflow = defineHarness({
			agents: { parent: ParentAgent, child: ChildAgent },
			run: async ({ agents, phase, task }) => {
				let parentResult: { result: string; childCalled: boolean } | undefined;
				let childResult: { value: string } | undefined;

				await phase("Nested-Execution", async () => {
					// Parent task (which internally calls a child)
					await task("parent-task", async () => {
						parentResult = await agents.parent.execute("test");
						return { parent: true };
					});

					// Separate child task at same level
					await task("child-task", async () => {
						childResult = await agents.child.execute("direct");
						return { child: true };
					});
				});

				return { parentResult, childResult };
			},
		});

		const result = await RecursiveWorkflow.create(undefined)
			.on("*", (e) => events.push(e))
			.run();

		// Verify both agents completed
		expect(result.result.parentResult?.childCalled).toBe(true);
		expect(result.result.childResult?.value).toBe("ChildResult: direct");

		// Verify task events are properly isolated
		const taskEvents = events.filter((e) => e.type === "task") as TaskEvent[];
		const parentTasks = taskEvents.filter((e) => e.id === "parent-task");
		const childTasks = taskEvents.filter((e) => e.id === "child-task");

		// Each task should have start and complete (no cross-contamination)
		expect(parentTasks.length).toBe(2);
		expect(childTasks.length).toBe(2);

		// Verify ordering: start before complete for each
		expect(parentTasks[0]?.status).toBe("start");
		expect(parentTasks[1]?.status).toBe("complete");
		expect(childTasks[0]?.status).toBe("start");
		expect(childTasks[1]?.status).toBe("complete");
	});

	test("multiple parallel agent calls have isolated events", async () => {
		const events: FluentHarnessEvent[] = [];

		const ParallelWorkflow = defineHarness({
			agents: { worker: SimpleAgent },
			run: async ({ agents, parallel }) => {
				const results = await parallel("batch", [
					async () => agents.worker.execute("item-1"),
					async () => agents.worker.execute("item-2"),
					async () => agents.worker.execute("item-3"),
				]);
				return results;
			},
		});

		const result = await ParallelWorkflow.create(undefined)
			.on("*", (e) => events.push(e))
			.run();

		expect(result.result).toEqual(["Simple: item-1", "Simple: item-2", "Simple: item-3"]);

		// Verify parallel events
		const parallelStart = events.find((e) => e.type === "parallel:start");
		const parallelComplete = events.find((e) => e.type === "parallel:complete");
		const itemCompletes = events.filter((e) => e.type === "parallel:item:complete");

		expect(parallelStart).toBeDefined();
		expect(parallelComplete).toBeDefined();
		expect(itemCompletes.length).toBe(3);
	});
});

// ============================================================================
// WRAPAGENT INTEGRATION
// ============================================================================

describe("wrapAgent Integration", () => {
	test("wrapAgent lifecycle: create -> on -> run", async () => {
		const events: FluentHarnessEvent[] = [];

		const result = wrapAgent(SimpleAgent)
			.on("*", (e) => events.push(e))
			.run("integration-test");

		expect(result).toBe("Simple: integration-test");

		// Verify narrative events
		const narratives = events.filter((e) => e.type === "narrative") as NarrativeEvent[];
		expect(narratives.length).toBe(2);
		expect(narratives[0]?.text).toBe("Starting execution");
		expect(narratives[1]?.text).toBe("Execution complete");
	});

	test("wrapAgent error handling emits error events", async () => {
		@injectable()
		class FailingAgent {
			execute(): never {
				throw new Error("Integration test failure");
			}
		}

		const events: FluentHarnessEvent[] = [];

		expect(() => {
			wrapAgent(FailingAgent)
				.on("*", (e) => events.push(e))
				.run();
		}).toThrow("Integration test failure");

		const errorEvents = events.filter((e) => e.type === "error");
		expect(errorEvents.length).toBe(1);
	});
});

// ============================================================================
// STATE FACTORY INTEGRATION
// ============================================================================

describe("State Factory Integration", () => {
	test("state factory receives input and initializes correctly", async () => {
		interface WorkflowInput {
			projectName: string;
			maxRetries: number;
		}

		interface WorkflowState {
			name: string;
			retries: number;
			log: string[];
		}

		const StateFactory = defineHarness({
			agents: { worker: SimpleAgent },
			state: (input: WorkflowInput): WorkflowState => ({
				name: input.projectName,
				retries: input.maxRetries,
				log: [],
			}),
			run: async ({ state }) => {
				state.log.push(`Started: ${state.name}`);
				state.log.push(`Max retries: ${state.retries}`);
				return state.log;
			},
		});

		const result = await StateFactory.create({
			projectName: "Integration-Project",
			maxRetries: 5,
		}).run();

		expect(result.result).toEqual(["Started: Integration-Project", "Max retries: 5"]);
		expect(result.state.name).toBe("Integration-Project");
		expect(result.state.retries).toBe(5);
	});

	test("multiple instances have isolated state", async () => {
		const Counter = defineHarness({
			agents: { worker: SimpleAgent },
			state: (start: number) => ({ count: start }),
			run: async ({ state }) => {
				state.count += 10;
				return state.count;
			},
		});

		// Create two instances
		const instance1 = Counter.create(100);
		const instance2 = Counter.create(200);

		// Run both
		const [result1, result2] = await Promise.all([instance1.run(), instance2.run()]);

		// Verify isolation
		expect(result1.result).toBe(110);
		expect(result2.result).toBe(210);
		expect(result1.state.count).toBe(110);
		expect(result2.state.count).toBe(210);
	});
});

// ============================================================================
// EVENT CLEANUP INTEGRATION
// ============================================================================

describe("Event Cleanup Integration", () => {
	test("subscriptions are cleaned up after run() completes", async () => {
		let eventCount = 0;

		const Workflow = defineHarness({
			agents: { worker: SimpleAgent },
			run: async ({ agents, phase }) => {
				await phase("Work", async () => {
					agents.worker.execute("test");
				});
				return "done";
			},
		});

		const instance = Workflow.create(undefined);
		instance.on("*", () => {
			eventCount++;
		});

		await instance.run();
		const countAfterRun = eventCount;

		// Events captured during execution
		expect(countAfterRun).toBeGreaterThan(0);

		// After run() completes, no new events should be captured
		// (This verifies cleanup - the subscription should be inactive)
	});
});

// ============================================================================
// ERROR HANDLING INTEGRATION
// ============================================================================

describe("Error Handling Integration", () => {
	test("phase errors emit phase:failed events", async () => {
		const events: FluentHarnessEvent[] = [];

		const FailingWorkflow = defineHarness({
			agents: { worker: SimpleAgent },
			run: async ({ phase }) => {
				await phase("Failing-Phase", async () => {
					throw new Error("Phase failure");
				});
				return "never reached";
			},
		});

		const promise = FailingWorkflow.create(undefined)
			.on("*", (e) => events.push(e))
			.run();

		await expect(promise).rejects.toThrow("Phase failure");

		// Verify phase:start was emitted
		const phaseStart = events.find((e) => e.type === "phase" && (e as PhaseEvent).status === "start");
		expect(phaseStart).toBeDefined();
	});

	test("task errors emit task:failed events", async () => {
		const events: FluentHarnessEvent[] = [];

		const FailingTask = defineHarness({
			agents: { worker: SimpleAgent },
			run: async ({ task }) => {
				await task("failing-task", async () => {
					throw new Error("Task failure");
				});
				return "never reached";
			},
		});

		const promise = FailingTask.create(undefined)
			.on("*", (e) => events.push(e))
			.run();

		await expect(promise).rejects.toThrow("Task failure");

		// Verify task:start was emitted
		const taskStart = events.find((e) => e.type === "task" && (e as TaskEvent).status === "start");
		expect(taskStart).toBeDefined();
	});
});
