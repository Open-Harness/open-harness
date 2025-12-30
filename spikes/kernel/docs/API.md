# Minimal Kernel API (Spike)

This is the minimal public contract we want to preserve while rebuilding internals.

## defineHarness

```ts
const Workflow = defineHarness({
  name: "my-workflow",
  agents: { planner: PlannerAgent, coder: CodingAgent },
  state: (input) => ({ /* mutable state */ }),
  run: async ({ agents, state, phase, task, hub, session }) => {
    await phase("Planning", async () => {
      await task("plan", async () => {
        return await agents.planner.execute({ prd: "Build TODO app" });
      });
    });
    return { ok: true };
  },
});

await Workflow.create({}).attach(clackLikeChannel()).startSession().run();
```

### Instance methods

- `attach(attachment)` — attach a channel / adapter (attachment gets the hub)
- `startSession()` — enables command handling (send/reply/abort)
- `run()` — executes and returns `{ result, state, events, durationMs, status }`

## Hub (unified, bidirectional)

The harness instance **is** the hub.

### Events out

- `subscribe(listener)` or `subscribe(filter, listener)`
- `for await (const e of hub) { ... }` (async iteration)

### Events in (from harness/agents/workflow)

- `emit(event, contextOverride?)`
- `scoped(contextPatch, fn)` (AsyncLocalStorage-based automatic context propagation)
- `current()` (read inherited context)

### Commands in (from channels)

- `send(message)`
- `sendTo(agentName, message)`
- `sendToRun(runId, message)` (correct when multiple runs of same agent are active)
- `reply(promptId, { content, choice?, timestamp })`
- `abort(reason?)`

## defineChannel

Channels are attachments with state + pattern matching:

```ts
const channel = defineChannel({
  name: "ClackLike",
  state: () => ({ tasks: 0 }),
  onStart: ({ state }) => { /* init */ },
  on: {
    "phase:start": ({ event }) => { /* render */ },
    "task:*": ({ state }) => { state.tasks++; },
  },
  onComplete: ({ state }) => { /* cleanup */ },
});
```

## Agents

Kernel-level contract (registered with `defineHarness({ agents })`):

```ts
export interface AgentDefinition<TIn, TOut> {
  name: string;
  execute(input: TIn, ctx: { hub: Hub; inbox: AgentInbox }): Promise<TOut>;
}
```

### Agent prompt/message injection (Anthropic-style)

This is the minimal kernel hook that enables “send messages into a running agent”:

- A channel calls `hub.sendTo("Coder", "continue, but do X")`
- The harness routes that into the agent’s `inbox`
- A provider wrapper can forward inbox messages into the underlying SDK session while streaming.

If multiple runs of the same agent can be active concurrently, channels should target a specific run:

- listen for `agent:start` events to get `runId`
- call `hub.sendToRun(runId, message)`

Workflow runtime sees:

```ts
export interface ExecutableAgent<TIn, TOut> {
  name: string;
  execute(input: TIn): Promise<TOut>;
}
```
