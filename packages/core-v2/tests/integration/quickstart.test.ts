/**
 * Quickstart Integration Tests
 *
 * These tests verify the examples from specs/001-effect-refactor/quickstart.md
 * work correctly as integration tests. They exercise the core workflow patterns:
 *
 * - Domain state management (not chat history)
 * - Event/Handler/Agent pattern
 * - Time-travel debugging with Tape
 * - Recording & replay
 * - Custom renderers
 * - Event causality tracking
 *
 * @see specs/001-effect-refactor/quickstart.md
 */

import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import type { Agent } from "../../src/agent/Agent.js";
import { agent } from "../../src/agent/Agent.js";
import type { AnyEvent, Event, EventId } from "../../src/event/Event.js";
import { createEvent, defineEvent } from "../../src/event/Event.js";
import type { Handler, HandlerDefinition } from "../../src/handler/Handler.js";
import { defineHandler, emit, stateOnly } from "../../src/handler/Handler.js";
import { createRenderer } from "../../src/renderer/Renderer.js";
import { MemoryStoreLive } from "../../src/store/MemoryStore.js";
import { generateSessionId, Store, type StoreService } from "../../src/store/Store.js";
import { computeState, createTape, createTapeFromDefinitions } from "../../src/tape/Tape.js";
import type { Workflow, WorkflowDefinition } from "../../src/workflow/Workflow.js";
import { createWorkflow } from "../../src/workflow/Workflow.js";

// ============================================================================
// Task Executor Workflow Types (from quickstart.md)
// ============================================================================

interface Task {
	id: string;
	title: string;
	description: string;
	status: "pending" | "complete" | "failed";
}

interface ExecutionResult {
	taskId: string;
	output: string;
	success: boolean;
}

interface TaskWorkflowState {
	goal: string;
	tasks: Task[];
	currentPhase: "planning" | "executing" | "complete";
	currentTaskIndex: number;
	executionResults: ExecutionResult[];
}

const initialTaskState: TaskWorkflowState = {
	goal: "",
	tasks: [],
	currentPhase: "planning",
	currentTaskIndex: 0,
	executionResults: [],
};

// ============================================================================
// Event Definitions (from quickstart.md)
// ============================================================================

interface PlanCreatedPayload {
	tasks: Array<{ id: string; title: string; description: string }>;
}

interface TaskExecutedPayload {
	taskId: string;
	output: string;
	success: boolean;
}

interface TaskReadyPayload {
	taskId: string;
}

interface WorkflowCompletePayload {
	summary: string;
}

const PlanCreated = defineEvent<"plan:created", PlanCreatedPayload>("plan:created");
const TaskExecuted = defineEvent<"task:executed", TaskExecutedPayload>("task:executed");
const TaskReady = defineEvent<"task:ready", TaskReadyPayload>("task:ready");
const WorkflowComplete = defineEvent<"workflow:complete", WorkflowCompletePayload>("workflow:complete");

// ============================================================================
// Handler Definitions (from quickstart.md)
// ============================================================================

const handlePlanCreated = defineHandler(PlanCreated, {
	name: "handlePlanCreated",
	handler: (event, state: TaskWorkflowState) => {
		const tasks: Task[] = event.payload.tasks.map((t) => ({
			...t,
			status: "pending" as const,
		}));

		const newState: TaskWorkflowState = {
			...state,
			tasks,
			currentPhase: "executing" as const,
			currentTaskIndex: 0,
		};

		// Emit event to start executing first task
		const firstTask = tasks[0];
		const events: AnyEvent[] =
			firstTask !== undefined
				? [TaskReady.create({ taskId: firstTask.id }, event.id)]
				: [WorkflowComplete.create({ summary: "No tasks to execute" }, event.id)];

		return { state: newState, events };
	},
});

const handleTaskExecuted = defineHandler(TaskExecuted, {
	name: "handleTaskExecuted",
	handler: (event, state: TaskWorkflowState) => {
		// Update task status based on execution result
		const updatedTasks = state.tasks.map((t) =>
			t.id === event.payload.taskId
				? { ...t, status: event.payload.success ? ("complete" as const) : ("failed" as const) }
				: t,
		);

		// Track execution result
		const executionResults: ExecutionResult[] = [
			...state.executionResults,
			{
				taskId: event.payload.taskId,
				output: event.payload.output,
				success: event.payload.success,
			},
		];

		// Check if all tasks are done
		const nextIndex = state.currentTaskIndex + 1;
		const allDone = nextIndex >= state.tasks.length;

		if (allDone) {
			const successCount = executionResults.filter((r) => r.success).length;
			return {
				state: {
					...state,
					tasks: updatedTasks,
					executionResults,
					currentPhase: "complete" as const,
				},
				events: [
					WorkflowComplete.create({ summary: `Completed ${successCount}/${state.tasks.length} tasks` }, event.id),
				],
			};
		}

		// Move to next task
		return {
			state: {
				...state,
				tasks: updatedTasks,
				executionResults,
				currentTaskIndex: nextIndex,
			},
			events: [TaskReady.create({ taskId: state.tasks[nextIndex]!.id }, event.id)],
		};
	},
});

