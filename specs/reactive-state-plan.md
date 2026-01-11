# Reactive State Implementation Plan

**Feature:** Signals-based reactive state system
**Branch:** `v0.2.0/stabilization`
**Status:** Planning
**Created:** 2026-01-09

---

## Executive Summary

We're adding a signals-based reactive state system using `@maverick-js/signals` to:
1. **Fix the schema flow bug** - Schema defined in `agent()` doesn't reach provider
2. **Enable runtime configuration** - Add tools, change schema mid-conversation
3. **Simplify state threading** - Replace manual prop drilling with reactive access
4. **Improve DX** - Explicit read/write with automatic change propagation

---

## Architecture Overview

### State Layers

```
┌─────────────────────────────────────────────────────────────────┐
│ HarnessState (Definition-time, persists across runs)            │
│ - outputSchema: ZodType | null                                  │
│ - systemPrompt: string                                          │
│ - model: string                                                 │
│ - tools: Tool[]                                                 │
├─────────────────────────────────────────────────────────────────┤
│ RunState (Per-execution, ephemeral)                             │
│ - status: 'idle' | 'running' | 'paused' | 'completed' | 'error' │
│ - currentNode: string | null                                    │
│ - messages: Message[]                                           │
│ - nodeOutputs: Record<string, unknown>                          │
│ - metrics: { inputTokens, outputTokens, cost }                  │
├─────────────────────────────────────────────────────────────────┤
│ DerivedState (Computed, read-only)                              │
│ - hasSchema: boolean                                            │
│ - toolCount: number                                             │
│ - isRunning: boolean                                            │
│ - totalTokens: number                                           │
└─────────────────────────────────────────────────────────────────┘
```

### Access Patterns

```typescript
// Read state (call the signal)
const schema = harnessState.outputSchema()

// Write state (call setter)
harnessState.setOutputSchema(newSchema)

// React to changes
effect(() => {
  console.log('Schema changed:', harnessState.outputSchema())
})

// Batch multiple updates
batch(() => {
  harnessState.setModel('claude-opus-4-20250514')
  harnessState.setTools([...])
})
```

---

## Implementation Phases

### Phase 1: Foundation (No Breaking Changes)
**Goal:** Add reactive state module without changing existing behavior

**Files to create:**
```
packages/internal/core/src/state/
├── reactive.ts         # Signal definitions, createHarnessState, createRunState
├── derived.ts          # Computed state (createDerivedState)
├── injection.ts        # NeedleDI tokens, global accessors
└── index.ts            # Re-exports
```

**Tasks:**
- [ ] Add `@maverick-js/signals` dependency
- [ ] Add `zod-to-json-schema` dependency
- [ ] Create `reactive.ts` with HarnessState, RunState interfaces
- [ ] Create `derived.ts` with computed state
- [ ] Create `injection.ts` with DI tokens + global accessors
- [ ] Export from `packages/internal/core/src/state/index.ts`
- [ ] Add exports to `@open-harness/core` public API

**Quality Gate 1:**
```bash
bun run typecheck  # Must pass
bun run lint       # Must pass
bun run test       # All existing tests pass (no regressions)
```

**Acceptance:**
- New modules compile without errors
- No changes to existing behavior
- Can import and use reactive state in isolation

---

### Phase 2: Schema Flow Fix (Core Bug Fix)
**Goal:** Make schema flow from `agent()` → `provider.run()`

**Files to modify:**
```
packages/internal/core/src/api/run.ts       # buildProviderInput reads reactive state
packages/internal/core/src/api/agent.ts     # agent() writes to reactive state
```

**Tasks:**
- [ ] Modify `agent()` to write `config.output.schema` to reactive state
- [ ] Modify `buildProviderInput()` to read `outputSchema()` from reactive state
- [ ] Add Zod → JSON Schema conversion in buildProviderInput
- [ ] Pass `outputFormat` to provider options

**Quality Gate 2:**
```bash
bun run typecheck
bun run lint
bun run test

# NEW: Integration test for schema flow
bun run test:live -- --grep "schema flows to provider"
```

**Acceptance:**
- Schema defined in `agent({ output: { schema } })` reaches SDK
- Structured output works end-to-end
- Existing tests still pass

---

### Phase 3: Runtime Integration
**Goal:** Wire reactive state into runtime and node execution

**Files to modify:**
```
packages/internal/core/src/nodes/registry.ts      # Add reactive to NodeRunContext
packages/internal/core/src/runtime/execution/     # Runtime uses RunState
packages/internal/server/src/providers/claude/    # Provider reads from state
```

**Tasks:**
- [ ] Add `reactive?: { harness, run }` to `NodeRunContext`
- [ ] Runtime creates reactive state on initialization
- [ ] Runtime updates `RunState` during execution (status, currentNode, metrics)
- [ ] Providers can access reactive state for dynamic config

