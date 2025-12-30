# Unified Bus Options (Bidirectional)

You asked for “unified” to mean **two-way** and to “tie all the things together.”
Below are three viable shapes for the kernel.

## Option A (recommended): One Hub object (events + commands)

- **Everyone gets the same object**: agents, harness helpers, channels.
- The hub supports:
  - `emit()` + `subscribe()` for events
  - `send()` / `reply()` / `abort()` for commands
  - `scoped()` for context propagation

Why it’s good:
- Smallest surface area
- No adapter glue
- Easy to reason about “what connects to what”

Tradeoff:
- The hub becomes *the* central interface, so you must keep it clean.

## Option B: Split (EventBus) + (Transport/EventHub)

- **EventBus**: `emit/subscribe/scoped` (internal “spine” for events)
- **Transport/EventHub**: `subscribe + commands + status` (what channels attach to)

Why it’s good:
- Clear separation between “event backbone” and “interactive session surface”

Tradeoff:
- Two objects creates drift risk unless contracts are extremely strict

## Option C: Everything is an event (commands are events)

- One method: `publish(message)` / `subscribe(filter, handler)`
- Commands are events like `command:send`, `command:abort`, `command:reply`
- Harness consumes command-events and updates its internal state/queues

Why it’s good:
- Maximum uniformity
- Great for distributed systems later (replayable logs, remote UI)

Tradeoff:
- More ceremony for simple channel authors (they want `hub.reply(...)`, not an event schema)

## Recommendation for the spike

Use **Option A** in the minimal spike.

You can still *internally* model commands as events for tracing, while exposing
simple methods as the author-friendly API.

