# Documentation Migration Plan

**From:** Current Diátaxis structure + parallel 0.2.0 directory
**To:** Unified outcome-first structure

---

## Delete

| File | Reason |
|------|--------|
| `guides/channels/custom-channels.mdx` | Fabricated API that doesn't exist |
| `0.2.0/README.md` | Navigation doc for old structure |
| `0.2.0/03-patterns/skills-pattern.md` | Not implemented in v0.2.0 |
| `0.2.0/03-patterns/scripts-pattern.md` | Not implemented in v0.2.0 |

---

## Keep As-Is (P2 Quality)

| File | Reason |
|------|--------|
| `reference/api/events.mdx` | Score 4.4 - accurate, comprehensive |
| `reference/api/run-store.mdx` | Score 4.0 - interface matches SDK |
| `reference/api/node-registry.mdx` | Score 4.0 - clear method docs |
| `reference/api/flow-runtime.mdx` | Score 3.8 - mostly accurate |
| `reference/expressions/syntax.mdx` | Score 4.2 - clear operators |
| `reference/expressions/functions.mdx` | Score 4.2 - complete reference |
| `reference/expressions/context.mdx` | Score 4.0 - good examples |
| `concepts/expressions.mdx` | Score 4.2 - clear JSONata intro |
| `concepts/why-jsonata.mdx` | Score 4.0 - good rationale |
| `guides/expressions/bindings.mdx` | Score 4.2 - good troubleshooting |
| `guides/expressions/conditionals.mdx` | Score 4.0 - clear distinction |
| `guides/expressions/iteration.mdx` | Score 4.0 - practical examples |
| `guides/expressions/migration.mdx` | Score 3.8 - clear before/after |

---

## Rewrite (P0 + P1)

### P0: Critical - Block Release

| File | What's Wrong | What It Should Be |
|------|--------------|-------------------|
| `learn/quickstart.mdx` | Uses hello.agent not Claude, imports @open-harness/sdk which doesn't exist | Level 1 "Hello Reviewer" with actual claude.agent, correct imports |
| `learn/multi-agent-flow.mdx` | Loop edge syntax fabricated, binding syntax wrong, 'flow:' wrapper | Fix YAML schema, use `{{ nodeId.field }}` not `{{ nodes.X.output.Y }}` |
| `concepts/architecture.mdx` | Hub terminology doesn't exist in SDK, leaky abstractions | Runtime-centric explanation, hide Hub concept |
| `guides/channels/websocket.mdx` | createHub, WebSocketChannel, registerChannel don't exist | Actual WebSocketTransport API |
| `guides/agents/custom-agents.mdx` | AgentDefinition, defineAgent, AgentContext don't exist | NodeTypeDefinition with run() method |

### P1: High - Fix Soon

| File | What's Wrong | What It Should Be |
|------|--------------|-------------------|
| `learn/your-first-agent.mdx` | Misnamed (about branching, not agents), ctx.state signature | Rename to "Adding Branching", fix state API |
| `learn/persistence.mdx` | SqliteRunStore constructor wrong, recordRun/replayRun don't exist | Correct constructor `{ filename: string }`, remove fabricated APIs |
| `concepts/event-system.mdx` | hub.subscribe doesn't exist | runtime.onEvent() without pattern matching |
| `concepts/design-decisions/graph-first.mdx` | Binding syntax wrong | Fix to `{{ nodeId.field }}` |
| `guides/agents/claude-agent.mdx` | hub.subscribe pattern | runtime.onEvent() |
| `guides/deployment/persistence.mdx` | Store name inconsistency | Standardize InMemoryRunStore |
| `guides/deployment/production.mdx` | ANTHROPIC_API_KEY mentioned but not used | Clarify Claude Code auth |
| `guides/flows/control-flow.mdx` | 'condition' should be 'when', binding syntax wrong | Fix edge conditions, bindings |
| `reference/api/channel.mdx` | Title/filename mismatch | Rename to transport.mdx |
| `reference/schemas/flow-yaml.mdx` | Node types that don't exist | Remove http.get/post, map, delay |
| `reference/types/edge-definition.mdx` | 'condition' not 'when', binding syntax | Fix to actual schema |
| `reference/types/flow-definition.mdx` | Shows 'id' but actual uses 'name' | Fix to match Zod schema |
| `index.mdx` | YAML example has 'flow:' wrapper | Fix to flat structure |

---

## New Content Needed

### P0: Must Have

| File | Content | Source |
|------|---------|--------|
| `getting-started/troubleshooting.mdx` | Common errors, solutions, debug tips | New (top friction point) |

### P1: Should Have

