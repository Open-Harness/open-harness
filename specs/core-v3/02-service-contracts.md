# Core-v3 Service Contracts

**Date**: 2026-01-22
**Status**: Phase 2 - Service Contract Design
**Principle**: Effect is an implementation detail. Public API uses Zod + Promises.

---

## Design Boundary

```
PUBLIC API (SDK consumers)          INTERNAL (our implementation)
─────────────────────────────────   ─────────────────────────────────
Zod schemas                         Effect Schema
Promise<T>                          Effect<T, E, R>
Plain TypeScript interfaces         Context.Tag services
Class errors (for instanceof)       Data.TaggedError
```

---

## Part 1: Public API Types

These are what SDK consumers import and use. No Effect types exposed.

### 1.1 Event Types (Public)

```typescript
// ─────────────────────────────────────────────────────────────────
// PUBLIC: Event types that users see and work with
// ─────────────────────────────────────────────────────────────────

/**
 * Unique event identifier (UUID v4 string at runtime).
 * Branded at compile-time to prevent mixing with other string IDs.
 */
export type EventId = string & { readonly _brand: "EventId" };

/**
 * Base event interface - all workflow events extend this.
 *
 * Events are immutable facts representing something that happened.
 * Convention: past tense for facts (task:completed), present for streaming (text:delta)
 */
export interface Event<Name extends string = string, Payload = unknown> {
  readonly id: EventId;
  readonly name: Name;
  readonly payload: Payload;
  readonly timestamp: Date;
  readonly causedBy?: EventId;
}

/**
 * Generic event type for collections and runtime handling.
 */
export type AnyEvent = Event<string, unknown>;

/**
 * Event definition - provides type-safe create() and is() methods.
 */
export interface EventDefinition<Name extends string, Payload> {
  readonly name: Name;
  create: (payload: Payload, causedBy?: EventId) => Event<Name, Payload>;
  is: (event: AnyEvent) => event is Event<Name, Payload>;
}

/**
 * Factory to define custom event types.
 *
 * @example
 * const TaskCompleted = defineEvent<"task:completed", { taskId: string }>("task:completed");
 * const event = TaskCompleted.create({ taskId: "123" });
 */
export function defineEvent<Name extends string, Payload>(name: Name): EventDefinition<Name, Payload>;
```

### 1.2 Handler Types (Public)

```typescript
// ─────────────────────────────────────────────────────────────────
// PUBLIC: Handler types - pure functions for event processing
// ─────────────────────────────────────────────────────────────────

/**
 * Result returned by a handler.
 */
export interface HandlerResult<S> {
  readonly state: S;
  readonly events: readonly AnyEvent[];
}

/**
 * Pure handler function signature.
 *
 * MUST be: pure, deterministic, synchronous.
 * NO: side effects, I/O, API calls, async.
 */
export type Handler<E extends Event, S> = (event: E, state: S) => HandlerResult<S>;

/**
 * Handler definition with metadata.
 */
export interface HandlerDefinition<E extends Event = AnyEvent, S = unknown> {
  readonly name: string;
  readonly handles: E["name"];
  readonly handler: Handler<E, S>;
}

/**
 * Factory to define handlers with type safety.
 *
 * @example
 * const handleUserInput = defineHandler(UserInput, {
 *   name: "handleUserInput",
 *   handler: (event, state) => ({
 *     state: { ...state, lastInput: event.payload.text },
 *     events: [],
 *   }),
 * });
 */
export function defineHandler<Name extends string, Payload, S>(
  eventDef: EventDefinition<Name, Payload>,
  options: { name: string; handler: Handler<Event<Name, Payload>, S> }
): HandlerDefinition<Event<Name, Payload>, S>;
```

### 1.3 Agent Types (Public)

