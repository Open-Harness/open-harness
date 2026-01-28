# Core Architecture Diagrams

**Date**: 2026-01-26
**Note**: Server/Client model. See [architecture.md](./architecture.md) for full architecture.

---

## 1. Server/Client Architecture

The fundamental separation: Server runs workflows, Clients connect via HTTP/SSE.

```mermaid
flowchart TB
    subgraph "CLIENT SIDE"
        direction TB
        ReactApp["React Web App"]
        OtherClient["Any HTTP Client"]
    end

    subgraph "PROTOCOL"
        HTTP["HTTP/SSE"]
    end

    subgraph "SERVER SIDE"
        direction TB
        Server["@open-scaffold/server"]

        subgraph "Effect Runtime"
            Programs["Programs"]
            Services["Service Tags"]
            Layers["Layer Implementations"]
        end
    end

    ReactApp --> HTTP
    OtherClient --> HTTP
    HTTP --> Server
    Server --> Programs
    Programs --> Services
    Services --> Layers

    style ReactApp fill:#e1f5fe
    style OtherClient fill:#e1f5fe
    style HTTP fill:#fff3e0
    style Server fill:#c8e6c9
```

---

## 2. Server Layer Composition

How services compose inside the server.

```mermaid
flowchart TB
    subgraph "Public API (Promise-based)"
        OpenScaffold["OpenScaffold.create()"]
        createServer["scaffold.createServer()"]
        serverStart["server.start()"]
    end

    subgraph "HTTP Layer"
        Routes["HTTP Routes"]
        SSE["SSE Streaming"]
    end

    subgraph "Effect Runtime"
        subgraph "Programs (What to do)"
            executeWorkflow["executeWorkflow"]
            runPhase["runPhase"]
            runAgent["runAgent"]
            recordEvent["recordEvent"]
        end

        subgraph "Service Tags (Dependencies)"
            EventStoreLive["EventStoreLive"]
            StateSnapshotStoreLive["StateSnapshotStoreLive"]
            EventBus["EventBus"]
            AgentProvider["AgentProvider"]
            AgentService["AgentService"]
        end

        subgraph "Local Factories (Per Workflow)"
            StateCache["StateCache<S> (factory)"]
        end

        subgraph "Layers (How to do it)"
            subgraph "Storage Layers"
                LibSQLStore["LibSQL Store"]
                EventBusLive["EventBusLive"]
            end

            subgraph "Provider Layers"
                AnthropicProvider["AnthropicProvider"]
            end
        end
    end

    OpenScaffold --> createServer
    createServer --> serverStart
    serverStart --> Routes
    Routes --> executeWorkflow
    SSE --> EventBus

    executeWorkflow --> runPhase
    runPhase --> runAgent
    runPhase --> recordEvent

    runAgent -.-> AgentProvider
    recordEvent -.-> EventStoreLive
    recordEvent -.-> EventBus
    runPhase -.-> StateCache
    runAgent -.-> AgentService

    EventStoreLive --> LibSQLStore
    StateSnapshotStoreLive --> LibSQLStore
    EventBus --> EventBusLive
    AgentProvider --> AnthropicProvider

    style OpenScaffold fill:#e1f5fe
    style createServer fill:#e1f5fe
    style serverStart fill:#e1f5fe
    style Routes fill:#fff3e0
    style SSE fill:#fff3e0
    style executeWorkflow fill:#c8e6c9
    style runPhase fill:#c8e6c9
    style runAgent fill:#c8e6c9
    style recordEvent fill:#c8e6c9
```

---

## 3. Protocol Data Flow

How events flow from server to clients via SSE.

