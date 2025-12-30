# Minimal Kernel: What “Unification” Means (Deprecated)

This document has been consolidated into `docs/README.md`:

- `./README.md` (see “Canonical naming” + “Kernel” sections)

This file is kept only to avoid breaking old references.

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

