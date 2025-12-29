# Coding Workflow Harness

A two-phase coding workflow that demonstrates the Open Harness SDK.

## Overview

This harness implements a complete coding workflow:

**Phase 1: Planning**
- Takes a PRD (Product Requirements Document)
- Breaks it into development tickets using an LLM

**Phase 2: Execution**
- For each ticket: generates code, then reviews it
- Continues until all tickets are completed

## Setup

```bash
bun install
```

## Usage

```bash
# Run the harness
bun start

# Development mode with hot reload
bun dev
```

## Architecture

This harness demonstrates:

- **defineHarness()**: Fluent API for workflow orchestration
- **Factory Agents**: CodingAgent, PlannerAgent, ReviewAgent from @openharness/anthropic/presets
- **Phase/Task Helpers**: Declarative phase() and task() for progress tracking
- **State Management**: Shared state across workflow phases
- **Channels**: Event-based output destinations for beautiful console logging

## Requirements

- Bun runtime
- `ANTHROPIC_API_KEY` environment variable (or Claude Code session)

## Agent API

This example uses the new factory-based agent system:

```typescript
// Agents are constants (not classes)
import { CodingAgent } from "@openharness/anthropic/presets";

// Execute with typed input
const result = await CodingAgent.execute({
  task: "Write a fibonacci function"
});

// Result is typed
console.log(result.code);        // string
console.log(result.explanation); // string
```

Key differences from old API:
- No `new` keyword - agents are pre-configured constants
- `.execute()` instead of `.plan()`, `.review()`, etc.
- Typed input objects instead of positional arguments
- Session IDs handled internally

## Channels (Event System)

Channels are **output destinations** that subscribe to the event bus. They replace the old Transport pattern with a more composable, pattern-matching approach.

### How Channels Work

```typescript
import { defineChannel } from "@openharness/sdk";

const consoleChannel = defineChannel({
  name: "Console",

  // Fresh state per attach
  state: () => ({ taskCount: 0 }),

  // Pattern-based event handlers
  on: {
    "task:start": ({ output, state }) => {
      state.taskCount++;
      output.line(`Starting task ${state.taskCount}`);
    },
    "task:complete": ({ output }) => {
      output.success("Task complete!");
    },
  },
});

// Attach to harness
await MyHarness.create()
  .attach(consoleChannel)
  .run();
```

### Pattern Matching

Channels support flexible event filtering:
- **Wildcard**: `'*'` matches all events
- **Prefix**: `'task:*'` matches `task:start`, `task:complete`, `task:failed`
- **Exact**: `'phase:start'` matches only that event type

### RenderOutput Helpers

Channels receive `output` helpers for beautiful terminal output:

```typescript
output.line("Normal text");           // Write a line
output.success("✓ Success!");         // Green checkmark
output.fail("✗ Failed");              // Red X
output.spinner("Loading...");         // Spinner animation
output.progress(5, 10, "Tasks");     // Progress bar
```

### Lifecycle Hooks

Channels have `onStart` and `onComplete` hooks for setup/cleanup:

```typescript
defineChannel({
  name: "Logger",
  state: () => ({ events: [] }),
  on: { "*": ({ state, event }) => state.events.push(event) },
  onComplete: ({ state, output }) => {
    output.line(`Logged ${state.events.length} events`);
  },
});
```

### Why Channels?

**Before (old .on() pattern)**:
```typescript
.on("phase", (e) => console.log(`[${e.status}] Phase: ${e.name}`))
.on("task", (e) => console.log(`  [${e.status}] ${e.id}`))
.on("narrative", (e) => console.log(`  💭 ${e.text}`))
```

**After (Channel pattern)**:
```typescript
.attach(ConsoleChannel)  // All output logic encapsulated
```

**Benefits**:
- Reusable across harnesses
- Testable in isolation
- Composable (attach multiple channels)
- Pattern matching reduces boilerplate
- Fresh state per execution
