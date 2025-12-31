# Channel Test Specification

**Component**: `src/protocol/channel.ts`  
**Last Updated**: 2025-12-28  
**Status**: Draft

## Overview

Tests for the Channel protocol interface. Channels are bidirectional adapters/attachments that observe events and send commands. Tests validate the attachment contract, event subscription patterns, and command sending.

## Test Requirements

### R1: ChannelDefinition Structure

**Fixture**: `fixtures/golden/channel/definition.jsonl`  
**Test File**: `tests/replay/channel.definition.test.ts`  
**Test Name**: `"ChannelDefinition has required fields"`

**Scenario**:
1. Create a `ChannelDefinition` object
2. Verify it has `name` field (string)
3. Verify optional `state`, `onStart`, `on`, `onComplete` fields
4. Verify `on` is a record of event patterns to handlers

**Assertions**:
- `name` is a string
- `state` is optional function returning state object
- `onStart` is optional handler receiving `{ hub, state, emit }`
- `on` is a record: `Record<string, ChannelHandler>`
- `onComplete` is optional handler receiving `{ hub, state, emit }`

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts channel definition
```

---

### R2: Attachment Contract

**Fixture**: `fixtures/golden/channel/attachment.jsonl`  
**Test File**: `tests/replay/channel.attachment.test.ts`  
**Test Name**: `"attachment receives hub and returns cleanup"`

**Scenario**:
1. Create channel definition
2. Convert to attachment via `defineChannel()`
3. Attach to runtime: `runtime.attach(attachment)`
4. Verify attachment receives hub
5. Verify cleanup function is called (if returned)

**Assertions**:
- Attachment is a function: `(hub: Hub) => Cleanup`
- Attachment receives hub instance
- Attachment can subscribe to hub events
- Cleanup is `void | (() => void) | (() => Promise<void>)`
- Cleanup is called when runtime completes

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts channel attachment
```

---

### R3: Event Subscription Pattern

**Fixture**: `fixtures/golden/channel/subscription.jsonl`  
**Test File**: `tests/replay/channel.subscription.test.ts`  
**Test Name**: `"channel subscribes to hub events via on handlers"`

**Scenario**:
1. Create channel with `on: { "agent:*": handler, "phase:start": handler }`
2. Attach channel to runtime
3. Emit matching events
4. Verify handlers are called with correct context

**Assertions**:
- Handlers in `on` record subscribe to hub events
- Pattern matching works (`"agent:*"` matches `agent:start`, `agent:text`, etc.)
- Handler receives `ChannelContext` with `hub`, `state`, `event`, `emit`
- Multiple handlers can match same event
- Handlers can emit events via `ctx.emit()`

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts channel subscription
```

---

### R4: State Management

**Fixture**: `fixtures/golden/channel/state.jsonl`  
**Test File**: `tests/replay/channel.state.test.ts`  
**Test Name**: `"channel maintains state across events"`

**Scenario**:
1. Create channel with `state: () => ({ count: 0 })`
2. Attach channel to runtime
3. Handler increments `state.count` on each event
4. Verify state persists across events
5. Verify state is available in `onStart` and `onComplete`

**Assertions**:
- State is initialized from `state()` function
- State persists across event handlers
- State is available in `onStart`, handlers, and `onComplete`
- Each attachment gets its own state instance

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts channel state
```

---

### R5: Command Sending

**Fixture**: `fixtures/golden/channel/commands.jsonl`  
**Test File**: `tests/replay/channel.commands.test.ts`  
**Test Name**: `"channel can send commands via hub"`

**Scenario**:
1. Create channel with handler that calls `hub.send("message")`
2. Attach channel to runtime with session active
3. Trigger handler (via event)
4. Verify `session:message` event is emitted
5. Test `hub.reply()`, `hub.abort()` commands

**Assertions**:
- Channel can call `hub.send()`, `hub.reply()`, `hub.abort()`
- Commands emit appropriate events (`session:message`, `session:reply`, `session:abort`)
- Commands work when session is active
- Commands are no-ops if session not active

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts channel commands
```

---

### R6: Lifecycle Hooks

**Fixture**: `fixtures/golden/channel/lifecycle.jsonl`  
**Test File**: `tests/replay/channel.lifecycle.test.ts`  
**Test Name**: `"onStart and onComplete hooks are called"`

**Scenario**:
1. Create channel with `onStart` and `onComplete` handlers
2. Attach channel to runtime
3. Verify `onStart` is called during attachment
4. Run runtime
5. Verify `onComplete` is called during cleanup

**Assertions**:
- `onStart` is called when channel is attached
- `onStart` receives `{ hub, state, emit }`
- `onComplete` is called during cleanup
- `onComplete` receives `{ hub, state, emit }`
- Cleanup happens even if errors occur

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts channel lifecycle
```

---

## Live Test (Authoritative)

**Script**: `scripts/live/channel-live.ts`  
**Requirement**: MUST pass before marking Channel protocol complete  
**Timeout**: 30s  
**Description**: Runs all replay scenarios against real Channel implementation

**Execution**:
```bash
bun scripts/live/channel-live.ts
```

**Success Criteria**:
- All replay scenarios pass
- Real implementation matches interface contract
- Event subscription works correctly
- Commands work correctly
- Completes successfully

---

## Unit Tests (Pure Logic)

**Test File**: `tests/unit/channel.unit.test.ts`

These test pure logic without fixtures:

**Requirements**:
- `defineChannel()` helper function logic
- Pattern matching logic (if implemented)
- State initialization logic (if complex)

**Note**: Most channel behavior requires integration tests. Unit tests focus on pure helper functions.

---

## Coverage Checklist

- [ ] R1: ChannelDefinition Structure
- [ ] R2: Attachment Contract
- [ ] R3: Event Subscription Pattern
- [ ] R4: State Management
- [ ] R5: Command Sending
- [ ] R6: Lifecycle Hooks
- [ ] Live test script
- [ ] Unit tests for pure logic (if applicable)

---

## Notes

- Channel is a protocol interface (no implementation in v2)
- Tests validate attachment patterns and event subscription
- Channels are bidirectional (observe events, send commands)
- `defineChannel()` is a convenience helper (attachment can be created manually)
- State management allows channels to track their own state across events
