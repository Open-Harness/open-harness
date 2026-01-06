# Voice Channel

This folder contains the channel implementations for RTV. A **channel** is a bidirectional attachment to the Hub: it listens to events, maintains local state, and emits commands back to the Hub. Channels are interfaces to a running workflow; they do not execute flow logic themselves.

## What This Implements

- **RealtimeVoiceChannel**: transport channel that bridges OpenAI Realtime to `voice:*` events and commands.
- **ConsoleVoiceChannel**: UI channel that renders a TUI from `voice:*` events and sends `voice:*` commands (push‑to‑talk only).

## Architecture Summary

The voice channel pair splits responsibilities:

- **Transport channel** handles realtime audio exchange.
- **UI channel** renders state and emits user commands.

Both communicate only through the Hub using `voice:*` extension events.

## Event and Command Surface

Events out (channel → hub), defined in `spec/voice-events.md`:
- `voice:connected`, `voice:disconnected`
- `voice:status`
- `voice:transcript`, `voice:assistant_text`, `voice:assistant_audio`
- `voice:mic_level`, `voice:spk_level`
- `voice:notice`, `voice:error`, `voice:event`

Commands in (hub → channel):
- `voice:input:start`
- `voice:input:audio`
- `voice:input:commit`
- `voice:response:cancel`
- `voice:shutdown`

Note: MVP is **push‑to‑talk only**. VAD exists in the transport class but is not exposed by the channel.

## State Strategy (MVP)

The channel maintains a **curated view** rather than a raw event stream:

- pinned facts (run, phase, active agent)
- recent window (last N relevant events)
- rolling summary when the window overflows

The canonical state proposal lives in `spec/voice-channel-architecture.md`.

## Usage

Attach both channels to a Hub:

```ts
import { createRealtimeVoiceChannel, createConsoleVoiceChannel } from "../index";

hub.attach(
  createRealtimeVoiceChannel({ apiKey, model, voice })
);
hub.attach(createConsoleVoiceChannel());
```

## Testing

Testing strategy and full manifest:

- `spec/voice-channel-implementation-manifest.md`
- `spec/channel-tutorial.md`

## Extending

To build your own channel:

1. Subscribe to the events you need (`phase:*`, `task:*`, `agent:*`, `voice:*`).
2. Maintain a reducer‑driven state model.
3. Emit explicit commands back to the Hub.

Keep channels deterministic and push‑to‑talk in MVP.
