# Kernel Tutorial

Progressive tutorial for learning Kernel + Flow with a flow‑first path.

## Quick Start

Run a YAML flow:
```bash
bun run flow-run --file lessons/01-flow-hello/flow.yaml
```

## Lessons

1. **Flow Hello** — YAML + CLI runner
2. **Flow Edges** — Explicit dependencies
3. **Flow Inputs** — Defaults + overrides
4. **Flow Bindings** — Data flow between nodes
5. **Flow When + Policy** — Conditional execution + policy declarations
7. **Node Packs** — YAML packs + allowlist
8. **Custom Node** — TypeScript node + pack
10. **Harness Hello** — Basic harness + agent
11. **Phases + Tasks** — Structured execution
12. **Channels** — Attachments + subscriptions
13. **Inbox + sendToRun** — Run‑scoped messaging
14. **Bridge** — Flow inside harness runtime

## Known limitation

Claude‑backed lessons are removed until the Claude SDK can accept an async
message stream sourced from the agent inbox without invoking unstable V2 APIs.
That limitation prevents true multi‑turn flow examples from running reliably.

## Architecture

- **Harness** is the runtime wrapper (state/lifecycle/phase/task + a Hub)
- **Flow** is a library layer executed *inside* a harness, using `hub/phase/task`
- **Channel** is how you observe and interact: attach it to the harness and subscribe with filters
