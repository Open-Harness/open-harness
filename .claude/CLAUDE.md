# Oharnes Development Guidelines

Rules and conventions for building oharnes commands and agents.

## Source of Truth

All oharnes development addresses root causes from the 003-harness-renderer retrospective:
`specs/backlog/003-next-cycle-inputs.md`

**Key Insight**: Proactive context loading prevents problems before they arise by ensuring the agent only sees the right context for each task.

---

## Core Principles

### 1. Controller Pattern
Commands orchestrate, they don't do heavy work themselves.

```
Controller (command)
├── Initialize context
├── Dispatch sub-agents
├── Collect results
├── Assemble output
└── Report to user
```

### 2. Context Jealousy
Controllers stay lightweight. Heavy context loading happens in sub-agents where it can be thrown away after use.

### 3. Verification Gates
Every command that produces artifacts should validate them before proceeding. Use scoring thresholds:
- `>= 70`: proceed
- `50-69`: fix_required (user choice)
- `< 50`: block

**Exception - oharnes.verify**: Uses stricter post-implementation thresholds:
- `>= 90`: PASS (ready for merge)
- `70-89`: PARTIAL (fix issues before merge)
- `< 70`: FAIL (significant work needed, triggers retrospective)

**Terminology**: `oharnes.verify` uses user-facing terms (PASS/PARTIAL/FAIL) equivalent to (proceed/fix_required/block).

---

## When to Use Sub-Agents

### Good Use Cases
- **Scoped work**: Explicit input → context-heavy work → structured output
- **Throwaway context**: Work that loads lots of context you don't need afterward
- **Parallelizable**: Independent tasks that can run simultaneously
- **Research**: External lookups, web searches, doc analysis
- **Validation**: Checking artifacts against criteria

### Bad Use Cases
- Work requiring conversation history
- Unbounded exploration
- Simple transforms on small inputs
- Interactive user decisions

### Decision Framework
Ask: "Is this work (a) scoped with clear input/output, (b) context-heavy, and (c) throwaway after completion?"

If yes to all three → sub-agent
If no to any → main agent

---

## Naming Conventions

### Commands
```
.claude/commands/oharnes.<action>.md
```
Examples: `oharnes.specify.md`, `oharnes.plan.md`, `oharnes.tasks.md`

### Agents
```
.claude/agents/oharnes.<command>-<role>.md
```
Examples: `oharnes.plan-researcher.md`, `oharnes.plan-validator.md`

### Agent Name Field
```yaml
name: oharnes.<command>:<role>
```
Examples: `oharnes.plan:researcher`, `oharnes.tasks:validator`

### Directory Field Naming
Agents output directory paths with consistent field names:
- verify agents: use `feature_dir`
- retro agents: use `spec_directory`
- analyze agents: use `feature_dir`

---

## Command Structure

```markdown
---
name: oharnes.<action>
description: <what this command does>
handoffs:
  - label: <next step label>
    agent: oharnes.<next-command>
    prompt: <handoff prompt>
    send: true
---

## User Input

\`\`\`text
$ARGUMENTS
\`\`\`

You **MUST** consider the user input before proceeding (if not empty).

## Outline

1. **Setup**: Run prerequisite scripts, parse context
2. **Load context**: Read required files
3. **Execute workflow**: Phase-based execution
4. **Report**: Output results

## Phases

### Phase 0: <Name>
<workflow steps>
<sub-agent dispatch if needed>

### Phase 1: <Name>
<workflow steps>

### Phase N: Validation Gate
<validator dispatch>
<threshold handling>

## Key rules

- <rule 1>
- <rule 2>
```

---

## Agent Structure

```markdown
---
name: oharnes.<command>:<role>
description: <when to use this agent>
tools: <minimal required tools>
model: <haiku|sonnet|opus>
---

# <Role> Agent

You are a <role description>.

## Purpose

<one-line purpose>

## Input

You receive via prompt:
- `VAR1`: <description>
- `VAR2`: <description>

## Workflow

1. <step one>
2. <step two>
...

## Output Protocol

### Return to Controller (stdout)
\`\`\`
SUMMARY: <one-line summary with key metrics>
\`\`\`

### Save to File (if applicable)
\`\`\`yaml
<structured YAML output>
\`\`\`

## Boundaries

**DO**:
- <allowed action>
- <allowed action>

**DO NOT**:
- <prohibited action>
- <prohibited action>
```

---

## Parallel Dispatch Pattern

From oharnes.retro - launch multiple agents in a SINGLE message:

