# Proposed folder + file skeleton (Deprecated)

This document has been consolidated into `docs/README.md`:

- `./README.md` (see “Where to look in code”)

> Note: “kernel” already exists (`src/hub.ts`, `src/harness.ts`, `src/channel.ts`, etc.).
> This skeleton adds a **workflow engine layer** without rewriting the kernel.

---

## Proposed tree (MVP)

```text
spikes/kernel/
  src/
    # existing kernel runtime
    hub.ts
    harness.ts
    agent.ts
    channel.ts
    events.ts
    ...

    # NEW: workflow engine layer (YAML DAG)
    workflow/
      types.ts           # WorkflowYaml, NodeSpec, policies, capabilities
      schema.ts          # Zod schemas for YAML shape validation
      parser.ts          # YAML -> JS object
      compiler.ts        # DAG validation + topo + dependency graph
      bindings.ts        # {{ }} resolver (MVP: strings)
      engine.ts          # runWorkflow() core scheduler
      bridge.ts          # “engine inside harness” wrapper

    registry/
      nodeRegistry.ts    # NodeRegistry class/interface
      nodeTypes.ts       # NodeTypeDefinition types + helpers

    nodes/               # built-in node types
      control/
        conditionEquals.ts
        switch.ts         # later
      transform/
        template.ts

    providers/           # provider-specific nodes
      anthropic/
        anthropicTextNode.ts
        anthropicStructuredNode.ts
      elevenlabs/
        README.md         # transport-first guidance (no node in MVP)

    transports/
      console.ts          # ConsoleTransport adapter (channel)
      websocket.ts        # WS/SSE transport skeleton (channel)
      types.ts            # transport interfaces

  docs/
    WORKFLOW-ENGINE-ARCHITECTURE.md
    WORKFLOW-YAML-SCHEMA.md
    WORKFLOW-ENGINE-UML.md
    WORKFLOW-ENGINE-MVP.md

  examples/
    run-yaml-workflow.ts
    workflow.example.yaml
    yaml-registry.ts
```

---

## Why this split?

- `workflow/**` is the **engine core** (library-owned).
- `registry/**` defines the **extension contract** (user-owned implementations plug in).
- `nodes/**` + `providers/**` are **library-supplied building blocks** (good defaults, but optional).
- `transports/**` are **adapters** that let different interaction layers “speak hub”.

