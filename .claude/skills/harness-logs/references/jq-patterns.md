# JQ Patterns for Open Harness Logs

Advanced JQ patterns for efficient log analysis.

## Core Concepts

### Streaming vs Slurping

```bash
# STREAMING (-c): Process line by line, low memory
jq -c 'select(.level >= 50)' harness.log

# SLURPING (-s): Load all into array, enables aggregation
jq -s 'map(select(.level >= 50))' harness.log
```

**Rule:** Use streaming for filtering, slurping for aggregation.

### Output Modes

```bash
# Compact JSON (-c): One object per line
jq -c '{nodeId, durationMs}'

# Raw strings (-r): No quotes, for piping
jq -r '.runId'

# Pretty print (default): Human readable
jq '.'
```

## Filtering Patterns

### By Event Type
```bash
# Exact match
jq -c 'select(.eventType == "agent:complete")'

# Prefix match
jq -c 'select(.eventType | startswith("agent:"))'

# Multiple types
jq -c 'select(.eventType | IN("agent:start", "agent:complete", "agent:error"))'
```

### By Level
```bash
# Errors and above
jq -c 'select(.level >= 50)'

# Warnings and above
jq -c 'select(.level >= 40)'

# Debug and above (excludes trace)
jq -c 'select(.level >= 20)'
```

### By Time Range
```bash
# After a specific time (ISO format)
jq -c 'select(.ts > "2025-01-09T10:00:00")'

# Last N minutes (requires GNU date)
SINCE=$(date -d '5 minutes ago' -Iseconds)
jq -c "select(.ts > \"$SINCE\")"
```

### By Run ID
```bash
# Single run
jq -c 'select(.runId == "abc-123")'

# Multiple runs
jq -c 'select(.runId | IN("run-1", "run-2"))'

# Runs matching pattern
jq -c 'select(.runId | test("^test-"))'
```

### By Node ID
```bash
# Single node
jq -c 'select(.nodeId == "writer")'

# Nodes matching pattern
jq -c 'select(.nodeId | test("agent.*"))'
```

## Transformation Patterns

### Select Fields
```bash
# Pick specific fields
jq -c '{eventType, nodeId, durationMs}'

# Rename fields
jq -c '{type: .eventType, node: .nodeId, ms: .durationMs}'

# Nested access
jq -c '{input: .usage.inputTokens, output: .usage.outputTokens}'
```

### Truncate Long Values
```bash
# Truncate result to 100 chars
jq -c '{nodeId, result: .result[:100]}'

# Add ellipsis if truncated
jq -c '{nodeId, result: (if (.result | length) > 100 then .result[:100] + "..." else .result end)}'
```

### Format as Text
```bash
# One-liner summary
jq -r '"\(.ts) [\(.eventType)] \(.nodeId // "flow"): \(.msg // "")"'

# Table-like output
jq -r '[.nodeId, .eventType, (.durationMs | tostring)] | @tsv'
```

## Aggregation Patterns

### Count by Type
```bash
jq -s 'group_by(.eventType) | map({type: .[0].eventType, count: length})'
```

### Count by Node
```bash
jq -s 'group_by(.nodeId) | map({node: .[0].nodeId, count: length})'
```

### Sum Duration by Node
```bash
jq -s '
  [.[] | select(.eventType == "agent:complete")]
  | group_by(.nodeId)
  | map({
      node: .[0].nodeId,
      totalMs: (map(.durationMs) | add),
      avgMs: (map(.durationMs) | add / length),
      count: length
    })
'
```

### Total Cost
```bash
jq -s '
  [.[] | select(.eventType == "agent:complete")]
  | {
      totalCost: (map(.totalCostUsd // 0) | add),
      totalInputTokens: (map(.usage.inputTokens) | add),
      totalOutputTokens: (map(.usage.outputTokens) | add)
    }
'
```

### Error Summary
```bash
jq -s '
  [.[] | select(.level >= 50)]
  | group_by(.errorType // .eventType)
  | map({
      type: .[0].errorType // .[0].eventType,
      count: length,
      messages: [.[].message] | unique
    })
'
```

## Timeline Patterns

### Chronological Events for Run
```bash
jq -c 'select(.runId == "abc") | {ts, type: .eventType, nodeId}' | sort
```

### Duration Between Events
```bash
jq -s '
  [.[] | select(.runId == "abc" and .eventType | IN("agent:start", "agent:complete"))]
  | sort_by(.ts)
  | . as $events
  | range(0; length-1; 2)
  | {
      node: $events[.].nodeId,
      start: $events[.].ts,
      end: $events[.+1].ts
    }
'
```

### Execution Order
```bash
jq -s '
  [.[] | select(.eventType == "agent:start")]
  | sort_by(.ts)
  | to_entries
  | map({order: (.key + 1), node: .value.nodeId, ts: .value.ts})
'
```

## Performance Patterns

### Slowest Agents
```bash
jq -s '
  [.[] | select(.eventType == "agent:complete")]
  | sort_by(-.durationMs)
  | .[:5]
  | map({node: .nodeId, ms: .durationMs, run: .runId})
'
```

### Agents Over Threshold
```bash
# Over 10 seconds
jq -c 'select(.eventType == "agent:complete" and .durationMs > 10000) | {nodeId, durationMs, runId}'
```

### Tool Call Performance
```bash
jq -s '
  [.[] | select(.eventType == "agent:tool")]
  | group_by(.toolName)
  | map({
      tool: .[0].toolName,
      count: length,
      avgMs: (map(.durationMs // 0) | add / length),
      maxMs: (map(.durationMs // 0) | max)
    })
  | sort_by(-.avgMs)
'
```

## Combining with Shell

### Recent N Lines
```bash
tail -1000 harness.log | jq -c 'select(.level >= 50)'
```

### Search Rotated Files
```bash
cat .open-harness/logs/harness.log* | jq -c 'select(.runId == "abc")'
```

### Export to CSV
```bash
jq -r '[.ts, .eventType, .nodeId, .durationMs] | @csv' harness.log > events.csv
```

### Pipe to Less
```bash
jq -c 'select(.eventType == "agent:tool")' harness.log | less
```

### Count Quickly
```bash
jq -c 'select(.level >= 50)' harness.log | wc -l
```

## Troubleshooting

### Invalid JSON Lines
```bash
# Skip invalid lines
jq -c '.' harness.log 2>/dev/null

# Find line numbers of invalid JSON
awk 'BEGIN{n=0} {n++; cmd="echo \047" $0 "\047 | jq . 2>&1"; cmd | getline result; close(cmd); if(result ~ /error/) print "Line " n}' harness.log
```

### Large Files
```bash
# Process in chunks
split -l 10000 harness.log chunk_
for f in chunk_*; do jq -c 'select(.level >= 50)' "$f"; done
rm chunk_*
```

### Memory Issues
```bash
# Always use streaming (-c) for filtering
# Only use slurp (-s) on filtered output
jq -c 'select(.runId == "abc")' harness.log | jq -s 'length'
```
