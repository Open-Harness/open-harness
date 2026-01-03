# Hub Test Specification

**Component**: `src/protocol/hub.ts`  
**Last Updated**: 2025-12-28  
**Status**: Draft

## Overview

Tests for the Hub protocol interface. Hub is the unified bidirectional bus that handles events out (subscribe/emit) and commands in (send/reply/abort). Since this is a protocol interface (no implementation in v2), tests validate interface semantics and contract.

## Test Requirements

### R1: Event Subscription (Basic)

**Fixture**: `fixtures/golden/hub/subscribe-basic.jsonl`  
**Test File**: `tests/replay/hub.subscribe.test.ts`  
**Test Name**: `"subscribes and receives events"`

**Scenario**:
1. Create a hub instance
2. Subscribe to all events (`"*"`)
3. Emit a `harness:start` event
4. Verify subscriber receives the event with correct envelope

**Assertions**:
- Event has `id`, `timestamp`, `context`, `event` fields
- Event `event.type` matches emitted type (`"harness:start"`)
- Event `context.sessionId` is present
- Subscriber is called exactly once

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts hub subscribe-basic
```

---

### R2: Event Filtering

**Fixture**: `fixtures/golden/hub/subscribe-filter.jsonl`  
**Test File**: `tests/replay/hub.subscribe.test.ts`  
**Test Name**: `"filters events by pattern"`

**Scenario**:
1. Create hub instance
2. Subscribe to `"agent:*"` pattern
3. Emit `agent:start` and `harness:start` events
4. Verify subscriber only receives `agent:start`

**Assertions**:
- Subscriber receives matching events (`agent:start`)
- Subscriber does NOT receive non-matching events (`harness:start`)
- Multiple patterns work (array filter: `["agent:*", "harness:*"]`)

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts hub subscribe-filter
```

---

### R3: Context Scoping (AsyncLocalStorage)

**Fixture**: `fixtures/golden/hub/scoped-context.jsonl`  
**Test File**: `tests/replay/hub.scoped.test.ts`  
**Test Name**: `"propagates context via scoped blocks"`

**Scenario**:
1. Create hub instance
2. Enter `hub.scoped({ phase: { name: "Planning" } }, ...)`
3. Emit an event inside the scoped block
4. Verify event has `context.phase.name === "Planning"`

**Assertions**:
- Context from `scoped()` appears in emitted events
- Nested scopes merge correctly
- `current()` returns inherited context
- Context propagates across async boundaries

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts hub scoped-context
```

---

### R4: Unsubscribe

**Fixture**: `fixtures/golden/hub/unsubscribe.jsonl`  
**Test File**: `tests/replay/hub.subscribe.test.ts`  
**Test Name**: `"unsubscribe stops receiving events"`

**Scenario**:
1. Create hub, subscribe, emit event (verify received)
2. Call `unsubscribe()`
3. Emit another event
4. Verify subscriber does NOT receive it

**Assertions**:
- Unsubscribe function stops delivery
- Multiple unsubscribes are safe (idempotent)
- Other subscribers still receive events

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts hub unsubscribe
```

---

### R5: Async Iteration

**Fixture**: `fixtures/golden/hub/async-iteration.jsonl`  
**Test File**: `tests/replay/hub.iteration.test.ts`  
**Test Name**: `"supports async iteration"`

**Scenario**:
1. Create hub instance
2. Start async iteration: `for await (const event of hub)`
3. Emit multiple events
4. Verify iteration receives all events

**Assertions**:
- Async iteration works (`hub` is AsyncIterable)
- Events arrive in order
- Iteration can be broken early
- Multiple iterators work independently

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts hub async-iteration
```

---

### R6: Commands (Bidirectional)

**Fixture**: `fixtures/golden/hub/commands.jsonl`  
**Test File**: `tests/replay/hub.commands.test.ts`  
**Test Name**: `"commands emit session:message events"`

**Scenario**:
1. Create hub instance (with session active)
2. Call `hub.send("message")`
3. Call `hub.sendTo("agent", "message")`
4. Call `hub.sendToRun("runId", "message")`
5. Verify `session:message` events are emitted

**Assertions**:
- `send()` emits `session:message` with content
- `sendTo()` emits `session:message` with `agentName`
- `sendToRun()` emits `session:message` with `runId`
- Commands are no-ops if session not active

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts hub commands
```

---

### R7: Status Tracking

**Fixture**: `fixtures/golden/hub/status.jsonl`  
**Test File**: `tests/replay/hub.status.test.ts`  
**Test Name**: `"tracks hub status and session state"`

**Scenario**:
1. Create hub instance
2. Verify initial status is `"idle"`
3. Verify `sessionActive` is `false`
4. Call `startSession()` (if available)
5. Verify `sessionActive` is `true`

**Assertions**:
- `status` is one of: `"idle" | "running" | "complete" | "aborted"`
- `sessionActive` reflects session state
- Status transitions correctly

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts hub status
```

---

## Live Test (Authoritative)

**Script**: `scripts/live/hub-live.ts`  
**Requirement**: MUST pass before marking Hub implementation complete  
**Timeout**: 30s  
**Description**: Runs all replay scenarios against real Hub implementation (no mocks)

**Execution**:
```bash
bun scripts/live/hub-live.ts
```

**Success Criteria**:
- All replay scenarios pass
- No network calls (Hub is pure)
- Completes in <1s
- Real implementation matches interface contract

---

## Unit Tests (Pure Logic)

**Test File**: `tests/unit/hub.unit.test.ts`

These test pure logic without fixtures:

**Requirements**:
- Filter matching logic (`matchesFilter()` function)
- Context merging logic (if implemented)
- Status transition logic (if implemented)

**Note**: Hub interface contract tests are in replay tests. Unit tests focus on helper functions.

---

## Coverage Checklist

- [ ] R1: Event Subscription (Basic)
- [ ] R2: Event Filtering
- [ ] R3: Context Scoping (AsyncLocalStorage)
- [ ] R4: Unsubscribe
- [ ] R5: Async Iteration
- [ ] R6: Commands (Bidirectional)
- [ ] R7: Status Tracking
- [ ] Live test script
- [ ] Unit tests for filter matching logic

---

## Notes

- Hub is a protocol interface (no implementation in v2)
- Replay tests validate the interface contract semantics
- Live test validates real implementation matches contract
- Focus on interface behavior, not implementation details
- Commands may be no-ops in protocol interface (implementation adds behavior)
