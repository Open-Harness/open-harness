# Quickstart: Flow Pause/Resume

**Feature Branch**: `016-pause-resume`
**Date**: 2026-01-02

This guide shows how to use the pause/resume feature in common scenarios.

## Basic Pause/Resume

### Pausing a Flow

```typescript
import { createHub, executeFlow, parseFlowYaml, NodeRegistry, claudeNode } from "@open-harness/kernel";

const hub = createHub("my-session");

// Register observer to capture session ID
let pausedSessionId: string | null = null;
hub.registerChannel({
  name: "pause-handler",
  on: {
    "flow:paused": ({ event }) => {
      pausedSessionId = event.sessionId;
      console.log(`Flow paused at node: ${event.nodeId}`);
    },
  },
});

// Start execution
const registry = new NodeRegistry();
registry.register(claudeNode);

const flow = parseFlowYaml(`
flow:
  name: "Interactive Flow"
nodes:
  - id: agent
    type: claude.agent
    input:
      prompt: "Analyze the user's request"
edges: []
`);

await hub.start();

// Execute in background (so we can pause it)
const execution = executeFlow(flow, registry, hub);

// Pause after some condition (e.g., external trigger, timeout)
setTimeout(() => {
  hub.abort({ resumable: true, reason: "Waiting for user input" });
}, 5000);

await execution; // Will resolve when paused
```

### Resuming a Paused Flow

```typescript
// Later, when ready to continue...

// Resume with the user's input (message is required - SDK needs user input to continue)
hub.resume(pausedSessionId, "Here's my additional input");

// Or use a continuation prompt if no specific input needed
hub.resume(pausedSessionId, "Please continue");

// Execution continues from where it left off, with the message in context
```

---

## Human-in-the-Loop Pattern

The primary use case: pause agent execution to get user input.

```typescript
import { createHub, executeFlow } from "@open-harness/kernel";

interface TUIController {
  onPause: (sessionId: string, nodeId: string) => void;
  getUserInput: () => Promise<string>;
}

function createInteractiveHub(tui: TUIController) {
  const hub = createHub();

  hub.registerChannel({
    name: "tui-integration",
    on: {
      "flow:paused": async ({ event }) => {
        // Notify TUI that we're paused
        tui.onPause(event.sessionId, event.nodeId);
      },
      "agent:thinking": ({ event }) => {
        // Show thinking indicator
        console.log("Agent is thinking...");
      },
    },
  });

  return {
    hub,
    async runWithInteraction(flow: FlowYaml, registry: NodeRegistry) {
      await hub.start();

      while (true) {
        const result = await executeFlow(flow, registry, hub);

        if (hub.status === "paused") {
          // Get user input via TUI
          const userInput = await tui.getUserInput();

          // Resume with the input
          hub.resume(hub.current().sessionId, userInput);
          continue;
        }

        // Flow completed
        return result;
      }
    },
  };
}
```

---

## Observing Pause/Resume Events

Subscribe to events via channels (not direct subscribe).

```typescript
hub.registerChannel({
  name: "pause-observer",
  on: {
    // Individual events
    "flow:paused": ({ event }) => {
      console.log(`Paused: session=${event.sessionId}, node=${event.nodeId}`);
    },
    "flow:resumed": ({ event }) => {
      console.log(`Resumed: session=${event.sessionId}, injected=${event.injectedMessages} messages`);
    },

    // All pause/resume events
    "flow:*": ({ event }) => {
      // Handle both paused and resumed
    },
  },
});
```

---

## Querying Paused Session State

Inspect a paused session for debugging:

```typescript
const state = hub.getPausedSession(sessionId);

if (state) {
  console.log({
    currentNode: state.currentNodeId,
    completedNodes: Object.keys(state.outputs).length,
    pendingMessages: state.pendingMessages.length,
    pausedAt: state.pausedAt,
    reason: state.pauseReason,
  });
}
```

---

## Providing Context on Resume

The message parameter is required - the SDK needs user input to continue the conversation:

