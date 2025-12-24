# Quickstart: Harness Renderer Integration

**Date**: 2025-12-26
**Feature**: 003-harness-renderer

## Overview

This guide shows how to use the harness renderer system to visualize agent execution progress in real-time.

---

## Installation

```bash
# Install the SDK (includes renderers)
bun add @openharness/sdk

# Optional: For rich terminal UI
bun add listr2
```

---

## Import Patterns

The SDK uses provider namespaces for clear organization:

```typescript
// Pattern 1: Provider-specific imports (explicit, recommended)
import { createTaskHarness } from '@openharness/sdk';
import { CodingAgent } from '@openharness/sdk/anthropic';
import { SimpleConsoleRenderer } from '@openharness/sdk/renderer';

// Pattern 2: Convenience imports (re-exports default provider)
import { createTaskHarness, CodingAgent } from '@openharness/sdk';

// Pattern 3: Multi-provider (future)
import { CodingAgent as AnthropicCoder } from '@openharness/sdk/anthropic';
import { CodingAgent as OpenAICoder } from '@openharness/sdk/openai';
```

---

## Basic Usage

### 1. Create a harness with a renderer

```typescript
import { createTaskHarness } from '@openharness/sdk';
import { SimpleConsoleRenderer } from '@openharness/sdk/renderer';

// Create a renderer
const renderer = new SimpleConsoleRenderer();

// Create harness with renderer
const harness = createTaskHarness({
  tasksFilePath: './tasks.md',
  mode: 'live',
  renderer, // <-- Pass the renderer
});

// Run - narratives will stream to the console
const summary = await harness.run();

console.log(`Validated ${summary.validatedTasks}/${summary.totalTasks} tasks`);
```

### 2. Using the rich terminal renderer

```typescript
import { createTaskHarness } from '@openharness/sdk';
import { Listr2HarnessRenderer } from '@openharness/sdk/renderer/listr2';

const renderer = new Listr2HarnessRenderer();

const harness = createTaskHarness({
  tasksFilePath: './tasks.md',
  mode: 'live',
  renderer,
});

const summary = await harness.run();
```

---

## Renderer Configuration

### RendererConfig options

```typescript
const renderer = new SimpleConsoleRenderer();

await harness.run({
  rendererConfig: {
    mode: 'live',              // 'live' | 'replay'
    sessionId: 'my-session',    // Unique identifier
    collapseCompleted: true,    // Collapse finished tasks to one line
    showTimestamps: true,       // Show timestamps on events
    showTokenUsage: true,       // Show token stats in summary
    replaySpeed: 2.0,           // 2x speed in replay mode
  }
});
```

---

## Creating a Custom Renderer

### Option 1: Implement the interface

```typescript
import type {
  IHarnessRenderer,
  RendererConfig,
  HarnessEvent,
  HarnessSummary
} from '@openharness/sdk/renderer';
import type { ParsedTask } from '@openharness/sdk';

class WebSocketRenderer implements IHarnessRenderer {
  private socket: WebSocket;

  constructor(wsUrl: string) {
    this.socket = new WebSocket(wsUrl);
  }

  initialize(tasks: ParsedTask[], config: RendererConfig): void {
    this.socket.send(JSON.stringify({ type: 'init', tasks, config }));
  }

  handleEvent(event: HarnessEvent): void {
    this.socket.send(JSON.stringify(event));
  }

  finalize(summary: HarnessSummary): void {
    this.socket.send(JSON.stringify({ type: 'finalize', summary }));
    this.socket.close();
  }
}
```

### Option 2: Extend the base class

```typescript
import { BaseHarnessRenderer } from '@openharness/sdk/renderer';
import type {
  ParsedTask,
  RendererConfig,
  NarrativeEntry,
  TaskResult
} from '@openharness/sdk/renderer';

class FileLogRenderer extends BaseHarnessRenderer {
  private logFile: FileHandle;

  protected override async onInitialize(
    tasks: ParsedTask[],
    config: RendererConfig
  ): Promise<void> {
    this.logFile = await fs.open(`harness-${config.sessionId}.log`, 'w');
    await this.log(`Session started: ${tasks.length} tasks`);
  }

  protected override onTaskStart(task: ParsedTask): void {
    this.log(`[${task.id}] Starting: ${task.description}`);
  }

  protected override onTaskNarrative(taskId: string, entry: NarrativeEntry): void {
    this.log(`[${taskId}] ${entry.agentName}: ${entry.text}`);
  }

  protected override onTaskComplete(taskId: string, result: TaskResult): void {
    this.log(`[${taskId}] Complete (${this.formatDuration(result.durationMs)})`);
  }

  protected override async onFinalize(summary: HarnessSummary): Promise<void> {
    await this.log(`Session complete: ${summary.completedTasks}/${summary.totalTasks}`);
    await this.logFile.close();
  }

  private async log(message: string): Promise<void> {
    await this.logFile.write(`${new Date().toISOString()} ${message}\n`);
  }
}
```

---

## Event Types Reference

The renderer receives these events via `handleEvent()`:

| Event | When | Key Data |
|-------|------|----------|
| `harness:start` | Session begins | tasks, sessionId, mode |
| `phase:start` | Phase begins | phase name, task count |
| `task:start` | Task begins | full task details |
| `task:narrative` | Agent narrative | text, agent name |
| `task:complete` | Task succeeds | duration, files modified |
| `task:failed` | Task fails | error, retryable? |
| `task:retry` | Retry initiated | attempt number |
| `validation:start` | Validation begins | task id |
| `validation:complete` | Validation done | passed, confidence |
| `harness:complete` | Session ends | summary stats |

---

## Narrative Flow

Narratives are human-readable summaries of agent work:

```text
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Agent Actions  │───►│    Monologue    │───►│   Narrative     │
│  (tool calls,   │    │   Generator     │    │   Entry         │
│   thinking)     │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                     │
                                                     ▼
                                              ┌─────────────────┐
                                              │  task:narrative │
                                              │     event       │
                                              └─────────────────┘
                                                     │
                                                     ▼
                                              ┌─────────────────┐
                                              │   Renderer      │
                                              │   Display       │
                                              └─────────────────┘
```

---

## Available Override Methods

When extending `BaseHarnessRenderer`, override only what you need:

```typescript
// Lifecycle
onInitialize(tasks, config)
onHarnessStart(tasks, sessionId, mode)
onHarnessComplete(summary)
onHarnessError(error)
onFinalize(summary)

// Phases
onPhaseStart(phase, phaseNumber, taskCount)
onPhaseComplete(phaseNumber)

// Tasks
onTaskStart(task)
onTaskNarrative(taskId, entry)
onTaskComplete(taskId, result)
onTaskFailed(taskId, failure)
onTaskSkipped(taskId, reason)
onTaskRetry(taskId, attempt, maxAttempts, reason)

// Validation
onValidationStart(taskId)
onValidationComplete(taskId, result)
onValidationFailed(taskId, failure)
```

---

## Best Practices

1. **Use factories**: Use `createTaskHarness()` instead of `new TaskHarness()`
2. **Choose the right renderer**: SimpleConsoleRenderer for CI, Listr2 for interactive
3. **Custom renderers**: Extend `BaseHarnessRenderer` for state tracking
4. **Token tracking**: Enable `showTokenUsage: true` in config for cost visibility
5. **Collapse mode**: Use `collapseCompleted: true` for long task lists
