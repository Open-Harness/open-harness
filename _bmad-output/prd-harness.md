# Product Requirements Document - Harness SDK

**Project:** Open Harness  
**Track:** Harness SDK (Product)  
**Author:** Abdullah  
**Date:** December 24, 2025  
**Version:** 2.0  
**Source:** Vision Document v2.1

> **v2.0 Changes:** Clarified Harness as a base class users extend, not a configured object. Users own their `step()` implementation and agent orchestration.

---

## Executive Summary

Open Harness is building **step-aware autonomous agents** that work in out-of-loop mode for extended time periods.

This PRD defines the **Harness SDK** - the core primitives (Harness, Agent, Step, State) that give agents time dimensionality, allowing them to know where they are in time, what happened before, and plan for what comes next.

**Scope:** External API layer, Harness primitives, reference examples  
**Not in Scope:** Repo structure, CI/CD, publishing (see PRD-Infrastructure)

---

## Problem Statement

### Out-Of-Loop Agents Exist, But...

Autonomous AI agents already exist (Cursor background agents, Canvas, Gems). They work. But they have limitations:

1. **Black Box Opacity** - No transparency into what agent is doing
2. **Domain-Specific** - Locked to one use case (coding, documents)
3. **No Time Awareness** - Agent doesn't know it's in a temporal loop
4. **No Persistent State** - State lost on restart
5. **Hard to Customize** - Locked patterns, can't adapt

### What If You Had...

A **general-purpose** framework for building out-of-loop agents that's:
- **Time-aware:** Agent knows it's at step 7, planning for steps 8-15
- **Transparent:** See every step in a readable log
- **Domain-agnostic:** Build for trading, coding, research—anything
- **Stateful:** Persistent semantic memory across steps
- **Composable:** Simple primitives you mix and match

**That's Open Harness.**

---

## Success Criteria

### User Success

- **Simple Harness in 20 Lines**: Create a working custom harness class in ~20 lines
- **Any Domain**: Same base class works for trading, coding, monitoring
- **Full Control**: User owns their `step()` - framework never surprises them
- **Transparent Execution**: See every step, every result, every state change

### Technical Success

- **BaseHarness Works**: Users can extend and implement `step()`
- **Agent.run() Works**: Step context passed correctly
- **Layered Architecture**: External API wraps internal without breaking existing code
- **Examples Run**: Trading, Coding, Monitoring harness examples all execute

### Measurable Outcomes

| Metric | Target | Validation |
|--------|--------|------------|
| Lines to working harness | < 25 lines | Code sample |
| Step execution works | Pass | Integration test |
| State persists across steps | Pass | Integration test |
| Multi-agent orchestration works | Pass | Integration test |
| Examples run out of box | 3/3 pass | Manual test |

---

## Core Concept: The Harness Pattern

### What Is a Harness?

A **harness** is a **base class** that users **extend** to define their own step-aware execution system. It provides time dimensionality infrastructure (step counting, state management, history tracking) while **users own the orchestration logic**.

It adds **time dimensionality** to agents. Instead of "prompting repeatedly," you give agents awareness that they're iterating through **steps**—knowing what came before, planning what comes next.

### Key Architectural Principle

> **Users own orchestration. The framework provides infrastructure.**

The framework provides:
- Step counting and history tracking
- Persistent state management
- Context loading (bounded, not full history)
- Completion detection

Users provide (in their extended class):
- The `step()` implementation
- Agent instantiation and wiring
- Orchestration logic (sequential, parallel, conditional)
- Domain-specific state shape

### The Four Primitives

| Primitive | Purpose | User Relationship |
|-----------|---------|-------------------|
| **BaseHarness** | Step-aware execution infrastructure | Users **extend** this class |
| **Agent** | Runner (takes actions, returns results) | Users **instantiate** and wire in their step() |
| **Step** | Single execution point in time | Framework tracks, users read |
| **State** | Persistent semantic memory | Framework manages, users define shape |

---

## Architecture: Two Layers

### Layered Design

