# Open Harness Hub & Events System: Complete Breakdown

## High-Level Overview

The **Hub** is the central event bus that coordinates all communication in Open Harness. Think of it as the nervous system of an AI workflow:

```
                    ┌─────────────────┐
                    │                 │
        Commands →  │     HUB        │  → Events (out)
       (users/UI)  │  (Event Bus)    │    (observers)
                    │                 │
                    └─────────────────┘
                           ↑
                    Flow Engine / Agents
```

---

## Core Concepts

### 1. Events vs Commands (Bidirectional Flow)

**Events** flow OUT from system to observers (informational):
- What happened
- Past tense
- Many listeners can observe
- Decoupled producer/consumer

**Commands** flow IN from users/UI to system (actionable):
- What to do
- Imperative
- Single handler responds
- Coupled sender/receiver

**Example Flow:**
```
User: "Analyze this document"           ← COMMAND (hub.send)
Agent: "I found 3 topics..."         ← EVENT (hub.emit)
Agent: "Which should I focus on?"     ← EVENT (hub.emit)
User: "Topic 2"                     ← COMMAND (hub.send)
Agent: "Analyzing topic 2..."        ← EVENT (hub.emit)
```

---

### 2. Event Structure

Every event has this structure:

```typescript
// Raw event you emit
hub.emit({
  type: "agent:text",
  content: "Hello, world!"
})

// What observers receive (enriched)
{
  id: "uuid-1234",                    // Unique event ID
  timestamp: Date("2024-01-02..."),   // When it happened
  context: {                           // Automatic context
    sessionId: "session-456",
    runId: "run-789",
    agentName: "assistant"
  },
  event: {                             // Your original payload
    type: "agent:text",
    content: "Hello, world!"
  }
}
```

**Key Points:**
- You emit raw events
- Subscribers receive enriched events
- Context is automatically attached via AsyncLocalStorage
- No manual context passing needed

---

### 3. Context Propagation (Automatic!)

The magic trick: **context flows automatically** through your async code.

```typescript
// Set context ONCE at start
hub.scoped({ agentName: "researcher" }, async () => {
  // Every emit in this scope automatically gets agentName
  hub.emit({ type: "agent:text", content: "Hello" });
  // → context.agentName = "researcher" (automatic!)
})

// No more tedious manual passing:
// hub.emit({ type: "agent:text", content: "Hello", agentName, runId, sessionId, ... })
```

**Context Fields:**
- `sessionId` - Overall workflow session
- `runId` - Specific execution run
- `agentName` - Which agent
- `taskId` - Current flow task
- `nodeId` - Current flow node

**Nesting Works:**
```typescript
hub.scoped({ sessionId: "sess-1" }, () => {
  // Context: { sessionId: "sess-1" }
  hub.scoped({ agentName: "assistant" }, () => {
    // Context: { sessionId: "sess-1", agentName: "assistant" }
  })
})
```

---

## Event Categories

### 1. Workflow Events (Harness/Phase/Task)

**Lifecycle Events:**
```typescript
{ type: "harness:start", name: "my-workflow" }
{ type: "harness:complete", success: true, durationMs: 1234 }

{ type: "phase:start", name: "Analysis" }
{ type: "phase:complete", name: "Analysis" }
{ type: "phase:failed", name: "Analysis", error: "..." }

{ type: "task:start", taskId: "fetch-data" }
{ type: "task:complete", taskId: "fetch-data", result: {...} }
{ type: "task:failed", taskId: "fetch-data", error: "..." }
```

**Typical Sequence:**
```
harness:start (name: "analyze-doc")
  phase:start (name: "Fetch")
    task:start (taskId: "fetch-url")
    task:complete (taskId: "fetch-url")
  phase:complete (name: "Fetch")
  phase:start (name: "Analyze")
    agent:start
    agent:text
    agent:complete
  phase:complete (name: "Analyze")
harness:complete (success: true)
```

### 2. Agent Events (AI Execution)

