# workflow/ - Task Management

Stateful task management primitives for tracking workflow progress.

## Files

| File | Purpose |
|------|---------|
| `task-list.ts` | `TaskList` class and related types |

## TaskList

A simple, typed task tracker for workflow orchestration:

```typescript
import { TaskList } from "@openharness/sdk";

// Create with initial tasks
const tasks = new TaskList([
  { id: "T001", description: "Analyze input" },
  { id: "T002", description: "Generate output" },
  { id: "T003", description: "Validate result" },
]);

// Start a task
tasks.start("T001");

// Complete with result
tasks.complete("T001", { parsed: true });

// Or fail with error
tasks.fail("T002", "API timeout");

// Check progress
const progress = tasks.progress();
// { total: 3, pending: 1, in_progress: 0, completed: 1, failed: 1, percentComplete: 66.67 }
```

## Types

### TaskStatus

```typescript
type TaskStatus = "pending" | "in_progress" | "completed" | "failed" | "skipped";
```

### Task

```typescript
interface Task<TResult, TMeta> {
  id: string;
  description: string;
  status: TaskStatus;
  metadata?: TMeta;        // Custom metadata
  createdAt: Date;
  startedAt?: Date;        // Set when status → in_progress
  completedAt?: Date;      // Set when status → completed/failed
  error?: string;          // Error message if failed
  result?: TResult;        // Result data if completed
}
```

### TaskProgress

```typescript
interface TaskProgress {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  failed: number;
  skipped: number;
  percentComplete: number;  // 0-100
}
```

## API

### Task Management

```typescript
tasks.add({ id: "T004", description: "New task" });  // Add task
tasks.start("T001");                                   // → in_progress
tasks.complete("T001", result);                        // → completed
tasks.fail("T001", "Error message");                   // → failed
tasks.skip("T001", "Reason");                          // → skipped
tasks.reset("T001");                                   // → pending
```

### Query

```typescript
tasks.get("T001");           // Get single task
tasks.all();                 // All tasks as array
tasks.pending();             // Only pending tasks
tasks.inProgress();          // Only in_progress tasks
tasks.completed();           // Only completed tasks
tasks.failed();              // Only failed tasks
tasks.progress();            // Progress summary
```

### History

```typescript
tasks.history();  // Status change history
// [
//   { taskId: "T001", from: "pending", to: "in_progress", timestamp: Date },
//   { taskId: "T001", from: "in_progress", to: "completed", timestamp: Date },
// ]
```

## Usage in Harness

```typescript
const Harness = defineHarness({
  agents: { worker: WorkerAgent },
  run: async ({ agents, emit }) => {
    const tasks = new TaskList([
      { id: "T001", description: "First step" },
      { id: "T002", description: "Second step" },
    ]);

    for (const task of tasks.pending()) {
      tasks.start(task.id);
      emit({ type: "task:start", taskId: task.id });

      try {
        const result = await agents.worker.execute(task.description);
        tasks.complete(task.id, result);
        emit({ type: "task:complete", taskId: task.id });
      } catch (error) {
        tasks.fail(task.id, String(error));
        emit({ type: "task:failed", taskId: task.id, error: String(error) });
      }
    }

    return tasks.progress();
  },
});
```

## How It Connects

```
┌─────────────────────────────────────────────────────────┐
│              Harness run() function                     │
│  Uses TaskList for workflow progress tracking           │
└───────────────┬─────────────────────────────────────────┘
                │ emits task events
                ▼
┌─────────────────────────────────────────────────────────┐
│              UnifiedEventBus                            │
│  task:start, task:complete, task:failed events          │
└───────────────┬─────────────────────────────────────────┘
                │ consumed by
                ▼
┌─────────────────────────────────────────────────────────┐
│                 Channels                                │
│  Display progress, log to database, etc.                │
└─────────────────────────────────────────────────────────┘
```

## Related

- `harness/event-types.ts` - Task event type definitions
- `harness/control-flow.ts` - `parallel()` for concurrent task execution
- `harness/dependency-resolver.ts` - Task dependency graph resolution
