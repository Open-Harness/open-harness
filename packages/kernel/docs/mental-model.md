# Open Harness Kernel: Mental Model

This document explains how the kernel works, how pieces fit together, and why it's designed this way.

---

## 1. The Core Idea

**The kernel is an event-driven workflow execution system.**

```
YAML Flow Definition
       ↓
   [Parse + Validate]
       ↓
   [Compile to DAG]
       ↓
   [Execute Nodes in Order]
       ↓
   [Events flow through Hub]
       ↓
   [Channels observe & interact]
```

That's it. Everything else is details.

---

## 2. The Three Layers

### Layer 1: Hub (The Event Bus)

**What it is**: A message bus that all events flow through.

**Code**: `src/engine/hub.ts` (~350 lines)

**What it does**:
- `emit(event)` - Publish an event
- `subscribe(filter, listener)` - Listen for events
- `scoped(context, fn)` - Run code with context attached to all events
- `current()` - Get the current context (session, phase, task, agent)
- `sendToRun(runId, message)` - Inject a message to a specific agent run

**Why it matters**: Everything goes through the Hub. No side channels. This gives you:
- Full observability (subscribe to `*` and see everything)
- Context propagation (events know which task/phase/agent they came from)
- Command injection (external systems can send messages to running agents)

```typescript
// Example: Subscribe to all events
hub.subscribe("*", (event) => {
  console.log(`[${event.context.task?.id}] ${event.event.type}`);
});

// Example: Run code with context
await hub.scoped({ phase: { name: "Execute" } }, async () => {
  hub.emit({ type: "custom:event" }); // This event has phase context attached
});
```

---

### Layer 2: Flow (The Workflow Engine)

**What it is**: A DAG execution engine that runs YAML-defined workflows.

**Code**: `src/flow/` (~1000 lines total)

**The pipeline**:
```
YAML String
    ↓ parser.ts
FlowYaml (parsed AST)
    ↓ validator.ts
Validated FlowYaml
    ↓ compiler.ts
Compiled { nodes: sorted, edges }
    ↓ executor.ts
Running workflow with events
```

**Key concepts**:

1. **Nodes**: Executable units with input/output schemas
   ```yaml
   - id: ask_user
     type: claude.agent
     input:
       prompt: "What is your name?"
   ```

2. **Edges**: Explicit dependencies between nodes
   ```yaml
   edges:
     - from: ask_user
       to: greet_user
   ```

3. **Bindings**: Data threading via `{{nodeId.field}}`
   ```yaml
   - id: greet_user
     type: echo
     input:
       text: "Hello, {{ ask_user.text }}!"
   ```

4. **When expressions**: Conditional execution
   ```yaml
   - id: conditional_node
     when:
       not:
         equals: { var: "previous.status", value: "skip" }
   ```

---

### Layer 3: Channels (External Interfaces)

**What it is**: Adapters that connect external systems to the Hub.

**Code**: `src/protocol/channel.ts` + `src/channels/websocket.ts`

**What a channel does**:
1. Subscribes to hub events (observe)
2. Sends commands to hub (interact)
3. Has its own state (track connection info, etc.)

**Current implementation**: WebSocket channel that:
- Broadcasts all hub events to connected WebSocket clients
- Receives commands from clients and forwards to hub

