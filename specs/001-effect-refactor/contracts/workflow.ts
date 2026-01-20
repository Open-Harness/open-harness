/**
 * Workflow Contracts - Public API Types
 *
 * These interfaces define the public API surface for Workflows.
 * Workflows are the top-level container combining all components.
 *
 * @module @core-v2/workflow
 */

import type { AnyEvent } from "./event";
import type { HandlerDefinition } from "./handler";
import type { Agent } from "./agent";
import type { Renderer } from "./renderer";
import type { Store, SessionId } from "./store";
import type { Tape } from "./tape";

/**
 * Callbacks for workflow execution.
 */
export interface WorkflowCallbacks {
  /** Called when an event is emitted */
  onEvent?: (event: AnyEvent) => void;
  /** Called when state changes */
  onStateChange?: (state: unknown) => void;
  /** Called on error */
  onError?: (error: Error) => void;
}

/**
 * Options for running a workflow.
 */
export interface RunOptions {
  /** User input text */
  readonly input: string;
  /** Whether to record this session (default: false) */
  readonly record?: boolean;
  /** Session ID (auto-generated if not provided) */
  readonly sessionId?: SessionId;
  /** Renderers to use for this run */
  readonly renderers?: readonly Renderer[];
  /** Callbacks for events and state changes */
  readonly callbacks?: WorkflowCallbacks;
  /** Abort signal for cancellation */
  readonly abortSignal?: AbortSignal;
}

/**
 * Result of running a workflow.
 *
 * @typeParam S - The workflow state type
 */
export interface WorkflowResult<S> {
  /** Final state after workflow completion */
  readonly state: S;
  /** All events emitted during execution */
  readonly events: readonly AnyEvent[];
  /** Session ID (useful if auto-generated) */
  readonly sessionId: SessionId;
  /** Tape for time-travel debugging */
  readonly tape: Tape<S>;
}

/**
 * Workflow definition - configuration for creating a workflow.
 *
 * @typeParam S - The workflow state type
 */
export interface WorkflowDefinition<S> {
  /** Unique workflow name */
  readonly name: string;
  /** Initial state for new sessions */
  readonly initialState: S;
  /** Handlers that react to events */
  readonly handlers: readonly HandlerDefinition<AnyEvent, S>[];
  /** AI agents that produce events */
  readonly agents: readonly Agent<S, unknown>[];
  /** Termination condition - returns true when workflow should stop */
  readonly until: (state: S) => boolean;
  /** Optional store for persistence */
  readonly store?: Store;
  /** Default renderers */
  readonly renderers?: readonly Renderer<S, unknown>[];
  /** Default model for agents */
  readonly model?: string;
}

/**
 * Workflow interface - the runtime workflow instance.
 *
 * @typeParam S - The workflow state type
 *
 * @remarks
 * The Workflow is created from a WorkflowDefinition and provides:
 * - `run()`: Execute the workflow with input
 * - `load()`: Load a recorded session as a Tape
 * - `dispose()`: Clean up resources
 *
 * @example
 * ```typescript
 * const workflow = createWorkflow({
 *   name: "chat",
 *   initialState: { messages: [] },
 *   handlers: [handleUserInput, handleAgentResponse],
 *   agents: [chatAgent],
 *   until: (state) => state.terminated,
 * });
 *
 * // Run the workflow
 * const result = await workflow.run({
 *   input: "Hello!",
 *   record: true,
 * });
 *
 * // Load a recorded session
 * const tape = await workflow.load(result.sessionId);
 *
 * // Time-travel debug
 * const t1 = tape.stepBack();
 * console.log(t1.state);
 *
 * // Cleanup
 * await workflow.dispose();
 * ```
 */
export interface Workflow<S = unknown> {
  /** Workflow name */
  readonly name: string;

  /**
   * Run the workflow with the given input.
   *
   * @param options - Run options including input, recording settings
   * @returns Promise resolving to the workflow result
   * @throws Error if execution fails
   */
  run(options: RunOptions): Promise<WorkflowResult<S>>;

  /**
   * Load a recorded session as a Tape.
   *
   * @param sessionId - The session to load
   * @returns Promise resolving to a Tape for the session
   * @throws Error if session not found
   */
  load(sessionId: SessionId): Promise<Tape<S>>;

  /**
   * Dispose of the workflow and release resources.
   *
   * @remarks
   * Should be called when the workflow is no longer needed.
   * Cleans up Effect runtime, connections, etc.
   */
  dispose(): Promise<void>;
}

// ============================================================================
// Server Integration Types
// ============================================================================

/**
 * Server-side workflow handler for HTTP endpoints.
 *
 * @remarks
 * Created with `createWorkflowHandler(workflow)` for server integration.
 */
export interface WorkflowHandler {
  /**
   * Handle an HTTP request.
   *
   * @param request - The incoming request
   * @returns Response (may be streaming SSE)
   */
  handle(request: Request): Promise<Response>;
}

/**
 * Options for creating a workflow handler.
 */
export interface CreateWorkflowHandlerOptions {
  /** The workflow to handle */
  readonly workflow: Workflow;
  /** CORS settings */
  readonly cors?: {
    readonly origin?: string | readonly string[];
    readonly methods?: readonly string[];
  };
}
