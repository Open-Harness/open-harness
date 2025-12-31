# Docs Impact: Flow-Only Architecture

This document captures the documentation format, the new sections required, and the updates/deletions needed to align kernel docs with Flow-only execution.

## Docs style/format (observed)
- **Single H1 title** per doc, sentence case.
- **Short purpose paragraph** immediately below H1.
- **H2 sections** for semantics, lifecycle, and invariants.
- **Explicit invariants** section for rules that must remain true.
- **Code fences** with language tags (`typescript`, `yaml`, `mermaid`).
- **Semantics phrased as bullet lists** (concise, prescriptive).
- **Canonical naming** and glossary in `docs/README.md`.

## New docs sections needed

### 1) Flow runtime (canonical runtime doc)
**Why**: FlowRuntime is the only runtime; legacy runtime is removed.

**Content to add**:
- Flow runtime lifecycle (`harness:start/complete`, `phase`, `task`).
- Inbox routing rules (runId mapping).
- Session mode semantics (human interaction).
- Injection rules: `sendToRun` and `sendTo(nodeId)` (if implemented).
- Async iterable prompt stream contract (initial messages + inbox).
- Multi-turn termination semantics (maxTurns, explicit close).

**Placement**:
- `docs/spec/flow-runtime.md`

### 2) Edge-level `when` routing
**Why**: Conditional routing moves to edges in Flow.

**Content to add**:
- Edge `when` semantics (evaluated on output context).
- Rule: node executes when at least one incoming edge fires.
- Merge semantics (`control.merge` with `mode: all|any`).

**Placement**:
- `docs/flow/flow-spec.md` (schema + examples)
- `docs/flow/when.md` (extend semantics to edges)
- `docs/flow/execution.md` (execution rules)

### 3) Policy enforcement (FlowPolicy + NodePolicy)
**Why**: Policies exist in schema but must be described as runtime behavior.

**Content to add**:
- Timeout + retry semantics (order of operations).
- `continueOnError` vs `failFast` precedence.
- Error marker format for outputs when continuing.

**Placement**:
- `docs/flow/execution.md`

### 4) Agent nodes are first-class, stateful, and injectable
**Why**: All agent nodes should receive inbox and emit tool events.

**Content to add**:
- All agent nodes get inbox (always).
- `runId` is fresh per agent invocation.
- Tool/streaming events emitted by agent nodes.
- Async iterable prompt input for multi-turn agents.
- Explicit termination rules for session-like nodes.

**Placement**:
- `docs/spec/agent.md`
- `docs/flow/registry.md` (NodeType capabilities)

### 5) Node catalog (v1)
**Why**: Need canonical list for “n8n for agents.”

**Content to add**:
- Control nodes
- Agent nodes
- Data/transform nodes
- System/runtime nodes
- Channels are external interfaces (not nodes)

**Placement**:
- New doc: `docs/flow/node-catalog.md`
- Linked from `docs/README.md`

---

## Docs to update (no edits here yet)

### `docs/README.md`
- Update **Architecture overview** to show FlowRuntime owning Hub (no legacy runtime).
- Update **Key invariant**: Flow becomes the runtime (not “runs inside harness”).
- Add link to **Node Catalog** doc.

### `docs/flow/flow-spec.md`
- Add `when` on **edges** with `WhenExpr`.
- Clarify NodeSpec `config` pass-through for agent nodes.
- Add examples for edge-level routing.
- Clarify channels are attached at runtime (not declared as nodes).

### `docs/flow/when.md`
- Extend to include edge-level `when` evaluation context.

### `docs/flow/execution.md`
- Replace “Flow runs inside a harness” with Flow runtime semantics.
- Add policy enforcement (timeout, retry, continueOnError, failFast).
- Add edge-level routing rules (edge gating, merge semantics).

### `docs/flow/registry.md`
- Add agent node capability requirements:
  - `supportsInbox: true` for all agent nodes
  - `isStreaming: true` where applicable
  - `isAgent: true` (new capability flag)

### `docs/spec/flow-runtime.md`
- Ensure FlowRuntime is documented as the only runtime.
- Update examples to show Flow runtime usage.

### `docs/spec/agent.md`
- Clarify runId lifecycle (fresh per invocation).
- Inbox always available for agent nodes.
- Injection semantics via hub methods.
- Async iterable prompt contract for multi-turn agents.

### `docs/spec/channel.md`
- Clarify channels are interfaces to a running flow (not graph nodes).

### `docs/reference/protocol-types.md`
- Update `Edge` type to include `when?: WhenExpr`.
- Add `NodeCapabilities.isAgent?: boolean`.
- Add Flow runtime types (FlowInstance/FlowRunResult) if introduced.
 - Document `SDKUserMessage` shape used by prompt streams (reference link or type excerpt).

### `docs/testing/*`
- Add Flow runtime fixtures + tests in testing docs.
- Update testing workflow to include Flow runtime runs (replay fixtures).

### Test spec format
- All new components must have `.test-spec.md` files using the canonical template.
- Reference: `docs/testing/test-spec-template.md`

---

## Docs to delete or deprecate (proposal)

### Deprecate
- `docs/spec/flow-runtime.md`

### Remove statements (not files)
- Any reference to “Flow runs inside a harness.”
- Any claim that only some nodes have inbox support.
- Any mention of `unstable_v2_prompt` usage.
- Any suggestion that async prompt streams are optional for multi-turn agents.

---

## New docs to add (proposed)
- `docs/spec/flow-runtime.md` — Flow runtime lifecycle + inbox routing.
- `docs/flow/node-catalog.md` — Canonical node list + minimal schemas.
- Optional: `docs/flow/edge-routing.md` — dedicated edge `when` semantics.
- Optional: `docs/spec/async-prompt-stream.md` — detailed streaming contract and termination rules.

---

## Spec folder additions created
- `specs/ready/015-flow-only-architecture/spec.md` (updated)
- `specs/ready/015-flow-only-architecture/docs-impact.md` (this file)
