# Minimal Public API Shape (Kernel)

The kernel is intentionally small and centers around **one “Hub” object** that is both:

- an **event stream** (subscribe)
- a **command surface** (send/reply/abort)

## Harness API

User-facing ergonomics stay the same:

- `defineHarness({...})` returns a factory
- `.create(input)` returns an instance
- `.attach(channel)` attaches a bidirectional channel/transport
- `.run()` executes and returns `{ result, state, events, durationMs }`

## ExecuteContext (inside run)

The kernel context is:

- `agents`: your agent map (each agent call emits agent:* events)
- `state`: mutable state (owned by the harness instance)
- `phase(name, fn)`: structured grouping (emits phase:* events)
- `task(id, fn)`: structured work unit (emits task:* events)
- `emit(type, data)`: escape hatch for custom events
- `session`: minimal interactive surface
  - `waitForUser(prompt, { choices? })` → emits `session:prompt`, awaits `hub.reply()`
  - `readMessages()` / `hasMessages()` → consumes messages injected via `hub.send()`
- `hub`: the raw Hub (for advanced usage)

## Channel API

Channels are just attachments:

- `type Attachment = (hub: Hub) => Cleanup`

Channels can:

- observe: `hub.subscribe(filter, listener)`
- command: `hub.send(...)`, `hub.reply(...)`, `hub.abort(...)`

`defineChannel()` is optional sugar to write channels declaratively.

