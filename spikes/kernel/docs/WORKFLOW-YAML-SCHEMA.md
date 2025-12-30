# Workflow YAML Schema (Canonical Contract)

This document is the **single source of truth** for the YAML workflow format used by the DAG workflow engine.

Goals:

- **Stable authoring format** (CLI + future UI)
- **Minimal, predictable control-flow** (DAG + gated nodes)
- **YAML is wiring**; semantics live in **TypeScript node types** (registry)

Non-goals (MVP):

- Persistence, pause/resume, replay
- Parallel scheduling semantics beyond the DAG definition itself
- Long-lived interactive “session nodes” (voice websocket sessions, etc.)

---

## Top-level shape

```yaml
workflow:
  name: string
  version: number                # default: 1
  description: string?           # optional
  input: object?                 # optional default inputs
  policy:                         # optional workflow-level policy
    failFast: boolean            # default: true

nodes:
  - id: string
    type: string                 # NodeTypeId (registry key)
    input: object                # templating allowed in string fields
    config: object?              # freeform; node-type-specific
    when: WhenExpr?              # optional gating
    policy: NodePolicy?          # optional per-node policy

edges:
  - from: string                 # NodeId
    to: string                   # NodeId
```

### Naming rules

- `workflow.name`: freeform string (display name)
- `nodes[].id` (**NodeId**):
  - **MUST** be unique
  - **MUST** match `^[A-Za-z_][A-Za-z0-9_]*$` (so it can be referenced as `{{nodeId.key}}`)
- `nodes[].type` (**NodeTypeId**): recommended `namespace.kind` (e.g. `anthropic.text`, `condition.equals`)

---

## NodeSpec

### Required fields

- `id`: node instance identifier (used in bindings + edges)
- `type`: registry key that selects a TypeScript `NodeTypeDefinition`
- `input`: key/value object passed to the node runtime after binding resolution

### Optional fields

- `config`: node-type-specific config (provider settings, schema ids, etc.)
- `when`: boolean expression that gates execution (see below)
- `policy`: retry/timeout/error strategy (see below)

---

## Control flow

### 1) Dependencies (`edges`)

`edges` define **execution dependencies** only:

- A node is eligible to run when **all upstream dependencies** have completed (success or failure).
- **Bindings do not imply dependencies** in MVP (i.e. using `{{facts.capital}}` does not automatically create an edge).

MVP rule (B1):

- `edges` is **required** (may be an empty list `[]` for a single-node workflow).
- The workflow graph is never inferred from node ordering or from bindings.

### 2) Conditional gating (`when`)

If `when` evaluates to `false`, the node is **skipped** (not executed).

Skip semantics (MVP):

- The engine records a skipped marker in outputs (shape is engine-defined), so downstream nodes can still run if they don’t depend on that output.

---

## `WhenExpr` (MVP boolean expression grammar)

```yaml
# equals
when:
  equals:
    var: string      # VarPath
    value: any

# not
when:
  not: <WhenExpr>

# and / or
when:
  and:
    - <WhenExpr>
    - <WhenExpr>

when:
  or:
    - <WhenExpr>
    - <WhenExpr>
```

### VarPath

Var paths use dot notation and are resolved against the **workflow binding context**:

- `workflow.input.<key...>`
- `<nodeId>.<key...>` (node outputs are available by node id)

Example:

```yaml
when:
  equals:
    var: "isFrench.value"
    value: true
```

---

## Policies

### WorkflowPolicy

```yaml
workflow:
  policy:
    failFast: true
```

- `failFast: true` (default): first node failure fails the workflow run.
- `failFast: false`: workflow continues executing other runnable nodes unless a node’s own policy says otherwise.

### NodePolicy

```yaml
policy:
  timeoutMs: number?
  continueOnError: boolean?      # default: false
  retry:
    maxAttempts: number          # >= 1
    backoffMs: number?           # default: 0 (constant backoff)
```

Semantics:

- `timeoutMs`: node run is aborted if it exceeds the timeout.
- `retry.maxAttempts`: total attempts including the first.
- `continueOnError`:
  - if `false` (default), node failure is a workflow failure when `failFast: true`
  - if `true`, the engine records an error marker for that node output and continues

---

## Binding / templating (MVP)

Bindings are **string interpolation only**, and are **strict by default** (A3).

- Any string value in `node.input` may contain `{{ ... }}`.
- The engine resolves `{{path}}` using the same VarPath rules as `when`.

Notes:

- Only strings are templated in MVP (objects/arrays are passed through unchanged).
- **Missing paths are an error** by default (strict mode).
- A path is considered “missing” if it resolves to `null` or `undefined`.

### A3 syntax: optional + default

#### Optional binding

Prefix the path with `?` to allow missing values:

```yaml
input:
  prompt: "Capital (if known): {{?facts.capital}}"
```

Semantics:

- If present → renders the value
- If missing → renders `""` (empty string)

#### Default filter

You can provide a fallback value using a `default:` filter:

```yaml
input:
  prompt: "Capital: {{facts.capital | default:\"Unknown\"}}"
```

Semantics:

- If present → renders the value
- If missing → renders the default

Default values should be JSON literals:

- strings: `"Unknown"`
- numbers: `123`
- booleans: `true`
- objects/arrays: `{"a":1}` / `[1,2]`

Example:

```yaml
input:
  prompt: |
    Write 2 sentences about {{workflow.input.country}}.
    Mention the capital: {{facts.capital}}.
```

---

## Full example (matches current spike)

```yaml
workflow:
  name: benin-demo
  version: 1
  input:
    country: Benin

nodes:
  - id: facts
    type: mcp.geo.country_info
    input:
      country: "{{workflow.input.country}}"

  - id: isFrench
    type: condition.equals
    input:
      left: "{{facts.officialLanguage}}"
      right: "French"

  - id: sayFrench
    type: anthropic.text
    when:
      equals:
        var: "isFrench.value"
        value: true
    input:
      prompt: "Write in French about {{workflow.input.country}} (capital: {{facts.capital}})."
    config:
      mcp: []

  - id: sayEnglish
    type: anthropic.text
    when:
      equals:
        var: "isFrench.value"
        value: false
    input:
      prompt: "Write in English about {{workflow.input.country}} (capital: {{facts.capital}})."
    config:
      mcp: []

edges:
  - from: facts
    to: isFrench
  - from: isFrench
    to: sayFrench
  - from: isFrench
    to: sayEnglish
```

