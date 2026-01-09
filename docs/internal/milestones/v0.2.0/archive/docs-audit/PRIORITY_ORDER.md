# Documentation Priority Order

Ordered work list for v0.2.0 documentation restructure.

---

## P0: Must Fix Before Release

**These issues block v0.2.0.** Users cannot succeed with current docs.

### Critical Rewrites

| # | File | Issue | Est. |
|---|------|-------|------|
| 1 | `learn/quickstart.mdx` | Uses fake hello.agent, not Claude. Import path wrong. | 2h |
| 2 | `guides/channels/websocket.mdx` | createHub, WebSocketChannel don't exist | 3h |
| 3 | `guides/agents/custom-agents.mdx` | AgentDefinition, defineAgent don't exist | 2h |
| 4 | `concepts/architecture.mdx` | Hub concept doesn't exist in SDK | 3h |
| 5 | `learn/multi-agent-flow.mdx` | Loop edge syntax fabricated, bindings wrong | 2h |

### Critical New Content

| # | File | Purpose | Est. |
|---|------|---------|------|
| 6 | `getting-started/troubleshooting.mdx` | Top friction point: no error help exists | 3h |

### Critical Deletes

| # | File | Reason | Est. |
|---|------|--------|------|
| 7 | `guides/channels/custom-channels.mdx` | Entirely fabricated API | 5m |

**P0 Total: ~15h**

---

## P1: Should Fix Before Release

**These cause significant friction.** Users will struggle but can work around.

### High-Priority Fixes

| # | File | Issue | Est. |
|---|------|-------|------|
| 8 | `learn/your-first-agent.mdx` | Misnamed (about branching), state API wrong | 1h |
| 9 | `learn/persistence.mdx` | SqliteRunStore constructor wrong, recordRun doesn't exist | 1h |
| 10 | `concepts/event-system.mdx` | hub.subscribe doesn't exist | 1h |
| 11 | `concepts/design-decisions/graph-first.mdx` | Binding syntax wrong | 30m |
| 12 | `guides/agents/claude-agent.mdx` | hub.subscribe pattern | 30m |
| 13 | `guides/deployment/persistence.mdx` | Store name inconsistency | 30m |
| 14 | `guides/deployment/production.mdx` | API key confusion | 30m |
| 15 | `guides/flows/control-flow.mdx` | 'condition' → 'when', binding syntax | 1h |
| 16 | `reference/api/channel.mdx` | Rename to transport.mdx, fix content | 1h |
| 17 | `reference/schemas/flow-yaml.mdx` | Remove http.get/post/map/delay | 30m |
| 18 | `reference/types/edge-definition.mdx` | Fix 'condition' → 'when' | 30m |
| 19 | `reference/types/flow-definition.mdx` | Fix 'id' → 'name' | 30m |
| 20 | `index.mdx` | Fix YAML example | 30m |

### P1 New Content

| # | File | Purpose | Est. |
|---|------|---------|------|
| 21 | `getting-started/bun.mdx` | Framework-specific quickstart | 2h |
| 22 | `getting-started/nodejs.mdx` | Framework-specific quickstart | 2h |
| 23 | `production/recording.mdx` | User-facing recording guide | 3h |

### P1 Migrations

| # | From | To | Est. |
|---|------|-----|------|
| 24 | `0.2.0/03-patterns/evals-pattern.md` | `production/evaluation.mdx` | 1h |
| 25 | `0.2.0/01-foundations/zen.md` | `understand/philosophy.mdx` | 30m |

### P1 Renames

| # | Old | New | Est. |
|---|-----|-----|------|
| 26 | `reference/api/hub.mdx` | `reference/api/runtime.mdx` | 15m |
| 27 | `reference/api/agent.mdx` | `reference/api/node-types.mdx` | 15m |

**P1 Total: ~17h**

---

## P2: Polish After Release

**Nice to have.** These improve quality but don't block users.

### Minor Fixes

| # | File | Issue | Est. |
|---|------|-------|------|
| 28 | `reference/index.mdx` | Add "Getting Started" suggestion | 15m |
| 29 | `concepts/expressions.mdx` | Add $exists() mention | 15m |
| 30 | `concepts/persistence.mdx` | Fix async/sync methods | 30m |
| 31 | `guides/expressions/bindings.mdx` | Fix troubleshooting section | 30m |
| 32 | `reference/api/events.mdx` | Add event ordering docs | 30m |
| 33 | `reference/types/node-definition.mdx` | Add 'when', 'policy' docs | 30m |
| 34 | `reference/types/runtime-event.mdx` | Add 'usage' field | 30m |

