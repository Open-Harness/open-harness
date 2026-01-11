# Architecture (Hexagonal, v1)

This document defines the internal architecture for the flow daemon.
It is a single-flow, single-run, long-lived process that exposes a WebSocket
command/event stream and writes grouped logs to stdout.

## Goals

- Clean separation between runtime orchestration, rendering, and IO adapters.
- Stable protocol boundary for non-TS clients (Go/Rust/etc.).
- Simple v1 surface, easy to extend later (SQLite, multi-run, new protocols).

## Non-Goals (v1)

- Multi-flow service.
- Concurrent runs.
- Persistence/resume across process restarts.
- New protocol beyond the existing runtime envelope.

## High-Level Diagram

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

## Core Responsibilities

The core owns all runtime wiring and lifecycle:

- Construct runtime from parsed YAML + built-in registry.
- Subscribe to runtime events and fan out to EventSinks.
- Accept RuntimeCommand from CommandSource and dispatch to runtime.
- Start/stop lifecycle of ports.

No adapter calls runtime directly.

## Ports (Interfaces)

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

## Core Orchestrator

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

## Module Layout (Detailed)

```
packages/daemon/
  src/
    core/
      daemon.ts           # orchestrator (runtime wiring)
      ports.ts            # port interfaces
      config.ts           # DaemonConfig + defaults
      types.ts            # verbosity/render types
    render/
      index.ts            # renderer factory
      text/
        renderer.ts       # grouped text renderer
        format.ts         # event -> string mapping
        filters.ts        # verbosity + stream policy
      json/
        renderer.ts       # JSONL renderer
    adapters/
      cli/
        args.ts           # parse CLI -> config
        input.ts          # parse input JSON/file
      ws/
        server.ts         # Bun.serve + WS adapter
        protocol.ts       # envelope encode/decode
    app/
      main.ts             # composition root
```

## Protocol Boundaries

1) **CLI → Core**: CLI returns `DaemonConfig` + flow input.
2) **Runtime → Renderers**: RuntimeEvent is the only event stream.
3) **WS ↔ Core**: WS adapter uses the runtime envelope (command/event).

The daemon does not introduce new runtime event types in v1.

## Execution Flow

```
main.ts
  -> parse CLI
  -> load YAML
  -> create runtime
  -> create renderers + ws adapter
  -> FlowDaemon.start(input)
     -> start ports
     -> runtime.onEvent -> sinks
     -> runtime.run(input)
     -> exit
```

## Error Boundaries

- YAML validation failures stop the daemon before runtime starts.
- Runtime errors stop the daemon and exit with non-zero status.
- WS adapter errors are logged; server stays up unless fatal.

## Extensibility

This layout allows adding:
- SQLite persistence by swapping store in runtime creation.
- Additional renderers (SSE, file logs).
- New protocols by adding a new CommandSource/EventSink adapter.

