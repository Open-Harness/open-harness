# API Reference

## Factories

### `createTaskHarness(options: CreateTaskHarnessOptions): TaskHarness`

Creates a TaskHarness instance for executing tasks.md files through SDK agents.

```typescript
import { createTaskHarness } from 'bun-vi';

const harness = createTaskHarness({
  config: {
    mode: 'live',
    tasksFilePath: './tasks.md',
    projectRoot: process.cwd(),
  }
});
```

**Options:**
- `config: TaskHarnessConfig` - Harness configuration
- `containerOptions?: Partial<ContainerOptions>` - DI container options

### `createTestTaskHarness(config: TaskHarnessConfig): TaskHarness`

Creates a TaskHarness configured for testing with replay mode.

```typescript
const harness = createTestTaskHarness({
  mode: 'replay',
  tasksFilePath: './tasks.md',
});
```

---

## TaskHarness

The main orchestration class for executing task files.

### Constructor

```typescript
@injectable()
class TaskHarness {
  constructor(
    config: TaskHarnessConfig,
    parserAgent?: ParserAgent,
    reviewAgent?: ValidationReviewAgent,
    eventBus?: IEventBus | null,
  )
}
```

### `run(callbacks?: ITaskHarnessCallbacks): Promise<HarnessSummary>`

Executes all tasks in dependency order with validation.

```typescript
const summary = await harness.run({
  onNarrative: (entry) => console.log(entry.text),
  onTaskStarted: (task) => console.log(`Starting: ${task.id}`),
  onTaskCompleted: (task, result) => console.log(`Completed: ${task.id}`),
  onTaskValidated: (task, result) => console.log(`Validated: ${task.id}`),
  onTaskFailed: (task, failure) => console.log(`Failed: ${task.id}`),
});
```

### `abort(): void`

Aborts the current harness run gracefully.

```typescript
harness.abort();
```

### `getState(): TaskHarnessState`

Returns the current state of the harness.

```typescript
const state = harness.getState();
console.log(state.tasks); // ParsedTask[]
console.log(state.completedTasks); // Record<string, TaskResult>
console.log(state.validatedTasks); // Record<string, ValidationResult>
```

---

## Agents

### ParserAgent

Parses tasks.md files into structured task lists.

```typescript
import { ParserAgent } from 'bun-vi';

const parser = new ParserAgent(runner, eventBus);
const output = await parser.parse(
  { content: tasksMarkdown, filePath: './tasks.md' },
  'session-id',
  { callbacks }
);
```

### ValidationReviewAgent

Validates task implementations against success criteria.

```typescript
import { ValidationReviewAgent } from 'bun-vi';

const reviewer = new ValidationReviewAgent(runner, eventBus);
const output = await reviewer.validate(
  {
    task: parsedTask,
    codingOutput: taskResult,
    context: { projectRoot, recentChanges: [] },
    phase: phaseInfo,
    previousAttempts: [],
  },
  'session-id',
  { callbacks }
);
```

---

## Recording/Replay

### HarnessRecorder

Records harness runs for replay and debugging.

```typescript
import { HarnessRecorder } from 'bun-vi';

const recorder = new HarnessRecorder({
  recordingsDir: './recordings/harness',
  sessionId: 'harness-abc123',
  includeSnapshots: true,
});

await recorder.initialize();
await recorder.logEvent('task_started', 'T001', { description: 'Setup' });
await recorder.saveRun('./tasks.md', summary);
```

### `loadHarnessRun(runPath: string): Promise<HarnessRun>`

Loads a recorded harness run from disk.

```typescript
import { loadHarnessRun } from 'bun-vi';

const run = await loadHarnessRun('./recordings/harness/abc123/run.json');
console.log(run.sessionId, run.summary);
```

### `reconstructCheckpoint(events: StateEvent[]): CheckpointInfo`

Reconstructs checkpoint state from recorded events.

```typescript
import { loadStateEvents, reconstructCheckpoint } from 'bun-vi';

const events = await loadStateEvents('./recordings/harness/abc123/state.jsonl');
const checkpoint = reconstructCheckpoint(events);
console.log(checkpoint.validatedTaskIds); // Set<string>
console.log(checkpoint.failedTaskIds);    // Set<string>
```

