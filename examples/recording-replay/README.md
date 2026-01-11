# Recording & Replay Example

Demonstrates the signal recording and replay system for testing, debugging, and deterministic execution.

## What This Shows

1. **Recording mode** - Capture all signals during live execution
2. **Replay mode** - Inject recorded signals without calling harness
3. **Player API** - VCR-style navigation through recordings
4. **Store queries** - List and filter recordings

## Architecture

```
Record Mode:                         Replay Mode:
─────────────                        ────────────
runReactive({                        runReactive({
  recording: {                         recording: {
    mode: 'record',      ──►  Store     mode: 'replay',
    store,                              store,
    name: 'my-test'                     recordingId  ◄── Load
  }                                   }
})                                   })
     │                                    │
     ▼                                    ▼
Harness Called ───► Signals          No Harness Call
                    Captured         Signals Injected
```

## Running

```bash
# From repository root
bun run examples/recording-replay/index.ts
```

## Example Output

```
=== Recording & Replay Example ===

This example demonstrates:
1. Recording signals during live execution
2. Replaying without making harness calls
3. Using Player for debugging

──────────────────────────────────────────────────

=== Recording Mode ===

Running workflow with recording enabled...

Duration: 1234ms
Signals captured: 15
Recording ID: rec_1234567890_1

Signal flow:
  [system] workflow:start
  [system] agent:activated
  [claude] harness:start
  [claude] text:delta
  [claude] text:complete
  [claude] harness:end
  [analyzer] analysis:complete
  [system] workflow:end

=== Replay Mode ===

Replaying from recording (no harness calls)...

Duration: 5ms
Signals replayed: 8
Note: Harness was NOT called - signals were injected from recording

=== Player Debug Mode ===

Stepping through recorded signals...

VCR Controls Demo:

▶️ Stepping forward:
  [0] workflow:start
  [1] agent:activated
  [2] harness:start
  [3] text:delta
  [4] text:complete

📸 Snapshot at current position:
  Text: "This is a pangram - a sentence containing every..."
  Harness running: false

⏭️ Fast forward to end:
  Position: 7/8

⏪ Step back:
  Position: 5/8

⏮️ Rewind to start:
  At start: true

🔍 Find analysis:complete signal:
  Found 1 match(es)
  At index: 6

=== Store Query ===

Total recordings: 1

📼 analysis-demo
   ID: rec_1234567890_1
   Signals: 8
   Duration: 1234ms
   Tags: example, demo

Recordings with 'demo' tag: 1

──────────────────────────────────────────────────

✅ Recording & replay example complete!
```

## Code Walkthrough

### 1. Record a Workflow

```typescript
import { createWorkflow, MemorySignalStore } from "@open-harness/core";

const store = new MemorySignalStore();
const { agent, runReactive } = createWorkflow<MyState>();

// Run with recording enabled
const result = await runReactive({
  agents: { analyzer },
  state: initialState,
  recording: {
    mode: "record",
    store,
    name: "my-test",
    tags: ["integration"],
  },
});

// result.recordingId contains the ID for later replay
console.log(`Recording ID: ${result.recordingId}`);
```

### 2. Replay the Workflow

```typescript
// Replay without calling harness
const replayResult = await runReactive({
  agents: { analyzer },
  state: anyState, // Doesn't matter - signals come from recording
  recording: {
    mode: "replay",
    store,
    recordingId: "rec_xxx", // From previous recording
  },
});

// Output is deterministic - same as original recording
```

### 3. Debug with Player

```typescript
import { Player } from "@open-harness/core";

// Load recording
const recording = await store.load(recordingId);
const player = new Player(recording);

// VCR controls
player.step();         // Forward one signal
player.back();         // Back one signal
player.goto(5);        // Jump to index 5
player.rewind();       // Go to start
player.fastForward();  // Go to end

// Inspect state at any point
const snapshot = player.snapshot;
console.log(snapshot.harness.text.content);
console.log(snapshot.harness.toolCalls);

// Search for signals
const matches = player.findAll("tool:*");
```

## API Reference

### Recording Options

```typescript
recording?: {
  mode: "live" | "record" | "replay";
  store?: SignalStore;
  recordingId?: string;  // Required for replay
  name?: string;         // For record mode
  tags?: string[];       // For record mode
}
```

### SignalStore Interface

```typescript
interface SignalStore {
  create(options?: { name?, tags? }): Promise<string>;
  append(id, signal): Promise<void>;
  appendBatch(id, signals): Promise<void>;
  finalize(id, durationMs?): Promise<void>;
  load(id): Promise<Recording | null>;
  list(query?): Promise<RecordingMetadata[]>;
  delete(id): Promise<void>;
}
```

### Player API

| Method | Description |
|--------|-------------|
| `step()` | Move forward one signal |
| `back()` | Move back one signal |
| `goto(index)` | Jump to position |
| `rewind()` | Go to start |
| `fastForward()` | Go to end |
| `findAll(pattern)` | Find all matching signals |
| `position` | Current position info |
| `snapshot` | Derived state at current position |

## Use Cases

### Testing
Record golden responses, replay in tests without API costs.

```typescript
// In CI/locally: record once
await runReactive({ recording: { mode: "record", store, name: "golden" } });

// In tests: replay
await runReactive({ recording: { mode: "replay", store, recordingId } });
```

### Debugging
Step through execution to understand what happened.

```typescript
const player = new Player(recording);
while (!player.position.atEnd) {
  const signal = player.step();
  console.log(signal.name, player.snapshot);
}
```

### Benchmarking
Compare outputs across harness versions or prompts.

## Next Steps

- See `examples/simple-reactive/` for basic patterns
- See `examples/multi-provider/` for multi-harness workflows
- See `examples/testing-signals/` for testing with vitest matchers
