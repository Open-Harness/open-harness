# Phase 8 Handoff Prompt

**Date:** 2026-01-08
**Status:** Phase 8.0 (DX Layer) complete, Phase 8.1-8.2 (Fixtures + Scripts) ready to start
**Branch:** `v0.2.0/stabilization`

---

## Context for Next Agent

You are continuing work on the Open Harness v0.2.0 eval system. Phase 8.0 (DX Layer) is complete. Your task is to:

1. **Design** a concrete example workflow for the eval system
2. **Implement** fixtures and recording scripts (Phase 8.1-8.2)
3. **Validate** end-to-end eval flow works

## Canonical Documents (READ THESE FIRST)

| Document | Purpose | Priority |
|----------|---------|----------|
| `docs/internal/milestones/v0.2.0/VERSION_PLAN.md` | Master release plan, scope, and criteria | **READ FIRST** |
| `docs/internal/milestones/v0.2.0/EVAL_COMPLETION_PLAN.md` | Detailed eval implementation plan | **READ SECOND** |
| `packages/internal/core/src/eval/README.md` | Implementation docs including DX layer | **Reference** |
| `docs/internal/milestones/v0.2.0/DX_AUDIT_CHECKLIST.md` | Phase 9 audit criteria | Reference |

## What's Done

### Phase 6-7: Core Types + Engine ✅
- All eval primitives implemented and tested
- 121 tests passing

### Phase 8.0: DX Layer ✅
- `dx-types.ts` - SuiteConfig, VariantDef, Gate types
- `dx.ts` - `defineSuite()`, `variant()`, `gates.*`, `runSuite()`
- `dx.test.ts` - 40 comprehensive tests
- Exports added to `index.ts`
- README updated with DX layer documentation
- **All quality gates pass** (typecheck, lint, 161 tests)

## What's Next: The Example Problem

### The Gap We Identified

The original plan mentions "coder-reviewer.v1" dataset but this workflow doesn't exist. More importantly, we realized the example needs to serve a specific user story.

### The User Story to Enable

```
"I have a workflow. I changed my prompt. Is it better or worse?"
```

This is the **primary use case** for evals in practice:
- Same model, same workflow
- Different system prompts (variants)
- Compare: pass rate, tokens, cost, latency

### Why Prompt Comparison (Not Provider Comparison)

1. v0.2.0 only has Claude provider (multi-provider comes later)
2. Teams iterate on prompts 100x more than they switch providers
3. This is immediate, practical value
4. It exercises the full eval API surface

## Your Task: Design-First Implementation

### Step 1: Write Example Spec (30 min)

Create `packages/open-harness/core/tests/fixtures/evals/EXAMPLE_SPEC.md`:

```markdown
# Prompt Comparison Eval Example

## User Story
As a developer iterating on prompts,
I want to compare two system prompts on the same tasks,
So I can see which performs better.

## Workflow: Simple Coder
- **Nodes:** 1 (coder)
- **Input:** `{ task: string }`
- **Output:** `{ code: string }`

## Variants
| ID | Description | System Prompt |
|----|-------------|---------------|
| `baseline` | Current production | "You are a helpful coding assistant." |
| `candidate` | New experimental | "You are a senior engineer. Be concise. Prefer modern patterns." |

## Test Cases
| ID | Task | Assertions |
|----|------|------------|
| `add-numbers` | "Write a JS function that adds two numbers" | no_errors, output.contains("function") |
| `fizzbuzz` | "Write fizzbuzz in Python" | no_errors, output.contains("fizz") |
| `reverse-string` | "Write a function to reverse a string" | no_errors |

## Metrics to Compare
1. Pass rate (all assertions pass)
2. Token efficiency (input + output)
3. Latency (ms)
4. Cost (USD)

## Expected Outcome
Running this eval should produce a report showing:
- Both variants pass all cases (or not)
- Token/cost/latency comparison
- "candidate uses 15% fewer tokens" type insights
```

### Step 2: Implement the Workflow Factory

Create a minimal workflow factory that:
- Takes `task` as input
- Has configurable system prompt via variant config
- Uses Claude provider (or mock for testing)

### Step 3: Create Dataset JSON

`packages/open-harness/core/tests/fixtures/evals/datasets/prompt-comparison.v1.json`

### Step 4: Implement Scripts

```
packages/open-harness/core/scripts/
  eval.ts                    # CLI: bun run eval --dataset X --mode replay
  record-eval-goldens.ts     # CLI: bun run record:eval-goldens --dataset X
```

### Step 5: Record Real Fixtures (if API access available)

Or create mock fixtures that exercise the same code paths.

## Key Constraints

### From CLAUDE.md (CRITICAL)

> **Fixtures must be REAL** - Record from live SDK, never fabricate

> All test fixtures MUST be recorded from REAL SDK interactions

If you cannot make real API calls, create the scaffolding and document what needs to be recorded. Do NOT fabricate "realistic looking" JSON.

### Progressive Disclosure Principle

This example should be:
1. **Simple enough** to understand in 5 minutes
2. **Complete enough** to exercise: recording, replay, assertions, gates, comparison
3. **Extensible** for future examples (coder-reviewer, tool-use, etc.)

## Files to Create

```
packages/open-harness/core/
  tests/fixtures/evals/
    EXAMPLE_SPEC.md              # Design doc (Step 1)
    datasets/
      prompt-comparison.v1.json  # Dataset (Step 3)
    goldens/
      (recordings go here)       # Step 5
    provenance/
      (event captures go here)   # Step 5
  scripts/
    eval.ts                      # Step 4
    record-eval-goldens.ts       # Step 4
```

## Definition of Done (Phase 8.1-8.2)

- [ ] Example spec written and reviewed
- [ ] Workflow factory implemented
- [ ] Dataset JSON created
- [ ] `eval.ts` script works: `bun run eval --help`
- [ ] `record-eval-goldens.ts` script works: `bun run record:eval-goldens --help`
- [ ] Either: Real fixtures recorded from live SDK
- [ ] Or: Mock fixtures with clear "TODO: record from live" documentation
- [ ] CI can run eval in some mode (replay if fixtures exist, or skip gracefully)

## After Phase 8: Phase 9 DX Audit

Phase 9 is a **hard release gate**. After fixtures/scripts:

1. Self-audit against `DX_AUDIT_CHECKLIST.md`
2. Fresh-eyes test: Can someone use evals with ONLY docs?
3. Documentation sync: Does `evals-pattern.md` match implementation?

## Commands

```bash
# From repo root
bun run typecheck
bun run lint
bun run test

# From packages/internal/core
bun test tests/eval/
```

## Questions to Resolve

1. **API Access:** Do you have Claude API access for recording? If not, mock is acceptable with documentation.
2. **Workflow Location:** Should the example workflow live in `core` or in a separate `examples/` package?
3. **Prompt Content:** What specific system prompts should we use for baseline vs candidate?

---

*Generated by Phase 8.0 agent on 2026-01-08*