### `canResume(sessionDir: string): Promise<boolean>`

Checks if a harness run can be resumed from checkpoint.

```typescript
import { canResume } from 'bun-vi';

if (await canResume('./recordings/harness/abc123')) {
  // Resume the run
}
```

---

## Types

### TaskHarnessConfig

```typescript
interface TaskHarnessConfig {
  /** Execution mode: 'live' for real API calls, 'replay' for recorded responses */
  mode: 'live' | 'replay';

  /** Path to the tasks.md file */
  tasksFilePath: string;

  /** Project root directory */
  projectRoot: string;

  /** Session ID (auto-generated if not provided) */
  sessionId?: string;

  /** Task execution timeout in milliseconds */
  taskTimeoutMs?: number;

  /** Maximum validation retries per task */
  maxRetries?: number;

  /** Continue execution on task failure */
  continueOnFailure?: boolean;

  /** Directory for recordings */
  recordingsDir?: string;

  /** Include state snapshots in recordings */
  includeStateSnapshots?: boolean;
}
```

### ParsedTask

```typescript
interface ParsedTask {
  id: string;
  phaseNumber: number;
  phase: string;
  description: string;
  filePaths: string[];
  dependencies: string[];
  userStory: string | null;
  status: 'pending' | 'in-progress' | 'complete' | 'skipped';
  validationCriteria: string;
  flags: TaskFlags;
}
```

### HarnessSummary

```typescript
interface HarnessSummary {
  totalTasks: number;
  completedTasks: number;
  validatedTasks: number;
  failedTasks: number;
  skippedTasks: number;
  durationMs: number;
  tokenUsage: TokenUsage;
}
```

### ITaskHarnessCallbacks

```typescript
interface ITaskHarnessCallbacks {
  onNarrative?: (entry: NarrativeEntry) => void;
  onTaskStarted?: (task: ParsedTask) => void;
  onTaskCompleted?: (task: ParsedTask, result: TaskResult) => void;
  onTaskValidated?: (task: ParsedTask, result: ValidationResult) => void;
  onTaskFailed?: (task: ParsedTask, failure: FailureRecord) => void;
}
```

---

## Dependency Resolution

### `resolveDependencies(tasks: ParsedTask[]): TopologicalSortResult`

Sorts tasks by dependencies using Kahn's algorithm.

```typescript
import { resolveDependencies } from 'bun-vi';

const result = resolveDependencies(tasks);
if (result.hasCycle) {
  console.error('Cycle detected:', result.cyclePath);
} else {
  console.log('Execution order:', result.sorted.map(t => t.id));
}
```

### `detectCycles(tasks: ParsedTask[]): string[] | null`

Detects dependency cycles in tasks.

```typescript
import { detectCycles } from 'bun-vi';

const cycle = detectCycles(tasks);
if (cycle) {
  console.error('Dependency cycle:', cycle.join(' -> '));
}
```

### `getReadyTasks(tasks: ParsedTask[], completed: Set<string>): ParsedTask[]`

Returns tasks that are ready for execution (all dependencies satisfied).

```typescript
import { getReadyTasks } from 'bun-vi';

const ready = getReadyTasks(tasks, completedTaskIds);
// Execute ready tasks in parallel
```

---

## Backoff Utilities

### `withBackoff<T>(fn: () => Promise<T>, config?: BackoffConfig): Promise<T>`

Wraps an async function with exponential backoff retry logic.

```typescript
import { withBackoff } from 'bun-vi';

const result = await withBackoff(
  async () => await apiCall(),
  { baseDelayMs: 1000, maxDelayMs: 60000, maxAttempts: 10 }
);
```

### `isRateLimitError(error: unknown): boolean`

Checks if an error is a rate limit error that should trigger backoff.

```typescript
import { isRateLimitError } from 'bun-vi';

try {
  await apiCall();
} catch (error) {
  if (isRateLimitError(error)) {
    // Wait and retry
  }
}
```
