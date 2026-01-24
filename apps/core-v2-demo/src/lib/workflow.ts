/**
 * TaskExecutor Workflow
 *
 * A demonstration workflow for core-v2 showing:
 * 1. Domain state (not chat history)
 * 2. Event definitions with TypeScript generics
 * 3. Pure handlers that update state and emit events
 * 4. Agents with required structured output
 * 5. Workflow composition with termination condition
 *
 * Based on the quickstart.md example from the spec.
 */

import {
  type AnyEvent,
  agent,
  createEvent,
  createWorkflow,
  defineEvent,
  defineHandler,
  type EventId,
  emitEvent,
  type HandlerDefinition,
  stateOnly,
} from "@open-harness/core-v2";
import { z } from "zod";

// =============================================================================
// 1. Define Domain State
// =============================================================================

/**
 * Task structure representing a unit of work.
 */
export interface Task {
  id: string;
  title: string;
  description: string;
  status: "pending" | "complete" | "failed";
}

/**
 * Execution result tracking for completed tasks.
 */
export interface ExecutionResult {
  taskId: string;
  output: string;
  success: boolean;
}

/**
 * Workflow state tracks:
 * - goal: The user's objective
 * - tasks: Planned tasks from the Planner agent
 * - currentPhase: Which phase we're in (planning -> executing -> complete)
 * - currentTaskIndex: Which task we're currently executing
 * - executionResults: Results from completed tasks
 *
 * NOTE: This is domain state, NOT chat history. Messages are projected from events.
 */
export interface TaskWorkflowState {
  goal: string;
  tasks: Task[];
  currentPhase: "planning" | "executing" | "complete";
  currentTaskIndex: number;
  executionResults: ExecutionResult[];
}

/**
 * Initial state when the workflow starts.
 */
export const initialState: TaskWorkflowState = {
  goal: "",
  tasks: [],
  currentPhase: "planning",
  currentTaskIndex: 0,
  executionResults: [],
};

// =============================================================================
// 2. Define Events
// =============================================================================

/**
 * Event emitted when the workflow starts with a user's goal.
 */
interface WorkflowStartPayload {
  goal: string;
}
export const WorkflowStart = defineEvent<
  "workflow:start",
  WorkflowStartPayload
>("workflow:start");

/**
 * Event emitted by the Planner agent when it creates a plan.
 */
interface PlanCreatedPayload {
  tasks: Array<{
    id: string;
    title: string;
    description: string;
  }>;
}
export const PlanCreated = defineEvent<"plan:created", PlanCreatedPayload>(
  "plan:created",
);

/**
 * Event emitted when a task is ready to be executed.
 */
interface TaskReadyPayload {
  taskId: string;
}
export const TaskReady = defineEvent<"task:ready", TaskReadyPayload>(
  "task:ready",
);

/**
 * Event emitted by the Executor agent when it completes a task.
 */
interface TaskExecutedPayload {
  taskId: string;
  output: string;
  success: boolean;
}
export const TaskExecuted = defineEvent<"task:executed", TaskExecutedPayload>(
  "task:executed",
);

/**
 * Event emitted when the workflow is complete.
 */
interface WorkflowCompletePayload {
  summary: string;
}
export const WorkflowComplete = defineEvent<
  "workflow:complete",
  WorkflowCompletePayload
>("workflow:complete");

// =============================================================================
// 3. Define Handlers (pure functions that update domain state)
// =============================================================================

/**
 * Handles workflow:start event - initializes the goal.
 */
export const handleWorkflowStart = defineHandler(WorkflowStart, {
  name: "handle-workflow-start",
  handler: (event, state: TaskWorkflowState) =>
    stateOnly({
      ...state,
      goal: event.payload.goal,
      currentPhase: "planning" as const,
    }),
});

/**
 * Handles plan:created event - updates state with planned tasks and triggers first task.
 * Uses emitEvent() to create properly-typed events with id and timestamp.
 */
export const handlePlanCreated = defineHandler(PlanCreated, {
  name: "handle-plan-created",
  handler: (event, state: TaskWorkflowState) => {
    // Add status to each task
    const tasks: Task[] = event.payload.tasks.map((t) => ({
      ...t,
      status: "pending" as const,
    }));

    // If no tasks, workflow is complete
    if (tasks.length === 0) {
      return {
        state: {
          ...state,
          tasks,
          currentPhase: "complete" as const,
        },
        events: [
          emitEvent(
            "workflow:complete",
            { summary: "No tasks to execute" },
            event.id,
          ),
        ],
      };
    }

    // Start executing first task
    return {
      state: {
        ...state,
        tasks,
        currentPhase: "executing" as const,
        currentTaskIndex: 0,
      },
      events: [emitEvent("task:ready", { taskId: tasks[0].id }, event.id)],
    };
  },
});

