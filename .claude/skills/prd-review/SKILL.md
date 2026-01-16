---
name: prd-review
description: Review task completion and make termination decisions. Activated for task:complete (review task) or milestone:testable (run acceptance test). Evaluates work against definition of done and decides next steps.
---

# PRD Review - Quick Reference

## When to Activate This Skill

- "Review task completion"
- "Evaluate if task meets definition of done"
- "Run milestone acceptance test"
- Received signal: `task:complete` or `milestone:testable`

## Core Responsibility

Evaluate completed work and decide:
- **approved**: Task meets all criteria, move on
- **needs_fix**: Issues found, provide actionable feedback
- **blocked**: External blocker, mark and continue
- **escalate**: Max attempts reached or fundamental issue

## Review Process for Tasks

### Step 1: Understand the Context

Review the task:
- **Definition of Done**: The criteria that must be met
- **Attempt Number**: Current attempt vs max attempts
- **Attempt History**: What happened in previous attempts
- **Files Changed**: What was modified

### Step 2: Evaluate Against Definition of Done

For each item in the definition of done:
1. Verify the criterion is satisfied
2. Check the implementation quality
3. Note any issues or concerns

### Step 3: Assess Progress

Even if not complete, did the attempt make progress?
- **Yes**: Code is closer to working than before
- **No**: Same errors, no improvement

This is critical for termination decisions.

### Step 4: Make Decision

```
IF all definition_of_done items met:
  → decision: "approved"

ELSE IF attempt < maxAttempts AND (progressMade OR first_attempt):
  → decision: "needs_fix"
  → Provide specific fix instructions

ELSE IF attempt >= maxAttempts OR (no progress after multiple tries):
  → decision: "escalate"
  → Recommend: skip | replan | abort
```

## Decision Output

### Approved

```json
{
  "decision": "approved",
  "reasoning": "All definition of done items verified. Login form renders, validates, and submits correctly.",
  "fixInstructions": null,
  "specificIssues": [],
  "escalationReason": null,
  "recommendedAction": null,
  "progressMade": true,
  "lessonsLearned": "Consider adding loading state for better UX in future"
}
```

### Needs Fix

```json
{
  "decision": "needs_fix",
  "reasoning": "Email validation not working correctly",
  "fixInstructions": "The email validation regex is incorrect. It accepts 'test@' as valid. Update the regex in LoginForm.tsx line 23 to require domain.",
  "specificIssues": [
    {
      "file": "src/components/LoginForm.tsx",
      "issue": "Email validation regex accepts invalid emails",
      "suggestion": "Use /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/ pattern"
    }
  ],
  "escalationReason": null,
  "recommendedAction": null,
  "progressMade": true,
  "lessonsLearned": "Email validation is complex, consider using a library"
}
```

### Escalate

```json
{
  "decision": "escalate",
  "reasoning": "After 5 attempts, authentication flow still fails. The issue appears to be a fundamental misunderstanding of the auth API.",
  "fixInstructions": null,
  "specificIssues": [],
  "escalationReason": "Multiple attempts have failed to resolve the auth API integration. The approach may need to change.",
  "recommendedAction": "replan",
  "progressMade": false,
  "lessonsLearned": "Need to review auth API documentation before reattempting"
}
```

## Escalation Recommendations

### skip
Use when:
- Task is non-critical
- Can be done later or separately
- Doesn't block other work

### replan
Use when:
- Approach fundamentally flawed
- Need different strategy
- Task scope was wrong

### abort
Use when:
- Fundamental blocker found
- PRD cannot be completed
- Critical external dependency missing

## Milestone Review

When reviewing a milestone (`milestone:testable`):

1. Run the acceptance test command (if automated)
2. Verify the expected outcome
3. Decide: `milestone:complete` or `milestone:failed`

```bash
# Example: Run acceptance test
bun run test --filter=auth
# Expected: 0 failures
```

If test passes → emit `milestone:complete`
If test fails → emit `milestone:failed` (triggers replan)

## Progress Assessment Guidelines

Progress was made if:
- More tests pass than before
- Error messages changed (moved forward)
- Partial functionality working
- Files were modified in the right direction

No progress if:
- Same errors as last attempt
- Tests still failing in same way
- No meaningful code changes
- Reverted to previous state

## Tools Available

### diff-since.sh
Show changes since a checkpoint:
```bash
./tools/diff-since.sh T001  # Show diff since T001 checkpoint
```

## Writing Good Fix Instructions

### Do
- Be specific about what's wrong
- Point to exact file and line
- Suggest concrete fixes
- Explain why it's wrong

### Don't
- Be vague ("it's broken")
- Just say "try again"
- List issues without solutions
- Overwhelm with minor nitpicks

Focus on the most important issues first. If there are many issues, prioritize the blocking ones.

## Anti-Patterns to Avoid

- Approving work that doesn't meet definition of done
- Being too lenient (endless retries with no progress)
- Being too strict (escalating too early)
- Not providing actionable fix instructions
- Ignoring previous attempt history
