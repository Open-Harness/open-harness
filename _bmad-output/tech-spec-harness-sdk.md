# Tech-Spec: Harness SDK

**Created:** December 24, 2025  
**Status:** Ready for Development  
**Source:** PRD-Harness v2.0  
**Approach:** TDD (Test-Driven Development)

---

## Overview

### Problem Statement

We need a framework for building step-aware autonomous agents where:
- Users **extend** a base class to create their harness
- Users **own** the entire execution loop (input retrieval + processing)
- Framework **provides** infrastructure: step counting, state management, history tracking
- Multiple agents can be orchestrated however the user decides
- **ONE unified pattern** works for all cadence types (time-based, task-completion, event-based)

### Solution

Create `BaseHarness` abstract class with a unified **AsyncGenerator pattern**:
- User implements `execute()` as an AsyncGenerator that yields `{ input, output }` pairs
- Framework iterates over the generator, handling step recording automatically
- Harness owns the entire loop - user just calls `harness.run()`

### The Unified Pattern

```typescript
abstract class BaseHarness<TState, TInput, TOutput> {
  // User implements this ONE method - yields input/output pairs
  protected abstract execute(): AsyncGenerator<{ input: TInput; output: TOutput }>;
  
  // Framework runs the harness
  async run(): Promise<void> {
    for await (const { input, output } of this.execute()) {
      this.currentStep++;
      this.state.record(this.currentStep, input, output, { modified: [] });
      
      if (this.isComplete()) break;
    }
  }
}
```

### Why This Pattern?

| Cadence Type | How User Implements `execute()` |
|--------------|--------------------------------|
| **Time-based** | `while(true) { yield { input: await poll(), output }; await sleep(5000); }` |
| **Task-completion** | `while(!done) { yield { input: nextTask(), output }; }` |
| **Event-based** | Can adapt events to async generator if needed |

**One pattern. All use cases.**

---

## Scope

**In Scope:**
- `BaseHarness` abstract class with `execute()` pattern
- `Agent` class (step-aware runner)
- `PersistentState` class
- `Step`, `Constraints`, `LoadedContext` types
- Integration tests (TDD)
- Two reference example harnesses (Trading, Coding)

**Out of Scope:**
- CLI harness runner (future)
- YAML configuration (future)
- Cloud execution (future)
- Event-based example (lower priority)

---

## Context for Development

### Codebase Patterns

**Existing SDK patterns to follow:**
- `BaseAgent` in `src/runner/base-agent.ts` - DI injection pattern
- `TaskList` in `src/workflow/task-list.ts` - state management
- Tests use Bun test framework (`bun:test`)
- Mock pattern: create `MockRunner` class implementing interface

**Conventions:**
- Files use `.ts` extension with `.js` imports (ESM)
- Classes use `@injectable()` decorator for DI
- Generics use `T` prefix: `TState`, `TInput`, `TOutput`

### Files to Reference

| File | Purpose |
|------|---------|
| `src/runner/base-agent.ts` | Pattern for class with DI |
| `src/workflow/task-list.ts` | State management pattern |
| `tests/unit/container.test.ts` | Test structure pattern |
| `src/runner/models.ts` | Type definition pattern |

### Technical Decisions

1. **AsyncGenerator pattern** - User's `execute()` yields `{ input, output }` pairs
2. **Framework owns the loop** - `run()` iterates over generator, handles recording
3. **Abstract class, not interface** - `BaseHarness` provides default implementations
4. **Protected members** - `currentStep`, `state` are protected for subclass access
5. **No createHarness()** - Users use `new MyHarness()`, not a factory
6. **Automatic step recording** - Framework calls `recordStep()`, not user

---

## Implementation Plan

### TDD Approach

We write tests FIRST, then implement to make tests pass.

**Test file:** `packages/sdk/tests/unit/harness.test.ts`

---

### Task 1: Create Types (`src/harness/types.ts`)

