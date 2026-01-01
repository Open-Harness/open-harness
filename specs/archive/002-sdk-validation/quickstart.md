# Quickstart: SDK Validation via Speckit Dogfooding

**Feature**: 002-sdk-validation
**Date**: 2025-12-25

## Overview

The Task Harness executes Speckit's `tasks.md` file using SDK agents, validating the SDK by using it for real work.

## Basic Usage

```typescript
import { createTaskHarness } from "@open-harness/sdk";

// Create harness pointing to tasks.md
const harness = createTaskHarness({
  tasksFilePath: "specs/001-sdk-core/tasks.md",
  mode: "live", // or "replay" for recorded sessions
});

// Run with callbacks
const summary = await harness.run({
  onNarrative: (entry) => {
    console.log(`[${entry.agentName}] ${entry.text}`);
  },
  onTaskComplete: (task, result) => {
    console.log(`✅ ${task.id}: ${result.summary}`);
  },
  onTaskFailed: (task, failure) => {
    console.log(`❌ ${task.id}: ${failure.error}`);
  },
});

console.log(`Completed ${summary.validatedTasks}/${summary.totalTasks} tasks`);
```

## Configuration Options

```typescript
const harness = createTaskHarness({
  // Required
  tasksFilePath: "specs/001-sdk-core/tasks.md",
  mode: "live",

  // Optional
  continueOnFailure: false,     // Default: fail-fast
  taskTimeoutMs: 300000,        // Default: 5 minutes per task
  sessionId: "my-session",      // Auto-generated if not provided
  resumeFromCheckpoint: "recordings/harness/prev-session/state.jsonl",
});
```

## Narrative Output

All agents narrate their work. The harness aggregates narratives:

```
[Parser] I'm reading through the tasks file...
[Parser] Found 68 tasks across 10 phases.
[Harness] Starting execution of 12 pending tasks.
[Coder] Working on T030: Create monologue.md prompt template...
[Coder] Creating file at packages/sdk/prompts/monologue.md
[Reviewer] Checking if T030 is complete...
[Reviewer] ✓ File exists with required sections. Task validated.
```

## Recording and Replay

### Recording a Session

```typescript
const harness = createTaskHarness({
  tasksFilePath: "specs/001-sdk-core/tasks.md",
  mode: "live",
  sessionId: "golden-run-001",
});

await harness.run();
// Recordings saved to: recordings/harness/golden-run-001/
```

### Replaying a Session

```typescript
const harness = createTaskHarness({
  tasksFilePath: "specs/001-sdk-core/tasks.md",
  mode: "replay",
  sessionId: "golden-run-001",
});

// Uses recorded responses instead of live API
await harness.run();
```

## Resuming from Checkpoint

If harness is interrupted, resume from last checkpoint:

```typescript
const harness = createTaskHarness({
  tasksFilePath: "specs/001-sdk-core/tasks.md",
  mode: "live",
  resumeFromCheckpoint: "recordings/harness/prev-session/state.jsonl",
});

// Skips already-validated tasks, continues from last point
await harness.run();
```

## Handling Failures

### Fail-Fast (Default)

```typescript
const harness = createTaskHarness({
  tasksFilePath: "...",
  mode: "live",
  continueOnFailure: false, // Default
});

// Stops on first failure
const summary = await harness.run();
if (summary.failedTasks > 0) {
  console.log("Execution stopped due to failure");
}
```

### Continue on Failure

```typescript
const harness = createTaskHarness({
  tasksFilePath: "...",
  mode: "live",
  continueOnFailure: true,
});

// Continues even if tasks fail
const summary = await harness.run({
  onTaskFailed: (task, failure) => {
    // Log but continue
  },
});

console.log(`Failed: ${summary.failedTasks}, Completed: ${summary.validatedTasks}`);
```

## Retry Behavior

When validation fails, the harness:
1. Feeds failure feedback to Coding Agent
2. Coding Agent retries with feedback context
3. Review Agent validates again
4. Agent can signal abort if retrying is futile

```typescript
await harness.run({
  onTaskFailed: (task, failure) => {
    if (!failure.retryable) {
      console.log(`${task.id} failed permanently: ${failure.error}`);
    } else {
      console.log(`${task.id} will be retried with feedback`);
    }
  },
});
```

## Accessing State

```typescript
const harness = createTaskHarness({ ... });

// Before run - get parsed tasks
await harness.run();
const state = harness.getState();

console.log("Tasks:", state.tasks.length);
console.log("Completed:", Object.keys(state.completedTasks).length);
console.log("Validated:", Object.keys(state.validatedTasks).length);
console.log("Failed:", Object.keys(state.failedTasks).length);
```

## Next Steps

- Run harness on `specs/001-sdk-core/tasks.md` to validate SDK
- Capture golden recordings for CI testing
- Use replay mode for fast iteration on harness behavior
