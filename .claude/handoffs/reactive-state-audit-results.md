# Reactive State Impact Audit - Results

**Generated**: 2026-01-09
**Audited by**: 6 parallel agents (State Patterns, API Surface, Data Flow, Simplification, Docs, Integration Points)

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Breaking API Changes** | 0 |
| **New Exports** | 14 |
| **LOC Reduction** | ~284 |
| **Files Affected** | ~15 core files |
| **Docs Requiring Updates** | 13 (5 rewrite, 8 update) |
| **Risk Level** | Low (all changes internal or additive) |

---

## Impact Summary

```yaml
impact_summary:
  files_affected: 15
  functions_modified: 12
  breaking_api_changes: 0
  loc_added: ~150 (new reactive module)
  loc_removed: ~284 (eliminated boilerplate)
  net_loc_change: -134

  new_dependencies:
    - "@maverick-js/signals": "^6.0.0"
    - "zod-to-json-schema": "^3.22.0"
```

---

## Critical Findings

### 1. Schema Flow Bug (Root Cause Identified)

**Severity**: HIGH
**Location**: `packages/internal/core/src/api/run.ts:192-214`

```typescript
// CURRENT CODE (broken)
function buildProviderInput(agent: Agent, userInput: unknown): AgentInput {
  const input: AgentInput = {};
  // ... extracts prompt, messages, systemPrompt ...
  // ❌ NEVER ACCESSES: agent.config.output.schema
  return input;
}
```

**Fix Required**: Add 10 lines to extract schema and convert Zod → JSON Schema

```typescript
// FIX
if (agent.config.output?.schema) {
  const jsonSchema = zodToJsonSchema(agent.config.output.schema);
  input.options = {
    ...input.options,
    outputFormat: { type: "json_schema", schema: jsonSchema }
  };
}
```

### 2. StateStore Duplication

**Severity**: MEDIUM

Two separate implementations exist:
- `InMemoryStateStore` in runtime.ts (82 LOC)
- `createMinimalStateStore` in run.ts (52 LOC)

Both become unnecessary with reactive state.

### 3. Manual State Threading

**Severity**: LOW

76 spread operators (`{ ...state }`) scattered across codebase for state copying. Reactive state eliminates this boilerplate.

---

## State Patterns Inventory

### Current Patterns Found

| Pattern | Location | LOC | Replaceable? |
|---------|----------|-----|--------------|
| StateStore Interface | state/state.ts:17-40 | 24 | Partial - snapshot() stays |
| InMemoryStateStore | runtime.ts:150-231 | 82 | Yes |
| createMinimalStateStore | run.ts:115-166 | 52 | Yes |
| NodeRunContext.state | registry.ts:12-23 | 12 | Partial - becomes reactive |
| StatePatch | state.ts:10-12 | 3 | Yes |
| cloneRecord | runtime.ts:1103-1108 | 6 | Yes |

### No Existing Reactive Patterns
- No signals, observables, or reactive primitives found
- All state is imperative get/set/patch

---

## API Surface Changes

### Existing Exports (Unchanged)
All 29 current exports remain unchanged:
- `agent`, `harness`, `run`
- `Agent`, `AgentConfig`, `Harness`, `HarnessConfig`
- `RunOptions`, `RunResult`, `RunMetrics`
- `Provider`, `FixtureStore`, `FixtureMode`
- `isAgent`, `isHarness`
- `setDefaultStore`, `getDefaultStore`, `setDefaultMode`, etc.

### New Exports (14 Added)

```typescript
// State Types
export type { HarnessState, RunState, DerivedState }

// Factory Functions
export { createHarnessState, createRunState, createDerivedState }

// Global Accessors (DI-based)
export { getHarnessState, getRunState, getDerivedState }

// DI Tokens
export { HARNESS_STATE_TOKEN, RUN_STATE_TOKEN, DERIVED_STATE_TOKEN }

// Re-exports from @maverick-js/signals
export { effect, batch, Signal }
```

### Internal Changes (Non-Breaking)

| Export | Change | Breaking? |
|--------|--------|-----------|
| `AgentInput.options` | Adds optional `outputFormat` | No |
| `NodeRunContext` | Adds optional `reactive` field | No |

---

## Data Flow Analysis

### Current Flow (Broken)