```typescript
// ─────────────────────────────────────────────────────────────────
// PUBLIC: Agent types - AI actors that produce events via LLM
// ─────────────────────────────────────────────────────────────────

import type { z } from "zod";

/**
 * Agent definition - an AI actor that responds to events.
 *
 * outputSchema is REQUIRED - enforces reliable structured output.
 * Uses Zod because it's familiar to SDK consumers.
 */
export interface Agent<S = unknown, O = unknown> {
  readonly name: string;
  readonly activatesOn: readonly string[];
  readonly emits: readonly string[];
  readonly model?: string;
  readonly prompt: (state: S, event: AnyEvent) => string;
  readonly when?: (state: S) => boolean;
  readonly outputSchema: z.ZodType<O>;  // Zod - public API
  readonly onOutput: (output: O, event: AnyEvent) => readonly AnyEvent[];
}

/**
 * Factory to create agents with validation.
 * Throws if outputSchema is missing.
 *
 * @example
 * const planner = agent<MyState, PlanOutput>({
 *   name: "planner",
 *   activatesOn: ["workflow:start"],
 *   emits: ["plan:created"],
 *   outputSchema: z.object({ tasks: z.array(TaskSchema) }),
 *   prompt: (state) => `Create plan for: ${state.goal}`,
 *   onOutput: (output, trigger) => [
 *     createEvent("plan:created", { tasks: output.tasks }, trigger.id),
 *   ],
 * });
 */
export function agent<S, O>(options: AgentOptions<S, O>): Agent<S, O>;
```

### 1.4 Workflow Types (Public)

```typescript
// ─────────────────────────────────────────────────────────────────
// PUBLIC: Workflow types - the main entry point for consumers
// ─────────────────────────────────────────────────────────────────

/**
 * Workflow definition - configuration for creating a workflow.
 */
export interface WorkflowDefinition<S> {
  readonly name: string;
  readonly initialState: S;
  readonly handlers: readonly HandlerDefinition<AnyEvent, S>[];
  readonly agents: readonly Agent<S, unknown>[];
  readonly until: (state: S) => boolean;
  // Optional: store and provider injected via options, not definition
}

/**
 * Workflow callbacks for observing execution.
 */
export interface WorkflowCallbacks<S = unknown> {
  readonly onEvent?: (event: AnyEvent) => void;
  readonly onStateChange?: (state: S) => void;
  readonly onError?: (error: Error) => void;
}

/**
 * Options for running a workflow.
 */
export interface RunOptions<S = unknown> {
  readonly input: string;
  readonly record?: boolean;
  readonly sessionId?: string;
  readonly callbacks?: WorkflowCallbacks<S>;
  readonly abortSignal?: AbortSignal;
}

/**
 * Result of running a workflow.
 */
export interface WorkflowResult<S> {
  readonly state: S;
  readonly events: readonly AnyEvent[];
  readonly sessionId: string;
  readonly tape: Tape<S>;
  readonly terminated: boolean;
}

/**
 * Workflow instance - Promise-based API, no Effect exposed.
 */
export interface Workflow<S = unknown> {
  readonly name: string;
  run(options: RunOptions<S>): Promise<WorkflowResult<S>>;
  load(sessionId: string): Promise<Tape<S>>;
  dispose(): Promise<void>;
}

/**
 * Factory to create workflows.
 *
 * @example
 * const workflow = createWorkflow({
 *   name: "task-executor",
 *   initialState: { tasks: [], phase: "idle" },
 *   handlers: [handleUserInput, handlePlanCreated],
 *   agents: [planner, executor],
 *   until: (state) => state.phase === "complete",
 * });
 *
 * const result = await workflow.run({ input: "Build a todo app" });
 */
export function createWorkflow<S>(definition: WorkflowDefinition<S>): Workflow<S>;
```

---

## Part 2: Internal Service Contracts (Effect)

These are implementation details. Users never see these.

### 2.1 Internal Branded Types (Effect Schema)

