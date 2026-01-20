# Research: Effect Patterns for core-v2

**Date**: 2026-01-21
**Status**: Complete

This document consolidates research findings for the greenfield `packages/core-v2` implementation.

---

## 1. Effect Service Pattern for LLM Providers

### Decision

Use **Context.Tag + Layer** for provider abstraction with **Stream.fromAsyncIterable** for SDK streaming integration.

### Rationale

1. `Context.Tag` provides type-safe service identification with zero runtime overhead
2. Layer composition enables provider swapping via dependency injection
3. `Stream.fromAsyncIterable` bridges Claude SDK AsyncIterables to Effect's resource-safe Stream
4. Services return `Effect<A, E, R>` internally, wrapped at boundary to expose Promises

### Implementation

```typescript
// src/provider/Provider.ts - Service interface
import { Context, Effect, Stream } from "effect";

export class ProviderError {
  readonly _tag = "ProviderError";
  constructor(
    readonly code: string,
    readonly message: string,
    readonly cause?: unknown
  ) {}
}

export interface LLMProvider {
  readonly query: (params: {
    messages: readonly Message[];
    sessionId?: string;
    model?: string;
    abortSignal?: AbortSignal;
  }) => Effect.Effect<Stream.Stream<Event, ProviderError>, never, never>;
}

export class LLMProvider extends Context.Tag("@core-v2/LLMProvider")<
  LLMProvider,
  LLMProvider
>() {}
```

```typescript
// src/provider/ClaudeProvider.ts - Layer implementation
import { Effect, Layer, Stream } from "effect";
import { query as claudeQuery } from "@anthropic-ai/claude-agent-sdk";

export const ClaudeProviderLive = Layer.effect(
  LLMProvider,
  Effect.gen(function* () {
    return LLMProvider.of({
      query: (params) =>
        Effect.gen(function* () {
          const sdkStream = claudeQuery({
            prompt: toSDKMessages(params.messages),
            options: { /* ... */ }
          });

          return Stream.fromAsyncIterable(
            sdkStream,
            (error) => new ProviderError(
              error instanceof Error ? error.name : "UNKNOWN",
              error instanceof Error ? error.message : String(error),
              error
            )
          ).pipe(
            Stream.mapEffect((sdkMsg) => mapSDKMessageToEvent(sdkMsg))
          );
        }),
    });
  })
);
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Direct class-based providers | No Layer swapping, manual cleanup, no Effect benefits |
| Effect Schema only | No dependency injection, no testability |
| Vercel AI SDK adapter | Duplicates abstractions, doesn't gain Effect benefits |

---

## 2. @effect/schema for Event Validation

### Decision

Use **@effect/schema** with `Schema.Struct`, `Schema.optional` for causality, and built-in readonly types for immutability.

### Rationale

1. Single definition generates both runtime validators AND TypeScript types
2. Built-in immutability (readonly types by default)
3. `Schema.optional` handles causedBy elegantly (missing, undefined, or valid ID)
4. Seamless Effect ecosystem integration

### Implementation

```typescript
// src/event/Event.ts
import { Schema as S } from "@effect/schema";

export const EventSchema = <P extends S.Schema.Any>(
  name: string,
  payloadSchema: P
) =>
  S.Struct({
    id: S.UUID,
    name: S.Literal(name),
    payload: payloadSchema,
    timestamp: S.DateFromString,
    causedBy: S.optional(S.UUID),
  });

export type Event<P> = S.Schema.Type<
  ReturnType<typeof EventSchema<S.Schema<P>>>
>;

// Concrete event example
export const TaskCompleted = EventSchema(
  "task:completed",
  S.Struct({
    taskId: S.UUID,
    outcome: S.Literal("success", "failure", "partial"),
    summary: S.String,
  })
);

