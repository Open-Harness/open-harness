# Quickstart: core-v2

**Date**: 2026-01-21 | **Spec**: [spec.md](./spec.md)

This guide demonstrates how to use `@core-v2` to build event-driven AI workflows with time-travel debugging.

---

## Installation

```bash
bun add @open-harness/core-v2
```

---

## Basic Example: Chat Workflow

```typescript
import {
  createWorkflow,
  defineEvent,
  defineHandler,
  agent,
} from "@open-harness/core-v2";
import { z } from "zod";

// 1. Define your state
interface ChatState {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  turnCount: number;
}

// 2. Define events
const UserInput = defineEvent("user:input", {
  text: String,
});

const ResponseComplete = defineEvent("response:complete", {
  content: String,
});

// 3. Define handlers (pure functions!)
const handleUserInput = defineHandler(UserInput, (event, state: ChatState) => ({
  state: {
    ...state,
    messages: [...state.messages, { role: "user", content: event.payload.text }],
    turnCount: state.turnCount + 1,
  },
  events: [], // No new events from this handler
}));

const handleResponse = defineHandler(ResponseComplete, (event, state: ChatState) => ({
  state: {
    ...state,
    messages: [...state.messages, { role: "assistant", content: event.payload.content }],
  },
  events: [],
}));

// 4. Define structured output schema (REQUIRED for all agents)
const ChatOutput = z.object({
  response: z.string(),
});

// 5. Define an agent with REQUIRED outputSchema and onOutput
const chatAgent = agent({
  name: "chat",
  activatesOn: ["user:input"],
  emits: ["agent:started", "text:delta", "response:complete", "agent:completed"],

  // REQUIRED: Every agent must define structured output
  outputSchema: ChatOutput,

  // REQUIRED: Transform LLM output to events
  onOutput: (output, event) => [{
    id: crypto.randomUUID(),
    name: "response:complete",
    payload: { content: output.response },
    timestamp: new Date(),
    causedBy: event.id,
  }],

  prompt: (state, event) => `
    You are a helpful assistant. Respond to: ${event.payload.text}

    Previous conversation:
    ${state.messages.map((m) => `${m.role}: ${m.content}`).join("\n")}
  `,
});

// 5. Create the workflow
const workflow = createWorkflow({
  name: "chat",
  initialState: { messages: [], turnCount: 0 },
  handlers: [handleUserInput, handleResponse],
  agents: [chatAgent],
  until: (state) => state.turnCount >= 10, // Stop after 10 turns
});

// 6. Run it!
const result = await workflow.run({
  input: "Hello! What's the weather like?",
  record: true, // Enable recording for time-travel
});

console.log("Final state:", result.state);
console.log("Session ID:", result.sessionId);

// Cleanup
await workflow.dispose();
```

---

## Time-Travel Debugging

The killer feature: step backward through execution history.

```typescript
// Load a recorded session
const tape = await workflow.load(sessionId);

// Inspect current position
console.log(`Position: ${tape.position} / ${tape.length}`);
console.log("Current event:", tape.current);
console.log("Current state:", tape.state);

// Step forward
const t1 = tape.step();
console.log("After step:", t1.position);

// THE KEY FEATURE: Step backward!
const t2 = t1.stepBack();
console.log("After stepBack:", t2.position);
console.log("Historical state:", t2.state);

// Jump to any position
const t3 = tape.stepTo(5);
console.log("State at position 5:", t3.state);

// Rewind to beginning
const t4 = tape.rewind();
console.log("Back to start:", t4.position); // 0

// Play through all events
const final = await tape.play();
console.log("Final position:", final.position);
```

---

## Recording and Replay

Record sessions for debugging and testing.

