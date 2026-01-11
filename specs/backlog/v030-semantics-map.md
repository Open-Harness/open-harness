# v0.3.0 Semantics/Concept Map

## Problem Statement

The current naming creates confusion:
- **"Provider"** - What does it provide? (It actually harnesses an SDK)
- **"Harness"** - Actually coordinates workflows, not "harnesses" anything
- **"Workflow"** - Only exists conceptually in comments, not as a type

## Proposed Rename

| Layer | Current | Proposed | Rationale |
|-------|---------|----------|-----------|
| SDK Adapter | `Provider` | `Harness` | It harnesses the SDK - makes semantic sense |
| Orchestration | `Harness` | `Workflow` | It coordinates workflows - clearer purpose |

---

## Current State (v0.3.0-alpha)

### Layer 1: SDK Adapters ("Providers")

**Core Interface**: `packages/internal/signals-core/src/provider.ts`
```typescript
// Current: Provider<TInput, TOutput>
// Implements async generator yielding signals from an AI SDK
```

| Current Name | Location | Type | Scope |
|-------------|----------|------|-------|
| `Provider<TInput, TOutput>` | signals-core/src/provider.ts | Interface | Public |
| `ProviderInput` | signals-core/src/provider.ts | Interface | Public |
| `ProviderOutput` | signals-core/src/provider.ts | Interface | Public |
| `ProviderCapabilities` | signals-core/src/provider.ts | Interface | Public |
| `ProviderSignalPayloads` | signals-core/src/provider.ts | Interface | Public |
| `PROVIDER_SIGNALS` | signals-core/src/provider.ts | Const | Public |
| `ClaudeProvider` | adapters/providers/claude/src/ | Class | Public |
| `ClaudeProviderConfig` | adapters/providers/claude/src/ | Interface | Public |
| `ClaudeProviderInput` | adapters/providers/claude/src/ | Interface | Public |
| `ClaudeProviderOutput` | adapters/providers/claude/src/ | Interface | Public |
| `CodexProvider` | adapters/providers/openai/src/ | Class | Public |
| `CodexProviderConfig` | adapters/providers/openai/src/ | Interface | Public |
| `CodexProviderInput` | adapters/providers/openai/src/ | Interface | Public |
| `CodexProviderOutput` | adapters/providers/openai/src/ | Interface | Public |
| `ProviderState` | signals/src/snapshot.ts | Interface | Public |
| `setDefaultProvider()` | core/src/api/defaults.ts | Function | Public |
| `getDefaultProvider()` | core/src/api/defaults.ts | Function | Public |
| `executeProvider()` | core/src/api/create-harness.ts | Function | Internal |
| `replayProviderSignals()` | core/src/api/create-harness.ts | Function | Internal |
| `@open-harness/provider-claude` | adapters/providers/claude | Package | Public |
| `@open-harness/provider-openai` | adapters/providers/openai | Package | Public |

**Signal Names**:
- `provider:start`
- `provider:end`
- `provider:error`

### Layer 2: Workflow Orchestration ("Harness")

**Core Factory**: `packages/internal/core/src/api/create-harness.ts`
```typescript
// Current: createHarness<TState>()
// Returns a factory for scoped agents + runReactive()
```

| Current Name | Location | Type | Scope |
|-------------|----------|------|-------|
| `Harness<TState>` | core/src/api/types.ts | Type | Public |
| `HarnessConfig<TState>` | core/src/api/types.ts | Type | Public |
| `HarnessWithFlow<TState>` | core/src/api/harness.ts | Type | Internal |
| `createHarness<TState>()` | core/src/api/create-harness.ts | Function | Public |
| `HarnessFactory<TState>` | core/src/api/create-harness.ts | Type | Public |
| `ReactiveHarnessConfig<TState>` | core/src/api/create-harness.ts | Type | Public |
| `ReactiveHarnessResult<TState>` | core/src/api/create-harness.ts | Type | Public |
| `harness()` | core/src/api/harness.ts | Function | Public |
| `isHarness()` | core/src/api/harness.ts | Function | Public |
| `HarnessOutcome` | core/src/api/telemetry.ts | Type | Public |
| `HarnessWideEvent` | core/src/api/telemetry.ts | Type | Public |
| `HarnessStartEvent` | core/src/api/telemetry.ts | Type | Public |
| `HarnessErrorEvent` | core/src/api/telemetry.ts | Type | Public |
| `HarnessEvent` | core/src/api/telemetry.ts | Type | Public |

**Signal Names**:
- `harness:start`
- `harness:end`
- `harness:terminating`

---

## Proposed State (v0.4.0)

### Layer 1: SDK Adapters → "Harness"

