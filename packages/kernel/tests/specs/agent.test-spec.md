# Agent Test Specification

**Component**: `src/protocol/agent.ts`  
**Last Updated**: 2025-12-28  
**Status**: Draft

## Overview

Tests for the Agent protocol interface. Agent defines the `AgentDefinition` contract for executable units that emit events and return results. Tests validate the interface contract, inbox semantics, and runId routing.

## Test Requirements

### R1: AgentDefinition Contract

**Fixture**: `fixtures/golden/agent/definition.jsonl`  
**Test File**: `tests/replay/agent.definition.test.ts`  
**Test Name**: `"AgentDefinition has required fields and execute signature"`

**Scenario**:
1. Create an `AgentDefinition` object
2. Verify it has `name` field (string)
3. Verify it has `execute` method with correct signature
4. Verify optional `emitsStartComplete` field

**Assertions**:
- `name` is a string
- `execute(input, ctx)` signature is correct
- `ctx` has `hub`, `inbox`, `runId` fields
- `emitsStartComplete` is optional boolean

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts agent definition
```

---

### R2: AgentExecuteContext

**Fixture**: `fixtures/golden/agent/execute-context.jsonl`  
**Test File**: `tests/replay/agent.context.test.ts`  
**Test Name**: `"AgentExecuteContext provides hub, inbox, and runId"`

**Scenario**:
1. Create agent definition
2. Execute agent with context
3. Verify context has `hub`, `inbox`, `runId`
4. Verify agent can use each context field

**Assertions**:
- `ctx.hub` is a Hub instance
- `ctx.inbox` is an AgentInbox instance
- `ctx.runId` is a unique string
- Agent can emit events via `ctx.hub`
- Agent can read from `ctx.inbox`

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts agent execute-context
```

---

### R3: Inbox Interface

**Fixture**: `fixtures/golden/agent/inbox.jsonl`  
**Test File**: `tests/replay/agent.inbox.test.ts`  
**Test Name**: `"AgentInbox supports async iteration and pop"`

**Scenario**:
1. Create agent with inbox
2. Send messages via `hub.sendToRun(runId, "message")`
3. Verify messages appear in inbox
4. Test `inbox.pop()` (blocking)
5. Test `for await (const msg of inbox)` (async iteration)
6. Test `inbox.drain()` (non-blocking)

**Assertions**:
- `inbox.pop()` returns next message (blocks if empty)
- `inbox` is AsyncIterable (can use `for await`)
- `inbox.drain()` returns all queued messages
- Messages have `content` and `timestamp` fields
- Inbox is read-only (agent cannot write to it)

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts agent inbox
```

---

### R4: emitsStartComplete Flag

**Fixture**: `fixtures/golden/agent/emits-start-complete.jsonl`  
**Test File**: `tests/replay/agent.lifecycle.test.ts`  
**Test Name**: `"emitsStartComplete controls lifecycle event emission"`

**Scenario**:
1. Create agent with `emitsStartComplete: false` (default)
2. Execute agent
3. Verify runtime emits `agent:start` and `agent:complete`
4. Create agent with `emitsStartComplete: true`
5. Execute agent
6. Verify agent emits its own lifecycle events

**Assertions**:
- Default (`false`): runtime emits lifecycle events
- When `true`: agent must emit `agent:start` and `agent:complete`
- Agent-provided events include `runId`
- Runtime does not emit duplicate events when `emitsStartComplete: true`

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts agent emits-start-complete
```

---

### R5: ExecutableAgent Wrapper

**Fixture**: `fixtures/golden/agent/executable-wrapper.jsonl`  
**Test File**: `tests/replay/agent.wrapper.test.ts`  
**Test Name**: `"ExecutableAgent provides simplified interface"`

**Scenario**:
1. Create runtime with agent definition
2. Access agent via `agents.foo` (ExecutableAgent)
3. Call `agents.foo.execute(input)` (no context args)
4. Verify execution works correctly

**Assertions**:
- `ExecutableAgent.execute(input)` signature (no context)
- Runtime injects context internally
- Result is returned correctly
- Events are emitted via hub

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts agent executable-wrapper
```

---

### R6: RunId Uniqueness

**Fixture**: `fixtures/golden/agent/runid-uniqueness.jsonl`  
**Test File**: `tests/replay/agent.runid.test.ts`  
**Test Name**: `"runId is unique per execution"`

**Scenario**:
1. Execute same agent multiple times concurrently
2. Verify each execution gets unique `runId`
3. Verify `hub.sendToRun(runId, ...)` routes correctly
4. Verify inbox messages go to correct run

**Assertions**:
- Each execution has unique `runId`
- `runId` appears in `agent:start` and `agent:complete` events
- `sendToRun(runId, ...)` routes to correct inbox
- Multiple concurrent runs work independently

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts agent runid-uniqueness
```

---

## Live Test (Authoritative)

**Script**: `scripts/live/agent-live.ts`  
**Requirement**: MUST pass before marking Agent protocol complete  
**Timeout**: 30s  
**Description**: Runs all replay scenarios against real Agent implementation

**Execution**:
```bash
bun scripts/live/agent-live.ts
```

**Success Criteria**:
- All replay scenarios pass
- Real implementation matches interface contract
- Inbox routing works correctly
- RunId uniqueness is maintained
- Completes successfully

---

## Unit Tests (Pure Logic)

**Test File**: `tests/unit/agent.unit.test.ts`

These test pure logic without fixtures:

**Requirements**:
- Inbox message queue logic (if implemented)
- RunId generation logic (if implemented)
- ExecutableAgent wrapper logic (if implemented)

**Note**: Most agent behavior requires integration tests. Unit tests focus on pure helper functions.

---

## Coverage Checklist

- [ ] R1: AgentDefinition Contract
- [ ] R2: AgentExecuteContext
- [ ] R3: Inbox Interface
- [ ] R4: emitsStartComplete Flag
- [ ] R5: ExecutableAgent Wrapper
- [ ] R6: RunId Uniqueness
- [ ] Live test script
- [ ] Unit tests for pure logic (if applicable)

---

## Notes

- Agent is a protocol interface (no implementation in v2)
- Tests validate interface contract semantics
- Inbox is critical for bidirectional agent communication
- RunId enables run-scoped message injection
- `emitsStartComplete` allows provider adapters to control lifecycle events
