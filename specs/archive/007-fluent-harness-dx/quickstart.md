# Quickstart: Fluent Harness DX

**Date**: 2025-12-27

This guide shows how to use the new fluent harness API at each complexity level.

---

## Level 1: Single Agent (One-liner)

For quick, single-agent execution without workflow state.

```typescript
import { wrapAgent, CodingAgent } from '@openharness/sdk';

// Simplest possible usage
const result = await wrapAgent(CodingAgent).run('Write a hello world function');
console.log(result.summary);

// With event handling
await wrapAgent(CodingAgent)
  .on('narrative', (e) => console.log(`💭 ${e.text}`))
  .run('Write a hello world function');
```

---

## Level 2: Simple Workflow

For multi-agent workflows without complex state management.

```typescript
import { defineHarness, PlannerAgent, CodingAgent } from '@openharness/sdk';

const SimpleWorkflow = defineHarness({
  agents: { planner: PlannerAgent, coder: CodingAgent },

  // Simple async function - no generator needed
  run: async ({ agents }, input: string) => {
    const plan = await agents.planner.plan(input);
    const result = await agents.coder.execute(plan.tasks[0].description);
    return result;
  },
});

// Usage
const result = await SimpleWorkflow.create().run('Build a todo app');
```

---

## Level 3: Full Workflow

For complete workflows with state, phases, and event handling.

### Using run: (Async Function)

```typescript
import { defineHarness, ParserAgent, CodingAgent, ReviewAgent } from '@openharness/sdk';

const CodingWorkflow = defineHarness({
  name: 'coding-workflow',

  agents: {
    parser: ParserAgent,
    coder: CodingAgent,
    reviewer: ReviewAgent,
  },

  state: (input: { tasksPath: string }) => ({
    tasksPath: input.tasksPath,
    tasks: [] as Task[],
    results: [] as TaskResult[],
  }),

  run: async ({ agents, state, phase, task, emit }) => {
    // Phase 1: Parse
    await phase('Parsing', async () => {
      const parsed = await agents.parser.parseFile(state.tasksPath);
      state.tasks = parsed.tasks;
      return { count: parsed.tasks.length };
    });

    // Phase 2: Execute
    await phase('Execution', async () => {
      for (const t of state.tasks) {
        await task(t.id, async () => {
          const result = await agents.coder.execute(t.description);
          const review = await agents.reviewer.review(t.description, result.summary);
          state.results.push({ task: t, result, review });
          return { passed: review.passed };
        });
      }
    });

    // Custom event
    emit('summary', {
      total: state.tasks.length,
      passed: state.results.filter(r => r.review.passed).length,
    });

    return state.results;
  },
});

// Usage with event handlers
const harness = CodingWorkflow.create({ tasksPath: './tasks.md' });

harness
  .on('phase', (e) => console.log(`${e.status === 'start' ? '▶' : '✓'} ${e.name}`))
  .on('task', (e) => console.log(`  ${e.status === 'start' ? '○' : '●'} [${e.id}]`))
  .on('narrative', (e) => console.log(`    💭 [${e.agent}] ${e.text}`));

await harness.run();
```

### Using execute: (Generator with Yields)

For step recording and replay:

```typescript
const CodingWorkflowWithYields = defineHarness({
  name: 'coding-workflow',

  agents: { parser: ParserAgent, coder: CodingAgent, reviewer: ReviewAgent },

  state: (input: { tasksPath: string }) => ({
    tasksPath: input.tasksPath,
    tasks: [] as Task[],
    results: [] as TaskResult[],
  }),

  async *execute({ agents, state, phase, task, emit }) {
    const parsed = await phase('Parsing', async () => {
      const result = await agents.parser.parseFile(state.tasksPath);
      state.tasks = result.tasks;
      return result;
    });

    // Yield for step recording
    yield { step: 'parse', input: state.tasksPath, output: parsed };

    await phase('Execution', async () => {
      for (const t of state.tasks) {
        await task(t.id, async () => {
          const result = await agents.coder.execute(t.description);
          yield { step: `code-${t.id}`, input: t, output: result };

          const review = await agents.reviewer.review(t.description, result.summary);
          yield { step: `review-${t.id}`, input: result, output: review };

          state.results.push({ task: t, result, review });
          return { passed: review.passed };
        });
      }
    });

    emit('summary', {
      total: state.tasks.length,
      passed: state.results.filter(r => r.review.passed).length,
    });
  },
});
```