const handleTaskReady = defineHandler(TaskReady, {
	name: "handleTaskReady",
	handler: (_event, state: TaskWorkflowState) => {
		// Just mark state - in a real workflow this would trigger an agent
		return stateOnly(state);
	},
});

const handleWorkflowComplete = defineHandler(WorkflowComplete, {
	name: "handleWorkflowComplete",
	handler: (_event, state: TaskWorkflowState) => stateOnly(state),
});

// Track workflows for cleanup
const workflows: Workflow<unknown>[] = [];

afterEach(async () => {
	for (const w of workflows) {
		await w.dispose();
	}
	workflows.length = 0;
});

// ============================================================================
// Core Concept: Domain State (from quickstart.md)
// ============================================================================

describe("Quickstart: Core Concept - Domain State", () => {
	it("should use domain-focused state, not chat-focused state", async () => {
		// The quickstart emphasizes that state should track workflow data, NOT messages
		// State tracks: workflow phase, agent outputs, business entities, retry counts
		// State does NOT track: messages (those are projected from events for React)

		const workflow = createWorkflow<TaskWorkflowState>({
			name: "domain-state-test",
			initialState: {
				...initialTaskState,
				goal: "Build a simple todo app",
			},
			handlers: [
				handlePlanCreated,
				handleTaskExecuted,
				handleTaskReady,
				handleWorkflowComplete,
			] as unknown as readonly HandlerDefinition<AnyEvent, TaskWorkflowState>[],
			agents: [],
			until: (state) => state.currentPhase === "complete",
		});
		workflows.push(workflow);

		// Simulate plan creation manually (without LLM)
		const result = await workflow.run({ input: "Start workflow" });

		// Verify state structure is domain-focused
		expect(result.state).toHaveProperty("goal");
		expect(result.state).toHaveProperty("tasks");
		expect(result.state).toHaveProperty("currentPhase");
		expect(result.state).toHaveProperty("currentTaskIndex");
		expect(result.state).toHaveProperty("executionResults");

		// Should NOT have chat-focused properties
		expect(result.state).not.toHaveProperty("messages");
		expect(result.state).not.toHaveProperty("turnCount");
	});
});

// ============================================================================
// Basic Example: Task Executor Workflow (from quickstart.md)
// ============================================================================