| Proposed Name | Replaces | Location |
|--------------|----------|----------|
| `Harness<TInput, TOutput>` | `Provider<TInput, TOutput>` | signals-core/src/harness.ts |
| `HarnessInput` | `ProviderInput` | signals-core/src/harness.ts |
| `HarnessOutput` | `ProviderOutput` | signals-core/src/harness.ts |
| `HarnessCapabilities` | `ProviderCapabilities` | signals-core/src/harness.ts |
| `HarnessSignalPayloads` | `ProviderSignalPayloads` | signals-core/src/harness.ts |
| `HARNESS_SIGNALS` | `PROVIDER_SIGNALS` | signals-core/src/harness.ts |
| `ClaudeHarness` | `ClaudeProvider` | adapters/harnesses/claude/ |
| `ClaudeHarnessConfig` | `ClaudeProviderConfig` | adapters/harnesses/claude/ |
| `ClaudeHarnessInput` | `ClaudeProviderInput` | adapters/harnesses/claude/ |
| `ClaudeHarnessOutput` | `ClaudeProviderOutput` | adapters/harnesses/claude/ |
| `CodexHarness` | `CodexProvider` | adapters/harnesses/openai/ |
| `CodexHarnessConfig` | `CodexProviderConfig` | adapters/harnesses/openai/ |
| `CodexHarnessInput` | `CodexProviderInput` | adapters/harnesses/openai/ |
| `CodexHarnessOutput` | `CodexProviderOutput` | adapters/harnesses/openai/ |
| `HarnessState` | `ProviderState` | signals/src/snapshot.ts |
| `setDefaultHarness()` | `setDefaultProvider()` | core/src/api/defaults.ts |
| `getDefaultHarness()` | `getDefaultProvider()` | core/src/api/defaults.ts |
| `executeHarness()` | `executeProvider()` | core/src/api/create-workflow.ts |
| `replayHarnessSignals()` | `replayProviderSignals()` | core/src/api/create-workflow.ts |
| `@open-harness/harness-claude` | `@open-harness/provider-claude` | adapters/harnesses/claude/ |
| `@open-harness/harness-openai` | `@open-harness/provider-openai` | adapters/harnesses/openai/ |

**Signal Names**:
- `harness:start` (unchanged - already makes sense!)
- `harness:end` (unchanged)
- `harness:error` (unchanged)

### Layer 2: Workflow Orchestration → "Workflow"

| Proposed Name | Replaces | Location |
|--------------|----------|----------|
| `Workflow<TState>` | `Harness<TState>` | core/src/api/types.ts |
| `WorkflowConfig<TState>` | `HarnessConfig<TState>` | core/src/api/types.ts |
| `WorkflowWithFlow<TState>` | `HarnessWithFlow<TState>` | core/src/api/workflow.ts |
| `createWorkflow<TState>()` | `createHarness<TState>()` | core/src/api/create-workflow.ts |
| `WorkflowFactory<TState>` | `HarnessFactory<TState>` | core/src/api/create-workflow.ts |
| `ReactiveWorkflowConfig<TState>` | `ReactiveHarnessConfig<TState>` | core/src/api/create-workflow.ts |
| `ReactiveWorkflowResult<TState>` | `ReactiveHarnessResult<TState>` | core/src/api/create-workflow.ts |
| `workflow()` | `harness()` | core/src/api/workflow.ts |
| `isWorkflow()` | `isHarness()` | core/src/api/workflow.ts |
| `WorkflowOutcome` | `HarnessOutcome` | core/src/api/telemetry.ts |
| `WorkflowWideEvent` | `HarnessWideEvent` | core/src/api/telemetry.ts |
| `WorkflowStartEvent` | `HarnessStartEvent` | core/src/api/telemetry.ts |
| `WorkflowErrorEvent` | `HarnessErrorEvent` | core/src/api/telemetry.ts |
| `WorkflowEvent` | `HarnessEvent` | core/src/api/telemetry.ts |

**Signal Names**:
- `workflow:start` (replaces harness:start)
- `workflow:end` (replaces harness:end)
- `workflow:terminating` (replaces harness:terminating)

---

## Migration Impact

### Package Renames

| Current Package | New Package |
|----------------|-------------|
| `@open-harness/provider-claude` | `@open-harness/harness-claude` |
| `@open-harness/provider-openai` | `@open-harness/harness-openai` |

### Directory Renames

| Current Path | New Path |
|-------------|----------|
| `packages/adapters/providers/` | `packages/adapters/harnesses/` |
| `packages/adapters/providers/claude/` | `packages/adapters/harnesses/claude/` |
| `packages/adapters/providers/openai/` | `packages/adapters/harnesses/openai/` |

### File Renames

| Current File | New File |
|-------------|----------|
| `signals-core/src/provider.ts` | `signals-core/src/harness.ts` |
| `adapters/providers/claude/src/claude-provider.ts` | `adapters/harnesses/claude/src/claude-harness.ts` |
| `adapters/providers/openai/src/codex-provider.ts` | `adapters/harnesses/openai/src/codex-harness.ts` |
| `core/src/api/create-harness.ts` | `core/src/api/create-workflow.ts` |
| `core/src/api/harness.ts` | `core/src/api/workflow.ts` |

### Examples Updates Required

