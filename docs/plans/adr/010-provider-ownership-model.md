# ADR-010: Provider Ownership Model

**Status:** Accepted
**Date:** 2026-01-29
**Decision Area:** Provider Architecture
**Related Issues:** ARCH-006, ARCH-021, API-002, API-006
**Blocks:** ADR-009 (Config Consolidation)

---

## Executive Summary

Agents should **own their provider directly** instead of referencing a model string that gets resolved via a registry. This decision enables clean variant creation for evals, simplifies runtime configuration, and aligns with the eval system design.

---

## Context

### What Are Providers?

**Providers are agentic SDK wrappers, NOT raw LLM APIs.**

| Provider | SDK | Characteristics |
|----------|-----|-----------------|
| Anthropic | Anthropic Agent SDK | Stateful, structured output, tool use |
| Codex | OpenAI Codex SDK | Stateful, code-focused |
| OpenCode | Open Code SDK | Stateful, code execution |
| Cursor | Cursor CLI SDK | Stateful, IDE-integrated |

These SDKs are **stateful** — they manage conversation context internally. There is no "temperature" parameter, no message history to pass. You send a prompt, you get structured output.

### Current Implementation (Model String + Registry)

**Agent definition (Engine/agent.ts:42-89):**
```typescript
interface AgentDef<S, O, Ctx> {
  readonly name: string
  readonly model: string              // ← String identifier, e.g., "claude-sonnet-4-5"
  readonly options?: Record<string, unknown>
  readonly output: z.ZodType<O>
  readonly prompt: (state: S) => string
  readonly update: (output: O, draft: Draft<S>) => void
}

const planner = agent({
  name: "planner",
  model: "claude-sonnet-4-5",         // ← Just a string
  output: PlanSchema,
  prompt: (state) => `Plan: ${state.goal}`,
  update: (output, draft) => { draft.tasks = output.tasks }
})
```

**Runtime resolution (Engine/provider.ts:283):**
```typescript
const registry = yield* ProviderRegistry
const provider = yield* registry.getProvider(agent.model)  // ← Lookup by string
```

**Runtime configuration requires providers map:**
```typescript
const result = await run(myWorkflow, {
  input: "Build an API",
  runtime: {
    providers: {
      "claude-sonnet-4-5": Anthropic({ model: "claude-sonnet-4-5" }),
      "claude-opus-4-5": Anthropic({ model: "claude-opus-4-5" }),
    },
    mode: "live"
  }
})
```

### Eval System Design Requirement

The eval system (docs/plans/eval-system-design.md) requires **agent-owns-provider** for clean variant creation:

```typescript
// Variant creation via spread — only works if provider is on agent
const opus = Anthropic({ model: "claude-opus-4-5" })
const withOpus = myWorkflow.with({
  agents: { planner: { ...planner, provider: opus } }
})
```

With model string + registry, variant creation is awkward:
```typescript
// Must update agent AND ensure registry has the provider
const plannerV2 = { ...planner, model: "claude-opus-4-5" }
const withOpus = myWorkflow.with({
  agents: { planner: plannerV2 }
})
// AND ensure "claude-opus-4-5" is in providers map at runtime — two places!
```

---

## Problem Statement

1. **Variant creation is awkward** — Must coordinate agent model string AND runtime providers map
2. **Agents are not self-contained** — Need external registry to function
3. **Runtime config has unnecessary boilerplate** — `providers` map required everywhere
4. **Type safety gap** — Model string is unvalidated; typos cause runtime errors
5. **Extra service dependency** — `ProviderRegistry` service adds complexity

---

## Decision

**Agents embed their provider directly. No string-based model resolution. No separate `providers` mapping at runtime.**

### Agent Definition (New)