**Test First:**
```typescript
import { describe, test, expect } from 'bun:test';
import type { Step, StateDelta, Constraints, LoadedContext } from '../../src/harness/types.js';

describe('Harness Types', () => {
  test('Step interface has required fields', () => {
    const step: Step<string, number> = {
      stepNumber: 1,
      timestamp: Date.now(),
      input: 'test',
      output: 42,
      stateDelta: { modified: [] }
    };
    expect(step.stepNumber).toBe(1);
    expect(step.input).toBe('test');
    expect(step.output).toBe(42);
  });

  test('StateDelta tracks modifications', () => {
    const delta: StateDelta = {
      modified: ['balance', 'position'],
      summary: 'Updated portfolio'
    };
    expect(delta.modified).toContain('balance');
  });

  test('LoadedContext provides bounded state', () => {
    const context: LoadedContext<{ count: number }> = {
      state: { count: 5 },
      recentSteps: [],
      relevantKnowledge: {}
    };
    expect(context.state.count).toBe(5);
  });
});
```

**Implementation:**
- [ ] `Step<TInput, TOutput>` interface
- [ ] `StateDelta` interface  
- [ ] `Constraints` interface
- [ ] `LoadedContext<TState>` interface
- [ ] `HarnessConfig<TState>` interface
- [ ] `StepYield<TInput, TOutput>` type for generator yields

---

### Task 2: Create PersistentState (`src/harness/state.ts`)

**Test First:**
```typescript
import { describe, test, expect } from 'bun:test';
import { PersistentState } from '../../src/harness/state.js';

describe('PersistentState', () => {
  test('initializes with provided state', () => {
    const state = new PersistentState({ initialState: { count: 0 } });
    expect(state.getState()).toEqual({ count: 0 });
  });

  test('updateState modifies state immutably', () => {
    const state = new PersistentState({ initialState: { count: 0 } });
    state.updateState(s => ({ count: s.count + 1 }));
    expect(state.getState()).toEqual({ count: 1 });
  });

  test('record adds step to history', () => {
    const state = new PersistentState({ initialState: {} });
    state.record(1, 'input-a', 'output-a', { modified: [] });
    state.record(2, 'input-b', 'output-b', { modified: [] });
    
    const history = state.getStepHistory();
    expect(history.length).toBe(2);
    expect(history[0].stepNumber).toBe(1);
    expect(history[1].stepNumber).toBe(2);
  });

  test('loadContext returns bounded context', () => {
    const state = new PersistentState({ 
      initialState: { count: 0 },
      maxContextSteps: 5 
    });
    
    // Record 10 steps
    for (let i = 1; i <= 10; i++) {
      state.record(i, `input-${i}`, `output-${i}`, { modified: [] });
    }
    
    const context = state.loadContext();
    expect(context.recentSteps.length).toBe(5); // Bounded to maxContextSteps
    expect(context.recentSteps[0].stepNumber).toBe(6); // Most recent 5
    expect(context.state).toEqual({ count: 0 });
  });

  test('getRecentSteps returns last N steps', () => {
    const state = new PersistentState({ initialState: {} });
    state.record(1, 'a', 'A', { modified: [] });
    state.record(2, 'b', 'B', { modified: [] });
    state.record(3, 'c', 'C', { modified: [] });
    
    const recent = state.getRecentSteps(2);
    expect(recent.length).toBe(2);
    expect(recent[0].input).toBe('b');
    expect(recent[1].input).toBe('c');
  });
});
```

**Implementation:**
- [ ] `PersistentState<TState, TInput, TOutput>` class
- [ ] Constructor with `PersistentStateConfig`
- [ ] `getState(): TState`
- [ ] `updateState(updater): void`
- [ ] `loadContext(): LoadedContext<TState>`
- [ ] `record(stepNumber, input, output, stateDelta): void`
- [ ] `getRecentSteps(count): Step[]`
- [ ] `getStepHistory(): Step[]`

