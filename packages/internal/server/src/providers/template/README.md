---
title: "Template Provider"
lastUpdated: "2026-01-07T22:18:31.996Z"
lastCommit: "d4126c594067066e6e97863fc212aba2aba00566"
lastCommitDate: "2026-01-07T19:33:33Z"
scope:
  - providers
  - templates
  - documentation
---

# Template Provider

Demo provider implementation that illustrates the minimal contract every provider must satisfy.

## Purpose

- Show how to build a provider that validates inputs/outputs via Zod.
- Emit streaming events and structured tool signals.
- Expose a session-aware output for pause and resume.
- Serve as a template for real AI providers and reference implementations such as Claude/OpenCode.

## Key Concepts

1. **Input/Output schemas** – `TemplateProviderInputSchema`/`TemplateProviderOutputSchema` clearly document the fields and types.
2. **Default responder** – `createTemplateProvider()` ships with a lightweight `defaultResponder` that normalizes the prompt, derives sentiment, and returns a session token.
3. **Streaming events** – The provider emits a `thinking` delta, two `text` deltas (partial and final), and a `tool` completion event with a structured summary payload.
4. **Session-aware output** – Each run returns a `sessionId` that can be forwarded to `withRecording()` or runtime pause/resume flows.

## Usage

```ts
import { createTemplateProvider } from "@internal/server";
import { InMemoryRecordingStore, withRecording } from "@internal/core/recording";

const provider = createTemplateProvider();
const recorded = withRecording(provider, {
  mode: "record",
  store: new InMemoryRecordingStore(),
  getInputHash: (input) => `template-${input.prompt}`,
});
```

## Customizing behavior

```ts
import { createTemplateProvider, type TemplateResponder } from "@internal/server";

const customResponder: TemplateResponder = async ({ prompt, metadata }) => {
  return {
    text: prompt.toUpperCase(),
    summary: `Processed ${prompt.length} characters`,
    sentiment: "neutral",
    sessionId: metadata?.sessionId ?? "template-special",
  };
};

const provider = createTemplateProvider({ responder: customResponder });
```

## Integration tips

- Wrap `createTemplateProvider()` in `withRecording()` when you need deterministic recordings for evals.
- Use the emitted `tool` event (`name: "template.summary"`) to attach downstream tooling that consumes structured summaries/sentiment.
- Exported types such as `TemplateProviderInput`/`TemplateProviderOutput` can be reused by connectors and tests.

## Testing

- Reuse the provider in `packages/open-harness/server/tests` to ensure the event sequence and output shape match expectations.
- Mock `TemplateResponder` to simulate SDK responses without calling real endpoints.
