# Policy Enforcement Test Specification

**Component**: `packages/kernel/src/flow/runtime.ts`  
**Last Updated**: 2025-12-31  
**Status**: Draft

## Overview

Tests for FlowPolicy and NodePolicy enforcement: timeout, retry, continueOnError, and failFast.

## Test Requirements

### R1: Node Timeout

**Fixture**: `fixtures/golden/flow/policy-timeout.jsonl`  
**Test File**: `tests/replay/flow.policy.test.ts`  
**Test Name**: `"times out node execution"`

**Scenario**:
1. Create a flow with a node that sleeps longer than `timeoutMs`
2. Run the flow

**Assertions**:
- Node emits `task:failed` with timeout error
- Flow respects `failFast` (default) and stops

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts flow policy-timeout
```

---

### R2: Retry with Backoff

**Fixture**: `fixtures/golden/flow/policy-retry.jsonl`  
**Test File**: `tests/replay/flow.policy.test.ts`  
**Test Name**: `"retries node on failure"`

**Scenario**:
1. Create a flow with a node that fails twice then succeeds
2. Set `retry.maxAttempts: 3`
3. Run the flow

**Assertions**:
- Node executed up to maxAttempts
- Flow succeeds if final attempt succeeds

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts flow policy-retry
```

---

### R3: continueOnError

**Fixture**: `fixtures/golden/flow/policy-continue-on-error.jsonl`  
**Test File**: `tests/replay/flow.policy.test.ts`  
**Test Name**: `"continues when continueOnError is true"`

**Scenario**:
1. Create a flow with a failing node and a downstream independent node
2. Set `continueOnError: true` on the failing node
3. Run the flow

**Assertions**:
- Flow continues to downstream node
- Output for failed node is error marker

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts flow policy-continue-on-error
```

---

### R4: failFast false

**Fixture**: `fixtures/golden/flow/policy-failfast-false.jsonl`  
**Test File**: `tests/replay/flow.policy.test.ts`  
**Test Name**: `"continues when failFast is false"`

**Scenario**:
1. Create a flow with two independent nodes
2. One fails, flow.policy.failFast = false
3. Run the flow

**Assertions**:
- Failure recorded in outputs
- Other independent node still runs

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts flow policy-failfast-false
```

---

## Live Test (Authoritative)

**Script**: `scripts/live/flow-policy-live.ts`  
**Requirement**: MUST pass before marking policy enforcement complete  
**Timeout**: 30s  
**Description**: Runs flow scenarios verifying timeout, retry, and error continuation with real runtime

**Execution**:
```bash
bun scripts/live/flow-policy-live.ts
```

**Success Criteria**:
- Timeout aborts node execution
- Retry succeeds within max attempts
- continueOnError and failFast false behave as specified

---

## Unit Tests (Pure Logic)

**Test File**: `tests/unit/flow.policy.unit.test.ts`

**Requirements**:
- Retry policy computes correct attempt sequence
- Timeout helper rejects after deadline

---

## Coverage Checklist

- [ ] R1: Node Timeout
- [ ] R2: Retry with Backoff
- [ ] R3: continueOnError
- [ ] R4: failFast false
- [ ] Live test script
- [ ] Unit tests for pure logic

---

## Notes

- Retry/backoff should use `p-retry`.
- Timeout should use `p-timeout`.
