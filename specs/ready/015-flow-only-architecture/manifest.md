# Flow-Only Architecture Manifest

## Continuation Prompt (for context reload)

```
You are working in /Users/abuusama/projects/dao/oh-feature-planning.
The canonical spec is specs/ready/015-flow-only-architecture/spec.md.
Docs impact is specs/ready/015-flow-only-architecture/docs-impact.md.
This repo is FlowRuntime-only. Legacy runtime is removed and must not appear anywhere
(docs, code, tests, fixtures, scripts, filenames).
Follow this manifest: each phase has explicit deliverables, verification steps,
and a mandatory retro with lessons learned before advancing.
Zero `any` is allowed anywhere (including tests). Biome must be clean (no warnings).
Typecheck must pass with zero errors.
```

---

## Purpose

This manifest is the shared contract for Flow-only implementation. It defines
scope, phases, deliverables, validation gates, documentation updates, and a
mandatory retro to prevent spec drift.

---

## Canonical Sources (Do Not Drift)

- Spec: `specs/ready/015-flow-only-architecture/spec.md`
- Docs impact checklist: `specs/ready/015-flow-only-architecture/docs-impact.md`
- Tutorials (authoritative): `specs/ready/015-flow-only-architecture/tutorials/`
- Kernel specs: `packages/kernel/docs/spec/*`, `packages/kernel/docs/flow/*`
- Implementation guide: `packages/kernel/docs/implementation/*`
- Test specs: `packages/kernel/tests/specs/*`

---

## Non-Negotiables

- FlowRuntime is the only runtime. Legacy runtime is removed.
- Specs are canonical. Code and docs must conform.
- Zero `any` anywhere, including tests.
- `bun run typecheck` passes with zero errors.
- `bun run lint` (Biome) has zero warnings and zero errors.
- Default tests are safe (unit + replay only).
- Every phase ends with a validated tutorial.
- Every phase ends with a retro section (lessons learned).

---

## Global Validation Gates

- `bun run typecheck` (zero errors)
- `bun run lint` (zero warnings/errors)
- `bun test` (safe, deterministic, no network, no writes)
- Phase live script passes
- Tutorial walkthrough matches expected outputs

---

## Documentation Impact Checklist (Must Be Completed)

Source: `specs/ready/015-flow-only-architecture/docs-impact.md`

- Update `packages/kernel/docs/README.md` for FlowRuntime-only architecture
- Update `packages/kernel/docs/flow/flow-spec.md` (edge `when`, node config, channels note)
- Update `packages/kernel/docs/flow/when.md` (edge evaluation context)
- Update `packages/kernel/docs/flow/execution.md` (runtime semantics, policy enforcement, edge routing)
- Update `packages/kernel/docs/flow/registry.md` (agent capabilities)
- Update `packages/kernel/docs/spec/agent.md` (runId, inbox, async prompt stream)
- Update `packages/kernel/docs/spec/channel.md` (channels are attachments)
- Update `packages/kernel/docs/reference/protocol-types.md` (Edge `when`, isAgent flag)
- Add/confirm `packages/kernel/docs/spec/flow-runtime.md` (canonical runtime doc)
- Add/confirm `packages/kernel/docs/flow/node-catalog.md`
- Update testing docs to cover FlowRuntime fixtures and gates

---

## Legacy Runtime Removal Checklist (Hard Requirement)

- Delete legacy runtime implementation, tests, fixtures, scripts, and docs
- Remove all legacy runtime references from roadmap, traceability, and test specs
- Replace with FlowRuntime references (test specs and scripts as needed)
- Ensure default scripts and CI do not reference legacy runtime
- Verify no remaining references via repo search

---

## Phase Template (Mandatory Fields)

For every phase below, we must include:

- Scope (specs + test specs)
- Deliverables (code/tests/fixtures/scripts/tutorial)
- Verification steps (exact commands)
- Acceptance criteria (what "done" means)
- Retro (lessons learned, risks, follow-ups)

---

## Phases (Aligned to spec.md Phase 1–6)

### Phase 1: FlowRuntime + Lifecycle