```typescript
interface AgentDef<S, O, Ctx> {
  readonly name: string
  readonly provider: AgentProvider    // ← Direct provider instance
  readonly options?: Record<string, unknown>  // ← Agent-level overrides
  readonly output: z.ZodType<O>
  readonly prompt: (state: S) => string
  readonly update: (output: O, draft: Draft<S>) => void
}

const sonnet = Anthropic({ model: "claude-sonnet-4-5" })

const planner = agent({
  name: "planner",
  provider: sonnet,                   // ← Provider instance, not string
  output: PlanSchema,
  prompt: (state) => `Plan: ${state.goal}`,
  update: (output, draft) => { draft.tasks = output.tasks }
})
```

### Runtime Configuration (Simplified)

```typescript
const result = await run(myWorkflow, {
  input: "Build an API",
  mode: "live",           // Optional, defaults to "live"
  database: "./data.db"   // Optional, defaults to ~/.openscaffold/
  // NO providers map needed!
})
```

### Variant Creation (Clean)

```typescript
const opus = Anthropic({ model: "claude-opus-4-5" })
const withOpus = myWorkflow.with({
  agents: { planner: { ...planner, provider: opus } }
})
// That's it — one place to change
```

> **Note:** `workflow.with()` is specified in `eval-system-design.md` but **not yet implemented**. See [Implementation Dependencies](#implementation-dependencies) below.

---

## AgentProvider Interface (Updated)

For recording/playback to work, the provider must expose its configuration for hashing:

```typescript
interface AgentProvider {
  /** Provider name (e.g., "anthropic", "codex") */
  readonly name: string

  /** Model identifier (e.g., "claude-sonnet-4-5") */
  readonly model: string

  /** Provider-specific configuration for hashing */
  readonly config?: Record<string, unknown>

  /** Stream agent execution */
  readonly stream: (options: ProviderRunOptions) => Stream.Stream<AgentStreamEvent, ProviderError>
}
```

**Provider creation:**
```typescript
// packages/anthropic/src/provider.ts
export const Anthropic = (opts: {
  model: string
  // SDK-specific options (NOT temperature — these are agentic SDKs)
  extendedThinking?: boolean
  maxTurns?: number
}): AgentProvider => ({
  name: "anthropic",
  model: opts.model,
  config: { extendedThinking: opts.extendedThinking, maxTurns: opts.maxTurns },
  stream: (runOpts) => {
    // ... call Anthropic Agent SDK
  }
})

const sonnet = Anthropic({ model: "claude-sonnet-4-5" })
// sonnet.name === "anthropic"
// sonnet.model === "claude-sonnet-4-5"
// sonnet.config === {}
```

---

## Recording/Playback Implications

### How It Works Today

1. `ProviderModeContext` has `mode: "live" | "playback"` (server-level, not per-provider)
2. Hash is computed from `prompt + outputSchema + providerOptions`
3. In **live** mode: call provider, record events by hash
4. In **playback** mode: load recording by hash, replay events (provider NOT called)

### How It Works With Agent-Owns-Provider

**No change to the core flow.** The only difference is where `model` comes from for hashing:

| | Before | After |
|--|--------|-------|
| Model source | `agent.model` (string) | `agent.provider.model` (property) |
| Options source | `agent.options` | `{ ...agent.provider.config, ...agent.options }` |

**Hash computation (Engine/provider.ts):**
```typescript
const providerOptions: ProviderRunOptions = {
  prompt,
  outputSchema: agent.output,
  providerOptions: {
    model: agent.provider.model,           // ← From provider
    ...agent.provider.config,              // ← Provider-level config
    ...agent.options                       // ← Agent-level overrides
  }
}
const hash = hashProviderRequest(providerOptions)
```

**Key insight:** In playback mode, `agent.provider` is **never called**. The recording is loaded by hash and replayed. The provider on the agent only matters in live mode.

### Variant Recordings Are Separate

When you create a variant with a different provider:
```typescript
const withOpus = myWorkflow.with({
  agents: { planner: { ...planner, provider: opus } }
})
```

- Baseline hash: `sha256:abc...` (includes "claude-sonnet-4-5")
- Variant hash: `sha256:xyz...` (includes "claude-opus-4-5")
- **Each variant has separate recordings** — correct behavior!

---

## Hashing Strategy

### What Gets Hashed (Domain/Hash.ts)

Current hash includes:
1. `prompt` — The generated prompt text
2. `outputSchema` — Zod schema definition
3. `providerOptions` — All options including model
4. `tools` — Tool definitions if present

### Open Question: Provider-Specific Options

Different agentic SDKs have different options:

| SDK | Options |
|-----|---------|
| Anthropic Agent SDK | `extendedThinking`, `maxTurns`, `allowedTools` |
| Codex SDK | `sandboxMode`, `executionTimeout` |
| Cursor CLI | `workspaceRoot`, `allowedPaths` |

**The current approach hashes all of `providerOptions`, which includes whatever the provider passes.** This should work for any SDK — we just hash whatever config exists.

**If two providers have the same model but different options:**
```typescript
const sonnetDefault = Anthropic({ model: "claude-sonnet-4-5" })
const sonnetThinking = Anthropic({ model: "claude-sonnet-4-5", extendedThinking: true })

// Different configs → different hashes → separate recordings
```

**Open question:** Should we normalize option ordering? Current implementation sorts keys (Hash.ts:54-58), which should handle this.

---

## Impact Analysis

### Services to DELETE

| Service | Reason |
|---------|--------|
| `ProviderRegistry` | No longer needed — provider is on agent |
| `ProviderRegistryService` interface | Ditto |
| `makeInMemoryProviderRegistry()` | Ditto |
| `ProviderNotFoundError` | Can't happen — provider is always present |

### Files to Modify

| File | Change |
|------|--------|
| `Domain/Provider.ts` | Add `model` and `config` to `AgentProvider` interface |
| `Engine/agent.ts` | Change `model: string` → `provider: AgentProvider` |
| `Engine/provider.ts` | Use `agent.provider` directly, delete registry code |
| `Engine/runtime.ts` | Remove `ProviderRegistry` from dependencies |
| `Engine/run.ts` | Remove `providers` from `RuntimeConfig` |
| `Engine/execute.ts` | Remove `ProviderRegistry` from dependencies |
| Provider packages | Return provider with `model` and `config` properties |

### ADRs Affected

| ADR | Impact |
|-----|--------|
| **ADR-009** (Config Consolidation) | **BLOCKED** — Config shape depends on this decision. Now much simpler (no `providers` map). |
| ADR-001 (Execution API) | `RuntimeConfig` simplifies |
| ADR-004 (Events) | Could add `model` to `AgentStarted` event (optional) |

### Technical Debt Issues Resolved

| ID | Issue |
|----|-------|
| ARCH-006 | Provider infrastructure too public |
| ARCH-021 | Provider ownership model misaligned with eval design |
| API-002 | Inconsistent configuration options (partial) |

---

## Alternatives Considered

### Option A: Agent Owns Provider (This Decision)

**Score: 87.5/100**

| Criterion | Score | Notes |
|-----------|-------|-------|
| Eval system support | 95 | `workflow.with()` works perfectly |
| External DX simplicity | 90 | Agent is self-contained, runtime is minimal |
| Type safety | 95 | Provider is typed, no string lookups |
| Effect idiomaticity | 85 | Removes ProviderRegistry service |
| Migration simplicity | 50 | Breaking change to AgentDef |

### Option B: Keep Model String + Registry (Current)

**Score: 58.5/100**

| Criterion | Score | Notes |
|-----------|-------|-------|
| Eval system support | 50 | Variants awkward — two places to change |
| External DX simplicity | 60 | Providers map is boilerplate |
| Type safety | 50 | Model string is unvalidated |
| Effect idiomaticity | 70 | ProviderRegistry is reasonable |
| Migration simplicity | 95 | No changes needed |

### Option C: Hybrid (Support Both)

**Score: 68.0/100**

Agent can have either `provider` OR `model` string. Resolution checks provider first, falls back to registry.

**Rejected:** Two ways to do the same thing creates confusion. Documentation and testing burden doubles.

### Option D: Provider Factory Pattern

**Score: 69.5/100**

Agent has `provider: () => AgentProvider` (factory function).

**Rejected:** Extra indirection without clear benefit. Factory called on every execution — need memoization complexity.

---

## Open Questions

1. **Option normalization for hashing:** Should we enforce a canonical ordering for provider config beyond just sorting keys? Current approach (sorted keys) seems sufficient. **Recommendation:** Keep current approach.

2. **Provider identity for debugging:** Should `AgentStarted` events include `provider.model` for observability? Would help with debugging variant runs. **Recommendation:** Yes, add `model` and `provider` to `AgentStarted` event.

## Resolved Questions

3. ~~**Provider validation:**~~ Not an issue. We define the `AgentProvider` contract and we build the provider implementations. All providers must implement structured output as part of the contract.

4. ~~**Lazy vs eager provider creation:**~~ Eager creation is correct. The provider object is a lightweight client — it doesn't create sessions or allocate server resources until `stream()` is called. Sessions are created on-demand and their state lives server-side, keyed by `sessionId`. Creating provider objects at module load time is safe and preferred for fail-fast behavior.

---

## Migration Guide

### Before

```typescript
// Agent definition
const planner = agent({
  name: "planner",
  model: "claude-sonnet-4-5",
  output: PlanSchema,
  prompt: (state) => `Plan: ${state.goal}`,
  update: (output, draft) => { draft.tasks = output.tasks }
})

// Runtime
const result = await run(myWorkflow, {
  input: "Build an API",
  runtime: {
    providers: { "claude-sonnet-4-5": Anthropic({ model: "claude-sonnet-4-5" }) },
    mode: "live"
  }
})
```

### After

```typescript
// Provider creation (once, at module level)
const sonnet = Anthropic({ model: "claude-sonnet-4-5" })

// Agent definition
const planner = agent({
  name: "planner",
  provider: sonnet,           // ← Provider instance
  output: PlanSchema,
  prompt: (state) => `Plan: ${state.goal}`,
  update: (output, draft) => { draft.tasks = output.tasks }
})

// Runtime (no providers map!)
const result = await run(myWorkflow, {
  input: "Build an API",
  mode: "live"
})
```

### Variant Creation

```typescript
// Create variant with different provider
const opus = Anthropic({ model: "claude-opus-4-5" })
const withOpus = myWorkflow.with({
  agents: { planner: { ...planner, provider: opus } }
})
```

---

## Implementation Dependencies

This ADR enables but does not implement the full eval variant system:

| Dependency | Status | Notes |
|------------|--------|-------|
| `workflow.with()` API | **Not implemented** | Specified in `eval-system-design.md`. Required for creating variants. |
| Provider packages update | **Required** | Anthropic, Codex providers must expose `model` and `config` properties |
| AgentDef interface change | **Required** | Change `model: string` → `provider: AgentProvider` |

**Implementation order:**
1. Update `AgentProvider` interface (add `model`, `config`)
2. Update provider packages to return new interface
3. Update `AgentDef` interface (`provider` instead of `model`)
4. Delete `ProviderRegistry` and related code
5. Implement `workflow.with()` (separate work, part of eval system)

---

## Related Files

- `packages/core/src/Engine/agent.ts` — AgentDef interface (to modify)
- `packages/core/src/Engine/provider.ts` — ProviderRegistry (to delete)
- `packages/core/src/Domain/Provider.ts` — AgentProvider interface (to modify)
- `packages/core/src/Domain/Hash.ts` — Hash computation (unchanged)
- `packages/core/src/Services/ProviderMode.ts` — Mode context (unchanged)
- `docs/plans/eval-system-design.md` — Eval system requirements

---

## References

- [Eval System Design](../eval-system-design.md) — Original agent-owns-provider specification
- [ADR-001: Execution API](./001-execution-api.md) — Runtime config structure
- [ADR-006: State Sourcing Model](./006-state-sourcing-model.md) — Recording/playback architecture
