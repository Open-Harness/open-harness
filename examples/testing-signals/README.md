# Testing Signals Example

Demonstrates how to test reactive agent workflows using `@open-harness/vitest` custom matchers for signal assertions.

## What This Shows

1. **Signal Pattern Matching** - Assert signals exist using exact names or glob patterns
2. **Payload Matching** - Assert signal payloads contain expected values
3. **Signal Counting** - Verify expected number of signal occurrences
4. **Sequence Validation** - Verify signals appear in expected order
5. **Error Handling** - Test error scenarios and partial completions
6. **Parallel Execution** - Validate concurrent agent patterns

## Running

```bash
# From repository root
bun test examples/testing-signals/
```

## Setup

### vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Auto-register matchers
    setupFiles: ['@open-harness/vitest/setup'],
  }
});
```

### Manual Setup

```typescript
import { expect, beforeAll } from 'vitest';
import { signalMatchers } from '@open-harness/vitest';

beforeAll(() => {
  expect.extend(signalMatchers);
});
```

## Available Matchers

### `toContainSignal(pattern)`

Assert that signals contain a matching signal.

```typescript
// Exact match
expect(signals).toContainSignal('harness:start');

// Glob patterns
expect(signals).toContainSignal('agent:*');      // Single segment wildcard
expect(signals).toContainSignal('provider:**');  // Multi-segment wildcard

// With payload matching
expect(signals).toContainSignal({
  name: 'agent:activated',
  payload: { agent: 'analyst' }
});

// Negation
expect(signals).not.toContainSignal('error:*');
```

### `toHaveSignalCount(pattern, count)`

Assert exact number of matching signals.

```typescript
// Count exact occurrences
expect(signals).toHaveSignalCount('agent:activated', 2);

// Count with glob
expect(signals).toHaveSignalCount('provider:*', 4);

// Count with payload condition
expect(signals).toHaveSignalCount(
  { name: 'agent:activated', payload: { agent: 'analyst' } },
  1
);

// Zero count for absent signals
expect(signals).toHaveSignalCount('error:*', 0);
```

### `toHaveSignalsInOrder(patterns[])`

Assert signals appear in specified order.

```typescript
// Validate workflow sequence
expect(signals).toHaveSignalsInOrder([
  'harness:start',
  'agent:activated',
  'analysis:complete',
  'harness:end'
]);

// With payload conditions
expect(signals).toHaveSignalsInOrder([
  { name: 'agent:activated', payload: { agent: 'analyst' } },
  'analysis:complete',
  { name: 'agent:activated', payload: { agent: 'trader' } },
  'trade:proposed'
]);

// With glob patterns
expect(signals).toHaveSignalsInOrder([
  'harness:*',
  'agent:*',
  'provider:*',
  'harness:*'
]);
```

## Common Test Patterns

### Testing Workflow Completion

```typescript
it('completes the full workflow', async () => {
  const result = await runReactive({
    agents: { analyst, trader },
    state: initialState,
    provider,
  });

  // Workflow started and ended
  expect(result.signals).toHaveSignalsInOrder([
    'harness:start',
    'harness:end'
  ]);

  // All agents activated
  expect(result.signals).toHaveSignalCount('agent:activated', 2);

  // Expected outputs produced
  expect(result.signals).toContainSignal('analysis:complete');
  expect(result.signals).toContainSignal('trade:proposed');
});
```

### Testing Guard Conditions

```typescript
it('skips agent when guard fails', async () => {
  const result = await runReactive({
    agents: { executor },
    state: { review: { approved: false } },  // Guard will fail
    provider,
  });

  // Agent was skipped, not activated
  expect(result.signals).toContainSignal({
    name: 'agent:skipped',
    payload: { reason: 'when guard returned false' }
  });

  expect(result.signals).not.toContainSignal('trade:executed');
});
```

### Testing Error Handling

```typescript
it('handles provider errors gracefully', async () => {
  const result = await runReactive({
    agents: { analyst },
    state: initialState,
    provider: failingProvider,
  });

  expect(result.signals).toContainSignal('provider:error');
  expect(result.signals).not.toContainSignal('provider:end');
  expect(result.signals).toContainSignal('harness:end');
});
```

### Testing Parallel Execution

```typescript
it('runs agents in parallel', async () => {
  const result = await runReactive({
    agents: { analyst, riskAssessor },  // Both activate on harness:start
    state: initialState,
    provider,
  });

  // Both activated by same trigger
  expect(result.signals).toHaveSignalCount(
    { name: 'agent:activated', payload: { trigger: 'harness:start' } },
    2
  );

  // Both completed
  expect(result.signals).toContainSignal('analysis:complete');
  expect(result.signals).toContainSignal('risk:assessed');
});
```

### Testing Signal Causality

```typescript
it('maintains proper causality chain', async () => {
  const result = await runReactive({
    agents: { analyst, trader, executor },
    state: initialState,
    provider,
  });

  // Verify signal chain order
  expect(result.signals).toHaveSignalsInOrder([
    { name: 'agent:activated', payload: { agent: 'analyst' } },
    'analysis:complete',
    { name: 'agent:activated', payload: { agent: 'trader', trigger: 'analysis:complete' } },
    'trade:proposed',
    { name: 'agent:activated', payload: { agent: 'executor', trigger: 'trade:proposed' } },
    'trade:executed'
  ]);
});
```

## Tips

1. **Use glob patterns** for flexible matching (`provider:*` instead of listing every signal)
2. **Test negative cases** with `.not.toContainSignal()` to ensure unwanted signals don't appear
3. **Combine matchers** - use `toHaveSignalsInOrder` for flow, `toHaveSignalCount` for quantities
4. **Match partial payloads** - only specify the fields you care about
5. **Simulate signals** for unit tests, use `runReactive()` for integration tests

## Next Steps

- See `examples/simple-reactive/` for basic workflow patterns
- See `examples/trading-agent/` for complex multi-agent workflows
- See `packages/open-harness/vitest/` for full matcher implementation