describe("Quickstart: Basic Example - Task Executor Workflow", () => {
	it("should process plan:created event and transition to executing phase", async () => {
		const workflow = createWorkflow<TaskWorkflowState>({
			name: "task-executor",
			initialState: { ...initialTaskState, goal: "Build a calculator" },
			handlers: [
				handlePlanCreated,
				handleTaskExecuted,
				handleTaskReady,
				handleWorkflowComplete,
			] as unknown as readonly HandlerDefinition<AnyEvent, TaskWorkflowState>[],
			agents: [],
			until: (state) => state.currentPhase === "complete",
		});
		workflows.push(workflow);

		// Create a handler that injects plan events after user input
		const customHandlers: HandlerDefinition<AnyEvent, TaskWorkflowState>[] = [
			{
				name: "handleUserInput",
				handles: "user:input",
				handler: (_event: AnyEvent, state: TaskWorkflowState) => ({
					state: { ...state, goal: (_event.payload as { text: string }).text },
					events: [
						PlanCreated.create(
							{
								tasks: [
									{ id: "TASK-001", title: "Add numbers", description: "Implement addition" },
									{ id: "TASK-002", title: "Subtract numbers", description: "Implement subtraction" },
								],
							},
							_event.id,
						),
					],
				}),
			},
			handlePlanCreated as unknown as HandlerDefinition<AnyEvent, TaskWorkflowState>,
			handleTaskExecuted as unknown as HandlerDefinition<AnyEvent, TaskWorkflowState>,
			handleTaskReady as unknown as HandlerDefinition<AnyEvent, TaskWorkflowState>,
			handleWorkflowComplete as unknown as HandlerDefinition<AnyEvent, TaskWorkflowState>,
		];

		const workflowWithInput = createWorkflow<TaskWorkflowState>({
			name: "task-executor-with-input",
			initialState: initialTaskState,
			handlers: customHandlers,
			agents: [],
			until: (state) => state.currentPhase === "complete",
		});
		workflows.push(workflowWithInput);

		// Run but won't complete because no task:executed events are emitted
		const result = await workflowWithInput.run({ input: "Build a calculator" });

		// Should have transitioned to executing phase with tasks
		expect(result.state.goal).toBe("Build a calculator");
		expect(result.state.tasks.length).toBe(2);
		expect(result.state.currentPhase).toBe("executing");
		expect(result.state.currentTaskIndex).toBe(0);
	});

	it("should complete workflow when all tasks are executed", async () => {
		// Create a workflow that simulates task execution
		const customHandlers: HandlerDefinition<AnyEvent, TaskWorkflowState>[] = [
			{
				name: "handleUserInput",
				handles: "user:input",
				handler: (_event: AnyEvent, state: TaskWorkflowState) => ({
					state: { ...state, goal: (_event.payload as { text: string }).text },
					events: [
						PlanCreated.create(
							{
								tasks: [
									{ id: "TASK-001", title: "Task 1", description: "First task" },
									{ id: "TASK-002", title: "Task 2", description: "Second task" },
								],
							},
							_event.id,
						),
					],
				}),
			},
			handlePlanCreated as unknown as HandlerDefinition<AnyEvent, TaskWorkflowState>,
			{
				name: "handleTaskReady",
				handles: "task:ready",
				handler: (event: AnyEvent, state: TaskWorkflowState) => ({
					state,
					events: [
						TaskExecuted.create(
							{
								taskId: (event.payload as TaskReadyPayload).taskId,
								output: "Task completed successfully",
								success: true,
							},
							event.id,
						),
					],
				}),
			},
			handleTaskExecuted as unknown as HandlerDefinition<AnyEvent, TaskWorkflowState>,
			handleWorkflowComplete as unknown as HandlerDefinition<AnyEvent, TaskWorkflowState>,
		];

		const workflow = createWorkflow<TaskWorkflowState>({
			name: "complete-workflow-test",
			initialState: initialTaskState,
			handlers: customHandlers,
			agents: [],
			until: (state) => state.currentPhase === "complete",
		});
		workflows.push(workflow);

		const result = await workflow.run({ input: "Build something" });

		// Workflow should be complete
		expect(result.state.currentPhase).toBe("complete");
		expect(result.state.executionResults.length).toBe(2);
		expect(result.state.executionResults.every((r) => r.success)).toBe(true);
		expect(result.terminated).toBe(true);
	});
});

// ============================================================================
// Time-Travel Debugging (from quickstart.md)
// ============================================================================