**Quality Gate 3:**
```bash
bun run typecheck
bun run lint
bun run test

# NEW: Integration tests for runtime state
bun run test:live -- --grep "reactive state"
```

**Acceptance:**
- Runtime tracks execution status reactively
- Effects fire on state changes
- Metrics accumulate correctly

---

### Phase 4: Simplification Pass
**Goal:** Remove redundant code now that reactive state exists

**Candidates for removal/simplification:**
```
- Manual state threading in function parameters
- Duplicate state initialization patterns
- Complex prop drilling in node execution
- Redundant snapshot logic (keep snapshot(), remove manual threading)
```

**Tasks:**
- [ ] Run audit (from handoff prompt) to identify candidates
- [ ] Remove/simplify identified code
- [ ] Update call sites
- [ ] Verify no regressions

**Quality Gate 4:**
```bash
bun run typecheck
bun run lint
bun run test
bun run test:live

# Code metrics
# LOC should decrease
# No new exports removed (backward compat)
```

**Acceptance:**
- Net reduction in lines of code
- All tests pass
- No breaking changes to public API

---

### Phase 5: Documentation & Examples
**Goal:** Update all docs and examples for new patterns

**Files to update:**
```
packages/sdk/docs/
├── getting-started.md          # Add reactive state basics
├── state-management.md         # NEW: Full reactive state guide
├── migration-v0.2.md          # NEW: Migration guide if needed

examples/
├── basic-agent.ts              # Update to show schema usage
├── multi-node-pipeline.ts      # Show reactive state in action
├── dynamic-configuration.ts    # NEW: Runtime config changes

specs/portable/
├── 02-architecture/
│   └── state.md               # NEW: State architecture doc
```

**Tasks:**
- [ ] Write state-management.md guide
- [ ] Update getting-started.md with reactive state
- [ ] Create/update examples
- [ ] Update architecture docs
- [ ] Add to quickstart if significant

**Quality Gate 5:**
```bash
# Doc site builds
cd apps/docs && bun run build

# Examples compile and run
bun run examples/basic-agent.ts
bun run examples/multi-node-pipeline.ts
```

**Acceptance:**
- All examples work
- Docs accurately reflect new API
- No broken links

---

### Phase 6: v0.2.0 Landing
**Goal:** Merge reactive state into v0.2.0 release

**Pre-merge checklist:**
- [ ] All quality gates pass
- [ ] No P0 bugs
- [ ] Documentation complete
- [ ] CHANGELOG updated
- [ ] Migration guide (if breaking changes)

**Merge process:**
```bash
# Ensure all changes committed
git status  # clean

# Run full test suite
bun run typecheck
bun run lint
bun run test
bun run test:live

# Merge to dev (if on feature branch)
git checkout dev
git merge v0.2.0/stabilization

# PR to master
gh pr create --base master --head dev \
  --title "v0.2.0: Reactive State System" \
  --body "..."
```

---

## Quality Gates Summary

| Phase | Gate | Commands | Blocks If |
|-------|------|----------|-----------|
| 1 | Foundation | `typecheck`, `lint`, `test` | Any failure |
| 2 | Schema Flow | + `test:live schema` | Schema doesn't reach SDK |
| 3 | Runtime | + `test:live reactive` | State not tracked |
| 4 | Simplification | + LOC check | Regressions |
| 5 | Docs | `docs build`, examples run | Build fails |
| 6 | Landing | Full suite | Any failure |

### Regression Prevention

**Existing test suites must pass at every phase:**
```bash
# Unit tests (no network)
bun run test

# Integration tests (live SDK)
bun run test:live
```

**New tests to add:**

```typescript
// tests/integration/reactive-state.test.ts

describe('Reactive State', () => {
  describe('Schema Flow', () => {
    it('schema defined in agent() reaches provider', async () => {
      const schema = z.object({ answer: z.string() })
      const myAgent = agent({
        prompt: 'Answer questions',
        output: { schema }
      })

      const result = await run(myAgent, { prompt: 'What is 2+2?' })

      // Should get structured output, not plain text
      expect(result.output).toHaveProperty('answer')
      expect(typeof result.output.answer).toBe('string')
    })
  })

  describe('Runtime State', () => {
    it('tracks execution status', async () => {
      const runState = getRunState()
      const statuses: string[] = []

      effect(() => statuses.push(runState.status()))

      await run(myAgent, { prompt: 'Hello' })

      expect(statuses).toContain('running')
      expect(statuses).toContain('completed')
    })
  })

  describe('Dynamic Configuration', () => {
    it('allows adding tools at runtime', async () => {
      const harness = getHarnessState()

      harness.addTool(myTool)

      expect(harness.tools()).toContain(myTool)
    })
  })
})
```

---

## Files Changed Summary

