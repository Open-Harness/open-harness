# Signal Console Levels Redesign

## Problem Statement

The current `info/debug/trace` levels are poorly designed:
- `info` shows only lifecycle events (useless - you don't know what happened)
- `debug` shows everything with truncation
- `trace` adds streaming deltas

Users at the default level should see **what happened** - actions taken, results received, responses generated - just truncated for readability.

## Solution: Intent-Based Levels

Replace `info/debug/trace` with `quiet/normal/verbose`:

| Level | Intent | Content |
|-------|--------|---------|
| `quiet` | "Did it work?" | workflow:start, workflow:end only |
| `normal` | "What happened?" | All signals, **truncated** content |
| `verbose` | "Show me everything" | All signals, **full** content |

Note: `text:delta` (streaming) is only shown at `verbose` level.

## Level Details

### `quiet` - Minimal Output
For CI/CD pipelines, batch jobs, or when you just need pass/fail.

```
17:08:25 workflow:start
17:08:25 workflow:end 3450ms
```

Shows:
- `workflow:start`
- `workflow:end` (with duration)

### `normal` - Default (What Happened)
For development and general use. Shows the story with truncated details.

```
17:08:25 workflow:start
17:08:25 agent:activated [analyzer]
17:08:25 harness:start
17:08:25 tool:call web_search({"query":"test query"})
17:08:25 tool:result "Found 5 results: 1. Example.com - This is a tes..."
17:08:25 text:complete "Based on my search, I found that the quick brown..."
17:08:25 harness:end 2100ms
17:08:25 workflow:end 3450ms
```

Shows everything EXCEPT `text:delta`, with smart truncation:
- **tool:call input**: Max 60 chars, then `...`
- **tool:result**: Max 80 chars, then `...`
- **text:complete**: First line only, max 80 chars, then `...`
- **Multiline content**: Show line count hint, e.g., `"First line..." (12 lines)`

### `verbose` - Full Content
For debugging. Shows everything with full content.

```
17:08:25 workflow:start
17:08:25 agent:activated [analyzer]
17:08:25 harness:start
17:08:25 text:delta "Based"
17:08:25 text:delta " on"
17:08:25 text:delta " my"
... (all deltas)
17:08:25 tool:call web_search
  {"query":"test query","limit":10,"includeImages":false}
17:08:25 tool:result
  Found 5 results:
  1. Example.com - This is a test result
  2. Another.com - More content here
  ... (full result)
17:08:25 text:complete
  Based on my search, I found that the quick brown fox
  jumps over the lazy dog. This is a complete multi-line
  response that shows everything.
17:08:25 harness:end 2100ms
17:08:25 workflow:end 3450ms
```

Shows:
- All signals including `text:delta`
- Full content (multiline if needed)
- Indented for readability

## Signal Visibility Matrix

| Signal | quiet | normal | verbose |
|--------|-------|--------|---------|
| `workflow:start` | ✓ | ✓ | ✓ |
| `workflow:end` | ✓ | ✓ | ✓ |
| `agent:activated` | | ✓ | ✓ |
| `harness:start` | | ✓ | ✓ |
| `harness:end` | | ✓ | ✓ |
| `tool:call` | | ✓ (truncated) | ✓ (full) |
| `tool:result` | | ✓ (truncated) | ✓ (full) |
| `text:complete` | | ✓ (truncated) | ✓ (full) |
| `text:delta` | | | ✓ |
| `thinking:*` | | ✓ (truncated) | ✓ (full) |
| `state:*` | | ✓ | ✓ |
| `error:*` | ✓ | ✓ | ✓ |

## Truncation Rules

### Single-line truncation (normal mode)
```typescript
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + "...";
}
```

### Multiline handling (normal mode)
```typescript
function truncateMultiline(text: string, maxLen: number): string {
  const lines = text.split("\n");
  const firstLine = lines[0];
  const truncated = truncate(firstLine, maxLen);

  if (lines.length > 1) {
    return `${truncated} (${lines.length} lines)`;
  }
  return truncated;
}
```

### Content-specific limits

| Content Type | Max Length (normal) |
|--------------|---------------------|
| tool:call input | 60 chars |
| tool:result | 80 chars |
| text:complete | 80 chars |
| thinking content | 60 chars |

## API Changes

### Before
```typescript
createSignalConsole({ level: "info" | "debug" | "trace" });
```

### After
```typescript
createSignalConsole({ level: "quiet" | "normal" | "verbose" });
```

### Backward Compatibility
Map old names to new for one major version:
- `info` → `normal` (with deprecation warning)
- `debug` → `verbose`
- `trace` → `verbose`

## Verbose Mode Formatting

For multiline content in verbose mode, indent continuation lines:

```
17:08:25 tool:result
  Line 1 of result
  Line 2 of result
  Line 3 of result
```

Use 2-space indent for continuation lines.

## Implementation Files

| File | Changes |
|------|---------|
| `packages/internal/core/src/lib/logger/signal-console.ts` | Rewrite with new levels |
| `packages/internal/core/tests/lib/logger/signal-console.test.ts` | Update tests |
| `examples/test-logging/index.ts` | Update to use new levels |

## Success Criteria

1. `quiet` level shows only workflow start/end
2. `normal` level shows all signals with truncated content
3. `verbose` level shows all signals with full content (including deltas)
4. Multiline content is properly formatted in verbose mode
5. All tests pass
6. Example output matches spec format
