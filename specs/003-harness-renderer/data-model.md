# Data Model: Harness Renderer Integration

**Date**: 2025-12-26
**Feature**: 003-harness-renderer

## Overview

This document defines the data structures for the harness renderer integration, including event protocols, configuration types, and state management.

---

## 1. Renderer Protocol Types

### HarnessEvent (Discriminated Union)

The event protocol for communication between TaskHarness and IHarnessRenderer.

```typescript
type HarnessEvent =
  // Lifecycle events
  | HarnessStartEvent
  | HarnessCompleteEvent
  | HarnessErrorEvent
  // Phase events
  | PhaseStartEvent
  | PhaseCompleteEvent
  // Task execution events
  | TaskStartEvent
  | TaskNarrativeEvent
  | TaskCompleteEvent
  | TaskFailedEvent
  | TaskSkippedEvent
  | TaskRetryEvent
  // Validation events
  | ValidationStartEvent
  | ValidationCompleteEvent
  | ValidationFailedEvent
```

### Event Type Details

| Event Type | Key Fields | When Fired |
|------------|------------|------------|
| `harness:start` | tasks[], sessionId, mode | Harness begins execution |
| `harness:complete` | summary | All tasks finished |
| `harness:error` | error | Fatal error occurs |
| `phase:start` | phase, phaseNumber, taskCount | Phase begins |
| `phase:complete` | phaseNumber | Phase finishes |
| `task:start` | task (full ParsedTask) | Task execution begins |
| `task:narrative` | taskId, entry (NarrativeEntry) | Narrative generated |
| `task:complete` | taskId, result | Task succeeds |
| `task:failed` | taskId, failure | Task fails |
| `task:skipped` | taskId, reason | Task skipped |
| `task:retry` | taskId, attempt, maxAttempts, reason | Retry initiated |
| `validation:start` | taskId | Validation begins |
| `validation:complete` | taskId, result | Validation finishes |
| `validation:failed` | taskId, failure | Validation error |

---

## 2. Narrative Types

### NarrativeEntry

A single narrative update from an agent's monologue.

| Field | Type | Description |
|-------|------|-------------|
| timestamp | number | Unix timestamp in milliseconds |
| agentName | AgentName | Which agent produced this ('Parser', 'Coder', 'Reviewer', 'Validator', 'Harness') |
| taskId | string \| null | Associated task, null for harness-level |
| text | string | Human-readable narrative text |

### MonologueMetadata

Metadata about narrative generation.

| Field | Type | Description |
|-------|------|-------------|
| eventCount | number | Events that were summarized |
| historyLength | number | Current monologue history size |
| isFinal | boolean | True if final flush at execution end |

---

## 3. Configuration Types

### MonologueConfig

Configuration for the @AnthropicMonologue decorator.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| minBufferSize | number | 1 | Min events before generation attempt |
| maxBufferSize | number | 10 | Force generation at this count |
| historySize | number | 5 | Previous monologues to include |
| model | 'haiku' \| 'sonnet' \| 'opus' | 'haiku' | Model for generation |
| systemPrompt | string | DEFAULT_MONOLOGUE_PROMPT | Custom generation prompt |

### RendererConfig

Configuration passed to renderers at initialization.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| mode | 'live' \| 'replay' | required | Execution mode |
| sessionId | string | required | Unique session identifier |
| showTimestamps | boolean | false | Show timestamps on events |
| collapseCompleted | boolean | false | Collapse finished phases/tasks |
| showTokenUsage | boolean | false | Show token stats in summary |
| replaySpeed | number | 1.0 | Replay speed (0 = instant) |

---

## 4. Renderer State Types

### TaskRenderState

Mutable state for a single task (maintained by BaseHarnessRenderer).

| Field | Type | Description |
|-------|------|-------------|
| displayStatus | TaskDisplayStatus | 'pending', 'running', 'complete', 'failed', 'skipped', 'retrying' |
| narrative | string | Most recent narrative text |
| validationStatus | ValidationDisplayStatus | 'pending', 'running', 'passed', 'failed' |
| retryCount | number | Retry attempts so far |
| startTime | number | When task started (ms) |
| endTime | number | When task ended (ms) |

