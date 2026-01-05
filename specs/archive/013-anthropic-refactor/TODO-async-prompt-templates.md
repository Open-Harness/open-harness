# TODO: Async Prompt Templates

**Status**: Future Work (Post-v1.0)

## Problem

Current prompt templates return synchronous strings, but Anthropic SDK needs async iterables for:

1. **Streaming message injection** - Add messages mid-execution
2. **Rich content** - Files, images, PDFs embedded in prompts
3. **Stop signals** - Interrupt/cancel during streaming
4. **Multi-turn interactions** - Dynamic conversation flow

## Current Architecture (Limitation)

```typescript
// Current: Synchronous string rendering
const template = createPromptTemplate("Task: {{task}}");
const prompt = template.render({ task: "..." }); // string

// Runner receives: string
await runner.run({ prompt, options, callbacks });
```

## Required Architecture

```typescript
// Future: Async iterable with rich content
const template = createPromptTemplate("Task: {{task}}");
const promptStream = template.renderStream({
  task: "...",
  files: [{ path: "./data.json", type: "application/json" }],
  images: [{ url: "https://...", alt: "diagram" }],
});

// Runner receives: AsyncIterable<MessageChunk>
await runner.run({
  promptStream, // AsyncIterable<MessageChunk>
  options,
  callbacks
});

// Mid-execution injection
promptStream.inject({
  type: "user",
  content: "Additional context..."
});

// Stop signal
promptStream.stop();
```

## Required Changes

### 1. PromptTemplate API

```typescript
export interface PromptTemplate<TData> {
  template: string;
  variables: string[];

  // Legacy (keep for simple cases)
  render(data: TData): string;

  // NEW: Streaming with rich content
  renderStream(data: TData & {
    files?: FileAttachment[];
    images?: ImageAttachment[];
  }): AsyncIterablePromptStream;
}

export interface AsyncIterablePromptStream extends AsyncIterable<MessageChunk> {
  inject(chunk: MessageChunk): void;
  stop(): void;
}
```

### 2. Runner Interface Update

```typescript
export interface IAgentRunner {
  run(args: {
    prompt: string | AsyncIterable<MessageChunk>; // Support both
    options: GenericRunnerOptions;
    callbacks?: RunnerCallbacks;
  }): Promise<GenericMessage | undefined>;
}
```

### 3. Message Chunk Types

```typescript
export type MessageChunk =
  | TextChunk
  | FileChunk
  | ImageChunk
  | StopSignal;

export interface FileAttachment {
  path?: string;
  url?: string;
  content?: Uint8Array;
  mimeType: string;
  filename: string;
}

export interface ImageAttachment {
  path?: string;
  url?: string;
  base64?: string;
  mimeType: string;
  alt?: string;
}
```

## Migration Path

### Phase 1: Add Async Support (Backward Compatible)
- Keep `render()` for simple cases
- Add `renderStream()` for advanced cases
- Runner checks `typeof prompt === 'string'` vs async iterable

### Phase 2: Rich Content Support
- File attachments
- Image attachments
- PDF parsing

### Phase 3: Interactive Streaming
- Message injection
- Stop signals
- Multi-turn within single execution

## Impact on Providers

All provider packages need updates:

**Anthropic** - Native async iterable support in Claude Agent SDK
**Gemini** - Convert to Google Generative AI streaming format
**Codex** - Convert to their streaming API
**OpenCode** - Convert to their streaming API

## References

- Anthropic SDK: Async iterable message injection
- Google Generative AI: `streamGenerateContent()`
- Multi-modal prompting patterns

## Priority

**Medium** - Not blocking v1.0, but important for advanced use cases:
- RAG applications (file context)
- Vision tasks (image analysis)
- Interactive agents (human-in-the-loop)
- Long-running workflows (cancellation)

## Related Work

- [ ] SDK: Update IAgentRunner interface
- [ ] Anthropic: Implement async prompt rendering
- [ ] Provider Guide: Document async pattern
- [ ] Examples: Show file/image attachment usage
