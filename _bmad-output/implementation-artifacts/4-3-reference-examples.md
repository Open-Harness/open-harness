# Story 4.3: Create Reference Examples

**Status:** review

## Story

As a **developer learning the SDK**,
I want **working example harnesses**,
so that **I can understand the pattern and have starting points**.

## Acceptance Criteria

1. **AC1:** Given the TradingHarness example, When I review the code, Then it shows time-based polling with while(true) and sleep() And it demonstrates Agent usage with step context And it yields { input: marketData, output: trade }
2. **AC2:** Given the CodingHarness example, When I review the code, Then it shows task-completion with finite queue And it demonstrates custom isComplete() override And it shows state updates during execute()
3. **AC3:** Given either example, When I run it with bun, Then it executes without errors

## Tasks / Subtasks

- [ ] Task 1: Create TradingHarness example (AC: 1, 3)
  - [ ] 1.1: Create directory `packages/sdk/src/examples/harness/`
  - [ ] 1.2: Create `packages/sdk/src/examples/harness/trading-harness.ts`
  - [ ] 1.3: Define TradingState interface (balance, position)
  - [ ] 1.4: Define MarketData interface (price, rsi)
  - [ ] 1.5: Define Trade interface (action, amount)
  - [ ] 1.6: Implement TradingHarness class extending BaseHarness
  - [ ] 1.7: Create Trader Agent with RSI-based logic
  - [ ] 1.8: Implement execute() with max iterations (10) for demo (NOT infinite while(true))
  - [ ] 1.9: Add sleep() helper method (use short 100ms delay for demo)
  - [ ] 1.10: Add mock fetchMarketData() method
  - [ ] 1.11: Add executable main block at bottom (not just comments)
  - [ ] 1.12: Export the class for testing

- [ ] Task 2: Create CodingHarness example (AC: 2, 3)
  - [ ] 2.1: Create `packages/sdk/src/examples/harness/coding-harness.ts`
  - [ ] 2.2: Define CodingState interface (ticketsRemaining, completed)
  - [ ] 2.3: Define Ticket interface (id, title)
  - [ ] 2.4: Define CodeResult interface (success, filesChanged)
  - [ ] 2.5: Implement CodingHarness class extending BaseHarness
  - [ ] 2.6: Create Coder Agent
  - [ ] 2.7: Implement execute() with finite ticket queue
  - [ ] 2.8: Implement custom isComplete() based on ticketsRemaining
  - [ ] 2.9: Show state updates during execute()
  - [ ] 2.10: Add executable main block at bottom (not just comments)
  - [ ] 2.11: Export the class for testing

- [ ] Task 3: Verify examples run (AC: 3)
  - [ ] 3.1: Run TradingHarness with `bun run` (with timeout to prevent infinite loop)
  - [ ] 3.2: Run CodingHarness with `bun run`
  - [ ] 3.3: Verify no TypeScript errors
  - [ ] 3.4: Verify console output shows expected step execution

## Dev Notes

### Architecture Requirements
- **File locations:** 
  - `packages/sdk/src/examples/harness/trading-harness.ts`
  - `packages/sdk/src/examples/harness/coding-harness.ts`
- **Pattern:** Self-contained, runnable examples with comments

### TradingHarness Example
From tech-spec (`_bmad-output/tech-spec-harness-sdk.md` lines 549-616):

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

// Export for testing
export { TradingHarness, TradingState, MarketData, Trade };

// ============ EXECUTABLE MAIN ============
// Run with: bun packages/sdk/src/examples/harness/trading-harness.ts

async function main() {
  console.log('Starting Trading Harness Demo...\n');
  
  const harness = new TradingHarness({ 
    initialState: { balance: 10000, position: 0 } 
  });
  
  await harness.run();
  
  console.log('\n=== Trading Complete ===');
  console.log(`Final state:`, harness.getState());
  console.log(`Total steps: ${harness.getCurrentStep()}`);
}

// Run if executed directly
main().catch(console.error);
```

**IMPORTANT:** The example uses `maxIterations = 10` instead of `while(true)` so it completes when run. Change the execute() loop:

```typescript
async *execute() {
  let iterations = 0;
  const maxIterations = 10; // Demo limit
  
  while (iterations < maxIterations) {
    iterations++;
    const input: MarketData = await this.fetchMarketData();
    // ... rest of logic
    yield { input, output };
    await this.sleep(100); // Short delay for demo
  }
}
```

### CodingHarness Example
From tech-spec (`_bmad-output/tech-spec-harness-sdk.md` lines 619-689):

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

// Export for testing
export { CodingHarness, CodingState, Ticket, CodeResult };

// ============ EXECUTABLE MAIN ============
// Run with: bun packages/sdk/src/examples/harness/coding-harness.ts

async function main() {
  console.log('Starting Coding Harness Demo...\n');
  
  const harness = new CodingHarness({ 
    initialState: { ticketsRemaining: 3, completed: [] } 
  });
  
  await harness.run();
  
  console.log('\n=== Coding Complete ===');
  console.log(`Final state:`, harness.getState());
  console.log(`Completed tickets:`, harness.getState().completed);
}

// Run if executed directly
main().catch(console.error);
```

### Key Implementation Details

1. **Self-contained:** Each example should be runnable standalone
2. **Executable main:** Include actual `main()` function at bottom, not just comments
3. **Demo-safe:** TradingHarness uses max iterations (10), NOT infinite while(true)
4. **Console output:** Log step execution for visibility
5. **Exports:** Export classes and interfaces for testing/importing
6. **Run commands:**
   - `bun packages/sdk/src/examples/harness/trading-harness.ts`
   - `bun packages/sdk/src/examples/harness/coding-harness.ts`

### Dependencies
- **Requires:** Stories 4.1, 4.2 must be complete (harness exports available)
- **Imports from:** `../../harness/index.js`

### References

- [Source: _bmad-output/tech-spec-harness-sdk.md#Task 7: Create Reference Examples]
- [Source: _bmad-output/epics-harness.md#Story 4.3: Create Reference Examples]
- [Source: _bmad-output/prd-harness.md#Reference Examples]

## Dev Agent Record

### Agent Model Used
Claude Sonnet 4.5 (via Cursor)

### Debug Log References
- Both examples run successfully with `bun`
- TradingHarness demonstrates time-based polling with max iterations (10)
- CodingHarness demonstrates task-completion with custom isComplete()
- Console output shows expected step execution

### Completion Notes List
- Created TradingHarness example with time-based polling pattern
- Shows Agent usage with step context (stepNumber, stepHistory)
- Uses max iterations (10) instead of infinite loop for demo safety
- Demonstrates state updates during execute()
- Created CodingHarness example with task-completion pattern
- Shows custom isComplete() override based on ticketsRemaining
- Demonstrates finite queue processing
- Both examples have executable main blocks
- Both examples export classes and interfaces for testing
- Verified both examples run without errors

### File List
- `packages/sdk/src/examples/harness/trading-harness.ts` (new - TradingHarness example)
- `packages/sdk/src/examples/harness/coding-harness.ts` (new - CodingHarness example)

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2024-12-24 | Story created from tech-spec and epics | Dev Agent (Amelia) |
| 2024-12-24 | Story implemented - TradingHarness and CodingHarness examples created, both run successfully | Dev Agent (Amelia) |
