# Handoff: P1 Documentation Fixes

**Date:** 2026-01-08
**Previous Phase:** P0 Critical Fixes (Complete)
**Current Phase:** P1 High-Priority Fixes
**Branch:** `v0.2.0/stabilization`

---

## Context

P0 is complete. The critical path (quickstart, architecture, websocket, custom-agents) now uses real APIs.

**Remaining:** 8 files still use `@open-harness/sdk`, 3 files have old binding syntax.

---

## Remaining Files with `@open-harness/sdk`

### Reference API Pages (need rewrite)

| File | Issue | Action |
|------|-------|--------|
| `reference/api/hub.mdx` | Hub doesn't exist | Rename to `runtime.mdx`, rewrite with actual Runtime API |
| `reference/api/channel.mdx` | Channel is internal | Rename to `transport.mdx`, rewrite with Transport interface |
| `reference/api/agent.mdx` | Uses defineAgent() | Rewrite with NodeTypeDefinition |
| `reference/api/node-registry.mdx` | Uses @open-harness/sdk | Fix imports to @open-harness/core |
| `reference/api/run-store.mdx` | Uses @open-harness/sdk | Fix imports, fix constructor syntax |

### Deployment Pages

| File | Issue | Action |
|------|-------|--------|
| `guides/deployment/production.mdx` | Wrong imports | Fix to @open-harness/server |
| `guides/deployment/persistence.mdx` | Wrong imports, SqliteRunStore syntax | Fix imports and constructor |
| `concepts/persistence.mdx` | Wrong imports | Fix to actual packages |

---

## Remaining Old Binding Syntax

| File | Issue |
|------|-------|
| `guides/expressions/bindings.mdx` | Mentions old syntax in troubleshooting (correct - it's documenting the wrong way) |
| `guides/expressions/iteration.mdx` | Uses `{{ nodes.X.output.Y }}` in examples |
| `guides/expressions/migration.mdx` | Uses old syntax in examples |
| `learn/troubleshooting.mdx` | Intentional - shows wrong syntax as error example |

**Fix:** Update iteration.mdx and migration.mdx to use `{{ X.Y }}` syntax.

---

## File Renames Needed

| Old | New | Reason |
|-----|-----|--------|
| `reference/api/hub.mdx` | `reference/api/runtime.mdx` | Hub doesn't exist |
| `reference/api/agent.mdx` | `reference/api/node-types.mdx` | Better reflects content |
| `reference/api/channel.mdx` | `reference/api/transport.mdx` | Channel is internal term |

After renaming, update `reference/api/meta.json` to reflect new names.

---

## Global Search & Replace

Run these across all docs:

```bash
# Find remaining @open-harness/sdk
grep -r "@open-harness/sdk" apps/docs/content/docs/

# Find remaining old binding syntax
grep -r "nodes\.\w\+\.output" apps/docs/content/docs/

# Find remaining hub.subscribe
grep -r "hub\.subscribe" apps/docs/content/docs/
```

---

## P1 New Content (Optional)

If time permits:

| File | Purpose | Est. |
|------|---------|------|
| `getting-started/bun.mdx` | Bun-specific quickstart | 2h |
| `getting-started/nodejs.mdx` | Node.js quickstart | 2h |
| `production/recording.mdx` | Recording/replay guide | 3h |

---

## Success Criteria

P1 complete when:
- [ ] No files import `@open-harness/sdk`
- [ ] No files use `{{ nodes.X.output.Y }}` (except troubleshooting examples)
- [ ] hub.mdx renamed to runtime.mdx
- [ ] channel.mdx renamed to transport.mdx
- [ ] All reference API pages use actual SDK exports

---

## Actual SDK Exports Reference

**@open-harness/server:**
- `runFlow()` - Simple one-shot execution
- `createHarness()` - Full harness with options
- `createRuntime()` - Low-level runtime creation
- `parseFlowYaml()` - Parse YAML to FlowDefinition
- `WebSocketTransport` - WebSocket transport
- `echoNode`, `constantNode` - Built-in nodes
- `SqliteRunStore` - Re-exported from run-store-sqlite

**@open-harness/core:**
- `parseFlowYaml()` - Parse YAML
- `DefaultNodeRegistry` - Node registry
- `InMemoryRunStore` - Memory-based persistence
- Event types, state types

**@open-harness/run-store-sqlite:**
- `SqliteRunStore` - SQLite persistence
- Constructor: `new SqliteRunStore({ filename: "./runs.db" })`

---

## Quick Fix Commands

```bash
# Stage all doc changes
git add apps/docs/content/

# Commit
git commit -m "docs: complete P1 fixes for v0.2.0 release"
```

---

*Generated 2026-01-08*
