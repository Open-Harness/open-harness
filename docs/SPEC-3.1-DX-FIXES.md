# Open Harness v3.1 DX Fixes Specification

**Date**: 2026-01-12
**Status**: Draft
**Source**: Validated findings from DX-AUDIT-3.1.md

---

## Overview

This spec addresses **validated DX friction points** discovered during real-world testing of `@open-harness/core` from a consumer project. All findings have been verified against the actual codebase.

---

## Problem 1: Claude Code Path Detection

### Status: DROP

**Original Issue**: Users hitting "Could not find Claude Code executable" errors.

**Resolution**: This is not our problem to solve. The `@anthropic-ai/claude-agent-sdk` handles path detection. When users use the SDK directly, they don't pass the binary path. We should not force them to either.

**Action**: Remove any workarounds or path configuration from examples. Let the SDK handle it.

---

## Problem 2: Observability Architecture

### Status: REQUIRES SPEC (see below)

**Issue**: Logging infrastructure exists but requires manual wiring. Users can't see what their workflows are doing.

**Solution**: Deep integration between Pino logger and the signal/event system with:
- Automatic infrastructure logging (tool calls, agent events, signals)
- Configurable log levels and transports
- Console and file outputs at different granularities

See: [Logging Architecture Specification](#logging-architecture-specification)

---

## Problem 3: Example Code Patterns

### Status: IMPLEMENT

**Issue**: Examples scatter `console.log` calls throughout, violating documented policy in CLAUDE.md.

**Policy Reminder**:
> CRITICAL: No console.log/error/warn
> Use the structured Pino logger instead

### Solution: Render Object Pattern

All examples should use a single render object for user-facing output:

```typescript
// At top of every example file
const render = {
  banner: (title: string, subtitle?: string) => {
    console.log(`=== ${title} ===\n`);
    if (subtitle) console.log(`${subtitle}\n`);
  },
  section: (title: string) => console.log(`\n=== ${title} ===\n`),
  metric: (label: string, value: unknown) => console.log(`${label}: ${value}`),
  list: (items: string[]) => items.forEach(i => console.log(`  - ${i}`)),
  json: (obj: unknown) => console.log(JSON.stringify(obj, null, 2)),
  state: (obj: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(obj)) {
      if (v !== null) console.log(`  ${k}: ${JSON.stringify(v)}`);
    }
  },
};
```

### Usage Pattern

```typescript
async function main() {
  render.banner("Trading Agent Example", "Demonstrating parallel execution and guard conditions.");

  const result = await runReactive({
    agents: { analyst, trader, executor },
    state: initialState,
    harness,
  });

  // Infrastructure logging (tool:call, agent:start, etc.) happens automatically via Pino
  // We only render user-facing output:

  render.section("Execution Summary");
  render.metric("Duration", `${result.metrics.durationMs}ms`);
  render.metric("Activations", result.metrics.activations);

  render.section("Final State");
  render.state(result.state);
}
```

### Key Principles

1. **Infrastructure events are invisible to example code** - Pino logs them automatically
2. **User-facing output uses the render object** - Single source of truth
3. **When we swap rendering (e.g., to Listr2)** - Change one object, not 50 console.logs
4. **No scattered console.log calls** - Ever

---

## Problem 4: Response Content Structure

### Status: NEEDS DECISION

**Issue**: Agent outputs stored via `updates` field are full Signal objects, not clean text.

**Current behavior**:
```typescript
result.state.greeting = {
  id: "sig_abc123",
  name: "agent:done",
  payload: { output: "Hello! What a beautiful day...", ... },
  timestamp: "...",
}
```

**Expected by users**:
```typescript
result.state.greeting = "Hello! What a beautiful day..."
```

### Options

**Option A**: Auto-extract text by default in `updates` assignments
**Option B**: Provide `extract: "text" | "full"` option per agent
**Option C**: Provide utility function `getCleanState(result.state)`

**Decision**: TBD

---

## Problem 5: Recording File I/O

### Status: BLOCKED BY PROBLEM 2

Recording behavior depends on the observability architecture. Once logging/recording is specced, this follows naturally.

---

## Logging Architecture Specification

### Design Principles

1. **Batteries included** - Logging just works, no configuration needed
2. **Programmatic control** - Config in code, not just env vars
3. **Clean user code** - Users never write console.log for infrastructure
4. **Sensible defaults** - Console ON, File OFF, level INFO

### Signal → Pino Flow

```
┌─────────────────┐     ┌───────────────────┐     ┌─────────────┐
│   SignalBus     │────▶│ LoggingSubscriber │────▶│    Pino     │
│   emit(signal)  │     │ mapToLevel(name)  │     │ log(level)  │
└─────────────────┘     └───────────────────┘     └─────────────┘
                                                        │
                                           ┌────────────┴────────────┐
                                           ▼                         ▼
                                    ┌─────────────┐          ┌─────────────┐
                                    │   Console   │          │    File     │
                                    │  (pretty)   │          │   (JSONL)   │
                                    └─────────────┘          └─────────────┘
```

### Signal-to-Level Mapping (v0.3.0)

| Level | Signal Patterns | Examples |
|-------|-----------------|----------|
| `error` | `*:error`, `error:*` | `agent:error`, `harness:error` |
| `warn` | `*:abort*`, `*:timeout`, `*:fail*` | `workflow:aborted`, `harness:timeout` |
| `info` | `workflow:*`, `harness:start`, `harness:end`, `*:done`, `*:complete` | `workflow:start`, `agent:done`, `analysis:complete` |
| `debug` | `tool:*`, `state:*`, custom signals | `tool:call`, `tool:result`, `state:patched` |
| `trace` | `*:delta` | `text:delta`, `thinking:delta` |

### Defaults

| Option | Default | Rationale |
|--------|---------|-----------|
| `console` | `true` | Batteries included - see what's happening |
| `file` | `false` | Opt-in for persistence |
| `level` | `"info"` | Lifecycle events, not streaming noise |
| `logDir` | `".open-harness/logs"` | Convention |

### Programmatic Configuration

```typescript
// Default: console ON, file OFF, level info
const result = await runReactive({
  agents: { analyst, trader },
  state: initialState,
  harness,
});

// Enable file logging
const result = await runReactive({
  agents,
  state,
  harness,
  logging: { file: true },
});

// Debug mode
const result = await runReactive({
  agents,
  state,
  harness,
  logging: { level: "debug" },
});

// Disable all logging
const result = await runReactive({
  agents,
  state,
  harness,
  logging: false,
});
```

### Type Definition

```typescript
type LoggingConfig = {
  /** Enable console output (default: true) */
  console?: boolean;

  /** Enable file output (default: false) */
  file?: boolean;

  /** Minimum log level (default: "info") */
  level?: "trace" | "debug" | "info" | "warn" | "error";

  /** Log directory (default: ".open-harness/logs") */
  logDir?: string;
};

type RunReactiveOptions<TState> = {
  // ... existing options ...

  /** Logging configuration. Set to false to disable. Default: console enabled */
  logging?: LoggingConfig | false;
};
```

### Console Output Example

**At `level: "info"` (default):**
```
10:30:00.123 INFO  workflow:start     { agents: ["analyst", "trader"] }
10:30:00.456 INFO  harness:start      { agent: "analyst" }
10:30:02.789 INFO  analysis:complete  { agent: "analyst" }
10:30:03.012 INFO  harness:end        { agent: "analyst", duration: 2556 }
10:30:03.234 INFO  workflow:end       { duration: 3111 }
```

**At `level: "debug"`:**
```
10:30:00.123 INFO  workflow:start     { agents: ["analyst"] }
10:30:01.234 DEBUG tool:call          { tool: "WebSearch", input: {...} }
10:30:01.567 DEBUG tool:result        { tool: "WebSearch", duration: 333 }
10:30:02.345 DEBUG state:patched      { path: "analysis", value: {...} }
10:30:02.789 INFO  analysis:complete  { agent: "analyst" }
```

### Environment Variables (Fallback)

Env vars work as fallback when not set programmatically:

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Minimum level |
| `LOG_CONSOLE` | `true` | Console output |
| `LOG_FILE` | `false` | File output |
| `LOG_DIR` | `.open-harness/logs` | Log directory |
| `LOG_DISABLED` | `false` | Kill switch |

**Precedence:** Code config > Env vars > Defaults

---

## Files to Update

| File | Change |
|------|--------|
| `examples/multi-provider/index.ts` | Replace console.logs with render object |
| `examples/trading-agent/index.ts` | Replace console.logs with render object |
| `examples/simple-reactive/index.ts` | Replace console.logs with render object |
| `examples/recording-replay/index.ts` | Replace console.logs with render object |
| All speckit examples | Audit and update |

---

## Implementation Order

1. **Spec logging architecture** (Problem 2) - Most complex, blocks others
2. **Update examples with render pattern** (Problem 3) - Quick win
3. **Decide on response extraction** (Problem 4) - Needs discussion
4. **Implement recording auto-save** (Problem 5) - After logging is done

