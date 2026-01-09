# Built-in Telemetry

**Status:** Outline Only  
**Purpose:** Full observability out of the box, no configuration required

---

## Overview

Open Harness provides complete telemetry and observability built in. Every action, state change, and performance metric is automatically captured and streamed to your event handler.

**No configuration required.** Everything is active by default.

**What this means:**
- Every node execution is tracked
- Every state change is recorded
- Every performance metric is captured
- Every error is logged with full context
- Every tool call is monitored

---

## Event System (Full Visibility)

### What You Get Automatically

All these events are emitted without you writing any code:

#### Flow-Level Events

**`flow:start`**
- Emits when workflow starts
- Includes: flow name, timestamp

**`flow:complete`**
- Emits when workflow finishes
- Includes: status (complete/failed), flow name, timestamp

**`flow:paused`**
- Emits when workflow is paused
- Includes: timestamp, reason

**`flow:resumed`**
- Emits when workflow resumes from pause
- Includes: timestamp

**`flow:aborted`**
- Emits when workflow is stopped (hard stop)
- Includes: timestamp, reason

#### Node-Level Events

**`node:start`**
- Emits when a node starts executing
- Includes: node ID, run ID, timestamp

**`node:complete`**
- Emits when a node finishes successfully
- Includes: node ID, run ID, output, timestamp

**`node:error`**
- Emits when a node fails
- Includes: node ID, run ID, error message, timestamp

**`node:skipped`**
- Emits when a node is not executed
- Includes: node ID, reason (edge/when), timestamp

#### Edge-Level Events

**`edge:fire`**
- Emits when an edge is traversed
- Includes: edge ID, from node ID, to node ID, timestamp

#### Loop-Level Events

**`loop:iterate`**
- Emits when a loop runs
- Includes: edge ID, iteration number, timestamp

#### State-Level Events

**`state:patch`**
- Emits when state changes
- Includes: full patch details (what changed), timestamp

#### Command Events

**`command:received`**
- Emits when a command is received (pause/resume/stop)
- Includes: command type, timestamp

---

## Performance Metrics (Auto-Captured)

### Agent Performance

Every agent execution automatically tracks:

**`agent:complete` event includes:**
- `usage.inputTokens` - Tokens used for input
- `usage.outputTokens` - Tokens generated
- `usage.cacheCreationInputTokens` - Cache creation tokens
- `usage.cacheReadInputTokens` - Cache read tokens
- `modelUsage` - Per-model token breakdown (when using multiple models)
- `totalCostUsd` - Total cost of this execution
- `durationMs` - Total execution time
- `numTurns` - Number of conversation turns

**What this means:**
- No manual tracking required
- Cost is calculated automatically (per-provider pricing)
- Performance metrics are captured for every run
- You can compare costs across different providers/models

### Tool Execution Metrics

Every tool call automatically tracks:

**`agent:tool` event includes:**
- Tool name
- Tool input (full payload)
- Tool output (full result)
- Execution time (durationMs)
- Error (if tool failed)

**What this means:**
- Full observability into what tools agents are using
- Performance metrics for every tool call
- Error tracking with full context

---

## Usage Metrics (Auto-Tracked)

### Token Usage

Automatically captured:
- Input tokens (per agent call)
- Output tokens (per agent call)
- Cache creation tokens (when model uses caching)
- Cache read tokens (when model reads from cache)
- Per-model breakdown (when workflow uses different providers)

### Loop Counting

Automatically captured:
- Loop iterations (counted per loop)
- Which loop ran (edge ID)
- Current iteration number

**What this means:**
- No manual counter code
- Detect infinite loops automatically
- Track performance over iterations

### Session Tracking

Automatically captured:
- `sessionId` - Unique identifier for each agent session
- `numTurns` - Number of conversation turns
- Agent knows its own session (for resume)

**What this means:**
- Stateful agents maintain conversation context
- Resume is simple (just sessionId + new message)
- No message array reconstruction needed

---

## Error Telemetry (Full Context)

### Node Errors

**`node:error` event includes:**
- Node ID
- Run ID
- Full error message
- Timestamp

### Agent Errors

**`agent:error` event includes:**
- Node ID
- Run ID
- Error type (category of error)
- Error message (full details)
- Error details (optional additional context)
- Timestamp

**What this means:**
- Every error is logged with full context
- You can trace errors back to specific nodes
- You can see what input caused the error

---

## State Visibility

### Automatic Snapshots

**`snapshot:created` event includes:**
- Full state snapshot
- Node statuses (which nodes are done/running)
- Edge statuses (which edges are done)
- Loop counters (current iterations)
- Outputs (all node outputs)
- State (custom workflow state)
- Timestamp

**What this means:**
- Full visibility into workflow execution at any point
- Can resume from any snapshot
- Can compare snapshots for debugging
- Can analyze execution flow

### State Patches

**`state:patch` event includes:**
- Full patch details (what changed)
- Previous state (what it was)
- New state (what it is now)
- Timestamp