---

### Task 3: Create Agent (`src/harness/agent.ts`)

**Test First:**
```typescript
import { describe, test, expect } from 'bun:test';
import { Agent } from '../../src/harness/agent.js';

describe('Agent', () => {
  test('run() calls provided function with all params', async () => {
    let capturedParams: any = null;
    
    const agent = new Agent<{ x: number }, string, number>({
      name: 'TestAgent',
      run: async (params) => {
        capturedParams = params;
        return 42;
      }
    });

    const result = await agent.run({
      input: 'hello',
      context: { x: 1 },
      stepNumber: 5,
      stepHistory: [],
      constraints: {}
    });

    expect(result).toBe(42);
    expect(capturedParams.input).toBe('hello');
    expect(capturedParams.stepNumber).toBe(5);
    expect(capturedParams.context).toEqual({ x: 1 });
  });

  test('agent has name property', () => {
    const agent = new Agent({
      name: 'MyAgent',
      run: async () => 'ok'
    });
    expect(agent.name).toBe('MyAgent');
  });

  test('name defaults to "Agent"', () => {
    const agent = new Agent({
      run: async () => 'ok'
    });
    expect(agent.name).toBe('Agent');
  });

  test('isComplete uses provided function', () => {
    const agent = new Agent<{ done: boolean }, string, string>({
      run: async () => 'ok',
      isComplete: (state) => state.done
    });

    expect(agent.isComplete({ done: false })).toBe(false);
    expect(agent.isComplete({ done: true })).toBe(true);
  });

  test('isComplete defaults to false when not provided', () => {
    const agent = new Agent<{}, string, string>({
      run: async () => 'ok'
    });

    expect(agent.isComplete({})).toBe(false);
  });
});
```

**Implementation:**
- [ ] `Agent<TState, TInput, TOutput>` class
- [ ] Constructor with `AgentConfig`
- [ ] `run(params: AgentRunParams): Promise<TOutput>`
- [ ] `isComplete(state: TState): boolean`
- [ ] `name: string` property

---

### Task 4: Create BaseHarness (`src/harness/base-harness.ts`)