describe("Quickstart: Time-Travel Debugging", () => {
	it("should support step forward through history", async () => {
		const handlers = [
			{
				name: "handleUserInput",
				handles: "user:input",
				handler: (_event: AnyEvent, state: { count: number }) => ({
					state: { count: state.count + 1 },
					events: [createEvent("increment", { value: 1 }, _event.id)],
				}),
			},
			{
				name: "handleIncrement",
				handles: "increment",
				handler: (_event: AnyEvent, state: { count: number }) => ({
					state: { count: state.count + 1 },
					events: [],
				}),
			},
		];

		const workflow = createWorkflow<{ count: number }>({
			name: "time-travel-test",
			initialState: { count: 0 },
			handlers,
			agents: [],
			until: () => false,
		});
		workflows.push(workflow);

		const result = await workflow.run({ input: "test" });

		// Initial tape position
		expect(result.tape.position).toBe(0);
		expect(result.tape.length).toBe(2); // user:input and increment events

		// Step forward
		const t1 = result.tape.step();
		expect(t1.position).toBe(1);
		expect(t1.state.count).toBe(2); // count after both events
	});

	it("should support stepBack - THE KEY FEATURE", async () => {
		const handlers = [
			{
				name: "handleInput",
				handles: "user:input",
				handler: (_event: AnyEvent, state: { messages: string[] }) => ({
					state: { messages: [...state.messages, "first"] },
					events: [createEvent("second", {}, _event.id)],
				}),
			},
			{
				name: "handleSecond",
				handles: "second",
				handler: (_event: AnyEvent, state: { messages: string[] }) => ({
					state: { messages: [...state.messages, "second"] },
					events: [],
				}),
			},
		];

		const workflow = createWorkflow<{ messages: string[] }>({
			name: "stepback-test",
			initialState: { messages: [] },
			handlers,
			agents: [],
			until: () => false,
		});
		workflows.push(workflow);

		const result = await workflow.run({ input: "start" });

		// Go to last position
		const atEnd = result.tape.stepTo(result.tape.length - 1);
		expect(atEnd.state.messages).toEqual(["first", "second"]);

		// Step back - THE KEY FEATURE
		const stepped = atEnd.stepBack();
		expect(stepped.position).toBe(atEnd.position - 1);
		expect(stepped.state.messages).toEqual(["first"]); // State at previous position
	});

	it("should support stepTo to jump to any position", async () => {
		const events: AnyEvent[] = [
			createEvent("event:a", { value: "a" }),
			createEvent("event:b", { value: "b" }),
			createEvent("event:c", { value: "c" }),
			createEvent("event:d", { value: "d" }),
		];

		const handler = (event: AnyEvent, state: { values: string[] }) => ({
			state: { values: [...state.values, (event.payload as { value: string }).value] },
			events: [] as AnyEvent[],
		});

		const handlerDefs = ["event:a", "event:b", "event:c", "event:d"].map((name) => ({
			name: `handle-${name}`,
			handles: name,
			handler,
		}));

		const tape = createTapeFromDefinitions<{ values: string[] }>(events, handlerDefs, { values: [] });

		// Jump to position 2
		const t1 = tape.stepTo(2);
		expect(t1.position).toBe(2);
		expect(t1.state.values).toEqual(["a", "b", "c"]);

		// Jump to position 0
		const t2 = t1.stepTo(0);
		expect(t2.position).toBe(0);
		expect(t2.state.values).toEqual(["a"]);
	});

	it("should support rewind to return to start", async () => {
		const events: AnyEvent[] = [createEvent("e1", { v: 1 }), createEvent("e2", { v: 2 }), createEvent("e3", { v: 3 })];

		const handler = (event: AnyEvent, state: { total: number }) => ({
			state: { total: state.total + (event.payload as { v: number }).v },
			events: [] as AnyEvent[],
		});

		const handlerDefs = ["e1", "e2", "e3"].map((name) => ({
			name: `handle-${name}`,
			handles: name,
			handler,
		}));

		const tape = createTapeFromDefinitions<{ total: number }>(events, handlerDefs, { total: 0 });

		// Go to end
		const atEnd = tape.stepTo(2);
		expect(atEnd.position).toBe(2);
		expect(atEnd.state.total).toBe(6);

		// Rewind
		const rewound = atEnd.rewind();
		expect(rewound.position).toBe(0);
		expect(rewound.state.total).toBe(1); // First event only
	});

	it("should support async play through all events", async () => {
		const events: AnyEvent[] = [
			createEvent("tick", { n: 1 }),
			createEvent("tick", { n: 2 }),
			createEvent("tick", { n: 3 }),
		];

		const handler = (event: AnyEvent, state: { ticks: number[] }) => ({
			state: { ticks: [...state.ticks, (event.payload as { n: number }).n] },
			events: [] as AnyEvent[],
		});

		const tape = createTapeFromDefinitions<{ ticks: number[] }>(
			events,
			[{ name: "handle-tick", handles: "tick", handler }],
			{ ticks: [] },
		);

		// Play through all
		const final = await tape.play();
		expect(final.position).toBe(2); // Last position
		expect(final.state.ticks).toEqual([1, 2, 3]);
	});
});

// ============================================================================
// Recording and Replay (from quickstart.md)
// ============================================================================

