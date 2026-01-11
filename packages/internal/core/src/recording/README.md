---
lastUpdated: "2026-01-07T18:02:01.847Z"
lastCommit: "11aecfc7541fdd64ddf13490334b15a595ad713c"
lastCommitDate: "2026-01-07T17:51:20Z"
---
# Recording

Provider-level recording and replay of streaming events. This is used for evals
and deterministic replay of provider runs.

## What's here

- **`types.ts`** — Recording, RecordedEvent, RecordingMetadata
- **`store.ts`** — RecordingStore interface
- **`memory-store.ts`** — In-memory RecordingStore
- **`normalize.ts`** — StreamEvent -> RecordedEvent helper
- **`with-recording.ts`** — ProviderTrait wrapper (live/record/replay/passthrough)

## Core Types

```ts
export type RecordingMetadata = {
  providerType: string;
  createdAt: string;
  inputHash: string; // required
  model?: string;
  tags?: string[];
};

export type RecordedEvent = {
  seq: number;
  timestamp: number;
  event: StreamEvent;
};

export type Recording<TOutput = unknown> = {
  id: string;
  metadata: RecordingMetadata;
  events: RecordedEvent[];
  output?: TOutput;
  error?: { code: string; message: string };
};
```

## Usage

### Record a provider

```ts
const store = new InMemoryRecordingStore();
const recorded = withRecording(trait, {
  mode: "record",
  store,
  getInputHash: (input) => hashInput(input),
});
```

### Replay a provider

```ts
const replay = withRecording(trait, {
  mode: "replay",
  store,
  recordingId: "rec_123",
});
```

## Notes

- Providers should emit events via `ctx.emit` (not yield).
- `inputHash` is required for deterministic replay.
- Adapters for file/sqlite stores live outside core.
