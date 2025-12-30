# Harness Protocol

The Harness orchestrates execution and owns the runtime session.

## Factory

```typescript
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
```

## Instance methods

### `create(input)`

Create a harness instance. Returns a `HarnessInstance` that is also a `Hub`.

### `attach(attachment)`

Attach a channel/adapter. The attachment receives the hub and can subscribe/command.

### `startSession()`

Enable interactive command handling (send/reply/abort). Returns `this` for chaining.

### `run()`

Execute the harness and return:

```typescript
interface HarnessResult<TState, TResult> {
  result: TResult;
  state: TState;
  events: EnrichedEvent[];
  durationMs: number;
  status: HubStatus;
}
```

## Execute context

Inside `run`, the harness provides:

```typescript
interface ExecuteContext<TAgentDefs, TState> {
  agents: ExecutableAgents<TAgentDefs>;
  state: TState;
  hub: Hub;
  phase: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
  task: <T>(id: string, fn: () => Promise<T>) => Promise<T>;
  emit: (event: BaseEvent) => void;
  session?: SessionContext;  // present only when startSession() called
}
```

### `phase(name, fn)`

Structured grouping that emits `phase:start` / `phase:complete` / `phase:failed`. Automatically propagates context via `hub.scoped({ phase: { name } }, fn)`.

### `task(id, fn)`

Structured work unit that emits `task:start` / `task:complete` / `task:failed`. Automatically propagates context via `hub.scoped({ task: { id } }, fn)`.

### `session` (optional)

Present only when `startSession()` was called:

```typescript
interface SessionContext {
  waitForUser(prompt: string, options?: { choices?: string[]; allowText?: boolean }): Promise<UserResponse>;
  hasMessages(): boolean;
  readMessages(): Array<{ content: string; agent?: string; timestamp: Date }>;
  isAborted(): boolean;
}
```

## Inbox routing

The harness routes `hub.sendToRun(runId, message)` into the appropriate agent's inbox:

- When an agent starts, the harness registers a mailbox for that `runId`
- Channels can listen for `agent:start` to get the `runId`, then call `hub.sendToRun(runId, message)`
- The harness routes the message into the agent's `AgentInbox`

## Key invariants

1. **Harness owns state** - state is mutable and owned by the harness instance
2. **Harness owns run lifecycle** - it emits `harness:start` / `harness:complete`
3. **Harness provides inbox routing** - it maps `runId` to agent mailboxes
4. **Harness instance is a Hub** - it extends `Hub` and provides all hub methods