```
┌─────────────────────────────────────────────────────────┐
│ USER'S HARNESS (User-Defined)                           │
├─────────────────────────────────────────────────────────┤
│  - class TradingHarness extends BaseHarness             │
│  - User's step() implementation                         │
│  - User's agent instantiation & wiring                  │
│  - User's orchestration logic                           │
│  - User owns: WHAT runs and HOW                         │
└─────────────────────────────────────────────────────────┘
                          ↓ extends
┌─────────────────────────────────────────────────────────┐
│ HARNESS SDK (Framework - Base Classes)                  │
├─────────────────────────────────────────────────────────┤
│  - BaseHarness abstract class                           │
│  - Agent class (step-aware runner)                      │
│  - PersistentState class                                │
│  - Step, Constraints types                              │
│  - Framework owns: WHEN tracked, STATE managed          │
└─────────────────────────────────────────────────────────┘
                          ↓ wraps
┌─────────────────────────────────────────────────────────┐
│ INTERNAL API (EXISTING - Infrastructure)                │
├─────────────────────────────────────────────────────────┤
│  - BaseAgent.run() method                               │
│  - TaskList class                                       │
│  - StreamCallbacks                                      │
│  - DI container                                         │
│  - Complex, working, unchanged                          │
└─────────────────────────────────────────────────────────┘
```

### Key Principles

**1. Users extend, not configure.**
- Users create `class MyHarness extends BaseHarness`
- NOT `createHarness({ agent: myAgent })`

**2. Users own orchestration.**
- Users implement their own `step()` method
- Users decide: sequential, parallel, conditional agent execution
- Framework does NOT prescribe how agents run

**3. Framework provides infrastructure.**
- Step counting (`this.currentStep`)
- State management (`this.state`)
- History tracking (`this.stepHistory`)
- Context loading (`this.loadContext()`)

**4. Internal code stays unchanged.**
- `BaseAgent.run()` still works as-is
- `TaskList`, `StreamCallbacks` unchanged
- Harness SDK wraps, doesn't modify

---

## MVP Scope

### Must Have

#### 1. Harness Primitives (`packages/sdk/src/harness/`)

- [ ] `BaseHarness` abstract class (users extend this)
- [ ] `Agent` class with step-aware `run()` 
- [ ] `Step` interface (stepNumber, timestamp, input, output, stateDelta)
- [ ] `PersistentState` class (goal, progress, knowledge, loadContext)
- [ ] Export from SDK index

#### 2. TypeScript Types

```typescript
interface Step<TInput, TOutput> {
  stepNumber: number;
  timestamp: number;
  input: TInput;
  output: TOutput;
  stateDelta: StateDelta;
}

/**
 * BaseHarness - Abstract base class users extend.
 * Provides infrastructure; users implement step().
 */
abstract class BaseHarness<TState, TInput, TOutput> {
  // Framework provides these
  protected currentStep: number;
  protected state: PersistentState<TState>;
  protected stepHistory: Step<TInput, TOutput>[];
  
  // Framework methods
  protected loadContext(): LoadedContext<TState>;
  protected recordStep(input: TInput, output: TOutput): void;
  
  // User MUST implement
  abstract step(input: TInput): Promise<TOutput>;
  
  // User MAY override
  isComplete(): boolean;
  
  // Public getters
  getStepHistory(): Step<TInput, TOutput>[];
  getCurrentStep(): number;
  getState(): TState;
}

/**
 * Agent - Step-aware runner. Users instantiate in their harness.
 */
class Agent<TState, TInput, TOutput> {
  async run(params: {
    input: TInput;
    context: TState;
    stepNumber: number;
    stepHistory: Step<TInput, TOutput>[];
    constraints: Constraints;
  }): Promise<TOutput>;
  
  isComplete(state: TState): boolean;
}
```

#### 3. Reference Examples

Three examples demonstrating different cadence patterns. **Each shows a user-defined harness class.**

