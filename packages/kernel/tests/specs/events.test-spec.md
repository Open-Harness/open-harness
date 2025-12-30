# Events Test Specification

**Component**: `src/protocol/events.ts`  
**Last Updated**: 2025-12-28  
**Status**: Draft

## Overview

Tests for the Events protocol types. Events defines the canonical event envelope, context structure, and event type definitions. Since this is pure TypeScript types (no implementation), tests focus on type contracts and validation logic.

## Test Requirements

### R1: Event Envelope Structure

**Fixture**: `fixtures/golden/events/envelope-structure.jsonl`  
**Test File**: `tests/replay/events.envelope.test.ts`  
**Test Name**: `"enriched event has required fields"`

**Scenario**:
1. Create an enriched event object
2. Verify it has all required fields: `id`, `timestamp`, `context`, `event`
3. Verify field types are correct

**Assertions**:
- `id` is a string
- `timestamp` is a Date instance
- `context` is an EventContext object
- `event` is a BaseEvent object

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts events envelope-structure
```

---

### R2: Context Structure

**Fixture**: `fixtures/golden/events/context-structure.jsonl`  
**Test File**: `tests/replay/events.context.test.ts`  
**Test Name**: `"event context has required and optional fields"`

**Scenario**:
1. Create EventContext objects with different field combinations
2. Verify `sessionId` is always required
3. Verify `phase`, `task`, `agent` are optional

**Assertions**:
- `sessionId` is always present (string)
- `phase` is optional (object with `name`, optional `number`)
- `task` is optional (object with `id`)
- `agent` is optional (object with `name`, optional `type`)

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts events context-structure
```

---

### R3: Event Type Definitions

**Fixture**: `fixtures/golden/events/event-types.jsonl`  
**Test File**: `tests/replay/events.types.test.ts`  
**Test Name**: `"all event types have correct structure"`

**Scenario**:
1. Create events of each type (WorkflowEvents, AgentEvents, SessionEvents)
2. Verify each event has `type` field
3. Verify type-specific fields are present

**Assertions**:
- WorkflowEvents: `harness:start`, `harness:complete`, `phase:*`, `task:*`
- AgentEvents: `agent:start`, `agent:complete`, `agent:text`, `agent:tool:*`
- SessionEvents: `session:prompt`, `session:reply`, `session:abort`, `session:message`
- All events have `type` field matching their union type

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts events event-types
```

---

### R4: Event Filtering Types

**Fixture**: `fixtures/golden/events/filter-types.jsonl`  
**Test File**: `tests/replay/events.filter.test.ts`  
**Test Name**: `"event filter supports all filter types"`

**Scenario**:
1. Create EventFilter values: `"*"`, `"agent:*"`, `["agent:*", "harness:*"]`
2. Verify each filter type is valid
3. Test filter matching logic (if implementation exists)

**Assertions**:
- `"*"` matches all events
- String pattern matches events by type prefix
- Array of patterns matches events matching any pattern
- Filter type is `"*" | string | string[]`

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts events filter-types
```

---

## Live Test (Authoritative)

**Script**: `scripts/live/events-live.ts`  
**Requirement**: MUST pass before marking Events protocol complete  
**Timeout**: 30s  
**Description**: Validates event type contracts and envelope structure with real event creation

**Execution**:
```bash
bun scripts/live/events-live.ts
```

**Success Criteria**:
- All event types can be created correctly
- Envelope structure is validated
- Context structure is validated
- Filter types are validated
- Completes in <1s (pure types, no network)

---

## Unit Tests (Pure Logic)

**Test File**: `tests/unit/events.unit.test.ts`

These test pure logic without fixtures:

**Requirements**:
- Filter matching logic (`matchesFilter()` function if implemented)
- Context merging logic (if implemented)
- Event type guards (if implemented)
- Envelope construction helpers (if implemented)

**Note**: Since Events is primarily type definitions, unit tests focus on any helper functions or validation logic.

---

## Coverage Checklist

- [ ] R1: Event Envelope Structure
- [ ] R2: Context Structure
- [ ] R3: Event Type Definitions
- [ ] R4: Event Filtering Types
- [ ] Live test script
- [ ] Unit tests for pure logic (if applicable)

---

## Notes

- Events is primarily TypeScript type definitions (no runtime implementation in v2)
- Tests validate type contracts and any helper functions
- Focus on ensuring event structure matches protocol specification
- Replay tests validate type correctness, not runtime behavior
- Live test validates types work correctly when used in real scenarios
