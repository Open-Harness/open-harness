# Milestone 4: Polish

**Status:** Planned
**Goal:** Production-ready with docs, examples, and migration path.

---

## Exit Criteria

All must pass before v0.3.0 GA:

- [ ] Trading agent example is complete and tested
- [ ] Trading agent has README walkthrough
- [ ] External docs updated for signal-based paradigm
- [ ] Architecture overview accessible to new users
- [ ] Getting started guide works end-to-end
- [ ] Internal READMEs in all major folders
- [ ] Migration guide from v0.2.0 published
- [ ] `harnessToReactive()` adapter works
- [ ] All tests pass (unit, integration, E2E)
- [ ] No known bugs or regressions
- [ ] CHANGELOG updated

---

## Epics

| ID | Epic | Scope | Complexity |
|----|------|-------|------------|
| P1 | Trading Agent Example | Flagship example, full workflow | High |
| P2 | External Documentation | User-facing docs | Medium |
| P3 | Internal Documentation | READMEs, architecture diagrams | Medium |
| P4 | Migration Guide | v0.2.0 → v0.3.0 path | Medium |

---

## What Ships

At the end of Polish:

1. **Examples:**
   - `examples/trading-agent/` - Complete flagship example
   - `examples/simple-reactive/` - Minimal getting started
   - `examples/migration/` - Before/after migration

2. **Documentation:**
   - `apps/docs/content/0.3.0/` - Full external docs
   - `packages/*/README.md` - Internal docs
   - `docs/internal/architecture.md` - Updated diagrams

3. **Migration:**
   - `src/compat/harnessToReactive.ts` - Adapter
   - `docs/migration/v020-to-v030.md` - Guide

---

## Trading Agent Example Spec

The flagship example should demonstrate:

1. **Multiple agents:**
   - Market Analyst (analyzes data)
   - Risk Assessor (evaluates risk)
   - Trader (proposes trades)
   - Reviewer (approves/rejects)
   - Executor (executes approved trades)

2. **Signal-based flow:**
   - `flow:start` → Analyst + Risk (parallel)
   - `analysis:complete` → Trader
   - `trade:proposed` → Reviewer
   - `trade:approved` → Executor

3. **Zustand state:**
   - Portfolio (cash, positions)
   - Trades (history)
   - Analysis (current)
   - Decisions (log)

4. **Features demonstrated:**
   - Parallel execution
   - State-driven signals
   - Guard conditions
   - Recording/replay
   - Custom reporters

5. **Documentation:**
   - README with architecture diagram
   - Step-by-step walkthrough
   - Running instructions
   - Test examples

---

## Documentation Checklist

### External Docs (apps/docs)

- [ ] Architecture overview (signal-based)
- [ ] Getting started (reactive quickstart)
- [ ] Signals reference
- [ ] State management guide
- [ ] Recording/replay guide
- [ ] Migration guide
- [ ] API reference updates
- [ ] SpecKit tutorial update for reactive

### Internal Docs (packages)

- [ ] `packages/internal/core/README.md`
- [ ] `packages/internal/server/README.md`
- [ ] `packages/internal/client/README.md`
- [ ] `packages/open-harness/core/README.md`
- [ ] `packages/open-harness/server/README.md`
- [ ] `packages/stores/*/README.md`
- [ ] Architecture diagrams (Mermaid)

---

## Risks

| Risk | Mitigation |
|------|------------|
| Doc debt accumulation | Dedicated time per epic |
| Example complexity | Start simple, iterate |
| Migration edge cases | Comprehensive testing |

---

## Dependencies

- Milestone 3: Integration (all epics)

---

## Estimated Duration

2-3 weeks

---

## Definition of Done

v0.3.0 is ready for GA when:

1. All exit criteria checked
2. All tests green in CI
3. No critical or high bugs open
4. External docs reviewed and published
5. CHANGELOG updated with all changes
6. Migration guide tested by fresh install
7. Trading example runs successfully
8. Announcement draft prepared
