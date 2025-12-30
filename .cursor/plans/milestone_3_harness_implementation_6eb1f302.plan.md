---
name: Milestone 3 Harness Implementation
overview: Implement Harness factory, lifecycle events, phase/task helpers, and attachments per Milestone 3 requirements. Create fixture-based replay tests and live verification script.
todos: []
---

# Milestone 3: Harness Lifecycle + Phase/Task Helpers

## Overview

Implement the Harness protocol following the Hub pattern. Harness extends Hub and adds state management, lifecycle events, phase/task helpers, and attachment system.

## Implementation Tasks

### 1. Core Harness Implementation

**File**: `packages/kernel/src/engine/harness.ts`

Implement:

- `defineHarness()` factory function that returns `HarnessFactory`
- `HarnessInstance` class that extends `HubImpl` and implements `HarnessInstance<TState, TResult>`
- State initialization from `state(input)` function
- `attach(attachment)` method that calls attachment with hub and tracks cleanup
- `startSession()` method (delegates to Hub, sets session context flag)
- `run()` method that:
- Emits `harness:start` event
- Executes the `run` function with `ExecuteContext`
- Emits `harness:complete` event
- Returns `HarnessResult` with result, state, events, durationMs, status
- `phase(name, fn)` helper that:
- Emits `phase:start` event
- Calls `hub.scoped({ phase: { name } }, fn)`
- Emits `phase:complete` or `phase:failed` based on outcome
- `task(id, fn)` helper that:
- Emits `task:start` event
- Calls `hub.scoped({ task: { id } }, fn)`
- Emits `task:complete` or `task:failed` based on outcome
- `ExecutableAgents` wrapper that wraps `AgentDefinition` to provide simpler `execute(input)` interface

**Key Dependencies**:

- Import `HubImpl` from `./hub.js`
- Import protocol types from `../protocol/harness.js`, `../protocol/agent.js`, `../protocol/events.js`
- Use Hub's `scoped()` for context propagation
- Track events during `run()` execution

**Note**: Inbox routing (R6) is deferred to Milestone 4 per roadmap. For now, `sendToRun()` can be a no-op or basic implementation.

### 2. Harness Fixture Infrastructure

**File**: `packages/kernel/tests/helpers/harness-fixture-runner.ts`

Create runner similar to `hub-fixture-runner.ts`:

- `runHarnessFixture(fixture: HarnessFixture): Promise<HarnessFixtureResult>`
- Support steps: `create`, `attach`, `startSession`, `run`, `phase`, `task`
- Collect events, state, result, duration
- `normalizeEvents()` helper for deterministic comparison

**File**: `packages/kernel/tests/helpers/fixture-loader.ts`

Extend to support `HarnessFixture` type:

- Add `HarnessFixture` interface with harness-specific steps
- Keep `HubFixture` separate (both can coexist)

### 3. Replay Tests

Create 5 replay test files per test spec:

**File**: `packages/kernel/tests/replay/harness.factory.test.ts`

- Test R1: Factory creates instances with correct state
- Load `harness/factory.jsonl` fixture
- Assert instance is Hub, has state, has methods

**File**: `packages/kernel/tests/replay/harness.attachment.test.ts`

- Test R2: Attachment system
- Load `harness/attachment.jsonl` fixture
- Assert attachment receives hub, can subscribe

**File**: `packages/kernel/tests/replay/harness.session.test.ts`

- Test R3: Session mode
- Load `harness/session.jsonl` fixture
- Assert `startSession()` enables commands, session context available

**File**: `packages/kernel/tests/replay/harness.run.test.ts`

- Test R4: Run lifecycle
- Load `harness/run-lifecycle.jsonl` fixture
- Assert `harness:start`, `harness:complete` events, `HarnessResult` structure

**File**: `packages/kernel/tests/replay/harness.phase-task.test.ts`

- Test R5: Phase/task helpers
- Load `harness/phase-task.jsonl` fixture
- Assert phase/task events, context propagation