```typescript
import { createSqliteStore } from "@open-harness/core-v2";

// Create a persistent store
const store = createSqliteStore({ path: "./sessions.db" });

// Create workflow with store
const workflow = createWorkflow({
  name: "chat",
  initialState: { messages: [], turnCount: 0 },
  handlers: [handleUserInput],
  agents: [chatAgent],
  until: (state) => state.turnCount >= 10,
  store, // Attach the store
});

// Record a session
const result = await workflow.run({
  input: "Tell me a joke",
  record: true,
});

console.log("Recorded session:", result.sessionId);

// Later: Replay without API calls
const tape = await workflow.load(result.sessionId);
await tape.play(); // Events come from recording, no LLM calls!

// List all sessions
const sessions = await store.sessions();
for (const session of sessions) {
  console.log(`${session.id}: ${session.eventCount} events`);
}
```

---

## Custom Renderers

Transform events into custom output.

```typescript
import { createRenderer } from "@open-harness/core-v2";

// Terminal renderer for CLI output
const terminalRenderer = createRenderer({
  name: "terminal",
  renderers: {
    "text:delta": (event, state) => {
      process.stdout.write(event.payload.delta);
    },
    "agent:started": (event, state) => {
      console.log(`\n[${event.payload.agentName}] Starting...`);
    },
    "error:*": (event, state) => {
      console.error(`ERROR: ${event.payload.message}`);
    },
  },
});

// Use the renderer
await workflow.run({
  input: "Hello!",
  renderers: [terminalRenderer],
});
```

---

## React Integration

Use the `useWorkflow` hook for React apps.

```tsx
import { useWorkflow, WorkflowProvider } from "@open-harness/core-v2/react";

function Chat() {
  const {
    // AI SDK compatible
    messages,
    input,
    setInput,
    handleSubmit,
    isLoading,
    error,
    // Open Harness unique
    events,
    state,
    tape,
  } = useWorkflow(workflow);

  return (
    <div>
      {/* Messages */}
      {messages.map((m) => (
        <div key={m.id} className={m.role}>
          {m.name && <span className="agent">[{m.name}]</span>}
          {m.content}
        </div>
      ))}

      {/* Input form */}
      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? "Thinking..." : "Send"}
        </button>
      </form>

      {/* Error display */}
      {error && <div className="error">{error.message}</div>}

      {/* Time-travel controls */}
      <div className="tape-controls">
        <button onClick={tape.rewind}>⏮ Rewind</button>
        <button onClick={tape.stepBack}>◀ Back</button>
        <span>
          {tape.position} / {tape.length}
        </span>
        <button onClick={tape.step}>▶ Forward</button>
        <button onClick={() => tape.play()}>⏵ Play</button>
      </div>
    </div>
  );
}

// Wrap your app
function App() {
  return (
    <WorkflowProvider workflow={workflow}>
      <Chat />
    </WorkflowProvider>
  );
}
```

---

## Structured Output (Critical)

**Every agent MUST define `outputSchema` and `onOutput`**. This is non-negotiable for reliable workflow state.

The SDK enforces structured responses via `outputFormat: { type: "json_schema", schema }`.

```typescript
import { agent, defineEvent } from "@open-harness/core-v2";
import { z } from "zod";

// Define structured output schema using Zod
const ResearchOutput = z.object({
  findings: z.array(z.string()),
  confidence: z.number(),
  sources: z.array(z.string()),
});

// Create event for research results
const ResearchCompleted = defineEvent("research:completed", {
  findings: Array,
  confidence: Number,
  sources: Array,
});

// REQUIRED: Every agent must have outputSchema and onOutput
const researchAgent = agent({
  name: "researcher",
  activatesOn: ["task:research"],
  emits: ["agent:started", "text:delta", "research:completed", "agent:completed"],

  prompt: (state, event) => `
    Research the topic: ${event.payload.topic}

    Respond with structured findings including confidence level and sources.
  `,

  // REQUIRED: Define what the LLM must output
  outputSchema: ResearchOutput,

  // REQUIRED: Transform structured output to events
  onOutput: (output, event) => [
    {
      id: crypto.randomUUID(),
      name: "research:completed",
      payload: output,
      timestamp: new Date(),
      causedBy: event.id,
    },
  ],
});
```

---

## Server Integration

Run workflows on the server with HTTP endpoints.

