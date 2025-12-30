# Handoff: Comprehensive Agent Validation Review

**Created**: 2025-12-26
**Purpose**: Fresh-context review of all oharnes.analyze and oharnes.verify agents with no assumptions
**Approach**: NO sub-agents - all validation in main prompt context

---

## CRITICAL CONTEXT

We just created 12 agent files for two new oharnes commands. This is HIGH RISK because:
1. We're creating many agents and relying heavily on them
2. It's difficult to validate these manually
3. Gaps in agent design will propagate to every feature cycle that uses them
4. Sub-agents can't easily be tested until they're invoked

**Your job**: Review everything with FRESH EYES. Assume nothing works correctly. Find the gaps.

---

## User Feedback to Address

### Issue 1: Implementation Fixer Doesn't Know What Commands to Run

**File**: `.claude/agents/oharnes.implement-fixer.md`

**Problem**: The fixer agent receives errors but how does it know:
- What commands to run to check if fix worked?
- What the original command was that produced the error?
- How to re-run verification after fixing?

**Question to answer**: Where does the fixer get the commands it needs to verify its fixes?

---

### Issue 2: Verify Agents Aren't Really Verifying Implementation

**Files**: All `oharnes.verify-*.md` agents

**Problem**: The current "verification" just checks:
- Do paths exist? (path-auditor)
- Are tasks marked [X]? (task-checker)
- Do FR-XXX have grep matches? (spec-checker)

**What's missing**: Actual implementation verification using:
- Verification steps defined in tasks.md
- User story acceptance criteria from spec.md
- Expected behaviors, not just file existence
- Running actual tests against acceptance criteria

**Question to answer**: How should verification agents actually verify that implementation WORKS, not just EXISTS?

---

### Issue 3: Validators Need Explicit Rubrics

**Files**:
- `.claude/agents/oharnes.plan-validator.md`
- `.claude/agents/oharnes.tasks-validator.md`
- `.claude/agents/oharnes.analyze-synthesizer.md`
- `.claude/agents/oharnes.verify-synthesizer.md`

**Problem**: Validators need clear rubrics:
- What are the exact validation criteria?
- How is each criterion weighted?
- What determines pass/fail for each check?
- How is the final score calculated?

**Question to answer**: Does each validator have an explicit, reproducible scoring rubric?

---

### Issue 4: Gate Runner Doesn't Know What Commands to Run

**File**: `.claude/agents/oharnes.verify-gate-runner.md`

**Problem**: The agent says it will "extract gate commands from plan.md" but:
- What if plan.md doesn't have a Verification Gates section?
- What's the fallback?
- What are the default commands?
- How does it know the project's test runner (bun? npm? jest?)?

**Question to answer**: Where do gate commands come from and what happens when they're not specified?

---

## Files to Review

### Commands (2 files)
```
.claude/commands/oharnes.analyze.md
.claude/commands/oharnes.verify.md
```

### oharnes.analyze Agents (5 files)
```
.claude/agents/oharnes.analyze-duplicate-checker.md
.claude/agents/oharnes.analyze-ambiguity-checker.md
.claude/agents/oharnes.analyze-coverage-mapper.md
.claude/agents/oharnes.analyze-constitution-checker.md
.claude/agents/oharnes.analyze-synthesizer.md
```

### oharnes.verify Agents (5 files)
```
.claude/agents/oharnes.verify-task-checker.md
.claude/agents/oharnes.verify-path-auditor.md
.claude/agents/oharnes.verify-spec-checker.md
.claude/agents/oharnes.verify-gate-runner.md
.claude/agents/oharnes.verify-synthesizer.md
```

### Related Agents to Check (for context)
```
.claude/agents/oharnes.implement-fixer.md
.claude/agents/oharnes.implement-scout.md
.claude/agents/oharnes.implement-verifier.md
.claude/agents/oharnes.plan-validator.md
.claude/agents/oharnes.tasks-validator.md
```

---

## Validation Checklist

For EACH agent file, answer these questions:

### 1. Input Completeness
- [ ] Does the agent receive ALL information it needs via prompt?
- [ ] Are there any assumptions about what it can read that aren't passed in?
- [ ] If it needs commands to run, where do those come from?

