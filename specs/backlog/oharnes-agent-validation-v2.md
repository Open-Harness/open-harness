# Handoff: Agent System Validation Review v2

**Created**: 2025-12-26
**Purpose**: Fresh-context comprehensive review of ALL oharnes agents with improved methodology
**Approach**: NO sub-agents - all validation in main prompt context

---

## IMPORTANT: This is v2

The previous validation (v1) fixed 11 gaps. This review should:
1. Verify those fixes are correct
2. Find any gaps that were missed
3. Analyze a NEW dimension: **Tool Permissions**

Read the commit that preceded this handoff to understand what was fixed:
```bash
git show HEAD --stat
git show HEAD
```

---

## The Canonical Pattern

Before analyzing agents, you MUST understand the established pattern from `oharnes.retro`:

### Controller Pattern
```
Controller creates folder → passes {FOLDER} variable → agents save to {FOLDER}/*.yaml → synthesizer reads from {FOLDER}/
```

### Agent Pattern
```yaml
Input: Variables passed via prompt (including folder paths)
Workflow: Steps using declared tools
Output:
  - SUMMARY to stdout (for controller)
  - YAML to {FOLDER}/{name}.yaml (for synthesizer)
```

### Tool Scoping
| Agent Type | Expected Tools | Model |
|------------|---------------|-------|
| Auditor (checks existence) | Read, Glob, Grep | haiku |
| Analyzer (understands content) | Read, Glob, Grep | sonnet |
| Runner (executes commands) | Read, Bash, Glob | haiku |
| Writer (modifies files) | Read, Write, Edit, Grep, Glob | sonnet |
| Synthesizer (aggregates) | Read (maybe Write for report) | sonnet |

---

## NEW DIMENSION: Tool Permissions Analysis

**Critical Question**: Does each agent have the tools it needs to do its job?

For EACH agent, you must verify:

### 1. Tool Sufficiency
- List every action the agent's workflow describes
- For each action, identify what tool is required
- Check if that tool is in the agent's `tools:` declaration
- Flag if missing

### 2. Tool Excess
- Are there tools declared that the agent never uses?
- Extra tools increase risk (agent could do unintended things)
- Flag unnecessary tools

### 3. Tool-Action Mapping Table
Create this for each agent:
```markdown
| Workflow Step | Action | Required Tool | Declared? |
|--------------|--------|---------------|-----------|
| 1. Load plan.md | Read file | Read | ✓ |
| 2. Run gates | Execute bash | Bash | ✓ |
| 3. Save YAML | Write file | Write | ✗ MISSING |
```

---

## Files to Review

### Guidelines (Read First)
```
.claude/CLAUDE.md
```

### Commands (Controllers)
```
.claude/commands/oharnes.analyze.md
.claude/commands/oharnes.verify.md
.claude/commands/oharnes.implement.md
.claude/commands/oharnes.plan.md
.claude/commands/oharnes.tasks.md
.claude/commands/oharnes.retro.md  (reference pattern)
```

### oharnes.analyze Agents (5)
```
.claude/agents/oharnes.analyze-duplicate-checker.md
.claude/agents/oharnes.analyze-ambiguity-checker.md
.claude/agents/oharnes.analyze-coverage-mapper.md
.claude/agents/oharnes.analyze-constitution-checker.md
.claude/agents/oharnes.analyze-synthesizer.md
```

### oharnes.verify Agents (6)
```
.claude/agents/oharnes.verify-task-checker.md
.claude/agents/oharnes.verify-path-auditor.md
.claude/agents/oharnes.verify-spec-checker.md
.claude/agents/oharnes.verify-gate-runner.md
.claude/agents/oharnes.verify-acceptance-checker.md
.claude/agents/oharnes.verify-synthesizer.md
```

### oharnes.implement Agents (3)
```
.claude/agents/oharnes.implement-scout.md
.claude/agents/oharnes.implement-verifier.md
.claude/agents/oharnes.implement-fixer.md
```

### oharnes.plan/tasks Agents (2)
```
.claude/agents/oharnes.plan-validator.md
.claude/agents/oharnes.tasks-validator.md
```

### oharnes.retro Agents (Reference - for pattern comparison)
```
.claude/agents/oharnes.retro-*.md
```

---

## Validation Dimensions

### Dimension 1: Input Completeness
For each agent, verify:
- [ ] All variables in "Input" section are passed by controller dispatch
- [ ] No assumptions about files that aren't explicitly provided
- [ ] Folder paths use variables, not hardcoded paths

### Dimension 2: Output Contract
For each agent, verify:
- [ ] SUMMARY format matches what controller expects
- [ ] YAML filename matches what synthesizer expects
- [ ] YAML schema includes all fields downstream needs

### Dimension 3: Tool Permissions (NEW)
For each agent, create table:
- [ ] All workflow actions have required tools declared
- [ ] No unused tools declared
- [ ] Model selection appropriate for tool complexity

### Dimension 4: Workflow Executability
For each agent, verify:
- [ ] Every step can be performed with declared tools
- [ ] Steps reference correct file paths (using variables)
- [ ] No ambiguous instructions ("extract X from Y" needs format)

### Dimension 5: Error Handling
For each agent, verify:
- [ ] What happens when files don't exist?
- [ ] What happens when patterns match nothing?
- [ ] What happens when commands fail?

### Dimension 6: Integration Points
For each agent, verify:
- [ ] Input matches upstream controller's dispatch
- [ ] Output matches downstream synthesizer's expectations
- [ ] Naming conventions consistent

---

## Output Format

