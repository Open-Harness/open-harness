# Flow Test Specification

**Component**: `src/protocol/flow.ts`  
**Last Updated**: 2025-12-28  
**Status**: Draft

## Overview

Tests for the Flow protocol types. Flow defines the YAML DAG structure (FlowSpec, NodeSpec, edges, bindings, WhenExpr). Since this is primarily type definitions and YAML contract validation, tests focus on type contracts and YAML schema validation.

## Test Requirements

### R1: FlowSpec Structure

**Fixture**: `fixtures/golden/flow/flowspec-structure.jsonl`  
**Test File**: `tests/replay/flow.flowspec.test.ts`  
**Test Name**: `"FlowSpec has required and optional fields"`

**Scenario**:
1. Create FlowSpec objects with different field combinations
2. Verify required fields: `name`
3. Verify optional fields: `version`, `description`, `input`, `policy`
4. Verify field types are correct

**Assertions**:
- `name` is required (string)
- `version` is optional (number, default: 1)
- `description` is optional (string)
- `input` is optional (Record<string, unknown>)
- `policy` is optional (FlowPolicy object)

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts flow flowspec-structure
```

---

### R2: NodeSpec Structure

**Fixture**: `fixtures/golden/flow/nodespec-structure.jsonl`  
**Test File**: `tests/replay/flow.nodespec.test.ts`  
**Test Name**: `"NodeSpec has required and optional fields"`

**Scenario**:
1. Create NodeSpec objects with different field combinations
2. Verify required fields: `id`, `type`, `input`
3. Verify optional fields: `config`, `when`, `policy`
4. Verify field types and constraints

**Assertions**:
- `id` is required (NodeId: string matching `^[A-Za-z_][A-Za-z0-9_]*$`)
- `type` is required (NodeTypeId: string)
- `input` is required (Record<string, unknown>)
- `config` is optional (Record<string, unknown>)
- `when` is optional (WhenExpr)
- `policy` is optional (NodePolicy)

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts flow nodespec-structure
```

---

### R3: WhenExpr Grammar

**Fixture**: `fixtures/golden/flow/when-expr.jsonl`  
**Test File**: `tests/replay/flow.when.test.ts`  
**Test Name**: `"WhenExpr supports equals, not, and, or"`

**Scenario**:
1. Create WhenExpr objects for each grammar variant
2. Test `equals: { var: "path", value: X }`
3. Test `not: <WhenExpr>`
4. Test `and: [<WhenExpr>, ...]`
5. Test `or: [<WhenExpr>, ...]`
6. Test nested expressions

**Assertions**:
- `equals` has `var` (string) and `value` (unknown)
- `not` has `not` field (WhenExpr)
- `and` has `and` field (WhenExpr[])
- `or` has `or` field (WhenExpr[])
- Expressions can be nested

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts flow when-expr
```

---

### R4: Binding Paths

**Fixture**: `fixtures/golden/flow/binding-paths.jsonl`  
**Test File**: `tests/replay/flow.bindings.test.ts`  
**Test Name**: `"binding paths resolve correctly"`

**Scenario**:
1. Create binding context with `flow.input` and node outputs
2. Test path resolution: `flow.input.country`
3. Test path resolution: `facts.capital`
4. Test strict binding: `{{path}}` (error if missing)
5. Test optional binding: `{{?path}}` (empty if missing)
6. Test default binding: `{{path | default:"value"}}`

**Assertions**:
- Paths use dot notation: `flow.input.*`, `nodeId.*`
- Strict binding (`{{path}}`) errors if missing
- Optional binding (`{{?path}}`) returns empty string if missing
- Default binding uses provided default value if missing
- Paths resolve against binding context

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts flow binding-paths
```

---

### R5: Edge Requirements

**Fixture**: `fixtures/golden/flow/edges.jsonl`  
**Test File**: `tests/replay/flow.edges.test.ts`  
**Test Name**: `"edges define explicit dependencies"`

