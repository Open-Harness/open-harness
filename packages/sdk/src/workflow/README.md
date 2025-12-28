# workflow/ - Task Management

Stateful task management for workflow progress tracking.

## Files

| File | Purpose |
|------|---------|
| `task-list.ts` | `TaskList` class and related types |

## Key Abstractions

- **TaskList**: Typed task tracker. Methods: `add()`, `start()`, `complete()`, `fail()`, `skip()`, `reset()`.
- **Task**: `{ id, description, status, metadata?, createdAt, startedAt?, completedAt?, error?, result? }`
- **TaskStatus**: `"pending" | "in_progress" | "completed" | "failed" | "skipped"`
- **TaskProgress**: `{ total, pending, in_progress, completed, failed, skipped, percentComplete }`

## Query Methods

- `get(id)`, `all()`, `pending()`, `inProgress()`, `completed()`, `failed()`, `progress()`, `history()`

## Usage

Used in harness `run()` to track workflow progress. Emits `task:start`, `task:complete`, `task:failed` events.
