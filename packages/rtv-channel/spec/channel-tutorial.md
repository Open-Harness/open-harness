# Building a Channel (Tutorial)

This tutorial explains how to build a channel that attaches to the Hub, maintains its own state, and exposes a minimal tool surface for connectors.

## What a Channel Is

A channel is a **bidirectional attachment**:

- **Observes events** from the Hub
- **Maintains state** derived from those events
- **Emits commands** back to the Hub

Channels do **not** run flow logic; they are interfaces to a running flow.

## Minimal State Strategy

Use a **curated view** instead of a raw event firehose:

- **Pinned facts**: current phase, active agent, task list
- **Recent window**: last N interesting events
- **Summary**: rolling abstract when the window overflows

```ts
type ChannelState = {
  run: { id: string | null; phase: string | null };
  activeAgent?: { name: string; role?: string };
  tasks: Array<{ id: string; label: string; state: "pending"|"running"|"done" }>;
  recent: Array<{ ts: string; type: string; text?: string }>;
  summary?: string;
};
```

## Tool Surface (Derived, Not Invented)

Channels should only expose tools that map to **existing Hub commands**:

```ts
type ChannelTools = {
  send: (text: string) => void;
  sendTo: (agent: string, text: string) => void;
  sendToRun: (runId: string, text: string) => void;
  reply: (promptId: string, content: string, choice?: string) => void;
  abort: (reason?: string) => void;
  getState: () => ChannelState;
};
```

## Example: A Simple Channel

```ts
import type { Attachment } from "../channel/types";

export function createExampleChannel(): Attachment {
  return (hub) => {
    const state: ChannelState = {
      run: { id: null, phase: null },
      tasks: [],
      recent: [],
    };

    const reduce = (evt) => {
      switch (evt.event.type) {
        case "phase:start":
          state.run.phase = evt.event.name;
          break;
        case "task:start":
          state.tasks.push({ id: evt.event.taskId, label: evt.event.taskId, state: "running" });
          break;
        case "agent:text":
          state.recent.push({ ts: evt.timestamp.toISOString(), type: "agent:text", text: evt.event.content });
          break;
      }
      if (state.recent.length > 50) {
        state.summary = "…summarize older items…";
        state.recent = state.recent.slice(-25);
      }
    };

    const unsubscribe = hub.subscribe(["phase:*", "task:*", "agent:*"], (evt) => {
      reduce(evt);
    });

    return () => unsubscribe();
  };
}
```

## Voice Channel Specifics (MVP)

The voice UI is **push-to-talk only**. VAD is supported in the transport layer but not exposed by the channel.

To build a new connector:

1. Attach your channel to the Hub
2. Subscribe to `voice:*` events
3. Emit `voice:*` commands (`voice:input:start`, `voice:input:audio`, `voice:input:commit`, etc.)

---

If you build a custom channel, keep it:
1. **Small** (reducer + subscriptions + commands)
2. **Deterministic** (push-to-talk or explicit commands)
3. **Documented** (event types + tool surface)
