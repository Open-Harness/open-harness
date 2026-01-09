# Eval Architecture History Summary

This short history is for the team (and for any future agent) so we can understand how the hybrid eval architecture evolved before we finish and publish it. Use it as reference while working from `EVAL_COMPLETION_PLAN.md`.

## 1. Foundations (Provider + Runtime clean break)
- **Document**: `.factory/docs/PROVIDER_CLEAN_BREAK_IMPLEMENTATION_PLAN.md`
- **What happened**: Removed the old inbox/session cruft, simplified `NodeRunContext`, plugged runtime directly into `RunStore` snapshots, and documented phases 1‑5 (core abstractions, state cleanup, clean break, recording infrastructure, template provider). This was the first “clean slate” after which evals could be built.

## 2. Eval concept exploration
- **Document**: `.factory/docs/2026-01-07-eval-architecture-options-provider-workflow-level.md`
- **What happened**: Explored five options (post-hoc pipeline, hooks, datasets, multi-level engine, hybrid). Hybrid (Option E) was marked as recommended. It also sketched scorer APIs, dataset/runner flows, and hooks, giving the first full evaluation “vision”.

## 3. Planning bookkeeping
- **Document**: `.factory/docs/2026-01-07-scrum-master-mode-epic-planning-dependency-architecture.md`
- **What happened**: Described the “Epic + Beads” process for the broader project (transport → persistence → server → final pass). Provides meta-level guidance on orchestrating future work.

## 4. Final canonical plan
- **Document**: `.factory/docs/EVAL_COMPLETION_PLAN.md`
- **What happened**: Consolidated the hybrid architecture decisions, locked down deterministic recording IDs + `recording:linked`, documented file layouts, dataset schema, phases 6‑8, validation, landing checklist, and future artifact ideas. This is our current master plan.

## Next time you work here
1. Start from `EVAL_COMPLETION_PLAN.md` — it now contains the “locked” decisions, folder layout, scripts, fixture expectations, and checklist.
2. Refer back to the archived docs above if you need the reasoning behind the hybrid decision or the clean break.
3. Keep this summary updated if any new structural doc appears; it should stay a living pointer to the “why” behind the current plan.
