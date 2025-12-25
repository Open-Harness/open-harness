---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments: ['_bmad-output/prd-harness.md', '_bmad-output/tech-spec-harness-sdk.md']
track: 'Track B - Harness SDK'
version: '2.0'
---

# Harness SDK - Epic Breakdown v2.0

## Overview

This document provides the complete epic and story breakdown for the **Harness SDK (Track B)**, aligned with PRD v2.0 and the Tech Spec's unified AsyncGenerator pattern.

**Key Architecture (v2.0):**
- `BaseHarness` is an **abstract class users extend**
- Users implement `execute()` as an **AsyncGenerator** yielding `{ input, output }` pairs
- Framework owns the loop via `run()` - iterates generator, records steps automatically
- **ONE pattern** works for all cadence types (time-based, task-completion)
- Users control orchestration inside their `execute()` implementation

**What Changed from v1.0:**
- Removed `createHarness()` factory - users extend class instead
- Removed framework-controlled `step()` - users implement `execute()` generator
- Added unified AsyncGenerator pattern
- Framework auto-records steps - users just yield

---

## Requirements Inventory

### Functional Requirements

| ID | Requirement | Source |
|----|-------------|--------|
| FR1 | Create `BaseHarness` abstract class with `run()` method | PRD v2.0 |
| FR2 | `BaseHarness.run()` iterates user's `execute()` generator | Tech Spec |
| FR3 | Users implement `execute()` as AsyncGenerator yielding `{ input, output }` | Tech Spec |
| FR4 | Framework auto-increments `currentStep` after each yield | Tech Spec |
| FR5 | Framework auto-records steps to history after each yield | Tech Spec |
| FR6 | Create `Agent` class with step-aware `run()` method | PRD v2.0 |
| FR7 | Create `PersistentState` class with bounded `loadContext()` | PRD v2.0 |
| FR8 | Define `Step` interface with stepNumber, timestamp, input, output, stateDelta | PRD v2.0 |
| FR9 | `isComplete()` stops the run loop when returns true | Tech Spec |
| FR10 | Export all harness primitives from SDK index | PRD v2.0 |
| FR11 | Create Trading Harness example (time-based polling) | Tech Spec |
| FR12 | Create Coding Harness example (task-completion with isComplete) | Tech Spec |
| FR13 | Support TypeScript generics: `BaseHarness<TState, TInput, TOutput>` | PRD v2.0 |

### Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR1 | Lines to working harness | < 25 lines |
| NFR2 | All unit tests pass | 100% |
| NFR3 | State persists across yields | Verified by test |
| NFR4 | Bounded context (not full history) | loadContext returns max N steps |
| NFR5 | Examples run out of box | 2/2 pass |

---

## Epic List

### Epic 1: Core Types and State
Create the foundational types and `PersistentState` class that all other components depend on.

**Stories:** 1.1, 1.2
**FRs covered:** FR7, FR8

### Epic 2: Agent Class
Create the `Agent` wrapper class that provides step-aware execution.

**Stories:** 2.1
**FRs covered:** FR6

### Epic 3: BaseHarness with AsyncGenerator Pattern
Create the `BaseHarness` abstract class with the unified `run()` + `execute()` pattern.

**Stories:** 3.1, 3.2
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR9, FR13

### Epic 4: SDK Integration
Export harness primitives from SDK and create reference examples.

**Stories:** 4.1, 4.2, 4.3
**FRs covered:** FR10, FR11, FR12

---

## Epic 1: Core Types and State

Create the foundational types and `PersistentState` class.

### Story 1.1: Create Harness Types

**As a** developer using the SDK,
**I want** well-defined TypeScript interfaces for harness concepts,
**So that** I have type safety and clear contracts.

**Acceptance Criteria:**

```gherkin
Given a developer imports types from harness/types
When they use Step<TInput, TOutput>
Then it has stepNumber, timestamp, input, output, stateDelta fields

Given a developer uses StateDelta
When they track modifications
Then it has modified[] array and optional summary

Given a developer uses LoadedContext<TState>
When they access bounded context
Then it has state, recentSteps, relevantKnowledge fields

Given a developer uses HarnessConfig<TState>
When they configure a harness
Then it has initialState and optional maxContextSteps
```

**Technical Notes:**
- File: `packages/sdk/src/harness/types.ts`
- Add `StepYield<TInput, TOutput>` type for generator yields: `{ input: TInput; output: TOutput }`