describe("Quickstart: Recording and Replay", () => {
	it("should record events to store when record:true", async () => {
		// Use Effect.gen with Layer to get a fresh store
		const program = Effect.gen(function* () {
			const store = yield* Store;

			const handlers = [
				{
					name: "handleInput",
					handles: "user:input",
					handler: (_event: AnyEvent, state: { messages: string[] }) => ({
						state: { messages: [...state.messages, (_event.payload as { text: string }).text] },
						events: [createEvent("processed", {}, _event.id)],
					}),
				},
				{
					name: "handleProcessed",
					handles: "processed",
					handler: (_event: AnyEvent, state: { messages: string[] }) => ({
						state,
						events: [],
					}),
				},
			];

			const workflow = createWorkflow<{ messages: string[] }>({
				name: "recording-test",
				initialState: { messages: [] },
				handlers,
				agents: [],
				until: () => false,
				store,
			});
			workflows.push(workflow);

			// Run workflow using Effect.promise to convert Promise to Effect
			const result = yield* Effect.promise(() =>
				workflow.run({
					input: "Hello",
					record: true,
				}),
			);

			// Should have session ID
			expect(result.sessionId).toBeDefined();
			expect(typeof result.sessionId).toBe("string");

			// Events should be recorded in store
			const storedEvents = yield* store.events(result.sessionId);
			expect(storedEvents.length).toBe(2); // user:input and processed
		});

		await Effect.runPromise(program.pipe(Effect.provide(MemoryStoreLive)));
	});

	it("should replay from store without API calls", async () => {
		const program = Effect.gen(function* () {
			const store = yield* Store;

			const handlers = [
				{
					name: "handleInput",
					handles: "user:input",
					handler: (_event: AnyEvent, state: { value: number }) => ({
						state: { value: state.value + 1 },
						events: [createEvent("increment", {}, _event.id)],
					}),
				},
				{
					name: "handleIncrement",
					handles: "increment",
					handler: (_event: AnyEvent, state: { value: number }) => ({
						state: { value: state.value + 10 },
						events: [],
					}),
				},
			];

			const workflow = createWorkflow<{ value: number }>({
				name: "replay-test",
				initialState: { value: 0 },
				handlers,
				agents: [],
				until: () => false,
				store,
			});
			workflows.push(workflow);

			// Record a session using Effect.promise
			const result = yield* Effect.promise(() =>
				workflow.run({
					input: "start",
					record: true,
				}),
			);

			expect(result.state.value).toBe(11); // 0 + 1 + 10

			// Load and replay using Effect.promise
			const tape = yield* Effect.promise(() => workflow.load(result.sessionId));
			expect(tape.length).toBe(2);

			// Replay produces same state
			const replayed = yield* Effect.promise(() => tape.play());
			expect(replayed.state.value).toBe(11);
		});

		await Effect.runPromise(program.pipe(Effect.provide(MemoryStoreLive)));
	});

	it("should list sessions from store", async () => {
		const program = Effect.gen(function* () {
			const store = yield* Store;

			const workflow = createWorkflow<{ x: number }>({
				name: "sessions-test",
				initialState: { x: 0 },
				handlers: [],
				agents: [],
				until: () => false,
				store,
			});
			workflows.push(workflow);

			// Record multiple sessions using Effect.promise
			yield* Effect.promise(() => workflow.run({ input: "a", record: true }));
			yield* Effect.promise(() => workflow.run({ input: "b", record: true }));
			yield* Effect.promise(() => workflow.run({ input: "c", record: true }));

			// List sessions
			const sessions = yield* store.sessions();
			expect(sessions.length).toBe(3);
			expect(sessions.every((s) => s.eventCount > 0)).toBe(true);
		});

		await Effect.runPromise(program.pipe(Effect.provide(MemoryStoreLive)));
	});
});

// ============================================================================
// Custom Renderers (from quickstart.md)
// ============================================================================

describe("Quickstart: Custom Renderers", () => {
	it("should call renderers for matching events", async () => {
		const renderedEvents: Array<{ name: string; payload: unknown }> = [];

		// Create a renderer that collects events matching specific patterns
		const terminalRenderer = {
			name: "terminal",
			patterns: ["user:input", "count:updated"],
			render: (event: AnyEvent) => {
				renderedEvents.push({ name: event.name, payload: event.payload });
			},
		};

		const handlers = [
			{
				name: "handleInput",
				handles: "user:input",
				handler: (_event: AnyEvent, state: { count: number }) => ({
					state: { count: state.count + 1 },
					events: [createEvent("count:updated", { newCount: state.count + 1 }, _event.id)],
				}),
			},
			{
				name: "handleCountUpdated",
				handles: "count:updated",
				handler: (_event: AnyEvent, state: { count: number }) => ({
					state,
					events: [],
				}),
			},
		];

		const workflow = createWorkflow<{ count: number }>({
			name: "renderer-test",
			initialState: { count: 0 },
			handlers,
			agents: [],
			until: () => false,
			renderers: [terminalRenderer],
		});
		workflows.push(workflow);

		const result = await workflow.run({ input: "increment" });

		// Give time for forked renderers to complete (they run in daemon fibers)
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Result should have 2 events
		expect(result.events.length).toBe(2);

		// Both events should have been rendered
		expect(renderedEvents.length).toBe(2);
		expect(renderedEvents[0]!.name).toBe("user:input");
		expect(renderedEvents[1]!.name).toBe("count:updated");
	});

	it("should support wildcard pattern matching for renderers", async () => {
		const errorEvents: AnyEvent[] = [];

		// Use Renderer interface directly with wildcard pattern
		const errorRenderer = {
			name: "error-catcher",
			patterns: ["error:*"],
			render: (event: AnyEvent) => {
				errorEvents.push(event);
			},
		};

		const handlers = [
			{
				name: "handleInput",
				handles: "user:input",
				handler: (_event: AnyEvent, state: unknown) => ({
					state,
					events: [
						createEvent("error:validation", { message: "Invalid input" }, _event.id),
						createEvent("error:network", { message: "Connection failed" }, _event.id),
					],
				}),
			},
			{
				name: "handleErrorValidation",
				handles: "error:validation",
				handler: (_event: AnyEvent, state: unknown) => ({ state, events: [] }),
			},
			{
				name: "handleErrorNetwork",
				handles: "error:network",
				handler: (_event: AnyEvent, state: unknown) => ({ state, events: [] }),
			},
		];

		const workflow = createWorkflow({
			name: "wildcard-renderer-test",
			initialState: {},
			handlers,
			agents: [],
			until: () => false,
			renderers: [errorRenderer],
		});
		workflows.push(workflow);

		await workflow.run({ input: "trigger errors" });

		// Give time for forked renderers to complete
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Both error events should match error:* pattern
		expect(errorEvents.length).toBe(2);
		expect(errorEvents.map((e) => e.name)).toEqual(["error:validation", "error:network"]);
	});
});

