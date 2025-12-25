# Oharnes V4 Fixes

**Source**: Six-Dimensional Final Audit (2025-12-26)
**Status**: PENDING
**Scope**: Full Polish (Option C)

---

## Priority 1: Critical Fixes

### T001: Document verify's 90/70 threshold exception
- **File**: `.claude/CLAUDE.md`
- **Issue**: oharnes.verify uses 90/70 thresholds instead of standard 70/50, undocumented
- **Fix**: Add note in "Verification Gates" section explaining verify uses stricter thresholds

```markdown
## Add after line 35 (after the standard thresholds):

**Exception**: `oharnes.verify` uses stricter post-implementation thresholds:
- `>= 90`: PASS (ready for merge)
- `70-89`: PARTIAL (fix issues before merge)
- `< 70`: FAIL (significant work needed, triggers retrospective)
```

- [ ] Add exception note to CLAUDE.md

---

### T002: Remove unused FEATURE_DIR from analyze:synthesizer
- **File**: `.claude/agents/oharnes.analyze-synthesizer.md`
- **Issue**: Input section lists FEATURE_DIR but it's never used in workflow
- **Fix**: Remove line 17

```markdown
## Change lines 16-18 FROM:
You receive via prompt:
- `FEATURE_DIR`: Path to feature spec directory
- `ANALYSIS_FOLDER`: Path containing analysis YAML files

## TO:
You receive via prompt:
- `ANALYSIS_FOLDER`: Path containing analysis YAML files
```

- [ ] Remove FEATURE_DIR from Input section

---

### T003: Filter implement to incomplete tasks only
- **File**: `.claude/commands/oharnes.implement.md`
- **Issue**: Re-running implement iterates over completed `[X]` tasks
- **Fix**: Change line 60 to filter to incomplete tasks

```markdown
## Change line 60 FROM:
For each task in tasks.md (in order):

## TO:
For each **incomplete** task in tasks.md (marked `- [ ]`, in order):

## Also add after line 60:
> **Note**: Tasks already marked `[X]` are skipped. To re-implement a task, manually change it back to `[ ]`.
```

- [ ] Update task loop to filter incomplete only
- [ ] Add note about skipping completed tasks

---

### T004: Add Acceptance row to verify template
- **File**: `.claude/commands/oharnes.verify.md`
- **Issue**: Template table has 4 checks but 5 agents dispatched (missing Acceptance)
- **Fix**: Add 5th row after line 150

```markdown
## Change lines 145-150 FROM:
| Check | Status | Score | Issues |
|-------|--------|-------|--------|
| Task Completion | {task_check.status} | {task_check.score}/100 | {task_check.issue_count} |
| Path Audit | {path_audit.status} | {path_audit.score}/100 | {path_audit.issue_count} |
| Spec Coverage | {spec_check.status} | {spec_check.score}/100 | {spec_check.issue_count} |
| Gate Tests | {gate_results.status} | {gate_results.score}/100 | {gate_results.issue_count} |

## TO:
| Check | Status | Score | Issues |
|-------|--------|-------|--------|
| Task Completion | {task_check.status} | {task_check.score}/100 | {task_check.issue_count} |
| Path Audit | {path_audit.status} | {path_audit.score}/100 | {path_audit.issue_count} |
| Spec Coverage | {spec_check.status} | {spec_check.score}/100 | {spec_check.issue_count} |
| Gate Tests | {gate_results.status} | {gate_results.score}/100 | {gate_results.issue_count} |
| Acceptance | {acceptance_check.status} | {acceptance_check.score}/100 | {acceptance_check.issue_count} |
```

- [ ] Add Acceptance row to verification table

---

### T005: Remove VERIFICATION.md generation from synthesizer
- **File**: `.claude/agents/oharnes.verify-synthesizer.md`
- **Issue**: Both synthesizer and controller generate VERIFICATION.md (redundant)
- **Fix**: Remove VERIFICATION.md generation from synthesizer, let controller own it