**Trading Harness (Time-Based, Multi-Agent)**
```typescript
class TradingHarness extends BaseHarness<TradingState, MarketData, TradeResult> {
  private analyzer = new AnalyzerAgent();
  private trader = new TraderAgent();
  private riskManager = new RiskAgent();
  
  async step(marketData: MarketData): Promise<TradeResult> {
    const context = this.loadContext();
    
    // User controls orchestration: sequential analysis, then parallel execution
    const analysis = await this.analyzer.run({
      input: marketData,
      context: context.state,
      stepNumber: this.currentStep,
      stepHistory: this.stepHistory,
      constraints: { maxDrawdown: 0.1 }
    });
    
    // Parallel agent execution - USER decides this
    const [trade, risk] = await Promise.all([
      this.trader.run({ input: analysis, context: context.state, ... }),
      this.riskManager.run({ input: analysis, context: context.state, ... })
    ]);
    
    const result = this.reconcile(trade, risk);
    this.recordStep(marketData, result);
    return result;
  }
}

// Usage
const harness = new TradingHarness({ initialState: { balance: 10000 } });
setInterval(() => harness.step(getMarketData()), 5000);
```

**Coding Harness (Task-Completion, Single Agent)**
```typescript
class CodingHarness extends BaseHarness<CodingState, Ticket, CodingResult> {
  private coder = new CodingAgent();
  
  async step(ticket: Ticket): Promise<CodingResult> {
    const context = this.loadContext();
    
    const result = await this.coder.run({
      input: ticket,
      context: context.state,
      stepNumber: this.currentStep,
      stepHistory: this.stepHistory,
      constraints: {}
    });
    
    this.recordStep(ticket, result);
    return result;
  }
  
  isComplete(): boolean {
    return this.state.getState().ticketsRemaining === 0;
  }
}

// Usage
const harness = new CodingHarness({ initialState: { ticketsRemaining: 10 } });
while (!harness.isComplete()) {
  const ticket = await getNextTicket();
  await harness.step(ticket);
}
```

**Monitoring Harness (Event-Based, Conditional Agents)**
```typescript
class MonitoringHarness extends BaseHarness<MonitorState, Alert, Response> {
  private logger = new LoggerAgent();
  private escalator = new EscalatorAgent();
  
  async step(alert: Alert): Promise<Response> {
    const context = this.loadContext();
    const recentAlerts = this.stepHistory.slice(-5);
    
    // User controls: conditional agent selection
    if (recentAlerts.length > 3) {
      const result = await this.escalator.run({ input: alert, ... });
      this.recordStep(alert, result);
      return result;
    }
    
    const result = await this.logger.run({ input: alert, ... });
    this.recordStep(alert, result);
    return result;
  }
}

// Usage
const harness = new MonitoringHarness({ initialState: {} });
alertSystem.on('alert', (alert) => harness.step(alert));
```

### Should Have

- [ ] CLI support for running harnesses (`harness run config.yaml`)
- [ ] YAML configuration for harness definitions
- [ ] Step history persistence (file-based)

### Nice to Have (Post-MVP)

- [ ] Step replay/debugging tools
- [ ] Harness visualization
- [ ] State checkpointing and recovery

---

## User Journeys

### Journey 1: Developer Creates Trading Harness (Multi-Agent)

Dev wants a trading system with analyzer, trader, and risk manager agents.

```typescript
import { BaseHarness, Agent } from '@openharness/sdk';

// 1. Define agents
const analyzer = new Agent<TradingState, MarketData, Analysis>({
  async run({ input, stepNumber }) {
    console.log(`Step ${stepNumber}: Analyzing RSI=${input.indicators.rsi}`);
    return { signal: input.indicators.rsi < 30 ? 'BUY' : input.indicators.rsi > 70 ? 'SELL' : 'HOLD' };
  }
});

const trader = new Agent<TradingState, Analysis, Trade>({
  async run({ input }) {
    if (input.signal === 'BUY') return { action: 'BUY', amount: 0.1 };
    if (input.signal === 'SELL') return { action: 'SELL', amount: 0.1 };
    return { action: 'HOLD' };
  }
});

// 2. Create harness class - USER owns orchestration
class TradingHarness extends BaseHarness<TradingState, MarketData, Trade> {
  async step(marketData: MarketData): Promise<Trade> {
    const context = this.loadContext();
    
    // Sequential: analyze first
    const analysis = await analyzer.run({
      input: marketData,
      context: context.state,
      stepNumber: this.currentStep,
      stepHistory: this.stepHistory,
      constraints: {}
    });
    
    // Then trade based on analysis
    const trade = await trader.run({
      input: analysis,
      context: context.state,
      stepNumber: this.currentStep,
      stepHistory: [],
      constraints: { maxDrawdown: 0.1 }
    });
    
    this.recordStep(marketData, trade);
    return trade;
  }
}

// 3. Instantiate and run
const harness = new TradingHarness({ initialState: { balance: 10000 } });
setInterval(async () => {
  const market = await getMarketData();
  await harness.step(market);
}, 5000);
```