**The open question** (we'll address below): Is WebSocket the right/only channel we need?

---

## 3. How Execution Works (Step by Step)

Let's trace what happens when you run this flow:

```yaml
flow:
  name: "Simple Flow"

nodes:
  - id: ask
    type: claude.agent
    input:
      prompt: "Say hello"

  - id: log
    type: echo
    input:
      text: "Agent said: {{ ask.text }}"

edges:
  - from: ask
    to: log
```

### Step 1: Parse & Validate

```typescript
const yaml = parseFlowYaml(yamlString);
validateFlowYaml(yaml); // Zod schemas check structure
```

### Step 2: Compile

```typescript
const compiled = compileFlow(yaml);
// Returns: { nodes: [ask, log], edges: [...] }
// Nodes are topologically sorted (ask before log)
```

### Step 3: Create Hub

```typescript
const hub = createHub("session-123");
```

### Step 4: Execute Flow

```typescript
const result = await executeFlow(yaml, registry, hub);
```

Inside `executeFlow`:

1. **Emit `node:start`** for `ask` node
2. **Run `ask`** → calls Claude SDK → returns `{ text: "Hello!" }`
3. **Store output** → `outputs["ask"] = { text: "Hello!" }`
4. **Emit `node:complete`** for `ask`
5. **Resolve edge** → `ask → log` edge fires
6. **Resolve bindings** → `{{ ask.text }}` becomes `"Hello!"`
7. **Emit `node:start`** for `log`
8. **Run `log`** → echoes `"Agent said: Hello!"`
9. **Emit `node:complete`** for `log`

### What Channels See

If WebSocket channel is registered, a connected client receives:
```json
{ "type": "node:start", "nodeId": "ask", ... }
{ "type": "node:complete", "nodeId": "ask", "output": { "text": "Hello!" }, ... }
{ "type": "node:start", "nodeId": "log", ... }
{ "type": "node:complete", "nodeId": "log", ... }
```

---

## 4. The Channel Question (Unresolved)

### Original Vision

Different channels for different interfaces:
- `WebSocketChannel` → Browser/React UI
- `CLIChannel` → Terminal interface
- `VoiceChannel` → ElevenLabs integration

### Current State

One channel: WebSocket

### The Question

**Option A: Client-side adapters**
- Kernel has ONE WebSocket channel
- Voice/CLI/React are WebSocket clients
- Rendering/interaction logic lives in clients

```
Kernel ──WebSocket──┬── Browser (React)
                    ├── CLI Tool
                    └── Voice App
```

**Option B: Server-side channels**
- Kernel has multiple channel types
- Each channel type handles specific interface logic

```
Kernel ──┬── WebSocketChannel → Browser
         ├── CLIChannel → Terminal
         └── VoiceChannel → ElevenLabs
```

### When You'd Need Server-Side Channels

- Logging to disk (can't do client-side)
- Integrations that need server credentials (Slack, Discord)
- Complex transformations before sending to clients

### When Client-Side Is Enough

- Different UIs that just need events
- All clients can connect via WebSocket
- UI logic doesn't need kernel access

**Recommendation**: Start with Option A (client-side). Add server-side channels only when you prove you need them.

---

## 5. File Map

```
src/
├── protocol/           # Type definitions (the contracts)
│   ├── hub.ts          # Hub interface
│   ├── flow.ts         # Flow types (FlowYaml, NodeSpec, etc.)
│   ├── agent.ts        # Agent interface
│   ├── channel.ts      # Channel interface
│   └── events.ts       # Event types
│
├── engine/             # Hub implementation
│   ├── hub.ts          # HubImpl (the actual event bus)
│   └── events.ts       # Event creation/filtering
│
├── flow/               # Flow execution
│   ├── parser.ts       # YAML → FlowYaml
│   ├── validator.ts    # Zod validation
│   ├── compiler.ts     # Topological sort
│   ├── executor.ts     # Run the DAG
│   ├── bindings.ts     # {{ }} resolution
│   ├── when.ts         # Conditional evaluation
│   ├── registry.ts     # Node type registry
│   └── nodes/          # Built-in nodes
│       ├── echo.ts
│       ├── constant.ts
│       ├── claude.agent.ts
│       └── control.foreach.ts
│
├── channels/           # Channel implementations
│   └── websocket.ts    # WebSocket channel
│
└── providers/          # External service adapters
    └── claude.ts       # Claude SDK wrapper
```

---

## 6. The Canonical Interface (How to Use the Kernel)

### Running a Flow

```typescript
import {
  createHub,
  executeFlow,
  parseFlowYaml,
  NodeRegistry,
  claudeNode
} from "@open-harness/kernel";

// 1. Create hub
const hub = createHub("my-session");

// 2. Register your observer channels FIRST (before execution)
hub.registerChannel({
  name: "logger",
  on: {
    "node:*": ({ event }) => {
      console.log(`[${event.event.type}] ${event.event.nodeId}`);
    },
    "agent:*": ({ event, hub }) => {
      // Can also send back to hub if needed
      if (event.event.type === "agent:error") {
        hub.emit({ type: "alert:error", message: event.event.error });
      }
    },
  },
});

// 3. Register node types
const registry = new NodeRegistry();
registry.register(claudeNode);

// 4. Parse flow
const flow = parseFlowYaml(`
flow:
  name: "My Flow"
nodes:
  - id: agent
    type: claude.agent
    input:
      prompt: "Hello"
edges: []
`);

// 5. Start hub (activates all channels)
await hub.start();

// 6. Execute - just pass the hub directly!
const result = await executeFlow(flow, registry, hub);
console.log(result.outputs);

// 7. Stop hub (cleans up all channels)
await hub.stop();
```

### How Context Propagation Works (Internal)

When the executor runs nodes, it automatically wraps execution in context scopes using `hub.scoped()`. This means all events emitted during node execution automatically include context like which phase and task they belong to.

```typescript
// This happens INTERNALLY in the executor - you don't do this:
await hub.scoped({ phase: { name: "Run Flow" } }, async () => {
  await hub.scoped({ task: { id: "node:ask" } }, async () => {
    hub.emit({ type: "node:start" }); // Automatically has phase + task context
  });
});
```

**You don't need to think about this.** Just pass the hub to `executeFlow` and context is handled automatically.

### Observing Events (THE CANONICAL WAY)

**USE CHANNELS. Don't subscribe manually.**

```typescript
// CORRECT: Register a channel
hub.registerChannel({
  name: "my-observer",
  on: {
    "node:*": ({ event }) => { /* handle */ },
    "agent:*": ({ event }) => { /* handle */ },
  },
  onStart: ({ hub }) => { /* setup */ },
  onComplete: ({ hub }) => { /* cleanup */ },
});
// Hub manages subscriptions and cleanup automatically
```

```typescript
// AVOID: Manual subscription (low-level, easy to leak)
const unsub = hub.subscribe("node:*", handler);
// ... easy to forget unsub()
```

Manual `subscribe()` exists for advanced cases (e.g., inside channel implementations) but is NOT the canonical way to observe events.

### Injecting Messages (Multi-turn)

When an agent node is running, you can inject messages into it:

```typescript
// 1. Register a channel that captures the runId from node:start
let activeRunId: string | null = null;

hub.registerChannel({
  name: "message-injector",
  on: {
    "node:start": ({ event }) => {
      // The executor creates a runId for each node execution
      activeRunId = event.context.task?.id ?? null;
    },
    "external:user-message": ({ event, hub }) => {
      // When external message comes in, forward to active run
      if (activeRunId) {
        hub.sendToRun(activeRunId, event.message);
      }
    },
  },
});

// 2. Later, external system emits user message
hub.emit({ type: "external:user-message", message: "User's follow-up" });
// The channel forwards it to the active agent run
```

---

## 7. What's Solid vs. What's Uncertain

### Solid (High Confidence)

| Component | Why |
|-----------|-----|
| Hub event bus | Simple, well-tested, clear purpose |
| Flow YAML structure | Standard DAG representation |
| Binding resolution | Straightforward templating |
| Sequential execution | Works, tested |
| Claude integration | Direct SDK wrapper |

### Uncertain (Needs Validation)

| Component | Question |
|-----------|----------|
| Channels | Is WebSocket enough? Need more types? |
| Container nodes | Is foreach complexity needed? |
| Policy system | Are retry/timeout actually used? |
| ReactFlow UI | Built before core is understood |

---

## 8. Next Steps to Build Confidence

1. **Run an actual flow** - Not a test, a real workflow that does something
2. **Resolve channel question** - Decide: client-side adapters or server-side channels
3. **Build customer project** - Validate the architecture works in practice
4. **Document gaps** - Write down what's missing when you hit them

---

*Document created: 2026-01-02*
*Status: Draft - needs validation through use*
