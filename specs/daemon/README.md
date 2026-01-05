# Flow Daemon Plan (Design Only)

Goal: a standalone executable that loads a single flow YAML, runs it, logs
runtime events to the console, and exposes a WebSocket server for UI clients.

This doc is design-only. No code changes here.

## Documents

- `specs/daemon/ARCHITECTURE.md` — hexagonal architecture + module layout
- `specs/daemon/PROTOCOL.md` — WebSocket envelope + examples
- `specs/daemon/RENDERING.md` — grouped text + JSON rendering rules
- `specs/daemon/CLI.md` — CLI flags, defaults, examples
- `specs/daemon/TESTING.md` — test plan and live-test requirements

## Canonical Code Facts

- YAML parsing uses `parseFlowYaml` in `packages/sdk/src/runtime/compiler.ts`.
- Runtime API: `createRuntime`, `runtime.run()`, `runtime.onEvent()`.
- Commands are `RuntimeCommand` (`send`, `reply`, `abort`, `resume`).
- WebSocket transport exists in `packages/sdk/src/transport/websocket.ts` and
  speaks a `{ type: "event" | "command" }` JSON envelope.
- Built-in nodes: `constant`, `echo`, `claude.agent`.

## Scope

- Built-in nodes only (no custom node loading).
- In-memory only (no persistence yet).
- Long-lived process: accepts WebSocket clients and allows interactive
  pause/resume during a run.
- One flow YAML per process; one run active at a time.
- Run starts on daemon boot (no remote start command in v1).

## Decisions (Confirmed)

- Single flow per process.
- Single run at a time.
- Use existing Runtime WebSocket envelope (Option A).
- Built-in nodes only.
- In-memory only (no persistence yet).
- WS adapter is a thin port-based adapter (not the SDK WebSocketTransport).
- Text logs are grouped by node/agent with color categories.

## Decisions (Pending)

- None for v1 (defaults locked in CLI spec).

## Proposed UX

CLI:

- `--flow <path>`: flow YAML file
- `--input <json>` or `--input-file <path>`: runtime input
- `--stream` / `--no-stream`: print text deltas or only final output
  (default: `--stream`)
- `--verbosity <quiet|normal|verbose|debug>`: event logging level
- `--ws-port <number>` and `--ws-path <string>`: WebSocket endpoint
- `--no-ws`: disable WebSocket server (logs only)
- `--print-json`: log events as JSON lines instead of formatted text

Example:

```
open-harness-daemon --flow flow.yaml --input '{"name":"World"}' --stream --ws-port 42069
```

## WebSocket Protocol Option A (Runtime Envelope)

Messages:

- Event broadcast:
  `{ "type": "event", "event": { ...RuntimeEvent... } }`
- Command in:
  `{ "type": "command", "command": { ...RuntimeCommand... } }`

Pros:
- Already implemented in SDK (`WebSocketTransport`).
- Matches runtime types and event stream exactly.
- Minimal code surface.

Cons:
- Low-level: clients must understand `RuntimeCommand` and `RuntimeEvent` shapes.
- No namespacing for multi-run unless we add it above the runtime.

### Envelope Examples

Pause the run:
```
{ "type": "command", "command": { "type": "abort", "resumable": true } }
```

Resume the run:
```
{ "type": "command", "command": { "type": "resume", "message": "continue" } }
```

Send a message into a running node (requires runId):
```
{ "type": "command", "command": { "type": "send", "runId": "<run-id>", "message": "hello" } }
```

Agent text delta event:
```
{ "type": "event", "event": { "type": "agent:text:delta", "runId": "<run-id>", "content": "..." } }
```

## WebSocket Protocol Option B (New Hub/Channel)

Pros:
- Higher-level messages (flow:start/run:resume, etc.).
- Easier for non-TS clients if we define a stable schema.

Cons:
- Requires new architecture + docs rewrite.
- Not supported by current code; would be a separate project.

## Event Logging Policy

Verbosity mapping suggestion:
- quiet: only `flow:complete`, `node:error`, `agent:error`.
- normal: flow start/complete + agent text (streaming policy applies).
- verbose: all node/edge/state events.
- debug: everything including `command:received` and raw agent deltas.

Streaming policy:
- `--stream` (default): print `agent:text:delta` and `agent:thinking:delta` as they arrive.
- `--no-stream`: ignore deltas and print `agent:complete.result` at end.

## Pause / Resume

- Pause is `dispatch({ type: "abort", resumable: true })`.
- Resume is `dispatch({ type: "resume", message?: string })` followed by
  `runtime.run()` again.
- Clients need `runId` for `send`/`reply` (available in `node:start` and agent
  events).

## Execution Model (Single Flow, Single Run)

1) Daemon loads YAML and builds registry with built-in nodes.
2) WebSocket server starts (unless `--no-ws`).
3) Runtime starts immediately (`runtime.run(input)`).
4) WebSocket clients can connect at any time to observe events and send commands.
5) If paused, the daemon waits for a resume command and calls `runtime.run()` again.
6) When flow completes or fails, daemon exits (unless we later add a “watch” mode).