```typescript
// ─────────────────────────────────────────────────────────────────
// INTERNAL: Branded types using Effect Schema
// ─────────────────────────────────────────────────────────────────

import { Schema } from "effect";

/** Internal branded WorkflowId */
export const WorkflowIdSchema = Schema.String.pipe(Schema.brand("WorkflowId"));
export type WorkflowId = Schema.Schema.Type<typeof WorkflowIdSchema>;

/** Internal branded SessionId */
export const SessionIdSchema = Schema.String.pipe(Schema.brand("SessionId"));
export type SessionId = Schema.Schema.Type<typeof SessionIdSchema>;

/** Internal branded EventId (mirrors public but with Schema) */
export const EventIdSchema = Schema.UUID.pipe(Schema.brand("EventId"));
export type InternalEventId = Schema.Schema.Type<typeof EventIdSchema>;
```

### 2.2 Internal Error Types (Data.TaggedError)

```typescript
// ─────────────────────────────────────────────────────────────────
// INTERNAL: Typed errors using Data.TaggedError
// ─────────────────────────────────────────────────────────────────

import { Data } from "effect";

/** Workflow not found */
export class WorkflowNotFound extends Data.TaggedError("WorkflowNotFound")<{
  readonly workflowId: string;
}> {}

/** Session not found */
export class SessionNotFound extends Data.TaggedError("SessionNotFound")<{
  readonly sessionId: string;
}> {}

/** Store operation failed */
export class StoreError extends Data.TaggedError("StoreError")<{
  readonly operation: "read" | "write" | "delete";
  readonly cause: unknown;
}> {}

/** Agent execution failed */
export class AgentError extends Data.TaggedError("AgentError")<{
  readonly agentName: string;
  readonly phase: "prompt" | "execution" | "output";
  readonly cause: unknown;
}> {}

/** Provider (AgentProvider) error */
export class ProviderError extends Data.TaggedError("ProviderError")<{
  readonly code: "RATE_LIMITED" | "CONTEXT_EXCEEDED" | "AUTH_FAILED" | "NETWORK" | "UNKNOWN";
  readonly message: string;
  readonly retryable: boolean;
  readonly retryAfter?: number;
}> {}

/** Validation error */
export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly message: string;
  readonly path?: string;
}> {}

/** Handler error (should not happen - handlers are pure) */
export class HandlerError extends Data.TaggedError("HandlerError")<{
  readonly handlerName: string;
  readonly eventName: string;
  readonly cause: unknown;
}> {}
```

### 2.3 EventStore Service (Internal)

```typescript
// ─────────────────────────────────────────────────────────────────
// INTERNAL: EventStore service - persists events (the tape)
// ─────────────────────────────────────────────────────────────────

import { Context, Effect } from "effect";

export interface EventStoreService {
  /** Append event to session's event log */
  readonly append: (
    sessionId: SessionId,
    event: AnyEvent
  ) => Effect.Effect<void, StoreError>;

  /** Get all events for a session */
  readonly getEvents: (
    sessionId: SessionId
  ) => Effect.Effect<readonly AnyEvent[], StoreError>;

  /** Get events from a specific position */
  readonly getEventsFrom: (
    sessionId: SessionId,
    position: number
  ) => Effect.Effect<readonly AnyEvent[], StoreError>;

  /** List all sessions */
  readonly listSessions: () => Effect.Effect<readonly SessionId[], StoreError>;

  /** Delete a session */
  readonly deleteSession: (
    sessionId: SessionId
  ) => Effect.Effect<void, StoreError>;
}

export class EventStore extends Context.Tag("@core-v3/EventStore")<
  EventStore,
  EventStoreService
>() {}
```

### 2.4 StateStore Service (Internal)