type TaskCompletedEvent = S.Schema.Type<typeof TaskCompleted>;
```

### Immutability

- **Type-level**: Schema generates `{ readonly id: string; ... }`
- **Runtime**: Schema values are immutable by specification
- **No Object.freeze needed**: Effect philosophy is immutability via types

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Zod with wrappers | Manual Effect error wrappers, no readonly by default, extra dependency |
| Plain strings for IDs | Loses type safety, manual validation |
| Object.freeze | Unnecessary runtime overhead, Effect handles via types |

---

## 3. Effect Stream for LLM Streaming

### Decision

Use **Stream.async** with `StreamEmit.Emit` interface to convert Claude SDK AsyncIterable, wrap in **Effect.acquireRelease** for resource cleanup.

### Rationale

1. `Stream.async` is designed for callback-based APIs
2. `Effect.acquireRelease + Effect.scoped` ensures cleanup on success, failure, OR interruption
3. `Stream.tap` runs side effects (event emission) without disrupting stream flow
4. Backpressure handled automatically via Effect's chunk-based emission

### Implementation

```typescript
import { Effect, Stream, Chunk, Option, StreamEmit } from "effect";

const createClaudeStream = (
  prompt: AsyncIterable<SDKUserMessage>,
  options: Options
): Stream.Stream<UnifiedAgentMessage, Error> => {
  return Stream.async<UnifiedAgentMessage, Error>(
    (emit: StreamEmit.Emit<never, Error, UnifiedAgentMessage, void>) => {
      const abortController = new AbortController();

      Effect.acquireRelease(
        Effect.succeed(query({ prompt, options: { ...options, abortController } })),
        () => Effect.sync(() => abortController.abort())
      ).pipe(
        Effect.flatMap((queryStream) =>
          Effect.async<never, Error, void>((resume) => {
            (async () => {
              try {
                for await (const message of queryStream) {
                  const unifiedMessages = mapClaudeMessage(message);
                  for (const msg of unifiedMessages) {
                    emit(Effect.succeed(Chunk.of(msg)));
                  }
                }
                emit(Effect.fail(Option.none())); // End of stream
                resume(Effect.void);
              } catch (error) {
                emit(Effect.fail(Option.some(
                  error instanceof Error ? error : new Error(String(error))
                )));
              }
            })();
          })
        )
      );
    }
  );
};
```

### Interruption Handling

Interruption is automatic via Effect.scoped:
1. `AbortController.abort()` signals SDK to stop
2. Stream cleanup releases resources
3. Scope finalizers run any registered cleanup

---

## 4. Effect-to-Promise Boundary

### Decision

Use **ManagedRuntime** with **Effect.runPromise** at public API boundary, convert errors via **Exit.match** and **Cause.pretty**.

### Rationale

1. ManagedRuntime simplifies service integration in non-Effect environments
2. `Effect.runPromise` converts Effect to standard Promise
3. `Exit.match` + `Cause.pretty` converts Effect errors to standard Error objects
4. Consumers work with familiar async/await patterns

### Implementation

```typescript
// src/internal/boundary.ts
import { Effect, Exit, Cause, ManagedRuntime, Layer } from "effect";

// Create runtime once, reuse
const createWorkflowRuntime = (layers: Layer.Layer<Services>) =>
  ManagedRuntime.make(layers);

// Effect → Promise with proper error handling
export async function effectToPromise<A, E>(
  effect: Effect.Effect<A, E, never>
): Promise<A> {
  const exit = await Effect.runPromiseExit(effect);

  return Exit.match(exit, {
    onSuccess: (value) => value,
    onFailure: (cause) => {
      // Convert Cause to standard Error
      throw new Error(Cause.pretty(cause));
    }
  });
}

// Alternative: use .catch() on runPromise
export function runWithCatch<A, E>(
  effect: Effect.Effect<A, E, never>
): Promise<A> {
  return Effect.runPromise(effect).catch((err) => {
    // err is already FiberFailure, convert to Error
    throw err instanceof Error ? err : new Error(String(err));
  });
}
```

### ManagedRuntime Pattern

```typescript
// Workflow class with hidden Effect internals
export class Workflow {
  private runtime: ManagedRuntime.ManagedRuntime<WorkflowRuntime>;

  constructor(config: WorkflowConfig) {
    this.runtime = ManagedRuntime.make(
      WorkflowRuntimeLive.pipe(
        Layer.provide(ClaudeProviderLive)
      )
    );
  }

  // Public API: Promise-returning, no Effect types
  async run(input: string, callbacks: Callbacks): Promise<State> {
    return this.runtime.runPromise(
      Effect.flatMap(WorkflowRuntime, (rt) => rt.execute(input, callbacks))
    );
  }

  // Cleanup
  dispose(): Promise<void> {
    return this.runtime.dispose();
  }
}
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Expose Effect types publicly | Violates FR-062, bad DX for non-Effect users |
| Manual Layer.provide everywhere | Verbose, ManagedRuntime handles it |
| runSync | Cannot handle async streaming |