**Note**: R6 (Inbox Routing) deferred to Milestone 4 per roadmap.

### 4. Record Fixture Script Updates

**File**: `packages/kernel/scripts/record-fixture.ts`

Add harness scenarios:

- `factory`: Create harness, verify state
- `attachment`: Attach channel, verify hub received
- `session`: Start session, verify commands work
- `run-lifecycle`: Run harness, verify lifecycle events
- `phase-task`: Use phase/task helpers, verify context

Each scenario:

- Creates harness via factory
- Executes steps
- Captures events/state
- Returns `HarnessFixture` with steps and expect

### 5. Golden Fixtures

Record and promote 5 fixtures to `tests/fixtures/golden/harness/`:

- `factory.jsonl`
- `attachment.jsonl`
- `session.jsonl`
- `run-lifecycle.jsonl`
- `phase-task.jsonl`

### 6. Live Script

**File**: `packages/kernel/scripts/live/harness-live.ts`

Create script that:

- Enumerates all harness fixtures from `golden/harness/`
- Runs each via `runHarnessFixture()`
- Verifies events, state, result match expectations
- Reports pass/fail for each
- Exits with code 1 if any fail

### 7. Unit Tests (Optional)

**File**: `packages/kernel/tests/unit/harness.unit.test.ts`

If needed, test pure logic:

- State initialization
- Phase/task context merging
- Agent wrapping logic

Most behavior requires integration tests, so this may be minimal.

## Implementation Order

1. Implement `src/engine/harness.ts` (core implementation)
2. Create `tests/helpers/harness-fixture-runner.ts` (testing infrastructure)
3. Update `tests/helpers/fixture-loader.ts` (add HarnessFixture type)
4. Update `scripts/record-fixture.ts` (add harness scenarios)
5. Record fixtures to `scratch/` directory
6. Create replay test files (5 files)
7. Promote fixtures to `golden/` after review
8. Create `scripts/live/harness-live.ts`
9. Verify all tests pass
10. Verify live script passes

## Conformance Gates

Before marking complete, verify:

- [ ] Harness factory creates instances correctly
- [ ] Lifecycle events (`harness:start`, `harness:complete`) emit correctly
- [ ] `phase()` and `task()` helpers propagate context
- [ ] Attachments receive hub and can subscribe
- [ ] All replay tests pass (5 tests)
- [ ] Live script passes (5 fixtures)
- [ ] No `any` types introduced
- [ ] Lint clean
- [ ] Type check passes

## Key Design Decisions

1. **Harness extends Hub**: `HarnessInstance` extends `HubImpl` to inherit all Hub functionality
2. **State is mutable**: State is owned by harness instance and can be mutated during `run()`
3. **Phase/task use scoped**: Phase and task helpers use `hub.scoped()` internally for context propagation
4. **Events tracked during run**: Collect all events emitted during `run()` for `HarnessResult`
5. **Session context optional**: `session` only present in `ExecuteContext` when `startSession()` was called
6. **Inbox routing deferred**: R6 (inbox routing) is Milestone 4, so basic `sendToRun()` implementation is acceptable

## Files to Create

- `src/engine/harness.ts`
- `tests/helpers/harness-fixture-runner.ts`
- `tests/replay/harness.factory.test.ts`
- `tests/replay/harness.attachment.test.ts`
- `tests/replay/harness.session.test.ts`
- `tests/replay/harness.run.test.ts`
- `tests/replay/harness.phase-task.test.ts`
- `scripts/live/harness-live.ts`
- `tests/fixtures/golden/harness/*.jsonl` (5 files)

## Files to Modify

- `tests/helpers/fixture-loader.ts` (add HarnessFixture type)
- `scripts/record-fixture.ts` (add harness scenarios)

## Testing Strategy

- Replay tests use fixtures (deterministic, fast)
- Live script runs same fixtures (authoritative verification)
- Follow Hub pattern: record to scratch, review, promote to golden
- No network calls in replay tests
- Replay tests complete in <1s