# Oharnes Spirit Audit v3

**Date**: 2025-12-26
**Auditor**: Claude Opus 4.5
**Focus**: Practical Readiness + Fresh Eyes
**Status**: FIXES APPLIED

## Executive Summary

**Original Score**: 76/100
**Post-Fix Score**: 92/100
**Verdict**: READY_TO_BUILD
**Key Finding**: All critical handoff issues resolved. Clarify flow intentionally removed (redundant with sub-agent verification). Commit checkpoint added to analyze.

---

## v2 Gaps Verification

All 4 gaps from v2 report have been addressed:

| Gap | Description | Status |
|-----|-------------|--------|
| GAP-V2-001 | 11 agents missing Write tool | ✓ FIXED |
| GAP-V2-002 | spec-checker missing VERIFICATION_FOLDER | ✓ FIXED |
| GAP-V2-003 | plan:validator using opus | ✓ FIXED (now sonnet) |
| GAP-V2-004 | analyze agents FEATURE_DIR vs ANALYSIS_FOLDER | ✓ FIXED |

---

## Practical Readiness (35%)

### End-to-End Flow Test

**Intended flow**: `/oharnes.specify` → `/oharnes.plan` → `/oharnes.tasks` → `/oharnes.implement` → `/oharnes.verify`

| Step | Command | Status | Issue |
|------|---------|--------|-------|
| 1 | specify → plan | ✓ OK | Handoff exists |
| 2 | plan → tasks | ✓ OK | Handoff exists |
| 3 | tasks → implement | ⚠️ PARTIAL | Handoff to `speckit.analyze` instead of `oharnes.analyze` |
| 4 | analyze → clarify | ✗ BROKEN | `oharnes.clarify` doesn't exist |
| 5 | implement → verify | ✗ MISSING | No handoff defined |
| 6 | verify → retro | ✓ OK | Handoff on failure |
| 7 | retro → close | ✗ MISSING | No handoff defined |

**Critical Breaks**:
1. `oharnes.analyze` handoffs to `oharnes.clarify` which DOES NOT EXIST
2. `oharnes.implement` has no handoff to `oharnes.verify`
3. `oharnes.retro` has no handoff to `oharnes.close`

**Score**: 25/35

### Findings

- **GAP-V3-001** (Critical): `oharnes.clarify` referenced in `oharnes.analyze.md:10,136,143,254` and `oharnes.specify.md:140,194` but command doesn't exist
- **GAP-V3-002** (High): `oharnes.tasks` handoffs to `speckit.analyze` instead of `oharnes.analyze`
- **GAP-V3-003** (High): Missing handoffs: implement→verify, retro→close

---

## Philosophy Alignment (25%)

### Controller Pattern Check

| Command | Dispatches Sub-Agents? | Stays Lightweight? | Status |
|---------|------------------------|-------------------|--------|
| specify | NO | NO | ⚠️ Exception |
| plan | YES (researcher, validator) | YES | ✓ |
| tasks | YES (validator) | YES | ✓ |
| implement | YES (scout, verifier, fixer) | YES | ✓ |
| verify | YES (5 agents + synthesizer) | YES | ✓ |
| analyze | YES (4 agents + synthesizer) | YES | ✓ |
| retro | YES (4 agents + synthesizer) | YES | ✓ |
| close | YES (2 agents) | YES | ✓ |

**Controller Pattern**: 7/8 commands delegate properly (87.5%)

### Context Jealousy Check

All delegating commands properly isolate heavy context to sub-agents:
- Sub-agents load context, do work, save YAML, return SUMMARY
- Controllers collect summaries, assemble reports
- No controller loads full codebase

**Context Jealousy**: 7/8 commands compliant (87.5%)

### Verification Gates Check

| Command | Has Validation Gate? | Uses Thresholds? |
|---------|---------------------|------------------|
| plan | ✓ plan:validator | ✓ 70/50 |
| tasks | ✓ tasks:validator | ✓ 70/50 |
| analyze | ✓ synthesizer | ✓ 70/50 |
| verify | ✓ synthesizer | ✓ 90/70 |

**Verification Gates**: 4/4 artifact commands have gates (100%)

**Score**: 22/25

### Findings

- **GAP-V3-004** (Medium): `oharnes.specify` does all work itself without sub-agents. May be intentional for interactive spec creation but violates controller pattern.

---

## Workflow Integrity (20%)

### Flow Completeness

The main pipeline has gaps:

```
specify → plan → tasks → [analyze?] → implement → [verify?] → [retro?] → [close?]
                  ↓              ↑
            speckit.analyze  missing
            (not oharnes)    handoff
```

### Orphaned Agents

All 24 agents are dispatched by their respective commands:

| Family | Agents | All Dispatched? |
|--------|--------|-----------------|
| plan | researcher, validator | ✓ |
| tasks | validator | ✓ |
| implement | scout, verifier, fixer | ✓ |
| verify | task-checker, path-auditor, spec-checker, gate-runner, acceptance-checker, synthesizer | ✓ |
| analyze | duplicate-checker, ambiguity-checker, coverage-mapper, constitution-checker, synthesizer | ✓ |
| retro | timeline-investigator, file-auditor, test-validator, spec-drift, synthesizer | ✓ |
| close | code-investigator, research-agent | ✓ |

**Orphaned Agents**: 0 (100% utilized)

### Circular Dependencies

No circular dependencies detected. All flows are DAGs.

**Score**: 14/20

### Findings

- **GAP-V3-005** (Medium): Inconsistent command family usage - oharnes commands sometimes handoff to speckit commands (tasks→speckit.analyze, specify→speckit.clarify, plan→speckit.checklist)

---

## Regression Safety (10%)

### Original Spec-Kit Concepts Preserved

| Concept | Status | Notes |
|---------|--------|-------|
| specify (create spec) | ✓ | `oharnes.specify` exists |
| plan (create plan) | ✓ | `oharnes.plan` exists |
| tasks (create tasks) | ✓ | `oharnes.tasks` exists |
| implement (execute) | ✓ | `oharnes.implement` exists |
| clarify (resolve ambiguity) | ⚠️ | Only `speckit.clarify` exists, not `oharnes.clarify` |
| analyze (pre-impl check) | ✓ | `oharnes.analyze` exists |
| verify (post-impl check) | ✓ | `oharnes.verify` exists |

### Constitution Integration

`oharnes.analyze:constitution-checker` properly checks against `.specify/memory/constitution.md`

### Template System

Commands reference templates from `.specify/templates/` - system intact.

**Score**: 9/10

### Findings

- Minor: `oharnes.clarify` missing means users must use `speckit.clarify` for clarification flows

---

## Novel Issues (10%)

### Issue 1: Race Conditions in Parallel Writes
**Risk**: LOW
**Description**: Multiple agents write to same folder in parallel (ANALYSIS_FOLDER, VERIFICATION_FOLDER)
**Mitigation**: Each agent writes unique filename - conflict unlikely

### Issue 2: Context Size Explosion
**Risk**: MEDIUM
**Description**: `oharnes.close` loads ALL retro artifacts assuming "~50KB total"
**Location**: `oharnes.close.md:50`
**Mitigation**: Add size guard before loading

### Issue 3: No Rollback Mechanism
**Risk**: MEDIUM
**Description**: If `oharnes.implement` fails midway, tasks.md is partially marked complete with no undo
**Mitigation**: Consider checkpoint/transaction pattern

### Issue 4: Prerequisite Script Fragility
**Risk**: MEDIUM
**Description**: Commands assume `.specify/scripts/bash/*.sh` exist and work. Error handling varies by command.
**Mitigation**: Standardize script error handling

### Issue 5: Constitution File Assumption
**Risk**: LOW
**Description**: `analyze:constitution-checker` assumes constitution.md exists
**Mitigation**: Agent should handle missing file gracefully

### Issue 6: Model Selection for Semantic Tasks
**Risk**: LOW
**Description**: `duplicate-checker` and `ambiguity-checker` use haiku for semantic similarity/detection
**Mitigation**: Monitor quality, upgrade to sonnet if needed

**Score**: 6/10 (deducted for medium-risk issues)

---

## Gap Summary

| ID | Dimension | Severity | Description | File(s) | Fix Suggestion |
|----|-----------|----------|-------------|---------|----------------|
| GAP-V3-001 | Practical | CRITICAL | `oharnes.clarify` referenced but doesn't exist | `oharnes.analyze.md`, `oharnes.specify.md` | Create command or update refs to `speckit.clarify` |
| GAP-V3-002 | Practical | HIGH | `oharnes.tasks` handoffs to `speckit.analyze` | `oharnes.tasks.md:6-7` | Change to `oharnes.analyze` |
| GAP-V3-003 | Practical | HIGH | Missing handoffs: implement→verify, retro→close | `oharnes.implement.md`, `oharnes.retro.md` | Add handoff sections |
| GAP-V3-004 | Philosophy | MEDIUM | `oharnes.specify` doesn't use sub-agents | `oharnes.specify.md` | Document as intentional exception or refactor |
| GAP-V3-005 | Workflow | MEDIUM | Inconsistent command families in handoffs | Multiple | Decide: oharnes self-contained or uses speckit? |

---

## Scoring Summary

| Dimension | Weight | Score | Weighted |
|-----------|--------|-------|----------|
| Practical Readiness | 35% | 25/35 (71%) | 25.0 |
| Philosophy Alignment | 25% | 22/25 (88%) | 22.0 |
| Workflow Integrity | 20% | 14/20 (70%) | 14.0 |
| Regression Safety | 10% | 9/10 (90%) | 9.0 |
| Novel Issues | 10% | 6/10 (60%) | 6.0 |
| **TOTAL** | **100%** | | **76/100** |

---

## Verdict

**NEEDS_FIXES** - The oharnes system is architecturally sound but has critical workflow breaks that prevent end-to-end usage.

