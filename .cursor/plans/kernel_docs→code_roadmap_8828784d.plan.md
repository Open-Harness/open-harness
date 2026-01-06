---
name: Kernel Docs→Code Roadmap
overview: Add the missing implementation-roadmap/conformance/traceability docs under packages/kernel, then compile the spec into code via conformance-first, kernel-first vertical slices (Hub→ALS→Harness→Inbox→Flow).
todos:
  - id: impl-docs-readme
    content: Create `packages/kernel/docs/implementation/README.md` as the entrypoint for “Spec → Conformance → Code”.
    status: completed
  - id: impl-docs-roadmap
    content: Create `packages/kernel/docs/implementation/roadmap.md` with milestone ordering + done criteria + authoritative scripts per milestone.
    status: completed
    dependencies:
      - impl-docs-readme
  - id: impl-docs-conformance
    content: Create `packages/kernel/docs/implementation/conformance.md` defining test tiers, fixture policy, and behavioral gates (no-network, no-writes, timeouts).
    status: completed
    dependencies:
      - impl-docs-readme
  - id: impl-docs-traceability
    content: Create `packages/kernel/docs/implementation/traceability.md` mapping spec sections → test-spec requirements → future tests → live scripts.
    status: completed
    dependencies:
      - impl-docs-roadmap
      - impl-docs-conformance
  - id: docs-readme-wireup
    content: Update `packages/kernel/docs/README.md` to add an Implementation section linking to `docs/implementation/README.md` and describing the workflow.
    status: completed
    dependencies:
      - impl-docs-readme
  - id: m0-conformance-scaffold
    content: Scaffold minimal conformance structure in `packages/kernel/` (tests/unit, tests/replay, tests/fixtures/{golden,scratch}, scripts/live) aligned with conformance doc.
    status: completed
    dependencies:
      - impl-docs-conformance
      - impl-docs-roadmap
  - id: m0-package-scripts
    content: Update `packages/kernel/package.json` scripts to separate safe default tests from live tests (Bun-first).
    status: completed
    dependencies:
      - m0-conformance-scaffold
  - id: m1-hub-runtime
    content: Implement Hub runtime vertical slice (emit/subscribe/filter/envelope) + unit/replay tests + `scripts/live/hub-live.ts` matching `tests/specs/hub.test-spec.md`.
    status: completed
    dependencies:
      - m0-package-scripts
      - impl-docs-traceability
---

# Kernel: Docs → Conformance → Code (Plan)

## Scope (locked)

- **Strategy**: **A — Conformance-first, kernel-first vertical slices**
- **Docs location**: `packages/kernel/docs/implementation/`
- **Goal**: make it obvious how to “compile” the spec into code, with explicit gates that prevent gaps/spec-drift.

## Phase 1 — Add the missing “compiler driver” docs

### 1) Create implementation docs module

- Add an entrypoint: [`packages/kernel/docs/implementation/README.md`](packages/kernel/docs/implementation/README.md)
  - Links to roadmap + conformance + traceability
  - Defines the rule: **docs are canonical; code must conform**

### 2) Roadmap: milestone ordering + done criteria

- Add [`packages/kernel/docs/implementation/roadmap.md`](packages/kernel/docs/implementation/roadmap.md)
  - Milestone 0: conformance gates (no runtime yet)
  - Milestone 1: Hub minimal runtime (emit/subscribe/filter/envelope)
  - Milestone 2: Context propagation (`scoped/current` ALS semantics)
  - Milestone 3: Harness lifecycle + `phase/task` helpers + attachments
  - Milestone 4: Inbox routing + `runId` semantics
  - Milestone 5: Flow “Hello World” (YAML parse/validate/toposort/when/bindings) with built-in nodes
  - Milestone 6: Provider adapters behind **replay-first** infrastructure + explicit live scripts

Each milestone must define:

- **Inputs** (spec modules + test-spec requirements)
- **Outputs** (APIs + events)
- **Conformance gates** (unit/replay/live)
- **Authoritative script** (the “prove it works” command)

### 3) Conformance: what “done” means

- Add [`packages/kernel/docs/implementation/conformance.md`](packages/kernel/docs/implementation/conformance.md)
  - Defines test tiers:
    - **unit**: pure logic
    - **replay**: deterministic fixtures (no network, no writes)
    - **live**: explicit opt-in, authoritative scripts
  - Defines fixture policy:
    - `fixtures/scratch/` → review → promote → `fixtures/golden/`
    - no accidental recording
  - Defines **behavioral gates** (avoid the old failure modes):
    - default suite: no network, no fixture writes
    - timeouts and expected runtime
    - post-run repo cleanliness check
  - Defines command conventions (Bun-first) and script naming.

### 4) Traceability: eliminate gaps

- Add [`packages/kernel/docs/implementation/traceability.md`](packages/kernel/docs/implementation/traceability.md)
  - A matrix mapping:
    - spec modules (`docs/spec/*`, `docs/flow/*`, `docs/testing/*`)
    - → `tests/specs/*.test-spec.md` requirements (R1/R2/…)
    - → concrete tests (future `tests/unit|replay/*`)
    - → authoritative scripts (future `scripts/live/*`)
  - Explicitly marks what is **interface-contract-only today** vs **runtime behavior once implemented**.

### 5) Wire docs into the canonical entrypoint

- Update [`packages/kernel/docs/README.md`](packages/kernel/docs/README.md)
  - Add an **Implementation** section linking to `docs/implementation/README.md`
  - Clarify: “Spec → Conformance → Code” is the official workflow.

## Phase 2 — Compile docs into code: vertical slices (no provider complexity yet)

This phase begins only after Phase 1 docs are in place.

### Milestone 0 (Conformance scaffolding)

- Create the minimal **project-level test structure** in `packages/kernel/`:
  - `tests/unit/`, `tests/replay/`, `tests/fixtures/{golden,scratch}/`
  - `scripts/live/`
- Add minimal helper docs or a short `tests/README.md` if needed (optional; docs/testing already exists).
- Add package scripts that reflect the conformance doc:
  - `test:unit`, `test:replay`, `test` (safe default), `test:live` (explicit)

### Milestone 1 (Hub runtime)

- Implement a minimal Hub runtime that satisfies `tests/specs/hub.test-spec.md`
- Add:
  - unit tests for pure filter logic
  - replay tests using deterministic fixtures
  - authoritative script `scripts/live/hub-live.ts`

### Milestone 2–5

Proceed milestone-by-milestone from the roadmap, only advancing when conformance gates are green.

## Repo hygiene (important)

- Remove/avoid conflicting tooling (e.g. prefer `bun test` over adding a second test runner).
- Keep provider SDK dependencies out of default test paths.

## Deliverables at end of this plan

- Phase 1 docs fully written and linked from the canonical docs entrypoint.
- A concrete, dependency-ordered milestone plan that tells you what to implement next.
- A traceability matrix that prevents gaps.
- A conformance definition that prevents test drift and accidental fixture mutation.
```mermaid
flowchart LR
  Spec["docs/spec + docs/flow"] --> Conformance["docs/implementation/conformance"]
  Conformance --> Trace["docs/implementation/traceability"]
  Trace --> Tests["tests/unit + tests/replay"]
  Tests --> Live["scripts/live authoritative"]
  Live --> Code["src runtime"]
```