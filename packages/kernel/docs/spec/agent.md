# Agent Protocol

Agents are executable units that emit events and return results.

## AgentDefinition contract

```typescript
interface AgentDefinition<TIn = unknown, TOut = unknown> {
  name: string;
  emitsStartComplete?: boolean;
  execute(input: TIn, ctx: AgentExecuteContext): Promise<TOut>;
}
```

### `emitsStartComplete`

If `true`, the agent implementation is responsible for emitting:
- `agent:start` (with `runId`)
- `agent:complete` (with `runId`)

This is useful for provider adapters (e.g., streaming SDKs) that want tighter control over run lifecycle events.

If `false` or omitted, the runtime emits these events automatically.

## Execute context

```typescript
interface AgentExecuteContext {
  hub: Hub;
  runId: string;
}
```

### `hub`

The hub for emitting events and subscribing to messages. Agents should:
- Emit `agent:*` events via `hub.emit(...)`
- Subscribe to `session:message` events for multi-turn

### `runId`

Unique ID for this particular agent execution. Used for:
- Emitting agent events with proper context
- Subscribing to `session:message` events targeted at this run

**Important**: When multiple runs of the same agent can be active concurrently, channels should:
1. Listen for `agent:start` events to get the `runId`
2. Call `hub.sendToRun(runId, message)` (not `hub.sendTo(agentName, message)`)

## Multi-turn pattern (V2 SDK)

Multi-turn agents use the V2 SDK session-based send/receive pattern:

```typescript
import { Claude } from "@anthropic-ai/claude-agent-sdk";

async function execute(input: AgentInput, ctx: AgentExecuteContext): Promise<AgentOutput> {
  const client = new Claude({ model: input.model });

  // Create session with maxTurns: 1 for single turn
  const session = client.session({ maxTurns: 1 });

  try {
    // Send initial prompt
    for await (const event of session.send(input.prompt)) {
      if (event.type === "text") {
        ctx.hub.emit({ type: "agent:text", content: event.text, runId: ctx.runId });
      }
    }

    // For multi-turn, subscribe to injected messages
    const unsub = ctx.hub.subscribe("session:message", async (hubEvent) => {
      if (hubEvent.event.runId === ctx.runId) {
        for await (const event of session.send(hubEvent.event.content)) {
          if (event.type === "text") {
            ctx.hub.emit({ type: "agent:text", content: event.text, runId: ctx.runId });
          }
        }
      }
    });

    // Wait for completion signal
    await waitForDone();
    unsub();

    return result;
  } finally {
    // Session cleanup handled by SDK
  }
}
```

### Key patterns

- **session.send()**: Send a user message, returns async iterable of responses
- **hub.subscribe()**: Listen for injected messages by runId
- **maxTurns: 1**: For single-turn interactions (most common)

## Message injection

External code (channels, tests) injects messages via Hub:

```typescript
hub.sendToRun(runId, "user message");
```

This emits a `session:message` event. The agent's subscription receives it.

## ExecutableAgent (runtime view)

At runtime, workflow code sees:

```typescript
interface ExecutableAgent<TIn = unknown, TOut = unknown> {
  name: string;
  execute(input: TIn): Promise<TOut>;
}
```

The runtime wraps `AgentDefinition` to provide this simpler interface (no context args).

## Key invariants

1. **Agents emit events via hub** - they don't "print directly"
2. **Messages arrive via hub events** - agents subscribe to `session:message` filtered by `runId`
3. **runId is the routing key** - for run-scoped message injection
4. **Sessions are V2 SDK sessions** - with send/receive pattern
