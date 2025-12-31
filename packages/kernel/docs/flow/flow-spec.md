# FlowSpec Protocol

A FlowSpec is a YAML definition of a DAG that runs inside the **Flow runtime**.

## Top-level shape

```yaml
flow:
  name: string
  version: number                # default: 1
  description: string?           # optional
  input: object?                 # optional default inputs
  nodePacks: string[]?           # optional list of required packs
  policy:
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
    when: WhenExpr?              # optional edge gating
```

## Naming rules

- `flow.name`: freeform string (display name)
- `nodes[].id` (NodeId):
  - **MUST** be unique
  - **MUST** match `^[A-Za-z_][A-Za-z0-9_]*$` (so it can be referenced as `{{nodeId.key}}`)
- `nodes[].type` (NodeTypeId): recommended `namespace.kind` (e.g., `claude.agent`, `condition.equals`)

## Flow metadata

### `flow.name`

Display name for the flow.

### `flow.version`

Version number (default: 1). Used for schema evolution.

### `flow.description`

Optional description.

### `flow.input`

Optional default inputs. Available in bindings as `flow.input.<key>`.

### `flow.nodePacks`

Optional list of required node packs (e.g., `core`, `claude`). Used by the CLI
to build the registry from an explicit allowlist.

### `flow.policy`

Optional workflow-level policy:

- `failFast: boolean` (default: `true`)
  - `true`: first node failure fails the flow run
  - `false`: flow continues executing other runnable nodes unless a node's own policy says otherwise

## NodeSpec

### Required fields

- `id`: node instance identifier (used in bindings + edges)
- `type`: registry key that selects a TypeScript `NodeTypeDefinition`
- `input`: key/value object passed to the node runtime after binding resolution

### Optional fields

- `config`: node-type-specific config (provider settings, schema ids, etc.)
- `when`: boolean expression that gates execution (see [When](when.md))
- `policy`: retry/timeout/error strategy (see [Execution](execution.md))

### `input.promptFile` (optional)

If `promptFile` is present, the loader reads the file contents and injects
`prompt` into the node input. This is resolved **relative to the YAML file**
and is mutually exclusive with an explicit `prompt` field.

```yaml
nodes:
  - id: ask
    type: claude.agent
    input:
      promptFile: "./prompts/ask.txt"
```

## Edges

`edges` define **execution dependencies**:

- A node is eligible to run when **all upstream dependencies** have completed (success or failure)
- **Bindings do not imply dependencies** (i.e., using `{{facts.capital}}` does not automatically create an edge)

**B1 rule**: `edges` is **required** (may be `[]` for single-node flows). The graph is never inferred from ordering or bindings.

### Edge gating (`when`)

Edges may include `when` conditions. The condition is evaluated when the **source node completes**.
If it resolves to `false`, that edge is skipped. See [Edge Routing](edge-routing.md).

## Control flow

### Conditional gating (`when`)

If `when` evaluates to `false`, the node is **skipped** (not executed).

Skip semantics:
- The engine records a skipped marker in outputs (shape is engine-defined)
- Downstream nodes can still run if they don't depend on that output

See [When](when.md) for the expression grammar.

## Policies

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
- `timeoutMs`: node run is aborted if it exceeds the timeout
- `retry.maxAttempts`: total attempts including the first
- `continueOnError`:
  - if `false` (default), node failure is a flow failure when `failFast: true`
  - if `true`, the engine records an error marker for that node output and continues

See [Execution](execution.md) for detailed execution semantics.

## Channels (not in FlowSpec)

Channels are runtime interfaces and do not appear in FlowSpec. They are attached when creating a flow runner.

## Example

```yaml
flow:
  name: benin-demo
  version: 1
  input:
    country: Benin
  nodePacks: [core, claude]

nodes:
  - id: facts
    type: mcp.geo.country_info
    input:
      country: "{{flow.input.country}}"

  - id: isFrench
    type: condition.equals
    input:
      left: "{{facts.officialLanguage}}"
      right: "French"

  - id: sayFrench
    type: claude.agent
    when:
      equals:
        var: "isFrench.value"
        value: true
    input:
      prompt: "Write in French about {{flow.input.country}} (capital: {{facts.capital}})."

edges:
  - from: facts
    to: isFrench
  - from: isFrench
    to: sayFrench
```