**What this means:**
- Fine-grained visibility into state changes
- Can trace how state evolved over time
- Can detect unexpected state mutations

---

## Agent Reasoning Visibility

### Thinking Process

Every agent automatically emits:

**`agent:thinking` event includes:**
- Node ID
- Run ID
- Thinking content (agent's reasoning)
- Token count (optional)
- Timestamp

**`agent:thinking:delta` event includes:**
- Node ID
- Run ID
- Incremental thinking content
- Token count (optional)
- Timestamp

**What this means:**
- Full visibility into agent reasoning process
- Stream agent's "thinking" as it happens
- Can debug why agent made certain decisions
- Can measure reasoning token usage

---

## Tool Call Visibility

### Full Tool Tracing

Every tool call is automatically tracked:

**`agent:tool` event includes:**
- Tool name (which function was called)
- Tool input (full payload passed)
- Tool output (full result returned)
- Execution time (durationMs)
- Error (if tool failed)

**What this means:**
- See exactly what tools agents are using
- See what inputs they're passing
- See what outputs they're getting
- See how long tools take to run
- Debug tool failures with full context

---

## How to Use Telemetry

### Subscribe to Events

```typescript
import { createHarness } from '@open-harness/sdk/server';

const harness = createHarness({
  registry,
  persistenceBackend,
  eventHandler: (event) => {
    // All events come here automatically
    switch (event.type) {
      case 'flow:complete':
        console.log('Flow finished:', event.flowName);
        break;
      case 'node:complete':
        console.log('Node completed:', event.nodeId, 'Output:', event.output);
        break;
      case 'agent:tool':
        console.log('Tool called:', event.toolName, 'Duration:', event.durationMs);
        break;
      case 'agent:complete':
        console.log('Cost:', event.totalCostUsd, 'Tokens:', event.usage);
        break;
      case 'node:error':
        console.error('Node failed:', event.nodeId, 'Error:', event.error);
        break;
    }
  },
});
```

**No configuration required.** Just provide an `eventHandler` callback.

### Build Your Own Dashboard

Because all telemetry is available as events, you can:

- Build real-time dashboards (stream events to UI)
- Build analytics dashboards (aggregate metrics over time)
- Build cost tracking dashboards (track total spend)
- Build error tracking dashboards (track failure rates)
- Build performance dashboards (track execution times)

**Everything is available.** No additional code needed.

---

## Transport Layer (Events to UI)

### Built-in Transports

Open Harness provides built-in transports that automatically stream events:

**HTTP-SSE (Server-Sent Events)**
- For browser-based UIs
- Streams events over HTTP
- Auto-reconnects if connection drops
- Full event visibility in real-time

**WebSocket**
- For TUI and real-time applications
- Bidirectional communication
- Low latency
- Full event visibility in real-time

**Local**
- For CLI tools and local development
- Direct function calls
- No network overhead
- Full event visibility in real-time

### Custom Transport Options

When using built-in transports, you can configure:

**`sendReasoning`** - Include agent thinking in event stream  
**`sendStepMarkers`** - Include step-start markers at node boundaries  
**`sendFlowMetadata`** - Include flow-level status events  
**`sendNodeOutputs`** - Include node output data in events

**All optional.** Configure what you need.

---

## Recording & Replay (Built-in Telemetry)

### Automatic Recording

When you enable recording, all telemetry is automatically captured:

- Every event is recorded
- Every state change is recorded
- Every metric is captured
- Full execution history is preserved

**No manual instrumentation.** Just set recording mode.

### Deterministic Replay

Recordings can be replayed:

- Same input → Same output (deterministic)
- Perfect for testing (reproduce bugs)
- Perfect for comparisons (A/B test different prompts)
- Perfect for regression (catch breaking changes)

**All telemetry captured.** Replay has full visibility.

---

## Summary

### What You Get For Free

✅ **Flow visibility** - Start, complete, pause, resume, abort events  
✅ **Node visibility** - Start, complete, error, skip events  
✅ **Edge visibility** - Fire events show execution path  
✅ **Loop visibility** - Iteration counting, loop tracking  
✅ **State visibility** - Patches, snapshots, full state history  
✅ **Agent reasoning visibility** - Thinking process, token usage  
✅ **Tool call visibility** - Full input/output, timing, errors  
✅ **Performance metrics** - Token usage, cost, duration, turns  
✅ **Error telemetry** - Full context, categorization, details  
✅ **Session tracking** - Stateful agent support, resume simplicity  
✅ **Built-in transports** - HTTP-SSE, WebSocket, Local (no config)  
✅ **Recording & replay** - Automatic capture, deterministic testing  

### What You Don't Need to Do

❌ No event instrumentation code  
❌ No metric tracking code  
❌ No error logging code  
❌ No state monitoring code  
❌ No performance profiling code  
❌ No configuration (everything active by default)  
❌ No setup (just subscribe to events)  

### The Result

**Complete observability out of the box.**

Stream events. Build dashboards. Understand your workflows.

No code required.