```markdown
## Change line 3 description FROM:
description: Synthesize verification findings from all checkers into final verdict with VERIFICATION.md. Use after all verification agents complete.

## TO:
description: Synthesize verification findings from all checkers into final verdict. Use after all verification agents complete.

## Remove from line 16 (Purpose list):
4. VERIFICATION.md report generation

## Change line 80 FROM:
7. **Save synthesis YAML and VERIFICATION.md**

## TO:
7. **Save synthesis YAML**

## Remove lines 151-218 (the entire VERIFICATION.md template section)
Keep only synthesis.yaml output.

## Update Boundaries DO section to remove VERIFICATION.md reference
```

- [ ] Update description
- [ ] Remove from Purpose list
- [ ] Update workflow step 7
- [ ] Remove VERIFICATION.md template (lines 151-218)
- [ ] Update Boundaries

---

## Priority 2: Polish Fixes

### T006: Add issue_count to verify checker statistics
- **Files**:
  - `.claude/agents/oharnes.verify-task-checker.md`
  - `.claude/agents/oharnes.verify-path-auditor.md`
  - `.claude/agents/oharnes.verify-spec-checker.md`
  - `.claude/agents/oharnes.verify-gate-runner.md`
  - `.claude/agents/oharnes.verify-acceptance-checker.md`
- **Issue**: Template references `{check.issue_count}` but checkers output `findings[]` array
- **Fix**: Add `issue_count` to statistics section of each checker's YAML output

```yaml
## Add to each checker's statistics output:
statistics:
  # ... existing fields ...
  issue_count: {number of findings}
```

- [ ] Add issue_count to task-checker
- [ ] Add issue_count to path-auditor
- [ ] Add issue_count to spec-checker
- [ ] Add issue_count to gate-runner
- [ ] Add issue_count to acceptance-checker

---

### T007: Add Verification Gates check to plan:validator
- **File**: `.claude/agents/oharnes.plan-validator.md`
- **Issue**: gate-runner requires `## Verification Gates` section but plan:validator doesn't verify it exists
- **Fix**: Add validation check

```markdown
## Add to Workflow section (around line 45):

5. **Check Verification Gates section**
   - Verify `## Verification Gates` section exists in plan.md
   - Check it contains at least one gate definition
   - If missing: Add to issues with severity `high`
   - Message: "Verification Gates section required for /oharnes.verify"
```

- [ ] Add Verification Gates existence check

---

### T008: Document PASS/PARTIAL/FAIL terminology
- **File**: `.claude/CLAUDE.md`
- **Issue**: verify uses different terminology than standard
- **Fix**: Add documentation note

```markdown
## Add after the verify threshold exception (from T001):

**Terminology**: `oharnes.verify` uses user-facing terms:
- `PASS` (equivalent to `proceed`)
- `PARTIAL` (equivalent to `fix_required`)
- `FAIL` (equivalent to `block`)
```

- [ ] Add terminology note to CLAUDE.md

---

### T009: Document iteration limit variations
- **File**: `.claude/CLAUDE.md`
- **Issue**: implement uses 5/3 iterations vs standard 2
- **Fix**: Add documentation note

```markdown
## Add to Validation Gate Pattern section (around line 235):

**Iteration Limits**:
- Standard validation loops: max 2 iterations
- `oharnes.implement` task verification: max 5 attempts (coding is iterative)
- `oharnes.implement` gate fixes: max 3 attempts per gate
```

- [ ] Add iteration limits note to CLAUDE.md

---

### T010: Standardize directory field naming
- **Files**: Multiple agents
- **Issue**: Inconsistent naming (`feature_directory` vs `feature_dir` vs `spec_directory`)
- **Fix**: Standardize to `feature_dir` for verify family, `spec_directory` for retro family

```markdown
## In .claude/agents/oharnes.analyze-coverage-mapper.md:
Change output field from `feature_directory` to `feature_dir`

