# Why Open Harness?

## The World Changed

You don't write code anymore. You read it.

AI writes your code now. Your job is to **understand** it, **direct** it, and **own** it. This changes everything about how developer tools should be built.

Open Harness is built for this new world. It's an SDK designed to be **read**, not just written. Your entire agent workflow fits in one file you can actually understand.

---

## The Problem

The Claude Agent SDK is incredible - it powers Claude Code itself. But it's **low-level**. Building production agents means:

- Wrestling with async generators and tool call parsing
- Managing DI containers and event subscriptions  
- Writing infrastructure instead of business logic
- Code that sprawls across files and abstractions

You spend more time on plumbing than ideas.

---

## The Solution

Open Harness gives you **three primitives**:

```
┌─────────────────────────────────────────────┐
│                 HARNESS                      │
│         (Orchestrates everything)            │
│                                              │
│    ┌─────────┐           ┌─────────┐        │
│    │  AGENT  │  ←─────→  │  AGENT  │        │
│    └─────────┘           └─────────┘        │
│                                              │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
            ┌─────────────┐
            │  TRANSPORT  │  → Console, WebSocket, 
            └─────────────┘    Metrics, Slack, ...
```

**Agent**: A unit of AI behavior. Typed inputs, typed outputs. Provider-agnostic.

**Harness**: The orchestration layer. Composes agents, manages state, provides helpers (retry, parallel, phases). Your business logic lives here.

**Transport**: Where events go. Plug in any output destination. Console logging, WebSocket streaming, metrics collection - the community builds these.

That's it. Three concepts. Everything else is composition.

---

## What It Looks Like

```typescript
import { defineHarness, CodingAgent, ReviewAgent } from '@openharness/sdk'
import { consoleTransport } from '@openharness/transports'

const CodeReview = defineHarness({
  agents: { coder: CodingAgent, reviewer: ReviewAgent },
  
  run: async ({ agents, phase }) => {
    const code = await phase('Build', () => 
      agents.coder.execute('Create a REST API')
    )
    
    const review = await phase('Review', () => 
      agents.reviewer.review(code)
    )
    
    return { code, review }
  }
})

await CodeReview.create()
  .attach(consoleTransport())
  .run()
```

That's a complete multi-agent workflow with progress tracking and beautiful terminal output. **One file. Forty lines. Actually readable.**

---

## The Philosophy

**Simplicity scales.**

- Simple to read → Easier to understand what AI wrote for you
- Simple to extend → Anyone can write a transport
- Simple to distribute → Ships as a Claude Code skill
- Simple to run → Managed compute, zero DevOps

We're not building complexity. We're building **leverage**.

---

## Who This Is For

**If you're building with the Anthropic Agent SDK** → You'll ship faster.

**If you're using Claude Code** → You'll have a skill that builds agents for you.

**If you just have an idea** → Whiteboard it, describe it to Claude, run it.

The code you read should be as clear as the idea you started with.

---

## Get Started

```bash
npm install @openharness/sdk @openharness/transports
```

→ [Quickstart Guide](./QUICKSTART.md)  
→ [Core Concepts](./docs/concepts/)  
→ [Examples](./examples/)

---

*Simplicity scales. Let's build.*
