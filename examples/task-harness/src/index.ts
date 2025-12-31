/**
 * Task Harness Example
 *
 * This example demonstrates how to build a task-based harness using SDK primitives.
 * It orchestrates task execution with Parser, Coding, and Review agents.
 *
 * Key patterns demonstrated:
 * - Using defineHarness() for workflow definition
 * - Phase and task helpers for structured execution
 * - Recording and replay for testing
 * - Renderer attachment for output
 *
 * @example
 * ```typescript
 * import { createTaskHarness } from '@openharness/example-task-harness';
 *
 * const harness = createTaskHarness({
 *   config: {
 *     tasksFilePath: 'specs/my-feature/tasks.md',
 *     mode: 'live',
 *   },
 * });
 *
 * const summary = await harness.run({
 *   onNarrative: (entry) => console.log(`[${entry.agentName}] ${entry.text}`),
 * });
 * ```
 */

// Main harness
export { TaskHarness } from "./task-harness.js";
export { createTaskHarness, createTestTaskHarness, type CreateTaskHarnessOptions } from "./harness-factory.js";

// Types
export type {
  TaskHarnessConfig,
  TaskHarnessState,
  ParsedTask,
  ParserAgentInput,
  ParserAgentOutput,
  ParserMetadata,
  PhaseInfo,
  TaskFlags,
  ReviewAgentInput,
  ReviewAgentOutput,
  ValidationResult,
  TaskResult,
  FailureRecord,
  RetryRecord,
  NarrativeEntry,
  HarnessSummary,
  CodingAgentOutput,
  ReviewContext,
} from "./task-harness-types.js";
export { ParserAgentOutputSchema, ReviewAgentOutputSchema } from "./task-harness-types.js";

// State management
export {
  createInitialState,
  startTask,
  completeTask,
  failTask,
  validateTask,
  recordRetry,
  getNextTask,
  getTask,
  isComplete,
  setTasks,
  createNarrativeEntry,
} from "./task-state.js";

// Dependency resolution
export { resolveDependencies, detectCycles, getReadyTasks, validateDependencies } from "./dependency-resolver.js";
export type { TopologicalSortResult } from "./dependency-resolver.js";

// Event protocol
export type { HarnessEvent, TaskNarrativeEvent } from "./event-protocol.js";

// Renderers
export type { IHarnessRenderer, RendererConfig, RenderContent, TaskDisplayData } from "./renderer-interface.js";
export { BaseRenderer, type RendererOptions, type TaskState, type PhaseState, type RenderState } from "./base-renderer.js";
export { ConsoleRenderer, type ConsoleRendererConfig } from "./console-renderer.js";
export { CompositeRenderer } from "./composite-renderer.js";

// Recording
export { HarnessRecorder, loadStateEvents, reconstructCheckpoint, type StateEventType, type HarnessRecorderConfig } from "./harness-recorder.js";

// Replay
export { ReplayController, type ReplayControllerConfig, type ReplayState, type PlaybackOptions } from "./replay-controller.js";