```typescript
// Agent starts
{ type: "agent:start", agentName: "researcher", runId: "run-123" }

// Thinking (reasoning chain)
{ type: "agent:thinking", content: "I need to search for..." }

// Text output
{ type: "agent:text", content: "Based on my research..." }

// Tool calls
{ type: "agent:tool:start", toolName: "web_search", input: {...} }
{ type: "agent:tool:complete", toolName: "web_search", result: {...} }

// Agent finishes
{ type: "agent:complete", agentName: "researcher", success: true, runId: "run-123" }
```

### 3. Session Events (Interactive)

```typescript
// Agent asks a question
{ type: "session:prompt", promptId: "p1", question: "Proceed?", choices: ["yes", "no"] }

// User responds (via UI/channel)
hub.reply("p1", { choice: "yes", content: "Yes, proceed" })

// User sends message
hub.send("Continue with analysis")

// Send to specific agent
hub.sendTo("researcher", "Focus on recent papers")

// Abort execution
hub.abort("User cancelled")
```

### 4. Node Events (Flow Execution)

```typescript
{ type: "node:start", nodeId: "step-1", nodeType: "claude.agent" }
{ type: "node:complete", nodeId: "step-1", output: {...}, durationMs: 1234 }
{ type: "node:error", nodeId: "step-1", error: "..." }
{ type: "node:skipped", nodeId: "step-1", reason: "when" }
```

---

## Hub API Usage

### Creating a Hub

```typescript
import { createHub } from "@open-harness/kernel";

const hub = createHub("my-session-id");
await hub.start();
```

### Emitting Events

```typescript
// Emit with automatic context
hub.emit({
  type: "agent:text",
  content: "Processing your request..."
})

// Override context (rarely needed)
hub.emit(
  { type: "agent:text", content: "..." },
  { agentName: "custom-agent" }
)
```

### Subscribing to Events

```typescript
// All events (wildcard)
hub.subscribe("*", (event) => {
  console.log(`[${event.event.type}]`, event)
})

// Specific event type
hub.subscribe("agent:text", (event) => {
  console.log("Agent said:", event.event.content)
})

// Event family (prefix pattern)
hub.subscribe("agent:*", (event) => {
  // Matches: agent:start, agent:text, agent:tool:start, etc.
})

// Multiple patterns
hub.subscribe(["agent:*", "task:*"], handler)

// Unsubscribe
const unsubscribe = hub.subscribe("agent:text", handler)
// Later...
unsubscribe()
```

### Commands (User Input)

```typescript
// Send to workflow
hub.send("User feedback: add more detail")

// Send to specific agent
hub.sendTo("researcher", "Focus on 2024 papers only")

// Reply to prompt
hub.reply("prompt-123", {
  choice: "detailed",
  content: "Use detailed format"
})

// Abort everything
hub.abort("User cancelled")
```

### Context Scoping

```typescript
// Set context for a scope
await hub.scoped({ agentName: "assistant" }, async () => {
  // All emits here get agentName automatically
  hub.emit({ type: "agent:text", content: "Hello" })
})

// Nested scopes merge
await hub.scoped({ sessionId: "sess-1" }, async () => {
  await hub.scoped({ runId: "run-1" }, async () => {
    await hub.scoped({ agentName: "assistant" }, async () => {
      // Context: { sessionId: "sess-1", runId: "run-1", agentName: "assistant" }
    })
  })
})
```

### Channels (Event Handlers)

Channels are plugins that subscribe to events and can emit back:

```typescript
const consoleChannel = {
  name: "console",
  state: () => ({ count: 0 }),

  onStart: async ({ state }) => {
    console.log(`Console channel started`)
  },

  on: {
    "agent:text": ({ event, state }) => {
      console.log(`Agent: ${event.event.content}`)
      state.count++
    },

    "session:prompt": async ({ event, emit }) => {
      // Prompt user, send reply back to workflow
      const answer = await promptUser(event.event.question)
      emit({
        type: "session:reply",
        promptId: event.event.promptId,
        content: answer
      })
    }
  }
}

hub.registerChannel(consoleChannel)
```

---

## How It Works Under the Hood

