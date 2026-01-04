# Agent Observability & Resume Specification

**Status**: DRAFT - Awaiting Approval
**Last Updated**: 2026-01-03
**Author**: Generated via spec collaboration

---

## 1. Overview

This specification defines:
1. **Agent-level observability events** emitted during Claude agent execution
2. **Resume semantics** for paused agent nodes
3. **Testing infrastructure** for workflow replay without network calls

### 1.1 Design Principles

| Principle | Description |
|-----------|-------------|
| **Snapshot-based resume** | Workflow state is restored from snapshots; events are audit/UI only |
| **Agent session delegation** | Agent internal state (conversation history) is managed by Claude SDK |
| **Nested event context** | Every agent event includes `nodeId` and `runId` for self-contained processing |
| **Per-node ordering** | Events within a node are strictly ordered; cross-node events may interleave |
| **Audit-first replay** | Replay re-emits recorded events and snapshots for UI/debug; it does not re-execute SDK calls |

### 1.2 Replay Model (Explicit)

Replay is defined as **audit playback**, not deterministic re-execution:

- **Replay input**: (a) latest `RunSnapshot` and (b) append-only event log
- **Replay output**: UI timeline + reconstructed state for inspection
- **No SDK re-execution**: Agent outputs are **not** regenerated during replay

If deterministic re-execution is required later, it must be implemented as a separate mode
("simulation replay") that uses recorded agent outputs or fixtures. That is **out of scope**
for this spec and requires explicit approval.

---

## 2. State Taxonomy

Three distinct types of state exist in the system:

### 2.1 Workflow State (MUST persist)

Owned by the kernel runtime. Stored in `RunSnapshot`.

| Field | Purpose |
|-------|---------|
| `nodeStatus` | Execution status of each node |
| `edgeStatus` | Which edges have fired/skipped |
| `outputs` | Final output of each completed node |
| `state` | User-defined workflow state (e.g., task lists) |
| `loopCounters` | Iteration counts for loop edges |
| `inbox` | Queued commands pending processing |
| `agentSessions` | **NEW** - Map of nodeId → sessionId |

### 2.2 Agent Internal State (NOT our problem)

Owned by Claude SDK. Maintained per `sessionId`.

- Conversation history
- Files touched
- Tool results
- Thinking context

The kernel only stores `sessionId` to enable resume. The SDK reconstructs agent state from that ID.

### 2.3 UI/Observability State (append-only log)

Stored as events for timeline rendering and debugging.

- Agent started/completed
- Tool calls with inputs/outputs
- Text generation (streaming)
- Thinking tokens (streaming)
- Errors and warnings

---

## 3. Agent Event Schema

All agent events include nested context:

```ts
interface AgentEventBase {
  nodeId: string;    // Which node emitted this
  runId: string;     // Which execution of that node
  timestamp: number; // Unix timestamp (ms)
}
```

### 3.1 Event Types

#### `agent:start`

Emitted when a Claude agent begins execution.

```ts
type AgentStartEvent = AgentEventBase & {
  type: "agent:start";
  sessionId: string;
  model?: string;
  prompt: string | ClaudeMessageInput[];  // Full prompt or messages array
};
```

**Note:** We store the full prompt/messages. UI can truncate for display if needed. This matches the actual `ClaudeAgentInput` interface which accepts either form.

#### `agent:thinking:delta`

Emitted for streaming extended thinking tokens (real-time deltas).

```ts
type AgentThinkingDeltaEvent = AgentEventBase & {
  type: "agent:thinking:delta";
  content: string;       // Thinking text chunk (delta)
  tokenCount?: number;   // Tokens in this chunk
};
```

#### `agent:thinking`

Emitted for complete thinking blocks (non-streaming fallback).

```ts
type AgentThinkingEvent = AgentEventBase & {
  type: "agent:thinking";
  content: string;       // Complete thinking text block
  tokenCount?: number;   // Tokens in this block
};
```

#### `agent:text:delta`

Emitted for streaming assistant text output (real-time deltas).

```ts
type AgentTextDeltaEvent = AgentEventBase & {
  type: "agent:text:delta";
  content: string;  // Text chunk (delta)
};
```

#### `agent:text`

Emitted for complete text blocks (non-streaming fallback).

```ts
type AgentTextEvent = AgentEventBase & {
  type: "agent:text";
  content: string;  // Complete text block
};
```

#### `agent:tool`

Emitted when the agent calls a tool.

