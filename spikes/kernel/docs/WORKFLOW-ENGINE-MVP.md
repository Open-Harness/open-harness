# Workflow Engine MVP Spec (What to build now vs later)

This document is the **scope contract** for the YAML DAG MVP.

---

## MVP (must include)

### 1) Workflow definition format (YAML)

- **`workflow.version`** (versioned workflow)
- **`workflow.input`** (workflow inputs / defaults)
- **Nodes**
  - `id`, `type`, `input`, optional `when`, optional `policy`, optional `config`
- **Edges**
  - **required** explicit edge list (B1)

Canonical spec:

- [[WORKFLOW-YAML-SCHEMA]]

### 2) Node registry (TypeScript)

- `registerNodeType(def)`
- `def.inputSchema` + `def.outputSchema` (Zod)
- `def.run(ctx, input)` execution
- `def.capabilities` (at minimum: `supportsInbox`, `isStreaming`, `isLongLived`)

### 3) Engine execution semantics

- **Deterministic node completion**
  - “task-like nodes” must end (even if underlying provider session is open)
  - “long-lived nodes” explicitly opt in and are not part of MVP
- **Sequential scheduling** (topological)
- **If/else via `when`**
- **Basic failure strategy**
  - workflow-level: `failFast: true` default
  - node-level: `continueOnError?: boolean`

### 4) Policies

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

