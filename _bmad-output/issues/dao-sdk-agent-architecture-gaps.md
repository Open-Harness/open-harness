# DAO SDK Agent Architecture Gaps

**Date:** 2024-12-24
**Status:** Open
**Priority:** High
**Category:** Architecture / Framework Design

---

## Context

During end-to-end testing of the DAO CLI workflow runner, we discovered that while the **CLI layer is fully functional** (34/34 tests passed), there are significant gaps in the **agent/workflow architecture layer** that prevent the autonomous coding workflow from executing as intended.

The CLI and SDK were built to provide a great DX for the autonomous coding pattern from Anthropic's examples repo (originally in Python). The TypeScript/Bun implementation works, but the agent design patterns need refinement.

---

## What Works

| Component | Status | Notes |
|-----------|--------|-------|
| CLI commands (help, version, init, validate, status, run) | PASS | All options work correctly |
| YAML config loading & validation | PASS | Zod schemas catch all errors |
| SDK agent creation (`createAgent`) | PASS | Agents spawn correctly |
| SDK monologue wrapper (`withMonologue`) | PASS | Narrative callbacks work |
| Real Anthropic API execution | PASS | Agent ran, created files, cost $0.05 |
| Graceful shutdown handling | PASS | SIGINT/SIGTERM handled |
| JsonFileDataSource | PASS | CRUD operations work |

---

## Issues Identified

### Issue 1: Agent Output Not Enforced

**Problem:** The initializer agent prompt instructs it to create `feature_list.json` with 200 test cases, but the agent built the app directly instead.

**What happened:**
```
Prompt: "Create a feature_list.json with 200 detailed test cases"
Actual: Agent created index.html, app.js, styles.css (skipped feature_list.json entirely)
```

**Root cause:** No mechanism to enforce that an agent produces specific outputs before the workflow proceeds.

**Impact:** The builder loop never runs because there's no feature_list.json to iterate over.

---

### Issue 2: No Structured Output Contracts

**Problem:** Agents are given natural language prompts with no structured output validation.

**Current flow:**
```
prompt (text) → agent → whatever it decides to output
```

**Needed flow:**
```
prompt + output schema → agent → validated structured output → next workflow step
```

**Examples of missing contracts:**
- Initializer MUST output: `feature_list.json` matching TaskSchema
- Initializer MUST output: `init.sh` 
- Builder MUST update: `feature_list.json` status field after each task

---

### Issue 3: No Workflow Guardrails

**Problem:** Workflow proceeds regardless of whether agents fulfilled their responsibilities.

**Missing guardrails:**
1. Pre-condition checks (does app_spec.txt exist?)
2. Post-condition checks (did initializer create feature_list.json?)
3. Artifact validation (is feature_list.json valid JSON matching schema?)
4. State machine enforcement (can't run builder until initializer succeeds)

---

### Issue 4: Prompt Engineering Gaps

**Problem:** Prompts are embedded as simple strings with no:
- Few-shot examples
- Output format specifications
- Explicit constraints
- Error recovery instructions

**Current prompt (initializer):**
```
You are an initializer agent. Your job is to:
1. Read the app_spec.txt in the project directory
2. Create a feature_list.json with 200 detailed test cases
...
```

**Issues:**
- No example of what feature_list.json should look like
- No JSON schema provided to agent
- No "you MUST create this file before doing anything else"
- 200 test cases is arbitrary and overwhelming

---

### Issue 5: Missing Agent Patterns/Abstractions

**Problem:** SDK provides low-level primitives but no higher-level patterns for common agent architectures.

**Available:**
- `createAgent()` - creates basic agent
- `withMonologue()` - adds narrative wrapper
- `TaskList` - task management

**Needed:**
- `createStructuredAgent()` - agent with enforced output schema
- `createPipelineAgent()` - agent that must produce artifacts before next step
- `AgentContract` - define inputs/outputs/validations
- `WorkflowOrchestrator` - state machine for multi-agent workflows

---

## Recommendations

### Short-term (Quick Fixes)

1. **Improve initializer prompt** with explicit output requirements and examples
2. **Add post-initialization check** in workflow - fail if feature_list.json doesn't exist
3. **Reduce scope** - 200 test cases is too many, start with 5-10

### Medium-term (SDK Enhancements)

1. **Add structured output support** using Claude's tool_use for JSON schemas
2. **Add workflow state machine** with explicit phases and transitions
3. **Add artifact validation** hooks in workflow execution

### Long-term (Architecture)

1. **Full BMAD analysis** of agent orchestration patterns
2. **Design agent contract system** - inputs, outputs, validations
3. **Create reference implementations** - working examples of common patterns
4. **Documentation** - how to properly wire agents into workflows

---

## Test Evidence

### CLI Test Report
- Location: `/tmp/dao-cli-e2e-test-20251224_082559/TEST-REPORT.md`
- Result: 34/34 tests passed
- Conclusion: CLI layer is production-ready

### Real E2E Test
- Location: `/tmp/dao-cli-e2e-real-test-20251224_083408/`
- Result: Agent ran successfully but didn't follow workflow contract
- Cost: $0.0515 (11 turns with Haiku)
- Output: Created counter app (index.html, app.js, styles.css) but NO feature_list.json

---

## Next Steps

1. [ ] Review this document in BMAD planning session
2. [ ] Decide on short-term vs long-term approach
3. [ ] Create detailed technical spec for chosen approach
4. [ ] Implement and test

---

## Related Files

- CLI: `/apps/cli/`
- SDK: `/packages/sdk/`
- Workflow implementation: `/apps/cli/src/workflows/autonomous.ts`
- Agent factory: `/packages/sdk/src/factory/agent-factory.ts`
- Test reports: `/tmp/dao-cli-e2e-test-20251224_082559/`
