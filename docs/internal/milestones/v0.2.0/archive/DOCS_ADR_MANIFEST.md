# Documentation Restructure ADR Manifest

**Date:** 2026-01-08
**Status:** ✅ All decisions made - BLOCKING on SDK DX cleanup
**Branch:** `v0.2.0/stabilization`

---

## Quick Summary

| ADR | Topic | Decision |
|-----|-------|----------|
| 001 | Doc Structure | **Full Restructure** to outcome-first |
| 002 | Hub Term | **Remove entirely** → use Runtime |
| 003 | 0.2.0 Content | **Delete dir**, use as reference for gaps |
| 004 | Entry Points | **Unify to single run()** - SDK work first |
| 005 | Quickstart | **Full rewrite** with claude.agent |
| 006 | Fabricated | **Delete all** fabricated content |
| 007 | New Content | **All recommended** (~20h) |
| 008 | Framework QS | **Both** Bun + Node.js |
| 009 | Threading | **Full 7 levels** |
| 010 | Blocking | **Block on SDK DX** - fix API first, then docs |

---

## Decisions Made

### ADR-001: Documentation Structure ✅
**Decision:** Full Restructure (outcome-first)
- New structure: Getting Started / Build / Production / Connect / Reference / Understand
- Replace Diátaxis (Learn/Guides/Reference/Concepts)

### ADR-002: Hub Terminology ✅
**Decision:** Remove Hub entirely
- Replace all "Hub" references with "Runtime"
- No fictional concepts in docs

### ADR-003: v0.2.0 Content Migration ✅
**Decision:** Delete 0.2.0/ directory
- Don't copy incomplete content
- Use it as reference for what gaps exist

### ADR-004: Entry Point Strategy ✅
**Decision:** Unify to single `run()` function
- SDK DX audit completed (see `docs-audit/sdk-dx-issues.yaml`)
- Three entry points → single `run(flow, input)` with options for more control
- Runtime/Harness become internal details, not user-facing concepts
- Story becomes: define flow → run() → withRecording() → defineSuite()
- **This is SDK work, not docs work** - docs will follow the cleaner API

### ADR-005: Quickstart Content ✅
**Decision:** Full rewrite with actual claude.agent
- Use Level 1 from threaded example
- Users came for AI orchestration

### ADR-006: Fabricated Content ✅
**Decision:** Delete all fabricated content
- Remove custom-channels.mdx
- Remove references to http.get/post, map, delay nodes
- Only document what exists

### ADR-007: New Content Scope ✅
**Decision:** All recommended content (~20h)
- Troubleshooting page
- Framework quickstarts (Bun, Node.js)
- Recording guide
- Eval reference pages

### ADR-008: Framework Quickstarts ✅
**Decision:** Create both (implied by ADR-007)
- bun.mdx
- nodejs.mdx

### ADR-009: Threaded Example ✅
**Decision:** Full 7 levels
- "Code Review Assistant" example
- Builds complexity across all docs

### ADR-010: Blocking Strategy ✅
**Decision:** Block on SDK DX
- Pause full docs restructure until SDK DX is cleaned up
- Fix API first (unify entry points, standardize syntax, hide internals)
- Then write docs for the clean API
- **Rationale**: Documenting a fragmented API just creates more rewrite work later

---

## Already Completed (Before ADR Session)

- [x] `@open-harness/sdk` → correct packages (all docs)
- [x] `{{ nodes.X.output.Y }}` → `{{ X.Y }}` binding syntax
- [x] File renames: hub→runtime, agent→node-types, channel→transport
- [x] SqliteRunStore({ filename: }) constructor syntax
- [x] Broken internal links fixed
- [x] meta.json updated

---

## Key Audit Findings (Reference)

**Grade:** C (not shippable)
**Broken examples:** 22 of 87

**Top 10 Issues:**
1. Quickstart doesn't use Claude
2. Zero troubleshooting docs
3. 22 broken code examples (fabricated APIs)
4. Binding syntax inconsistent
5. Hub vs Runtime confusion
6. Three entry points without guidance
7. @open-harness/sdk doesn't exist
8. Built-in node types fabricated
9. No progressive example threading
10. Auth undocumented

---

## Files to Delete

- `guides/channels/custom-channels.mdx` - fabricated API
- `0.2.0/` directory - scaffolding only

## Files to Rewrite (P0)

- `learn/quickstart.mdx` - fake hello.agent
- `guides/channels/websocket.mdx` - createHub doesn't exist
- `guides/agents/custom-agents.mdx` - defineAgent doesn't exist
- `concepts/architecture.mdx` - Hub concept doesn't exist

## New Files Needed

- `getting-started/troubleshooting.mdx`
- `getting-started/bun.mdx`
- `getting-started/nodejs.mdx`
- `production/recording.mdx`
- `reference/eval/assertions.mdx`
- `reference/eval/gates.mdx`
- `reference/eval/scorers.mdx`

---

## SDK DX Work (Blocks Docs Restructure)

Based on ADR-010, docs restructure is blocked until these SDK issues are resolved.

### P0 - Must Fix Before Docs

1. **Unify entry points** - `runFlow`/`createHarness`/`createRuntime` → single `run()`
2. **Fix expression paths** - Pick ONE: `{{ nodeId.field }}` everywhere
3. **Standardize edge conditions** - Pick ONE: `when` (matches GitHub Actions, Temporal)
4. **Expression wrapper rules** - Document clearly: `{{ }}` for interpolation, naked for conditions

### P1 - Should Fix Before Docs

5. **Hide Hub from public API** - Remove from docs, don't export
6. **Simplify registry** - Accept only objects/arrays, hide NodeRegistry class
7. **Unify node interfaces** - `NodeTypeDefinition.run()` only, not `AgentDefinition.execute()`

### Reference

- Full SDK DX audit: `docs-audit/sdk-dx-issues.yaml`
- v0.3.0 backlog generated with 11 items
- Stripe grade: C+ (not yet shippable)

---

## Workflow After ADR-010

1. ✅ P1 fixes completed (imports, renames, binding syntax)
2. ⏳ **SDK DX cleanup** ← CURRENT BLOCKER
3. ⏳ Delete fabricated content
4. ⏳ Full docs restructure with clean API
5. ⏳ Create threaded example
6. ⏳ New content (troubleshooting, quickstarts, etc.)

---

*Updated 2026-01-08 - All ADRs decided, blocking on SDK DX cleanup*
