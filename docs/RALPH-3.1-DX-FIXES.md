# Ralph Script: v3.1 DX Fixes Implementation

**Spec**: `docs/SPEC-3.1-DX-FIXES.md`
**Scope**: Logging architecture + example cleanup

---

## Overview

Implement batteries-included logging for Open Harness v3.1:
- Console logging ON by default
- File logging OFF by default (opt-in)
- Auto-wire logging in `runReactive`
- Clean up examples with render object pattern

---

## Phase 1: Update Logger Defaults

### Task 1.1: Update config defaults

**File**: `packages/internal/core/src/lib/logger/config.ts`

Change defaults:
```typescript
export const DEFAULT_CONFIG: LoggerConfig = {
  level: "info",
  console: true,   // CHANGE: was false
  file: false,     // CHANGE: was true
  logDir: ".open-harness/logs",
  fileName: "workflow.log",
  maxFileSize: 10 * 1024 * 1024,
  maxFiles: 5,
  disabled: false,
};
```

### Task 1.2: Update loadConfigFromEnv

**File**: `packages/internal/core/src/lib/logger/config.ts`

Update env var defaults to match:
- `LOG_CONSOLE` default → `true`
- `LOG_FILE` default → `false`

---

## Phase 2: Create Signal-to-Pino Subscriber

### Task 2.1: Create signal level mapping

**File**: `packages/internal/core/src/lib/logger/signal-levels.ts` (NEW)

```typescript
import type { Level } from "pino";

/**
 * Maps v0.3.0 signal names to Pino log levels.
 */
export function getSignalLevel(signalName: string): Level {
  // Error patterns
  if (signalName.includes(":error") || signalName.startsWith("error:")) {
    return "error";
  }

  // Warn patterns
  if (
    signalName.includes(":abort") ||
    signalName.includes(":timeout") ||
    signalName.includes(":fail")
  ) {
    return "warn";
  }

  // Trace patterns (streaming)
  if (signalName.endsWith(":delta")) {
    return "trace";
  }

  // Info patterns (lifecycle)
  if (
    signalName.startsWith("workflow:") ||
    signalName === "harness:start" ||
    signalName === "harness:end" ||
    signalName.endsWith(":done") ||
    signalName.endsWith(":complete")
  ) {
    return "info";
  }

  // Debug patterns (tools, state)
  if (signalName.startsWith("tool:") || signalName.startsWith("state:")) {
    return "debug";
  }

  // Default: custom signals → debug
  return "debug";
}
```

### Task 2.2: Create LoggingSubscriber

**File**: `packages/internal/core/src/lib/logger/signal-subscriber.ts` (NEW)

```typescript
import type { Logger } from "pino";
import type { Signal } from "@internal/signals-core";
import type { SignalBus } from "@internal/signals";
import { getSignalLevel } from "./signal-levels.js";

/**
 * Subscribes to SignalBus and logs all signals at appropriate levels.
 */
export function subscribeSignalLogger(
  bus: SignalBus,
  logger: Logger,
): () => void {
  return bus.subscribe("**", (signal: Signal) => {
    const level = getSignalLevel(signal.name);
    const { id, timestamp, source, ...rest } = signal;

    logger[level](
      {
        signalId: id,
        signalName: signal.name,
        ...signal.payload,
        source: source?.agent ?? source?.provider ?? "system",
      },
      signal.name,
    );
  });
}
```

### Task 2.3: Export from logger index

**File**: `packages/internal/core/src/lib/logger/index.ts`

Add exports:
```typescript
export { getSignalLevel } from "./signal-levels.js";
export { subscribeSignalLogger } from "./signal-subscriber.js";
```

---

## Phase 3: Integrate Logging into runReactive

### Task 3.1: Add logging types

**File**: `packages/internal/core/src/api/types.ts`

Add LoggingConfig type:
```typescript
export type LoggingConfig = {
  /** Enable console output (default: true) */
  console?: boolean;
  /** Enable file output (default: false) */
  file?: boolean;
  /** Minimum log level (default: "info") */
  level?: "trace" | "debug" | "info" | "warn" | "error";
  /** Log directory (default: ".open-harness/logs") */
  logDir?: string;
};
```

### Task 3.2: Update RunReactiveOptions

**File**: `packages/internal/core/src/api/types.ts`

Add to RunReactiveOptions:
```typescript
/** Logging configuration. Set to false to disable. Default: console enabled */
logging?: LoggingConfig | false;
```

### Task 3.3: Wire logging in runReactive

**File**: `packages/internal/core/src/api/run-reactive.ts`

