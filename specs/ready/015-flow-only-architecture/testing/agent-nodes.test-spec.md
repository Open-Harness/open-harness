# Agent Nodes Test Specification

**Component**: `packages/kernel/src/flow/nodes/*`  
**Last Updated**: 2025-12-31  
**Status**: Draft

## Overview

Tests that agent-backed nodes are stateful, injectable, and emit tool/stream events.

## Test Requirements

### R1: Inbox Always Present

**Fixture**: `fixtures/golden/flow/agent-inbox.jsonl`  
**Test File**: `tests/replay/flow.agent-nodes.test.ts`  
**Test Name**: `"agent nodes always receive inbox"`

**Scenario**:
1. Run a flow with an agent node
2. Capture `runId` from `agent:start`
3. Inject a message via `sendToRun`
4. Verify agent receives message

**Assertions**:
- Agent inbox receives injected message
- Event context includes `runId`

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts flow agent-inbox
```

---

### R2: Tool Events Emitted

**Fixture**: `fixtures/golden/flow/agent-tool-events.jsonl`  
**Test File**: `tests/replay/flow.agent-nodes.test.ts`  
**Test Name**: `"agent emits tool events"`

**Scenario**:
1. Run an agent node that invokes a tool
2. Capture events

**Assertions**:
- `agent:tool:start` and `agent:tool:complete` emitted
- Events include correct `runId` and task context

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts flow agent-tool-events
```

---

### R3: Streaming Text Events

**Fixture**: `fixtures/golden/flow/agent-streaming.jsonl`  
**Test File**: `tests/replay/flow.agent-nodes.test.ts`  
**Test Name**: `"agent streams text events"`

**Scenario**:
1. Run a streaming agent node
2. Capture events

**Assertions**:
- `agent:text` events emitted in order
- Final `agent:complete` emitted

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts flow agent-streaming
```

---

## Live Test (Authoritative)

**Script**: `scripts/live/flow-agent-nodes-live.ts`  
**Requirement**: MUST pass before marking agent nodes complete  
**Timeout**: 30s  
**Description**: Runs a real agent node with tools enabled to verify tool/stream events

**Execution**:
```bash
bun scripts/live/flow-agent-nodes-live.ts
```

**Success Criteria**:
- Tool events emitted for live run
- Streaming events appear before completion

---

## Unit Tests (Pure Logic)

**Test File**: `tests/unit/flow.agent-nodes.unit.test.ts`

**Requirements**:
- Agent capability flags are set correctly (`isAgent`, `supportsInbox`)

---

## Coverage Checklist

- [ ] R1: Inbox Always Present
- [ ] R2: Tool Events Emitted
- [ ] R3: Streaming Text Events
- [ ] Live test script
- [ ] Unit tests for pure logic

---

## Notes

- Agent node implementation must not call `unstable_v2_prompt`.
- Agent nodes must pass full config to SDK runner.