**Test file location:** `packages/sdk/tests/unit/harness.test.ts`

---

### Story 1.2: Create PersistentState Class

**As a** harness developer,
**I want** a `PersistentState` class that manages state and history,
**So that** my harness has persistent memory across steps.

**Acceptance Criteria:**

```gherkin
Given a new PersistentState with initialState { count: 0 }
When I call getState()
Then it returns { count: 0 }

Given a PersistentState instance
When I call updateState(s => ({ count: s.count + 1 }))
Then getState() returns { count: 1 }

Given a PersistentState with maxContextSteps: 5 and 10 recorded steps
When I call loadContext()
Then recentSteps has exactly 5 items (most recent)

Given a PersistentState with 3 recorded steps
When I call getRecentSteps(2)
Then it returns the last 2 steps in order

Given a PersistentState
When I call record(stepNumber, input, output, stateDelta)
Then getStepHistory() includes the new step
```

**Technical Notes:**
- File: `packages/sdk/src/harness/state.ts`
- Default `maxContextSteps`: 10
- `loadContext()` returns bounded subset, NOT full history

---

## Epic 2: Agent Class

Create the `Agent` wrapper class.

### Story 2.1: Create Agent Class

**As a** harness developer,
**I want** an `Agent` class that wraps my agent logic,
**So that** my agents receive step context when running.

**Acceptance Criteria:**

```gherkin
Given an Agent with a run function
When I call agent.run({ input, context, stepNumber, stepHistory, constraints })
Then my run function receives all those parameters

Given an Agent with name: 'MyAgent'
When I access agent.name
Then it returns 'MyAgent'

Given an Agent without a name
When I access agent.name
Then it defaults to 'Agent'

Given an Agent with isComplete function
When I call agent.isComplete(state)
Then it returns the result of my isComplete function

Given an Agent without isComplete
When I call agent.isComplete(state)
Then it returns false
```

**Technical Notes:**
- File: `packages/sdk/src/harness/agent.ts`
- Constructor takes `AgentConfig<TState, TInput, TOutput>`
- `run()` is async and returns `Promise<TOutput>`

---

## Epic 3: BaseHarness with AsyncGenerator Pattern

Create the core `BaseHarness` abstract class.

### Story 3.1: Create BaseHarness Abstract Class

**As a** developer building an autonomous agent,
**I want** a `BaseHarness` base class I can extend,
**So that** I get step tracking infrastructure while owning my execution logic.

**Acceptance Criteria:**

```gherkin
Given a class extending BaseHarness
When I implement execute() as an AsyncGenerator
Then I can yield { input, output } pairs

Given a harness instance
When I call run()
Then it iterates my execute() generator until complete

Given a harness with execute() yielding 3 items
When run() completes
Then getCurrentStep() returns 3
And getStepHistory() has 3 entries

Given a harness
When run() iterates
Then each yield auto-increments currentStep
And each yield auto-records to stepHistory

Given a harness with initial state { count: 42 }
When I call getState()
Then it returns { count: 42 }
```

**Technical Notes:**
- File: `packages/sdk/src/harness/base-harness.ts`
- `execute()` is abstract - users MUST implement
- `run()` does: `for await (const { input, output } of this.execute()) { ... }`
- Protected members: `currentStep`, `state`
- Public methods: `run()`, `getCurrentStep()`, `getStepHistory()`, `getState()`, `isComplete()`

---

### Story 3.2: Implement isComplete Early Exit

**As a** developer building a finite harness,
**I want** `run()` to stop when `isComplete()` returns true,
**So that** my harness can complete based on state conditions.

**Acceptance Criteria:**

```gherkin
Given a harness with isComplete() checking state.remaining <= 0
And initial state { remaining: 3 }
When execute() yields and updates remaining each time
Then run() stops after 3 yields
And isComplete() returns true

Given a harness with default isComplete()
When run() executes
Then it only stops when execute() generator completes

Given a harness with isComplete returning true before first yield
When run() starts
Then it still processes at least one yield before checking
```

**Technical Notes:**
- Check `isComplete()` AFTER each yield, not before
- Default `isComplete()` returns `false`
- Users override to add completion logic

---

## Epic 4: SDK Integration

Export primitives and create examples.

### Story 4.1: Create Harness Index Exports

**As a** developer using the SDK,
**I want** to import harness primitives from a single location,
**So that** I have a clean API surface.

**Acceptance Criteria:**