At the start of runReactive, after creating the SignalBus:

```typescript
// Setup logging
let unsubscribeLogger: (() => void) | null = null;

if (options.logging !== false) {
  const loggingConfig = options.logging ?? {};
  const logger = createLogger({
    console: loggingConfig.console ?? true,
    file: loggingConfig.file ?? false,
    level: loggingConfig.level ?? "info",
    logDir: loggingConfig.logDir ?? ".open-harness/logs",
  });
  unsubscribeLogger = subscribeSignalLogger(bus, logger);
}

// ... rest of runReactive ...

// Cleanup at end (before return):
if (unsubscribeLogger) {
  unsubscribeLogger();
}
```

---

## Phase 4: Update Examples with Render Pattern

### Task 4.1: Create shared render utility

**File**: `examples/lib/render.ts` (NEW)

```typescript
/**
 * Render utilities for example output.
 *
 * Use this instead of scattered console.log calls.
 * Infrastructure logging (signals, tools) happens automatically via Pino.
 */
export const render = {
  banner: (title: string, subtitle?: string) => {
    console.log(`\n=== ${title} ===\n`);
    if (subtitle) console.log(`${subtitle}\n`);
  },

  section: (title: string) => {
    console.log(`\n=== ${title} ===\n`);
  },

  metric: (label: string, value: unknown) => {
    console.log(`${label}: ${value}`);
  },

  list: (items: string[]) => {
    items.forEach((item) => console.log(`  - ${item}`));
  },

  json: (obj: unknown) => {
    console.log(JSON.stringify(obj, null, 2));
  },

  state: (obj: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(obj)) {
      if (value !== null && value !== undefined) {
        const display = typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
        console.log(`  ${key}: ${display}`);
      }
    }
  },

  outcome: (message: string) => {
    console.log(`\n${message}\n`);
  },
};
```

### Task 4.2: Update multi-provider example

**File**: `examples/multi-provider/index.ts`

Replace all scattered console.log with render object:

```typescript
import { render } from "../lib/render.js";

async function main() {
  render.banner("Multi-Provider Example", "Demonstrating Claude + Codex in a single workflow.");

  const result = await runReactive({
    agents: { analyzer, summarizer },
    state: { code: sampleCode, analysis: null, summary: null },
    endWhen: (state) => state.summary !== null,
    // Console logging happens automatically
  });

  render.section("Execution Summary");
  render.metric("Duration", `${result.metrics.durationMs}ms`);
  render.metric("Activations", result.metrics.activations);

  render.section("Code Reviewed");
  console.log(sampleCode.trim());

  render.section("Final State");
  render.state(result.state);
}
```

### Task 4.3: Update trading-agent example

**File**: `examples/trading-agent/index.ts`

Same pattern - replace console.logs with render object.

### Task 4.4: Update simple-reactive example

**File**: `examples/simple-reactive/index.ts`

Same pattern - replace console.logs with render object.

### Task 4.5: Audit remaining examples

Check and update:
- `examples/recording-replay/index.ts`
- `examples/speckit/**/*.ts`

---

## Phase 5: Verification

### Task 5.1: Run examples and verify logging

```bash
cd examples/simple-reactive
bun run index.ts
```

Expected: Console shows workflow lifecycle at info level automatically.

### Task 5.2: Test logging config options

```typescript
// Test: logging disabled
await runReactive({ ..., logging: false });
// Expected: No console output

// Test: debug level
await runReactive({ ..., logging: { level: "debug" } });
// Expected: tool:call, tool:result visible

// Test: file enabled
await runReactive({ ..., logging: { file: true } });
// Expected: .open-harness/logs/workflow.log created
```

### Task 5.3: Run typecheck and tests

```bash
bun run typecheck
bun run test
```

---

## Summary

| Phase | Tasks | Files |
|-------|-------|-------|
| 1. Logger Defaults | 2 | `config.ts` |
| 2. Signal Subscriber | 3 | `signal-levels.ts`, `signal-subscriber.ts`, `index.ts` |
| 3. runReactive Integration | 3 | `types.ts`, `run-reactive.ts` |
| 4. Example Cleanup | 5 | `render.ts`, all example files |
| 5. Verification | 3 | - |

**Total**: 16 tasks

---

## Acceptance Criteria

1. Running `examples/simple-reactive/index.ts` shows workflow lifecycle logs automatically
2. No console.log calls in example files (only render object)
3. `logging: false` disables all output
4. `logging: { level: "debug" }` shows tool calls
5. `logging: { file: true }` creates log file
6. All tests pass
7. All examples run without errors
