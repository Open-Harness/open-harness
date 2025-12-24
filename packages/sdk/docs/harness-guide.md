# Task Harness Guide

## Overview

The Task Harness is a step-aware orchestration layer that executes `tasks.md` files through SDK agents. It provides:

- **Automated Task Parsing**: Convert markdown task files into structured execution plans
- **Dependency Resolution**: Execute tasks in correct order using topological sorting
- **Validation Loop**: Each task is validated by an AI reviewer with retry support
- **Recording/Replay**: Capture runs for deterministic testing and debugging
- **Checkpoint Resume**: Continue interrupted runs from the last validated task

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        TaskHarness                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ ParserAgent │  │ CodingAgent │  │ ValidationReviewer  │  │
│  │ (Parse MD)  │  │  (Execute)  │  │    (Validate)       │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │            │
│         v                v                     v            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Task State Machine                      │    │
│  │  pending → in-progress → complete → validated        │    │
│  │                           ↓ (retry)    ↓ (fail)     │    │
│  │                        [retry loop]   failed         │    │
│  └─────────────────────────────────────────────────────┘    │
│                              │                              │
│                              v                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              HarnessRecorder                         │    │
│  │  - state.jsonl (append-only events)                 │    │
│  │  - run.json (complete session)                      │    │
│  │  - narratives (agent commentary)                    │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Configuration Options

```typescript
interface TaskHarnessConfig {
  // Required
  mode: 'live' | 'replay';     // Execution mode
  tasksFilePath: string;        // Path to tasks.md
  projectRoot: string;          // Project root directory

  // Optional
  sessionId?: string;           // Auto-generated if not provided
  taskTimeoutMs?: number;       // Default: 300000 (5 minutes)
  maxRetries?: number;          // Default: 3
  continueOnFailure?: boolean;  // Default: false
  recordingsDir?: string;       // Default: 'recordings/harness'
  includeStateSnapshots?: boolean; // Default: false
}
```

### Mode Selection

| Mode | Use Case | API Calls | Deterministic |
|------|----------|-----------|---------------|
| `live` | Production runs | Real | No |
| `replay` | Testing/debugging | Recorded | Yes |

## Recording/Replay Workflow

### 1. Record a Run

```typescript
const harness = createTaskHarness({
  config: {
    mode: 'live',
    tasksFilePath: './tasks.md',
    projectRoot: process.cwd(),
    recordingsDir: './recordings/harness',
    includeStateSnapshots: true,
  }
});

const summary = await harness.run();
// Recordings saved to: ./recordings/harness/{sessionId}/
```

### 2. Inspect Recording

```bash
# Session directory structure
recordings/harness/harness-abc123/
  state.jsonl    # Append-only state events
  run.json       # Complete session data
```

**state.jsonl format:**
```json
{"timestamp":1703123456789,"event":"harness_started","sessionId":"harness-abc123","taskId":null}
{"timestamp":1703123456800,"event":"task_started","sessionId":"harness-abc123","taskId":"T001"}
{"timestamp":1703123457000,"event":"task_completed","sessionId":"harness-abc123","taskId":"T001","data":{"success":true}}
{"timestamp":1703123457100,"event":"task_validated","sessionId":"harness-abc123","taskId":"T001","data":{"passed":true}}
```

### 3. Replay for Testing

```typescript
import { createTestTaskHarness, loadHarnessRun } from 'bun-vi';

// Load the recorded run
const run = await loadHarnessRun('./recordings/harness/harness-abc123/run.json');

// Replay with identical results
const harness = createTestTaskHarness({
  mode: 'replay',
  tasksFilePath: run.tasksFilePath,
  sessionId: run.sessionId,
  recordingsDir: './recordings/harness',
});

const summary = await harness.run();
// Results match original run
```

## Checkpoint Resume

Resume interrupted runs without re-executing validated tasks:

```typescript
import { canResume, createTaskHarness } from 'bun-vi';

const sessionDir = './recordings/harness/harness-abc123';

if (await canResume(sessionDir)) {
  const harness = createTaskHarness({
    config: {
      mode: 'live',
      tasksFilePath: './tasks.md',
      projectRoot: process.cwd(),
      recordingsDir: './recordings/harness',
      sessionId: 'harness-abc123', // Resume this session
    }
  });

  // Automatically skips already-validated tasks
  const summary = await harness.run();
}
```

### Resume Logic

1. Load `state.jsonl` from session directory
2. Reconstruct checkpoint: validated, failed, and completed task IDs
3. Mark validated tasks as "skipped" in new run
4. Continue from first non-validated task

## Troubleshooting

### Task Parsing Failures

**Problem**: Parser fails to extract tasks from markdown

**Solutions**:
1. Verify tasks.md follows expected format:
   ```markdown
   ## Phase 1: Setup
   - [ ] T001 Task description
   - [X] T002 Completed task
   ```
2. Check for malformed checkboxes or missing task IDs
3. Review parser warnings in output

### Dependency Cycles

**Problem**: "Dependency cycle detected" error

**Solutions**:
1. Check task dependencies in tasks.md
2. Use `detectCycles(tasks)` to identify the cycle path
3. Remove circular dependencies

```typescript
import { detectCycles } from 'bun-vi';

const cycle = detectCycles(parsedTasks);
if (cycle) {
  console.log('Cycle:', cycle.join(' -> '));
  // Output: T001 -> T003 -> T005 -> T001
}
```

### Validation Failures

**Problem**: Tasks fail validation repeatedly

**Solutions**:
1. Check `maxRetries` configuration (default: 3)
2. Review validation criteria in task description
3. Enable `continueOnFailure: true` to skip failed tasks
4. Check reviewer feedback in narratives

### Rate Limiting

**Problem**: API rate limit errors

**Solutions**:
1. Harness includes built-in backoff (1-60s exponential)
2. Reduce concurrent task execution
3. Use replay mode for testing

### Resume Not Working

**Problem**: Checkpoint resume starts from beginning

**Solutions**:
1. Verify session directory exists
2. Check `state.jsonl` has `harness_started` but no `harness_completed`
3. Ensure `sessionId` matches existing session

```typescript
import { canResume } from 'bun-vi';

const canResumeRun = await canResume('./recordings/harness/harness-abc123');
console.log('Can resume:', canResumeRun);
```

## Best Practices

### 1. Always Use Recording in Production

```typescript
const harness = createTaskHarness({
  config: {
    mode: 'live',
    recordingsDir: './recordings/harness',
    includeStateSnapshots: true, // For debugging
  }
});
```

### 2. Test with Replay Mode

```typescript
// In tests
const harness = createTestTaskHarness({
  mode: 'replay',
  recordingsDir: './recordings/golden',
});
```

### 3. Handle Callbacks

```typescript
await harness.run({
  onNarrative: (entry) => {
    // Log or display progress
    console.log(`[${entry.agentName}] ${entry.text}`);
  },
  onTaskFailed: (task, failure) => {
    // Alert on failures
    console.error(`Task ${task.id} failed: ${failure.error}`);
  },
});
```

### 4. Enable Graceful Shutdown

```typescript
// Handle SIGINT
process.on('SIGINT', () => {
  harness.abort();
});

// Run will complete current task then exit
await harness.run();
```

### 5. Use Unique Session IDs

```typescript
// Generate unique session ID
const sessionId = `harness-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const harness = createTaskHarness({
  config: {
    sessionId,
    // ...
  }
});
```
