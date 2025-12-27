# API Contracts: Fluent Harness DX

**Date**: 2025-12-27

This document defines the public API surface for the fluent harness system.

---

## Module Exports

All new APIs must be exported from `@openharness/sdk`:

```typescript
// packages/sdk/src/index.ts additions

// Level 1: Single agent wrapper
export { wrapAgent } from './factory/wrap-agent.js';
export type { WrappedAgent } from './factory/wrap-agent.js';

// Level 2 & 3: Harness definition
export { defineHarness } from './factory/define-harness.js';
export type {
  HarnessConfig,
  HarnessFactory,
  HarnessInstance,
  HarnessResult,
  ExecuteContext,
} from './factory/define-harness.js';

// Event types
export type {
  HarnessEvent,
  HarnessEventType,
  HarnessEventHandler,
  PhaseEvent,
  TaskEvent,
  StepEvent,
  NarrativeEvent,
  ErrorEvent,
  StepYield,
  // Control flow events
  RetryEvent,
  RetryStartEvent,
  RetryAttemptEvent,
  RetryBackoffEvent,
  RetrySuccessEvent,
  RetryFailureEvent,
  ParallelEvent,
  ParallelStartEvent,
  ParallelItemCompleteEvent,
  ParallelCompleteEvent,
  // Control flow options
  RetryOptions,
  ParallelOptions,
} from './harness/event-types.js';

// Backward compatibility - keep existing exports
export { createContainer } from './core/container.js';  // Keep
export { createTaskHarness } from './factory/harness-factory.js';  // Keep
export { BaseHarness } from './harness/base-harness.js';  // Keep
```

---

## Function Signatures

### wrapAgent

```typescript
/**
 * Wrap a single agent for quick execution.
 *
 * @param agentClass - Agent constructor to wrap
 * @returns WrappedAgent with on() and run() methods
 *
 * @example
 * await wrapAgent(CodingAgent).run('Write hello world');
 */
function wrapAgent<TAgent extends AgentConstructor>(
  agentClass: TAgent
): WrappedAgent<InstanceType<TAgent>>;
```

### defineHarness

```typescript
/**
 * Define a harness configuration.
 *
 * @param config - Harness configuration
 * @returns HarnessFactory with create() method
 *
 * @example
 * const Workflow = defineHarness({
 *   agents: { coder: CodingAgent },
 *   run: async ({ agents }) => agents.coder.execute('task'),
 * });
 */
function defineHarness<
  TAgents extends Record<string, AgentConstructor>,
  TState = {},
  TInput = void,
  TResult = void
>(
  config: HarnessConfig<TAgents, TState, TInput, TResult>
): HarnessFactory<TState, TInput, TResult>;
```

---

## Method Signatures

### HarnessFactory.create

```typescript
/**
 * Create a harness instance.
 *
 * @param input - Input to pass to state factory
 * @returns HarnessInstance ready for event subscription and execution
 */
create(input: TInput): HarnessInstance<TState, TResult>;
```

### HarnessInstance.on

```typescript
/**
 * Subscribe to harness events.
 * Chainable - returns this for fluent API.
 * Subscriptions auto-cleaned up when run() completes.
 *
 * @param type - Event type to subscribe to ('*' for all)
 * @param handler - Callback for events
 * @returns this (for chaining)
 */
on<E extends HarnessEventType>(
  type: E,
  handler: HarnessEventHandler<E>
): this;
```

### HarnessInstance.run

```typescript
/**
 * Execute the harness.
 * Runs the configured run() or execute() function.
 * Cleans up all event subscriptions on completion.
 *
 * @returns Result containing return value, final state, events, duration
 */
run(): Promise<HarnessResult<TState, TResult>>;
```

### ExecuteContext.phase

```typescript
/**
 * Execute work within a named phase.
 * Auto-emits phase:start before and phase:complete after.
 *
 * @param name - Phase name for events
 * @param fn - Work to execute
 * @returns Return value of fn
 */
phase<T>(name: string, fn: () => Promise<T>): Promise<T>;
```

### ExecuteContext.task

```typescript
/**
 * Execute work for a specific task.
 * Auto-emits task:start before and task:complete/task:failed after.
 *
 * @param id - Task identifier for events
 * @param fn - Work to execute
 * @returns Return value of fn
 */
task<T>(id: string, fn: () => Promise<T>): Promise<T>;
```

### ExecuteContext.emit

```typescript
/**
 * Emit a custom event.
 * Escape hatch for events not covered by phase()/task().
 *
 * @param type - Event type string
 * @param data - Event data
 */
emit(type: string, data: Record<string, unknown>): void;
```

### ExecuteContext.retry

```typescript
/**
 * Execute with automatic retry and exponential backoff.
 * Auto-emits: retry:start, retry:attempt, retry:backoff, retry:success, retry:failure
 *
 * @param name - Name for event identification
 * @param fn - Function to execute
 * @param options - Retry configuration
 * @returns Result of fn on success
 * @throws Last error after all retries exhausted
 */
retry<T>(
  name: string,
  fn: () => Promise<T>,
  options?: {
    retries?: number;      // Default: 3
    minTimeout?: number;   // Default: 1000ms
    maxTimeout?: number;   // Default: 5000ms
  }
): Promise<T>;
```

### ExecuteContext.parallel

```typescript
/**
 * Execute functions in parallel with concurrency limit.
 * Auto-emits: parallel:start, parallel:item:complete, parallel:complete
 *
 * @param name - Name for event identification
 * @param fns - Array of functions to execute
 * @param options - Parallel configuration
 * @returns Array of results in same order as input
 */
parallel<T>(
  name: string,
  fns: Array<() => Promise<T>>,
  options?: {
    concurrency?: number;  // Default: 5
  }
): Promise<T[]>;
```

---

## Error Handling

### Expected Errors

| Error | Cause | Handling |
|-------|-------|----------|
| Agent resolution failed | DI container can't resolve agent | Throw with agent name and missing dependency |
| State factory throws | User's state factory throws | Propagate error, don't start execution |
| Execute/run throws | User's execute function throws | Emit error event, propagate error |
| Event handler throws | User's event handler throws | Log error, continue execution (non-critical) |

### Error Event

When execution fails, an error event is emitted before the error propagates:

```typescript
harness.on('error', (e) => {
  console.error(`Error: ${e.message}`, e.cause);
});
```

---

## Invariants

1. **Agent resolution happens once**: Agents are resolved in create(), not in run()
2. **State is created once**: State factory runs once per create() call
3. **Subscriptions auto-cleanup**: All .on() subscriptions removed when run() completes
4. **Events are synchronous**: Event delivery doesn't block execution
5. **emit() after run() is no-op**: Calling emit() after run() completes does nothing
6. **Mutable state is shared**: State object is the same reference throughout execution