```mermaid
flowchart LR
    subgraph "Input"
        User["User Input\n(POST /input)"]
        Resume["Resume Session"]
    end

    subgraph "Workflow Execution"
        Phases["Phase Runner"]
        Agent["Agent (LLM)"]
    end

    subgraph "Persistence"
        EventStore["EventStoreLive\n(append-only)"]
        StateCache["StateCache<S>\n(derived, in-memory)"]
        StateSnapshotStore["StateSnapshotStoreLive\n(snapshots)"]
    end

    subgraph "Broadcast"
        EventBus["EventBus\n(PubSub)"]
        SSEStream["SSE Stream\n(GET /events)"]
    end

    subgraph "Clients"
        React["React App"]
        Terminal["Terminal TUI"]
        Test["Test Client"]
    end

    User --> Phases
    Resume --> EventStore
    EventStore --> Phases

    Phases --> Agent
    Agent --> Phases

    Phases --> EventStore
    Phases --> StateCache
    StateCache -.-> StateSnapshotStore
    Phases --> EventBus

    EventBus --> SSEStream
    SSEStream --> React
    SSEStream --> Terminal
    SSEStream --> Test

    style User fill:#c8e6c9
    style Resume fill:#c8e6c9
    style Phases fill:#fff3e0
    style Agent fill:#fff3e0
    style EventStore fill:#e3f2fd
    style StateCache fill:#e3f2fd
    style StateSnapshotStore fill:#e3f2fd
    style EventBus fill:#fce4ec
    style SSEStream fill:#fce4ec
    style React fill:#f3e5f5
    style Terminal fill:#f3e5f5
    style Test fill:#f3e5f5
```

---

## 4. Effect Service Dependency Graph

What each program requires.

```mermaid
flowchart TB
    subgraph "Programs"
        executeWorkflow["executeWorkflow"]
        runPhase["runPhase"]
        runAgent["runAgent"]
        recordEvent["recordEvent"]
        createSession["createSession"]
        loadSession["loadSession"]
        computeStateAt["computeStateAt"]
        observeEvents["observeEvents"]
        observeState["observeState"]
        resumeSession["resumeSession"]
        forkSession["forkSession"]
    end

    subgraph "Services"
        ES["EventStoreLive"]
        SSS["StateSnapshotStoreLive"]
        EB["EventBus"]
        AP["AgentProvider"]
        AS["AgentService"]
    end

    subgraph "Factories"
        SC["StateCache<S>"]
    end

    executeWorkflow --> ES & EB & AP & SC
    runPhase --> ES & EB & AP & SC
    runAgent --> AP & AS
    recordEvent --> ES & EB
    createSession --> ES & EB & SC
    loadSession --> ES
    computeStateAt --> ES
    observeEvents --> EB
    observeState --> SC
    resumeSession --> ES & EB & AP & SC
    forkSession --> ES & SC

    style ES fill:#e3f2fd
    style SSS fill:#e3f2fd
    style EB fill:#fce4ec
    style AP fill:#fff3e0
    style AS fill:#fff3e0
    style SC fill:#e3f2fd
```

---

## 5. HTTP Protocol Endpoints

The server's REST + SSE interface.

```mermaid
flowchart TB
    subgraph "Client"
        App["Any Client"]
    end

    subgraph "Session Endpoints"
        POST1["POST /sessions\n(create)"]
        GET0["GET /sessions\n(list)"]
        GET1["GET /sessions/:id/events\n(SSE stream)"]
        GET2["GET /sessions/:id/state\n(current or ?position=N)"]
        POST2["POST /sessions/:id/input\n(send event)"]
        DELETE1["DELETE /sessions/:id\n(end)"]
    end

    subgraph "VCR Endpoints"
        POST3["POST /sessions/:id/pause"]
        POST4["POST /sessions/:id/resume"]
        POST5["POST /sessions/:id/fork"]
    end

    subgraph "Recording Endpoints"
        GET3["GET /recordings\n(list)"]
        GET4["GET /recordings/:id"]
        DELETE2["DELETE /recordings/:id"]
        GET5["GET /providers/status"]
    end

    App --> POST1
    App --> GET0
    App --> GET1
    App --> GET2
    App --> POST2
    App --> DELETE1
    App --> POST3
    App --> POST4
    App --> POST5
    App --> GET3
    App --> GET4
    App --> DELETE2
    App --> GET5

    style POST1 fill:#c8e6c9
    style GET0 fill:#e1f5fe
    style GET1 fill:#e1f5fe
    style GET2 fill:#e1f5fe
    style POST2 fill:#c8e6c9
    style DELETE1 fill:#ffcdd2
    style POST3 fill:#fff3e0
    style POST4 fill:#fff3e0
    style POST5 fill:#fff3e0
    style GET3 fill:#e1f5fe
    style GET4 fill:#e1f5fe
    style DELETE2 fill:#ffcdd2
    style GET5 fill:#e1f5fe
```

