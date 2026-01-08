# Documentation Audit Summary

**Date:** 2026-01-08
**Phase:** Fan-In Synthesis
**Auditors:** 6 parallel analysis agents (Claude Opus 4.5)

---

## What Sucks (Top 10)

### 1. Quickstart Doesn't Use Claude (Critical)
Users came to orchestrate AI agents. First example has no AI. They bounce.
- **Location:** `learn/quickstart.mdx`
- **Quote:** `const helloAgent = { type: 'hello.agent' as const, run: async (_ctx, input) => ({ message: \`Hello, ${input.name}!\` }) }`
- **Fix:** Replace hello.agent with claude.agent that actually calls Claude

### 2. Zero Troubleshooting Documentation (Critical)
First error sends users to Google with no docs to reference. They abandon.
- **Location:** Missing entirely
- **Fix:** Create `learn/troubleshooting.mdx` with common errors and solutions

### 3. API Examples Use Non-Existent Functions (Critical)
22 of 87 code examples are broken - they reference APIs that don't exist.
- **Location:** Multiple files
- **Broken APIs:** `createHub()`, `WebSocketChannel`, `registerChannel()`, `defineAgent()`, `hub.subscribe()`, `recordRun()`, `replayRun()`
- **Impact:** Copy-paste fails, users lose confidence immediately

### 4. Expression Binding Syntax Inconsistent (High)
Docs show `{{ nodes.X.output.Y }}` but actual syntax is `{{ X.Y }}`.
- **Location:** `guides/flows/control-flow.mdx`, `concepts/design-decisions/graph-first.mdx`, `reference/types/edge-definition.mdx`
- **Fix:** Audit all pages, standardize on `{{ nodeId.field }}`

### 5. Hub vs Runtime Terminology Confusion (High)
Docs refer to "Hub" as central coordinator but actual SDK has no Hub class.
- **Location:** `concepts/architecture.mdx`, `concepts/event-system.mdx`, `guides/channels/websocket.mdx`
- **Quote:** `hub.subscribe("agent:text", ...)` - this API doesn't exist
- **Fix:** Replace Hub references with Runtime or remove entirely

### 6. Three Entry Points Without Guidance (High)
`runFlow()` vs `createHarness()` vs `createRuntime()` - users don't know which to use.
- **Location:** `reference/api/hub.mdx` (shows all three)
- **Fix:** Single entry point with progressive disclosure, or clear decision tree

### 7. @open-harness/sdk Package Doesn't Exist (High)
All import examples use a package that doesn't exist.
- **Location:** Every file with imports
- **Actual packages:** `@open-harness/core`, `@open-harness/server`, `@open-harness/run-store-sqlite`
- **Fix:** Create facade package or update all imports to actual packages

### 8. Built-in Node Types Fabricated (Medium)
Docs list `http.get`, `http.post`, `map`, `delay` as built-in but they don't exist.
- **Location:** `reference/types/node-definition.mdx`, `guides/flows/control-flow.mdx`, `guides/expressions/iteration.mdx`
- **Actual built-ins:** Only `claude.agent`, `echo`, `constant`
- **Fix:** Remove references or implement the nodes

### 9. No Progressive Example Threading (Medium)
87 examples across docs but zero continuity. Each page starts fresh.
- **Location:** All of `learn/` section
- **Impact:** Users can't build mental model of growing complexity
- **Fix:** Implement "Code Review Assistant" threaded example

### 10. Authentication Completely Undocumented (Medium)
Users don't know if they need API key, how to set it, or if Claude Code auth works.
- **Location:** Missing entirely
- **Fix:** Add auth section to quickstart or dedicated auth page

---

## What's Good (Keep These)

### Reference Documentation
- `reference/api/events.mdx` - Score 4.4: Comprehensive, accurate event types
- `reference/api/run-store.mdx` - Score 4.0: Interface matches SDK
- `reference/expressions/functions.mdx` - Score 4.2: Complete function reference
- `reference/expressions/syntax.mdx` - Score 4.2: Clear operator tables

