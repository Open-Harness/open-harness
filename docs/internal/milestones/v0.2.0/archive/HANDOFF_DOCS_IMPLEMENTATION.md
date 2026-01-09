# Handoff: Documentation Implementation

**Date:** 2026-01-08
**Previous Phase:** Documentation Audit (Complete)
**Current Phase:** Documentation Implementation (Ready to Start)
**Branch:** `v0.2.0/stabilization`

---

## Context

The v0.2.0 documentation restructure audit is **complete**. Six parallel analysis agents audited all documentation across content quality, user journey, examples, SDK DX, competitive patterns, and v0.2.0 feature integration.

**Key Finding:** Documentation is blocking v0.2.0 release. 22 of 87 code examples are broken. The quickstart doesn't use Claude. Import paths reference a package that doesn't exist.

**Overall Grade:** C (not shippable)

---

## Audit Deliverables Location

All audit outputs are in `docs/internal/milestones/v0.2.0/docs-audit/`:

| File | Purpose |
|------|---------|
| `AUDIT_SUMMARY.md` | Executive summary - top 10 issues |
| `PRIORITY_ORDER.md` | P0/P1/P2 work breakdown with estimates |
| `MIGRATION_PLAN.md` | File-by-file actions |
| `NEW_STRUCTURE.md` | Proposed outcome-first doc tree |
| `EXAMPLE_THREAD.md` | 7-level progressive example design |
| `WRITING_GUIDE.md` | Standards for writing |
| `content-audit.yaml` | Per-file quality scores |

---

## Your Mission

Implement the P0 critical fixes from the audit. Users cannot succeed with current docs.

### P0 Tasks (Must Complete)

#### 1. Delete Fabricated Content
```bash
rm apps/docs/content/docs/guides/channels/custom-channels.mdx
```

#### 2. Move Non-v0.2.0 Content to Future
```bash
mkdir -p apps/docs/content/future
mv apps/docs/content/0.2.0/02-architecture/telemetry.md apps/docs/content/future/
mv apps/docs/content/0.2.0/03-patterns/skills-pattern.md apps/docs/content/future/
mv apps/docs/content/0.2.0/03-patterns/scripts-pattern.md apps/docs/content/future/
```

#### 3. Create Troubleshooting Page
Create `apps/docs/content/docs/learn/troubleshooting.mdx` with common errors and solutions. This is the #2 friction point.

#### 4. Rewrite Quickstart
Rewrite `apps/docs/content/docs/learn/quickstart.mdx`:
- Use actual `claude.agent` not fake `hello.agent`
- Fix imports to `@open-harness/server` not `@open-harness/sdk`
- Use Level 1 from `EXAMPLE_THREAD.md`

#### 5. Rewrite WebSocket Guide
Rewrite `apps/docs/content/docs/guides/channels/websocket.mdx`:
- Remove `createHub()`, `WebSocketChannel`, `registerChannel()` - they don't exist
- Use actual `WebSocketTransport` API from SDK

#### 6. Rewrite Custom Agents Guide
Rewrite `apps/docs/content/docs/guides/agents/custom-agents.mdx`:
- Remove `AgentDefinition`, `defineAgent()`, `AgentContext` - they don't exist
- Use `NodeTypeDefinition` with `run()` method

#### 7. Rewrite Architecture
Rewrite `apps/docs/content/docs/concepts/architecture.mdx`:
- Remove Hub concept - it doesn't exist in SDK
- Center on Runtime as the execution engine

---

## Global Syntax Fixes

After P0 rewrites, apply these fixes across ALL docs:

| Find | Replace | Reason |
|------|---------|--------|
| `{{ nodes.X.output.Y }}` | `{{ X.Y }}` | Wrong binding syntax |
| `condition:` (on edges) | `when:` | Wrong field name |
| `@open-harness/sdk` | `@open-harness/server` or `@open-harness/core` | Package doesn't exist |
| `hub.subscribe(` | `runtime.onEvent(` | API doesn't exist |
| `SqliteRunStore("` | `SqliteRunStore({ filename: "` | Wrong constructor |

---

## Reference: Actual SDK Exports

From `packages/internal/core/src/index.ts` and `packages/sdk/src/index.ts`:

**Core:**
- `parseFlowYaml` - Parse YAML to FlowDefinition
- `InMemoryRunStore` - Memory-based persistence
- Runtime event types

**Server:**
- `runFlow` - Simple one-shot execution
- `createHarness` - Full harness with options
- `createRuntime` - Low-level runtime creation
- `WebSocketTransport` - WebSocket transport (not Channel)

**NOT exported (fabricated in docs):**
- `createHub` ❌
- `WebSocketChannel` ❌
- `defineAgent` ❌
- `AgentDefinition` ❌
- `recordRun` / `replayRun` ❌

---

## Success Criteria

P0 complete when:
- [ ] `custom-channels.mdx` deleted
- [ ] Quickstart uses `claude.agent` with correct imports
- [ ] No `hub.subscribe()` in any docs
- [ ] No `{{ nodes.X.output.Y }}` binding syntax anywhere
- [ ] Troubleshooting page exists with common errors
- [ ] Architecture page doesn't mention Hub

---

## Estimated Effort

| Priority | Hours |
|----------|-------|
| P0 (Critical) | 15h |
| P1 (High) | 17h |
| P2 (Polish) | 17h |

**Recommendation:** Complete P0 in one focused session. P1 can be split. P2 is post-release.

---

## Key Files to Read First

1. `docs/internal/milestones/v0.2.0/docs-audit/AUDIT_SUMMARY.md` - Top 10 issues
2. `docs/internal/milestones/v0.2.0/docs-audit/EXAMPLE_THREAD.md` - The Level 1-7 examples to use
3. `packages/sdk/src/index.ts` - What's actually exported

---

## Don't Forget

- **Test every code example** before committing - the broken examples are the core problem
- **Use `bun run typecheck`** to verify imports
- **Follow WRITING_GUIDE.md** for voice, terminology, callout patterns
- **Push when done** - run `bd sync && git push`