### 2. Workflow Gaps
- [ ] Can every step in the workflow actually be executed?
- [ ] Are there any steps that say "extract X from Y" without specifying the format?
- [ ] What happens when expected data is missing?

### 3. Scoring Rubrics
- [ ] Is there an explicit scoring rubric with weights?
- [ ] Can two runs of the same agent produce the same score?
- [ ] Are thresholds clearly defined (what score = pass, fail, etc.)?

### 4. Output Protocol
- [ ] Does the SUMMARY format match what the controller expects?
- [ ] Are file paths consistent across related agents?
- [ ] Does the YAML schema include all fields the synthesizer needs?

### 5. Error Handling
- [ ] What happens when a file doesn't exist?
- [ ] What happens when a pattern isn't found?
- [ ] What happens when a command fails?

### 6. Integration Points
- [ ] Does this agent's output match what downstream agents expect?
- [ ] Does this agent's input match what upstream controllers provide?
- [ ] Are naming conventions consistent?

---

## What to Produce

After reviewing all files, produce:

### 1. Gap Analysis Table

| File | Gap Description | Severity | Impact if Unfixed |
|------|-----------------|----------|-------------------|
| ... | ... | critical/high/medium/low | ... |

### 2. For Each Gap, Provide Fix Options

```
GAP: [description]
FILE: [path]

OPTION A: [fix approach]
- Pros: ...
- Cons: ...

OPTION B: [fix approach]
- Pros: ...
- Cons: ...

RECOMMENDATION: [which option and why]
```

### 3. Priority Order

Which gaps should be fixed FIRST based on:
- Blocking other functionality
- Risk of silent failures
- Impact on user experience

---

## How to Conduct This Review

1. **Read each file completely** - Don't skim. Read every line.

2. **Trace the data flow** - Where does input come from? Where does output go?

3. **Ask "how does it know?"** - For every action the agent takes, ask how it knows what to do.

4. **Look for implicit assumptions** - Things the agent assumes exist but aren't guaranteed.

5. **Check integration points** - Does agent A's output match agent B's expected input?

6. **Question the scoring** - Is there a clear formula? Can it be reproduced?

7. **Test the unhappy paths** - What happens when things go wrong?

---

## Files to Read in Order

1. First, read the guidelines: `.claude/CLAUDE.md`
2. Read the original handoff: `specs/backlog/oharnes-analyze-verify-handoff.md`
3. Read the retrospective source: `specs/backlog/003-next-cycle-inputs.md`
4. Then read each command and its agents in this order:
   - oharnes.analyze.md (controller)
   - oharnes.analyze-*.md (all 5 agents)
   - oharnes.verify.md (controller)
   - oharnes.verify-*.md (all 5 agents)
5. Finally read the implement agents for context:
   - oharnes.implement-fixer.md
   - oharnes.implement-verifier.md

---

## Expected Output Format

```markdown
# Agent Validation Report

## Executive Summary
- Total gaps found: X
- Critical: X
- High: X
- Medium: X
- Low: X

## Gap Analysis

### GAP-001: [Title]
**File**: [path]
**Severity**: critical/high/medium/low
**Description**: [what's wrong]
**Impact**: [what breaks if unfixed]

**Fix Options**:
- **Option A**: [approach]
- **Option B**: [approach]

**Recommendation**: [which option and why]

### GAP-002: [Title]
...

## Priority Order

1. [GAP-XXX] - [reason it's first]
2. [GAP-XXX] - [reason]
...

## Summary of Recommended Fixes

| Gap | Recommended Fix | Effort | Files to Modify |
|-----|-----------------|--------|-----------------|
| ... | ... | low/medium/high | ... |
```

---

## IMPORTANT REMINDERS

1. **NO SUB-AGENTS** - Do all analysis yourself in this context
2. **ASSUME NOTHING** - Read every file, don't trust previous validation
3. **FIND YOUR OWN ISSUES** - Don't limit yourself to the issues listed above
4. **BE SPECIFIC** - Cite line numbers, quote text, show exactly what's wrong
5. **PROVIDE OPTIONS** - Don't just find problems, provide solutions

---

**Handoff created by**: oharnes development session
**Date**: 2025-12-26
**Ready for**: Fresh context comprehensive review
