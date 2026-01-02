# Edge Routing Test Specification

**Component**: `packages/kernel/src/flow/runtime.ts`  
**Last Updated**: 2025-12-31  
**Status**: Draft

## Overview

Tests for edge-level `when` routing and node readiness semantics.

## Test Requirements

### R1: Edge `when` Gating

**Fixture**: `fixtures/golden/flow/edge-when-basic.jsonl`  
**Test File**: `tests/replay/flow.edge-routing.test.ts`  
**Test Name**: `"skips edge when condition is false"`

**Scenario**:
1. Create a flow with a switch-like node and two downstream nodes
2. Set output so only one edge `when` evaluates true
3. Run the flow

**Assertions**:
- Only the node on the fired edge runs
- The skipped edge does not trigger downstream execution

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts flow edge-when-basic
```

---

### R2: Node Readiness (All Incoming Resolved)

**Fixture**: `fixtures/golden/flow/edge-readiness.jsonl`  
**Test File**: `tests/replay/flow.edge-routing.test.ts`  
**Test Name**: `"runs node when all incoming edges resolved and one fired"`

**Scenario**:
1. Create a flow with a node that has two upstream edges
2. Ensure one edge fires and one skips
3. Run the flow

**Assertions**:
- Node runs only after both incoming edges are resolved
- Node executes once (no duplicates)

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts flow edge-readiness
```

---

### R3: Merge Override (`control.merge`)

**Fixture**: `fixtures/golden/flow/edge-merge-any.jsonl`  
**Test File**: `tests/replay/flow.edge-routing.test.ts`  
**Test Name**: `"merge any fires when any input fires"`

**Scenario**:
1. Create a flow with a merge node in `any` mode
2. Fire one incoming edge and skip the other
3. Run the flow

**Assertions**:
- Merge node runs when first edge fires (does not wait for all)

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts flow edge-merge-any
```

---

## Live Test (Authoritative)

**Script**: `scripts/live/flow-edge-routing-live.ts`  
**Requirement**: MUST pass before marking edge routing complete  
**Timeout**: 30s  
**Description**: Executes a branching flow with real node outputs and validates routing

**Execution**:
```bash
bun scripts/live/flow-edge-routing-live.ts
```

**Success Criteria**:
- Branching flows route correctly
- Merge semantics respected

---

## Unit Tests (Pure Logic)

**Test File**: `tests/unit/flow.edge-routing.unit.test.ts`

**Requirements**:
- Edge `when` evaluation returns correct boolean for given context
- Node readiness calculation respects `all resolved + any fired`

---

## Coverage Checklist

- [ ] R1: Edge `when` Gating
- [ ] R2: Node Readiness (All Incoming Resolved)
- [ ] R3: Merge Override (`control.merge`)
- [ ] Live test script
- [ ] Unit tests for pure logic

---

## Notes

- Edge `when` should use existing `WhenExpr` evaluation.
- Readiness should be deterministic for replay fixtures.