// ============================================================================
// Event Causality Tracking (from quickstart.md)
// ============================================================================

describe("Quickstart: Event Causality Tracking", () => {
	it("should track causedBy field for event lineage", async () => {
		const capturedEvents: AnyEvent[] = [];

		const handlers = [
			{
				name: "handleInput",
				handles: "user:input",
				handler: (event: AnyEvent, state: unknown) => {
					capturedEvents.push(event);
					return {
						state,
						events: [createEvent("step:1", { from: "input" }, event.id)],
					};
				},
			},
			{
				name: "handleStep1",
				handles: "step:1",
				handler: (event: AnyEvent, state: unknown) => {
					capturedEvents.push(event);
					return {
						state,
						events: [createEvent("step:2", { from: "step1" }, event.id)],
					};
				},
			},
			{
				name: "handleStep2",
				handles: "step:2",
				handler: (event: AnyEvent, state: unknown) => {
					capturedEvents.push(event);
					return { state, events: [] };
				},
			},
		];

		const workflow = createWorkflow({
			name: "causality-test",
			initialState: {},
			handlers,
			agents: [],
			until: () => false,
		});
		workflows.push(workflow);

		await workflow.run({ input: "start" });

		// Should have 3 events: user:input, step:1, step:2
		expect(capturedEvents.length).toBe(3);

		// First event has no causedBy (it's the root)
		expect(capturedEvents[0]!.name).toBe("user:input");
		expect(capturedEvents[0]!.causedBy).toBeUndefined();

		// Second event caused by first
		expect(capturedEvents[1]!.name).toBe("step:1");
		expect(capturedEvents[1]!.causedBy).toBe(capturedEvents[0]!.id);

		// Third event caused by second
		expect(capturedEvents[2]!.name).toBe("step:2");
		expect(capturedEvents[2]!.causedBy).toBe(capturedEvents[1]!.id);
	});

	it("should enable building a causality graph", async () => {
		// Helper from quickstart.md
		function buildCausalityGraph(events: AnyEvent[]): Map<string, string[]> {
			const graph = new Map<string, string[]>();

			for (const event of events) {
				if (event.causedBy) {
					const children = graph.get(event.causedBy) ?? [];
					children.push(event.id);
					graph.set(event.causedBy, children);
				}
			}

			return graph;
		}

		const events: AnyEvent[] = [];

		const handlers = [
			{
				name: "handleInput",
				handles: "user:input",
				handler: (event: AnyEvent, state: unknown) => {
					events.push(event);
					return {
						state,
						events: [createEvent("child:a", {}, event.id), createEvent("child:b", {}, event.id)],
					};
				},
			},
			{
				name: "handleChildA",
				handles: "child:a",
				handler: (event: AnyEvent, state: unknown) => {
					events.push(event);
					return { state, events: [] };
				},
			},
			{
				name: "handleChildB",
				handles: "child:b",
				handler: (event: AnyEvent, state: unknown) => {
					events.push(event);
					return { state, events: [] };
				},
			},
		];

		const workflow = createWorkflow({
			name: "causality-graph-test",
			initialState: {},
			handlers,
			agents: [],
			until: () => false,
		});
		workflows.push(workflow);

		await workflow.run({ input: "parent" });

		const graph = buildCausalityGraph(events);

		// Root event should have two children
		const rootId = events[0]!.id;
		const children = graph.get(rootId);
		expect(children).toBeDefined();
		expect(children?.length).toBe(2);
		expect(children).toContain(events[1]!.id);
		expect(children).toContain(events[2]!.id);
	});

	it("should enable tracing event lineage", async () => {
		// Helper from quickstart.md
		function getEventLineage(events: AnyEvent[], eventId: EventId): AnyEvent[] {
			const eventMap = new Map(events.map((e) => [e.id, e]));
			const lineage: AnyEvent[] = [];

			let current = eventMap.get(eventId);
			while (current) {
				lineage.unshift(current);
				current = current.causedBy ? eventMap.get(current.causedBy) : undefined;
			}

			return lineage;
		}

		const events: AnyEvent[] = [];

		const handlers = [
			{
				name: "handleInput",
				handles: "user:input",
				handler: (event: AnyEvent, state: unknown) => {
					events.push(event);
					return { state, events: [createEvent("gen:1", {}, event.id)] };
				},
			},
			{
				name: "handleGen1",
				handles: "gen:1",
				handler: (event: AnyEvent, state: unknown) => {
					events.push(event);
					return { state, events: [createEvent("gen:2", {}, event.id)] };
				},
			},
			{
				name: "handleGen2",
				handles: "gen:2",
				handler: (event: AnyEvent, state: unknown) => {
					events.push(event);
					return { state, events: [createEvent("gen:3", {}, event.id)] };
				},
			},
			{
				name: "handleGen3",
				handles: "gen:3",
				handler: (event: AnyEvent, state: unknown) => {
					events.push(event);
					return { state, events: [] };
				},
			},
		];

		const workflow = createWorkflow({
			name: "lineage-test",
			initialState: {},
			handlers,
			agents: [],
			until: () => false,
		});
		workflows.push(workflow);

		await workflow.run({ input: "start" });

		// Get lineage of the last event
		const lastEvent = events[events.length - 1]!;
		const lineage = getEventLineage(events, lastEvent.id);

		// Lineage should include all ancestors
		expect(lineage.length).toBe(4);
		expect(lineage.map((e) => e.name)).toEqual(["user:input", "gen:1", "gen:2", "gen:3"]);
	});
});

