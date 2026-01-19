---
title: "Signal Infrastructure"
lastUpdated: "2026-01-20T11:20:52.022Z"
lastCommit: "0d7ddca66eccde94f5c4e59bba218209eb24d640"
lastCommitDate: "2026-01-20T11:15:55Z"
scope:
  - signals
  - event-bus
  - recording
  - reactive
---

# Signal Infrastructure

Core signal routing, storage, and playback for Open Harness v0.3.0.

## What's here

| Module | Description |
|--------|-------------|
| `adapter.ts` | `SignalAdapter` — Output rendering interface |
| `adapters/` | Pre-built adapters (terminal, logs) |
| `bus.ts` | `SignalBus` — Central event dispatcher |
| `memory-store.ts` | `MemorySignalStore` — In-memory recording/replay |
| `player.ts` | `Player` — VCR-style navigation |
| `patterns.ts` | Pattern matching (glob-style) |
| `snapshot.ts` | Point-in-time state derivation |
| `reporter.ts` | Signal reporting interface |
| `console-reporter.ts` | Debug logging reporter |
| `metrics-reporter.ts` | Aggregated metrics collection |

## Core Principle: Signals are Pure Data

**Signals carry data, not presentation logic.** The `Signal` interface is a clean data structure:

```typescript
interface Signal<T = unknown> {
  id: string;        // Unique signal ID
  name: string;      // Colon-separated namespace (e.g., "task:complete")
  payload: T;        // Signal data
  timestamp: string; // ISO timestamp
  source?: SignalSource; // Optional origin tracking
}
```

Adapters define how to render signals—signals themselves have no display metadata.

## Signal Adapters

Adapters render signals to outputs. Each adapter defines its own rendering logic via **renderer maps** (for terminal) or **name-based conventions** (for logs).

### Key Difference from Reporters

| Aspect | Reporter | Adapter |
|--------|----------|---------|
| Focus | Observation, metrics | Output rendering |
| Lifecycle | attach/detach | onStart/onStop |
| Async | Sync only | Sync or async |
| Rendering | No rendering | Defines how to render |

### Terminal Adapter (Renderer Map Pattern)

The terminal adapter uses a **renderer map** where you explicitly define how each signal type renders:

```typescript
import { terminalAdapter, type RendererMap } from "@internal/signals/adapters";

// Define renderers for signals you care about
const renderers: RendererMap = {
  "plan:start": () => "📋 Planning...",
  "plan:created": (signal) => `✓ Created ${signal.payload.tasks.length} tasks`,
  "task:ready": (signal) => `▶ ${signal.payload.title}`,
  "task:complete": (signal) => {
    const icon = signal.payload.outcome === "success" ? "✓" : "✗";
    return `${icon} Task ${signal.payload.taskId} complete`;
  },
};

// Create adapter with your renderers
const adapter = terminalAdapter({ renderers });
```

**Key behaviors:**
- Signals with a renderer in the map are rendered to stdout
- **Signals without a renderer are silently skipped** (no output, no error)
- This allows selective rendering of only the signals you care about

### Terminal Adapter Options

```typescript
interface TerminalAdapterOptions {
  renderers: RendererMap;      // Required: signal name → render function
  write?: (text: string) => void; // Custom output (default: process.stdout.write)
  showTimestamp?: boolean;     // Show timestamps (default: false)
  colors?: boolean;            // ANSI colors in timestamps (default: true)
  patterns?: string[];         // Subscribe patterns (default: ["*"])
}
```

### Logs Adapter (Name-Based Routing)

The logs adapter bridges signals to Pino structured logging using **name-based conventions** to determine log levels:

```typescript
import { logsAdapter } from "@internal/signals/adapters";
import { getLogger } from "@internal/core";

const adapter = logsAdapter({ logger: getLogger() });
```

**Log level routing:**

| Signal Name Pattern | Log Level |
|--------------------|-----------|
| `*:error`, `error:*` | error |
| `*:fail*`, `*:abort*`, `*:timeout` | warn |
| `workflow:*`, `harness:start`, `harness:end`, `*:done`, `*:complete` | info |
| `*:delta` | trace |
| Everything else | debug |

### Logs Adapter Options

```typescript
interface LogsAdapterOptions {
  logger: Logger;          // Required: Pino logger instance
  patterns?: string[];     // Subscribe patterns (default: ["*"])
  includePayload?: boolean; // Include payload in logs (default: true)
}
```

### Creating Custom Adapters