```ts
type AgentToolEvent = AgentEventBase & {
  type: "agent:tool";
  toolName: string;
  toolInput: unknown;   // Full input
  toolOutput: unknown;  // Full output
  durationMs?: number;
  error?: string;       // If tool failed
};
```

#### `agent:error`

Emitted for agent-specific errors. These are errors from the SDK (tool failures, turn limits, etc.) that may or may not be fatal depending on workflow policy.

```ts
type AgentErrorEvent = AgentEventBase & {
  type: "agent:error";
  errorType: string;    // SDK subtype: "error_tool_use", "error_max_turns", etc.
  message: string;      // Human-readable error message
  details?: unknown;    // Raw SDK error data for debugging
};
```

**Common error types from SDK:**
- `error_tool_use` - A tool call failed
- `error_max_turns` - Hit the turn limit
- `error_user` - User rejected/cancelled something
- `network_error` - Connection issues
- `rate_limit` - API rate limited

**Note:** We don't include a `recoverable` field. The workflow's error handling policy (`node.policy.continueOnError`) decides what to do. The `agent:error` event just records what happened.

#### `agent:complete`

Emitted when agent finishes successfully.

```ts
type AgentCompleteEvent = AgentEventBase & {
  type: "agent:complete";
  result: string;                   // Final text output
  structuredOutput?: unknown;       // Parsed output if schema provided
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationInputTokens?: number;
    cacheReadInputTokens?: number;
  };
  modelUsage?: Record<string, {
    inputTokens: number;
    outputTokens: number;
  }>;
  totalCostUsd?: number;
  durationMs: number;
  numTurns: number;
};
```

### 3.2 Event Flow Example

```
agent:start          { nodeId: "task-agent", sessionId: "sess-123", prompt: "..." }
agent:thinking:delta { nodeId: "task-agent", content: "Let me " }
agent:thinking:delta { nodeId: "task-agent", content: "analyze..." }
agent:text:delta     { nodeId: "task-agent", content: "I'll " }
agent:text:delta     { nodeId: "task-agent", content: "start by..." }
agent:tool           { nodeId: "task-agent", toolName: "read_file", toolInput: {...}, toolOutput: {...} }
agent:tool           { nodeId: "task-agent", toolName: "write_file", toolInput: {...}, toolOutput: {...} }
agent:text:delta     { nodeId: "task-agent", content: "Done! " }
agent:text:delta     { nodeId: "task-agent", content: "I've updated..." }
agent:complete       { nodeId: "task-agent", result: "...", usage: {...}, durationMs: 4523 }
```

**Note:** Delta events (`agent:text:delta`, `agent:thinking:delta`) are emitted during streaming. Complete events (`agent:text`, `agent:thinking`) are only emitted as fallback when streaming is not available.

---

## 4. RunSnapshot Changes

### 4.1 New Field: `agentSessions`

```ts
type RunSnapshot = {
  runId?: string;
  status: RuntimeStatus;
  outputs: Record<string, unknown>;
  state: Record<string, unknown>;
  nodeStatus: Record<string, "pending" | "running" | "done" | "failed">;
  edgeStatus: Record<string, "pending" | "fired" | "skipped">;
  loopCounters: Record<string, number>;
  inbox: RuntimeCommand[];
  agentSessions: Record<string, string>;  // NEW: nodeId -> sessionId
};
```

### 4.2 Session Lifecycle

1. **On agent start**: Save sessionId immediately
   ```ts
   snapshot.agentSessions[nodeId] = sessionId;
   persistSnapshot();  // Persist before SDK call
   ```

2. **On agent complete**: SessionId remains for potential multi-turn

3. **On resume**: Retrieve sessionId for continuation
   ```ts
   const sessionId = snapshot.agentSessions[nodeId];
   query({ prompt: resumeMessage, options: { sessionId } });
   ```

---

## 5. Resume Semantics

### 5.1 Workflow Resume

When a workflow is resumed:

1. Load `RunSnapshot` from store
2. Restore runtime state (node status, edge status, etc.)
3. Emit `flow:resumed` event
4. Continue scheduling from current state

### 5.2 Agent Node Resume

When an agent node has status `"running"` on resume:

1. Retrieve `sessionId` from `snapshot.agentSessions[nodeId]`
2. Determine resume prompt:
   - If `resume.message` provided → use that
   - Otherwise → default to `"continue"`
3. Call SDK with sessionId + prompt
4. SDK reconstructs conversation from sessionId
5. Agent continues from where it left off