```
Task: oharnes.<command>:<agent1>
Prompt: |
  VAR1: {value1}
  VAR2: {value2}
  <instructions>

Task: oharnes.<command>:<agent2>
Prompt: |
  VAR1: {value1}
  VAR2: {value2}
  <instructions>

[... all in parallel ...]
```

Collect their SUMMARY outputs, then proceed.

---

## Validation Gate Pattern

After artifact generation, dispatch validator:

```
Task: oharnes.<command>:validator
Prompt: |
  ARTIFACT_PATH: {path}
  SPEC_PATH: {spec}
  Validate artifact against requirements.
```

Handle results:

```markdown
- **If `recommendation: proceed`** (score >= 70):
  - Log validation passed
  - Continue

- **If `recommendation: fix_required`** (score 50-69):
  - Display issues to user
  - Ask: "Fix now or proceed anyway?"
  - If fix: Address issues, re-run validator (max 2 iterations)
  - If proceed: Continue with warning

**Iteration Limits**:
- Standard validation loops: max 2 iterations
- `oharnes.implement` task verification: max 5 attempts (coding is iterative)
- `oharnes.implement` gate fixes: max 3 attempts per gate

- **If `recommendation: block`** (score < 50):
  - Display critical gaps
  - ERROR: Do not proceed
  - List blocking_issues and suggested_fixes
```

---

## Validator Output Schema

```yaml
validation_report:
  timestamp: "ISO-8601"
  overall_score: 0-100
  passed: true|false  # true if score >= 70

  checks:
    - name: "<check name>"
      passed: true|false
      details: "<if failed, why>"

  issues:
    - severity: critical|medium|low
      description: "<what's wrong>"
      location: "<file:line or reference>"

  recommendation: proceed|fix_required|block
  blocking_issues: []
  suggested_fixes: []
```

---

## Tool Scoping by Agent Type

### Read-Only (Validators, Auditors)
```yaml
tools: Read, Grep, Glob
```

### Research (Analysts)
```yaml
tools: Read, Grep, Glob, WebFetch, WebSearch
```

### Writers (Implementers)
```yaml
tools: Read, Write, Edit, Bash, Grep, Glob
```

---

## Model Selection

| Model | Use Case |
|-------|----------|
| `haiku` | Fast searches, simple lookups, format validation |
| `sonnet` | Balanced work, research, complex validation |
| `opus` | Complex reasoning, synthesis, decision-making |

---

## Handoff Conventions

When handing off to next command:

```yaml
handoffs:
  - label: <Action Name>
    agent: oharnes.<next-command>
    prompt: <context for next command>
    send: true
```

Always update handoffs to point to oharnes versions of commands.

---

## Grading Rubric

When evaluating oharnes solutions, grade against:

| Criterion | Weight | Question |
|-----------|--------|----------|
| Root Cause Address | 30% | Does this prevent RC001-RC005 from next-cycle-inputs.md? |
| Context Isolation | 25% | Does heavy work happen in throwaway sub-agent context? |
| Verification Gates | 25% | Are artifacts validated before proceeding? |
| Pattern Consistency | 20% | Does it follow established oharnes patterns? |

---

## Historical Awareness System

Agents learn from past failures via the anti-patterns registry.

### Pattern Registry

**Location**: `.claude/patterns/anti-patterns.yaml`

```yaml
code_patterns:      # Grep-able patterns by context
structural_patterns: # Systemic anti-patterns
problem_paths:       # High-risk file globs
```

### How It Works

1. **Retrospectives** identify root causes
2. **oharnes.close** crystallizes decisions into registry
3. **Scout** reads registry, outputs "Historical Warnings"
4. **Verifier** uses patterns + git history checks

### Consumers

| Agent | What It Does |
|-------|--------------|
| Scout | Reads registry, warns about problem paths |
| Verifier | Greps for code_patterns, checks git history |

### Git History Check

Verifier checks if files appear in recent fix commits:
```bash
git log -5 --oneline --all --grep="fix" -- {file_path}
```

Files with troubled history get elevated scrutiny.

### Maintenance

- **Automatic**: oharnes.close updates after retrospectives
- **Manual**: Add patterns with source reference, bump `last_updated`

See `.claude/patterns/README.md` for full documentation.

---

## Anti-Patterns

### Don't
- Load full codebase in controller
- Skip validation gates
- Use sub-agents for simple transforms
- Make sub-agents that need conversation history
- Block on minor validation issues
- Ignore the anti-patterns registry

### Do
- Keep controller context minimal
- Validate artifacts before proceeding
- Use sub-agents for scoped, throwaway work
- Provide clear input/output contracts
- Use scoring thresholds (70/50) for gates
- Read `.claude/patterns/anti-patterns.yaml` in Scout and Verifier