---

## 6. Scaffold Workflow State Machine

The Planner/Worker/Judge cycle (example workflow).

```mermaid
stateDiagram-v2
    [*] --> Planning: workflow started

    state Planning {
        [*] --> RootPlanner
        RootPlanner --> SubPlanner: spawn sub-planner
        SubPlanner --> SubPlanner: recursive
        RootPlanner --> TaskQueue: task created
        SubPlanner --> TaskQueue: task created
        TaskQueue --> [*]: all planners done
    }

    Planning --> Working: tasks ready

    state Working {
        [*] --> AssignWorkers
        AssignWorkers --> Worker1: worker assigned
        AssignWorkers --> Worker2: worker assigned
        AssignWorkers --> WorkerN: worker assigned
        Worker1 --> Completed: worker completed
        Worker2 --> Completed: worker completed
        WorkerN --> Completed: worker completed
        Completed --> [*]: all workers done
    }

    Working --> Judging: all workers done

    state Judging {
        [*] --> Evaluate
        Evaluate --> Verdict: judge verdict
    }

    Judging --> Planning: verdict=continue\n(fresh start)
    Judging --> Complete: verdict=complete
    Judging --> Blocked: verdict=blocked

    Complete --> [*]
    Blocked --> [*]
```

---

## 7. TDD Fixture Flow

How fixtures are recorded and replayed.

```mermaid
sequenceDiagram
    participant T as Test
    participant C as TestClient
    participant S as Server
    participant AP as AgentProvider (Real)
    participant F as Fixture File

    Note over T,F: Recording Phase (one-time)

    T->>C: connect(sessionId)
    C->>S: GET /sessions/:id/events (SSE)
    T->>C: sendInput(event)
    C->>S: POST /sessions/:id/input
    S->>AP: run agent
    AP-->>S: streaming response
    S-->>C: SSE: agent:started
    C->>F: append JSONL
    S-->>C: SSE: text:delta
    C->>F: append JSONL
    S-->>C: SSE: agent:completed
    C->>F: append JSONL
    C-->>T: events received

    Note over T,F: Replay Phase (every test run)

    participant MC as MockClient

    T->>MC: connect(sessionId)
    MC->>F: read fixture
    F-->>MC: recorded events
    MC-->>T: events (replayed)
    T->>T: assert
```

---

## 8. Event Causality Chain

How events link to each other via causedBy.

```mermaid
flowchart TB
    E1["user:input\n(root)"]
    E2["phase:changed\ncausedBy: E1"]
    E3["agent:started\ncausedBy: E2"]
    E4["text:delta\ncausedBy: E3"]
    E5["text:delta\ncausedBy: E3"]
    E6["agent:completed\ncausedBy: E3"]
    E7["phase:changed\ncausedBy: E6"]
    E8["agent:started\ncausedBy: E7"]
    E9["text:delta\ncausedBy: E8"]
    E10["text:delta\ncausedBy: E8"]
    E11["agent:completed\ncausedBy: E8"]
    E12["phase:changed\ncausedBy: E11"]
    E13["agent:started\ncausedBy: E12"]
    E14["agent:completed\ncausedBy: E13"]

    E1 --> E2
    E2 --> E3
    E3 --> E4 & E5 & E6
    E6 --> E7
    E7 --> E8
    E8 --> E9 & E10 & E11
    E11 --> E12
    E12 --> E13
    E13 --> E14

    style E1 fill:#c8e6c9
    style E14 fill:#ffcdd2
```

---

## Summary

| Diagram | Purpose |
|---------|---------|
| Server/Client Architecture | Shows fundamental separation |
| Server Layer Composition | Shows how services and layers connect inside server |
| Protocol Data Flow | Shows event flow through server to clients |
| Dependency Graph | Shows what each program needs |
| HTTP Protocol Endpoints | Shows the REST + SSE interface |
| State Machine | Shows scaffold workflow phases |
| TDD Fixture Flow | Shows recording and replay |
| Event Causality | Shows event linking |
