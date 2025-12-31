# Kernel + Flow Protocol (Canonical Spec)

This is the **canonical specification** for the unified kernel + flow system.

## Purpose

This spec defines:
- **Kernel protocol**: the minimal runtime substrate (Hub, FlowRuntime, Agent, Channel)
- **Flow protocol**: declarative YAML DAG execution layer built on the kernel

The kernel provides the event bus, lifecycle management, and bidirectional communication primitives. The flow layer provides structured orchestration (DAG scheduling, conditional execution, bindings) that runs *inside the Flow runtime*.

## Canonical naming

Use these terms consistently everywhere:

### Kernel primitives

- **Hub**: unified bidirectional bus
  - Events out: `subscribe(...)`, async iteration
  - Commands in: `send/sendTo/sendToRun/reply/abort`
  - Context propagation: `scoped(...)`, `current()`
- **FlowRuntime**: orchestrator that owns lifecycle, phase/task helpers, and inbox routing
- **Agent**: executable unit (`AgentDefinition.execute(...)`) that emits `agent:*` events and returns a result
- **Channel**: bidirectional adapter/attachment (console/websocket/voice/etc.) that observes events and sends commands

### Flow layer

- **FlowSpec**: YAML definition of a DAG (`flow`, `nodes`, `edges`)
- **FlowRun**: one execution of a FlowSpec
- **NodeSpec**: one node instance in the graph (`id`, `type`, `input`, `when`, `policy`, `config`)
- **NodeType**: the TypeScript implementation registered under `node.type`

## Architecture overview

```mermaid
flowchart TB
  subgraph UserSpace["User Space"]
    YAML["flow.yaml<br/>(FlowSpec)"]
    REG["TypeScript Registry<br/>(NodeTypes)"]
    CLI["CLI Runner"]
  end

  subgraph Kernel["Kernel Runtime"]
    HUB["Hub<br/>(events + commands + context)"]
    FLOWRT["FlowRuntime<br/>(lifecycle + inbox routing)"]
    CHANNELS["Channels<br/>(console, ws, voice)"]
  end

  subgraph FlowEngine["Flow Engine (library layer)"]
    PARSER["YAML Parser"]
    VALID["Validator (Zod)"]
    COMP["Compiler<br/>(DAG + topo)"]
    BIND["BindingResolver<br/>(A3)"]
    EXEC["Scheduler"]
  end

  YAML --> PARSER
  PARSER --> VALID
  VALID --> COMP
  COMP --> EXEC
  REG --> EXEC
  EXEC --> HUB
  HUB --> EXEC
  FLOWRT --> HUB
  CHANNELS --> HUB
  HUB --> CHANNELS
  CLI --> CHANNELS
```

**Key invariant**: Flow is the only runtime. There is no Harness layer.

## Spec modules

### Kernel protocol

- [Events](spec/events.md) - Event envelope, required event types, context rules
- [Hub](spec/hub.md) - Hub API (events out + commands in) + semantics
- [Flow Runtime](spec/flow-runtime.md) - Lifecycle + phases/tasks + session semantics
- [Agent](spec/agent.md) - AgentDefinition contract, runId/inbox injection semantics
- [Channel](spec/channel.md) - Channel contract + recommended patterns
- [Harness (deprecated)](spec/harness.md)

### Flow protocol

- [FlowSpec](flow/flow-spec.md) - FlowSpec YAML schema + semantics (edges/when/policy)
- [Bindings](flow/bindings.md) - A3 binding grammar + errors
- [When](flow/when.md) - WhenExpr grammar + evaluation semantics
- [Execution](flow/execution.md) - Flow runtime execution semantics
- [Registry](flow/registry.md) - NodeType contract (schemas/capabilities) + library-vs-user responsibilities
- [Edge Routing](flow/edge-routing.md) - Edge-level `when` semantics
- [Node Catalog](flow/node-catalog.md) - Canonical node list

### Reference

- [Protocol Types](reference/protocol-types.md) - Authoritative TypeScript interfaces

### Testing

- [Testing Overview](testing/README.md) - Testing infrastructure overview and navigation
- [Testing Protocol](testing/testing-protocol.md) - Testing infrastructure protocol spec
- [Test Spec Template](testing/test-spec-template.md) - Template for all `.test-spec.md` files
- [Validation Guide](testing/validation.md) - Multi-layer validation strategy and checklists
- [Workflow Guide](testing/workflow.md) - Step-by-step testing workflow

### Implementation

- [Implementation Overview](implementation/README.md) - How to compile spec into code
- [Roadmap](implementation/roadmap.md) - Milestone ordering + done criteria + authoritative scripts
- [Conformance](implementation/conformance.md) - Test tiers, fixture policy, behavioral gates
- [Traceability](implementation/traceability.md) - Spec → test-spec → tests → live scripts mapping
- [TAP Pattern](implementation/patterns/tap.md) - Temporal Accumulation Pattern (implementation pattern)

**Workflow**: Spec → Conformance → Code

### Decisions

- [0001-naming-flow-vs-workflow](decisions/0001-naming-flow-vs-workflow.md)
- [0002-edges-required](decisions/0002-edges-required.md)
- [0003-bindings-a3](decisions/0003-bindings-a3.md)