**Test First:**
```typescript
import { describe, test, expect } from 'bun:test';
import { BaseHarness } from '../../src/harness/base-harness.js';
import { Agent } from '../../src/harness/agent.js';

describe('BaseHarness', () => {
  // Simple test harness that yields 3 items then stops
  class SimpleHarness extends BaseHarness<{ count: number }, string, string> {
    private items = ['a', 'b', 'c'];
    
    async *execute() {
      for (const item of this.items) {
        const output = `processed: ${item}`;
        yield { input: item, output };
      }
    }
  }

  test('initializes with step 0', () => {
    const harness = new SimpleHarness({ initialState: { count: 0 } });
    expect(harness.getCurrentStep()).toBe(0);
  });

  test('run() executes all yields from execute()', async () => {
    const harness = new SimpleHarness({ initialState: { count: 0 } });
    await harness.run();
    
    expect(harness.getCurrentStep()).toBe(3);
  });

  test('run() records each step in history', async () => {
    const harness = new SimpleHarness({ initialState: { count: 0 } });
    await harness.run();
    
    const history = harness.getStepHistory();
    expect(history.length).toBe(3);
    expect(history[0]).toMatchObject({ stepNumber: 1, input: 'a', output: 'processed: a' });
    expect(history[1]).toMatchObject({ stepNumber: 2, input: 'b', output: 'processed: b' });
    expect(history[2]).toMatchObject({ stepNumber: 3, input: 'c', output: 'processed: c' });
  });

  test('getState returns current state', () => {
    const harness = new SimpleHarness({ initialState: { count: 42 } });
    expect(harness.getState()).toEqual({ count: 42 });
  });

  test('isComplete defaults to false', () => {
    const harness = new SimpleHarness({ initialState: { count: 0 } });
    expect(harness.isComplete()).toBe(false);
  });
});

describe('BaseHarness with state updates', () => {
  class CountingHarness extends BaseHarness<{ count: number }, number, number> {
    async *execute() {
      for (let i = 1; i <= 3; i++) {
        // Update state during execution
        this.state.updateState(s => ({ count: s.count + i }));
        yield { input: i, output: i * 2 };
      }
    }
  }

  test('state persists across steps', async () => {
    const harness = new CountingHarness({ initialState: { count: 0 } });
    await harness.run();
    
    // 0 + 1 + 2 + 3 = 6
    expect(harness.getState()).toEqual({ count: 6 });
  });
});

describe('BaseHarness with custom isComplete', () => {
  class EarlyStopHarness extends BaseHarness<{ stopAt: number }, number, number> {
    async *execute() {
      let i = 0;
      while (true) {
        i++;
        yield { input: i, output: i };
        // Note: isComplete check happens in run() after yield
      }
    }

    isComplete(): boolean {
      return this.getCurrentStep() >= this.state.getState().stopAt;
    }
  }

  test('run() stops when isComplete returns true', async () => {
    const harness = new EarlyStopHarness({ initialState: { stopAt: 5 } });
    await harness.run();
    
    expect(harness.getCurrentStep()).toBe(5);
    expect(harness.getStepHistory().length).toBe(5);
  });
});

describe('BaseHarness with agents', () => {
  class AgentHarness extends BaseHarness<{ value: number }, string, string> {
    private agent = new Agent<{ value: number }, string, string>({
      name: 'TestAgent',
      run: async ({ input, stepNumber, context }) => {
        return `step ${stepNumber}: ${input} (value: ${context.value})`;
      }
    });

    private inputs = ['first', 'second'];

    async *execute() {
      for (const input of this.inputs) {
        const context = this.loadContext();
        const output = await this.agent.run({
          input,
          context: context.state,
          stepNumber: this.currentStep + 1, // +1 because not incremented yet
          stepHistory: this.getStepHistory(),
          constraints: {}
        });
        yield { input, output };
      }
    }
  }

  test('agents receive step context', async () => {
    const harness = new AgentHarness({ initialState: { value: 100 } });
    await harness.run();
    
    const history = harness.getStepHistory();
    expect(history[0].output).toBe('step 1: first (value: 100)');
    expect(history[1].output).toBe('step 2: second (value: 100)');
  });
});

describe('BaseHarness with async delays (time-based simulation)', () => {
  class PollingHarness extends BaseHarness<{}, number, number> {
    private pollCount = 0;
    private maxPolls = 3;

    async *execute() {
      while (this.pollCount < this.maxPolls) {
        this.pollCount++;
        const input = this.pollCount;
        const output = input * 10;
        yield { input, output };
        
        // Simulate polling delay (in real usage: await sleep(5000))
        await Promise.resolve(); // Just yield control
      }
    }
  }

  test('polling pattern works', async () => {
    const harness = new PollingHarness({ initialState: {} });
    await harness.run();
    
    expect(harness.getCurrentStep()).toBe(3);
    expect(harness.getStepHistory().map(s => s.output)).toEqual([10, 20, 30]);
  });
});
```

**Implementation:**
- [ ] `BaseHarness<TState, TInput, TOutput>` abstract class
- [ ] Protected: `currentStep: number` (starts at 0)
- [ ] Protected: `state: PersistentState<TState, TInput, TOutput>`
- [ ] Protected: `loadContext(): LoadedContext<TState>`
- [ ] Abstract: `execute(): AsyncGenerator<{ input: TInput; output: TOutput }>`
- [ ] Public: `run(): Promise<void>` - iterates execute(), records steps
- [ ] Public: `isComplete(): boolean` (default false, can override)
- [ ] Public: `getCurrentStep(): number`
- [ ] Public: `getStepHistory(): Step[]`
- [ ] Public: `getState(): TState`

---