```typescript
import { createAdapter } from "@internal/signals";

// Simple adapter - receives all signals
const myAdapter = createAdapter({
  name: "my-adapter",
  onSignal: (signal) => {
    console.log(`[${signal.name}]`, signal.payload);
  },
});

// Adapter with lifecycle and filtering
const taskAdapter = createAdapter({
  name: "task-tracker",
  patterns: ["task:*", "milestone:*"],  // Only these signals
  onStart: async () => {
    console.log("Starting task tracking...");
  },
  onSignal: async (signal) => {
    // Access typed payload directly
    console.log(`Signal: ${signal.name}`, signal.payload);
  },
  onStop: async () => {
    console.log("Task tracking complete.");
  },
});
```

### Using Adapters with runReactive()

```typescript
import { runReactive } from "@internal/core";
import { terminalAdapter, logsAdapter } from "@internal/signals/adapters";

// Import your renderer map (or define inline)
import { myRenderers } from "./renderers.js";

const result = await runReactive({
  agents,
  state,
  defaultProvider: provider,
  adapters: [
    terminalAdapter({ renderers: myRenderers }),
    logsAdapter({ logger }),
  ],
});
```

### Adapter Interface

```typescript
interface SignalAdapter {
  name: string;
  patterns: SignalPattern[];
  onSignal(signal: Signal): void | Promise<void>;
  onStart?(): void | Promise<void>;
  onStop?(): void | Promise<void>;
}
```

## Defining Signals with defineSignal()

Use `defineSignal()` from `@internal/signals-core` to create type-safe signal definitions:

```typescript
import { defineSignal } from "@internal/signals-core";
import { z } from "zod";

// Define a signal with schema validation
const TaskComplete = defineSignal({
  name: "task:complete",
  schema: z.object({
    taskId: z.string(),
    outcome: z.enum(["success", "failure"]),
  }),
});

// Create a signal instance (validates payload)
const signal = TaskComplete.create({ taskId: "123", outcome: "success" });

// Type guard for matching signals
if (TaskComplete.is(signal)) {
  console.log(signal.payload.taskId); // Type-safe payload access
}
```

## SignalBus

Central dispatcher that routes signals to subscribers.

```typescript
import { SignalBus } from "@internal/signals";
import { createSignal } from "@internal/signals-core";

const bus = new SignalBus();

// Subscribe to exact signal type
const unsub = bus.subscribe("analysis:complete", (signal) => {
  console.log("Analysis done:", signal.payload);
});

// Subscribe to pattern (glob-style)
bus.subscribe("harness:*", (signal) => {
  console.log("Provider event:", signal.type);
});

// Emit a signal
bus.emit(createSignal("analysis:complete", { result: "bullish" }));

// Get history
const history = bus.history(); // All emitted signals

// Cleanup
unsub();
```

### Options

```typescript
const bus = new SignalBus({
  maxHistory: 1000,  // Max signals to retain (default: 1000)
});
```

### Interface

```typescript
interface ISignalBus {
  emit<T>(signal: Signal<T>): void;
  subscribe<T>(patterns: SignalPattern | SignalPattern[], handler: SignalHandler<T>): Unsubscribe;
  history(): readonly Signal[];
  clearHistory(): void;
  subscriptionCount(): number;
}
```

## MemorySignalStore

In-memory signal storage for recording and replay.

```typescript
import { MemorySignalStore } from "@internal/signals";

const store = new MemorySignalStore();

// Start recording
const recordingId = await store.startRecording({
  fixture: "my-test",
  metadata: { version: "1.0" },
});

// Record signals
await store.recordSignal(recordingId, signal);

// Stop recording
await store.stopRecording(recordingId);

// Load for replay
const recording = await store.loadRecording("my-test");
console.log(recording.signals); // All recorded signals
```

### Recording Structure

```typescript
interface Recording {
  id: string;
  fixture: string;
  signals: Signal[];
  metadata: RecordingMetadata;
  checkpoints: Checkpoint[];
}

interface RecordingMetadata {
  startedAt: number;
  stoppedAt?: number;
  signalCount: number;
  [key: string]: unknown;
}
```

## Player

VCR-style navigation through recordings.

```typescript
import { Player } from "@internal/signals";

const player = new Player(recording);

// Navigate
player.play();           // Start playback
player.pause();          // Pause
player.seek(5);          // Jump to signal index 5
player.step();           // Advance one signal
player.stepBack();       // Go back one signal

// Get current state
const state = player.state();
// { position: 5, total: 20, playing: false }

// Get signal at position
const signal = player.currentSignal();

// Iterate all signals
for await (const signal of player.signals()) {
  console.log(signal.type);
}
```

