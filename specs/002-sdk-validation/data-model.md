# Data Model: SDK Validation via Speckit Dogfooding

**Feature**: 002-sdk-validation
**Date**: 2025-12-25

## Entities

### ParsedTask

Structured task extracted from tasks.md by Parser Agent.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Task ID (e.g., "T001", "T030") |
| phase | string | Phase name (e.g., "Phase 1: Setup") |
| phaseNumber | number | Phase number for ordering (e.g., 1, 2, 3) |
| description | string | Task description text |
| filePaths | string[] | File paths mentioned in task |
| userStory | string \| null | User story reference (e.g., "US1") or null |
| dependencies | string[] | Task IDs this task depends on |
| status | "complete" \| "pending" | Status from markdown checkbox |
| validationCriteria | string | Inferred or explicit validation criteria |
| flags | TaskFlags | Parallel and other flags |

### TaskFlags

Flags parsed from task line.

| Field | Type | Description |
|-------|------|-------------|
| parallel | boolean | True if [P] flag present |
| constitution | string \| null | Constitution reference if present |

### TaskHarnessState

State tracked by the task execution harness.

| Field | Type | Description |
|-------|------|-------------|
| tasks | ParsedTask[] | All parsed tasks |
| taskQueue | string[] | Task IDs in execution order (topologically sorted) |
| currentTaskId | string \| null | Currently executing task ID |
| completedTasks | Map<string, TaskResult> | Task ID → result for completed tasks |
| validatedTasks | Map<string, ValidationResult> | Task ID → validation for validated tasks |
| failedTasks | Map<string, FailureRecord> | Task ID → failure for failed tasks |
| retryHistory | Map<string, RetryRecord[]> | Task ID → retry attempts |
| mode | "live" \| "replay" | Execution mode |
| continueOnFailure | boolean | Whether to continue after failure |
| sessionId | string | Unique session identifier |

### TaskResult

Result from Coding Agent executing a task.

| Field | Type | Description |
|-------|------|-------------|
| taskId | string | Task that was executed |
| success | boolean | Whether coding completed without error |
| summary | string | Agent's summary of work done |
| filesModified | string[] | Files that were modified |
| output | unknown | Structured output from agent |
| durationMs | number | Execution time in milliseconds |
| tokenUsage | TokenUsage | Token usage stats |

### ValidationResult

Result from Review Agent validating a completed task.

| Field | Type | Description |
|-------|------|-------------|
| taskId | string | Task that was validated |
| passed | boolean | Whether validation passed |
| reasoning | string | Explanation of pass/fail decision |
| suggestedFixes | string[] | Suggestions if failed |
| confidence | number | Confidence score 0-1 |
| uncertainties | string[] | Areas of uncertainty |

### FailureRecord

Record of a task failure.

| Field | Type | Description |
|-------|------|-------------|
| taskId | string | Failed task ID |
| stage | "coding" \| "validation" | Stage where failure occurred |
| error | string | Error message |
| retryable | boolean | Whether retry might help |
| timestamp | number | Unix timestamp of failure |

### RetryRecord

Record of a retry attempt.

| Field | Type | Description |
|-------|------|-------------|
| attempt | number | Retry attempt number (1, 2, 3...) |
| previousFailure | FailureRecord | The failure that triggered retry |
| feedback | string | Feedback provided to agent |
| timestamp | number | Unix timestamp of retry |

### HarnessRun

Complete execution session (for recording/replay).

| Field | Type | Description |
|-------|------|-------------|
| sessionId | string | Unique session ID |
| startTime | number | Unix timestamp of start |
| endTime | number \| null | Unix timestamp of end (null if in progress) |
| tasksFile | string | Path to tasks.md that was parsed |
| state | TaskHarnessState | Final state snapshot |
| recordings | AgentRecording[] | All agent session recordings |
| narratives | NarrativeEntry[] | All narrative emissions |

### AgentRecording

Recording of a single agent execution.

| Field | Type | Description |
|-------|------|-------------|
| agentName | string | "Parser" \| "Coder" \| "Reviewer" |
| sessionId | string | Agent session ID |
| taskId | string \| null | Task being processed (null for parser) |
| filePath | string | Path to JSONL recording file |
| startTime | number | Unix timestamp |
| endTime | number | Unix timestamp |

### NarrativeEntry

A single narrative emission.

| Field | Type | Description |
|-------|------|-------------|
| timestamp | number | Unix timestamp |
| agentName | string | Which agent emitted this |
| taskId | string \| null | Task context if applicable |
| text | string | Narrative text |

---

## State Transitions

### Task Status Lifecycle

```
pending → in-progress → complete → validated
                    ↘           ↘
                     → failed    → failed
                           ↑
                     (retry loop)
```

### Harness State Machine

```
IDLE → PARSING → EXECUTING → VALIDATING → NEXT_TASK
  ↑                              ↓
  ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
                              ↓
                           COMPLETE / FAILED
```

---

## Relationships

```
HarnessRun
    │
    ├── TaskHarnessState
    │       │
    │       ├── ParsedTask[] (all tasks)
    │       ├── TaskResult (per completed task)
    │       ├── ValidationResult (per validated task)
    │       ├── FailureRecord (per failed task)
    │       └── RetryRecord[] (per task with retries)
    │
    ├── AgentRecording[] (one per agent call)
    │
    └── NarrativeEntry[] (chronological narrative)
```

---

## Validation Rules

### ParsedTask
- `id` must match pattern `/^T\d{3}[a-z]?$/`
- `dependencies` must reference existing task IDs
- `validationCriteria` must not be empty

### TaskHarnessState
- `taskQueue` must contain valid task IDs from `tasks`
- `currentTaskId` must be null or in `taskQueue`
- `completedTasks` keys must be subset of task IDs
- No task can be in both `completedTasks` and `failedTasks`

### ValidationResult
- `confidence` must be between 0 and 1
- If `passed` is false, `suggestedFixes` should not be empty