```typescript
// ─────────────────────────────────────────────────────────────────
// INTERNAL: StateStore service - computed state cache with subscriptions
// ─────────────────────────────────────────────────────────────────

import { Context, Effect, Stream } from "effect";

export interface StateStoreService<S = unknown> {
  /** Get current state for a session */
  readonly get: (
    sessionId: SessionId
  ) => Effect.Effect<S, SessionNotFound>;

  /** Set state for a session */
  readonly set: (
    sessionId: SessionId,
    state: S
  ) => Effect.Effect<void, never>;

  /** Subscribe to state changes */
  readonly subscribe: (
    sessionId: SessionId
  ) => Stream.Stream<S, SessionNotFound>;
}

export class StateStore extends Context.Tag("@core-v3/StateStore")<
  StateStore,
  StateStoreService
>() {}
```

### 2.5 EventBus Service (Internal)

```typescript
// ─────────────────────────────────────────────────────────────────
// INTERNAL: EventBus service - broadcasts events to subscribers (SSE)
// ─────────────────────────────────────────────────────────────────

import { Context, Effect, Stream } from "effect";

export interface EventBusService {
  /** Publish event to all subscribers of a session */
  readonly publish: (
    sessionId: SessionId,
    event: AnyEvent
  ) => Effect.Effect<void, never>;

  /** Subscribe to events for a session */
  readonly subscribe: (
    sessionId: SessionId
  ) => Stream.Stream<AnyEvent, never>;
}

export class EventBus extends Context.Tag("@core-v3/EventBus")<
  EventBus,
  EventBusService
>() {}
```

### 2.6 AgentProvider Service (Internal)

```typescript
// ─────────────────────────────────────────────────────────────────
// INTERNAL: AgentProvider service - wraps agent SDKs (Claude, etc.)
// ─────────────────────────────────────────────────────────────────

import { Context, Effect, Stream } from "effect";

/** Message format for provider */
export interface ProviderMessage {
  readonly role: "user" | "assistant" | "system";
  readonly content: string;
}

/** Query options */
export interface QueryOptions {
  readonly messages: readonly ProviderMessage[];
  readonly sessionId?: string;
  readonly model?: string;
  readonly abortController?: AbortController;
  readonly outputFormat?: {
    readonly type: "json_schema";
    readonly schema: unknown;  // JSON Schema (converted from Zod)
  };
}

/** Streaming chunk */
export interface StreamChunk {
  readonly type: "text" | "tool_use" | "stop";
  readonly text?: string;
  readonly toolCall?: {
    readonly id: string;
    readonly name: string;
    readonly input: unknown;
  };
  readonly stopReason?: "end_turn" | "tool_use" | "max_tokens";
}

/** Query result */
export interface QueryResult {
  readonly events: readonly AnyEvent[];
  readonly text?: string;
  readonly output?: unknown;
  readonly sessionId?: string;
}

/** Provider info */
export interface ProviderInfo {
  readonly type: "claude" | "mock" | "custom";
  readonly name: string;
  readonly model: string;
  readonly connected: boolean;
}

export interface AgentProviderService {
  /** Send messages and get complete response */
  readonly query: (
    options: QueryOptions
  ) => Effect.Effect<QueryResult, ProviderError>;

  /** Send messages and get streaming response */
  readonly stream: (
    options: QueryOptions
  ) => Stream.Stream<StreamChunk, ProviderError>;

  /** Get provider info */
  readonly info: () => Effect.Effect<ProviderInfo, never>;
}

export class AgentProvider extends Context.Tag("@core-v3/AgentProvider")<
  AgentProvider,
  AgentProviderService
>() {}
```

### 2.7 AgentService (Internal)