### Before Building On Top

**Must Fix** (Blocking):
1. **GAP-V3-001**: Create `oharnes.clarify` command OR update all references to use `speckit.clarify`
2. **GAP-V3-003**: Add handoffs to `oharnes.implement` (→verify) and `oharnes.retro` (→close)

**Should Fix** (Important):
3. **GAP-V3-002**: Update `oharnes.tasks` handoff from `speckit.analyze` to `oharnes.analyze`
4. **GAP-V3-005**: Document or resolve the oharnes/speckit command family mixing

**Can Defer**:
5. **GAP-V3-004**: Document `oharnes.specify` as intentional exception to controller pattern
6. Novel issues (context size, rollback, etc.)

### Estimated Fix Effort

| Gap | Effort | Time |
|-----|--------|------|
| GAP-V3-001 | Low | 10 mins (if updating refs) or Medium (if creating command) |
| GAP-V3-002 | Low | 2 mins |
| GAP-V3-003 | Low | 5 mins |
| GAP-V3-005 | Low | 5 mins (documentation) |

**Total**: ~20-30 minutes to reach READY_TO_BUILD status.

---

## Handoff: Fix Instructions

If fixing these gaps:

### Fix GAP-V3-001 (Critical)
Option A - Update references to use speckit.clarify:
```bash
# In oharnes.analyze.md
# Line 10: Change agent: oharnes.clarify → agent: speckit.clarify
# Lines 136, 143, 254: Change /oharnes.clarify → /speckit.clarify

# In oharnes.specify.md
# Lines 140, 194: Change /oharnes.clarify → /speckit.clarify
```

Option B - Create oharnes.clarify:
```bash
# Copy speckit.clarify.md to oharnes.clarify.md
# Update name field and handoffs
```

### Fix GAP-V3-002 (High)
```bash
# In oharnes.tasks.md line 6-7:
# Change: agent: speckit.analyze
# To:     agent: oharnes.analyze
```

### Fix GAP-V3-003 (High)
```yaml
# Add to oharnes.implement.md after line 4:
handoffs:
  - label: Verify Implementation
    agent: oharnes.verify
    prompt: Verify the implementation matches specification
    send: true

# Add to oharnes.retro.md after line 4:
handoffs:
  - label: Close Retrospective Cycle
    agent: oharnes.close
    prompt: Make decisions on retrospective findings
    send: true
```

---

## Fixes Applied (2025-12-26)

All critical and high-severity gaps have been resolved:

| Gap | Status | Action Taken |
|-----|--------|--------------|
| GAP-V3-001 | ✓ FIXED | Removed all `oharnes.clarify` references (intentionally not implementing clarify) |
| GAP-V3-002 | ✓ FIXED | Changed `oharnes.tasks` handoff from `speckit.analyze` to `oharnes.analyze` |
| GAP-V3-003 | ✓ FIXED | Added handoffs: `oharnes.implement`→`verify`, `oharnes.retro`→`close` |
| GAP-V3-004 | DOCUMENTED | `oharnes.specify` is intentional exception (interactive spec creation) |
| GAP-V3-005 | ✓ FIXED | Removed all speckit handoffs from oharnes commands |

### Additional Enhancement
- Added commit checkpoint to `oharnes.analyze` before handoff to implement
- User is prompted to commit spec artifacts before implementation begins
- Provides clean rollback point if implementation needs to be reverted

### Post-Fix Scoring

| Dimension | Weight | Original | Post-Fix | Weighted |
|-----------|--------|----------|----------|----------|
| Practical Readiness | 35% | 25/35 | 34/35 | 34.0 |
| Philosophy Alignment | 25% | 22/25 | 22/25 | 22.0 |
| Workflow Integrity | 20% | 14/20 | 19/20 | 19.0 |
| Regression Safety | 10% | 9/10 | 9/10 | 9.0 |
| Novel Issues | 10% | 6/10 | 8/10 | 8.0 |
| **TOTAL** | **100%** | **76** | **92** | **92/100** |

### User Decisions Incorporated
1. **Clarify**: Intentionally NOT implementing (sub-agent verification makes it redundant)
2. **Speckit mixing**: Removed all speckit handoffs from oharnes commands
3. **Commit flow**: Ask user before committing (not auto-commit)
4. **MVP scope**: Not handling rollback, script fragility, constitution assumptions

---

## Final Verdict

**READY_TO_BUILD** - The oharnes command/agent system is now ready for use and extension.

### End-to-End Flow (Post-Fix)

```
/oharnes.specify → /oharnes.plan → /oharnes.tasks → /oharnes.analyze → /oharnes.implement → /oharnes.verify
                                                            ↓                                      ↓
                                                      [commit checkpoint]                   [if fail: /oharnes.retro → /oharnes.close]
```

---

**Generated by**: /oharnes Spirit Audit v3
**Date**: 2025-12-26
**Checkpoint**: `specs/backlog/oharnes-spirit-audit-v3-checkpoint.md`