```
agent({ output: { schema: Z } })
   ↓
   Schema stored in config.output.schema ✓
   ↓
run(agent, input)
   ↓
buildProviderInput(agent, input)  [run.ts:192-214]
   ↓
   Extracts: prompt, messages, systemPrompt
   ❌ DOES NOT EXTRACT: schema
   ↓
provider.run(ctx, input)
   ↓
   Input lacks outputFormat
   ↓
SDK call → No structured output
```

### New Flow (With Fix)

```
agent({ output: { schema: Z } })
   ↓
   Schema stored + written to harnessState.setOutputSchema() ✓
   ↓
run(agent, input)
   ↓
buildProviderInput(agent, input)
   ↓
   Reads harnessState.outputSchema()
   Converts Zod → JSON Schema
   Adds to input.options.outputFormat ✓
   ↓
provider.run(ctx, input)
   ↓
   Input includes outputFormat ✓
   ↓
SDK call → Structured output works!
```

---

## Simplification Opportunities

### Deletable Code

| File | Lines | LOC | Reason |
|------|-------|-----|--------|
| run.ts | 115-166 | 52 | createMinimalStateStore becomes unnecessary |
| runtime.ts | 150-231 | 82 | InMemoryStateStore class - thin wrapper or delete |
| runtime.ts | 1103-1108 | 6 | cloneRecord helper - reactive handles snapshots |

### Simplifiable Functions

| File | Function | Current | New | Change |
|------|----------|---------|-----|--------|
| runtime.ts | InMemoryStateStore.get | 13 | 1 | Path parsing moves to library |
| runtime.ts | InMemoryStateStore.set | 19 | 1 | Nested assignment via proxy |
| runtime.ts | InMemoryStateStore.patch | 14 | 3 | Merge via Object.assign on proxy |
| run.ts | createRunContext | 16 | 3 | Direct reactive state reference |
| run.ts | runAgent | 62 | 45 | Remove state wrapper boilerplate |

### Total LOC Reduction: ~284

---

## Documentation Impact

### Rewrites Required (5 files)

| File | Priority | Reason |
|------|----------|--------|
| examples/speckit/README.md | HIGH | Shows old state initialization pattern |
| examples/speckit/level-2/task-executor.ts | HIGH | Demonstrates `state: { tasksProcessed: 0 }` |
| examples/speckit/level-4/speckit-harness.ts | HIGH | Harness state initialization |
| examples/speckit/level-5/speckit-harness.ts | HIGH | Three-agent shared state |
| apps/docs/content/0.2.0/04-getting-started/speckit-tutorial.md | HIGH | All 7 levels show old pattern |

### Updates Required (8 files)

| File | Sections | Priority |
|------|----------|----------|
| quickstart.mdx | Result shape | MEDIUM |
| architecture.mdx | Harnesses, Result Shape | MEDIUM |
| custom-agents.mdx | Agent Config, Multi-Agent | MEDIUM |
| multi-agent-flow.mdx | Data Flow with Bindings | MEDIUM |
| runtime/state/README.md | State Architecture | HIGH |
| runtime/README.md | State subsystem | MEDIUM |
| api/agent.ts | JSDoc examples | HIGH |
| tests/api/agent.test.ts | State tests | HIGH |

### New Docs Needed (3 topics)

1. **Reactive State Guide** (HIGH)
   - HarnessState vs RunState
   - Reading and writing state
   - Effects system
   - Migration guide

2. **State in Multi-Agent Workflows** (HIGH)
   - Shared state patterns
   - State coordination
   - Avoiding conflicts

3. **Effects System Documentation** (MEDIUM)
   - When to use effects
   - Effect lifecycle
   - Common patterns

---

## Integration Points

### HarnessState Readers (5 locations)
- `run.ts:buildProviderInput` - reads prompt, state
- `run.ts:runAgent` - reads state for return value
- `harness.ts:buildNodeDefinition` - reads prompt, state, output
- `run.ts:runHarness` - reads from harness.config.agents

### RunState Updaters (6 locations)
- `runtime.ts:run` - updates status
- `runtime.ts:run` (node execution) - updates nodeStatus, outputs
- `runtime.ts:evaluateOutgoingEdges` - updates edgeStatus
- `runtime.ts:bumpLoopCounter` - updates loopCounters
- `runtime.ts:setAgentSession` - updates agentSessions
- `runtime.ts:pause/stop` - updates status