// ============================================================================
// Deterministic Replay (from quickstart.md)
// ============================================================================

describe("Quickstart: Deterministic Replay", () => {
	it("should produce identical state on replay - verified 100 times (SC-004)", async () => {
		const events: AnyEvent[] = [
			createEvent("add", { value: 10 }),
			createEvent("multiply", { factor: 2 }),
			createEvent("add", { value: 5 }),
			createEvent("multiply", { factor: 3 }),
		];

		const handlers = [
			{
				name: "handleAdd",
				handles: "add",
				handler: (event: AnyEvent, state: { result: number }) => ({
					state: { result: state.result + (event.payload as { value: number }).value },
					events: [] as AnyEvent[],
				}),
			},
			{
				name: "handleMultiply",
				handles: "multiply",
				handler: (event: AnyEvent, state: { result: number }) => ({
					state: { result: state.result * (event.payload as { factor: number }).factor },
					events: [] as AnyEvent[],
				}),
			},
		];

		// Run replay 100 times and verify state is identical
		const initialState = { result: 0 };
		const expectedFinalState = { result: 75 }; // ((0+10)*2+5)*3 = 75

		for (let i = 0; i < 100; i++) {
			const tape = createTapeFromDefinitions(events, handlers, initialState);

			const final = await tape.play();
			expect(final.state).toEqual(expectedFinalState);

			// Also verify intermediate states are deterministic
			for (let pos = 0; pos < events.length; pos++) {
				const atPos = tape.stepTo(pos);
				const stateAtPos = tape.stateAt(pos);
				expect(atPos.state).toEqual(stateAtPos);
			}
		}
	});

	it("should verify state at each position matches snapshot during replay", async () => {
		const events: AnyEvent[] = [
			createEvent("set", { value: "a" }),
			createEvent("append", { value: "b" }),
			createEvent("append", { value: "c" }),
		];

		const handlers = [
			{
				name: "handleSet",
				handles: "set",
				handler: (event: AnyEvent, state: { str: string }) => ({
					state: { str: (event.payload as { value: string }).value },
					events: [] as AnyEvent[],
				}),
			},
			{
				name: "handleAppend",
				handles: "append",
				handler: (event: AnyEvent, state: { str: string }) => ({
					state: { str: state.str + (event.payload as { value: string }).value },
					events: [] as AnyEvent[],
				}),
			},
		];

		const tape = createTapeFromDefinitions(events, handlers, { str: "" });

		// Expected states at each position
		const expectedStates = [{ str: "a" }, { str: "ab" }, { str: "abc" }];

		for (let i = 0; i < tape.length; i++) {
			const t = tape.stepTo(i);
			expect(t.state).toEqual(expectedStates[i]);
		}
	});

	it("should verify step forward then back returns to original state", async () => {
		const events: AnyEvent[] = [
			createEvent("inc", { amount: 1 }),
			createEvent("inc", { amount: 2 }),
			createEvent("inc", { amount: 3 }),
			createEvent("inc", { amount: 4 }),
			createEvent("inc", { amount: 5 }),
		];

		const handler = (event: AnyEvent, state: { sum: number }) => ({
			state: { sum: state.sum + (event.payload as { amount: number }).amount },
			events: [] as AnyEvent[],
		});

		const tape = createTapeFromDefinitions(events, [{ name: "handleInc", handles: "inc", handler }], { sum: 0 });

		// Go to position 3
		const t1 = tape.stepTo(3);
		const stateAt3 = t1.state;

		// Step forward
		const t2 = t1.step();
		expect(t2.position).toBe(4);

		// Step back
		const t3 = t2.stepBack();
		expect(t3.position).toBe(3);

		// State should be identical
		expect(t3.state).toEqual(stateAt3);
	});
});

