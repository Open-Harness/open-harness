# Data Model: Fluent Harness DX

**Date**: 2025-12-27
**Source**: Extracted from `specs/backlog/006-fluent-harness-dx.md` Type Definitions section

## Overview

This document defines the TypeScript interfaces and types for the fluent harness API. All types support full generic inference for type safety.

---

## Level 1: wrapAgent (One-liner)

```typescript
/**
 * Wrap a single agent for quick execution with optional event handling.
 */
function wrapAgent<TAgent extends AgentConstructor>(
  agentClass: TAgent
): WrappedAgent<InstanceType<TAgent>>;

/**
 * Wrapped agent with chainable event subscription.
 */
interface WrappedAgent<TAgent> {
  /** Subscribe to events */
  on: <E extends HarnessEventType>(type: E, handler: HarnessEventHandler<E>) => this;

  /** Execute the agent's main method */
  run: (...args: Parameters<TAgent['execute']>) => Promise<ReturnType<TAgent['execute']>>;
}
```

---

## Level 2 & 3: defineHarness

### Configuration

```typescript
/**
 * Configuration for defineHarness().
 * Supports both run: (simple) and execute: (generator) patterns.
 * These are mutually exclusive.
 */
interface HarnessConfig<
  TAgents extends Record<string, AgentConstructor>,
  TState = {},
  TInput = void,
  TResult = void
> {
  /** Optional harness name for debugging/logging. Default: 'anonymous-harness' */
  name?: string;

  /** Execution mode. Default: 'live' */
  mode?: 'live' | 'replay';

  /** Agent constructors to resolve and inject */
  agents: TAgents;

  /** State factory function. Default: () => ({}) */
  state?: (input: TInput) => TState;

  /** Simple async function execution (no generator) */
  run?: (
    context: ExecuteContext<TAgents, TState>,
    input: TInput
  ) => Promise<TResult>;

  /** Generator execution with step recording via yields */
  execute?: (
    context: ExecuteContext<TAgents, TState>
  ) => AsyncGenerator<StepYield, TResult>;
}
```

### Execute Context

```typescript
/**
 * Context passed to both run() and execute() functions.
 * Provides access to agents, state, and event helpers.
 */
interface ExecuteContext<TAgents, TState> {
  /** Resolved agent instances (not constructors) */
  agents: ResolvedAgents<TAgents>;

  /** Mutable state object */
  state: TState;

  /**
   * Phase helper - wraps work with auto start/complete events.
   * Emits phase:start before, phase:complete after (with return value).
   */
  phase: <T>(name: string, fn: () => Promise<T>) => Promise<T>;

  /**
   * Task helper - wraps work with auto start/complete/failed events.
   * Emits task:start before, task:complete or task:failed after.
   */
  task: <T>(id: string, fn: () => Promise<T>) => Promise<T>;

  /** Escape hatch for custom events not covered by helpers */
  emit: (type: string, data: Record<string, unknown>) => void;

  /**
   * Retry helper with auto-emitted events.
   * Emits: retry:start, retry:attempt, retry:backoff, retry:success, retry:failure
   */
  retry: <T>(
    name: string,
    fn: () => Promise<T>,
    options?: RetryOptions
  ) => Promise<T>;

  /**
   * Parallel execution helper with auto-emitted events.
   * Emits: parallel:start, parallel:item:complete, parallel:complete
   */
  parallel: <T>(
    name: string,
    fns: Array<() => Promise<T>>,
    options?: ParallelOptions
  ) => Promise<T[]>;
}

/**
 * Options for retry() helper.
 */
interface RetryOptions {
  /** Maximum retry attempts (default: 3) */
  retries?: number;
  /** Minimum backoff delay in ms (default: 1000) */
  minTimeout?: number;
  /** Maximum backoff delay in ms (default: 5000) */
  maxTimeout?: number;
}

/**
 * Options for parallel() helper.
 */
interface ParallelOptions {
  /** Maximum concurrent executions (default: 5) */
  concurrency?: number;
}

/**
 * Type helper: converts agent constructor record to instance record.
 */
type ResolvedAgents<T extends Record<string, AgentConstructor>> = {
  [K in keyof T]: InstanceType<T[K]>;
};
```

