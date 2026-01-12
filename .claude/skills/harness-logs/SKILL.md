---
name: harness-logs
description: |
  Query and analyze Open Harness log files for debugging. USE PROACTIVELY whenever:
  - Debugging any issue in this repository
  - A test fails or errors occur
  - Investigating "why did this happen?"
  - Tracing agent/workflow execution
  - Something isn't working as expected
  - Looking for errors, failures, or unexpected behavior
  - Need to understand what happened during a run

  This skill provides context-efficient JQ patterns to search JSONL logs without reading entire files.
  Logs are at .open-harness/logs/harness.log (JSONL format).

  ALWAYS use this skill before asking the user "what went wrong?" - check the logs first.
---

# Open Harness Log Analysis Skill

Debug Open Harness workflows by querying structured log files.

## IMPORTANT: Proactive Activation

**This skill should be activated AUTOMATICALLY when:**

1. **Test failures** - Before asking "what went wrong?", check the logs
2. **Runtime errors** - Any error during agent/workflow execution
3. **Unexpected behavior** - Something didn't work as expected
4. **Debugging sessions** - Any investigation in this repo
5. **Verification** - Confirming what actually happened vs what should have happened

**DO NOT** ask the user to describe what went wrong if logs exist. Check them first.

**Quick check for recent errors:**
```bash
jq -c 'select(.level >= 50)' .open-harness/logs/harness.log 2>/dev/null | tail -10
```

---

## Log Location & Format

**Default location:** `.open-harness/logs/harness.log`

**Format:** JSONL (one JSON object per line) - perfect for `jq`

**Rotated files:** `harness.log.1`, `harness.log.2`, etc. (newest = no suffix)

## Critical Rule: Context Efficiency

**NEVER cat the entire log file.** Logs are verbose. Use these patterns instead:

```bash
# ✅ GOOD: Stream and filter
jq -c 'select(.eventType == "agent:error")' .open-harness/logs/harness.log

# ✅ GOOD: Limit output
tail -100 .open-harness/logs/harness.log | jq -c 'select(.level >= 40)'

# ❌ BAD: Full file read
cat .open-harness/logs/harness.log | jq .
```

## Event Types by Level

| Level | Event Types | When to Look |
|-------|-------------|--------------|
| ERROR (50) | `agent:error`, `node:error` | Something failed |
| WARN (40) | `flow:aborted`, `agent:aborted` | Execution interrupted |
| INFO (30) | `agent:start/text/complete`, `node:start/complete`, `flow:start/complete` | Normal execution |
| DEBUG (20) | `agent:tool`, `agent:thinking`, `edge:fire`, `state:patch` | Investigating behavior |
| TRACE (10) | `agent:text:delta`, `agent:thinking:delta` | Streaming issues |

## Common Query Patterns

### Find All Errors
```bash
jq -c 'select(.eventType | startswith("agent:error") or startswith("node:error"))' \
  .open-harness/logs/harness.log
```

### Trace a Specific Run
```bash
jq -c 'select(.runId == "YOUR_RUN_ID")' .open-harness/logs/harness.log
```

### Get Agent Results
```bash
jq -c 'select(.eventType == "agent:complete") | {nodeId, durationMs, result: .result[:100]}' \
  .open-harness/logs/harness.log
```

### Find Slow Agents (>5s)
```bash
jq -c 'select(.eventType == "agent:complete" and .durationMs > 5000) | {nodeId, durationMs}' \
  .open-harness/logs/harness.log
```

### List All Tool Calls
```bash
jq -c 'select(.eventType == "agent:tool") | {nodeId, toolName, durationMs}' \
  .open-harness/logs/harness.log
```

### Recent Errors (Last 10)
```bash
jq -c 'select(.level >= 50)' .open-harness/logs/harness.log | tail -10
```

### Timeline for a Run
```bash
jq -c 'select(.runId == "YOUR_RUN_ID") | {ts: .ts, type: .eventType, nodeId}' \
  .open-harness/logs/harness.log | sort
```

### Token Usage Summary
```bash
jq -c 'select(.eventType == "agent:complete") | {nodeId, input: .usage.inputTokens, output: .usage.outputTokens, cost: .totalCostUsd}' \
  .open-harness/logs/harness.log
```

## Debugging Workflows

### 1. "What happened in this run?"
```bash
# Get high-level timeline
RUN_ID="your-run-id"
jq -c "select(.runId == \"$RUN_ID\" and .level >= 30)" .open-harness/logs/harness.log
```

### 2. "Why did this fail?"
```bash
# Find the error and context around it
jq -c 'select(.level >= 50)' .open-harness/logs/harness.log | tail -5

# Then get full context for that run
RUN_ID=$(jq -r 'select(.level >= 50) | .runId' .open-harness/logs/harness.log | tail -1)
jq -c "select(.runId == \"$RUN_ID\")" .open-harness/logs/harness.log
```

### 3. "What tools were called?"
```bash
jq -c 'select(.eventType == "agent:tool") | "\(.nodeId): \(.toolName) (\(.durationMs)ms)"' \
  .open-harness/logs/harness.log
```

### 4. "How expensive was this run?"
```bash
jq -s '[.[] | select(.eventType == "agent:complete")] | {
  totalCost: (map(.totalCostUsd // 0) | add),
  totalTokens: (map(.usage.inputTokens + .usage.outputTokens) | add),
  agentCount: length
}' .open-harness/logs/harness.log
```

### 5. "Show me the agent's output"
```bash
jq -r 'select(.eventType == "agent:text" and .nodeId == "YOUR_NODE") | .content' \
  .open-harness/logs/harness.log
```

## Live Tailing

```bash
# Watch for errors in real-time
tail -f .open-harness/logs/harness.log | jq -c 'select(.level >= 50)'

# Watch specific run
tail -f .open-harness/logs/harness.log | jq -c 'select(.runId == "YOUR_RUN_ID")'

# Watch agent completions
tail -f .open-harness/logs/harness.log | jq -c 'select(.eventType == "agent:complete")'
```

## Searching Rotated Logs

```bash
# Search all log files for an error
for f in .open-harness/logs/harness.log*; do
  echo "=== $f ==="
  jq -c 'select(.level >= 50)' "$f" 2>/dev/null | head -5
done
```

## JSON Fields Reference

### Common Fields (all events)
- `eventType`: The RuntimeEvent type
- `ts`: ISO timestamp
- `level`: Pino level (10-60)
- `service`: Always "open-harness"

### Correlation Fields
- `runId`: Unique execution ID
- `nodeId`: Node being executed
- `sessionId`: Claude SDK session (for resume)

### agent:complete Fields
- `result`: Agent's text output
- `structuredOutput`: Parsed output if schema defined
- `durationMs`: Execution time
- `numTurns`: Conversation turns
- `usage`: Token counts
- `totalCostUsd`: Estimated cost

### agent:tool Fields
- `toolName`: Tool that was called
- `toolInput`: Input to the tool
- `toolOutput`: Output from the tool
- `durationMs`: Tool execution time
- `error`: Error message if failed

### agent:error Fields
- `errorType`: Error classification
- `message`: Error message
- `details`: Additional context

## Environment Configuration

Control logging via environment variables:

```bash
# Change log level
LOG_LEVEL=debug bun run your-script.ts

# Enable console output (pretty-printed)
LOG_CONSOLE=true bun run your-script.ts

# Custom log directory
LOG_DIR=./my-logs bun run your-script.ts

# Disable all logging
LOG_DISABLED=true bun run your-script.ts
```