### New Files
```
packages/internal/core/src/state/reactive.ts
packages/internal/core/src/state/derived.ts
packages/internal/core/src/state/injection.ts
packages/sdk/docs/state-management.md
examples/dynamic-configuration.ts
tests/integration/reactive-state.test.ts
```

### Modified Files
```
packages/internal/core/src/api/run.ts
packages/internal/core/src/api/agent.ts
packages/internal/core/src/nodes/registry.ts
packages/internal/core/src/state/index.ts
packages/internal/core/package.json (new deps)
packages/sdk/docs/getting-started.md
examples/basic-agent.ts
```

### Potentially Simplified/Removed
```
(Determined by Phase 4 audit)
```

---

## Dependencies

**New packages:**
```json
{
  "@maverick-js/signals": "^6.0.0",
  "zod-to-json-schema": "^3.23.0"
}
```

**Why these:**
- `@maverick-js/signals`: Smallest bundle (~1KB), designed for backend, DI-friendly
- `zod-to-json-schema`: Convert Zod schemas to JSON Schema for SDK

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing API | Low | High | Keep existing types, add reactive as enhancement |
| Performance regression | Low | Medium | Signals are ~microsecond, benchmark if concerned |
| Memory leaks | Medium | Medium | Use root() scopes, document cleanup patterns |
| DX confusion | Medium | Medium | Clear docs, examples, migration guide |
| Incomplete migration | Medium | Low | Audit in Phase 4 catches stragglers |

---

## Timeline Estimate

| Phase | Effort | Dependency |
|-------|--------|------------|
| Phase 1 | 2-3 hours | None |
| Phase 2 | 1-2 hours | Phase 1 |
| Phase 3 | 2-3 hours | Phase 2 |
| Phase 4 | 2-4 hours | Phase 3 + Audit results |
| Phase 5 | 3-4 hours | Phase 4 |
| Phase 6 | 1 hour | All phases |

**Total:** ~12-17 hours of focused work

---

## Post-Landing Tasks

After v0.2.0 ships with reactive state:

1. **Monitor for issues** - Watch for bug reports related to state
2. **Gather feedback** - Is the DX what we expected?
3. **Consider extensions:**
   - Persistence hooks (save/restore reactive state)
   - DevTools (visualize state changes)
   - Time-travel debugging (replay state history)
4. **Update remaining docs** - Fill outline pages in specs/portable/

---

## Appendix: Code Sketches

### A. Reactive State Module

```typescript
// packages/internal/core/src/state/reactive.ts
import { signal, computed, batch } from '@maverick-js/signals'

export interface HarnessState<TOutput = unknown> {
  outputSchema: () => ZodType<TOutput> | null
  systemPrompt: () => string
  model: () => string
  tools: () => Tool[]

  setOutputSchema: (schema: ZodType<TOutput> | null) => void
  setSystemPrompt: (prompt: string) => void
  setModel: (model: string) => void
  setTools: (tools: Tool[]) => void
  addTool: (tool: Tool) => void
  removeTool: (name: string) => void
}

export function createHarnessState<TOutput = unknown>(
  initial?: Partial<{ outputSchema: ZodType<TOutput>; systemPrompt: string; model: string; tools: Tool[] }>
): HarnessState<TOutput> {
  const _outputSchema = signal<ZodType<TOutput> | null>(initial?.outputSchema ?? null)
  const _systemPrompt = signal(initial?.systemPrompt ?? '')
  const _model = signal(initial?.model ?? 'claude-sonnet-4-20250514')
  const _tools = signal<Tool[]>(initial?.tools ?? [])

  return {
    outputSchema: () => _outputSchema(),
    systemPrompt: () => _systemPrompt(),
    model: () => _model(),
    tools: () => _tools(),

    setOutputSchema: (schema) => _outputSchema.set(schema),
    setSystemPrompt: (prompt) => _systemPrompt.set(prompt),
    setModel: (model) => _model.set(model),
    setTools: (tools) => _tools.set(tools),
    addTool: (tool) => _tools.set([..._tools(), tool]),
    removeTool: (name) => _tools.set(_tools().filter(t => t.name !== name)),
  }
}
```

### B. Schema Flow Fix

```typescript
// packages/internal/core/src/api/run.ts (modified)
import { zodToJsonSchema } from 'zod-to-json-schema'
import { getHarnessState } from '../state/injection.js'

function buildProviderInput(agent: Agent, userInput: unknown): AgentInput {
  const state = getHarnessState()
  const input: AgentInput = {}

  // ... existing prompt handling ...

  // NEW: Schema flows through
  const schema = agent.config.output?.schema ?? state.outputSchema()
  if (schema) {
    input.options = {
      ...input.options,
      outputFormat: {
        type: 'json_schema' as const,
        schema: zodToJsonSchema(schema),
      },
    }
  }

  return input
}
```
