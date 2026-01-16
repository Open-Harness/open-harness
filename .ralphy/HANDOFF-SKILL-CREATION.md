# Handoff: Create Ralphy Skill with Structural Validation

## Context

You are building a Claude Code skill for orchestrating Ralphy (autonomous AI coding loop). This skill must prevent a **recurring failure mode** where task lists violate project rules.

### The Problem We're Solving

Twice now, task lists have been created that allow mocks despite explicit rules forbidding them:

**Evidence from `.ralphy/tasks.yaml`:**
```yaml
NOTE: These tests may use mock harnesses. That's OK for testing the
recording/replay mechanics.
```

**But CLAUDE.md says:**
```
You are NOT allowed to fabricate fixtures.
Create fixtures from REAL SDK responses, not fabricated data.
```

**Root Cause:** Manual task creation without structural validation allows rules to be rationalized away.

---

## Your Mission

Create a `/ralphy` skill that:
1. Guides interactive PRD creation
2. Generates Ralphy-compatible task lists
3. **Validates task lists against a constitution BEFORE execution**
4. Prevents the mock-allowing failure mode structurally

---

## Reference Pattern: oharnes

Read these files to understand the patterns:
- `.claude/CLAUDE.md` - Controller pattern, validation gates, sub-agent architecture
- `.claude/commands/oharnes.analyze.md` - Controller orchestration example
- `.claude/agents/oharnes.analyze-constitution-checker.md` - Constitution validation example

**Key Patterns to Adopt:**
1. Controller dispatches sub-agents, doesn't do heavy work itself
2. Constitution with MUST/SHOULD rules
3. Validation gate that blocks on critical violations
4. Parallel agent dispatch for independent checks

---

## Artifacts to Create

### 1. Constitution: `.ralphy/constitution.md`

Machine-checkable rules. Format:

```markdown
# Ralphy Constitution

## MUST Rules (Critical - Block on Violation)

### MUST-001: No Mock Fixtures
Tasks MUST NOT allow mock fixtures, fake data, or stub implementations for integration tests.

**Grep patterns that indicate violation:**
- "mock harness"
- "fake.*fixture"
- "stub.*response"
- "That's OK for testing"
- "Real integration requires"

### MUST-002: Golden Recording Required
Any feature involving recording/replay MUST include a task to:
1. Run against real external system
2. Save recording to fixtures/
3. Commit recording to repo

### MUST-003: CLAUDE.md Compliance
Tasks MUST NOT contradict rules in CLAUDE.md.

## SHOULD Rules (Medium - Warn Only)

### SHOULD-001: Explicit Verification Steps
Tasks SHOULD include explicit verification commands, not just "verify it works."
```

### 2. Skill Entry Point: `.claude/skills/ralphy/SKILL.md`

```markdown
# Ralphy Skill

Orchestrate Ralphy autonomous coding loop with structural validation.

## When to Use
- Creating PRDs for Ralphy
- Generating task lists
- Validating existing task lists
- Running Ralphy workflows

## Commands
- `/ralphy create` - Interactive PRD creation
- `/ralphy validate` - Validate task list against constitution
- `/ralphy run` - Execute task list (validates first)
```

### 3. Controller Command: `.claude/commands/ralphy.md`

Follow oharnes.analyze pattern:
1. Parse user intent (create/validate/run)
2. Dispatch appropriate sub-agent
3. Collect results
4. Apply validation gate
5. Proceed or block

### 4. Sub-Agents

#### `ralphy:prd-creator`
- Interactive PRD creation
- Asks clarifying questions
- Outputs Ralphy-compatible PRD structure
- Tools: Read, AskUserQuestion

#### `ralphy:task-generator`
- Converts PRD to task list
- Generates `.ralphy/tasks.yaml`
- Tools: Read, Write, Glob

#### `ralphy:task-validator`
- Checks task list against constitution
- Greps for violation patterns
- Returns PASS/BLOCK with evidence
- Tools: Read, Grep, Glob
- Model: haiku (fast validation)

#### `ralphy:golden-recorder` (optional)
- Runs recording against real systems
- Saves to fixtures/
- Tools: Read, Write, Bash

---

## Validation Gate Logic

```
1. Run ralphy:task-validator
2. If ANY MUST violation → BLOCK
   - Show evidence
   - User must fix before proceeding
3. If SHOULD violations only → WARN + PROCEED
4. If clean → PROCEED
```

---

## Critical Rules for Task Generation

When `ralphy:task-generator` creates tasks, it MUST:

1. **Never include mock-allowing language**
   - NO: "That's OK for testing"
   - NO: "Mock harnesses acceptable"
   - YES: "Run against REAL system"
   - YES: "NO MOCKS. Period."

2. **Include explicit golden recording tasks**
   ```yaml
   - title: "Create golden recording from real Claude"
     details: |
       1. Run: bun run prd:record examples/hello.prd.md
       2. This MUST call real Claude API
       3. Note recording ID
       4. Commit recording to fixtures/
       NO MOCKS. This is a REAL recording.
   ```

3. **Reference CLAUDE.md rules explicitly**
   ```yaml
   - title: "..."
     details: |
       Per CLAUDE.md: "Create fixtures from REAL SDK responses"
       ...
   ```

---

## File Structure

```
.claude/
├── skills/
│   └── ralphy/
│       └── SKILL.md
├── commands/
│   └── ralphy.md
└── agents/
    ├── ralphy-prd-creator.md
    ├── ralphy-task-generator.md
    └── ralphy-task-validator.md

.ralphy/
├── constitution.md
├── config.yaml (existing)
└── tasks.yaml (generated)
```

---

## Acceptance Criteria

1. `/ralphy validate` catches mock-allowing language in task lists
2. `/ralphy create` produces PRDs that map to verifiable acceptance criteria
3. `/ralphy run` blocks if validation fails
4. Constitution checker greps for violation patterns
5. No task list can pass validation if it contains "mock harness" or similar

---

## Anti-Pattern Registry Entry

After building, add to `.claude/patterns/anti-patterns.yaml`:

```yaml
code_patterns:
  ralphy_task_lists:
    - pattern: "mock.*harness"
      severity: critical
      description: "Task allows mock harnesses - violates CLAUDE.md"
    - pattern: "That's OK for testing"
      severity: critical
      description: "Rationalizing rule violation in task list"
    - pattern: "Real integration requires"
      severity: critical
      description: "Deferring real integration - creates mock dependency"
```

---

## Verification

After building, test with this poisoned task list:

```yaml
tasks:
  - title: "Test recording"
    details: |
      NOTE: Mock harnesses are OK for testing the mechanics.
```

Expected: `ralphy:task-validator` returns BLOCK with evidence pointing to the violation.

---

## Summary

Build a skill that makes the mock-allowing failure mode **structurally impossible** by:
1. Constitution with grep-able MUST rules
2. Validator that runs BEFORE execution
3. Hard block on critical violations
4. No rationalization possible - patterns are machine-checked

The goal is enforcement through structure, not trust.
