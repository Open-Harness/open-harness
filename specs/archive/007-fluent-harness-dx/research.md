# Research: Fluent Harness DX

**Date**: 2025-12-27
**Source**: Extracted from `specs/backlog/006-fluent-harness-dx.md` DX Exploration section

## Overview

All 5 DX questions were explored and resolved during the specification phase. This document captures those decisions for implementation reference.

---

## Decision 1: Execute Pattern

**Question**: Is async generator the right abstraction?

**Decision**: Dual API (`run:` + `execute:`)

**Rationale**: Generators add value for pause points and streaming, but most harnesses just run through phases sequentially. Offer both paths.

**Alternatives Considered**:
- Generator-only: Rejected - adds cognitive overhead for simple cases
- Plain async only: Rejected - loses step recording capability
- Declarative phases: Rejected - too inflexible for complex control flow

**Implementation**:
```typescript
// run: for simple async function
run: async ({ agents, state }) => { ... }

// execute: for generator with yields (step recording)
async *execute({ agents, state }) { yield { step, input, output }; }
```

---

## Decision 2: Event Pattern

**Question**: Is `emit()` the best pattern for events?

**Decision**: Hybrid (`phase()`/`task()` helpers + `emit()` escape hatch)

**Rationale**: Eliminates the "forgot to emit complete" bug. Single call site for common patterns. Escape hatch preserves flexibility.

**Alternatives Considered**:
- Manual emit only: Rejected - too error-prone (forgetting complete events)
- Decorator approach: Rejected - too magical, hard to debug
- Return-based events: Rejected - awkward API ergonomics

**Implementation**:
```typescript
// Helpers auto-emit start/complete
await phase('Parse', async () => { ... });
await task('T001', async () => { ... });

// Escape hatch for custom events
emit('summary', { total, passed, failed });
```

---

## Decision 3: State Management

**Question**: Can we simplify state management?

**Decision**: Mutable state object

**Rationale**: Immutable updates add complexity without clear benefit for harness use cases. Users who need immutability can use immer themselves.

**Alternatives Considered**:
- `updateState(s => ({...s, ...}))`: Rejected - verbose for simple updates
- Immer-style produce: Rejected - adds dependency, complexity
- Event-sourcing: Rejected - overkill for workflow state

**Implementation**:
```typescript
// Direct mutation
state.tasks = parsed.tasks;
state.results.push(result);
```

---

## Decision 4: API Complexity Levels

**Question**: What's the minimal viable harness?

**Decision**: Three progressive levels

**Rationale**: Progressive disclosure - users start simple and add complexity only when needed.

**Levels**:

| Level | API | Use Case |
|-------|-----|----------|
| 1 | `wrapAgent(CodingAgent).run(input)` | Single agent, one-liner |
| 2 | `defineHarness({ agents, run })` | Simple workflow |
| 3 | `defineHarness({ agents, state, run/execute })` | Full workflow |

**Alternatives Considered**:
- Single API: Rejected - forces boilerplate on simple cases
- Two levels only: Rejected - missing the Level 1 one-liner for single agents

---

## Decision 5: Control Flow

**Question**: How should complex control flow work?

**Decision**: Context-Integrated Helpers with Auto-Emit Events

**Rationale**: Consistency with `phase()` and `task()` helpers. If users call a helper, they get automatic event visibility without wiring up callbacks. This matches the core design principle of separating business logic from presentation.

**Alternatives Considered**:
- BYOL (Bring Your Own Library): Rejected - inconsistent with other helpers, requires manual event wiring
- Typed wrappers only: Rejected - still requires user to wire onRetry callbacks for visibility
- Framework-style orchestration: Rejected - too opinionated

**Implementation**:
```typescript
// Context helpers auto-emit events
run: async ({ agents, state, retry, parallel }) => {
  // Auto-emits: retry:start, retry:attempt, retry:success/failure
  const result = await retry('coder-execute', () => agents.coder.execute(task), { retries: 3 });

  // Auto-emits: parallel:start, parallel:item:complete, parallel:complete
  const reviews = await parallel('reviews',
    state.tasks.map(t => () => agents.reviewer.review(t)),
    { concurrency: 3 }
  );
};

// External handler gets visibility automatically
harness
  .on('retry', (e) => console.log(`↻ [${e.name}] attempt ${e.attempt}/${e.maxAttempts}`))
  .on('parallel', (e) => console.log(`∥ [${e.name}] ${e.completed}/${e.total}`));
```

---

## Summary Table

| Question | Decision | Key Benefit |
|----------|----------|-------------|
| Execute pattern | Dual API | Simple cases stay simple |
| Event pattern | Hybrid helpers + emit | Eliminates forgetting complete |
| State management | Mutable | Simplest mental model |
| API levels | 3 progressive | Progressive disclosure |
| Control flow | Context-integrated helpers | Consistent auto-emit pattern |
