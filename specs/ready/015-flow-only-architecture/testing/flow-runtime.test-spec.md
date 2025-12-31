# Flow Runtime Test Specification

**Component**: `packages/kernel/src/flow/runtime.ts`  
**Last Updated**: 2025-12-31  
**Status**: Draft

## Overview

Tests for the FlowRuntime lifecycle, event emission, and inbox routing. FlowRuntime replaces Harness as the execution runtime and must preserve phase/task semantics.

## Test Requirements

### R1: Run Lifecycle Events

**Fixture**: `fixtures/golden/flow/runtime-lifecycle.jsonl`  
**Test File**: `tests/replay/flow.runtime.test.ts`  
**Test Name**: `"emits harness and phase lifecycle events"`

**Scenario**:
1. Create a FlowRuntime instance with a trivial flow (single node)
2. Run the flow
3. Capture emitted events

**Assertions**:
- `harness:start` is emitted before any task events
- `phase:start`/`phase:complete` wrap the run
- `harness:complete` is emitted at the end with `success: true`

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts flow runtime-lifecycle
```

---

### R2: Task Events Per Node

**Fixture**: `fixtures/golden/flow/runtime-task-events.jsonl`  
**Test File**: `tests/replay/flow.runtime.test.ts`  
**Test Name**: `"emits task events for each node"`

**Scenario**:
1. Create a FlowRuntime instance with a two-node flow
2. Run the flow
3. Capture emitted events

**Assertions**:
- Each node emits `task:start` and `task:complete`
- `task` context includes `task.id` matching node id

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts flow runtime-task-events
```

---

### R3: Inbox Routing

**Fixture**: `fixtures/golden/flow/runtime-inbox-routing.jsonl`  
**Test File**: `tests/replay/flow.runtime.test.ts`  
**Test Name**: `"routes sendToRun into agent inbox"`

**Scenario**:
1. Run a flow with a single agent node
2. Capture the `runId` from `agent:start`
3. Use `sendToRun(runId, message)`
4. Verify the agent inbox receives the message

**Assertions**:
- Agent inbox receives the injected message
- `session:message` is emitted with correct `runId`

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts flow runtime-inbox-routing
```

---

## Live Test (Authoritative)

**Script**: `scripts/live/flow-runtime-live.ts`  
**Requirement**: MUST pass before marking FlowRuntime implementation complete  
**Timeout**: 30s  
**Description**: Runs a small real flow with agent node and validates lifecycle + inbox routing

**Execution**:
```bash
bun scripts/live/flow-runtime-live.ts
```

**Success Criteria**:
- All replay scenarios pass
- Events include correct lifecycle ordering
- Inbox injection works for a live agent run

---

## Unit Tests (Pure Logic)

**Test File**: `tests/unit/flow.runtime.unit.test.ts`

**Requirements**:
- `runId` generation is deterministic in tests
- `sendTo(nodeId, message)` routes to latest runId (if implemented)

---

## Coverage Checklist

- [ ] R1: Run Lifecycle Events
- [ ] R2: Task Events Per Node
- [ ] R3: Inbox Routing
- [ ] Live test script
- [ ] Unit tests for pure logic (if applicable)

---

## Notes

- FlowRuntime must emit `harness:*` events even though Harness is deprecated.
- Ensure phase/task scopes are preserved for event context.
