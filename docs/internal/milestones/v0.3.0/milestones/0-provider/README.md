# Phase 0: Provider Validation

**Status:** Planned
**Goal:** Validate provider abstraction with a second SDK before building signals.

---

## Why Phase 0?

If the Provider interface needs changes for OpenAI, we need to know BEFORE building 14 epics of signal infrastructure on top. Late discovery of abstraction flaws = expensive refactor.

**Risk mitigation**: Prove the abstraction with two real SDKs (Claude + OpenAI) before committing to signals.

---

## Exit Criteria

All must pass before moving to Foundation:

- [ ] `Provider<TInput, TOutput>` interface defined
- [ ] `ProviderInput` / `ProviderOutput` standard types defined
- [ ] `RunContext` with AbortSignal defined
- [ ] Claude provider migrated to new interface
- [ ] OpenAI Agents SDK provider implemented
- [ ] Both providers pass same test suite
- [ ] Per-agent provider override works
- [ ] Recording format works for both providers
- [ ] No regressions in existing functionality

---

## Epics

| ID | Epic | Scope | Complexity |
|----|------|-------|------------|
| P0-1 | Provider Interface Definition | New interface, Claude migration | Medium |
| P0-2 | OpenAI Provider Implementation | OpenAI Agents SDK, per-agent override | Medium |

---

## What Ships

At the end of Phase 0:

1. **New files:**
   - `src/providers/types.ts` - Provider interface, ProviderInput, ProviderOutput, RunContext
   - `src/providers/openai/openai.ts` - OpenAI Agents SDK provider

2. **Updated files:**
   - `packages/internal/server/src/providers/claude/` - Migrated to new interface

3. **Deleted files:**
   - `src/providers/trait.ts` - Replaced by Provider interface
   - `src/providers/adapter.ts` - No adapters needed
   - `src/nodes/registry.ts` - Providers passed directly

4. **Tests:**
   - Provider interface contract tests
   - Claude provider tests (migrated)
   - OpenAI provider tests
   - Per-agent provider override tests
   - Cross-provider recording/replay tests

---

## Provider Interface (from ARCHITECTURE.md)

```typescript
interface Provider<TInput = ProviderInput, TOutput = ProviderOutput> {
  /** Provider identifier: "claude", "openai" */
  readonly name: string;

  /** Input schema for validation */
  readonly inputSchema: ZodSchema<TInput>;

  /** Output schema for validation */
  readonly outputSchema: ZodSchema<TOutput>;

  /**
   * Execute and stream signals.
   * Generator yields signals as execution proceeds.
   * Returns final output when complete.
   */
  run(input: TInput, ctx: RunContext): AsyncGenerator<Signal, TOutput>;
}

interface RunContext {
  /** Abort signal for cancellation/pause */
  readonly signal: AbortSignal;

  /** Run ID for correlation */
  readonly runId: string;
}
```

---

## Standard Input/Output

```typescript
interface ProviderInput {
  prompt: string | Message[];
  sessionId?: string;
  outputSchema?: ZodSchema;
  options?: Record<string, unknown>;
}

interface ProviderOutput {
  text?: string;
  structured?: unknown;
  sessionId?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalCostUsd?: number;
  };
  paused?: boolean;
}
```

---

## Per-Agent Provider Override

The DX for per-agent provider selection:

```typescript
// Agent specifies provider
const analyst = agent({
  prompt: "...",
  provider: openai,  // Override
  activateOn: ["flow:start"],
});

// Agent uses default
const trader = agent({
  prompt: "...",
  // No provider → uses harness default
  activateOn: ["analysis:complete"],
});

// Harness provides default
const bot = createHarness({
  agents: { analyst, trader },
  defaultProvider: claude,  // Fallback
});
```

---

## Success Demo

```typescript
// This should work at end of Phase 0:

// Both providers implement same interface
const claudeProvider: Provider = claude;
const openaiProvider: Provider = openai;

// Same agent works with both
const analyst = agent({
  prompt: "Analyze: {{ input }}",
  outputSchema: z.object({ sentiment: z.string() }),
});

// Run with Claude
const claudeResult = await run(analyst, { input: "data" }, { provider: claude });

// Run with OpenAI (same agent!)
const openaiResult = await run(analyst, { input: "data" }, { provider: openai });

// Per-agent override
const mixed = createHarness({
  agents: {
    analyst: { ...analyst, provider: openai },  // OpenAI
    trader: agent({ prompt: "..." }),           // Default (Claude)
  },
  defaultProvider: claude,
});
```

---

## SDK Comparison

| Capability | Claude Agent SDK | OpenAI Agents SDK |
|------------|------------------|-------------------|
| Package | `@anthropic-ai/claude-agent-sdk` | `@openai/agents-js` |
| Session | `sessionId` | Thread ID / context |
| Streaming | SDK message stream | Real-time events |
| Tool execution | SDK handles internally | SDK handles internally |
| Resume | `options.resume = sessionId` | Pass context |

Both SDKs are stateful and agentic. The Provider interface abstracts these differences.

---

## Risks

| Risk | Mitigation |
|------|------------|
| OpenAI SDK API differences | Study SDK before implementing |
| Session handling differs | Abstract behind sessionId |
| Streaming format differs | Normalize to standard signals |
| Tool calling differs | Abstract behind tool signals |

---

## Dependencies

None - this is the first phase.

---

## Definition of Done

Phase 0 is complete when:

1. [ ] Provider interface implemented and documented
2. [ ] Claude provider migrated (no functionality regression)
3. [ ] OpenAI provider implemented
4. [ ] Both providers pass contract tests
5. [ ] Per-agent provider override works
6. [ ] Recording format works for both
7. [ ] No regressions in existing functionality
8. [ ] All tests green in CI