---

## Harness Factory and Instance

```typescript
/**
 * Factory returned by defineHarness().
 * Call create() to get a runnable instance.
 */
interface HarnessFactory<TState, TInput, TResult> {
  /** Create a new harness instance with the given input */
  create: (input: TInput) => HarnessInstance<TState, TResult>;
}

/**
 * Running harness instance.
 * Supports chainable event subscription and execution.
 */
interface HarnessInstance<TState, TResult> {
  /** Chainable event subscription. Returns this for chaining. */
  on: <E extends HarnessEventType>(type: E, handler: HarnessEventHandler<E>) => this;

  /** Execute the harness. Returns result with state and collected events. */
  run: () => Promise<HarnessResult<TState, TResult>>;

  /** Access current state (readonly from external perspective) */
  readonly state: TState;
}

/**
 * Result of harness.run().
 * Contains the execution result, final state, collected events, and timing.
 */
interface HarnessResult<TState, TResult> {
  /** Return value from run()/execute() */
  result: TResult;

  /** Final state after execution */
  state: TState;

  /** All events emitted during execution */
  events: HarnessEvent[];

  /** Total execution time in milliseconds */
  duration: number;
}
```

---

## Event Types

### Event Type Union

```typescript
/**
 * All possible harness event types.
 * Use '*' for wildcard subscription to all events.
 */
type HarnessEventType =
  | 'phase' | 'task' | 'step' | 'narrative' | 'error'
  | 'retry' | 'parallel'
  | '*';
```

### Individual Event Interfaces

```typescript
/**
 * Phase lifecycle event.
 * Emitted by phase() helper or manual emit.
 */
interface PhaseEvent {
  type: 'phase';
  name: string;
  status: 'start' | 'complete';
  data?: Record<string, unknown>;
}

/**
 * Task lifecycle event.
 * Emitted by task() helper.
 */
interface TaskEvent {
  type: 'task';
  id: string;
  status: 'start' | 'complete' | 'failed';
  data?: Record<string, unknown>;
}

/**
 * Step recording event.
 * Emitted via yield in execute() generator.
 */
interface StepEvent {
  type: 'step';
  step: string;
  input: unknown;
  output: unknown;
}

/**
 * Narrative event from @Monologue decorator.
 * Agent-generated LLM summaries of their work.
 */
interface NarrativeEvent {
  type: 'narrative';
  agent: string;
  text: string;
  timestamp: Date;
}

/**
 * Error event for exception handling.
 */
interface ErrorEvent {
  type: 'error';
  message: string;
  cause?: unknown;
}

/**
 * Retry lifecycle events.
 * Emitted by retry() helper.
 */
interface RetryStartEvent {
  type: 'retry:start';
  name: string;
  maxAttempts: number;
}

interface RetryAttemptEvent {
  type: 'retry:attempt';
  name: string;
  attempt: number;
  maxAttempts: number;
}

interface RetryBackoffEvent {
  type: 'retry:backoff';
  name: string;
  attempt: number;
  delay: number;
  error: string;
}

interface RetrySuccessEvent {
  type: 'retry:success';
  name: string;
  attempt: number;
}

interface RetryFailureEvent {
  type: 'retry:failure';
  name: string;
  attempts: number;
  error: string;
}

type RetryEvent = RetryStartEvent | RetryAttemptEvent | RetryBackoffEvent | RetrySuccessEvent | RetryFailureEvent;

/**
 * Parallel execution events.
 * Emitted by parallel() helper.
 */
interface ParallelStartEvent {
  type: 'parallel:start';
  name: string;
  total: number;
  concurrency: number;
}

interface ParallelItemCompleteEvent {
  type: 'parallel:item:complete';
  name: string;
  index: number;
  completed: number;
  total: number;
}

interface ParallelCompleteEvent {
  type: 'parallel:complete';
  name: string;
  total: number;
}

type ParallelEvent = ParallelStartEvent | ParallelItemCompleteEvent | ParallelCompleteEvent;

/**
 * Union of all harness events.
 */
type HarnessEvent = PhaseEvent | TaskEvent | StepEvent | NarrativeEvent | ErrorEvent | RetryEvent | ParallelEvent;
```

