# Channel Protocol

Channels are bidirectional adapters/attachments that observe events and send commands.

## Attachment contract

```typescript
type Attachment = (hub: Hub) => Cleanup;

type Cleanup = void | (() => void) | (() => Promise<void>);
```

An attachment:
1. Receives the hub
2. Can subscribe to events
3. Can send commands (`hub.send()`, `hub.reply()`, etc.)
4. Optionally returns a cleanup function

## defineChannel helper

For convenience, channels can be defined declaratively:

```typescript
const channel = defineChannel({
  name: "ConsoleChannel",
  state: () => ({ tasks: 0 }),
  onStart: ({ hub, state, emit }) => { /* init */ },
  on: {
    "phase:start": ({ event }) => { /* render */ },
    "task:*": ({ state }) => { state.tasks++; },
    "agent:text": ({ event }) => { process.stdout.write(event.content); },
  },
  onComplete: ({ hub, state, emit }) => { /* cleanup */ },
});
```

### ChannelDefinition

```typescript
interface ChannelDefinition<TState> {
  name: string;
  state?: () => TState;
  onStart?: (ctx: { hub: Hub; state: TState; emit: (event: BaseEvent) => void }) => void | Promise<void>;
  onComplete?: (ctx: { hub: Hub; state: TState; emit: (event: BaseEvent) => void }) => void | Promise<void>;
  on: Record<string, ChannelHandler<TState>>;
}

type ChannelHandler<TState> = (ctx: ChannelContext<TState>) => void | Promise<void>;

interface ChannelContext<TState> {
  hub: Hub;
  state: TState;
  event: EnrichedEvent<BaseEvent>;
  emit: (event: BaseEvent) => void;
}
```

## Recommended patterns

### Console channel

- Subscribe to `agent:text` and write to stdout
- Subscribe to `task:*` for progress indicators
- Can call `hub.send()` to inject user input (if interactive)

### WebSocket channel

- Subscribe to all events and forward to connected clients
- Listen for `session:prompt` and forward to UI
- Receive user input from WebSocket and call `hub.reply()` or `hub.send()`

### Voice channel (e.g., ElevenLabs)

- Subscribe to `agent:text` and convert to audio
- Listen for user audio and call `hub.send()` or `hub.sendToRun(runId, ...)`
- **Note**: Realtime voice is typically a **transport** (channel), not a node

## Key invariants

1. **Channels are pure attachments** - they attach to hub, subscribe, and optionally return cleanup
2. **Channels observe events** - they never "print directly" without subscribing to hub events
3. **Channels can send commands** - via `hub.send()`, `hub.reply()`, `hub.abort()`, etc.