| File | Changes |
|------|---------|
| `examples/multi-provider/index.ts` | Rename to `multi-harness`, update imports |
| `examples/simple-reactive/index.ts` | `ClaudeProvider` → `ClaudeHarness` |
| `examples/recording-replay/index.ts` | Provider references |
| `examples/trading-agent/index.ts` | `createHarness` → `createWorkflow` |
| `examples/speckit/level-*/speckit-harness.ts` | Rename to `speckit-workflow.ts` |

---

## Semantic Clarity (Post-Rename)

### User Mental Model

```
┌─────────────────────────────────────────────────────────────┐
│                         Workflow                            │
│  (Coordinates multiple agents with shared state)            │
│                                                             │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   │
│   │   Agent A   │───▶│   Agent B   │───▶│   Agent C   │   │
│   └─────────────┘    └─────────────┘    └─────────────┘   │
│         │                  │                  │            │
│         ▼                  ▼                  ▼            │
│   ┌──────────────────────────────────────────────────┐    │
│   │              Shared Workflow State               │    │
│   └──────────────────────────────────────────────────┘    │
│                                                             │
│   Each agent uses a Harness to communicate with AI SDK:    │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐  │
│   │                    Harness                          │  │
│   │  (Adapter that harnesses an AI SDK)                 │  │
│   │                                                     │  │
│   │   ┌─────────────┐         ┌─────────────────────┐  │  │
│   │   │ ClaudeHarness│──────▶ │ Claude Agent SDK    │  │  │
│   │   └─────────────┘         └─────────────────────┘  │  │
│   │                                                     │  │
│   │   ┌─────────────┐         ┌─────────────────────┐  │  │
│   │   │ CodexHarness │──────▶ │ OpenAI Codex SDK    │  │  │
│   │   └─────────────┘         └─────────────────────┘  │  │
│   └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### API Example (Post-Rename)

```typescript
import { createWorkflow } from "@open-harness/core";
import { ClaudeHarness } from "@open-harness/harness-claude";

// Create a workflow with typed state
const { agent, runReactive } = createWorkflow<TradingState>();

// Configure agents (each using the ClaudeHarness to talk to Claude SDK)
const analyst = agent("analyst", {
  harness: new ClaudeHarness({ model: "claude-sonnet-4-20250514" }),
  activateOn: ["workflow:start"],
  // ...
});

// Run the workflow
const result = await runReactive({
  agents: [analyst, trader, riskManager],
  state: { balance: 10000, positions: [] }
});
```

---

## Deprecation Strategy

### Phase 1: Aliasing (v0.4.0-alpha)
- Keep old names as deprecated aliases
- New names are canonical
- Console warnings on deprecated usage

### Phase 2: Warning (v0.4.0-beta)
- Loud deprecation warnings
- Migration guide published
- Codemod available

### Phase 3: Removal (v0.5.0)
- Old names removed
- Breaking change documented

---

## Open Questions

1. **Package naming**: Should it be `@open-harness/harness-claude` or just `@open-harness/claude`?
   - Pro `@open-harness/claude`: Shorter, cleaner
   - Pro `@open-harness/harness-claude`: Explicit about what it is

2. **Signal prefix**: Keep `harness:*` for SDK adapter signals, or change to something else to avoid collision?
   - Option A: `harness:start` (adapter) vs `workflow:start` (orchestration) - CLEAR
   - Option B: `adapter:start` vs `workflow:start` - More explicit but breaks existing recordings

3. **Directory structure**: Keep `adapters/harnesses/` or flatten to `harnesses/`?

---

## Files That Need Changes

### Critical Path (Core Types)
- [ ] `packages/internal/signals-core/src/provider.ts` → `harness.ts`
- [ ] `packages/internal/signals-core/src/schemas.ts`
- [ ] `packages/internal/signals-core/src/index.ts`
- [ ] `packages/internal/core/src/api/types.ts`
- [ ] `packages/internal/core/src/api/harness.ts` → `workflow.ts`
- [ ] `packages/internal/core/src/api/create-harness.ts` → `create-workflow.ts`
- [ ] `packages/internal/core/src/api/defaults.ts`
- [ ] `packages/internal/core/src/api/telemetry.ts`
- [ ] `packages/internal/core/src/api/index.ts`

### Adapter Packages
- [ ] `packages/adapters/providers/claude/` → `harnesses/claude/`
- [ ] `packages/adapters/providers/openai/` → `harnesses/openai/`

### Public Facade
- [ ] `packages/open-harness/core/src/index.ts`

### Tests
- [ ] All test files referencing Provider/Harness names

### Examples
- [ ] All example files (see list above)

### Documentation
- [ ] `packages/sdk/docs/*`
- [ ] READMEs throughout

---

## Decision Required

Before implementing, confirm:
1. ✅ `Provider` → `Harness` (SDK adapters)
2. ✅ `Harness` → `Workflow` (orchestration)
3. ❓ Package naming convention
4. ❓ Deprecation timeline
5. ❓ Signal prefix handling