### 1. Event Emission Flow

```
You call:
  hub.emit({ type: "agent:text", content: "..." })

Hub does:
  1. Capture current context via AsyncLocalStorage
  2. Create enriched event:
     { id: uuid, timestamp, context, event }
  3. Iterate all listeners
  4. Match each listener's filter
  5. Call matching listeners with enriched event
  6. Isolate listener errors (don't break others)
```

### 2. AsyncLocalStorage Magic

```typescript
// In Hub implementation
private readonly _context = new AsyncLocalStorage<EventContext>()

scoped(context, fn) {
  const current = this.current()
  const merged = { ...current, ...context }
  return this._context.run(merged, fn)
}

current() {
  return this._context.getStore() ?? { sessionId: this.sessionId }
}
```

This makes context propagate through async/await chains **automatically**.

### 3. Filter Matching

```typescript
// "agent:*" matches:
//   agent:start
//   agent:text
//   agent:tool:start
//   agent:tool:complete
// etc.

matchesFilter("agent:text", "agent:*")  // true
matchesFilter("harness:start", "agent:*")  // false
matchesFilter("agent:text", ["agent:*", "harness:*"])  // true
```

---

## Real-World Usage Patterns

### Pattern 1: Console Logger

```typescript
hub.subscribe("*", (event) => {
  const { sessionId, agentName } = event.context
  console.log(`[${sessionId}] ${agentName}: ${event.event.type}`)
})
```

### Pattern 2: UI Streaming Display

```typescript
let output = ""

hub.subscribe("agent:text", (event) => {
  output += event.event.content
  updateUI(output)  // Stream updates to UI
})

hub.subscribe("agent:complete", (event) => {
  console.log("Final output:", output)
})
```

### Pattern 3: Tool Call Tracking

```typescript
const toolCalls = new Map()

hub.subscribe("agent:tool:start", (event) => {
  toolCalls.set(event.event.toolName, {
    start: Date.now(),
    input: event.event.input
  })
})

hub.subscribe("agent:tool:complete", (event) => {
  const call = toolCalls.get(event.event.toolName)
  const duration = Date.now() - call.start
  console.log(`${event.event.toolName} took ${duration}ms`)
})
```

### Pattern 4: Error Handling

```typescript
hub.subscribe("task:failed", (event) => {
  const { taskId, error } = event.event
  console.error(`Task "${taskId}" failed:`, error)
  if (event.event.stack) {
    console.error(event.event.stack)
  }
})

hub.subscribe("agent:complete", (event) => {
  if (!event.event.success) {
    console.warn(`Agent "${event.event.agentName}" failed`)
  }
})
```

---

## Key Takeaways

1. **Hub = Central Event Bus** - All communication flows through it
2. **Events OUT, Commands IN** - Bidirectional for interactive workflows
3. **Context is Automatic** - Use `hub.scoped()`, no manual passing
4. **Enriched Events** - IDs, timestamps, context attached automatically
5. **Channels = Event Handlers** - Subscribe to events, can emit commands back
6. **AsyncIterable** - Can `for await (const event of hub)` for streaming
7. **Listener Isolation** - One listener error won't break others

---

## File Locations (Codebase)

- **Protocol**: `/packages/kernel/src/protocol/events.ts` - Event type definitions
- **Protocol**: `/packages/kernel/src/protocol/hub.ts` - Hub interface
- **Implementation**: `/packages/kernel/src/engine/hub.ts` - Hub implementation
- **Implementation**: `/packages/kernel/src/engine/events.ts` - Event helpers
- **Docs**: `/apps/docs/content/docs/concepts/hub/*.mdx` - Concepts
- **Docs**: `/apps/docs/content/docs/reference/events/*.mdx` - Reference

---

## Further Reading

- [Event Bus Concepts](/docs/concepts/hub/event-bus)
- [Commands vs Events](/docs/concepts/hub/commands-vs-events)
- [Context Propagation](/docs/concepts/hub/context-propagation)
- [Hub API Reference](/docs/reference/api/hub)
- [Events Reference](/docs/reference/events)
