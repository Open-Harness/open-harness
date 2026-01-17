# RALPH-3.2: Signal Console Renderer & File Store

## Task Overview

Implement a clean, color-coded console renderer for signal logging and a FileSignalStore for persistent recording/replay testing.

## PHASE 1: FileSignalStore Implementation

Create `packages/internal/signals/src/file-store.ts`:

```typescript
/**
 * File-based SignalStore for persistent signal recordings.
 *
 * Storage format:
 * - Each recording is a directory: {baseDir}/{recordingId}/
 * - Metadata: metadata.json
 * - Signals: signals.jsonl (append-only)
 */
export class FileSignalStore implements SignalStore {
  constructor(options: { baseDir: string });

  create(options?: { name?: string; tags?: string[] }): Promise<string>;
  append(id: string, signal: Signal): Promise<void>;
  appendBatch(id: string, signals: Signal[]): Promise<void>;
  finalize(id: string, durationMs?: number): Promise<void>;
  load(id: string): Promise<Recording | null>;
  list(query?: RecordingQuery): Promise<RecordingMetadata[]>;
  delete(id: string): Promise<void>;
}
```

Requirements:
- Use `node:fs/promises` for async file operations
- JSONL format for signals (one signal per line, append-friendly)
- Support recording queries by name, tags, date range
- Export from `@internal/signals` and `@open-harness/core`

## PHASE 2: Signal Console Transport

Create `packages/internal/core/src/lib/logger/signal-console.ts`:

```typescript
/**
 * Clean, color-coded console output for signals.
 *
 * Format: "HH:MM:SS signal:name details"
 *
 * Colors by prefix:
 * - workflow:* = cyan
 * - agent:* = green
 * - harness:* = magenta
 * - tool:* = yellow
 * - text:* = dim (only at debug/trace)
 * - error:* = red
 */
export function createSignalConsole(options?: {
  level?: "info" | "debug" | "trace";
  colors?: boolean;
}): (signal: Signal) => void;
```

Output examples:
```
05:59:18 workflow:start
05:59:18 agent:activated
05:59:18 harness:start
05:59:18 tool:call web_search("test query")
05:59:18 tool:result "Search results..."
05:59:18 harness:end 100ms
05:59:18 workflow:end 35ms
```

Requirements:
- Use `picocolors` for terminal colors (already a dependency)
- Time format: HH:MM:SS (24h, no date)
- Signal-specific payload formatting:
  - tool:call → `{toolName}({input})`
  - tool:result → truncated result string
  - harness:end → duration
  - workflow:end → duration
- text:delta only shown at trace level
- No JSON blobs, no log levels, no runId in output

## PHASE 3: Integration

Update `runReactive` to support the new console transport:

```typescript
const result = await runReactive({
  agents: { analyzer },
  state: initialState,
  logging: {
    console: "pretty",  // NEW: use signal-console instead of Pino
    level: "info",
  },
});
```

Options:
- `console: true` (default) = pretty signal console
- `console: "json"` = Pino JSON output (current behavior)
- `console: false` = no console output

## PHASE 4: Validation with Recording

Create a test that:
1. Uses FileSignalStore to record signals
2. Replays and validates the console output format
3. Captures stdout to assert exact output format

Test file: `packages/internal/core/tests/lib/logger/signal-console.test.ts`

```typescript
describe("signal-console", () => {
  it("formats workflow signals correctly", async () => {
    const store = new FileSignalStore({ baseDir: ".test-recordings" });

    // Record a workflow
    const result = await runReactive({
      agents: { testAgent },
      state: {},
      recording: { mode: "record", store, name: "console-test" },
      logging: false, // Disable during record
    });

    // Capture console output during replay
    const output = captureConsole(() => {
      for (const signal of result.signals) {
        consoleRenderer(signal);
      }
    });

    // Validate format
    expect(output).toMatch(/^\d{2}:\d{2}:\d{2} workflow:start$/m);
    expect(output).toMatch(/^\d{2}:\d{2}:\d{2} workflow:end \d+ms$/m);
    expect(output).not.toContain("runId");
    expect(output).not.toContain("service");
  });
});
```

## Success Criteria

All of the following must be TRUE:

1. `bun test packages/internal/signals/tests/file-store.test.ts` passes
2. `bun test packages/internal/core/tests/lib/logger/signal-console.test.ts` passes
3. `bun run typecheck` passes with 0 errors
4. Running `bun run examples/test-logging/index.ts` shows clean output like:
   ```
   06:00:01 workflow:start
   06:00:01 agent:activated
   06:00:01 harness:start
   06:00:01 harness:end 100ms
   06:00:01 workflow:end 35ms
   ```
5. FileSignalStore creates recordings in `.test-recordings/` that can be replayed

## Completion Promise

When ALL success criteria are met, output:

```
<promise>All signal-console tests pass and output matches expected format</promise>
```

DO NOT output this promise unless:
- You have actually run the tests and they pass
- You have verified the console output format matches the spec
- TypeCheck passes

## Files to Create/Modify

| File | Action |
|------|--------|
| `packages/internal/signals/src/file-store.ts` | CREATE |
| `packages/internal/signals/src/index.ts` | MODIFY - export FileSignalStore |
| `packages/internal/signals/tests/file-store.test.ts` | CREATE |
| `packages/internal/core/src/lib/logger/signal-console.ts` | CREATE |
| `packages/internal/core/src/lib/logger/index.ts` | MODIFY - export createSignalConsole |
| `packages/internal/core/tests/lib/logger/signal-console.test.ts` | CREATE |
| `packages/internal/core/src/api/run-reactive.ts` | MODIFY - support console: "pretty" |
| `packages/open-harness/core/src/index.ts` | MODIFY - export FileSignalStore |
| `examples/test-logging/index.ts` | MODIFY - use pretty console |

## Notes

- Use the existing `MemorySignalStore` as reference for SignalStore interface
- picocolors is already installed (check package.json)
- Keep backward compatibility - existing `logging: true` should work
- The FileSignalStore should clean up test recordings after tests
