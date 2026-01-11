---
title: "Provider Traits"
lastUpdated: "2026-01-07T17:21:42.054Z"
lastCommit: "c4e0a85f68ac9590e27fe95b778371ac12a29b3f"
lastCommitDate: "2026-01-07T16:37:37Z"
scope:
  - providers
  - traits
  - streaming
---

# Providers

Defines the core provider abstraction used by Open Harness. Providers are pure:
they only depend on input data and a minimal execution context (signal + emit).

## What's here

- **`trait.ts`** — `ProviderTrait<TInput, TOutput>` interface
- **`context.ts`** — Minimal `ExecutionContext` (AbortSignal + emit)
- **`events.ts`** — Provider-agnostic `StreamEvent` types
- **`errors.ts`** — `ProviderError` and helpers
- **`adapter.ts`** — `toNodeDefinition` adapter to integrate with runtime
- **`index.ts`** — Exports

## ProviderTrait

Providers implement an async generator that yields streaming events and returns
the final output. They should be runtime-agnostic and side-effect free beyond
their own SDK calls.

```ts
const myProvider: ProviderTrait<MyInput, MyOutput> = {
  type: "my.agent",
  displayName: "My Provider",
  capabilities: { streaming: true, structuredOutput: false },
  inputSchema: MyInputSchema,
  outputSchema: MyOutputSchema,
  async *execute(input, ctx) {
    ctx.emit({ type: "text", content: "hello", delta: true });
    return { text: "hello" };
  },
};
```

## ExecutionContext

Providers only receive:

- `signal`: `AbortSignal` for pause/stop/timeout
- `emit`: function to emit `StreamEvent` items

Providers should check `signal.aborted` and exit early if needed.

## Stream Events

`StreamEvent` is a provider-agnostic event model:

- `text` / `thinking` (with optional `delta`)
- `tool` (start/complete with payloads)
- `error` (emitted before throwing if desired)

The adapter converts these into runtime `agent:*` events.

## Adapter Integration

Use `toNodeDefinition()` to convert a provider trait into a runtime node:

```ts
import { toNodeDefinition } from "@internal/core/providers";

const node = toNodeDefinition(myProvider);
registry.register(node);
```

The adapter:
- Validates input/output via Zod
- Maps `StreamEvent` to runtime events
- Handles aborts and wraps failures as `ProviderError`

## Session & Resume

Pause/resume is handled at the workflow/runtime layer. Providers should:

- Accept a `sessionId` in their input schema (if supported)
- Return a `sessionId` in their output

No `inbox` or `resumeMessage` exists in the provider context.

## See Also

- `../nodes/README.md` — Node contracts
- `../runtime/execution/README.md` — Runtime orchestration
