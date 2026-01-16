---
name: prd-planner
description: Plan PRD implementation by creating milestones and tasks. Activated for workflow:start (initial planning) or replan:requested (adjusting approach based on failures). Creates structured implementation plans with clear acceptance criteria.
---

# PRD Planner - Quick Reference

## When to Activate This Skill

- "Create implementation plan from PRD"
- "Plan the milestones and tasks"
- "Replan based on failures"
- "Break down PRD into actionable tasks"
- Received signal: `workflow:start` or `replan:requested`

## Core Responsibility

Transform a PRD into a structured implementation plan with:
- **Milestones**: Deliverable chunks of functionality with acceptance tests
- **Tasks**: Specific, actionable work items with definition of done
- **Dependencies**: Correct ordering of work

## Planning Process

### Phase 1: PRD Analysis

1. Read the PRD thoroughly
2. Identify key deliverables and features
3. Note constraints and requirements
4. Understand success criteria

### Phase 2: Milestone Definition

For each milestone:
- **Title**: Clear, concise name
- **Description**: What this milestone delivers
- **Acceptance Test**: How to verify it works
  - Prefer automated tests (`bun run test`, `npm test`)
  - Fall back to behavioral tests if no automation possible
- **Dependencies**: Which milestones must complete first

### Phase 3: Task Breakdown

For each task:
- **Title**: Action-oriented name (e.g., "Create user authentication module")
- **Description**: What needs to be done
- **Definition of Done**: Specific, testable criteria
- **Technical Approach**: How to implement (if known)
- **Files to Modify/Create**: Specific file paths
- **Changes**: Detailed change specifications
- **Dependencies**: Which tasks must complete first

## Definition of Done Guidelines

Good definition of done items:
- "Function `add(a, b)` returns correct sum for all inputs"
- "Tests in `tests/auth.test.ts` pass"
- "API endpoint responds with 200 status code"
- "Error messages display to user on form validation failure"

Bad definition of done items:
- "Works correctly" (too vague)
- "Code is clean" (subjective)
- "Looks good" (not testable)

## Replanning

When triggered by `replan:requested`:

1. Review the history to understand what failed
2. Identify the root cause of failure
3. Consider alternative approaches
4. Adjust tasks or milestones as needed
5. Ensure the new plan addresses the issue

Common replan triggers:
- Task exceeded max attempts without success
- Milestone acceptance test failed
- Blocking dependency discovered

## Output Format

Provide a JSON object matching the PlanOutput schema:

```json
{
  "milestones": [
    {
      "title": "User Authentication",
      "description": "Implement secure user login system",
      "acceptanceTest": {
        "type": "automated",
        "description": "All auth tests pass",
        "command": "bun run test --filter=auth",
        "expectedOutcome": "0 failures"
      },
      "tasks": [
        {
          "title": "Create login form component",
          "description": "Build React form with email/password fields",
          "definitionOfDone": [
            "Form renders without errors",
            "Email field validates format",
            "Password field masks input",
            "Submit button calls auth API"
          ],
          "technicalApproach": "Use React Hook Form with Zod validation",
          "filesToModify": [],
          "filesToCreate": ["src/components/LoginForm.tsx"],
          "changes": [
            {
              "file": "src/components/LoginForm.tsx",
              "changeType": "create",
              "description": "Create login form component with validation",
              "location": null
            }
          ],
          "context": "Part of authentication milestone",
          "dependencies": []
        }
      ],
      "dependencies": []
    }
  ],
  "approach": "Build authentication first, then protected routes, then features",
  "reasoning": "Auth is required before any protected functionality can be tested"
}
```

## Discovery Mode

When processing discovered tasks (signal: `discovery:submitted`):

1. Review each discovered task
2. Evaluate if it's necessary for the PRD
3. Decide to approve or reject
4. Assign to appropriate milestone if approved

Criteria for approval:
- Task is genuinely needed for PRD completion
- Task is within scope
- Task is not already covered by existing tasks

Output for discovery mode:

```json
{
  "decisions": [
    {
      "discoveredTaskTitle": "Add input sanitization",
      "approved": true,
      "reason": "Security requirement discovered during implementation",
      "assignedMilestoneId": "M001",
      "modifications": null
    }
  ]
}
```

## Tools Available

### checkpoint.sh
Create a git checkpoint after planning:
```bash
./tools/checkpoint.sh plan "Initial implementation plan created"
```

## Anti-Patterns to Avoid

- Creating tasks that are too large (break them down)
- Vague definition of done criteria
- Missing acceptance tests for milestones
- Circular dependencies
- Tasks without clear file targets
- Over-engineering the plan (keep it pragmatic)