- Scope
  - `specs/ready/015-flow-only-architecture/spec.md` (Phase 1)
  - `packages/kernel/docs/spec/flow-runtime.md`
  - `packages/kernel/docs/spec/events.md`
  - `packages/kernel/tests/specs/events.test-spec.md`
  - `packages/kernel/tests/specs/hub.test-spec.md`
- Deliverables
  - FlowRuntime factory and lifecycle
  - Hub + event envelope implementation
  - Phase/task helpers
  - Unit + replay tests + fixtures
  - Live script: `scripts/live/flow-runtime-live.ts`
  - Tutorial: Lessons 01–05
- Tutorial Migration Checklist
  - Update Lessons 01–05 to use FlowRuntime APIs (no legacy runtime)
  - Run `bun run lesson:01` through `bun run lesson:05`
  - Confirm outputs match tutorial specs
- Verification Steps
  - `bun run typecheck`
  - `bun run lint`
  - `bun test`
  - `bun scripts/live/flow-runtime-live.ts`
- Acceptance Criteria
  - Emits `harness:*`, `phase:*`, `task:*` events via Hub
  - Context propagation correct
  - Tutorial lessons 01–05 pass
- Retro (mandatory)
  - Lessons learned: Tutorial runner needed a FlowRuntime wrapper to replace legacy runtime usage; core lessons 01–05 run clean after swap.
  - Risks discovered: None observed in lessons 01–05; broader lint/typecheck/test gates still pending.
  - Follow-ups: Run Phase 1 verification commands (`bun run typecheck`, `bun run lint`, `bun test`, live script).

---

### Phase 2: Edge-Level `when`

- Scope
  - `specs/ready/015-flow-only-architecture/spec.md` (Phase 2)
  - `packages/kernel/docs/flow/flow-spec.md`
  - `packages/kernel/docs/flow/when.md`
  - `packages/kernel/docs/flow/execution.md`
  - `packages/kernel/tests/specs/flow.test-spec.md`
- Deliverables
  - Edge `when` schema + validation
  - Edge routing in executor
  - Unit + replay tests + fixtures
  - Live script: `scripts/live/flow-edge-routing-live.ts`
  - Tutorial: Lessons 01–05 (edge/when examples)
- Tutorial Migration Checklist
  - Re-run Lessons 01–05 after edge changes
  - Confirm outputs match tutorial specs
- Verification Steps
  - `bun run typecheck`
  - `bun run lint`
  - `bun test`
  - `bun scripts/live/flow-edge-routing-live.ts`
- Acceptance Criteria
  - Edge gating works; readiness rules enforced
  - Tutorial lessons 01–05 pass
- Retro (mandatory)
  - Lessons learned: Edge-level `when` needed runtime edge state tracking; a dedicated unit test prevents regressions.
  - Risks discovered: None observed in Phase 2 changes; sequential scheduling still assumes all incoming edges resolved.
  - Follow-ups: Keep edge readiness logic aligned if/when parallel scheduling or control.merge is added.

---

### Phase 3: Policy Enforcement

- Scope
  - `specs/ready/015-flow-only-architecture/spec.md` (Phase 3)
  - `packages/kernel/docs/flow/execution.md`
  - `packages/kernel/tests/specs/flow.test-spec.md`
- Deliverables
  - Timeout + retry + continueOnError + failFast enforcement
  - Unit + replay tests + fixtures
  - Live script: `scripts/live/flow-policy-live.ts`
  - Tutorial: add policy lesson (or extend existing)
- Tutorial Migration Checklist
  - Update policy lesson (or extension) to FlowRuntime APIs
  - Run required lesson(s) and confirm outputs match tutorial specs
- Verification Steps
  - `bun run typecheck`
  - `bun run lint`
  - `bun test`
  - `bun scripts/live/flow-policy-live.ts`
- Acceptance Criteria
  - Policy semantics match spec
  - Tutorial lesson covers retry/timeout/continueOnError
- Retro (mandatory)
  - Lessons learned: Policy enforcement fits cleanly inside the executor with retry/timeout helpers and explicit error markers.
  - Risks discovered: Timeouts leave underlying work running (Promise.race). Long-running nodes should be written to tolerate that.
  - Follow-ups: Keep error marker shape stable and documented; add cancellation support if/when runtime supports it.

