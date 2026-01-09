# DX Audit Checklist for v0.2.0 Eval System

**Purpose:** Systematically verify that the eval system delivers excellent developer experience before release.

**Status:** REQUIRED GATE — v0.2.0 does not ship until this audit passes.

---

## How to Use This Checklist

1. **Self-audit**: Implementer goes through each item, marks pass/fail, notes issues
2. **Fresh-eyes test**: Someone unfamiliar with implementation validates key user journeys
3. **Fix or document**: Critical/High issues must be fixed; Medium/Low can be documented

**Severity Levels:**
- **Critical**: Blocks release. Must fix.
- **High**: Should fix. If not fixed, requires documented workaround.
- **Medium**: Nice to fix. Document if not fixing.
- **Low**: Polish. Fix if time permits.

---

## Dimension 1: API Ergonomics

*Is the happy path obvious? Are error messages helpful? Is naming consistent?*

### 1.1 Happy Path (Critical)

- [ ] Can define a suite in < 10 lines of code
- [ ] Can run a suite with a single function call
- [ ] Default configuration works without specifying optional parameters
- [ ] Most common use case requires no configuration

### 1.2 Error Messages (High)

- [ ] Type errors are caught at compile time, not runtime
- [ ] Runtime errors include actionable messages (what went wrong + how to fix)
- [ ] Invalid dataset JSON produces clear validation errors with line numbers
- [ ] Missing recordings in replay mode explain what's missing and how to record

### 1.3 Naming Consistency (Medium)

- [ ] Function names follow consistent verb patterns (`create*`, `run*`, `define*`)
- [ ] Type names are self-explanatory without needing docs
- [ ] No abbreviations that require explanation
- [ ] Similar concepts have similar names across the API

### 1.4 TypeScript Experience (High)

- [ ] All public APIs are fully typed (no `any`)
- [ ] Types provide useful autocomplete in editors
- [ ] Generics are used only where they add value
- [ ] Union types are narrow enough to be useful

---

## Dimension 2: Progressive Disclosure

*Can users start simple and add complexity? Clear beginner → advanced path?*

### 2.1 Minimal Viable Example (Critical)

- [ ] A working eval can be written in < 20 lines
- [ ] First example in docs is copy-paste runnable
- [ ] No required configuration for "hello world" level usage

### 2.2 Layered Complexity (High)

- [ ] Basic usage: `defineSuite()` + `runSuite()`
- [ ] Intermediate: Custom variants, gates, scorers
- [ ] Advanced: Custom workflow factory, hooks, comparison thresholds
- [ ] Each layer is optional - users only learn what they need

### 2.3 Escape Hatches (Medium)

- [ ] Users can drop down to lower-level APIs when needed
- [ ] `createEvalEngine()` is documented for advanced use cases
- [ ] Custom scorers can be added without forking

### 2.4 Learning Curve (High)

- [ ] User can understand core concepts in 5 minutes
- [ ] User can run their first eval in 15 minutes
- [ ] User can customize for their use case in 30 minutes

---

## Dimension 3: Documentation Completeness

*Does every public export have docs? Do examples work?*

### 3.1 Coverage (Critical)

- [ ] Every public export from `@open-harness/core` eval has documentation
- [ ] Every type has JSDoc comments explaining its purpose
- [ ] Every function has JSDoc with @param and @returns

### 3.2 Examples (Critical)

- [ ] All code examples in docs are tested (copy-paste runnable)
- [ ] Examples show real use cases, not toy examples
- [ ] Error handling is shown in examples where relevant

### 3.3 Conceptual Documentation (High)

- [ ] "What is an eval?" explained for newcomers
- [ ] "Why use this?" value proposition is clear
- [ ] Architecture diagram shows how pieces fit together
- [ ] Glossary defines terms (case, variant, gate, scorer, etc.)

### 3.4 Reference Documentation (High)

- [ ] API reference lists all exports
- [ ] Each export has signature + description + example
- [ ] Types are documented with all properties explained
- [ ] Configuration options are documented with defaults