```gherkin
Given I import from 'harness/index'
When I check exports
Then BaseHarness, Agent, PersistentState are available

Given I import types from 'harness/index'
When I check type exports
Then Step, StateDelta, Constraints, LoadedContext, HarnessConfig are available
```

**Technical Notes:**
- File: `packages/sdk/src/harness/index.ts`
- Re-export from `./base-harness.js`, `./agent.js`, `./state.js`, `./types.js`

---

### Story 4.2: Update SDK Main Index

**As a** developer using the SDK,
**I want** harness primitives exported from the main SDK package,
**So that** I can import everything from one place.

**Acceptance Criteria:**

```gherkin
Given I import from '@openharness/sdk' (or package name)
When I check exports
Then BaseHarness, Agent, PersistentState are available
And harness types are available
```

**Technical Notes:**
- File: `packages/sdk/src/index.ts`
- Add: `export * from './harness/index.js'`

---

### Story 4.3: Create Reference Examples

**As a** developer learning the SDK,
**I want** working example harnesses,
**So that** I can understand the pattern and have starting points.

**Acceptance Criteria:**

```gherkin
Given the TradingHarness example
When I review the code
Then it shows time-based polling with while(true) and sleep()
And it demonstrates Agent usage with step context
And it yields { input: marketData, output: trade }

Given the CodingHarness example
When I review the code
Then it shows task-completion with finite queue
And it demonstrates custom isComplete() override
And it shows state updates during execute()

Given either example
When I run it with bun
Then it executes without errors
```

**Technical Notes:**
- Files: 
  - `packages/sdk/src/examples/harness/trading-harness.ts`
  - `packages/sdk/src/examples/harness/coding-harness.ts`
- Include comments explaining the pattern
- Make examples self-contained and runnable

---

## Implementation Order

### Recommended Sequence

```
Epic 1: Core Types and State
  └── Story 1.1: Create Harness Types
  └── Story 1.2: Create PersistentState Class

Epic 2: Agent Class
  └── Story 2.1: Create Agent Class

Epic 3: BaseHarness (depends on Epic 1, 2)
  └── Story 3.1: Create BaseHarness Abstract Class
  └── Story 3.2: Implement isComplete Early Exit

Epic 4: SDK Integration (depends on Epic 3)
  └── Story 4.1: Create Harness Index Exports
  └── Story 4.2: Update SDK Main Index
  └── Story 4.3: Create Reference Examples
```

### Parallelization

- Stories 1.1 and 1.2 can be done in parallel
- Story 2.1 can start after 1.1 (needs types)
- Story 3.1 needs 1.2 and 2.1 complete
- Story 3.2 can be done with 3.1
- Epic 4 stories can be parallelized after Epic 3

---

## FR Coverage Matrix

| FR | Story | Description |
|----|-------|-------------|
| FR1 | 3.1 | BaseHarness abstract class with run() |
| FR2 | 3.1 | run() iterates execute() generator |
| FR3 | 3.1 | Users implement execute() as AsyncGenerator |
| FR4 | 3.1 | Auto-increment currentStep |
| FR5 | 3.1 | Auto-record steps to history |
| FR6 | 2.1 | Agent class with step-aware run() |
| FR7 | 1.2 | PersistentState with loadContext() |
| FR8 | 1.1 | Step interface definition |
| FR9 | 3.2 | isComplete() stops run loop |
| FR10 | 4.1, 4.2 | Export from SDK index |
| FR11 | 4.3 | Trading Harness example |
| FR12 | 4.3 | Coding Harness example |
| FR13 | 3.1 | TypeScript generics support |

---

## Testing Strategy

### TDD Approach

Tests are defined in the Tech Spec. Write tests FIRST, then implement.

**Test file:** `packages/sdk/tests/unit/harness.test.ts`

### Test Categories

1. **Type Tests** - Verify interfaces compile correctly
2. **PersistentState Tests** - State management, history, bounded context
3. **Agent Tests** - Run function, isComplete, name
4. **BaseHarness Tests** - Generator iteration, step recording, isComplete exit
5. **Integration Tests** - Full harness with agents

---

## Summary

| Metric | Value |
|--------|-------|
| **Epics** | 4 |
| **Stories** | 8 |
| **Estimated Complexity** | Medium |
| **Key Pattern** | AsyncGenerator execute() + run() loop |
| **Breaking Change from v1** | Yes - new pattern, simpler DX |
