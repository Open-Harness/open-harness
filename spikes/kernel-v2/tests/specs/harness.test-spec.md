# Harness Test Specification

**Component**: `src/protocol/harness.ts`  
**Last Updated**: 2025-12-28  
**Status**: Draft

## Overview

Tests for the Harness protocol interface. Harness orchestrates execution, owns state, manages run lifecycle, provides phase/task helpers, and routes inbox messages. Since Harness extends Hub, tests focus on harness-specific behavior beyond the Hub interface.

## Test Requirements

### R1: Harness Factory

**Fixture**: `fixtures/golden/harness/factory.jsonl`  
**Test File**: `tests/replay/harness.factory.test.ts`  
**Test Name**: `"creates harness instance with state"`

**Scenario**:
1. Create harness via factory: `defineHarness({ name, agents, state, run })`
2. Call `create(input)` to create instance
3. Verify instance has correct state
4. Verify instance is also a Hub

**Assertions**:
- Harness instance has `state` property
- State is initialized from `state(input)` function
- Instance implements Hub interface
- Instance has `attach`, `startSession`, `run` methods

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts harness factory
```

---

### R2: Attachment System

**Fixture**: `fixtures/golden/harness/attachment.jsonl`  
**Test File**: `tests/replay/harness.attachment.test.ts`  
**Test Name**: `"attaches channels and adapters"`

**Scenario**:
1. Create harness instance
2. Create attachment (channel/adapter)
3. Call `harness.attach(attachment)`
4. Verify attachment receives hub
5. Verify attachment can subscribe to events

**Assertions**:
- `attach()` returns `this` for chaining
- Attachment receives hub instance
- Attachment can subscribe to events
- Cleanup function is called on completion (if returned)

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts harness attachment
```

---

### R3: Session Mode

**Fixture**: `fixtures/golden/harness/session.jsonl`  
**Test File**: `tests/replay/harness.session.test.ts`  
**Test Name**: `"startSession enables command handling"`

**Scenario**:
1. Create harness instance
2. Verify `sessionActive` is `false`
3. Call `startSession()`
4. Verify `sessionActive` is `true`
5. Verify commands (send/reply/abort) are enabled

**Assertions**:
- `startSession()` returns `this` for chaining
- `sessionActive` becomes `true`
- Commands work (emit `session:message` events)
- `session` context is available in `run()` function

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts harness session
```

---

### R4: Run Lifecycle

**Fixture**: `fixtures/golden/harness/run-lifecycle.jsonl`  
**Test File**: `tests/replay/harness.run.test.ts`  
**Test Name**: `"run executes and returns HarnessResult"`

**Scenario**:
1. Create harness instance
2. Call `harness.run()`
3. Verify `harness:start` event is emitted
4. Verify `run()` function executes
5. Verify `harness:complete` event is emitted
6. Verify `HarnessResult` is returned

**Assertions**:
- `run()` returns `HarnessResult` with `result`, `state`, `events`, `durationMs`, `status`
- `harness:start` is emitted before execution
- `harness:complete` is emitted after execution
- Events are recorded in result
- Duration is measured correctly

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts harness run-lifecycle
```

---

### R5: Phase/Task Helpers

**Fixture**: `fixtures/golden/harness/phase-task.jsonl`  
**Test File**: `tests/replay/harness.phase-task.test.ts`  
**Test Name**: `"phase and task helpers propagate context"`

**Scenario**:
1. Create harness instance
2. In `run()` function, call `phase("Planning", async () => { ... })`
3. Inside phase, call `task("plan", async () => { ... })`
4. Emit events inside phase and task
5. Verify events have correct context

**Assertions**:
- `phase()` emits `phase:start` and `phase:complete`
- Events inside phase have `context.phase.name`
- `task()` emits `task:start` and `task:complete`
- Events inside task have `context.task.id`
- Nested phases/tasks work correctly

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts harness phase-task
```

---

### R6: Inbox Routing

**Fixture**: `fixtures/golden/harness/inbox-routing.jsonl`  
**Test File**: `tests/replay/harness.inbox.test.ts`  
**Test Name**: `"sendToRun routes messages to agent inbox"`

**Scenario**:
1. Create harness instance with agent
2. Start agent execution (get `runId` from `agent:start` event)
3. Call `hub.sendToRun(runId, "message")`
4. Verify message appears in agent's inbox
5. Verify agent can read from inbox

**Assertions**:
- `sendToRun()` routes to correct agent mailbox
- Message appears in `AgentInbox`
- Agent can `pop()` or iterate inbox
- Multiple runs of same agent have separate inboxes

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts harness inbox-routing
```

---

## Live Test (Authoritative)

**Script**: `scripts/live/harness-live.ts`  
**Requirement**: MUST pass before marking Harness implementation complete  
**Timeout**: 30s  
**Description**: Runs all replay scenarios against real Harness implementation

**Execution**:
```bash
bun scripts/live/harness-live.ts
```

**Success Criteria**:
- All replay scenarios pass
- Real implementation matches interface contract
- Completes successfully
- No network calls (unless testing agent execution)

---

## Unit Tests (Pure Logic)

**Test File**: `tests/unit/harness.unit.test.ts`

These test pure logic without fixtures:

**Requirements**:
- State initialization logic (if complex)
- Inbox routing logic (mailbox management)
- Phase/task context merging (if implemented)

**Note**: Most harness behavior requires integration tests. Unit tests focus on pure helper functions.

---

## Coverage Checklist

- [ ] R1: Harness Factory
- [ ] R2: Attachment System
- [ ] R3: Session Mode
- [ ] R4: Run Lifecycle
- [ ] R5: Phase/Task Helpers
- [ ] R6: Inbox Routing
- [ ] Live test script
- [ ] Unit tests for pure logic (if applicable)

---

## Notes

- Harness extends Hub, so Hub tests also apply
- Tests focus on harness-specific behavior (state, lifecycle, inbox routing)
- Phase/task helpers use Hub's context scoping internally
- Inbox routing is critical for bidirectional agent communication
- Session mode enables interactive workflows