Behavioral details:
- Single run at a time; any `send/reply` without a valid runId is rejected.
- `abort` without `resumable: true` ends the run and exits.
- `abort` with `resumable: true` pauses and keeps the process alive.

## Architecture Option A (Hexagonal) — Detailed

### Boundary Diagram

```
                 +---------------------+
                 |   CLI Adapter       |
                 |  (args + input)     |
                 +----------+----------+
                            |
                            v
        +-------------------+-------------------+
        |           Flow Daemon Core            |
        |  (runtime orchestration + ports only) |
        +-----------+----------------+----------+
                    |                |
                    v                v
          +----------------+   +----------------+
          | Renderers      |   | WS Adapter     |
          | (text/json)    |   | (commands +    |
          | EventSinks     |   |  event broadcast) |
          +----------------+   +----------------+
```

### Protocol Boundaries

1) **CLI → Core**: CLI parses flags into `DaemonConfig` + input object.  
2) **Runtime → Renderers**: runtime events stream into renderer `EventSink` ports.  
3) **WS ↔ Core**: WS adapter receives `RuntimeCommand` and pushes runtime events
   using the **existing envelope**:
   `{ type: "command" | "event", command?, event? }`.

No adapter should call internal runtime methods other than:
- `runtime.dispatch(command)`
- `runtime.onEvent(listener)`
- `runtime.run(input)`

### Module Layout (Detailed)

```
packages/daemon/
  src/
    core/
      daemon.ts           # Orchestrator (wires runtime to ports)
      ports.ts            # Port interfaces + shared types
      config.ts           # DaemonConfig + defaults
      types.ts            # Domain-level types (verbosity, render mode)
    render/
      index.ts            # renderer factory
      text/
        renderer.ts       # TextRenderer implements EventSink
        format.ts         # Event -> string mapping
        filters.ts        # Verbosity + stream policy
      json/
        renderer.ts       # JsonRenderer implements EventSink
    adapters/
      cli/
        args.ts           # parse CLI -> DaemonConfig
        input.ts          # parse input JSON / file
      ws/
        server.ts         # WebSocket adapter (Bun.serve)
        protocol.ts       # envelope + validation helpers
    app/
      main.ts             # composition root (runtime + adapters)
```

### Core Types & Ports (Shape)

```ts
// core/types.ts
export type RenderMode = "text" | "json";
export type Verbosity = "quiet" | "normal" | "verbose" | "debug";
export type StreamMode = "stream" | "buffered";

// core/config.ts
export type DaemonConfig = {
  flowPath: string;
  input: Record<string, unknown>;
  render: {
    mode: RenderMode;
    verbosity: Verbosity;
    stream: StreamMode; // default: "stream"
    printJson?: boolean; // shorthand for mode = "json"
  };
  ws: {
    enabled: boolean;
    port: number;
    path: string;
  };
  exitOnComplete: boolean; // default: true
};
```

```ts
// core/ports.ts
import type { RuntimeCommand, RuntimeEvent } from "@open-harness/sdk";

export interface CommandSource {
  start(): Promise<void>;
  onCommand(handler: (cmd: RuntimeCommand) => void): void;
  stop(): Promise<void>;
}

export interface EventSink {
  start(): Promise<void>;
  handle(event: RuntimeEvent): void;
  stop(): Promise<void>;
}
```

```ts
// core/daemon.ts
export type DaemonPorts = {
  commandSource?: CommandSource;
  eventSinks: EventSink[];
};

export class FlowDaemon {
  constructor(
    private readonly runtime: Runtime,
    private readonly ports: DaemonPorts,
  ) {}

  async start(input: Record<string, unknown>) {
    for (const sink of this.ports.eventSinks) await sink.start();
    await this.ports.commandSource?.start();

    this.ports.commandSource?.onCommand((cmd) => this.runtime.dispatch(cmd));
    this.runtime.onEvent((event) => {
      for (const sink of this.ports.eventSinks) sink.handle(event);
    });

    await this.runtime.run(input);
  }

  async stop() {
    await this.ports.commandSource?.stop();
    for (const sink of this.ports.eventSinks) await sink.stop();
  }
}
```

### Renderer Abstractions

Renderers are just `EventSink` implementations with different formatting.

```ts
// render/text/filters.ts
export function allowEvent(
  event: RuntimeEvent,
  verbosity: Verbosity,
  stream: StreamMode,
): boolean {
  // map verbosity levels to event types
  // honor stream vs buffered for text deltas
  return true;
}
```

```ts
// render/text/format.ts
export function formatEvent(event: RuntimeEvent): string | null {
  switch (event.type) {
    case "flow:start":
      return `▶ flow:start ${event.flowName}`;
    case "agent:text:delta":
      return event.content;
    case "agent:complete":
      return `\n✓ agent:complete ${event.result}`;
    default:
      return null;
  }
}
```