**Result:** User controls how agents are orchestrated. Framework tracks steps.

### Journey 2: Developer Creates Simple Coding Harness (Single Agent)

Dev wants a simple harness with one agent.

```typescript
import { BaseHarness, Agent } from '@openharness/sdk';

const coder = new Agent<CodingState, Ticket, CodingResult>({
  async run({ input, stepNumber }) {
    console.log(`Step ${stepNumber}: Working on ${input.title}`);
    return { success: true, filesChanged: ['index.ts'] };
  },
  isComplete: (state) => state.ticketsRemaining === 0
});

class CodingHarness extends BaseHarness<CodingState, Ticket, CodingResult> {
  async step(ticket: Ticket): Promise<CodingResult> {
    const context = this.loadContext();
    
    const result = await coder.run({
      input: ticket,
      context: context.state,
      stepNumber: this.currentStep,
      stepHistory: this.stepHistory,
      constraints: {}
    });
    
    // Update state
    this.state.updateState(s => ({
      ...s,
      ticketsRemaining: s.ticketsRemaining - 1
    }));
    
    this.recordStep(ticket, result);
    return result;
  }
  
  isComplete(): boolean {
    return this.state.getState().ticketsRemaining === 0;
  }
}

const harness = new CodingHarness({ initialState: { ticketsRemaining: 10 } });
while (!harness.isComplete()) {
  const ticket = await getNextTicket();
  await harness.step(ticket);
}
```

**Result:** Even simple single-agent cases follow the same pattern.

### Journey 3: Developer Creates Conditional Monitoring Harness

Dev wants a harness that picks agents based on conditions.

```typescript
import { BaseHarness, Agent } from '@openharness/sdk';

const logger = new Agent<MonitorState, Alert, Response>({
  async run({ input }) {
    return { action: 'LOG', reason: 'Normal alert' };
  }
});

const escalator = new Agent<MonitorState, Alert, Response>({
  async run({ input, stepHistory }) {
    return { action: 'ESCALATE', reason: `${stepHistory.length} alerts in window` };
  }
});

class MonitoringHarness extends BaseHarness<MonitorState, Alert, Response> {
  async step(alert: Alert): Promise<Response> {
    const context = this.loadContext();
    const recentAlerts = this.stepHistory.slice(-5);
    
    // USER decides which agent runs
    const agent = recentAlerts.length > 3 ? escalator : logger;
    
    const result = await agent.run({
      input: alert,
      context: context.state,
      stepNumber: this.currentStep,
      stepHistory: this.stepHistory,
      constraints: {}
    });
    
    this.recordStep(alert, result);
    return result;
  }
}

const harness = new MonitoringHarness({ initialState: {} });
alertSystem.on('alert', (alert) => harness.step(alert));
```

**Result:** User controls conditional agent selection. Framework stays out of the way.

---

## Technical Requirements

### API Design Principles

1. **Extend, Don't Configure** - Users extend `BaseHarness`, not call `createHarness()`
2. **Users Own Orchestration** - Framework never decides how/when agents run
3. **Mirror Internal Where Sensible** - `agent.run()` not `agent.act()`
4. **Simple Generics** - `BaseHarness<TState, TInput, TOutput>`
5. **Flexible Cadence** - You control when your `step()` is called
6. **Django/Rails Philosophy** - Few opinionated primitives, not infinite flexibility

### File Structure

