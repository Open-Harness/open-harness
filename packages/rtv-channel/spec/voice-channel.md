# Voice Channel (Realtime) — Spec

This document specifies the **Realtime Voice Channel** as an attachment to the Hub. It is a transport channel (not a node) that bridges OpenAI Realtime audio to hub events/commands. The **strategy and state model** are defined in `src/spec/voice-channel-architecture.md`.

## Scope

- Channel attaches to a Hub and **emits voice events**.
- Channel listens for **voice commands** and maps them to Realtime API calls.
- Channel is UI-agnostic; UI channels can subscribe to voice events.
- Events are **extension events** and do not modify the kernel protocol.

## Attachment contract

```ts
import type { Attachment } from "../channel/types";

export type RealtimeVoiceChannelConfig = {
  apiKey: string;
  model: string;
  voice: string;
  useLocalMic?: boolean;
  useLocalSpeaker?: boolean;
  errorLogPath?: string;
  logLevel?: string;
  wsUrl?: string;
};

export function createRealtimeVoiceChannel(
  config: RealtimeVoiceChannelConfig
): Attachment;
```

## Event/command schema

See `src/spec/voice-events.md` (local extension schema).

## Behavior (high level)

### Push-to-talk (MVP)
- `voice:input:start` clears input buffer and opens a user turn.
- `voice:input:audio` appends audio frames (pcm16le).
- `voice:input:commit` commits the buffer and triggers a response.
 
### Conversation (VAD)
Not supported by this channel in MVP. The transport service supports it, but the channel does not expose mode switching.

## Deployment notes

- `useLocalMic` (default `false` in channel) controls whether the channel uses `sox` to capture audio locally.
- `useLocalSpeaker` (default `false` in channel) controls whether the channel plays audio via `sox`.
- When `useLocalMic` is `false`, external audio **must** be provided via `voice:input:audio`.