**Scenario**:
1. Create FlowYaml with nodes and edges
2. Verify `edges` array is required (may be empty)
3. Verify each edge has `from` and `to` (NodeId)
4. Verify edges reference valid node IDs
5. Test that bindings do NOT imply edges

**Assertions**:
- `edges` is required (B1 rule: explicit edges)
- Each edge has `from` (NodeId) and `to` (NodeId)
- Edges reference valid node IDs
- Graph is never inferred from bindings or ordering
- Empty edges array is valid (single-node flows)

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts flow edges
```

---

### R6: NodePolicy Structure

**Fixture**: `fixtures/golden/flow/node-policy.jsonl`  
**Test File**: `tests/replay/flow.policy.test.ts`  
**Test Name**: `"NodePolicy supports timeout, retry, continueOnError"`

**Scenario**:
1. Create NodePolicy objects with different field combinations
2. Test `timeoutMs` (optional number)
3. Test `retry` (optional RetryPolicy)
4. Test `continueOnError` (optional boolean)
5. Verify RetryPolicy structure: `maxAttempts`, `backoffMs`

**Assertions**:
- `timeoutMs` is optional (number, milliseconds)
- `retry` is optional (RetryPolicy object)
- `continueOnError` is optional (boolean, default: false)
- `RetryPolicy.maxAttempts` is required (number >= 1)
- `RetryPolicy.backoffMs` is optional (number, default: 0)

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts flow node-policy
```

---

### R7: FlowYaml Structure

**Fixture**: `fixtures/golden/flow/flowyaml-structure.jsonl`  
**Test File**: `tests/replay/flow.flowyaml.test.ts`  
**Test Name**: `"FlowYaml has flow, nodes, edges"`

**Scenario**:
1. Create FlowYaml object
2. Verify required fields: `flow`, `nodes`, `edges`
3. Verify `flow` is FlowSpec
4. Verify `nodes` is NodeSpec[]
5. Verify `edges` is Edge[]

**Assertions**:
- `flow` is required (FlowSpec)
- `nodes` is required (NodeSpec[])
- `edges` is required (Edge[]) - B1 rule
- All node IDs in edges exist in nodes array
- Node IDs are unique

**Fixture Recording**:
```bash
bun scripts/record-fixture.ts flow flowyaml-structure
```

---

## Live Test (Authoritative)

**Script**: `scripts/live/flow-live.ts`  
**Requirement**: MUST pass before marking Flow protocol complete  
**Timeout**: 30s  
**Description**: Validates FlowYaml parsing and type contracts with real YAML files

**Execution**:
```bash
bun scripts/live/flow-live.ts
```

**Success Criteria**:
- All replay scenarios pass
- YAML parsing works correctly
- Type validation works correctly
- Completes successfully

---

## Unit Tests (Pure Logic)

**Test File**: `tests/unit/flow.unit.test.ts`

These test pure logic without fixtures:

**Requirements**:
- WhenExpr evaluation logic (if implemented)
- Binding path resolution logic (if implemented)
- Node ID validation logic (regex matching)
- Edge validation logic (cycle detection, node reference validation)

**Note**: Flow is primarily type definitions. Unit tests focus on validation and parsing logic.

---

## Coverage Checklist

- [ ] R1: FlowSpec Structure
- [ ] R2: NodeSpec Structure
- [ ] R3: WhenExpr Grammar
- [ ] R4: Binding Paths
- [ ] R5: Edge Requirements
- [ ] R6: NodePolicy Structure
- [ ] R7: FlowYaml Structure
- [ ] Live test script
- [ ] Unit tests for validation logic

---

## Notes

- Flow is primarily protocol types (no implementation in v2)
- Tests validate YAML contract semantics and type correctness
- Focus on ensuring FlowSpec structure matches protocol specification
- Binding and WhenExpr evaluation logic will be tested when implemented
- Edge requirements (B1) are critical - explicit edges, no inference