| File | Content | Source |
|------|---------|--------|
| `getting-started/bun.mdx` | Bun-specific quickstart | Pattern from Supabase |
| `getting-started/nodejs.mdx` | Node.js-specific quickstart | Pattern from Supabase |
| `production/recording.mdx` | User-facing recording guide | `packages/internal/core/src/recording/README.md` |
| `reference/eval/assertions.mdx` | Assertion types lookup | `packages/internal/core/src/eval/README.md` |
| `reference/eval/gates.mdx` | Gate types lookup | `packages/internal/core/src/eval/dx.ts` |
| `reference/eval/scorers.mdx` | Scorer types lookup | `packages/internal/core/src/eval/README.md` |

### P2: Nice to Have

| File | Content | Source |
|------|---------|--------|
| `understand/philosophy.mdx` | Design principles | `0.2.0/01-foundations/zen.md` |

---

## Migrate from 0.2.0 Directory

### Keep & Move

| From | To | Changes |
|------|-----|---------|
| `0.2.0/01-foundations/zen.md` | `understand/philosophy.mdx` | Convert to MDX, excellent content |
| `0.2.0/01-foundations/philosophy.md` | `understand/philosophy.mdx` | Merge into above |
| `0.2.0/03-patterns/evals-pattern.md` | `production/evaluation.mdx` | Convert to MDX, remove duplicate Purpose section |
| `0.2.0/02-architecture/architecture.md` | Review for merge | Check for unique content |
| `0.2.0/02-architecture/providers.md` | `understand/providers.mdx` | Needs significant writing (outline only) |

### Move to Future

| From | To | Reason |
|------|-----|--------|
| `0.2.0/02-architecture/telemetry.md` | `future/telemetry.mdx` | v0.3.0 scope (OTel) |
| `0.2.0/03-patterns/skills-pattern.md` | `future/skills.mdx` | Not implemented |
| `0.2.0/03-patterns/scripts-pattern.md` | `future/scripts.mdx` | Not implemented |

### Needs Work Before Migration

| File | Issue |
|------|-------|
| `0.2.0/04-getting-started/quickstart.md` | Validate against v0.2.0 API |
| `0.2.0/04-getting-started/what-can-i-build.md` | Outline only - needs content |
| `0.2.0/04-getting-started/why-open-harness.md` | Outline only - needs content |
| `0.2.0/05-reference/getting-started.md` | Review for unique content |
| `0.2.0/05-reference/contributing.md` | Move to repo root if useful |

---

## Rename Files

| Old | New | Reason |
|-----|-----|--------|
| `reference/api/hub.mdx` | `reference/api/runtime.mdx` | Content is about Runtime |
| `reference/api/agent.mdx` | `reference/api/node-types.mdx` | Content is about NodeTypeDefinition |
| `reference/api/channel.mdx` | `reference/api/transport.mdx` | Content is about Transport |

---

## Syntax Standardization

### Fix Throughout All Files

| Wrong | Correct | Files Affected |
|-------|---------|----------------|
| `{{ nodes.X.output.Y }}` | `{{ X.Y }}` | ~15 files |
| `condition: "..."` | `when: "..."` | ~5 files |
| `@open-harness/sdk` | `@open-harness/core` or `@open-harness/server` | ~20 files |
| `hub.subscribe(...)` | `runtime.onEvent(...)` | ~5 files |
| `SqliteRunStore("./file")` | `SqliteRunStore({ filename: "./file" })` | ~3 files |
| `MemoryRunStore` | `InMemoryRunStore` | ~2 files |

---

## Implementation Steps

### Day 1: Critical Fixes
1. [ ] Delete `guides/channels/custom-channels.mdx`
2. [ ] Create `getting-started/troubleshooting.mdx` (stub)
3. [ ] Fix imports in `learn/quickstart.mdx`
4. [ ] Move telemetry/skills/scripts to `future/`

### Day 2: P0 Rewrites
1. [ ] Rewrite `learn/quickstart.mdx` with Level 1 example
2. [ ] Rewrite `guides/channels/websocket.mdx` with actual API
3. [ ] Rewrite `guides/agents/custom-agents.mdx` with NodeTypeDefinition

### Day 3: P0 Rewrites (continued)
1. [ ] Rewrite `concepts/architecture.mdx` (Runtime-centric)
2. [ ] Fix `learn/multi-agent-flow.mdx` syntax issues

### Day 4: P1 Fixes
1. [ ] Fix binding syntax in all affected files
2. [ ] Fix edge condition syntax ('condition' → 'when')
3. [ ] Fix import paths throughout
4. [ ] Rename hub.mdx → runtime.mdx, etc.

### Day 5: New Content
1. [ ] Write framework quickstarts (Bun, Node.js)
2. [ ] Migrate evals-pattern.md to production/evaluation.mdx
3. [ ] Write production/recording.mdx

### Day 6: Polish
1. [ ] Update navigation/meta.json
2. [ ] Add cross-references
3. [ ] Create example directory with threaded example
4. [ ] Test all code examples

### Day 7: Verification
1. [ ] Run typecheck on all code examples
2. [ ] Review user journey flow
3. [ ] Final navigation check

---

*Generated from Multi-Spectrum Analysis on 2026-01-08*