### Expression Guides
- `guides/expressions/bindings.mdx` - Score 4.2: Good troubleshooting section
- `guides/expressions/conditionals.mdx` - Score 4.0: Clear edge vs node distinction
- `guides/expressions/iteration.mdx` - Score 4.0: Practical examples

### Concept Explanations
- `concepts/expressions.mdx` - Score 4.2: Clear JSONata benefits
- `concepts/why-jsonata.mdx` - Score 4.0: Good rationale

### v0.2.0 Features
- **Evals:** DX layer (`defineSuite`, `variant`, `gates`) is mature, well-documented, ready to ship
- **Starter Kit:** Excellent working reference implementation

---

## SDK Issues Surfaced (v0.3.0 Backlog)

These documentation problems reveal underlying API design issues:

### P0: Must Fix
1. **Unify entry points** - Replace runFlow/createHarness/createRuntime with single `run()` function
2. **Fix binding path consistency** - Pick ONE form and use it everywhere
3. **Standardize edge condition field** - Pick 'when' or 'condition', deprecate other

### P1: Should Fix
1. **Hide Hub from public API** - It's an internal concept leaking to users
2. **Provide built-in debugging** - `debug: true` option that provides human-readable output
3. **Add flow validation** - `validateFlow()` to catch errors before runtime
4. **Create @open-harness/sdk facade** - Re-export everything for simpler imports

### P2: Nice to Have
1. **Document error handling patterns** - Retry, fallback, recovery flows
2. **Simplify persistence API** - `createHarness({ persist: './data' })` instead of RunStore creation
3. **Type inference from YAML** - Generate TS types or provide typed builders

---

## Overall Grade: C

### Justification

| Dimension | Score | Assessment |
|-----------|-------|------------|
| Content Quality | 3.4/5 | Inconsistent - some excellent, some fabricated |
| User Journey | 2.5/5 | Critical friction in first 5 minutes |
| Example Quality | 2.6/5 | 25% broken, 0% threaded |
| SDK DX | 3.0/5 | Multiple entry points, leaky abstractions |
| v0.2.0 Features | 3.5/5 | Evals ready, others need work |

**Stripe Test:** Would Stripe ship these docs? **No.** Stripe's APIs have one obvious way to do things. We have three entry points, two edge condition syntaxes, and fabricated APIs that will break on first use.

**Bottom Line:** The foundation is solid (expression system, event types, eval DX layer) but the user journey is broken. Users cannot copy-paste and succeed. Fix the P0 issues before release.

---

## Key Files by Priority

### P0: Must Fix Before Release (6 files)
1. `learn/quickstart.mdx` - Rewrite with actual Claude usage
2. `learn/multi-agent-flow.mdx` - Fix loop edge syntax, binding syntax
3. `concepts/architecture.mdx` - Remove Hub, use Runtime
4. `guides/channels/websocket.mdx` - Completely rewrite with actual API
5. `guides/channels/custom-channels.mdx` - Delete (fabricated API)
6. `guides/agents/custom-agents.mdx` - Rewrite with NodeTypeDefinition

### P1: Fix Soon (13 files)
Control-flow, persistence, deployment, expressions syntax docs

### P2: Polish Later (19 files)
Reference pages, concept explanations - minor enhancements only

---

## Recommendations

1. **Create threaded example** - "Code Review Assistant" that builds through all 7 levels
2. **Fix all imports** - Update to actual package paths or create facade
3. **Add troubleshooting** - Common errors with solutions
4. **Standardize syntax** - Audit and fix all binding/condition expressions
5. **Add auth docs** - Clear explanation of Claude Code subscription auth
6. **Numbered steps** - Tailwind-style Step 01, Step 02 progression
7. **Framework quickstarts** - Supabase-style "Open Harness + Bun", "Open Harness + Node"

---

*Generated by Fan-In Synthesis on 2026-01-08*
