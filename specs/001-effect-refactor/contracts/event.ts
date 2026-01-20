/**
 * Event Contracts - Public API Types
 *
 * These interfaces define the public API surface for Events.
 * NO Effect types are exposed here - these are the consumer-facing contracts.
 *
 * @module @core-v2/event
 */

/**
 * Unique identifier for an event (UUID v4).
 * Branded type at runtime, plain string for consumers.
 */
export type EventId = string & { readonly __brand: "EventId" };

/**
 * Base event structure - all events extend this.
 *
 * @remarks
 * Events are immutable facts representing something that happened.
 * The `name` field uses convention: past tense for facts (`task:completed`),
 * present tense for streaming (`text:delta`).
 */
export interface Event<Name extends string = string, Payload = unknown> {
  /** Unique event identifier */
  readonly id: EventId;
  /** Event type name (e.g., "user:input", "text:delta") */
  readonly name: Name;
  /** Event-specific payload data */
  readonly payload: Payload;
  /** When the event occurred */
  readonly timestamp: Date;
  /** ID of the event that caused this one (for causality tracking) */
  readonly causedBy?: EventId;
}

/**
 * Helper type to extract payload type from an event definition.
 */
export type EventPayload<E extends Event> = E["payload"];

/**
 * Generic event with unknown payload (for collections).
 */
export type AnyEvent = Event<string, unknown>;

// ============================================================================
// Built-in Event Types
// ============================================================================

/**
 * User input event - represents user-provided text input.
 */
export interface UserInputEvent
  extends Event<
    "user:input",
    {
      readonly text: string;
      readonly sessionId?: string;
    }
  > {}

/**
 * Text streaming delta - a chunk of streaming text from an agent.
 */
export interface TextDeltaEvent
  extends Event<
    "text:delta",
    {
      readonly delta: string;
      readonly agentName?: string;
    }
  > {}

/**
 * Text stream complete - signals end of a text stream.
 */
export interface TextCompleteEvent
  extends Event<
    "text:complete",
    {
      readonly fullText: string;
      readonly agentName?: string;
    }
  > {}

/**
 * Agent started - an AI agent has begun processing.
 */
export interface AgentStartedEvent
  extends Event<
    "agent:started",
    {
      readonly agentName: string;
      readonly reason?: string;
    }
  > {}

/**
 * Agent completed - an AI agent has finished processing.
 */
export interface AgentCompletedEvent
  extends Event<
    "agent:completed",
    {
      readonly agentName: string;
      readonly outcome: "success" | "failure" | "interrupted";
    }
  > {}

/**
 * Tool called - an agent has invoked a tool.
 */
export interface ToolCalledEvent
  extends Event<
    "tool:called",
    {
      readonly toolName: string;
      readonly toolId: string;
      readonly input: unknown;
    }
  > {}

/**
 * Tool result - the result of a tool invocation.
 */
export interface ToolResultEvent
  extends Event<
    "tool:result",
    {
      readonly toolId: string;
      readonly output: unknown;
      readonly isError: boolean;
    }
  > {}

/**
 * Error occurred - an error happened during execution.
 */
export interface ErrorOccurredEvent
  extends Event<
    "error:occurred",
    {
      readonly code: string;
      readonly message: string;
      readonly recoverable: boolean;
      readonly context?: unknown;
    }
  > {}

// ============================================================================
// Event Factory Types
// ============================================================================

/**
 * Event definition - used with `defineEvent()` factory.
 *
 * @example
 * ```typescript
 * const TaskCompleted = defineEvent("task:completed", {
 *   taskId: z.string().uuid(),
 *   outcome: z.enum(["success", "failure"]),
 * });
 *
 * type TaskCompletedEvent = EventFromDef<typeof TaskCompleted>;
 * ```
 */
export interface EventDefinition<
  Name extends string,
  PayloadSchema,
> {
  readonly name: Name;
  readonly schema: PayloadSchema;
}

/**
 * Infer Event type from an EventDefinition.
 */
export type EventFromDef<D extends EventDefinition<string, unknown>> =
  D extends EventDefinition<infer N, infer S>
    ? Event<N, S>
    : never;
