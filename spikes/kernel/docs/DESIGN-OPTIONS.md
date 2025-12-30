# Kernel Design Options (work backwards from the API)

All options preserve the consumer-facing harness shape:

```ts
await Workflow.create(input).attach(channel).run();
```

## Option A (recommended): Harness owns one EventBus; Transport is a façade over it

- **One canonical bus** (enveloped events + context)
- Harness exposes a `Transport` that:
  - delegates `subscribe()` to the same bus
  - provides command hooks (`send/reply/abort`) for session mode

**Why it wins**: smallest surface area; least glue; fewer “adapter layers”.

## Option B: Explicit Runtime object (bus + agent registry + harness runner)

```ts
const runtime = createRuntime();
await runtime.harness(Workflow, input).attach(channel).run();
```

**Why**: makes composition/testing easier (multiple harnesses share a runtime).
**Cost**: slightly heavier public API.

## Option C: Channels are first-class “Plugins”

Channels get a richer setup API and can register derived events, commands, etc.

**Why**: ecosystem-friendly.
**Cost**: heavier, not minimal.

## Recommendation for the spike

Spike **Option A** first. If we feel pain around “global-ish runtime state”, we can evolve to Option B later without breaking end users.


```sequence
participant Channel
participant Hub as HarnessHub (unified)
participant Mailbox as runMailbox[runId]
participant Agent as AgentDefinition.execute()
participant Provider as "Anthropic SDK wrapper (future)"

Note over Agent: Agent is already running (streaming)
Note over Hub: Hub knows active runId from agent:start event

Channel -> Hub: sendToRun(runId, "do X")
Hub -> Hub: emit session:message {runId, content}
Hub -> Mailbox: push({content, timestamp})

Note over Agent: Agent code/provider wrapper consumes inbox concurrently
Provider -> Mailbox: for await (msg of inbox) / await inbox.pop()
Mailbox --> Provider: InjectedMessage {content, timestamp}
Provider -> Provider: forward msg into Anthropic session input
Provider --> Agent: (agent continues streaming with new guidance)
```