```ts
// Resume command with optional message
type RuntimeCommand =
  | { type: "resume"; message?: string }  // message defaults to "continue"
  // ...other commands
```

### 5.3 Resume Flow Diagram

```
User clicks Resume
        │
        ▼
Load RunSnapshot from store
        │
        ▼
For each node with status="running":
        │
        ├─── Is it an agent node?
        │           │
        │           ▼ Yes
        │    Get sessionId from agentSessions
        │           │
        │           ▼
        │    Get resume prompt (provided or "continue")
        │           │
        │           ▼
        │    Call query({ prompt, options: { sessionId } })
        │
        ▼
Continue normal execution loop
```

### 5.4 Command Routing & Prompt Injection (Explicit)

**Goal**: Ensure injected prompts are delivered to the correct running agent run and
recorded for observability.

#### Command Routing Rules

- `send` and `reply` commands **must include** a `runId`.
- If `runId` is missing, the runtime **rejects the command** and does not enqueue it.
- A rejected command is recorded as a `command:received` event with the invalid payload
  and then surfaced as a runtime error (throw) to avoid silent misrouting.

#### Injection Semantics

- Injected messages are delivered only to the `CommandInbox` for that `runId`.
- The Claude node consumes the inbox as part of its streaming message generator.
- Each injected message is also recorded via the existing `command:received` event.

#### Resume + Injection

- If `resume.message` is provided, the runtime injects it into the run-specific inbox
  before resuming.
- If no message is provided, the default resume prompt is `"continue"`.

**Rationale**: This removes ambiguity, prevents cross-run leakage, and keeps all inbound
messages visible in the event log via `command:received`.

---

## 6. Recording & Replay Pipeline

### 6.1 Recording

All `RuntimeEvent` entries are appended to the `RunStore`:

- `flow:*`, `node:*`, `edge:*`
- `command:received`
- **agent events** (`agent:*`)

This produces an append-only log suitable for audit and UI playback.

### 6.2 Replay (Audit Playback)

Replay is a **read-only** reconstruction:

1. Load latest `RunSnapshot` for the run
2. Load all events (optionally filtered by sequence)
3. Re-emit events in order to the UI
4. Use snapshot for state, not for re-execution

**Replay does not** re-run nodes or call the SDK. It is purely observational.

### 6.3 Deterministic Re-Execution (Explicitly Out of Scope)

If a future mode is desired where the runtime replays agent outputs deterministically,
it must:

- Record full agent outputs/tool I/O
- Provide a fixture-backed "mock query" path
- Prevent live SDK calls during replay

That is **not implemented** in this spec and must be separately approved.

---

## 7. Testing Infrastructure

### 6.1 SDK Interceptor Pattern

Nodes stay clean. Testing is done by replacing the `queryFn`:

```ts
// Production
const claudeNode = createClaudeNode();

// Testing
const mockQuery = createMockQuery({
  fixtures: loadFixtures("tests/fixtures/my-workflow/")
});
const claudeNode = createClaudeNode({ queryFn: mockQuery });
```

### 6.2 Fixture Structure

Fixtures are JSON files in `tests/fixtures/`:

```
tests/fixtures/
  recordings/
    workflow-abc/
      task-agent.json
      verifier-agent.json
```

Each fixture file:

```json
{
  "calls": [
    {
      "input": {
        "prompt": "Analyze the task list...",
        "options": { "maxTurns": 10 }
      },
      "output": {
        "text": "I've analyzed the tasks...",
        "usage": { "inputTokens": 150, "outputTokens": 200 },
        "durationMs": 1234,
        "sessionId": "sess-fixture-1"
      },
      "events": [
        { "type": "agent:start", "sessionId": "sess-fixture-1" },
        { "type": "agent:text", "content": "I've analyzed..." },
        { "type": "agent:complete", "result": "..." }
      ]
    }
  ]
}
```

### 6.3 Mock Query Implementation

```ts
function createMockQuery(options: { fixtures: FixtureSet }): typeof query {
  const callCounts = new Map<string, number>();

  return async function* mockQuery({ prompt, options }) {
    const nodeId = inferNodeIdFromPrompt(prompt);  // Or pass explicitly
    const fixture = options.fixtures[nodeId];
    const callIndex = callCounts.get(nodeId) ?? 0;
    callCounts.set(nodeId, callIndex + 1);

    const call = fixture.calls[callIndex];
    if (!call) {
      throw new Error(`No fixture for ${nodeId} call ${callIndex}`);
    }

    // Yield recorded events
    for (const event of call.events) {
      yield event;
    }

    // Yield final result
    yield { type: "result", subtype: "success", ...call.output };
  };
}
```