---

## Testing with Replay Mode

Use the same workflow definition with replay mode for deterministic tests:

```typescript
import { describe, test, expect } from 'bun:test';

// Same workflow, replay mode for testing
const testHarness = CodingWorkflow.create({
  tasksPath: './fixtures/sample-tasks.md',
});

// Collect events instead of logging
const events: HarnessEvent[] = [];
testHarness.on('*', (e) => events.push(e));

await testHarness.run();

// Assert on structured events, not console output
expect(events.filter(e => e.type === 'task')).toHaveLength(5);
expect(events.find(e => e.type === 'summary')?.data.passed).toBe(5);
```

---

## Control Flow Helpers

Built-in helpers for retries and parallel execution with automatic event visibility:

```typescript
run: async ({ agents, state, phase, retry, parallel }) => {
  await phase('Execute', async () => {
    // Retry with auto-emitted events (retry:start, retry:attempt, retry:success/failure)
    const result = await retry('coder-execute', () => agents.coder.execute(state.task), {
      retries: 3,        // default: 3
      minTimeout: 1000,  // default: 1000ms
      maxTimeout: 5000,  // default: 5000ms (exponential backoff)
    });

    // Parallel with auto-emitted events (parallel:start, parallel:item:complete, parallel:complete)
    const reviews = await parallel('reviews',
      state.tasks.map(t => () => agents.reviewer.review(t)),
      { concurrency: 3 }  // default: 5
    );
  });
};

// External handlers get full visibility
harness
  .on('retry', (e) => {
    if (e.type === 'retry:attempt') console.log(`  ↻ [${e.name}] attempt ${e.attempt}/${e.maxAttempts}`);
    if (e.type === 'retry:backoff') console.log(`  ⏳ [${e.name}] waiting ${e.delay}ms...`);
  })
  .on('parallel', (e) => {
    if (e.type === 'parallel:item:complete') console.log(`  ∥ [${e.name}] ${e.completed}/${e.total} done`);
  });
```

---

## Migration from BaseHarness

### Before (Old API)

```typescript
import { BaseHarness, createContainer, IEventBusToken } from '@openharness/sdk';

class CodingWorkflowHarness extends BaseHarness<...> {
  private planner: PlannerAgent;
  private unsubscribe: (() => void) | null = null;

  constructor(prd: string) {
    super({ initialState: { prd, tickets: [] } });
    const container = createContainer({ mode: 'live' });
    this.planner = container.get(PlannerAgent);
    const eventBus = container.get(IEventBusToken);
    this.unsubscribe = eventBus.subscribe(...);
  }

  protected async *execute() {
    console.log('=== Phase 1: Planning ===');
    // ...
  }

  cleanup() {
    this.unsubscribe?.();
  }
}

// Usage
const harness = new CodingWorkflowHarness(prd);
try { await harness.run(); }
finally { harness.cleanup(); }
```

### After (New API)

```typescript
import { defineHarness, PlannerAgent } from '@openharness/sdk';

const CodingWorkflow = defineHarness({
  agents: { planner: PlannerAgent },
  state: (input: { prd: string }) => ({ prd: input.prd, tickets: [] }),
  run: async ({ agents, state, phase }) => {
    await phase('Planning', async () => {
      const result = await agents.planner.plan(state.prd);
      state.tickets = result.tickets;
    });
  },
});

// Usage - auto-cleanup, external rendering
const harness = CodingWorkflow.create({ prd });
harness.on('phase', (e) => console.log(`=== ${e.name} ===`));
await harness.run();
```

**Key differences**:
- No `createContainer()` or `container.get()` calls
- No manual event subscription/cleanup
- No try/finally for cleanup
- Rendering is external via `.on()` handlers
- 50%+ less code