```typescript
// ─────────────────────────────────────────────────────────────────
// INTERNAL: AgentService - executes agents within workflow context
// ─────────────────────────────────────────────────────────────────

import { Context, Effect, Stream } from "effect";

/** Events emitted during agent execution */
export type AgentEvent =
  | { readonly _tag: "Started"; readonly agentName: string }
  | { readonly _tag: "TextDelta"; readonly delta: string }
  | { readonly _tag: "ToolCalled"; readonly toolName: string; readonly toolId: string; readonly input: unknown }
  | { readonly _tag: "ToolResult"; readonly toolId: string; readonly output: unknown; readonly isError: boolean }
  | { readonly _tag: "OutputParsed"; readonly output: unknown }
  | { readonly _tag: "Completed"; readonly outcome: "success" | "failure" | "interrupted" };

export interface AgentServiceOps {
  /** Run an agent, streaming events as it executes */
  readonly run: <S, O>(
    agent: Agent<S, O>,
    state: S,
    triggerEvent: AnyEvent
  ) => Stream.Stream<AgentEvent, AgentError>;
}

export class AgentService extends Context.Tag("@core-v3/AgentService")<
  AgentService,
  AgentServiceOps
>() {}
```

### 2.8 WorkflowRuntime Service (Internal)

```typescript
// ─────────────────────────────────────────────────────────────────
// INTERNAL: WorkflowRuntime - orchestrates handlers + agents
// ─────────────────────────────────────────────────────────────────

import { Context, Effect, Stream } from "effect";

export interface RuntimeConfig<S> {
  readonly initialEvent: AnyEvent;
  readonly initialState: S;
  readonly handlers: readonly HandlerDefinition<AnyEvent, S>[];
  readonly agents: readonly Agent<S, unknown>[];
  readonly until: (state: S) => boolean;
  readonly sessionId?: SessionId;
  readonly record?: boolean;
}

export interface RuntimeResult<S> {
  readonly state: S;
  readonly events: readonly AnyEvent[];
  readonly sessionId: SessionId;
  readonly terminated: boolean;
}

export interface WorkflowRuntimeService {
  /** Run workflow to completion */
  readonly run: <S>(
    config: RuntimeConfig<S>
  ) => Effect.Effect<
    RuntimeResult<S>,
    WorkflowNotFound | AgentError | HandlerError | StoreError,
    EventStore | StateStore | EventBus | AgentService
  >;

  /** Get event stream for observing execution */
  readonly observe: (
    sessionId: SessionId
  ) => Stream.Stream<AnyEvent, SessionNotFound>;
}

export class WorkflowRuntime extends Context.Tag("@core-v3/WorkflowRuntime")<
  WorkflowRuntime,
  WorkflowRuntimeService
>() {}
```

---

## Part 3: Built-in Event Types

Standard events that the runtime uses.

```typescript
// ─────────────────────────────────────────────────────────────────
// Built-in events (public - users can listen for these)
// ─────────────────────────────────────────────────────────────────

export const UserInput = defineEvent<"user:input", { text: string; sessionId?: string }>("user:input");
export const WorkflowStart = defineEvent<"workflow:start", { goal: string }>("workflow:start");
export const TextDelta = defineEvent<"text:delta", { delta: string; agentName?: string }>("text:delta");
export const TextComplete = defineEvent<"text:complete", { fullText: string; agentName?: string }>("text:complete");
export const AgentStarted = defineEvent<"agent:started", { agentName: string; reason?: string }>("agent:started");
export const AgentCompleted = defineEvent<"agent:completed", { agentName: string; outcome: "success" | "failure" | "interrupted" }>("agent:completed");
export const ToolCalled = defineEvent<"tool:called", { toolName: string; toolId: string; input: unknown }>("tool:called");
export const ToolResult = defineEvent<"tool:result", { toolId: string; output: unknown; isError: boolean }>("tool:result");
export const ErrorOccurred = defineEvent<"error:occurred", { code: string; message: string; recoverable: boolean }>("error:occurred");
```

---

## Summary

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Public Types** | Plain TS + Zod | What users import |
| **Public Functions** | Returns Promises | createWorkflow, agent, defineHandler |
| **Internal Errors** | Data.TaggedError | Typed error handling |
| **Internal Services** | Context.Tag | Effect DI |
| **Internal State** | Effect Schema | Branded types |

**Key Principle**: Effect is an implementation detail. The public API looks like normal TypeScript.

---

## Next Phase

Phase 3: Compose Effect programs that use these services.