---

## 5. React Integration with Effect Internals

### Decision

Use **ManagedRuntime** with **callback-based state updates**, clean Effect boundaries, and **useEffect cleanup** for resource disposal.

### Rationale

1. Zero Effect type leakage - React sees plain Promises and callbacks
2. ManagedRuntime + Fiber cleanup handles SDK connection lifecycle
3. Callbacks trigger React `setState` from Effect context
4. Standard React patterns (useState, useCallback) - no observables

### Implementation

```typescript
// src/react.ts
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { Workflow, Event, State, Message } from "./index";

export interface UseWorkflowReturn {
  // AI SDK compatible
  messages: Message[];
  input: string;
  setInput: (input: string) => void;
  handleSubmit: () => void;
  isLoading: boolean;
  error: Error | null;

  // Open Harness unique
  events: Event[];
  state: State;
  tape: TapeControls;
}

export function useWorkflow(
  workflow: Workflow,
  config?: { initialState?: State }
): UseWorkflowReturn {
  const [events, setEvents] = useState<Event[]>([]);
  const [state, setState] = useState<State>(config?.initialState ?? {});
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      await workflow.run(input, {
        onEvent: (event) => {
          setEvents((prev) => [...prev, event]);
        },
        onStateChange: (newState) => {
          setState(newState);
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [workflow, input, isLoading]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      workflow.dispose().catch(() => {});
    };
  }, [workflow]);

  // Project events → messages
  const messages = useMemo(
    () => projectEventsToMessages(events),
    [events]
  );

  return {
    messages,
    input,
    setInput,
    handleSubmit,
    isLoading,
    error,
    events,
    state,
    tape: createTapeControls(events, state, setState)
  };
}
```

### Message Projection

```typescript
function projectEventsToMessages(events: Event[]): Message[] {
  const messages: Message[] = [];
  let currentAssistant: Message | null = null;

  for (const event of events) {
    switch (event.name) {
      case "user:input":
        messages.push({
          id: event.id,
          role: "user",
          content: event.payload.text,
          _events: [event.id]
        });
        break;

      case "text:delta":
        if (!currentAssistant) {
          currentAssistant = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "",
            _events: []
          };
          messages.push(currentAssistant);
        }
        currentAssistant.content += event.payload.delta;
        currentAssistant._events.push(event.id);
        break;

      case "text:complete":
        currentAssistant = null;
        break;
    }
  }

  return messages;
}
```

### Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| RxJS Observables | Extra ~50KB dependency, Effect already has Stream |
| Expose Effect types in hook | Violates FR-062 |
| Effect.runSync with polling | Cannot handle async streaming |

---

## Summary

| Research Question | Decision |
|-------------------|----------|
| Provider abstraction | Context.Tag + Layer + Stream.fromAsyncIterable |
| Event schema | @effect/schema with Schema.Struct, Schema.optional |
| Streaming | Stream.async + Effect.acquireRelease |
| Effect-Promise boundary | ManagedRuntime + Exit.match + Cause.pretty |
| React integration | Callbacks + useEffect cleanup + ManagedRuntime |

All decisions align with:
- **FR-061**: Effect for all internal async operations
- **FR-062**: Zero Effect types in public API
- **FR-063**: Effect failures converted to standard Error
- **FR-064**: Resource safety on success, failure, interruption

---

## Sources

- [Managing Services | Effect Documentation](https://effect.website/docs/requirements-management/services/)
- [Managing Layers | Effect Documentation](https://effect.website/docs/requirements-management/layers/)
- [Creating Streams | Effect Documentation](https://effect.website/docs/stream/creating/)
- [Introduction to Runtime | Effect Documentation](https://effect.website/docs/runtime/)
- [ManagedRuntime.ts - Effect API](https://effect-ts.github.io/effect/effect/ManagedRuntime.ts.html)
- [Introduction to Effect Schema](https://effect.website/docs/schema/introduction/)
- [Scope | Effect Documentation](https://effect.website/docs/resource-management/scope/)
- [Expected Errors | Effect Documentation](https://effect.website/docs/error-management/expected-errors/)
- [Matching | Effect Documentation](https://effect.website/docs/error-management/matching/)
