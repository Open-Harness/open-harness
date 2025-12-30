# Minimal Kernel Design

## Goal

Define the **smallest possible** library that still expresses the OpenHarness idea:

- **Harness** orchestrates execution and owns the runtime session.
- **Agents** execute work and emit events.
- **Channels** adapt the experience (console/voice/web/db/etc.) and can also send commands back.
- **Unified Event Hub** ties everything together:
  - outbound **events** (harness → channels)
  - inbound **commands** (channels → harness)
  - **automatic context propagation** so events carry phase/task/agent metadata without plumbing

## Core decision: “Unified” means one hub

There should be **one canonical thing** that everything talks to:

- Agents emit events to it.
- Harness emits events to it.
- Channels subscribe to it for events.
- Channels call commands on it (`send`, `reply`, `abort`) to affect the session.

In code we call this the **`Transport`** (aka “hub”), but you can also name it `UnifiedEventBus` if you prefer.

## One canonical event envelope

Everything uses the same envelope:

```ts
type EnrichedEvent = {
  id: string;
  timestamp: Date;
  context: EventContext;
  event: BaseEvent;
}
```

No adapter shims. No “sometimes it’s `{ type }` and sometimes it’s `{ event: { type } }`”.

## Automatic context propagation (required)

We use **AsyncLocalStorage** to propagate `EventContext`:

- `hub.scoped({ phase: { name } }, async () => { ... })`
- Any `hub.emit(...)` inside inherits the context automatically.

This keeps harness logic readable and keeps channels powerful (they can render phase/task/agent context consistently).

## Minimal surface area

### Fundamental
- Events + context
- Hub (events out + commands in + scoped context)
- Harness (create/attach/run)
- Agent contract (`execute`)
- Channel contract (`defineChannel` → attachment)

### Explicitly optional (layered later)
- Providers (Anthropic, Gemini, OpenAI)
- Recording/replay, fixtures, “mode”
- DI and resolution
- Monologues / narratives (can be a channel or middleware)

## Invariants (non-negotiable)

1. **Single event envelope** end-to-end.
2. **All events flow through the hub** (agents/harness don’t “print” directly).
3. **Attachments are pure**: they attach to hub, subscribe, and optionally return cleanup.
4. **Context propagation is automatic** (no manual context threading).
5. **Commands are always available**, but may be no-ops unless session mode is enabled.

