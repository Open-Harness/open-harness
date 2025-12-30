# Workflow Engine UML (Mermaid)

These diagrams are “UML-ish” via Mermaid to keep them editable in Markdown.

---

## Component diagram (high-level)

```mermaid
flowchart LR
  subgraph UserSpace["User Space"]
    YAML["workflow.yaml\n(WorkflowYaml)"]
    REG["TypeScript Registry\n(NodeTypeDefinitions)"]
    CLI["CLI Runner\n(console)"]
  end

  subgraph Kernel["Kernel Runtime (spikes/kernel)"]
    HUB["Hub\n(events + commands + ALS context)"]
    HARNESS["Harness\n(owns run lifecycle + inbox routing)"]
    CHANNELS["Channels / Transport Adapters\n(console, ws, voice)"]
  end

  subgraph Engine["Workflow Engine (new)"]
    PARSER["YAML Parser"]
    VALID["Validator (Zod)\n(WorkflowYamlSchema)"]
    COMP["Compiler\n(DAG + topo + refs)"]
    BIND["BindingResolver\n({{ }})"]
    EXEC["WorkflowEngine\n(scheduler + run state)"]
  end

  YAML --> PARSER --> VALID --> COMP --> EXEC
  REG --> EXEC
  EXEC <--> HUB
  HARNESS --> HUB
  CHANNELS <--> HUB
  CLI --> CHANNELS
```

---

## Class diagram (major abstractions)

```mermaid
classDiagram
  class WorkflowYaml {
    +workflow
    +nodes[]
    +edges[]
  }

  class NodeSpec {
    +id: string
    +type: string
    +when?: WhenExpr
    +input: object
    +config?: object
    +policy?: NodePolicy
  }

  class WorkflowPolicy {
    +failFast: boolean
  }

  class WhenExpr {
    +equals
    +not
    +and
    +or
  }

  class NodeTypeDefinition {
    +type: string
    +inputSchema: ZodSchema
    +outputSchema: ZodSchema
    +capabilities: NodeCapabilities
    +run(ctx, input): Promise~output~
  }

  class NodeRegistry {
    +register(def: NodeTypeDefinition)
    +get(type: string): NodeTypeDefinition
  }

  class WorkflowCompiler {
    +compile(def: WorkflowDefinition): CompiledWorkflow
  }

  class BindingResolver {
    +render(input, ctx): input
    +get(path): unknown
  }

  class WorkflowEngine {
    +run(compiled, ctx): Promise~RunResult~
  }

  class Harness {
    +create(input): HarnessInstance
  }

  class Hub {
    +emit(event)
    +subscribe(filter, listener)
    +sendToRun(runId, msg)
    +scoped(ctxPatch, fn)
  }

  class Channel {
    +on(eventType): handler
    +emit(event)
  }

  WorkflowYaml "1" o-- "*" NodeSpec
  NodeRegistry "1" o-- "*" NodeTypeDefinition
  WorkflowCompiler --> WorkflowYaml
  WorkflowCompiler --> BindingResolver
  WorkflowEngine --> WorkflowCompiler
  WorkflowEngine --> NodeRegistry
  WorkflowEngine --> Hub
  Harness --> Hub
  Channel --> Hub
```

---

## Sequence diagram: CLI runs a YAML workflow

```mermaid
sequenceDiagram
  participant CLI as CLI
  participant H as Harness
  participant Hub as Hub
  participant Eng as WorkflowEngine
  participant Reg as NodeRegistry
  participant A as Node (as AgentDefinition)
  participant Ch as ConsoleChannel

  CLI->>H: create(input).attach(ConsoleChannel).startSession().run()
  H->>Hub: emit(harness:start)
  Hub-->>Ch: harness:start
  H->>Eng: run(workflow.yaml, registry)
  Eng->>Hub: emit(phase:start "Run DAG")
  Hub-->>Ch: phase:start

  loop for each runnable node
    Eng->>Hub: emit(task:start "node:<id>")
    Hub-->>Ch: task:start
    Eng->>A: execute(nodeInput, {hub, inbox, runId})
    A->>Hub: emit(agent:text / agent:tool:*)
    Hub-->>Ch: stream events
    A-->>Eng: output
    Eng->>Hub: emit(task:complete)
    Hub-->>Ch: task:complete
  end

  Eng-->>H: result(outputs)
  H->>Hub: emit(harness:complete)
  Hub-->>Ch: harness:complete
```

---

## Sequence diagram: realtime transport steers a running node

```mermaid
sequenceDiagram
  participant Voice as VoiceTransport (11Labs)
  participant Hub as Hub
  participant Node as Streaming Node Run

  Voice-->>Hub: subscribe(agent:*, session:*)
  Hub-->>Voice: agent:start(runId)
  Voice->>Hub: sendToRun(runId, "user said ...")
  Hub-->>Node: inbox yields message
  Node->>Hub: emit(agent:text "ack + continue")
  Hub-->>Voice: agent:text
```

