# Policy Enforcement Test Specification

**Component**: `packages/kernel/src/flow/executor.ts`  
**Last Updated**: 2025-12-31  
**Status**: Draft

## Overview

Tests for Flow policy enforcement (retry, timeout, continueOnError, failFast) in the sequential executor.

## Test Requirements

### R1: Retry Succeeds After Failure

**Test File**: `tests/unit/flow.policy-enforcement.test.ts`  
**Test Name**: `"retries a flaky node and succeeds"`

**Scenario**:
1. Register a flaky node that fails once, then succeeds
2. Apply `policy.retry.maxAttempts: 2`
3. Execute a flow that depends on the flaky node

**Assertions**:
- Flaky node runs twice
- Output uses the successful result
- Downstream node sees correct output

---

### R2: Timeout with continueOnError

**Test File**: `tests/unit/flow.policy-enforcement.test.ts`  
**Test Name**: `"timeout records error marker and continues when allowed"`

**Scenario**:
1. Register a slow node that exceeds `timeoutMs`
2. Apply `policy.timeoutMs` + `continueOnError: true`
3. Execute a flow with a downstream node

**Assertions**:
- Slow node output is an error marker
- Downstream node still executes

---

### R3: failFast false continues on failure

**Test File**: `tests/unit/flow.policy-enforcement.test.ts`  
**Test Name**: `"failFast false continues on failure without continueOnError"`

**Scenario**:
1. Register a node that always throws
2. Use `flow.policy.failFast: false`
3. Execute a flow with a downstream node

**Assertions**:
- Failing node output is an error marker
- Downstream node executes

---

### R4: failFast true aborts run

**Test File**: `tests/unit/flow.policy-enforcement.test.ts`  
**Test Name**: `"failFast true aborts when continueOnError is false"`

**Scenario**:
1. Register a node that always throws
2. Use `flow.policy.failFast: true`
3. Execute a flow

**Assertions**:
- Flow execution throws

---

## Live Test (Authoritative)

**Script**: `scripts/live/flow-policy-live.ts`  
**Requirement**: MUST pass before marking policy enforcement complete  
**Timeout**: 30s  
**Description**: Executes a flow with retry policy and validates successful completion

**Execution**:
```bash
bun scripts/live/flow-policy-live.ts
```

**Success Criteria**:
- Retry policy allows flaky node to succeed
- Downstream output is correct

---

## Coverage Checklist

- [ ] R1: Retry succeeds
- [ ] R2: Timeout + continueOnError
- [ ] R3: failFast false continues
- [ ] R4: failFast true aborts
- [ ] Live test script

---

## Notes
