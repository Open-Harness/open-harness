# Flow Engine MVP Spec (Deprecated)

This document has been consolidated into `docs/README.md`:

- `./README.md` (see “How Flow runs on the Kernel”)

This file is kept only to avoid breaking old references.

---

All details have moved to `docs/README.md`. This file intentionally contains no additional spec text.

- `timeoutMs` per node (enforced by engine)
- `retry` per node:
  - max attempts
  - simple backoff strategy

### 5) Kernel integration

- Runs inside `defineHarness({ state, run })`
- Uses `phase("Run DAG")` and `task("node:<id>")`
- Emits events for all node lifecycle via existing hub
- Supports `hub.sendToRun(runId, msg)` steering for streaming nodes

### 6) Transports / Channels

- **Console transport (MVP)**
  - prints events
  - can inject messages into active run
  - can abort
- **Realtime transport skeleton (MVP)**
  - interface + file placeholders only

---

## V1.1 (near-term upgrades)

- Switch / multi-branch control node
- Parallel scheduling (independent nodes)
- Join node (fan-in)
- Better binding language (still safe)
- Structured mapping (not only string templating)

---

## Later (explicitly not MVP)

- Persistence (workflow storage, run history)
- Pause/resume
- Replay / deterministic recording
- UI (React Flow)
- Multi-user permissions / tenancy
- Long-lived interactive nodes (voice realtime session as node)

---

## “Library vs User” responsibilities

### Library provides

- Engine + compiler + binding resolver
- Registry interfaces + base types
- Built-in control/utility nodes
- Reference provider nodes (Anthropic text/structured)
- Transport adapters: console + websocket skeleton

### User provides

- Domain nodes (their business logic)
- Provider presets (models/options)
- External tool servers (MCP or otherwise)
- Optional state reducers (later)

