/**
 * Server-Side Workflow with LLM Provider
 *
 * This file creates the workflow with a real Claude provider for server-side execution.
 * Only import this file in server-side code (API routes, server components).
 *
 * For client-side code, import from './workflow' which doesn't include the provider.
 *
 * @module apps/core-v2-demo/src/lib/workflow-server
 */

import { createWorkflow, makeClaudeProviderService } from "@open-harness/core-v2";
import {
  handleUserInput,
  handlePlanCreated,
  handleTaskExecuted,
  handleWorkflowStart,
  initialState,
  planner,
  executor,
  type TaskWorkflowState,
} from "./workflow";
import type { AnyEvent, HandlerDefinition } from "@open-harness/core-v2";

/**
 * Create a TaskExecutor workflow with real Claude provider.
 *
 * This version includes the Claude provider for actual LLM execution.
 * Use this in API routes and server-side code only.
 */
export function createServerWorkflow() {
  // Handlers need to be cast to AnyEvent type for array typing
  const handlers = [
    handleUserInput,
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
    until: (state) => state.currentPhase === "complete",
    // Real Claude provider for server-side execution
    provider: makeClaudeProviderService(),
  });
}

/**
 * Singleton server workflow instance.
 * Reused across API requests for efficiency.
 */
export const serverWorkflow = createServerWorkflow();