/**
 * Handles task:executed event - updates task status and moves to next task or completes.
 * Uses emitEvent() to create properly-typed events with id and timestamp.
 */
export const handleTaskExecuted = defineHandler(TaskExecuted, {
  name: "handle-task-executed",
  handler: (event, state: TaskWorkflowState) => {
    // Update the task status
    const updatedTasks = state.tasks.map((t) =>
      t.id === event.payload.taskId
        ? {
            ...t,
            status: event.payload.success
              ? ("complete" as const)
              : ("failed" as const),
          }
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
          emitEvent(
            "workflow:complete",
            {
              summary: `Completed ${successCount}/${state.tasks.length} tasks`,
            },
            event.id,
          ),
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
      events: [
        emitEvent(
          "task:ready",
          { taskId: state.tasks[nextIndex].id },
          event.id,
        ),
      ],
    };
  },
});

// =============================================================================
// 4. Define Agents with REQUIRED Structured Output
// =============================================================================

/**
 * Zod schema for Planner output - what the LLM must return.
 */
const PlanOutput = z.object({
  tasks: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
    }),
  ),
});

type PlanOutputType = z.infer<typeof PlanOutput>;

/**
 * Planner agent - breaks down the goal into tasks.
 * Activates on workflow:start, emits plan:created.
 */
export const planner = agent<TaskWorkflowState, PlanOutputType>({
  name: "planner",
  activatesOn: ["workflow:start"],
  emits: ["agent:started", "text:delta", "plan:created", "agent:completed"],

  // REQUIRED: Structured output schema using Zod
  outputSchema: PlanOutput,

  // REQUIRED: Transform structured output to events
  onOutput: (output, event) => [
    createEvent("plan:created", { tasks: output.tasks }, event.id as EventId),
  ],

  prompt: (state) => `
You are a planning agent. Break down the following goal into 2-4 concrete tasks.

Goal: ${state.goal}

For each task, provide:
- id: A unique identifier (TASK-001, TASK-002, etc.)
- title: A concise title
- description: What needs to be done

Output as JSON matching the schema.
`,
});

/**
 * Zod schema for Executor output - what the LLM must return.
 */
const ExecutionOutput = z.object({
  output: z.string(),
  success: z.boolean(),
});

type ExecutionOutputType = z.infer<typeof ExecutionOutput>;

/**
 * Executor agent - completes individual tasks.
 * Activates on task:ready, emits task:executed.
 */
export const executor = agent<TaskWorkflowState, ExecutionOutputType>({
  name: "executor",
  activatesOn: ["task:ready"],
  emits: ["agent:started", "text:delta", "task:executed", "agent:completed"],

  // REQUIRED: Structured output schema using Zod
  outputSchema: ExecutionOutput,

  // REQUIRED: Transform structured output to events
  onOutput: (output, event) => [
    createEvent(
      "task:executed",
      {
        taskId: (event.payload as TaskReadyPayload).taskId,
        output: output.output,
        success: output.success,
      },
      event.id as EventId,
    ),
  ],

  prompt: (state, event) => {
    const taskId = (event.payload as TaskReadyPayload).taskId;
    const task = state.tasks.find((t) => t.id === taskId);
    return `
You are an execution agent. Complete the following task.

Task: ${task?.title ?? "Unknown"}
Description: ${task?.description ?? "No description"}

Provide your output and whether you successfully completed the task.
`;
  },

  // Guard: only execute if we're in executing phase
  when: (state) => state.currentPhase === "executing",
});

// =============================================================================
// 5. Create the Workflow
// =============================================================================

/**
 * Create a TaskExecutor workflow instance.
 *
 * The workflow:
 * 1. Receives user input (goal)
 * 2. Planner agent breaks it into tasks
 * 3. Executor agent completes each task
 * 4. Terminates when all tasks are done
 *
 * Note: No store is used in this demo (events are ephemeral).
 * In production, you would pass a store for persistence.
 */
export function createTaskExecutorWorkflow() {
  // Handlers need to be cast to AnyEvent type for array typing
  // This is a TypeScript limitation with handler contravariance, not an Effect leak
  const handlers = [
    handleWorkflowStart,
    handlePlanCreated,
    handleTaskExecuted,
  ] as unknown as HandlerDefinition<AnyEvent, TaskWorkflowState>[];

  // Agents also need similar typing treatment
  // biome-ignore lint/suspicious/noExplicitAny: Required for agent array typing
  const agents = [planner, executor] as any[];

  return createWorkflow<TaskWorkflowState>({
    name: "task-executor",
    initialState,
    handlers,
    agents,
    // Termination: when we reach the complete phase
    until: (state) => state.currentPhase === "complete",
  });
}

/**
 * Pre-created workflow instance for the demo app.
 * In production, you might create this per-request or use WorkflowProvider.
 */
export const taskExecutorWorkflow = createTaskExecutorWorkflow();
