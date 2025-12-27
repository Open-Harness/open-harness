# Oharnes V4 Manual Retrospective

**Date**: 2025-12-26
**Type**: Manual (post-audit reflection)
**Branch**: main (direct commit - break in normal workflow)

---

## Context

We needed to migrate one command but ended up migrating the entire core oharnes flow. The scope expansion and number of changed files made manual verification overwhelming, so we ran multiple audit waves checking different dimensions.

## Audit Waves Summary

| Wave | Dimensions Checked | Result |
|------|-------------------|--------|
| V1 | Spirit/philosophy alignment | Real issues found |
| V2 | Agent validation | 11 gaps resolved |
| V3 | Spirit audit (deeper) | 4 gaps resolved |
| V4 | Brittleness, Contracts, Edge Cases, Thresholds, Error Flow, Schema | Mostly false positives |

We stopped auditing when Wave V4 returned primarily false positives - diminishing returns indicated the system was stable enough.

---

## What Went Well

1. **Wave-over-wave approach** - Each audit dimension caught different issues
2. **Parallel Opus agents** - 6 agents checking simultaneously found comprehensive coverage
3. **User-in-loop validation** - Reviewing findings with user filtered false positives effectively
4. **Issue triage** - Grading by severity (critical/high/medium/low) focused effort

## What Needs Improvement

1. **Worked directly on main** - Should have used feature branch or dev branch
2. **Scope creep** - Started as single command migration, became full system overhaul
3. **No automated validation** - Manual audit waves should eventually become CI checks

---

## Blocking Issues for Next Phase

### Test Infrastructure (Priority: HIGH)

Current state is problematic:
- `npm test` runs ALL tests including live SDK tests
- Live tests record new fixtures on every run
- Fixtures get overwritten unintentionally

**Required changes**:
1. Default test run should use recorded fixtures only
2. Recording new fixtures should be opt-in (`--record` flag)
3. Full live SDK test should be opt-in (`--live` flag)
4. Final verification workflow: run with `--live` before release

---

## Next Steps (Ordered)

### Immediate (Blocking)
1. **Fix test infrastructure** - Separate recorded vs live tests, make recording opt-in

### Near-term
2. **Narrator implementation** - Get narrator working with harness
3. **SDK cleanup day** - Folder structure, documentation, TSDoc
4. **Doc generation** - Set up automatic TSDoc generation

### Setup
5. **Version control** - Simple bump system (not changesets - too complex)
6. **CI/CD** - Set up Claude Code in GitHub Actions

---

## Files Changed This Session

- 13 agent files modified (analyze, verify, retro, plan)
- 7 command files modified (all oharnes commands)
- 6 speckit commands deleted (migrated to oharnes)
- 4 validation handoff docs archived
- CLAUDE.md updated with new conventions

## Key Fixes Applied

| ID | Fix | Impact |
|----|-----|--------|
| T001 | Document verify's 90/70 threshold | Clarity |
| T002 | Remove unused FEATURE_DIR | Cleanup |
| T003 | Filter implement to incomplete tasks | Bug fix |
| T004 | Add Acceptance row to verify | Completeness |
| T005 | Remove VERIFICATION.md from synthesizer | Controller owns template |
| T006 | Add issue_count to verify checkers | Consistency |
| T007 | Add Verification Gates check | Validation |
| T008 | Document PASS/PARTIAL/FAIL | Terminology |
| T009 | Document iteration limits | Clarity |
| T010 | Standardize directory naming | Consistency |
| T011 | Standardize severity values | Schema alignment |
| T012 | FALSE POSITIVE - fields used | No change needed |

---

## Decision Log

| Decision | Rationale |
|----------|-----------|
| Stop at V4 audit | Diminishing returns - mostly false positives |
| Direct commit to main | Already too deep, will use proper branching going forward |
| Archive validation docs | Historical reference, not active |
| Test infra is blocking | Can't safely iterate without proper test isolation |
