# workflow/ - Task Management

Stateful task management primitives for tracking workflow progress.

## Files

| File | Purpose |
|------|---------|
| `task-list.ts` | `TaskList` class and related types |

## TaskList

A simple, typed task tracker:

```typescript
import { TaskList } from "@openharness/sdk";

const tasks = new TaskList([
  { id: "T001", description: "Analyze input" },
  { id: "T002", description: "Generate output" },
]);

tasks.start("T001");
tasks.complete("T001", { parsed: true });
tasks.fail("T002", "API timeout");

const progress = tasks.progress();
// { total: 2, pending: 0, in_progress: 0, completed: 1, failed: 1, percentComplete: 50 }
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
  metadata?: TMeta;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  result?: TResult;
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
  percentComplete: number;
}
```

## API

### Task Management

```typescript
tasks.add({ id: "T004", description: "New task" });
tasks.start("T001");
tasks.complete("T001", result);
tasks.fail("T001", "Error message");
tasks.skip("T001", "Reason");
tasks.reset("T001");
```

### Query

```typescript
tasks.get("T001");
tasks.all();
tasks.pending();
tasks.inProgress();
tasks.completed();
tasks.failed();
tasks.progress();
```

### History

```typescript
tasks.history();
// [{ taskId: "T001", from: "pending", to: "in_progress", timestamp: Date }]
```