Produce a structured report with these sections:

### 1. Executive Summary
```markdown
## Executive Summary

**Agents Reviewed**: X
**Gaps Found**: Y (Z critical, W high, V medium, U low)
**Tool Permission Issues**: N

**Overall Assessment**: [PASS | NEEDS_FIXES | CRITICAL_ISSUES]
```

### 2. Tool Permission Audit
For each agent that has issues:
```markdown
### Agent: oharnes.verify:gate-runner

**Declared Tools**: Read, Bash, Glob
**Model**: haiku

| Workflow Step | Action | Required Tool | Status |
|--------------|--------|---------------|--------|
| Load plan.md | Read file | Read | ✓ |
| Run gate command | Execute bash | Bash | ✓ |
| Save YAML | Write file | Write | ✗ MISSING |

**Issue**: Agent declares it will "Save to File" but lacks Write tool.
**Recommendation**: Add Write to tools, OR change output protocol to return YAML via stdout.
```

### 3. Gap Analysis
For each gap found:
```markdown
### GAP-XXX: [Title]

**File**: [path]
**Severity**: critical | high | medium | low
**Dimension**: [which validation dimension]

**Description**: [what's wrong]
**Evidence**: [quote from file with line reference]
**Impact**: [what breaks if unfixed]

**Fix Options**:
- **Option A**: [approach] - Pros: ... Cons: ...
- **Option B**: [approach] - Pros: ... Cons: ...

**Recommendation**: [which option and why]
```

### 4. v1 Fix Verification
Confirm the 11 fixes from v1 are correct:
```markdown
## v1 Fix Verification

| Gap# | Description | Fixed Correctly? | Notes |
|------|-------------|------------------|-------|
| 1 | ambiguity-checker file save | ✓ | Now saves to {ANALYSIS_FOLDER}/ambiguities.yaml |
| 2 | coverage-mapper path | ✓ | ... |
...
```

### 5. Priority Order
List gaps in order of fix priority with reasoning.

### 6. Summary Table
```markdown
| Agent | Inputs OK? | Outputs OK? | Tools OK? | Workflow OK? | Errors OK? | Integration OK? |
|-------|------------|-------------|-----------|--------------|------------|-----------------|
| analyze:duplicate-checker | ✓ | ✓ | ✓ | ✓ | ⚠ | ✓ |
| ... | ... | ... | ... | ... | ... | ... |
```

---

## Known Issues From v1 (Already Fixed - Verify)

1. **Path Inconsistencies**: Agents were saving to wrong folders/filenames
2. **Missing Input Variables**: Controller dispatches missing required variables
3. **Gate Runner Parsing**: No explicit parsing logic for plan.md format
4. **No Acceptance Checker**: Behavioral verification was missing
5. **Synthesizer Bounds**: No floor/ceiling or missing-input handling

These should now be fixed. Verify they are correct.

---

## Suspected Issues to Investigate

Based on v1 analysis, these areas need scrutiny:

### 1. Write Tool Missing?
Several agents say "Save to File" but may only have Read tool.
Check: Do agents that write files have Write tool?

### 2. Bash Tool for Gates
Gate-runner needs Bash to execute commands.
Check: Does it have Bash? Is haiku appropriate for parsing + execution?

### 3. Model Selection
Some complex analysis (like coverage mapping) uses haiku.
Check: Are models appropriate for task complexity?

### 4. Synthesizers Writing Reports
Synthesizers generate both YAML and markdown reports.
Check: Do they have Write tool?

### 5. Scout Agent Read Scope
Scout determines what files to read - but does it have tools to search codebase?
Check: Does scout have Glob/Grep for finding relevant files?

---

## How to Conduct This Review

1. **Read the guidelines first**: `.claude/CLAUDE.md`

2. **Read one controller, then its agents**: Trace the data flow

3. **For each agent, fill out the checklist**:
   ```markdown
   Agent: oharnes.X:Y

   Inputs:
   - [ ] All variables passed by controller
   - [ ] Folder paths use variables

   Outputs:
   - [ ] SUMMARY format correct
   - [ ] YAML path uses variable
   - [ ] YAML has all required fields

   Tools:
   - [ ] Read actions → Read tool
   - [ ] Write actions → Write tool
   - [ ] Bash actions → Bash tool
   - [ ] Search actions → Glob/Grep tools
   - [ ] No excess tools

   Workflow:
   - [ ] All steps executable
   - [ ] Paths use variables
   - [ ] Formats specified

   Errors:
   - [ ] Missing file handling
   - [ ] Empty result handling
   - [ ] Command failure handling
   ```

4. **Create tool-action mapping tables** for each agent

5. **Compare to retro agents** as the reference pattern

6. **Present findings with options** using AskUserQuestion

---

## Critical: Don't Repeat v1 Mistakes

v1 initially missed gaps because of:
1. Looking at agents in isolation (not tracing controller → agent → synthesizer)
2. Not understanding the canonical pattern from oharnes.retro
3. Not checking if declared tools match required actions

This review MUST:
- Trace full data flow for each command
- Compare every agent to the retro pattern
- Verify tool declarations match workflow needs
- Use *TEO methodology (Think, Explain, Options)

---

## Expected Outcome

After this review, we should have:
1. Confirmation that v1 fixes are correct
2. Any additional gaps identified
3. Tool permission analysis for all agents
4. Clear fix recommendations with options
5. Confidence the agent system is ready for use

---

**Handoff created by**: Agent validation session v1
**Date**: 2025-12-26
**Ready for**: Fresh context comprehensive review with tool permissions focus
