---
title: "Structured Logger"
lastUpdated: "2026-01-09T12:30:19.759Z"
lastCommit: "a0f7129bbe2a4cbb9fbc6e97c628610eb4eaeb7d"
lastCommitDate: "2026-01-09T12:19:13Z"
scope:
  - logging
  - telemetry
  - debugging
  - observability
---

# Structured Logger

Pino-based structured logging for Open Harness with automatic event bus integration.

## What's here

- **`index.ts`** — Logger factory, global logger, exports
- **`config.ts`** — Configuration types, defaults, env loading
- **`levels.ts`** — Event type → log level mapping
- **`transports.ts`** — File (default) + console (opt-in) with rotation
- **`event-subscriber.ts`** — EventBus → Pino bridge

## Quick Start

```typescript
import { getLogger, subscribeLogger } from "@internal/core";

// Get the global logger
const logger = getLogger();

// Log structured data
logger.info({ runId: "abc-123", nodeId: "writer" }, "Starting node execution");
logger.error({ err: error, context: { input } }, "Node failed");

// Subscribe to runtime events (automatic logging)
const unsubscribe = subscribeLogger(runtime, logger);
await runtime.run();
unsubscribe();
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Minimum level: `trace`, `debug`, `info`, `warn`, `error` |
| `LOG_FILE` | `true` | Enable file logging |
| `LOG_DIR` | `.open-harness/logs` | Log file directory |
| `LOG_CONSOLE` | `false` | Enable pretty console output |
| `LOG_DISABLED` | `false` | Disable all logging |

### Programmatic Configuration

```typescript
import { createLogger } from "@internal/core";

// Custom configuration
const logger = createLogger({
  level: "debug",
  console: true,
  logDir: "./my-logs",
});
```

## Log Levels

| Level | When to Use | Example |
|-------|-------------|---------|
| `trace` | Streaming deltas, very verbose | `agent:text:delta`, `agent:thinking:delta` |
| `debug` | Tool calls, state changes | `agent:tool`, `edge:fire`, `state:patch` |
| `info` | Lifecycle events (default) | `agent:start`, `agent:complete`, `node:complete` |
| `warn` | Interruptions, timeouts | `flow:aborted`, connection timeout |
| `error` | Failures | `agent:error`, `node:error`, exceptions |

## Event Bus Integration

The logger automatically maps RuntimeEvent types to appropriate log levels:

```typescript
import { subscribeLogger } from "@internal/core";

// All runtime events are logged at appropriate levels
const unsubscribe = subscribeLogger(eventBus, logger);

// Events are logged as:
// INFO  agent:start     { runId: "abc", nodeId: "writer", ... }
// DEBUG agent:tool      { runId: "abc", toolName: "search", ... }
// INFO  agent:complete  { runId: "abc", durationMs: 2340, ... }
```

### Filtered Subscription

```typescript
import { subscribeLoggerFiltered } from "@internal/core";

// Only log specific event types
const unsubscribe = subscribeLoggerFiltered(
  eventBus,
  logger,
  ["agent:tool", "agent:error", "node:error"]
);
```

### Run-Specific Subscription

```typescript
import { subscribeLoggerForRun } from "@internal/core";

// Only log events for a specific run
const unsubscribe = subscribeLoggerForRun(eventBus, logger, runId);
```

## Error Logging Convention

**Always use the `err` key for errors** — Pino has special serialization:

```typescript
// ✅ Correct - Pino extracts message, stack, custom properties
logger.error({ err: error, context: { nodeId } }, "Node execution failed");

// ❌ Wrong - Error becomes [object Object]
logger.error({ error: error }, "Node execution failed");

// ❌ Wrong - No structured context
logger.error("Node execution failed: " + error.message);
```

## Log Output

### File Output (Default)

Logs are written to `.open-harness/logs/harness.log` in JSONL format:

```json
{"level":30,"time":1704844800000,"service":"open-harness","eventType":"agent:start","runId":"abc-123","nodeId":"writer","msg":"agent:start"}
{"level":30,"time":1704844802340,"service":"open-harness","eventType":"agent:complete","runId":"abc-123","durationMs":2340,"msg":"agent:complete"}
```

### Console Output (Opt-in)

Enable with `LOG_CONSOLE=true`:

```
10:30:00.123 INFO  agent:start     { runId: "abc-123", nodeId: "writer" }
10:30:02.463 INFO  agent:complete  { runId: "abc-123", durationMs: 2340 }
```

## Log Rotation

- **Trigger**: File exceeds 10MB
- **Behavior**: Renames `harness.log` → `harness.log.1`, etc.
- **Retention**: Keeps 5 rotated files (50MB max total)
- **Timing**: Rotation checked at logger initialization

## Querying Logs

Logs are JSONL format, queryable with `jq`:

```bash
# Find all errors
jq -c 'select(.level >= 50)' .open-harness/logs/harness.log

# Trace a specific run
jq -c 'select(.runId == "abc-123")' .open-harness/logs/harness.log

# Find slow agents (>5s)
jq -c 'select(.eventType == "agent:complete" and .durationMs > 5000)' .open-harness/logs/harness.log
```

See `.claude/skills/harness-logs/SKILL.md` for comprehensive JQ patterns.

## Child Loggers

Add context that appears in all child log entries:

```typescript
import { createChildLogger, getLogger } from "@internal/core";

const logger = getLogger();
const runLogger = createChildLogger(logger, { runId: "abc-123" });

// All logs from runLogger include runId automatically
runLogger.info({ nodeId: "writer" }, "Starting node");
// Output: { runId: "abc-123", nodeId: "writer", msg: "Starting node", ... }
```

## API Reference

### Factory Functions

| Function | Description |
|----------|-------------|
| `getLogger()` | Get or create the global logger instance |
| `createLogger(config?)` | Create a new logger with custom config |
| `createChildLogger(logger, bindings)` | Create child logger with bound context |
| `resetLogger()` | Reset the global logger (for testing) |

### Event Subscribers

| Function | Description |
|----------|-------------|
| `subscribeLogger(eventBus, logger)` | Log all events at appropriate levels |
| `subscribeLoggerFiltered(eventBus, logger, types)` | Log only specified event types |
| `subscribeLoggerForRun(eventBus, logger, runId)` | Log only events for a specific run |

### Configuration Helpers

| Function | Description |
|----------|-------------|
| `loadConfigFromEnv()` | Load config from environment variables |
| `resolveConfig(partial)` | Merge partial config with defaults |
| `getLogFilePath(config)` | Get current log file path |
| `listLogFiles(config)` | List all log files (current + rotated) |

### Level Helpers

| Function | Description |
|----------|-------------|
| `getEventLevel(eventType)` | Get log level for an event type |
| `shouldLog(eventType, level)` | Check if event should be logged at level |
| `getEventsAtLevel(level)` | Get all event types logged at a level |

## Testing

```typescript
import { createLogger, resetLogger } from "@internal/core";

beforeEach(() => {
  resetLogger(); // Clear global logger
});

test("logs events", () => {
  const logger = createLogger({ disabled: true }); // Or use a mock transport
  // ...
});
```

## See Also

- `.claude/skills/harness-logs/SKILL.md` — JQ patterns and debugging workflows
- `../../state/events.ts` — RuntimeEvent type definitions
- `../../runtime/execution/runtime.ts` — EventBus implementation
