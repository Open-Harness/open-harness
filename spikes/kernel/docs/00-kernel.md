# Minimal Kernel: What “Unification” Means

Back: [[DOCS-INDEX]]

This spike intentionally collapses the system into **four primitives**:

- **Harness**: orchestration + state + structured control flow
- **Agent**: executable unit that can emit events and return a typed result
- **Channel**: bidirectional interface adapter (observes events, can send commands back)
- **Unified Bus (Hub)**: the *one shared object* that ties everything together

## The core idea

The Harness coordinates everything, but *does not own UIs* and *does not own providers*.

Instead:

- The Harness emits canonical events (phase/task lifecycle, plus any custom events)
- Agents emit canonical events (agent lifecycle, tool calls, thinking, etc.)
- Channels subscribe to those events to render / persist / stream
- Channels can also send commands back into the running Harness (user input, abort, replies)
- Channels can also send **messages into running agents** (Anthropic-style streaming input):
  - Prefer run-scoped injection: `hub.sendToRun(runId, message)`
  - Convenience: `hub.sendTo(agentName, message)` works only when exactly one run of that agent is active

## What makes the bus “unified”

“Unified” here means **one bidirectional contract**:

- **Out (events)**: `subscribe(filter, listener)` receives `EnrichedEvent`s
- **In (commands)**: `send()`, `sendTo()`, `reply()`, `abort()` send signals back into the harness/session

Internally, implementations may:

- Treat commands as *methods*, for ergonomics
- Also record them as *events*, for observability (recommended)

## Explicit non-goals for the kernel

We explicitly remove everything that tends to “infect” the architecture:

- Provider integrations, recording/replay, DI, monologue generation, scheduling

All of those can exist later as **plugins** built on top of the kernel contracts.