### State

```typescript
interface PlayerState {
  position: PlayerPosition;
  total: number;
  playing: boolean;
  speed: number;
}

interface PlayerPosition {
  index: number;
  timestamp: number;
}
```

## Pattern Matching

Glob-style patterns for signal subscriptions.

```typescript
import { matchesPattern, matchesAnyPattern } from "@internal/signals";

// Exact match
matchesPattern("analysis:complete", signal); // true if type === "analysis:complete"

// Glob patterns
matchesPattern("harness:*", signal);        // Matches "harness:start", "provider:complete"
matchesPattern("node:*:completed", signal);  // Matches "node:writer:completed"
matchesPattern("**:error", signal);          // Matches any signal ending in ":error"

// Multiple patterns
matchesAnyPattern(["harness:*", "harness:*"], signal);
```

### Pattern Syntax

| Pattern | Matches |
|---------|---------|
| `analysis:complete` | Exact match only |
| `harness:*` | Any single segment after `provider:` |
| `**:error` | Any signal ending in `:error` |
| `node:*:*` | Two segments after `node:` |

## Snapshots

Derive point-in-time state from signals.

```typescript
import { snapshot, snapshotAll, createEmptySnapshot } from "@internal/signals";

// Create snapshot at specific signal
const snap = snapshot(signals, targetSignal);

// Create snapshot from all signals
const fullSnap = snapshotAll(signals);

// Empty snapshot
const empty = createEmptySnapshot();
```

### Snapshot Structure

```typescript
interface Snapshot {
  timestamp: number;
  providers: Map<string, ProviderState>;
}

interface ProviderState {
  text: TextAccumulator;
  toolCalls: Map<string, ToolCallState>;
  usage?: TokenUsage;
}
```

## Reporters

Attach reporters for debugging, metrics, or custom processing.

```typescript
import { attachReporter, attachReporters, createConsoleReporter, createMetricsReporter } from "@internal/signals";

// Console reporter (debug logging)
const consoleReporter = createConsoleReporter({
  filter: ["harness:*", "harness:*"],  // Only log these patterns
  format: "compact",                     // "compact" | "full"
});

// Metrics reporter (aggregated stats)
const metricsReporter = createMetricsReporter({
  onComplete: (metrics) => {
    console.log("Total latency:", metrics.totalLatencyMs);
    console.log("Token usage:", metrics.tokenUsage);
  },
});

// Attach to bus
const unsub = attachReporter(bus, consoleReporter);

// Attach multiple
const unsubAll = attachReporters(bus, [consoleReporter, metricsReporter]);
```

### Reporter Interface

```typescript
type SignalReporter = (signal: Signal, context: ReporterContext) => void;

interface ReporterContext {
  bus: ISignalBus;
  index: number;      // Signal position in history
  timestamp: number;  // Current time
}
```

### Metrics Reporter Output

```typescript
interface AggregatedMetrics {
  totalSignals: number;
  totalLatencyMs: number;
  signalCounts: Map<string, number>;
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
}
```

## Integration with runReactive()

The signal infrastructure is used internally by `runReactive()`:

```typescript
import { runReactive, MemorySignalStore } from "@open-harness/core";

const store = new MemorySignalStore();

// Record mode: signals recorded to store
const result = await runReactive({
  agents,
  state,
  defaultProvider: provider,
  fixture: "my-test",
  mode: "record",
  store,
});

// Replay mode: signals loaded from store, no API calls
const replay = await runReactive({
  agents,
  state,
  fixture: "my-test",
  mode: "replay",
  store,
});

// Access signals from result
console.log(result.signals);        // All signals emitted
console.log(result.metrics.latencyMs);
```

## Testing

```typescript
import { describe, expect, it } from "bun:test";
import { SignalBus, MemorySignalStore } from "@internal/signals";
import { createSignal } from "@internal/signals-core";

describe("SignalBus", () => {
  it("routes signals to subscribers", () => {
    const bus = new SignalBus();
    const received: Signal[] = [];

    bus.subscribe("test:*", (signal) => received.push(signal));

    bus.emit(createSignal("test:one", {}));
    bus.emit(createSignal("test:two", {}));
    bus.emit(createSignal("other:signal", {}));

    expect(received).toHaveLength(2);
  });
});
```

## See Also

- `packages/README.md` — Overall architecture
- `packages/internal/core/src/api/README.md` — Harness API details
- `@internal/signals-core` — Signal primitives and Provider interface