### PhaseRenderState

Mutable state for a phase.

| Field | Type | Description |
|-------|------|-------------|
| name | string | Human-readable phase name |
| phaseNumber | number | Numeric identifier |
| taskIds | string[] | Task IDs in this phase |
| isComplete | boolean | All tasks done |
| isCollapsed | boolean | Should be collapsed in display |

---

## 5. Result Types

### TaskResult

Result from task execution.

| Field | Type | Description |
|-------|------|-------------|
| taskId | string | Executed task |
| success | boolean | Whether execution succeeded |
| summary | string | Human-readable summary |
| filesModified | string[] | Files that were modified |
| output | unknown | Structured output |
| durationMs | number | Execution duration |
| tokenUsage | TokenUsage | Token statistics |

### ValidationResult

Result from validation.

| Field | Type | Description |
|-------|------|-------------|
| taskId | string | Validated task |
| passed | boolean | Whether criteria met |
| reasoning | string | Explanation of decision |
| suggestedFixes | string[] | Fixes if failed |
| confidence | number | 0.0-1.0 score |
| uncertainties | string[] | Areas of uncertainty |
| checksPerformed | ValidationCheck[] | Detailed check breakdown |

### HarnessSummary

Summary of complete harness run.

| Field | Type | Description |
|-------|------|-------------|
| totalTasks | number | Total tasks |
| completedTasks | number | Successfully completed |
| validatedTasks | number | Passed validation |
| failedTasks | number | Failed (exhausted retries) |
| skippedTasks | number | Skipped (from checkpoint) |
| durationMs | number | Total run duration |
| tokenUsage | TokenUsage | Aggregate token stats |

---

## 6. Entity Relationships

```text
TaskHarness (1) ─────────────── (0..1) IHarnessRenderer
     │                                      │
     │ has                                  │ receives
     │                                      │
     ▼                                      ▼
ParsedTask (n) ◄─────────────────── HarnessEvent
     │                                      │
     │ produces                             │ contains
     │                                      │
     ▼                                      ▼
NarrativeEntry ◄─────────────────── task:narrative event

MonologueConfig ─────────────── @AnthropicMonologue decorator
                                           │
                                           │ uses
                                           │
                                           ▼
                                 AnthropicMonologueGenerator
                                           │
                                           │ produces
                                           │
                                           ▼
                                    NarrativeEntry
```

---

## 7. State Transitions

### Task Display Status

```text
                    ┌─────────────────────────────────────┐
                    │                                     │
                    ▼                                     │
              ┌─────────┐                                 │
              │ pending │                                 │
              └────┬────┘                                 │
                   │ task:start                           │
                   ▼                                      │
              ┌─────────┐    task:failed     ┌──────────┐│
              │ running │──────(retryable)──►│ retrying ││
              └────┬────┘                    └────┬─────┘│
                   │                              │      │
       ┌───────────┼───────────┬──────────────────┘      │
       │           │           │                         │
  task:complete  task:failed  task:skipped               │
       │        (terminal)     │                         │
       ▼           ▼           ▼                         │
 ┌──────────┐ ┌────────┐ ┌─────────┐                     │
 │ complete │ │ failed │ │ skipped │                     │
 └──────────┘ └────────┘ └─────────┘                     │
```

### Validation Display Status

```text
              ┌─────────┐
              │ pending │
              └────┬────┘
                   │ validation:start
                   ▼
              ┌─────────┐
              │ running │
              └────┬────┘
                   │
       ┌───────────┴───────────┐
       │                       │
  passed=true             passed=false
       │                       │
       ▼                       ▼
  ┌────────┐              ┌────────┐
  │ passed │              │ failed │
  └────────┘              └────────┘
```

---

## 8. Validation Rules

### MonologueConfig Constraints

- `minBufferSize` >= 1
- `maxBufferSize` >= `minBufferSize`
- `historySize` >= 0
- `model` must be valid Anthropic model tier

### RendererConfig Constraints

- `sessionId` must be non-empty string
- `replaySpeed` >= 0 (0 = instant, 1 = real-time)

### NarrativeEntry Constraints

- `timestamp` must be positive integer
- `text` must be non-empty string
- `agentName` must be valid agent enum value
