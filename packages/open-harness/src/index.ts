/**
 * open-harness - Event-sourced AI agent workflow runtime.
 *
 * Primary API for defining and running AI agent workflows.
 *
 * @example
 * ```typescript
 * import { agent, workflow, phase, run } from "open-harness"
 *
 * const myAgent = agent({ name: "assistant", model: "claude-sonnet-4-5", ... })
 * const myWorkflow = workflow({ name: "my-workflow", phases: { ... } })
 * const result = await run(myWorkflow, { input: "Hello" })
 * ```
 *
 * For subpath imports:
 * - `open-harness/core` - Full core API
 * - `open-harness/server` - HTTP/SSE server, Anthropic provider
 * - `open-harness/client` - HTTP client, React bindings
 * - `open-harness/testing` - Test utilities, recordings
 *
 * @module
 */

// Re-export the most commonly used APIs from core
export {
  // Agent definition
  agent,
  type AgentDef,
  // Phase definition
  phase,
  type PhaseDef,
  type HumanConfig,
  // Workflow definition
  workflow,
  type WorkflowDef,
  type SimpleWorkflowDef,
  type PhaseWorkflowDef,
  isSimpleWorkflow,
  isPhaseWorkflow,
  // Runtime
  run,
  type RunOptions,
  type RunResult,
  type RuntimeConfig,
  type WorkflowExecution,
  // Types
  type Draft,
  type ImmerDraft,
  // Events
  type AnyEvent,
  type Event,
  type EventId,
  type WorkflowObserver,
  type WorkflowResult,
  type WorkflowError,
  makeEvent,
  makeEventId,
  parseEventId,
  EventIdSchema,
  // Errors
  WorkflowAbortedError,
  WorkflowAgentError,
  WorkflowPhaseError,
  WorkflowProviderError,
  WorkflowStoreError,
  WorkflowTimeoutError,
  WorkflowValidationError,
  // HITL helpers
  autoApprove,
  cliPrompt,
  type HumanInputHandler
} from "@open-scaffold/core"
