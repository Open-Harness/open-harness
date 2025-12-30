# Agent Validation Report v2

**Date**: 2025-12-26
**Reviewer**: Claude Opus 4.5
**Methodology**: Full Systematic (4 phases)

---

## Executive Summary

**Agents Reviewed**: 19 (across 5 command families)
**v1 Fixes Verified**: 11/11 correct ✓
**NEW Gaps Found**: 4 (1 critical, 2 medium, 1 low)
**Tool Permission Issues**: 11 agents

**Overall Assessment**: **NEEDS_FIXES** - Critical tool permission gap affects 11 agents

---

## Tool Permission Audit

### Critical Finding: Write Tool Missing

| Agent | Declared Tools | Says "Save to File" | Status |
|-------|---------------|---------------------|--------|
| retro:timeline-investigator | Bash, Read, Glob | YES | **✗ MISSING Write** |
| retro:file-auditor | Read, Glob, Bash | YES | **✗ MISSING Write** |
| retro:test-validator | Bash, Read, Glob | YES | **✗ MISSING Write** |
| retro:spec-drift | Read, Grep, Glob | YES | **✗ MISSING Write** |
| retro:synthesizer | Read | YES | **✗ CRITICAL: Only Read** |
| analyze:duplicate-checker | Read, Glob, Grep | YES | **✗ MISSING Write** |
| analyze:ambiguity-checker | Read, Glob, Grep | YES | **✗ MISSING Write** |
| analyze:coverage-mapper | Read, Grep, Glob | YES | **✗ MISSING Write** |
| analyze:constitution-checker | Read, Glob, Grep | YES | **✗ MISSING Write** |
| analyze:synthesizer | Read | YES | **✗ CRITICAL: Only Read** |
| verify:task-checker | Read, Grep, Glob | YES | **✗ MISSING Write** |
| verify:path-auditor | Read, Glob, Bash | YES | **✗ MISSING Write** |
| verify:spec-checker | Read, Grep, Glob | YES | **✗ MISSING Write** |
| verify:gate-runner | Read, Bash, Glob | YES | **✗ MISSING Write** |
| verify:acceptance-checker | Read, Bash, Glob, Grep | YES | **✗ MISSING Write** |
| verify:synthesizer | Read, Write | YES | **✓ Has Write** |
| implement:fixer | Read, Write, Edit, Grep, Glob | YES | **✓ Has Write+Edit** |

---

## Gap Analysis

### GAP-V2-001: 11 Agents Lack Write Tool

**Severity**: CRITICAL
**Dimension**: Tool Permissions
**Affected**: 11 agents across retro, analyze, verify families

**Description**: Agents have "Save to File" in their Output Protocol but lack Write in tools declaration. They would need to use Bash with heredocs/echo, which is fragile for complex YAML.

**Evidence**:
- `analyze:synthesizer` (line 5): `tools: Read` - cannot write synthesis.yaml
- `retro:synthesizer` (line 5): `tools: Read` - cannot write synthesis.yaml
- All 4 analyze checker agents: `tools: Read, Glob, Grep` - cannot write findings

**Impact**: Agents cannot create their output files, breaking the controller → agent → synthesizer pipeline.

**Fix**: Add Write tool to all 11 agents.

---

### GAP-V2-002: spec-checker Missing VERIFICATION_FOLDER in Input

**Severity**: Medium
**Dimension**: Input Completeness
**File**: `.claude/agents/oharnes.verify-spec-checker.md`

**Description**: Agent's Input section doesn't list VERIFICATION_FOLDER, but controller sends it and agent's Output Protocol uses hardcoded path.

**Evidence**:
- Input section (lines 16-21): No VERIFICATION_FOLDER listed
- Output Protocol (line 59): `{FEATURE_DIR}/verification/spec-check.yaml` (hardcoded)
- Controller dispatch (line 85): Sends VERIFICATION_FOLDER

**Impact**: Minor - hardcoded path works, but inconsistent with other agents.

**Fix**: Add VERIFICATION_FOLDER to Input section, use variable in Output Protocol.

---

### GAP-V2-003: plan:validator Uses Opus (Expensive)

**Severity**: Low
**Dimension**: Model Selection
**File**: `.claude/agents/oharnes.plan-validator.md`

**Description**: Plan validator uses opus model for validation task that could use sonnet.

**Evidence**: Line 6: `model: opus`

**Impact**: Higher API costs for validation that doesn't require opus-level reasoning.

**Fix**: Change to `model: sonnet`.

