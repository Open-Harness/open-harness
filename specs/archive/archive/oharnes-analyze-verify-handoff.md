# Handoff: oharnes.analyze + oharnes.verify

**Created**: 2025-12-26
**Purpose**: Create PRE and POST implementation verification commands using orchestrator pattern

---

## IMPORTANT: How to Use This Document

Before you implement anything:

1. **Read the pattern reference files** listed in Section 3
2. **ULTRATHINK** about the design - consider multiple approaches
3. **Present options to the user** using AskUserQuestion before implementing
4. **Implement oharnes.analyze FIRST** (it has a base to model from)
5. **Implement oharnes.verify SECOND** (it's brand new)

---

## Section 1: Context and Problem Statement

### The Gap We're Filling

The 003-harness-renderer retrospective identified **RC003**: "Spec-kit /implement has no verification gates."

**Current speckit lifecycle:**
```
speckit.specify → spec.md
speckit.plan    → plan.md
speckit.tasks   → tasks.md
speckit.analyze → PRE-impl consistency check ✅
speckit.implement → actual code
(nothing)       → POST-impl verification ❌ MISSING
```

**We need both for oharnes:**
- `oharnes.analyze` - PRE-implementation (upgrade speckit.analyze with orchestrator pattern)
- `oharnes.verify` - POST-implementation (brand new, catches implementation drift)

### Root Causes These Commands Must Prevent

| RC | Issue | Which Command | How It Prevents |
|----|-------|---------------|-----------------|
| RC001 | Prototype contamination | oharnes.verify | Checks architecture matches plan |
| RC002 | Core features skipped | oharnes.verify | Checks all FR-XXX have implementation |
| RC003 | No verification gates | BOTH | They ARE the gates |
| RC004 | Manual approach bypassed spec | oharnes.verify | Compares implementation to spec |
| RC005 | Task paths ignored | oharnes.verify | Path auditor checks all paths |

---

## Section 2: Patterns You Must Understand

Before implementing, you MUST understand these two patterns we use in oharnes commands.

### Pattern 1: The Orchestrator Pattern

**What it is**: A controller command that does NOT do the heavy work itself. Instead, it:
1. Initializes context (minimal - just enough to dispatch)
2. Dispatches sub-agents to do scoped work
3. Collects their outputs
4. Assembles a final report

**Why we use it**:
- Prevents context bloat in the controller
- Each sub-agent has focused, throwaway context
- Sub-agents can run in PARALLEL for speed
- Follows "Context Jealousy" principle

**Example to study**: `oharnes.retro`

```markdown
## Core Principle: Context Jealousy

You do NOT do investigation work. You:
1. Initialize context
2. Launch agents
3. Collect summaries
4. Assemble final report

All heavy lifting is done by subagents who save their detailed findings.
```

**Key implementation details**:
- Dispatch ALL parallel agents in a SINGLE message (not separate messages)
- Collect SUMMARY outputs from each agent
- Sequential agents (like synthesizer) run AFTER parallel phase completes

### Pattern 2: The Validation Gate Pattern

**What it is**: After producing an artifact or completing a phase, dispatch a validator agent to check quality and return a score-based recommendation.

**The scoring thresholds**:
- `>= 70`: `proceed` - Continue to next step
- `50-69`: `fix_required` - Issues found, ask user what to do
- `< 50`: `block` - Critical issues, cannot proceed

**Example to study**: `oharnes.plan` Phase 2

```markdown
### Phase 2: Validation Gate

1. **Dispatch validator**:
   Task: oharnes.plan:validator
   Prompt: |
     FEATURE_SPEC: {path}
     SPECS_DIR: {path}
     Validate plan artifacts against spec requirements.

2. **Handle validation results**:
   - If `recommendation: proceed` (score >= 70): Continue
   - If `recommendation: fix_required` (score 50-69): Ask user
   - If `recommendation: block` (score < 50): ERROR, stop
```

**Key implementation details**:
- Validator returns structured YAML with score and recommendation
- Controller handles each recommendation type explicitly
- Max 2 retry iterations for fix_required

---

## Section 3: Files You MUST Read Before Implementing

### Controller Pattern Examples

Read these to understand how to structure the controller:

| File | What to Learn |
|------|---------------|
| `.claude/commands/oharnes.retro.md` | Full orchestrator pattern, parallel dispatch, synthesis |
| `.claude/commands/oharnes.plan.md` | Validation gate pattern, handling recommendations |
| `.claude/commands/oharnes.implement.md` | How controller does work + dispatches sub-agents |

### Sub-Agent Pattern Examples

Read these to understand how to structure sub-agents:

| File | What to Learn |
|------|---------------|
| `.claude/agents/oharnes.retro-file-auditor.md` | haiku auditor pattern, YAML output |
| `.claude/agents/oharnes.retro-spec-drift.md` | sonnet analyzer pattern, compliance checking |
| `.claude/agents/oharnes.retro-synthesizer.md` | Synthesizer pattern, aggregating findings |
| `.claude/agents/oharnes.plan-validator.md` | Validator with scoring rubric |
| `.claude/agents/oharnes.tasks-validator.md` | Task validation pattern |

### The Base Command to Upgrade

| File | Purpose |
|------|---------|
| `.claude/commands/speckit.analyze.md` | **Canonical reference** for oharnes.analyze |

### Source of Truth (Retrospective)

| File | Purpose |
|------|---------|
| `specs/backlog/003-next-cycle-inputs.md` | Root causes, key decisions |
| `specs/003-harness-renderer/RETROSPECTIVE.md` | What went wrong, why |

---

## Section 4: Sub-Agent Structure

Every sub-agent MUST follow this structure (from our established pattern):

```markdown
---
name: oharnes.<command>:<role>
description: <when to use this agent>
tools: <minimal required tools>
model: <haiku|sonnet>
---

You are a <role description>.

## Purpose

<one-line purpose>

## Input

You receive via prompt:
- `VAR1`: description
- `VAR2`: description

## Workflow

1. Step one
2. Step two
...

## Output Protocol

### Return to Controller (stdout)
```
SUMMARY: <one-line summary with key metrics>
```

### Save to File (or Return Structured)
```yaml
<structured YAML output>
```

## Boundaries

**DO**:
- <allowed action>

**DO NOT**:
- <prohibited action>
```

### Tool Scoping by Agent Type

| Agent Type | Tools | Model |
|------------|-------|-------|
| Auditor (checks existence) | Read, Glob, Grep | haiku |
| Analyzer (understands content) | Read, Glob, Grep | sonnet |
| Runner (executes commands) | Read, Bash, Glob | haiku |
| Synthesizer (aggregates) | Read | sonnet |

---

## Section 5: oharnes.analyze Specification

### What It Does

Validates spec/plan/tasks are consistent BEFORE implementation begins.

### Base Reference

Model after `speckit.analyze`. Preserve its detection capabilities but distribute across sub-agents.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 oharnes.analyze (Controller)                 │
│                                                             │
│  1. Run check-prerequisites.sh                              │
│  2. Load spec.md, plan.md, tasks.md (minimal context)       │
│  3. Dispatch 4 analysis agents in PARALLEL                  │
│  4. Wait for all to complete                                │
│  5. Dispatch synthesizer (SEQUENTIAL)                       │
│  6. Apply validation gate                                   │
│  7. Report or handoff                                       │
└─────────────────────────────────────────────────────────────┘
                              │
    ┌─────────────────────────┼─────────────────────────┐
    │ PARALLEL                │                         │
    ▼                         ▼                         ▼
┌─────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Duplicate  │    │    Ambiguity    │    │   Coverage      │
│   Checker   │    │     Checker     │    │    Mapper       │
│   (haiku)   │    │     (haiku)     │    │   (sonnet)      │
└─────────────┘    └─────────────────┘    └─────────────────┘
        │                   │                      │
        └───────────────────┼──────────────────────┘
                            ▼
                   ┌─────────────────┐
                   │   Constitution  │
                   │    Checker      │
                   │    (haiku)      │
                   └─────────────────┘
                            │
    ────────────────────────┼──────────────────────────────
                            │ SEQUENTIAL
                            ▼
                   ┌─────────────────┐
                   │   Synthesizer   │
                   │    (sonnet)     │
                   └─────────────────┘
```

### Sub-Agents Required

| Agent | Model | What It Checks |
|-------|-------|----------------|
| `oharnes.analyze:duplicate-checker` | haiku | Near-duplicate requirements, redundant tasks |
| `oharnes.analyze:ambiguity-checker` | haiku | Vague terms, placeholders, unmeasurable criteria |
| `oharnes.analyze:coverage-mapper` | sonnet | Requirements ↔ tasks mapping, gaps |
| `oharnes.analyze:constitution-checker` | haiku | Constitution compliance, MUST violations |
| `oharnes.analyze:synthesizer` | sonnet | Aggregate findings, assign severity, produce report |

### Output Format

Preserve compatibility with speckit.analyze output format:

```markdown
## Specification Analysis Report

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| D1 | Duplication | HIGH | spec.md:L120 | Two similar requirements | Merge |
| A1 | Ambiguity | MEDIUM | plan.md:L45 | "fast" without metric | Define threshold |

**Coverage Summary:**
| Requirement | Has Task? | Task IDs |
|-------------|-----------|----------|

**Metrics:**
- Total Requirements: X
- Coverage %: Y
- Critical Issues: Z
```

### Validation Gate

After synthesis, apply threshold:
- Score >= 70: Log "Analysis passed", handoff to `oharnes.implement`
- Score 50-69: Display issues, ask "Fix now or proceed anyway?"
- Score < 50: BLOCK, "Critical issues must be resolved before implementation"

---

## Section 6: oharnes.verify Specification

### What It Does

Validates implementation matches specification AFTER coding is complete. **This is a NEW command** - speckit doesn't have it.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  oharnes.verify (Controller)                 │
│                                                             │
│  1. Run check-prerequisites.sh                              │
│  2. Load spec.md, plan.md, tasks.md (minimal context)       │
│  3. Dispatch 4 verification agents in PARALLEL              │
│  4. Wait for all to complete                                │
│  5. Dispatch synthesizer (SEQUENTIAL)                       │
│  6. Generate VERIFICATION.md                                │
│  7. Apply verdict, handoff if needed                        │
└─────────────────────────────────────────────────────────────┘
                              │
    ┌─────────────────────────┼─────────────────────────┐
    │ PARALLEL                │                         │
    ▼                         ▼                         ▼
┌─────────────┐    ┌─────────────────┐    ┌─────────────────┐
│    Task     │    │      Path       │    │      Spec       │
│   Checker   │    │     Auditor     │    │    Checker      │
│   (haiku)   │    │     (haiku)     │    │    (sonnet)     │
└─────────────┘    └─────────────────┘    └─────────────────┘
        │                   │                      │
        └───────────────────┼──────────────────────┘
                            ▼
                   ┌─────────────────┐
                   │      Gate       │
                   │     Runner      │
                   │    (haiku)      │
                   └─────────────────┘
                            │
    ────────────────────────┼──────────────────────────────
                            │ SEQUENTIAL
                            ▼
                   ┌─────────────────┐
                   │   Synthesizer   │
                   │    (sonnet)     │
                   └─────────────────┘
```

### Sub-Agents Required

| Agent | Model | What It Checks |
|-------|-------|----------------|
| `oharnes.verify:task-checker` | haiku | All tasks marked [X], count matches expected |
| `oharnes.verify:path-auditor` | haiku | File paths from tasks.md exist, no wrong locations |
| `oharnes.verify:spec-checker` | sonnet | FR-XXX requirements have implementation, no drift |
| `oharnes.verify:gate-runner` | haiku | TypeScript compiles, lint passes, tests pass |
| `oharnes.verify:synthesizer` | sonnet | Aggregate results, score, verdict, recommendations |

### Output Format

Generate `{FEATURE_DIR}/VERIFICATION.md`:

```markdown
# Verification Report: {FEATURE_NAME}

**Date**: {today}
**Status**: PASS | FAIL | PARTIAL
**Score**: {X}/100

## Summary

{One paragraph summary of verification results}

## Checks

| Check | Status | Score | Issues |
|-------|--------|-------|--------|
| Task Completion | ✓ PASS | 100 | 0 |
| Path Verification | ✗ FAIL | 60 | 4 missing |
| Spec Compliance | ⚠ PARTIAL | 75 | 2 gaps |
| Quality Gates | ✓ PASS | 100 | 0 |

## Issues Found

### Critical
- {issue with file:line}

### Medium
- {issue with file:line}

## Recommendations

{Prioritized list of what to fix}

---
**Generated by**: /oharnes.verify
```

### Verdict Thresholds

| Score | Verdict | Action |
|-------|---------|--------|
| >= 90 | PASS | Feature ready for merge, offer to commit |
| 70-89 | PARTIAL | Fix issues before merge, list what needs fixing |
| < 70 | FAIL | Significant work needed, handoff to `oharnes.retro` |

---

## Section 7: Implementation Instructions

### Step 1: Research Phase

Before implementing ANYTHING:

1. **Read ALL pattern reference files** listed in Section 3
2. **Read speckit.analyze** carefully - understand every detection type
3. **Read the retrospective** - understand what failures we're preventing

### Step 2: ULTRATHINK

After reading, ULTRATHINK about the design:

1. Consider multiple approaches for each command
2. Consider alternative sub-agent splits
3. Consider what could go wrong
4. Generate a rubric for evaluation
5. Grade your options against the rubric

### Step 3: Present Options to User

Use `AskUserQuestion` to present your design options:

```
Question: "How should oharnes.analyze distribute the detection work?"
Options:
- Option A: 4 parallel agents (duplicate, ambiguity, coverage, constitution)
- Option B: 3 parallel agents (combine duplicate+ambiguity)
- Option C: 5 parallel agents (split coverage into requirements + tasks)
```

Get user approval before implementing.

### Step 4: Implement oharnes.analyze FIRST

Why first:
- It has `speckit.analyze` as a base to model from
- You can test it against existing spec/plan/tasks
- Simpler to validate (checks documents, not code)

Implementation order:
1. Create controller `.claude/commands/oharnes.analyze.md`
2. Create sub-agents (all 5)
3. Test with existing feature spec

### Step 5: Implement oharnes.verify SECOND

Why second:
- It's brand new (no base to model from)
- Requires oharnes.implement to have run first
- More complex (checks actual code)

Implementation order:
1. Create controller `.claude/commands/oharnes.verify.md`
2. Create sub-agents (all 5)
3. Test after running oharnes.implement on a feature

---

## Section 8: Files to Create

### oharnes.analyze (6 files)

```
.claude/commands/oharnes.analyze.md
.claude/agents/oharnes.analyze-duplicate-checker.md
.claude/agents/oharnes.analyze-ambiguity-checker.md
.claude/agents/oharnes.analyze-coverage-mapper.md
.claude/agents/oharnes.analyze-constitution-checker.md
.claude/agents/oharnes.analyze-synthesizer.md
```

### oharnes.verify (6 files)

```
.claude/commands/oharnes.verify.md
.claude/agents/oharnes.verify-task-checker.md
.claude/agents/oharnes.verify-path-auditor.md
.claude/agents/oharnes.verify-spec-checker.md
.claude/agents/oharnes.verify-gate-runner.md
.claude/agents/oharnes.verify-synthesizer.md
```

---

## Section 9: Grading Rubric

Use this to evaluate your implementation:

| Criterion | Weight | Question |
|-----------|--------|----------|
| Root Cause Prevention | 25% | Does this catch RC001-RC005 scenarios? |
| Pattern Consistency | 25% | Follows oharnes.retro orchestrator pattern exactly? |
| Parallel Dispatch | 15% | Sub-agents dispatched in SINGLE message? |
| Validation Gate | 15% | Proper threshold handling (70/50)? |
| Actionable Output | 10% | Report gives clear, specific next steps? |
| Handoffs | 10% | Correct handoffs on each verdict? |

---

## Section 10: Checklist Before Completing

### oharnes.analyze Checklist

- [ ] Read speckit.analyze completely
- [ ] Read oharnes.retro for orchestrator pattern
- [ ] Controller dispatches 4 agents in PARALLEL (single message)
- [ ] Synthesizer runs AFTER parallel phase (sequential)
- [ ] Preserves all speckit.analyze detection types
- [ ] Output format compatible with speckit.analyze
- [ ] Validation gate with 70/50 thresholds
- [ ] Handoff to oharnes.implement if proceed
- [ ] Handoff to oharnes.clarify if fix_required
- [ ] BLOCK with clear message if < 50

### oharnes.verify Checklist

- [ ] Read oharnes.retro for orchestrator pattern
- [ ] Read oharnes.retro agents for sub-agent patterns
- [ ] Controller dispatches 4 agents in PARALLEL (single message)
- [ ] Synthesizer runs AFTER parallel phase (sequential)
- [ ] Checks ALL 5 areas: tasks, paths, spec, gates, critical paths
- [ ] Generates VERIFICATION.md in feature directory
- [ ] Proper scoring rubric in synthesizer
- [ ] Verdict with 90/70 thresholds
- [ ] Handoff to commit if PASS
- [ ] Handoff to fix list if PARTIAL
- [ ] Handoff to oharnes.retro if FAIL

---

## Section 11: Common Mistakes to Avoid

1. **Don't dispatch agents in separate messages** - Use ONE message with multiple Task calls for parallel dispatch

2. **Don't let controller do the analysis work** - Controller only orchestrates, sub-agents do the work

3. **Don't forget the synthesizer** - Results must be aggregated into a coherent report

4. **Don't skip the validation gate** - Every command needs proceed/fix/block handling

5. **Don't use wrong model for agents** - haiku for mechanical checks, sonnet for understanding

6. **Don't forget handoffs** - Each verdict needs a clear next action

---

**Handoff created by**: oharnes development session
**Date**: 2025-12-26
**Ready for**: Fresh context implementation
