/**
 * Message Contracts - Public API Types (React Integration)
 *
 * These interfaces define the AI SDK-compatible Message format
 * for React integration. Messages are projected from Events.
 *
 * @module @core-v2/message
 */

import type { EventId } from "./event";

/**
 * Message role - compatible with Vercel AI SDK.
 */
export type MessageRole = "user" | "assistant" | "system" | "tool";

/**
 * Tool invocation state.
 */
export type ToolInvocationState = "pending" | "result" | "error";

/**
 * Tool invocation within a message.
 *
 * @remarks
 * Matches Vercel AI SDK's tool invocation structure.
 */
export interface ToolInvocation {
  /** Unique tool call ID */
  readonly toolCallId: string;
  /** Name of the tool that was called */
  readonly toolName: string;
  /** Arguments passed to the tool */
  readonly args: unknown;
  /** Tool result (when state is "result" or "error") */
  readonly result?: unknown;
  /** Current state of the invocation */
  readonly state: ToolInvocationState;
}

/**
 * Message - AI SDK-compatible chat message.
 *
 * @remarks
 * Messages are projected from Events for React integration.
 * The `_events` array provides traceability back to source events.
 *
 * Projection rules:
 * - `user:input` → `{ role: "user", content: payload.text }`
 * - `text:delta` → Append to current assistant message
 * - `text:complete` → Finalize assistant message
 * - `agent:started` → Start new assistant message with `name`
 * - `tool:called` → Add to `toolInvocations[]`
 * - `tool:result` → Update tool invocation result
 *
 * @example
 * ```typescript
 * // User message
 * const userMsg: Message = {
 *   id: "msg-1",
 *   role: "user",
 *   content: "What's the weather?",
 *   _events: ["event-1"],
 * };
 *
 * // Assistant message with tool call
 * const assistantMsg: Message = {
 *   id: "msg-2",
 *   role: "assistant",
 *   content: "Let me check the weather for you.",
 *   name: "weather-agent",
 *   toolInvocations: [{
 *     toolCallId: "call-1",
 *     toolName: "get_weather",
 *     args: { location: "New York" },
 *     result: { temp: 72, condition: "sunny" },
 *     state: "result",
 *   }],
 *   _events: ["event-2", "event-3", "event-4"],
 * };
 * ```
 */
export interface Message {
  /** Unique message identifier */
  readonly id: string;
  /** Message role */
  readonly role: MessageRole;
  /** Message content (accumulated from text:delta events) */
  readonly content: string;
  /** Agent name for assistant messages */
  readonly name?: string;
  /** Tool invocations within this message */
  readonly toolInvocations?: readonly ToolInvocation[];
  /** Source event IDs for traceability (internal) */
  readonly _events: readonly EventId[];
}

/**
 * Options for message projection.
 */
export interface ProjectionOptions {
  /** Whether to include _events field (default: true) */
  readonly includeEventIds?: boolean;
  /** Custom ID generator for messages */
  readonly generateId?: () => string;
}

// ============================================================================
// React Hook Types
// ============================================================================

/**
 * Return type of `useWorkflow` hook - AI SDK compatible values.
 *
 * @typeParam S - The workflow state type
 *
 * @remarks
 * Combines Vercel AI SDK-compatible values with Open Harness unique values:
 *
 * **AI SDK Compatible:**
 * - `messages`: Projected message array
 * - `input`: Current input value
 * - `setInput`: Update input value
 * - `handleSubmit`: Submit the input
 * - `isLoading`: Whether a request is in progress
 * - `error`: Any error that occurred
 *
 * **Open Harness Unique:**
 * - `events`: Raw event array
 * - `state`: Current workflow state
 * - `tape`: Tape controls for time-travel
 *
 * @example
 * ```tsx
 * function Chat() {
 *   const {
 *     messages,
 *     input,
 *     setInput,
 *     handleSubmit,
 *     isLoading,
 *     tape,
 *   } = useWorkflow(workflow);
 *
 *   return (
 *     <div>
 *       {messages.map((m) => (
 *         <div key={m.id}>{m.content}</div>
 *       ))}
 *       <form onSubmit={handleSubmit}>
 *         <input value={input} onChange={(e) => setInput(e.target.value)} />
 *         <button disabled={isLoading}>Send</button>
 *       </form>
 *       <button onClick={tape.stepBack}>Step Back</button>
 *     </div>
 *   );
 * }
 * ```
 */
export interface UseWorkflowReturn<S = unknown> {
  // =========================================================================
  // AI SDK Compatible
  // =========================================================================

  /** Projected messages for display */
  readonly messages: readonly Message[];
  /** Current input value */
  readonly input: string;
  /** Update input value */
  setInput: (value: string) => void;
  /** Submit the current input */
  handleSubmit: (e?: { preventDefault?: () => void }) => void;
  /** Whether a request is in progress */
  readonly isLoading: boolean;
  /** Error if one occurred */
  readonly error: Error | null;

  // =========================================================================
  // Open Harness Unique
  // =========================================================================

  /** Raw events (for power users) */
  readonly events: readonly import("./event").AnyEvent[];
  /** Current state (for power users) */
  readonly state: S;
  /** Tape controls for time-travel debugging */
  readonly tape: import("./tape").TapeControls<S>;
}

/**
 * Props for WorkflowProvider.
 */
export interface WorkflowProviderProps {
  /** The workflow to provide */
  readonly workflow: import("./workflow").Workflow;
  /** Initial state override */
  readonly initialState?: unknown;
  /** Children */
  readonly children: React.ReactNode;
}

/**
 * Props for WorkflowChat component.
 */
export interface WorkflowChatProps {
  /** The workflow to use */
  readonly workflow: import("./workflow").Workflow;
  /** CSS class name */
  readonly className?: string;
  /** Placeholder text for input */
  readonly placeholder?: string;
  /** Whether to show tape controls */
  readonly showTapeControls?: boolean;
}

// ============================================================================
// Client Connection Types
// ============================================================================

/**
 * Options for connecting to a server-side workflow.
 */
export interface UseWorkflowOptions {
  /** API endpoint URL for server-side workflow */
  readonly api?: string;
  /** Initial input value */
  readonly initialInput?: string;
  /** Initial messages */
  readonly initialMessages?: readonly Message[];
  /** Callback when workflow completes */
  readonly onFinish?: (result: import("./workflow").WorkflowResult<unknown>) => void;
  /** Callback on error */
  readonly onError?: (error: Error) => void;
}