// ============================================================================
// Agent Definition Patterns (from quickstart.md - structure only, no LLM)
// ============================================================================

describe("Quickstart: Agent Definition Patterns", () => {
	it("should require outputSchema for agents (throws if missing)", () => {
		expect(() => {
			// @ts-expect-error - intentionally missing outputSchema
			agent({
				name: "bad-agent",
				activatesOn: ["test"],
				emits: ["output"],
				prompt: () => "test",
				onOutput: () => [],
			});
		}).toThrow(/outputSchema is required/);
	});

	it("should create agent with required outputSchema", () => {
		const OutputSchema = z.object({
			result: z.string(),
		});

		type OutputType = z.infer<typeof OutputSchema>;

		const testAgent = agent<{ input: string }, OutputType>({
			name: "test-agent",
			activatesOn: ["trigger"],
			emits: ["result"],
			outputSchema: OutputSchema,
			prompt: (state) => `Process: ${state.input}`,
			onOutput: (output, event) => [createEvent("result", { data: output.result }, event.id)],
		});

		expect(testAgent.name).toBe("test-agent");
		expect(testAgent.activatesOn).toEqual(["trigger"]);
		expect(testAgent.emits).toEqual(["result"]);
		expect(testAgent.outputSchema).toBe(OutputSchema);
		expect(typeof testAgent.prompt).toBe("function");
		expect(typeof testAgent.onOutput).toBe("function");
	});

	it("should support optional when guard condition", () => {
		const OutputSchema = z.object({ done: z.boolean() });
		type OutputType = z.infer<typeof OutputSchema>;

		const guardedAgent = agent<{ phase: string }, OutputType>({
			name: "guarded-agent",
			activatesOn: ["task:ready"],
			emits: ["task:done"],
			outputSchema: OutputSchema,
			prompt: () => "Do the task",
			when: (state) => state.phase === "executing",
			onOutput: (output, event) => [createEvent("task:done", { success: output.done }, event.id)],
		});

		expect(typeof guardedAgent.when).toBe("function");
		expect(guardedAgent.when?.({ phase: "executing" })).toBe(true);
		expect(guardedAgent.when?.({ phase: "planning" })).toBe(false);
	});
});

// ============================================================================
// Handler Utility Functions (from quickstart.md)
// ============================================================================

describe("Quickstart: Handler Utility Functions", () => {
	it("should use stateOnly for handlers that dont emit events", () => {
		const result = stateOnly({ count: 42 });

		expect(result.state).toEqual({ count: 42 });
		expect(result.events).toEqual([]);
	});

	it("should use emit for handlers that emit events", () => {
		const result = emit({ count: 42 }, [createEvent("updated", { newCount: 42 })]);

		expect(result.state).toEqual({ count: 42 });
		expect(result.events.length).toBe(1);
		expect(result.events[0]!.name).toBe("updated");
	});
});

// ============================================================================
// computeState Utility (from quickstart.md)
// ============================================================================

describe("Quickstart: computeState Utility", () => {
	it("should derive state by replaying handlers over event log", () => {
		const events: AnyEvent[] = [
			createEvent("deposit", { amount: 100 }),
			createEvent("withdraw", { amount: 30 }),
			createEvent("deposit", { amount: 50 }),
		];

		// Build handler Map directly (computeState expects Map, not array)
		const handlersMap = new Map<string, Handler<AnyEvent, { balance: number }>>([
			[
				"deposit",
				(event: AnyEvent, state: { balance: number }) => ({
					state: { balance: state.balance + (event.payload as { amount: number }).amount },
					events: [] as AnyEvent[],
				}),
			],
			[
				"withdraw",
				(event: AnyEvent, state: { balance: number }) => ({
					state: { balance: state.balance - (event.payload as { amount: number }).amount },
					events: [] as AnyEvent[],
				}),
			],
		]);

		// Compute state at various positions
		const stateAt0 = computeState(events, handlersMap, { balance: 0 }, 0);
		expect(stateAt0.balance).toBe(100); // After deposit 100

		const stateAt1 = computeState(events, handlersMap, { balance: 0 }, 1);
		expect(stateAt1.balance).toBe(70); // After withdraw 30

		const stateAt2 = computeState(events, handlersMap, { balance: 0 }, 2);
		expect(stateAt2.balance).toBe(120); // After deposit 50
	});
});