### Step Yield (Generator Only)

```typescript
/**
 * Step yield for execute() generator.
 * Used for step recording and replay.
 */
interface StepYield {
  step: string;
  input?: unknown;
  output?: unknown;
}
```

---

## Supporting Types

```typescript
/**
 * Agent constructor type.
 * Agents must have an execute method and be instantiable.
 * Uses unknown[] to comply with constitution (no `any` types).
 */
type AgentConstructor = new (...args: unknown[]) => { execute: (...args: unknown[]) => unknown };

/**
 * Event handler signature.
 * Generic over event type for proper inference.
 */
type HarnessEventHandler<E extends HarnessEventType> =
  E extends 'phase' ? (event: PhaseEvent) => void :
  E extends 'task' ? (event: TaskEvent) => void :
  E extends 'step' ? (event: StepEvent) => void :
  E extends 'narrative' ? (event: NarrativeEvent) => void :
  E extends 'error' ? (event: ErrorEvent) => void :
  E extends '*' ? (event: HarnessEvent) => void :
  never;
```

---

## Contextual Event Wrapper Pattern

> **CRITICAL IMPLEMENTATION CONTRACT**: All context helpers (`phase()`, `task()`, `retry()`, `parallel()`) MUST follow this pattern exactly to ensure consistent event emission behavior.

### Pattern Definition

Every contextual helper wraps an async function and emits lifecycle events:

```typescript
/**
 * CANONICAL PATTERN - all helpers MUST implement this contract:
 *
 * 1. Emit START event (before execution)
 * 2. Execute inner function (with try/catch)
 * 3. On success: Emit COMPLETE/SUCCESS event (with result)
 * 4. On failure: Emit FAILED/FAILURE event (with error)
 * 5. Re-throw error (propagate, don't swallow)
 * 6. Return result to caller
 */
async function wrapperPattern<T>(
  name: string,
  fn: () => Promise<T>,
  emit: (type: string, data: Record<string, unknown>) => void,
  eventPrefix: string // 'phase' | 'task' | 'retry' | 'parallel'
): Promise<T> {
  emit(`${eventPrefix}:start`, { name });

  try {
    const result = await fn();
    emit(`${eventPrefix}:complete`, { name, result });
    return result;
  } catch (error) {
    emit(`${eventPrefix}:failed`, {
      name,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error; // ALWAYS re-throw - never swallow
  }
}
```

### Helper-Specific Event Sequences

| Helper | Start Event | Success Event | Failure Event | Notes |
|--------|-------------|---------------|---------------|-------|
| `phase()` | `phase:start` | `phase:complete` | `phase:failed` | Phases contain multiple tasks |
| `task()` | `task:start` | `task:complete` | `task:failed` | Single unit of work |
| `retry()` | `retry:start` | `retry:success` | `retry:failure` | Also emits `retry:attempt`, `retry:backoff` |
| `parallel()` | `parallel:start` | `parallel:complete` | (per-item) | Also emits `parallel:item:complete` |

### Event Data Requirements

All events MUST include:

```typescript
interface BaseEventData {
  /** Unique identifier for this execution (for correlation) */
  name: string;
  /** Timestamp of emission */
  timestamp: Date;
}

interface SuccessEventData extends BaseEventData {
  /** Return value of the wrapped function (may be undefined) */
  result?: unknown;
}

interface FailedEventData extends BaseEventData {
  /** Error message (always present) */
  error: string;
  /** Error stack trace (if available) */
  stack?: string;
  /** Original error object (for programmatic handling) */
  cause?: unknown;
}
```