---

### GAP-V2-004: Analyze Agents FEATURE_DIR vs ANALYSIS_FOLDER Mismatch

**Severity**: Medium
**Dimension**: Input Completeness
**Affected**: duplicate-checker, ambiguity-checker, coverage-mapper

**Description**: Agents document FEATURE_DIR in Input section but controller sends ANALYSIS_FOLDER. Agents use ANALYSIS_FOLDER correctly but documentation is inconsistent.

**Evidence**:
- duplicate-checker Input (line 18): Lists FEATURE_DIR
- Controller dispatch (line 75): Sends ANALYSIS_FOLDER, not FEATURE_DIR

**Impact**: Documentation confusion, but runtime works because controller dispatch overrides.

**Fix**: Update Input sections to match what controller actually sends.

---

## v1 Fix Verification

| Gap# | Description | Fixed Correctly? | Notes |
|------|-------------|------------------|-------|
| 1 | ambiguity-checker file save | ✓ | Path uses ANALYSIS_FOLDER |
| 2 | coverage-mapper path | ✓ | Correct filename |
| 3 | constitution-checker filename | ✓ | constitution.yaml |
| 4 | verify agents VERIFICATION_FOLDER | ✓ | All use variable |
| 5 | CONSTITUTION_PATH dispatch | ✓ | Line 97 in controller |
| 6 | PLAN_PATH, TASKS_PATH to spec-checker | ✓ | Lines 81-84 |
| 7 | Gate Runner parsing | ✓ | Explicit instructions |
| 8 | acceptance-checker created | ✓ | Well-structured agent |
| 9 | Synthesizer weights | ✓ | 25% acceptance |
| 10 | Score bounds | ✓ | Both synthesizers |
| 11 | Missing-input handling | ✓ | Both synthesizers |

**All v1 fixes verified correct.**

---

## Priority Order

1. **GAP-V2-001** (CRITICAL): Add Write tool to 11 agents
2. **GAP-V2-004** (Medium): Fix Input section documentation for analyze agents
3. **GAP-V2-002** (Medium): Add VERIFICATION_FOLDER to spec-checker Input
4. **GAP-V2-003** (Low): Change plan:validator to sonnet

---

## Summary Table

| Agent | Inputs OK? | Outputs OK? | Tools OK? | Workflow OK? | Errors OK? | Integration OK? |
|-------|------------|-------------|-----------|--------------|------------|-----------------|
| analyze:duplicate-checker | ⚠ | ✓ | **✗** | ✓ | ✓ | ✓ |
| analyze:ambiguity-checker | ⚠ | ✓ | **✗** | ✓ | ✓ | ✓ |
| analyze:coverage-mapper | ⚠ | ✓ | **✗** | ✓ | ✓ | ✓ |
| analyze:constitution-checker | ✓ | ✓ | **✗** | ✓ | ✓ | ✓ |
| analyze:synthesizer | ✓ | ✓ | **✗** | ✓ | ✓ | ✓ |
| verify:task-checker | ✓ | ✓ | **✗** | ✓ | ✓ | ✓ |
| verify:path-auditor | ✓ | ✓ | **✗** | ✓ | ✓ | ✓ |
| verify:spec-checker | ⚠ | ⚠ | **✗** | ✓ | ✓ | ✓ |
| verify:gate-runner | ✓ | ✓ | **✗** | ✓ | ✓ | ✓ |
| verify:acceptance-checker | ✓ | ✓ | **✗** | ✓ | ✓ | ✓ |
| verify:synthesizer | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| implement:scout | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| implement:verifier | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| implement:fixer | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| plan:researcher | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| plan:validator | ✓ | ✓ | ✓ | ✓ | ✓ | ⚠ (opus) |
| tasks:validator | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| retro:timeline-investigator | ✓ | ✓ | **✗** | ✓ | ✓ | ✓ |
| retro:file-auditor | ✓ | ✓ | **✗** | ✓ | ✓ | ✓ |
| retro:test-validator | ✓ | ✓ | **✗** | ✓ | ✓ | ✓ |
| retro:spec-drift | ✓ | ✓ | **✗** | ✓ | ✓ | ✓ |
| retro:synthesizer | ✓ | ✓ | **✗** | ✓ | ✓ | ✓ |

---

## Next Steps

1. Add Write tool to all 11 affected agents
2. Update Input section documentation for consistency
3. Change plan:validator model from opus to sonnet

---

**Generated by**: Agent Validation v2 session
**Date**: 2025-12-26