### Task 5: Create Index Exports (`src/harness/index.ts`)

**Test First:**
```typescript
import { describe, test, expect } from 'bun:test';

describe('Harness Exports', () => {
  test('exports all harness primitives', async () => {
    const exports = await import('../../src/harness/index.js');
    
    expect(exports.BaseHarness).toBeDefined();
    expect(exports.Agent).toBeDefined();
    expect(exports.PersistentState).toBeDefined();
  });
});
```

**Implementation:**
- [ ] Export `BaseHarness` from `./base-harness.js`
- [ ] Export `Agent` from `./agent.js`
- [ ] Export `PersistentState` from `./state.js`
- [ ] Export types from `./types.js`

---

### Task 6: Update SDK Index (`src/index.ts`)

**Test First:**
```typescript
import { describe, test, expect } from 'bun:test';

describe('SDK Exports', () => {
  test('SDK exports harness primitives', async () => {
    const sdk = await import('../../src/index.js');
    
    expect(sdk.BaseHarness).toBeDefined();
    expect(sdk.Agent).toBeDefined();
    expect(sdk.PersistentState).toBeDefined();
  });
});
```

**Implementation:**
- [ ] Add harness exports to `src/index.ts`

---

### Task 7: Create Reference Examples

**Trading Harness Example** (`src/examples/harness/trading-harness.ts`):

```typescript
import { BaseHarness, Agent } from '../../harness/index.js';

interface TradingState {
  balance: number;
  position: number;
}

interface MarketData {
  price: number;
  rsi: number;
}

interface Trade {
  action: 'BUY' | 'SELL' | 'HOLD';
  amount: number;
}

// Example: Trading harness with time-based polling
class TradingHarness extends BaseHarness<TradingState, MarketData, Trade> {
  private trader = new Agent<TradingState, MarketData, Trade>({
    name: 'Trader',
    async run({ input, stepNumber }) {
      console.log(`Step ${stepNumber}: RSI=${input.rsi}`);
      
      if (input.rsi < 30) return { action: 'BUY', amount: 0.1 };
      if (input.rsi > 70) return { action: 'SELL', amount: 0.1 };
      return { action: 'HOLD', amount: 0 };
    }
  });

  async *execute() {
    while (true) {
      // Simulate fetching market data
      const input: MarketData = await this.fetchMarketData();
      
      const context = this.loadContext();
      const output = await this.trader.run({
        input,
        context: context.state,
        stepNumber: this.currentStep + 1,
        stepHistory: this.getStepHistory(),
        constraints: { maxDrawdown: 0.1 }
      });
      
      yield { input, output };
      
      // Wait before next poll
      await this.sleep(5000);
    }
  }

  private async fetchMarketData(): Promise<MarketData> {
    // Mock - in real usage, call exchange API
    return { price: 50000 + Math.random() * 1000, rsi: Math.random() * 100 };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Usage:
// const harness = new TradingHarness({ initialState: { balance: 10000, position: 0 } });
// await harness.run(); // Runs forever, polling every 5 seconds
```

**Coding Harness Example** (`src/examples/harness/coding-harness.ts`):

