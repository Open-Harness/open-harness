# harness/ - Runtime Orchestration Layer

Runtime execution, event channels, and control flow helpers.

## Files

| File | Purpose |
|------|---------|
| `harness-instance.ts` | `HarnessInstance` - Runtime execution context |
| `define-channel.ts` | `defineChannel()` / `createChannel()` - Event consumers |
| `session-context.ts` | `SessionContext` - Interactive session support |
| `control-flow.ts` | `parallel()` / `retry()` - Orchestration helpers |
| `event-types.ts` | Event type definitions and type guards |
| `event-context.ts` | Context types (session, phase, task, agent) |
| `render-output.ts` | `RenderOutput` - Terminal output helpers |

## Key Abstractions

- **HarnessInstance**: Created by `defineHarness().create()`. Methods: `attach()`, `startSession()`, `run()`, `subscribe()`, `reply()`.
- **Channel**: Event consumer via `defineChannel()`. Has state, pattern-matched handlers, optional transport commands.
- **ChannelContext**: Passed to handlers - `state`, `event`, `emit`, `config`, `output`, `transport`.
- **RenderOutput**: Terminal helpers - `line()`, `success()`, `error()`, `warning()`, `info()`, `dim()`.

## Control Flow

- `parallel(items, fn, opts)` - Concurrent execution with configurable concurrency
- `retry(fn, opts)` - Resilient execution with exponential backoff

## Event Categories

| Category | Events |
|----------|--------|
| Task | `task:start`, `task:complete`, `task:failed` |
| Phase | `phase:start`, `phase:complete` |
| Agent | `agent:start`, `agent:complete`, `agent:text`, `agent:thinking` |
| Session | `session:prompt`, `session:reply`, `session:abort` |
| Parallel | `parallel:start`, `parallel:item:complete`, `parallel:complete` |
| Retry | `retry:start`, `retry:attempt`, `retry:backoff`, `retry:success`, `retry:failure` |
