# OpenHarness Minimal Kernel (Spike Bundle)

This folder is a **copy/paste spike**: docs + types + tiny reference implementations for the smallest OpenHarness-style kernel.

## What this kernel includes (the irreducibles)

- **Harness** orchestrates (state + control flow)
- **Unified Hub (bidirectional)** + **Events** are the backbone
  - events out: `subscribe()` / async-iteration
  - commands in: `send/sendTo/sendToRun/reply/abort`
- **Agents** execute work and can emit events
- **Channels** are **bidirectional attachments** (observe + command back)
- **Automatic context propagation** across async boundaries (AsyncLocalStorage)

## What’s intentionally NOT in the kernel

- Provider integrations (Anthropic/Gemini/OpenAI)
- Recording/replay (“mode”)
- DI container, schemas, monologues, tool runtimes

Those are layered on later.

## How to run (in this repo)

From the repo root:

```bash
bun spike-minimal-kernel/examples/simple.ts
bun spike-minimal-kernel/examples/basic.ts
bun spike-minimal-kernel/examples/inbox-injection.ts
```

## What to copy into a new spike repo

Copy the entire `spike-minimal-kernel/` folder into a fresh repo and iterate there.