### Effect Candidates (4 locations)
- `run.ts` - rebuild provider input on config changes
- `runtime.ts` - auto-emit events on status changes
- `use-harness.ts` - subscribe to state instead of events
- `runtime.ts` - auto-persist on state changes

---

## Critical Path (Implementation Order)

```yaml
critical_path:
  - step: 1
    description: "Add dependencies"
    files:
      - "packages/internal/core/package.json"
    adds:
      - "@maverick-js/signals"
      - "zod-to-json-schema"

  - step: 2
    description: "Create reactive state module"
    files:
      - "packages/internal/core/src/state/reactive.ts"
      - "packages/internal/core/src/state/derived.ts"
      - "packages/internal/core/src/state/injection.ts"
    depends_on: [1]

  - step: 3
    description: "Fix schema flow"
    files:
      - "packages/internal/core/src/api/run.ts"
      - "packages/internal/core/src/api/agent.ts"
    depends_on: [2]
    fixes: "Issue #137 - Schema not flowing to provider"

  - step: 4
    description: "Integrate with runtime"
    files:
      - "packages/internal/core/src/runtime/execution/runtime.ts"
      - "packages/internal/core/src/nodes/registry.ts"
    depends_on: [3]

  - step: 5
    description: "Update exports and docs"
    files:
      - "packages/internal/core/src/api/index.ts"
      - "packages/internal/core/src/state/index.ts"
      - "packages/sdk/src/index.ts"
    depends_on: [4]

  - step: 6
    description: "Update examples and documentation"
    files:
      - "examples/speckit/*"
      - "apps/docs/content/*"
    depends_on: [5]
```

---

## Risk Assessment

### Low Risk
- Zero breaking changes - all existing code continues to work
- Gradual rollout via phases
- Well-tested signal library (@maverick-js/signals)

### Medium Risk

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Global state complexity | Medium | Medium | Use NeedleDI for scoped state |
| Zod → JSON Schema edge cases | Low | Medium | Comprehensive test suite |
| Signal performance in hot loop | Low | Medium | Batch updates, profile |

### High Risk
None identified.

---

## Phased Implementation Plan

### Phase 1: Foundation (No Integration)
**Scope**: Add reactive module, don't wire it yet
**Files**:
- `packages/internal/core/src/state/reactive.ts` (new)
- `packages/internal/core/src/state/derived.ts` (new)
- `packages/internal/core/src/state/injection.ts` (new)
- `packages/internal/core/src/state/index.ts` (update exports)

**Testable**: Yes - module works in isolation
**Breaking**: No

### Phase 2: Schema Flow Fix
**Scope**: Wire schema from agent() to provider.run()
**Files**:
- `packages/internal/core/src/api/agent.ts` (write to reactive state)
- `packages/internal/core/src/api/run.ts` (read from reactive state, add zod-to-json-schema)

**Testable**: Yes - structured output works end-to-end
**Breaking**: No
**Fixes**: Issue #137

### Phase 3: Runtime Integration
**Scope**: Wire reactive state into runtime and node execution
**Files**:
- `packages/internal/core/src/nodes/registry.ts` (add reactive to NodeRunContext)
- `packages/internal/core/src/runtime/execution/runtime.ts` (use reactive for status)
- `packages/internal/server/src/providers/claude/claude.agent.ts` (optional reactive access)

**Testable**: Yes - runtime uses signals
**Breaking**: No

### Phase 4: Cleanup & Docs
**Scope**: Remove deprecated code, update documentation
**Files**:
- Delete createMinimalStateStore
- Simplify InMemoryStateStore
- Update all documentation

**Testable**: Yes - existing tests pass
**Breaking**: No

---

## Success Metrics

### Must Have
- [x] Zero breaking changes
- [ ] All existing tests pass
- [ ] Schema flow bug fixed (structured output works)
- [ ] New reactive state exports available

### Nice to Have
- [ ] ~284 LOC reduction
- [ ] Improved DX for advanced users
- [ ] Foundation for runtime config changes

---

## Appendix: Agent Outputs

Full YAML outputs from each audit agent are available in the synthesis above. Key sections:

1. **State Pattern Inventory** - 16 patterns cataloged
2. **API Surface Audit** - 29 existing + 14 new exports
3. **Data Flow Analysis** - Exact code path traced
4. **Simplification Opportunities** - 284 LOC reduction identified
5. **Docs Impact** - 13 files need attention
6. **Integration Points** - 20+ integration sites mapped