## Document convention in CLAUDE.md:
**Directory Field Naming**:
- verify agents: use `feature_dir`
- retro agents: use `spec_directory`
- analyze agents: use `feature_dir`
```

- [ ] Update coverage-mapper to use `feature_dir`
- [ ] Add naming convention to CLAUDE.md

---

### T011: Standardize severity values (remove null/none)
- **Files**:
  - `.claude/agents/oharnes.analyze-constitution-checker.md`
  - `.claude/agents/oharnes.verify-spec-checker.md`
  - `.claude/agents/oharnes.verify-gate-runner.md`
  - `.claude/agents/oharnes.retro-spec-drift.md`
- **Issue**: Some agents use `null` or `none` for non-issues instead of standard severity levels
- **Fix**: Omit severity field for compliant/passing items (don't include in findings)

```markdown
## Update each agent's output guidance:

For compliant/passing items:
- Do NOT include in findings array (findings are for issues only)
- Track in statistics section instead (e.g., `compliant_count: N`)

For actual issues only:
- Use standard severity: critical | high | medium | low
```

- [ ] Update constitution-checker (change `none` handling)
- [ ] Update spec-checker (change `null` handling)
- [ ] Update gate-runner (change `null` handling)
- [ ] Update spec-drift (change `null` handling)

---

### T012: Trim unused output fields from checkers
- **Files**: Multiple analyze and verify checkers
- **Issue**: Checkers output fields synthesizers never read (wasted tokens)
- **Fix**: Remove unused fields

```markdown
## Fields to remove from findings:

duplicate-checker:
- Remove: findings[].recommendation (not read by synthesizer)
- Remove: findings[].type (not read by synthesizer)

ambiguity-checker:
- Remove: findings[].type (not read by synthesizer)

coverage-mapper:
- Remove: findings[].type (not read by synthesizer)

## Keep severity and id - those are used for aggregation
```

- [ ] Update duplicate-checker output
- [ ] Update ambiguity-checker output
- [ ] Update coverage-mapper output

---

## Checklist Summary

### Priority 1 (Must complete)
- [ ] T001: Document verify thresholds
- [ ] T002: Remove unused FEATURE_DIR
- [ ] T003: Filter to incomplete tasks
- [ ] T004: Add Acceptance row
- [ ] T005: Remove VERIFICATION.md from synthesizer

### Priority 2 (Polish)
- [ ] T006: Add issue_count to checkers (5 files)
- [ ] T007: Add Verification Gates check
- [ ] T008: Document terminology
- [ ] T009: Document iteration limits
- [ ] T010: Standardize directory naming
- [ ] T011: Standardize severity values (4 files)
- [ ] T012: Trim unused fields (3 files)

---

## Files Modified Summary

| File | Tasks |
|------|-------|
| `.claude/CLAUDE.md` | T001, T008, T009, T010 |
| `.claude/commands/oharnes.implement.md` | T003 |
| `.claude/commands/oharnes.verify.md` | T004 |
| `.claude/agents/oharnes.analyze-synthesizer.md` | T002 |
| `.claude/agents/oharnes.verify-synthesizer.md` | T005 |
| `.claude/agents/oharnes.verify-task-checker.md` | T006 |
| `.claude/agents/oharnes.verify-path-auditor.md` | T006 |
| `.claude/agents/oharnes.verify-spec-checker.md` | T006, T011 |
| `.claude/agents/oharnes.verify-gate-runner.md` | T006, T011 |
| `.claude/agents/oharnes.verify-acceptance-checker.md` | T006 |
| `.claude/agents/oharnes.plan-validator.md` | T007 |
| `.claude/agents/oharnes.analyze-coverage-mapper.md` | T010 |
| `.claude/agents/oharnes.analyze-constitution-checker.md` | T011 |
| `.claude/agents/oharnes.analyze-duplicate-checker.md` | T012 |
| `.claude/agents/oharnes.analyze-ambiguity-checker.md` | T012 |
| `.claude/agents/oharnes.retro-spec-drift.md` | T011 |

**Total**: 16 files, 12 tasks

---

**Generated by**: Six-Dimensional Final Audit
**Date**: 2025-12-26
