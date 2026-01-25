---
lastUpdated: "2026-01-22T02:16:11.980Z"
lastCommit: "223b17d5453e56a714cf389c20be8282dfb423b9"
lastCommitDate: "2026-01-22T02:08:26Z"
---
# Recording & Replay Workflow

This document describes the workflow for recording and replaying core-v2 workflow sessions using SQLite persistent storage.

## Overview

Core-v2 provides an event-sourced workflow system with recording and replay capabilities:

1. **Recording**: Sessions are persisted to SQLite during workflow execution
2. **Replay**: Recorded sessions can be loaded and replayed via the Tape API
3. **Time-Travel**: The Tape provides step-by-step navigation through recorded events

## Prerequisites

```bash
# Ensure you're in the core-v2 package
cd packages/core-v2

# Install dependencies
bun install
```

## Recording a Workflow Session

### Step 1: Create a SQLite Store

```typescript
import { createSqliteStoreEffect } from "@open-harness/core-v2";
import { Effect } from "effect";

// Create an Effect-based store for use with workflows
const storeService = await Effect.runPromise(
  createSqliteStoreEffect({ path: "./sessions.db" })
);
```

### Step 2: Define Your Workflow

```typescript
import { createWorkflow, defineEvent, defineHandler } from "@open-harness/core-v2";

// Define events
const UserInputEvent = defineEvent<"user:input", { text: string }>("user:input");
const TextCompleteEvent = defineEvent<"text:complete", { fullText: string }>("text:complete");

// Define state
interface MyState {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  eventCount: number;
}

const initialState: MyState = { messages: [], eventCount: 0 };

// Define handlers
const handlers = [
  defineHandler(UserInputEvent, {
    name: "userInputHandler",
    handler: (event, state) => ({
      state: {
        ...state,
        messages: [...state.messages, { role: "user", content: event.payload.text }],
        eventCount: state.eventCount + 1,
      },
      events: [],
    }),
  }),
  // Add more handlers...
];

// Create workflow with SQLite store
const workflow = createWorkflow({
  name: "my-workflow",
  initialState,
  handlers,
  agents: [],
  until: (state) => state.eventCount >= 10, // Your termination condition
  store: storeService, // Attach the SQLite store
});
```

### Step 3: Run with Recording Enabled

```typescript
import { generateSessionId } from "@open-harness/core-v2";

// Generate a session ID (or use your own)
const sessionId = generateSessionId();

// Run with recording enabled
const result = await workflow.run({
  input: "Hello, workflow!",
  record: true,
  sessionId,
});

console.log(`Recorded session: ${result.sessionId}`);
console.log(`Events recorded: ${result.events.length}`);

// Clean up
await workflow.dispose();
```

### Verify Recording

```bash
# Check that the SQLite file was created
ls -la ./sessions.db

# Query sessions (using sqlite3 CLI)
sqlite3 ./sessions.db "SELECT id, event_count FROM sessions;"
```

## Replaying a Recorded Session

### Step 1: Load the Session

```typescript
// Load the recorded session as a Tape
const tape = await workflow.load(sessionId);

console.log(`Loaded ${tape.length} events`);
console.log(`Initial state:`, tape.state);
```

### Step 2: Navigate Through Events

```typescript
// Step forward through events
let current = tape;
while (current.position < current.length - 1) {
  console.log(`Position ${current.position}:`, current.current);
  current = current.step();
}

console.log(`Final state:`, current.state);
```

### Step 3: Time-Travel Debugging

```typescript
// Jump to any position
const atPosition5 = tape.stepTo(5);
console.log(`State at position 5:`, atPosition5.state);

// Step backward
const previous = atPosition5.stepBack();
console.log(`State at position 4:`, previous.state);

// Rewind to beginning
const rewound = atPosition5.rewind();
console.log(`State at position 0:`, rewound.state);
```

## Verifying Deterministic Replay

Replay MUST produce identical state every time. Here's how to verify:

```typescript
// Load events from store
const events = await publicStore.events(sessionId);

// Replay 10 times and collect final states
const states: MyState[] = [];
for (let i = 0; i < 10; i++) {
  const tape = createTapeFromDefinitions(events, handlers, initialState);

  // Navigate to final position
  let current = tape;
  while (current.position < current.length - 1) {
    current = current.step();
  }

  states.push(current.state);
}

// All states must be identical
const reference = states[0];
for (const state of states) {
  console.assert(
    JSON.stringify(state) === JSON.stringify(reference),
    "States must be identical!"
  );
}
console.log("Determinism verified across 10 replays!");
```

## Test Commands

Run the SQLite recording and replay tests:

```bash
# Run all tests (includes SQLite recording tests)
bun run test

# Run only the SQLite recording integration tests
bun run vitest run tests/integration/sqlite-recording.test.ts

# Run with verbose output
bun run vitest run tests/integration/sqlite-recording.test.ts --reporter=verbose
```

## Test Coverage

The `sqlite-recording.test.ts` file verifies:

| Test | Description |
|------|-------------|
| `should record a workflow session to SQLite database file` | Verifies recording creates DB and stores events |
| `should persist events across store instances` | Verifies file persistence works |
| `should load a recorded session and create a Tape with correct event count` | Verifies `workflow.load()` works |
| `should produce IDENTICAL state when replaying recorded session` | Verifies replay determinism |
| `should produce identical state across 10 consecutive replays` | 10x determinism check |
| `should produce identical intermediate states at every position across replays` | Position-level determinism |
| `should support stepBack after loading from SQLite` | Time-travel backward |
| `should support stepTo arbitrary positions after loading from SQLite` | Arbitrary position jumps |
| `should rewind to initial state after loading from SQLite` | Rewind functionality |

## API Reference

### Store Functions

| Function | Description |
|----------|-------------|
| `createSqliteStore({ path })` | Create Promise-based SQLite store |
| `createSqliteStoreEffect({ path })` | Create Effect-based SQLite store (for workflows) |
| `generateSessionId()` | Generate a UUID-based session ID |
| `makeSessionId(id)` | Create a branded SessionId from a string |

### Workflow Methods

| Method | Description |
|--------|-------------|
| `workflow.run({ input, record, sessionId })` | Run workflow, optionally recording |
| `workflow.load(sessionId)` | Load recorded session as Tape |
| `workflow.dispose()` | Clean up resources |

### Tape Methods

| Method | Description |
|--------|-------------|
| `tape.step()` | Move forward one event |
| `tape.stepBack()` | Move backward one event |
| `tape.stepTo(n)` | Jump to position n |
| `tape.rewind()` | Return to position 0 |
| `tape.stateAt(n)` | Get state at position n without changing position |

### Tape Properties

| Property | Description |
|----------|-------------|
| `tape.position` | Current position (0-indexed) |
| `tape.length` | Total number of events |
| `tape.events` | All events in the tape |
| `tape.state` | State at current position |
| `tape.current` | Event at current position |
| `tape.status` | "idle", "playing", "paused", or "recording" |

## Troubleshooting

### "Store not configured for this workflow"

Ensure you pass the store to the workflow definition:

```typescript
const workflow = createWorkflow({
  // ... other config
  store: storeService, // Don't forget this!
});
```

### "Session not found or has no events"

The session ID doesn't exist in the database. Verify:

1. The session was recorded with `record: true`
2. The correct sessionId was used
3. The SQLite file exists and is readable

### Replay produces different state

Ensure handlers are **pure functions**:

- No side effects
- No external state access
- Deterministic output for the same input

## See Also

- [README.md](./README.md) - SDK fixture recording documentation
- [spec.md](../../../specs/001-effect-refactor/spec.md) - Full specification
- [quickstart.md](../../../specs/001-effect-refactor/quickstart.md) - Getting started guide