```typescript
import { BaseHarness, Agent } from '../../harness/index.js';

interface CodingState {
  ticketsRemaining: number;
  completed: string[];
}

interface Ticket {
  id: string;
  title: string;
}

interface CodeResult {
  success: boolean;
  filesChanged: string[];
}

// Example: Coding harness with task-completion pattern
class CodingHarness extends BaseHarness<CodingState, Ticket, CodeResult> {
  private coder = new Agent<CodingState, Ticket, CodeResult>({
    name: 'Coder',
    async run({ input, stepNumber }) {
      console.log(`Step ${stepNumber}: Implementing ${input.title}`);
      // Simulate coding work
      return { success: true, filesChanged: [`${input.id}.ts`] };
    }
  });

  private ticketQueue: Ticket[] = [
    { id: 'TICK-1', title: 'Add login' },
    { id: 'TICK-2', title: 'Fix bug' },
    { id: 'TICK-3', title: 'Write tests' },
  ];

  async *execute() {
    while (this.ticketQueue.length > 0) {
      const input = this.ticketQueue.shift()!;
      
      const context = this.loadContext();
      const output = await this.coder.run({
        input,
        context: context.state,
        stepNumber: this.currentStep + 1,
        stepHistory: this.getStepHistory(),
        constraints: {}
      });
      
      // Update state
      this.state.updateState(s => ({
        ticketsRemaining: s.ticketsRemaining - 1,
        completed: [...s.completed, input.id]
      }));
      
      yield { input, output };
    }
  }

  isComplete(): boolean {
    return this.state.getState().ticketsRemaining <= 0;
  }
}

// Usage:
// const harness = new CodingHarness({ 
//   initialState: { ticketsRemaining: 3, completed: [] } 
// });
// await harness.run(); // Runs until all tickets done
// console.log(harness.getState()); // { ticketsRemaining: 0, completed: ['TICK-1', 'TICK-2', 'TICK-3'] }
```

**Implementation:**
- [ ] `src/examples/harness/trading-harness.ts` - Time-based polling
- [ ] `src/examples/harness/coding-harness.ts` - Task-completion with isComplete()

---

## Acceptance Criteria

### AC1: BaseHarness AsyncGenerator Pattern Works
- [ ] **Given** a developer extends BaseHarness and implements execute()
- [ ] **When** they call harness.run()
- [ ] **Then** framework iterates the generator, incrementing step and recording history

### AC2: Multi-Agent Orchestration Works
- [ ] **Given** a harness that calls multiple agents in execute()
- [ ] **When** the generator yields { input, output }
- [ ] **Then** each agent receives correct step context

### AC3: State Persists Across Steps
- [ ] **Given** a harness that updates state in execute()
- [ ] **When** multiple yields occur
- [ ] **Then** state changes persist and are visible in subsequent iterations

### AC4: Bounded Context Works
- [ ] **Given** a harness with 100 steps of history
- [ ] **When** loadContext() is called
- [ ] **Then** only recent N steps returned (not full history)

### AC5: Custom isComplete Works
- [ ] **Given** a harness that overrides isComplete()
- [ ] **When** completion condition met
- [ ] **Then** run() stops iterating the generator

### AC6: All Tests Pass
- [ ] **Given** TDD test suite
- [ ] **When** `bun test` runs
- [ ] **Then** all harness tests pass

### AC7: Examples Run
- [ ] **Given** reference example files
- [ ] **When** executed with `bun run`
- [ ] **Then** they execute without errors

---

## Additional Context

### Dependencies

- None external (uses existing SDK infrastructure)
- Optionally wraps `TaskList` from `src/workflow/task-list.ts` (future enhancement)

### Testing Strategy

1. **Unit tests first** - Test each class in isolation
2. **Integration test** - Test harness with real agents
3. **Example validation** - Ensure examples compile and run

### File Creation Order

1. `src/harness/types.ts` - Types first
2. `src/harness/state.ts` - State management
3. `src/harness/agent.ts` - Agent wrapper
4. `src/harness/base-harness.ts` - Abstract base with run()
5. `src/harness/index.ts` - Exports
6. `src/index.ts` - Update SDK exports
7. `src/examples/harness/*.ts` - Examples
8. `tests/unit/harness.test.ts` - Tests (write alongside)

### Key Implementation Notes

1. **run() owns the loop** - User never writes while loops
2. **execute() is a generator** - Yields `{ input, output }` pairs
3. **Step recording is automatic** - Framework calls record() after each yield
4. **currentStep access in execute()** - Use `this.currentStep + 1` since not incremented until after yield
5. **loadContext() for agents** - Call before running agents to get bounded context
6. **State updates in execute()** - Call `this.state.updateState()` as needed