### 3.5 How-To Guides (Medium)

- [ ] "How to create a dataset" guide exists
- [ ] "How to add a custom scorer" guide exists
- [ ] "How to set up CI" guide exists
- [ ] "How to debug a failing eval" guide exists

---

## Dimension 4: Consistency Check

*Do similar things work similarly? Are patterns reused?*

### 4.1 API Patterns (High)

- [ ] All factory functions follow same pattern (`create*` returns instance)
- [ ] All runner functions follow same pattern (`run*` returns Promise)
- [ ] Configuration objects have consistent shape across functions
- [ ] Options are in similar positions across similar functions

### 4.2 Error Handling (Medium)

- [ ] All async functions handle errors consistently
- [ ] Error types are consistent across the API
- [ ] Validation errors vs runtime errors are distinguishable

### 4.3 Return Types (High)

- [ ] Similar operations return similar shapes
- [ ] Result types are consistent (all include `passed`, `message`, etc.)
- [ ] Async functions consistently return Promises

### 4.4 Naming (Medium)

- [ ] Plural vs singular is consistent (e.g., `cases` not `case` for arrays)
- [ ] Boolean properties use `is*` or `has*` prefix
- [ ] Callback props use `on*` prefix

---

## Dimension 5: First-Run Experience

*Can someone go 0→working eval in 15 minutes using only docs?*

### 5.1 Installation (Critical)

- [ ] Single package install: `npm install @open-harness/core`
- [ ] No peer dependencies that aren't obvious
- [ ] Works with common setups (Node, Bun, TypeScript)

### 5.2 Getting Started (Critical)

- [ ] Quickstart guide exists and works
- [ ] Time to first successful run < 15 minutes
- [ ] No external dependencies required for basic usage

### 5.3 Common Gotchas (High)

- [ ] Common mistakes are documented with solutions
- [ ] FAQ section addresses typical questions
- [ ] Error messages link to relevant docs where helpful

### 5.4 Fresh-Eyes Test (Critical)

This is a manual test performed by someone unfamiliar with the implementation:

**Test Protocol:**
1. Start with only the public documentation (no asking implementer questions)
2. Attempt to:
   - [ ] Install the package
   - [ ] Create a simple dataset (2-3 cases)
   - [ ] Define 2 variants
   - [ ] Run the suite
   - [ ] Understand the report output
   - [ ] Fix a failing assertion
3. Record:
   - Time taken for each step
   - Points of confusion
   - Questions that arose
   - Suggestions for improvement

**Pass Criteria:**
- [ ] All tasks completed
- [ ] Total time < 30 minutes
- [ ] No questions required asking the implementer
- [ ] Confusion points documented for improvement

---

## Audit Summary Template

After completing the audit, fill in this summary:

```markdown
## DX Audit Summary

**Date:** YYYY-MM-DD
**Auditor:** [Name]
**Fresh-Eyes Tester:** [Name] (if different)

### Results by Dimension

| Dimension | Critical | High | Medium | Low | Pass? |
|-----------|----------|------|--------|-----|-------|
| 1. API Ergonomics | X/X | X/X | X/X | X/X | Y/N |
| 2. Progressive Disclosure | X/X | X/X | X/X | X/X | Y/N |
| 3. Doc Completeness | X/X | X/X | X/X | X/X | Y/N |
| 4. Consistency | X/X | X/X | X/X | X/X | Y/N |
| 5. First-Run Experience | X/X | X/X | X/X | X/X | Y/N |

### Blocking Issues (must fix before release)

1. [Issue description]
2. [Issue description]

### Documented Workarounds

1. [Issue + workaround]

### Deferred to v0.3.0

1. [Issue + rationale]

### Fresh-Eyes Test Results

- Time to complete: XX minutes
- Major confusion points: [list]
- Suggestions: [list]

### Release Recommendation

[ ] PASS - Ready to ship
[ ] CONDITIONAL PASS - Ship after fixing [list items]
[ ] FAIL - Must address [list items] before shipping
```

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-08 | Initial checklist created |
