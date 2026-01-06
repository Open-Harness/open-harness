# @open-harness/ai-sdk

Vercel AI SDK adapter for Open Harness React integration.

## Purpose

Bridges Open Harness runtime events with Vercel AI SDK's `useChat()` hook. Transforms Open Harness runtime events into AI SDK message chunks, enabling seamless React integration.

## Key Files

- **`src/transport.ts`** - `OpenHarnessChatTransport` class
  - Implements AI SDK `ChatTransport<UIMessage>` interface
  - `sendMessages()` - Main entry point, returns `ReadableStream<UIMessageChunk>`
  - Subscribes to runtime events and transforms them to chunks
  - Handles stream lifecycle (start, enqueue, close)
  - Supports abort signals for cancellation

- **`src/transforms.ts`** - Event transformation logic
  - `transformEvent()` - Routes events to specific transformers
  - `transformTextEvent()` - Text deltas → text-start, text-delta, text-end
  - `transformReasoningEvent()` - Thinking events → reasoning parts
  - `transformToolEvent()` - Tool events → tool-call, tool-result chunks
  - `transformStepEvent()` - Step events → custom data parts
  - `transformErrorEvent()` - Error events → error chunks
  - `createPartTracker()` - Tracks text start/end state

- **`src/types.ts`** - Type definitions
  - `OpenHarnessChatTransportOptions` - Configuration options
  - `PartTracker` - State tracking for text parts
  - Custom data types for flow metadata and node outputs

- **`scripts/capture-runtime-events.ts`** - Fixture generation script
  - Replays fixtures through runtime to capture events
  - Used to generate test fixtures from real SDK interactions

## Usage

```typescript
import { OpenHarnessChatTransport } from "@open-harness/ai-sdk";
import { useChat } from "@ai-sdk/react";
import { createHarness } from "@open-harness/sdk";

const harness = createHarness({ flow });
const transport = new OpenHarnessChatTransport(harness.runtime, {
  sendReasoning: true,
  sendStepMarkers: true,
});

function Chat() {
  const { messages, input, handleSubmit } = useChat({
    transport,
  });
  // ...
}
```

## Features

- **Text Streaming** - Transforms text deltas to AI SDK text chunks
- **Reasoning Support** - Optional thinking/reasoning parts
- **Tool Integration** - Tool calls and results as AI SDK chunks
- **Step Markers** - Optional node execution markers
- **Custom Data** - Flow metadata and node outputs as custom data parts
- **Error Handling** - Transforms errors to error chunks

## Dependencies

- `@open-harness/sdk` - Runtime and event types
- `@open-harness/provider-anthropic` - For fixture generation script
- `ai` - Vercel AI SDK types
