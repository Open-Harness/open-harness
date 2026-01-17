---
name: prd-implement
description: Implement PRD tasks by following specifications and creating checkpoints. Activated for task:ready (new task) or fix:required (retry with feedback). Creates working code that meets the definition of done.
---

# PRD Implement - Quick Reference

## When to Activate This Skill

- "Implement this task"
- "Fix the issues from review"
- "Code the feature described in the task"
- Received signal: `task:ready` or `fix:required`

## Core Responsibility

Implement tasks according to their specification:
- Follow the definition of done exactly
- Create checkpoints (git commits) after implementation
- Report discovered work that needs to be done
- Self-validate before reporting complete

## Implementation Process

### Step 1: Understand the Task

Read the task specification carefully:
- **Title**: What is being built
- **Description**: Context and details
- **Definition of Done**: What must be true when complete
- **Technical Approach**: How to implement (if specified)
- **Files to Modify/Create**: Where changes go
- **Changes**: Specific changes to make
- **Context**: Why this task exists
- **Dependencies**: What was completed before this

### Step 2: Check Previous Attempts

If this is a retry (`fix:required`):
- Review the fix instructions
- Understand what went wrong last time
- Apply the suggested changes
- Avoid repeating the same mistakes

### Step 3: Implement

1. Create or modify the specified files
2. Follow the technical approach if provided
3. Implement each item in the definition of done
4. Run any available tests locally

### Step 4: Self-Validate

Before reporting complete, verify:
- [ ] Each definition of done item is satisfied
- [ ] Code compiles/runs without errors
- [ ] Basic functionality works as expected
- [ ] No obvious bugs or issues

### Step 5: Create Checkpoint

Create a git checkpoint:
```bash
git add -A
git commit -m "checkpoint(T001): Implement login form"
```

Use the commit hash as the `checkpointName` in your output.

### Step 6: Report Results

Output a TaskResult JSON:

```json
{
  "status": "complete",
  "summary": "Implemented login form with email/password validation",
  "filesChanged": ["src/components/LoginForm.tsx", "src/components/LoginForm.test.tsx"],
  "checkpointName": "abc123f",
  "discoveredTasks": [],
  "blockedReason": null,
  "blockedBy": null
}
```

## Handling Blockers

If you cannot complete the task:

1. Document what's blocking you
2. Create a checkpoint with partial progress
3. Report status as "blocked"

```json
{
  "status": "blocked",
  "summary": "Cannot implement - missing database schema",
  "filesChanged": [],
  "checkpointName": "partial123",
  "discoveredTasks": [],
  "blockedReason": "Database schema not defined for user table",
  "blockedBy": "database-setup"
}
```

## Discovering New Tasks

During implementation, you may discover additional work:
- Missing prerequisites
- Edge cases needing separate handling
- Refactoring required to support the change

Report these as discovered tasks:

```json
{
  "status": "complete",
  "summary": "Implemented login form, discovered need for password validation util",
  "filesChanged": ["src/components/LoginForm.tsx"],
  "checkpointName": "abc123f",
  "discoveredTasks": [
    {
      "title": "Create password validation utility",
      "description": "Create utility for validating password strength",
      "definitionOfDone": [
        "Function validates password length >= 8",
        "Function checks for at least one number",
        "Function checks for at least one special character"
      ],
      "suggestedMilestoneId": "M001",
      "reason": "Discovered during login form implementation - need reusable validation",
      "filesToModify": [],
      "filesToCreate": ["src/utils/passwordValidation.ts"],
      "changes": [
        {
          "file": "src/utils/passwordValidation.ts",
          "changeType": "create",
          "description": "Create password validation utility",
          "location": null
        }
      ]
    }
  ],
  "blockedReason": null,
  "blockedBy": null
}
```

## Tools Available

### checkpoint.sh
Create a git checkpoint:
```bash
./tools/checkpoint.sh T001 "Implemented login form component"
```

## Best Practices

### Do
- Read the entire task specification before starting
- Follow the definition of done exactly
- Create atomic, focused commits
- Document any deviations from the plan
- Self-test before reporting complete

### Don't
- Skip definition of done items
- Make changes outside the task scope
- Forget to create checkpoints
- Report complete without verification
- Ignore previous review feedback

## Fix Required Handling

When triggered by `fix:required`:

1. Read the fix instructions carefully
2. Review specific issues listed
3. Address each issue specifically
4. Run tests again
5. Create new checkpoint
6. Report results

The fix instructions contain:
- What was wrong with the previous attempt
- Specific files and issues
- Suggestions for how to fix

Focus on the specific issues rather than rewriting everything.