### 6.4 Recording Helper

A CLI helper to record fixtures from live runs:

```bash
# Record a workflow execution
bun run record-fixtures \
  --flow flows/my-workflow.json \
  --output tests/fixtures/recordings/my-workflow/

# This runs the flow with real SDK calls and saves all I/O
```

Implementation deferred to post-spec coding phase.

---

## 8. Implementation Checklist

### 7.1 Core Changes

- [ ] Add `agentSessions` field to `RunSnapshot` type
- [ ] Update `createInitialSnapshot()` to initialize empty `agentSessions`
- [ ] Update snapshot persistence to include `agentSessions`

### 7.2 Claude Node Changes

- [ ] Emit `agent:start` at beginning of execution
- [ ] Emit `agent:thinking` for thinking tokens (streaming)
- [ ] Emit `agent:text` for text output (streaming)
- [ ] Emit `agent:tool` for each tool call (with full I/O)
- [ ] Emit `agent:error` for recoverable errors
- [ ] Emit `agent:complete` with full metadata
- [ ] Save sessionId to `snapshot.agentSessions` on start
- [ ] Support resume with sessionId + prompt

### 7.3 Event System Changes

- [ ] Add `AgentEvent` union type to `events.ts`
- [ ] Update `RuntimeEvent` to include agent events
- [ ] Ensure events include `timestamp` field

### 7.4 Resume Changes

- [ ] Update `resume` command to accept optional `message`
- [ ] Default resume message to `"continue"`
- [ ] Handle `status="running"` nodes on resume

### 7.5 Testing Infrastructure

- [ ] Create `createMockQuery()` helper
- [ ] Define fixture JSON schema
- [ ] Create `record-fixtures` CLI helper (optional)
- [ ] Add example fixture for testing

---

## 9. Open Questions

None - all questions resolved in spec discussion.

---

## 10. Appendix: Event Type Definitions

```ts
// Full TypeScript definitions for agent events

export type AgentEvent =
  | AgentStartEvent
  | AgentThinkingEvent
  | AgentThinkingDeltaEvent
  | AgentTextEvent
  | AgentTextDeltaEvent
  | AgentToolEvent
  | AgentErrorEvent
  | AgentCompleteEvent;

export interface AgentStartEvent {
  type: "agent:start";
  nodeId: string;
  runId: string;
  timestamp: number;
  sessionId: string;
  model?: string;
  prompt: string | ClaudeMessageInput[];  // Full prompt or messages array
}

export interface AgentThinkingDeltaEvent {
  type: "agent:thinking:delta";
  nodeId: string;
  runId: string;
  timestamp: number;
  content: string;       // Streaming thinking chunk
  tokenCount?: number;
}

export interface AgentThinkingEvent {
  type: "agent:thinking";
  nodeId: string;
  runId: string;
  timestamp: number;
  content: string;       // Complete thinking block (non-streaming fallback)
  tokenCount?: number;
}

export interface AgentTextDeltaEvent {
  type: "agent:text:delta";
  nodeId: string;
  runId: string;
  timestamp: number;
  content: string;       // Streaming text chunk
}

export interface AgentTextEvent {
  type: "agent:text";
  nodeId: string;
  runId: string;
  timestamp: number;
  content: string;       // Complete text block (non-streaming fallback)
}

export interface AgentToolEvent {
  type: "agent:tool";
  nodeId: string;
  runId: string;
  timestamp: number;
  toolName: string;
  toolInput: unknown;
  toolOutput: unknown;
  durationMs?: number;
  error?: string;
}

export interface AgentErrorEvent {
  type: "agent:error";
  nodeId: string;
  runId: string;
  timestamp: number;
  errorType: string;    // SDK subtype: "error_tool_use", "error_max_turns", etc.
  message: string;      // Human-readable error message
  details?: unknown;    // Raw SDK error data for debugging
}

export interface AgentCompleteEvent {
  type: "agent:complete";
  nodeId: string;
  runId: string;
  timestamp: number;
  result: string;
  structuredOutput?: unknown;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationInputTokens?: number;
    cacheReadInputTokens?: number;
  };
  modelUsage?: Record<string, {
    inputTokens: number;
    outputTokens: number;
  }>;
  totalCostUsd?: number;
  durationMs: number;
  numTurns: number;
}
```

---

## 10. Approval

- [ ] **Spec Approved** - Ready for implementation

---

*End of Specification*