```
packages/sdk/src/harness/
├── index.ts          # Exports
├── base-harness.ts   # BaseHarness abstract class
├── agent.ts          # Agent class
├── state.ts          # PersistentState
└── types.ts          # Step, Constraints, etc.
```

### What BaseHarness Provides vs. What Users Provide

| BaseHarness Provides | Users Provide |
|---------------------|---------------|
| `this.currentStep` (auto-incremented) | `step()` implementation |
| `this.state` (PersistentState instance) | State shape (TState generic) |
| `this.stepHistory` (auto-tracked) | Agent instantiation |
| `this.loadContext()` (bounded context) | Agent orchestration logic |
| `this.recordStep()` (history recording) | Completion logic (optional) |
| `getStepHistory()`, `getCurrentStep()` | Domain-specific methods |

### Integration with Existing Code

| Harness SDK (New) | Internal API (Existing) | Relationship |
|-------------------|------------------------|--------------|
| `BaseHarness` | N/A | New abstract class |
| `Agent.run()` | `BaseAgent.run()` | Wraps with step context |
| `PersistentState` | `TaskList` | Wraps with semantic state |
| `StreamCallbacks` | `StreamCallbacks` | Passed through unchanged |

---

## Out of Scope

❌ **Not in this PRD:**
- Repo restructuring → See PRD-Infrastructure
- CI/CD, publishing → See PRD-Infrastructure
- Cloud execution (E2B) → Future PRD
- Multi-provider support → Future PRD

---

## Dependencies

- PRD-Infrastructure (nice to have clean repo, but not blocking)

## Blocks

- E2B cloud execution (needs Harness primitives first)
- Harness marketplace (needs working harnesses)

---

## Risks

### Technical Risks

**Risk:** Wrapping internal API creates leaky abstraction  
**Mitigation:** Clear separation, don't expose internal types in external API

**Risk:** Step history grows unbounded  
**Mitigation:** `loadContext()` returns relevant subset, not full history

### Scope Risks

**Risk:** Primitives too simple for complex use cases  
**Mitigation:** Start simple, extend based on real usage patterns

---

## Appendix: v2.0 Architecture Clarification

### What Changed from v1.0

| Aspect | v1.0 (Wrong) | v2.0 (Correct) |
|--------|--------------|----------------|
| **Harness** | Configured object | Base class to extend |
| **step()** | Framework-provided method | User-implemented method |
| **Agent count** | Single agent per harness | N agents, user's choice |
| **Orchestration** | Framework decides | User decides |
| **createHarness()** | Main entry point | Removed - use `extends` |

### Why This Matters

**v1.0 Pattern (Wrong):**
```typescript
// Framework controls everything
const harness = createHarness({
  agent: trader,  // Only ONE agent
  initialState: {...}
});
harness.step(input);  // Framework calls trader.run() internally
```

Problems:
- Can't have multiple agents
- Can't control orchestration (sequential vs parallel)
- Framework is a black box
- Hard to customize

**v2.0 Pattern (Correct):**
```typescript
// User controls everything
class MyHarness extends BaseHarness<State, Input, Output> {
  private agent1 = new Agent1();
  private agent2 = new Agent2();
  
  async step(input: Input): Promise<Output> {
    // USER decides: sequential, parallel, conditional, whatever
    const r1 = await this.agent1.run({...});
    const r2 = await this.agent2.run({...});
    this.recordStep(input, { r1, r2 });
    return { r1, r2 };
  }
}
```

Benefits:
- Unlimited agents
- Full orchestration control
- Transparent - user wrote the code
- Easy to customize

### Framework vs. User Responsibilities

**Framework (BaseHarness) provides:**
- `this.currentStep` - auto-incremented on each step
- `this.state` - PersistentState instance
- `this.stepHistory` - all recorded steps
- `this.loadContext()` - bounded context for LLM
- `this.recordStep(input, output)` - history recording
- `isComplete()` - default returns false, user can override

**User provides:**
- `step(input)` - **MUST implement** - the core logic
- Agent instantiation - create agents as class properties
- Orchestration - decide how agents run
- State shape - via TState generic
- Completion logic - override `isComplete()` if needed