```typescript
// server.ts
import { createWorkflowHandler } from "@open-harness/core-v2";

const handler = createWorkflowHandler({
  workflow,
  cors: { origin: "http://localhost:3000" },
});

// With Hono
import { Hono } from "hono";

const app = new Hono();
app.post("/api/workflow", (c) => handler.handle(c.req.raw));

export default app;
```

```tsx
// client.tsx
import { useWorkflow } from "@open-harness/core-v2/react";

function Chat() {
  const { messages, input, setInput, handleSubmit } = useWorkflow(workflow, {
    api: "/api/workflow", // Connect to server
  });

  // ... same UI code as before
}
```

---

## Testing with Fixtures

Use recorded sessions for deterministic tests.

```typescript
import { describe, it, expect } from "@effect/vitest";
import { createMemoryStore } from "@open-harness/core-v2";

describe("Chat Workflow", () => {
  it("should accumulate messages", async () => {
    const store = createMemoryStore();

    const workflow = createWorkflow({
      name: "test-chat",
      initialState: { messages: [], turnCount: 0 },
      handlers: [handleUserInput],
      agents: [chatAgent],
      until: (state) => state.turnCount >= 1,
      store,
    });

    const result = await workflow.run({
      input: "Hello!",
      record: true,
    });

    expect(result.state.messages).toHaveLength(2); // user + assistant
    expect(result.state.messages[0].role).toBe("user");
    expect(result.state.messages[0].content).toBe("Hello!");

    await workflow.dispose();
  });

  it("should replay deterministically", async () => {
    // Load a recorded fixture
    const tape = await workflow.load("fixture-session-123");

    // Replay and verify state at each position
    for (let i = 0; i < tape.length; i++) {
      const t = tape.stepTo(i);
      expect(t.state).toMatchSnapshot(`state-at-${i}`);
    }
  });

  it("should step backward correctly", async () => {
    const tape = await workflow.load("fixture-session-123");

    // Go to position 5
    const t1 = tape.stepTo(5);
    const stateAt5 = t1.state;

    // Step forward then back
    const t2 = t1.step(); // position 6
    const t3 = t2.stepBack(); // back to 5

    // State should be identical
    expect(t3.state).toEqual(stateAt5);
  });
});
```

---

## Event Causality Tracking

Track which events caused which.

```typescript
// Events include `causedBy` field
const event = {
  id: "evt-123",
  name: "text:delta",
  payload: { delta: "Hello" },
  timestamp: new Date(),
  causedBy: "evt-100", // This event was caused by evt-100
};

// Build a causality graph
function buildCausalityGraph(events: AnyEvent[]): Map<string, string[]> {
  const graph = new Map<string, string[]>();

  for (const event of events) {
    if (event.causedBy) {
      const children = graph.get(event.causedBy) ?? [];
      children.push(event.id);
      graph.set(event.causedBy, children);
    }
  }

  return graph;
}

// Trace an event's lineage
function getEventLineage(events: AnyEvent[], eventId: string): AnyEvent[] {
  const eventMap = new Map(events.map((e) => [e.id, e]));
  const lineage: AnyEvent[] = [];

  let current = eventMap.get(eventId);
  while (current) {
    lineage.unshift(current);
    current = current.causedBy ? eventMap.get(current.causedBy) : undefined;
  }

  return lineage;
}
```

---

## Next Steps

- Read the [Data Model](./data-model.md) for entity details
- Check the [API Contracts](./contracts/) for TypeScript interfaces
- See [Research](./research.md) for Effect patterns used internally
- Review the [Feature Spec](./spec.md) for complete requirements

---

## Key Points

1. **Structured output is MANDATORY**: Every agent MUST have `outputSchema` (using Zod) and `onOutput`
2. **Handlers are pure**: `(event, state) → { state, events[] }` - no side effects
3. **Events are immutable**: Once created, never modified
4. **State is derived**: Computed by replaying handlers, not stored
5. **Time-travel is built-in**: `tape.stepBack()` is the killer feature
6. **Effect is hidden**: You work with Promises, not Effect types
7. **React-ready**: `useWorkflow` hook with AI SDK-compatible API
