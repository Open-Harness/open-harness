# Workflow Engine Architecture (DAG + YAML + TypeScript Registry)

This document specifies the **target architecture** for building a *workflow-as-data* engine (DAG) on top of the existing minimal kernel (`Hub` + `Harness` + `AgentDefinition` + `Channel`).

The goal is to support:

- **Single-user MVP** (CLI first, no UI required)
- **YAML workflow definitions** (portable, editor-friendly)
- **TypeScript registry** for node implementations (schemas, tools, providers)
- **Bidirectional transports** (console now, realtime later) via **channels**

---

## Glossary

- **Workflow Definition**: A versioned graph (nodes + edges + policies) loaded from YAML.
- **Node Type**: A TypeScript-defined node “kind” (schemas, runtime handler, capabilities).
- **Node Instance**: A node occurrence inside a specific workflow definition (`nodeId` + config).
- **Run**: One execution of a workflow definition.
- **Hub**: Canonical bidirectional event+command bus (kernel).
- **Channel / Transport Adapter**: An attachment that subscribes to hub events and can send hub commands.

---

## Architectural stance

### Separation of concerns (non-negotiable)

- **YAML is declarative wiring**: graph shape, control flow wiring, node configuration references.
- **TypeScript is semantic behavior**: node implementations, schemas, tool definitions, provider defaults.
- **Engine is deterministic orchestration**: scheduling, node lifecycle, retries/timeouts, event emission.
- **Transports are adapters**: console, WebSocket, voice realtime, etc.

### What “done” means for MVP

MVP is “you can run a YAML workflow from CLI, see streaming output/events, and inject messages into an in-flight node run”.

Persistence, UI, collaboration, replay, and multi-user are **explicitly deferred**.

---

## Major abstractions

### 1) WorkflowDefinition (data)

Represents the YAML file after parsing and validation.

Required fields for MVP:

- **workflow**: `{ name, version, input?, policy? }`
- **nodes**: list of node specs
- **edges**: explicit dependency edges (required; never inferred)
- **policies**: optional timeouts/retries/failure strategy

### 2) NodeSpec (data)

Represents a node instance in the workflow.

Required fields for MVP:

- `id: string`
- `type: string` (registry key)
- `input: object` (templated strings allowed)
- `when?: When` (conditional gating)
- `policy?: NodePolicy` (retry/timeout)
- `config?: object` (node-type-specific configuration)

### 3) NodeTypeDefinition (TypeScript)

What the registry holds.

- **Schemas**:
  - `inputSchema: ZodSchema`
  - `outputSchema: ZodSchema`
- **Handler**:
  - `run(ctx, input) -> output` (may stream events)
- **Capabilities**:
  - `isStreaming?: boolean`
  - `supportsInbox?: boolean`
  - `isLongLived?: boolean` (voice realtime, websocket sessions)
- **Provider dependencies**:
  - tools, MCP servers, default SDK options

### 4) NodeRegistry (TypeScript)

Maps `node.type` → `NodeTypeDefinition`.

Responsibilities:

- register node types (library + user)
- expose schemas for validation tooling
- build runtime handlers

### 5) BindingResolver (engine)

Resolves templated strings like `{{facts.capital}}`.

MVP scope:

- template interpolation into **strings**
- variable resolution from:
  - `workflow.input`
  - `outputs[nodeId]`

Later scope:

- structured mapping (JSONPath-like)
- type-aware coercion and defaults

### 6) WorkflowCompiler (engine)

Precomputes:

- node dependency graph
- topological order
- which nodes can run when

Also validates:

- missing node ids
- cycles (unless explicitly supported later)
- references to nonexistent outputs

### 7) WorkflowEngine (engine)

Runs the compiled workflow:

- applies `when` gates
- schedules nodes (sequential for MVP; parallel later)
- wraps each node run in kernel `task(...)` blocks
- stores node outputs

### 8) RunState / StateStore (engine)

MVP run state:

- `workflowInput`
- `outputs: Record<nodeId, unknown>`

Later:

- domain state reducers
- persistence / snapshots
- resumability / checkpoints

### 9) Kernel bridge (Harness)

The kernel harness remains the *host runtime*:

- it owns the `Hub` lifecycle
- it records events
- it provides run-scoped inboxes via `runId`

The DAG engine runs **inside** the harness `run()` function.

---

## How 11Labs fits (and why it’s mostly a Transport, not a Node)

### Two valid models

#### A) 11Labs as a **Transport (Channel Adapter)** — recommended for realtime voice

Voice realtime is an **interaction surface**:

- consumes hub events (`agent:text`, `session:prompt`, etc.)
- converts to audio output
- listens to user audio/text and sends hub commands (`sendToRun`, `reply`, etc.)

This matches your intuition: “the user speaks *to the workflow*”.

In this model, the workflow is still defined in YAML; 11Labs just becomes one of the ways to *drive* it.

#### B) 11Labs as a **Node** — valid for non-realtime “TTS step”

A node like `tts.speak` makes sense:

- input: `{ text, voice }`
- output: `{ audioUrl | audioBytes }`

But **realtime** websocket sessions are typically long-lived and interactive; they behave more like a transport than a discrete node step.

MVP recommendation:

- model realtime voice as a **transport**
- optionally add a **TTS node** later for offline synthesis steps

---

## UML / Diagrams

See:

- `docs/WORKFLOW-ENGINE-UML.md` for component/class/sequence diagrams
- `docs/WORKFLOW-YAML-SCHEMA.md` for the canonical YAML contract

---

## MVP scope vs Later scope

See:

- `docs/WORKFLOW-ENGINE-MVP.md`

