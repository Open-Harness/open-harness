---
name: ralph
description: |
  Interactive task planning and autonomous execution using @open-harness/ralph.
  Interviews user, creates PRD, generates task list with Claude Code's built-in
  task tools, then executes tasks autonomously with full Claude Code capabilities.

  USE WHEN user says 'ralph', 'run ralph', 'autonomous task', 'execute plan',
  'create and run tasks', 'help me build', 'plan and execute', 'ralphy'
---

# Ralph: Autonomous Task Execution

Plan tasks interactively, then execute them autonomously with `@open-harness/ralph`.

## Workflow Overview

```
/ralph
   ↓
Phase 1: Interview → Understand the task
   ↓
Phase 2: Plan → Create .ralph/plan.md
   ↓
Phase 3: Tasks → Use TaskCreate for each task
   ↓
Phase 4: Approve → User reviews task list
   ↓
Phase 5: Execute → Run in tmux session
```

---

## Phase 1: Interview

Use `AskUserQuestion` progressively to understand the task:

### Question 1: Goal
```
What are you trying to build or accomplish?
```

### Question 2: Context
```
Is this a new feature, bug fix, refactor, or something else?
Options: New feature, Bug fix, Refactor, Documentation, Other
```

### Question 3: Requirements
```
What are the key requirements or acceptance criteria?
(User provides free-form text)
```

### Question 4: Constraints
```
Any technical constraints, preferences, or things to avoid?
(User provides free-form text or skips)
```

---

## Phase 2: Plan Generation

Create `.ralph/plan.md` with PRD content:

```markdown
# [Project Title]

## Goal
[Summary from interview]

## Context
[Type: new feature/bug fix/etc]
[Any relevant codebase context discovered]

## Requirements
- [Requirement 1]
- [Requirement 2]
- [Requirement 3]

## Technical Approach
[How to accomplish the goal based on codebase exploration]

## Success Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

## Files Involved
- `path/to/file1.ts` - [purpose]
- `path/to/file2.ts` - [purpose]
```

**Important**: Before writing the plan, explore the codebase to understand:
- Existing patterns and conventions
- Files that will need modification
- Dependencies and constraints

---

## Phase 3: Task Creation

Use Claude Code's **TaskCreate** tool for each task.

### Task Structure

Each task must have:

| Field | Description |
|-------|-------------|
| `subject` | Imperative action (e.g., "Implement user login endpoint") |
| `description` | Detailed context, steps, acceptance criteria |
| `activeForm` | Present continuous (e.g., "Implementing user login") |

### Task Ordering

Use `TaskUpdate` after creation to set dependencies:
- `addBlocks`: Tasks that cannot start until this one completes
- `addBlockedBy`: Tasks that must complete before this one can start

### Example Task

```typescript
TaskCreate({
  subject: "Create authentication middleware",
  description: `
## What
Create Express middleware that validates JWT tokens.

## Files
- src/middleware/auth.ts (new)
- src/types/auth.ts (new)

## Steps
1. Create AuthMiddleware function
2. Validate Authorization header
3. Decode and verify JWT
4. Attach user to request object

## Acceptance Criteria
- Middleware validates JWT tokens correctly
- Returns 401 for invalid/missing tokens
- TypeScript compiles without errors
- Tests pass
  `,
  activeForm: "Creating authentication middleware"
})
```

### Task Best Practices

1. **Atomic**: One clear outcome per task
2. **Detailed**: Include files, steps, and acceptance criteria
3. **Ordered**: Set proper dependencies with `blockedBy`
4. **Verifiable**: Include verification commands when relevant

---

## Phase 4: User Approval

After creating all tasks:

1. Display task summary using `TaskList`
2. Ask user to review the plan and task list
3. Wait for explicit approval before execution

```
I've created N tasks for this project. Please review:

1. [Task 1 subject]
2. [Task 2 subject]
...

The plan is saved at .ralph/plan.md

Ready to execute? (yes/no)
```

---

## Phase 5: Execution

On user approval, execute via tmux:

### Find Ralph Binary and Task Directory

```bash
# Most recently modified task directory is current session
TASK_DIR=$(ls -td ~/.claude/tasks/*/ | head -1)

# Find Ralph binary - prefer local monorepo build, fallback to global
if [ -f "apps/harness-loop/dist/index.mjs" ]; then
  RALPH_BIN="bun apps/harness-loop/dist/index.mjs"
elif [ -f "../harness-loop/dist/index.mjs" ]; then
  RALPH_BIN="bun ../harness-loop/dist/index.mjs"
else
  # Fallback to global - requires @open-harness/ralph installed globally
  RALPH_BIN="bun $(which ralph 2>/dev/null || echo 'ralph')"
fi
```

### Start Ralph in tmux

```bash
# Get absolute paths
PROJECT_ROOT=$(pwd)
PLAN_FILE="$PROJECT_ROOT/.ralph/plan.md"

tmux new-session -d -s ralph \
  "cd $PROJECT_ROOT && $RALPH_BIN \"$TASK_DIR\" \"$PLAN_FILE\" 2>&1; echo 'Ralph finished. Press any key to close.'; read"
```

### CLI Flags

| Flag | Effect |
|------|--------|
| (none) | Full output: spinner, task boxes, tool calls, results, thinking, text |
| `--quiet` / `-q` | Suppresses tool calls and results only. **Always shows spinner and task boxes.** |

### Return Instructions to User

```
Ralph is now running in a tmux session.

To watch execution:
  tmux attach -t ralph

To detach and return here:
  Press Ctrl+B, then D

To check status:
  tmux has-session -t ralph && echo "Running" || echo "Finished"
```

---

## Phase 6: Monitoring (Optional)

While Ralph runs, you can:

### Check if Still Running
```bash
tmux has-session -t ralph 2>/dev/null && echo "Running" || echo "Finished"
```

### Capture Recent Output
```bash
tmux capture-pane -t ralph -p | tail -50
```

### Kill Session if Needed
```bash
tmux kill-session -t ralph
```

---

## Quick Reference

### Commands
| Action | Command |
|--------|---------|
| Start planning | `/ralph` |
| Check tmux session | `tmux has-session -t ralph` |
| Attach to session | `tmux attach -t ralph` |
| Detach from session | `Ctrl+B, D` |
| Kill session | `tmux kill-session -t ralph` |

### Files Created
| File | Purpose |
|------|---------|
| `.ralph/plan.md` | PRD and plan documentation |
| `~/.claude/tasks/<session>/` | Task JSON files (auto-created by TaskCreate) |

### Task JSON Format (for reference)
```json
{
  "id": "1",
  "subject": "Create user authentication",
  "description": "Implement login/logout with JWT...",
  "activeForm": "Creating authentication",
  "status": "pending",
  "blocks": ["2"],
  "blockedBy": []
}
```

---

## Notes

- **No separate task file needed**: Ralph reads directly from Claude Code's task storage
- **Tasks visible in UI**: All tasks appear in Claude Code's task list
- **Session isolation**: Each Claude Code session has its own task directory
- **Tmux independence**: Ralph runs in background, freeing this session for monitoring