---

### Phase 4: Claude + Multi-Turn Agents

- Scope
  - `specs/ready/015-flow-only-architecture/spec.md` (Phase 4)
  - `packages/kernel/docs/spec/agent.md`
  - `packages/kernel/docs/flow/registry.md`
- Deliverables
  - Claude adapter using V2 SDK: `unstable_v2_createSession()`
  - Session-based send/receive pattern (no async prompt stream)
  - Agent event emission (`agent:*`, `agent:tool:*`)
  - Unit + replay tests + fixtures
  - Live script: `scripts/live/flow-agent-nodes-live.ts`
  - Tutorials: Lesson 06 (PromptFile + Claude) and Lesson 09 (Multi-Turn)
- Tutorial Migration Checklist
  - Update Lessons 06 and 09 to FlowRuntime APIs
  - Run `bun run lesson:06` and `bun run lesson:09`
  - Confirm outputs match tutorial specs
- Verification Steps
  - `bun run typecheck`
  - `bun run lint`
  - `bun test`
  - `bun scripts/live/flow-agent-nodes-live.ts`
- Acceptance Criteria
  - Agent nodes use V2 session pattern
  - runId fresh per invocation
  - Multi-turn via Hub event subscription
  - Clean session termination (no hangs)
  - Lessons 06 and 09 pass
- Retro (mandatory)
  - Lessons learned:
  - Risks discovered:
  - Follow-ups:

---

### Phase 5: Flow Loader Extensions

- Scope
  - `specs/ready/015-flow-only-architecture/spec.md` (Phase 5)
  - `packages/kernel/docs/flow/flow-spec.md`
- Deliverables
  - `nodePacks` allowlist enforcement
  - `promptFile` loader support
  - Unit + replay tests + fixtures
  - Live script: `scripts/live/flow-loader-live.ts`
  - Tutorial: any lesson that uses nodePacks + promptFile
- Tutorial Migration Checklist
  - Update nodePacks/promptFile lessons to FlowRuntime APIs
  - Run required lesson(s) and confirm outputs match tutorial specs
- Verification Steps
  - `bun run typecheck`
  - `bun run lint`
  - `bun test`
  - `bun scripts/live/flow-loader-live.ts`
- Acceptance Criteria
  - Loader resolves promptFile relative to YAML
  - nodePacks enforced via `oh.config.ts`
  - Tutorial coverage validated
- Retro (mandatory)
  - Lessons learned:
  - Risks discovered:
  - Follow-ups:

---

### Phase 6: Legacy Runtime Removal Verification (Final)

- Scope
  - `specs/ready/015-flow-only-architecture/spec.md` (Phase 6)
  - Docs impact + removal checklists
- Deliverables
  - All legacy runtime code/docs/tests/fixtures/scripts removed
  - All references removed from repo
  - Tutorial suite validated
- Tutorial Migration Checklist
  - Update Lessons 01–05, 07–08, 10–14 to FlowRuntime APIs
  - Run full tutorial suite and confirm outputs match tutorial specs
- Verification Steps
  - `bun run typecheck`
  - `bun run lint`
  - `bun test`
  - Run full tutorial suite (Lessons 01–05, 07–08, 10–14)
  - Repo-wide search confirms no legacy runtime references
- Acceptance Criteria
  - Flow-only system works end-to-end
  - No legacy runtime remnants
  - Full tutorial suite passes
- Retro (mandatory)
  - Lessons learned:
  - Risks discovered:
  - Follow-ups:

---

## Tutorial Gate Matrix (From spec.md)

- Phase 1–2: Lessons 01–05
- Phase 3: Lessons 01–05 + policy lesson
- Phase 4: Lessons 06 and 09
- Phase 5: Lessons using nodePacks + promptFile
- Phase 6: Lessons 01–05, 07–08, 10–14

---

## Changes Log (Manual)

- [ ] Manifest created in spec folder
- [ ] Documentation impact checklist applied
- [ ] Legacy runtime removal completed
- [ ] Phase tutorials created/validated
- [ ] Retro sections completed per phase