### P2 New Content

| # | File | Purpose | Est. |
|---|------|---------|------|
| 35 | `reference/eval/assertions.mdx` | Assertion types lookup | 2h |
| 36 | `reference/eval/gates.mdx` | Gate types lookup | 1h |
| 37 | `reference/eval/scorers.mdx` | Scorer types lookup | 1h |

### Infrastructure

| # | Task | Purpose | Est. |
|---|------|---------|------|
| 38 | Create `/examples/code-review-assistant/` | Threaded example directory | 4h |
| 39 | Update all meta.json files | New navigation structure | 1h |
| 40 | Add "Next Steps" to all pages | Cross-linking | 2h |
| 41 | Test all code examples | Verify copy-paste works | 3h |

**P2 Total: ~17h**

---

## Global Fixes (Apply Throughout)

These fixes affect multiple files and should be done systematically.

### Syntax Standardization

| Search | Replace | Files |
|--------|---------|-------|
| `{{ nodes.*.output.* }}` | `{{ nodeId.field }}` | ~15 files |
| `condition:` (on edges) | `when:` | ~5 files |
| `@open-harness/sdk` | Actual package paths | ~20 files |
| `hub.subscribe(` | `runtime.onEvent(` | ~5 files |
| `SqliteRunStore("` | `SqliteRunStore({ filename: "` | ~3 files |
| `MemoryRunStore` | `InMemoryRunStore` | ~2 files |

### Future Directory

Move non-v0.2.0 content to `future/`:

| From | To |
|------|-----|
| `0.2.0/02-architecture/telemetry.md` | `future/telemetry.mdx` |
| `0.2.0/03-patterns/skills-pattern.md` | `future/skills.mdx` |
| `0.2.0/03-patterns/scripts-pattern.md` | `future/scripts.mdx` |

---

## Execution Order

### Day 1: P0 Critical (4h)
- [x] Delete `custom-channels.mdx`
- [ ] Create `troubleshooting.mdx` stub
- [ ] Move telemetry/skills/scripts to `future/`
- [ ] Fix imports in `quickstart.mdx`

### Day 2: P0 Rewrites (6h)
- [ ] Rewrite `quickstart.mdx` with Level 1
- [ ] Rewrite `websocket.mdx` with actual API
- [ ] Rewrite `custom-agents.mdx`

### Day 3: P0 Rewrites (5h)
- [ ] Rewrite `architecture.mdx`
- [ ] Fix `multi-agent-flow.mdx`
- [ ] Global: Fix binding syntax

### Day 4: P1 Fixes (6h)
- [ ] Fix P1 files (items 8-20)
- [ ] Global: Fix 'condition' → 'when'
- [ ] Global: Fix import paths

### Day 5: P1 New Content (7h)
- [ ] Write `bun.mdx`, `nodejs.mdx`
- [ ] Write `recording.mdx`
- [ ] Migrate `evals-pattern.md`

### Day 6: Navigation (4h)
- [ ] Rename files (hub→runtime, etc.)
- [ ] Update meta.json files
- [ ] Add cross-references

### Day 7: Verification (4h)
- [ ] Test all code examples
- [ ] Review user journey
- [ ] Final walkthrough

---

## Success Criteria

### P0 Complete When:
- [ ] Quickstart uses actual claude.agent
- [ ] All imports use real packages
- [ ] No fabricated APIs in critical path
- [ ] Troubleshooting page exists
- [ ] custom-channels.mdx deleted

### P1 Complete When:
- [ ] All binding syntax is `{{ nodeId.field }}`
- [ ] All edge conditions use `when:`
- [ ] Framework quickstarts exist
- [ ] Recording guide exists
- [ ] File renames complete

### P2 Complete When:
- [ ] Threaded example directory exists
- [ ] All pages have "Next Steps"
- [ ] Eval reference pages exist
- [ ] All code examples verified

---

## Total Effort

| Priority | Files | Estimated Hours |
|----------|-------|-----------------|
| P0 | 7 | 15h |
| P1 | 20 | 17h |
| P2 | 14 | 17h |
| **Total** | **41** | **49h** |

**Recommendation:** Complete P0 before any PR. P1 can be split across 2-3 PRs. P2 is post-release polish.

---

*Generated from Multi-Spectrum Analysis on 2026-01-08*