### Nesting Behavior

Helpers can be nested. Inner events complete before outer events:

```typescript
await phase('planning', async () => {
  // phase:start { name: 'planning' }

  await task('gather-requirements', async () => {
    // task:start { name: 'gather-requirements' }
    // ... work ...
    // task:complete { name: 'gather-requirements', result: ... }
  });

  await task('design-solution', async () => {
    // task:start { name: 'design-solution' }
    // ... work ...
    // task:complete { name: 'design-solution', result: ... }
  });

  // phase:complete { name: 'planning', result: ... }
});
```

### Error Propagation Contract

1. **Helpers NEVER swallow errors** — always re-throw after emitting failure event
2. **Outer scopes receive the error** — can catch or let propagate
3. **Failure events include full error context** — message, stack, cause
4. **Parent phase receives error** — phase:failed emits if any task fails

```typescript
// Error propagation example:
await phase('coding', async () => {
  await task('write-code', async () => {
    throw new Error('Compilation failed');
    // task:failed { name: 'write-code', error: 'Compilation failed' }
  });
  // Error propagates to phase
  // phase:failed { name: 'coding', error: 'Compilation failed' }
});
// Error propagates to caller
```

### Retry-Specific Events

The `retry()` helper emits additional events for observability:

```typescript
retry('api-call', fn, { retries: 3, minTimeout: 1000 })

// Event sequence on failure + eventual success:
// retry:start { name: 'api-call', maxAttempts: 3 }
// retry:attempt { name: 'api-call', attempt: 1, maxAttempts: 3 }
// retry:backoff { name: 'api-call', attempt: 1, delay: 1000, error: 'Network error' }
// retry:attempt { name: 'api-call', attempt: 2, maxAttempts: 3 }
// retry:success { name: 'api-call', attempt: 2 }
```

### Parallel-Specific Events

The `parallel()` helper emits per-item progress:

```typescript
parallel('process-files', [fn1, fn2, fn3], { concurrency: 2 })

// Event sequence:
// parallel:start { name: 'process-files', total: 3, concurrency: 2 }
// parallel:item:complete { name: 'process-files', index: 0, completed: 1, total: 3 }
// parallel:item:complete { name: 'process-files', index: 1, completed: 2, total: 3 }
// parallel:item:complete { name: 'process-files', index: 2, completed: 3, total: 3 }
// parallel:complete { name: 'process-files', total: 3 }
```

### Implementation Checklist

When implementing any contextual helper:

- [ ] Emit start event BEFORE calling inner function
- [ ] Wrap execution in try/catch
- [ ] On success: emit complete/success event WITH result
- [ ] On failure: emit failed/failure event WITH error details (message, stack)
- [ ] Re-throw the error (never swallow)
- [ ] Return the result to caller
- [ ] Include `name` in ALL events
- [ ] Include `timestamp` in ALL events

---

## Entity Relationships

```
┌─────────────────┐      creates      ┌─────────────────┐
│ HarnessConfig   │─────────────────►│ HarnessFactory  │
└─────────────────┘                   └────────┬────────┘
        │                                      │
        │ defines                              │ create(input)
        ▼                                      ▼
┌─────────────────┐                   ┌─────────────────┐
│ ExecuteContext  │◄──────────────────│ HarnessInstance │
└─────────────────┘   receives        └────────┬────────┘
        │                                      │
        │ contains                             │ run()
        ▼                                      ▼
┌─────────────────┐                   ┌─────────────────┐
│ ResolvedAgents  │                   │ HarnessResult   │
│ state: TState   │                   │ events[]        │
│ phase(), task() │                   │ duration        │
│ emit()          │                   └─────────────────┘
└─────────────────┘
```
