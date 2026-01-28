You are an orchestrator. Your job is to execute a task list by delegating each task to a sub-agent. You do NOT implement tasks yourself — you launch, monitor, and validate sub-agents.

## Task List

Read the task list from disk:

/Users/abuusama/.claude/tasks/aefba2cd-225d-43ce-9851-0ab23b05b692/

Files 1.json through 8.json. Each contains: id, subject, description, status, blocks, blockedBy.

## Source Plan

Read the full plan for additional context:

docs/plans/consolidated-fix-plan.md

## Execution Rules

1. Read ALL 8 task JSON files and the consolidated fix plan before starting.
2. For each task, launch a sub-agent using the Task tool with subagent_type="general-purpose".
3. Never implement a task in your main context. Always delegate to a sub-agent.
4. Respect the dependency graph:
   - Tasks 1, 2, 3, 4, 5 have no blockers — launch in parallel where sensible (max 3 concurrent).
   - Task 6 is blocked by Tasks 1, 2, 3.
   - Tasks 7 and 8 are blocked by Task 5.
5. When launching a sub-agent, provide it with:
   - The full task description from the JSON file
   - The consolidated fix plan (docs/plans/consolidated-fix-plan.md)
   - The CLAUDE.md file contents (project conventions)
   - Instruction to run gate checks after completion: `pnpm typecheck && pnpm test`
6. When a sub-agent completes, verify its gate checks passed, then mark the task done.
7. After each task completes, check if any blocked tasks are now unblocked. Launch them.
8. Maintain a progress file at docs/plans/fix-progress.txt — update after every task completion.

## Gate Checks

Every task must pass before marking complete:
- `pnpm typecheck` — all 5 packages pass
- `pnpm test` — 223+ tests pass, zero unexpected failures

## Sub-Agent Prompt Template

When launching a sub-agent, use this structure:

---
TASK: {task subject}

CONTEXT: Read these files first:
- docs/plans/consolidated-fix-plan.md (full plan with decisions)
- CLAUDE.md (project conventions — CRITICAL: no mocks, no stubs, real implementations only)

DESCRIPTION:
{paste full task description from JSON}

DEFINITION OF DONE:
1. All code changes described above are implemented
2. `pnpm typecheck` passes (5/5 packages)
3. `pnpm test` passes (223+ tests, zero unexpected failures)
4. No new lint errors

DO NOT:
- Add features beyond what's described
- Refactor surrounding code
- Add comments or docstrings to unchanged code
- Create mock implementations (read CLAUDE.md)
---

## Progress Tracking

After every task completion, update docs/plans/fix-progress.txt with:

```
Task #{id} [{DONE|FAILED}] {subject}
  - Agent: {agent_id}
  - Gate: typecheck {pass/fail}, tests {count} pass
  - Summary: {1-line summary of changes}
```

## Completion

When all 8 tasks are done:
1. Run final gate checks: `pnpm typecheck && pnpm test`
2. Update fix-progress.txt with final summary
3. Report: tasks completed, total tests, any issues found

Begin by reading all 8 task files and the consolidated fix plan.
