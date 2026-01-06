# Voice Channel (Realtime) — Architecture & Strategy

This document captures the **strategy, buffering, and state model** for the voice channel. It complements `src/spec/voice-channel.md` and is intended to be copied into the monorepo package docs.

## Purpose

Provide a **generic voice UI channel** that can attach to the Hub and:
- stream audio to/from OpenAI Realtime,
- emit normalized events to the hub,
- accept commands from UI or other channels,
- avoid flooding the model with raw event bus traffic.

## Core principles

1. **Channel is an attachment**, not a node.
2. **No raw bus feed** into the model.
3. **Curated view** is derived from a reduced event stream.
4. **Commands are explicit** (no ambiguous side effects).

---

## Proposed State (Curated View)

This is the internal state the voice channel maintains (not raw bus).

```ts
type VoiceChannelState = {
  mode: "push-to-talk" | "conversation";

  run: {
    id: string | null;
    phase: string | null;
    status: "idle" | "running" | "paused";
  };

  activeAgent: { id: string; name: string; role?: string } | null;

  agents: Array<{ id: string; name: string; role?: string; status?: string }>;

  tasks: Array<{ id: string; label: string; state: "pending" | "running" | "done" }>;

  lastUserUtterance?: string;
  lastAgentUtterance?: string;

  summary?: string;         // rolling abstract
  recent: Array<{ ts: string; type: string; text?: string }>; // filtered window

  audio: {
    micLevel: number;
    spkLevel: number;
    lastPacketAt?: string;
  };

  session: {
    connected: boolean;
    responseInProgress: boolean;
    lastError?: { code?: string; message?: string; param?: string };
  };
};
```

This curated view is **what the UI and tools see**, not the raw bus.

---

## Buffering & Reduction Strategy

The channel **buffers a filtered window** and **maintains a rolling summary**:

1) **Recent window**  
Keep only the last N events (e.g., 50) of *selected types*:
- `phase:*`, `task:*`, `agent:text`, `agent:thinking`, `session:*`
- ignore high‑volume low‑value events (audio deltas, transport heartbeats).

2) **Pinned facts**  
Store stable state keys (active agent, phase, run ID, last task).

3) **Rolling summary**  
When the window overflows, update `summary` with a condensed abstract.

This keeps the context **compact and relevant** without raw event noise.

---

## Event Filtering Policy

**Subscribe to**:
- `phase:*`, `task:*`, `agent:*`, `session:*`, `voice:*`

**Ignore by default**:
- raw audio delta events
- transport noise events
- duplicate status spam

**Normalize into**:
`VoiceChannelState.recent` + `VoiceChannelState.summary`

---

## Command/Tool Policy

The voice channel should expose **explicit commands** only:

- `voice:mode:set`
- `voice:input:start`
- `voice:input:audio`
- `voice:input:commit`
- `voice:response:cancel`
- `voice:shutdown`

Rules:
1) **No implicit side effects**: commands must be explicit.
2) **Rate limits** for repeated cancel/commit (optional).
3) **Confirmation** for destructive actions (optional).

---

## Mode Behavior (MVP)

### Push-to-talk only
- User UI sends `voice:input:start` then `voice:input:audio` frames.
- `voice:input:commit` triggers response.

> **Future**: Conversation/VAD mode can be added in the transport, but the channel does not expose it in MVP.

---

## Failure Modes & Recovery

- **Missing audio device** → emit `voice:error`, keep session alive.
- **WS disconnect** → emit `voice:disconnected`, allow reconnect on next `start`.
- **Empty commit** → emit `voice:notice` (warn), do not crash.

---

## Integration with Hub

The channel communicates **only** via the Hub:
- UI channels subscribe to `voice:*`
- UI channels send `voice:*` commands

No direct coupling between UI and transport.

---

## Implementation Notes (Option A)

- `RealtimeService` remains the core transport.
- `RealtimeVoiceChannel` adapts Hub events → service calls.
- `useLocalMic` is `false` by default in channel context.
- `voice-events` are **extension events** and remain package-local.
