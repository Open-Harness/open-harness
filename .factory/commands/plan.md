---

name: oharnes.plan
description: Execute the implementation planning workflow using the plan template to generate design artifacts.
handoffs:

- label: Create Tasks
agent: oharnes.tasks
prompt: Break the plan into tasks
send: true

---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

1. **Load context**: Read FEATURE_SPEC and `.specify/memory/constitution.md`. Load IMPL_PLAN template (already copied).
2. **Execute plan workflow**: Follow the structure in IMPL_PLAN template to:
  - Fill Technical Context (mark unknowns as "NEEDS CLARIFICATION")
  - Fill Constitution Check section from constitution
  - Evaluate gates (ERROR if violations unjustified)
  - Phase 0: Generate research.md (resolve all NEEDS CLARIFICATION)
  - Phase 1: Generate data-model.md, contracts/, quickstart.md
  - Phase 1: Update agent context by running the agent script
  - Re-evaluate Constitution Check post-design
3. **Stop and report**: Command ends after Phase 2 planning. Report branch, IMPL_PLAN path, and generated artifacts.

## Phases

### Phase 0: Outline & Research

1. **Extract unknowns from Technical Context** above:
  - For each NEEDS CLARIFICATION → research task
  - For each dependency → best practices task
  - For each integration → patterns task
2. **Dispatch research agents in parallel**:
  Launch ALL research agents in a SINGLE message with parallel Task calls:
   Collect their outputs (decision + rationale for each).
3. **Consolidate findings** in `research.md` using format:
  - Decision: [what was chosen]
  - Rationale: [why chosen]
  - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

### Phase 1: Design & Contracts

**Prerequisites:** `research.md` complete

1. **Extract entities from feature spec** → `data-model.md`:
  - Entity name, fields, relationships
  - Validation rules from requirements
  - State transitions if applicable
2. **Generate API contracts** from functional requirements:
  - For each user action → endpoint
  - Use standard REST/GraphQL patterns
  - Output OpenAPI/GraphQL schema to `/contracts/`
3. **Agent context update**:
  - Run `.specify/scripts/bash/update-agent-context.sh claude`
  - These scripts detect which AI agent is in use
  - Update the appropriate agent-specific context file
  - Add only new technology from current plan
  - Preserve manual additions between markers

**Output**: data-model.md, /contracts/*, quickstart.md, agent-specific file

### Phase 2: Validation Gate

**Prerequisites:** Phase 1 artifacts complete

1. **Dispatch validator**:
  ```
   Task: oharnes.plan:validator
   Prompt: |
     FEATURE_SPEC: {FEATURE_SPEC}
     SPECS_DIR: {SPECS_DIR}
     Validate plan artifacts against spec requirements.
  ```
2. **Handle validation results**:
  - **If `recommendation: proceed**` (score >= 70):
    - Log validation passed
    - Continue to report
  - **If `recommendation: fix_required**` (score 50-69):
    - Display issues to user
    - Ask: "Validation found issues. Fix now or proceed anyway?"
    - If fix: Address issues, re-run validator (max 2 iterations)
    - If proceed: Continue with warning
  - **If `recommendation: block**` (score < 50):
    - Display critical gaps
    - ERROR: "Plan validation failed. Critical gaps must be addressed."
    - List blocking_issues and suggested_fixes
    - Do NOT proceed to task generation

**Output**: Validation report with score, issues, and requirement coverage

## Key rules

- Use absolute paths
- ERROR on gate failures or unresolved clarifications
- ERROR on validation block (score < 50)