```ts
// render/text/renderer.ts
export class TextRenderer implements EventSink {
  constructor(private readonly opts: { verbosity: Verbosity; stream: StreamMode }) {}
  async start() {}
  handle(event: RuntimeEvent) {
    if (!allowEvent(event, this.opts.verbosity, this.opts.stream)) return;
    const line = formatEvent(event);
    if (!line) return;
    process.stdout.write(line);
  }
  async stop() {}
}
```

```ts
// render/json/renderer.ts
export class JsonRenderer implements EventSink {
  async start() {}
  handle(event: RuntimeEvent) {
    process.stdout.write(JSON.stringify(event) + "\\n");
  }
  async stop() {}
}
```

### Grouped Text Rendering (Node/Agent Buckets)

We want readable, grouped output with color and logical grouping by
`nodeId`/`runId` so event sequences make sense at a glance.

#### Rendering Model

- Maintain per-run buckets keyed by `runId` (from `node:start`, agent events).
- Each bucket has a header line, then indented sub-lines for events.
- Use color per event category (flow, node, edge, agent, tool, error).
- For streaming text, keep the stream on the same bucket line; flush on
  `agent:complete` or `agent:error`.

#### ANSI Color Palette (TTY only)

```
flow events:     cyan
node start/end:  green
edge/loop:       magenta
agent text:      white
agent thinking:  dim gray
agent tool:      yellow
errors:          red
```

If `stdout` is not a TTY, strip ANSI codes automatically.

#### Grouped Output Example

```
▶ flow:start greeting-flow
  [node:a run=aa12] start
  [node:a run=aa12] output value="Hello"
  [node:b run=bb34] start
  [agent:b run=bb34] text: "Hi there, ..."
  [agent:b run=bb34] complete (tokens=123, cost=$0.02)
✓ flow:complete greeting-flow
```

#### Render State (Shape)

```ts
type RenderBucket = {
  label: string;      // "[node:id run=...]" or "[agent:id run=...]"
  isStreaming: boolean;
  buffer: string;     // streaming text buffer
};

type RenderState = Map<string, RenderBucket>; // key by runId
```

#### Event Classification (Pseudo)

```
flow:*        -> flow bucket (global)
node:*        -> bucket "node:<nodeId>/<runId>"
agent:*       -> bucket "agent:<nodeId>/<runId>"
edge:*/loop:* -> flow bucket (or edge bucket if desired)
state:patch   -> flow bucket (verbose/debug only)
```

#### Streaming vs Buffered

- stream (default): print `agent:text:delta` directly into the bucket stream.
- buffered: suppress deltas and print only on `agent:text` or `agent:complete`.

### WS Adapter (Protocol Boundary)

The WS adapter speaks the **same envelope** as `WebSocketTransport` today.
That keeps runtime semantics and avoids new protocol decisions.

```ts
// adapters/ws/protocol.ts
export type WsEnvelope =
  | { type: "event"; event: RuntimeEvent }
  | { type: "command"; command: RuntimeCommand };

export function decodeEnvelope(text: string): WsEnvelope | null { /* ... */ }
```

```ts
// adapters/ws/server.ts
export class WebSocketAdapter implements CommandSource, EventSink {
  private clients = new Set<ServerWebSocket<unknown>>();
  // start: Bun.serve + ws upgrade
  // onCommand: handler invoked when {type:"command"} received
  // handle: broadcast {type:"event"} to clients
}
```

Implementation detail:
- The adapter never calls `runtime` directly.
- It only exposes `onCommand` and `handle` so the core owns orchestration.

Rationale for a thin adapter instead of `WebSocketTransport`:
- Keeps ports/adapters clean (core owns runtime wiring).
- Avoids double-subscribing to events (transport already hooks runtime).
- Still compatible with existing clients because envelope is identical.

### Composition Root (app/main.ts)

```
1) parse CLI args -> DaemonConfig
2) load YAML -> parseFlowYaml
3) register built-in nodes
4) create runtime
5) create renderers + WS adapter
6) create FlowDaemon and start it
```

## Client Responsibilities (Go/Rust/etc.)

- Track `runId` from `node:start` or agent events.
- Use `send` / `reply` with a valid `runId`.
- Reconnect-safe: on reconnect, clients only see new events (no replay).

## Error Handling & Exit Codes

- Invalid YAML or schema: log error, exit `1`.
- Runtime exception: log error, exit `1`.
- Flow completes successfully: exit `0`.
- Abort (non-resumable): exit `2` (proposed).

## Configuration Precedence

1) CLI flags.
2) Environment variables (optional, if we add them later).
3) Defaults.

## Packaging

- Bun entrypoint (TypeScript).
- `bun build --compile` for standalone executable.

## Open Questions

- None for v1.