```typescript
// Flow is paused...

// Option 1: Provide the user's actual response
hub.resume(sessionId, "The file is located at /var/log/app.log");

// Option 2: If you just want to continue without specific input
hub.resume(sessionId, "Please continue");

// Option 3: Combine multiple pieces of context in one message
hub.resume(sessionId, `Here's what you asked for:
- Database connection string: postgres://...
- API key: sk-...
Please proceed with the analysis.`);
```

---

## Converting Pause to Abort

If you decide not to resume:

```typescript
// Flow is paused...

// User cancels instead of providing input
hub.abort(); // Terminal abort, discards session state

// Or with reason
hub.abort("User cancelled");
```

---

## Error Handling

```typescript
import { SessionNotFoundError, SessionAlreadyRunningError } from "@open-harness/kernel";

try {
  hub.resume("invalid-session-id");
} catch (error) {
  if (error instanceof SessionNotFoundError) {
    console.log(`No paused session found: ${error.sessionId}`);
  }
}

try {
  // Resume already running
  hub.resume(activeSessionId);
} catch (error) {
  if (error instanceof SessionAlreadyRunningError) {
    console.log(`Session ${error.sessionId} is already running`);
  }
}
```

---

## Abort Signal for Cooperative Cancellation

If implementing custom nodes that support pause:

```typescript
const myCustomNode: NodeTypeDefinition = {
  type: "custom.longrunning",
  run: async (ctx, input) => {
    const signal = ctx.hub.getAbortSignal();

    for (const item of input.items) {
      // Check for pause/abort between iterations
      if (signal.aborted) {
        throw new Error("Execution paused or aborted");
      }

      await processItem(item);
    }

    return { processed: input.items.length };
  },
};
```

---

## Testing Pause/Resume

```typescript
import { describe, test, expect } from "bun:test";
import { createHub, executeFlow } from "@open-harness/kernel";

describe("pause/resume", () => {
  test("pauses and resumes with injected message", async () => {
    const hub = createHub();
    const events: string[] = [];

    hub.registerChannel({
      name: "test-observer",
      on: {
        "flow:paused": () => events.push("paused"),
        "flow:resumed": () => events.push("resumed"),
        "node:complete": () => events.push("complete"),
      },
    });

    await hub.start();

    // Start execution
    const execution = executeFlow(flow, registry, hub);

    // Pause after short delay
    await delay(100);
    hub.abort({ resumable: true });

    await execution; // Resolves when paused

    expect(events).toContain("paused");
    expect(hub.status).toBe("paused");

    // Resume with message
    hub.resume(hub.current().sessionId, "test input");

    // Wait for completion
    await waitForStatus(hub, "complete");

    expect(events).toContain("resumed");
    expect(events).toContain("complete");
  });
});
```

---

## Integration with TUI Frameworks

Example with a hypothetical TUI client:

```typescript
// tui-client.ts
import { WebSocket } from "ws";

class TUIClient {
  private ws: WebSocket;
  private pausedSessionId: string | null = null;

  constructor(hubUrl: string) {
    this.ws = new WebSocket(hubUrl);

    this.ws.on("message", (data) => {
      const event = JSON.parse(data.toString());

      if (event.type === "flow:paused") {
        this.pausedSessionId = event.sessionId;
        this.showInputPrompt();
      }
    });
  }

  private showInputPrompt() {
    // TUI prompts user for input
    const input = await this.promptUser("Enter your response:");

    // Send resume command
    this.ws.send(JSON.stringify({
      type: "command:resume",
      sessionId: this.pausedSessionId,
      message: input,
    }));
  }
}
```

---

## Best Practices

1. **Always capture session ID** from `flow:paused` event - you'll need it to resume
2. **Use channels, not subscribe** for event observation (automatic cleanup)
3. **Check hub.status** to determine if flow is paused vs completed
4. **Handle SessionNotFoundError** when resuming - session may have been aborted
5. **Inject messages before resuming** if you need multiple inputs
6. **Use cooperative cancellation** in custom nodes for graceful pause
