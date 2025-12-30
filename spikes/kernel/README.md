# OpenHarness Minimal Kernel (Legacy Spike)

**⚠️ Legacy spike - canonical docs now live in `spikes/kernel-v2/`**

This folder is kept as reference material. All canonical documentation and protocol definitions now live in:
- **`spikes/kernel-v2/docs/README.md`** - canonical spec entrypoint
- **`spikes/kernel-v2/src/protocol/`** - protocol types

This legacy spike (`spikes/kernel/`) contains:
- Original spike implementation (for reference)
- Legacy docs (deprecated, see v2 for canonical)

## What this kernel includes (the irreducibles)

- **Harness** orchestrates (state + control flow)
- **Unified Hub (bidirectional)** + **Events** are the backbone
  - events out: `subscribe()` / async-iteration
  - commands in: `send/sendTo/sendToRun/reply/abort`
- **Agents** execute work and can emit events
- **Channels** are **bidirectional attachments** (observe + command back)
- **Automatic context propagation** across async boundaries (AsyncLocalStorage)

## What’s intentionally NOT in the kernel

- Provider integrations (Anthropic/Gemini/OpenAI) as *core* dependencies
- Recording/replay (“mode”)
- DI container, schemas, monologues, tool runtimes

Those are layered on later.

This spike includes a **minimal Anthropic adapter** as a reference provider integration (`src/anthropic.ts`),
but it’s intentionally “bolt-on” and not required to understand the kernel.

## How to run (in this repo)

From the repo root:

```bash
bun spikes/kernel/examples/simple.ts
bun spikes/kernel/examples/basic.ts
bun spikes/kernel/examples/inbox-injection.ts

# YAML flow (DAG) demo:
bun spikes/kernel/examples/run-yaml-workflow.ts
```

## What to copy into a new spike repo

Copy the entire `spikes/kernel/` folder into a fresh repo and iterate there.

