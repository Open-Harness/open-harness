# factory/ - Agent and Harness Factories

Entry points for creating agents and harnesses.

## Files

| File | Purpose |
|------|---------|
| `agent-factory.ts` | `createAgent()` - Resolves agents from DI container |
| `define-harness.ts` | `defineHarness()` - Creates typed harness factories |
| `wrap-agent.ts` | `wrapAgent()` - Single-agent wrapper for quick tasks |

## Key Abstractions

- **wrapAgent(Agent)**: Quick single-agent execution. Returns `WrappedAgent` with `.run()`, `.attach()`, `.configure()`.
- **defineHarness({ agents, run })**: Multi-agent workflow factory. Returns `HarnessFactory` with `.create()`.
- **createAgent(Agent)**: Low-level DI-based resolution from container.

## Types

- **HarnessFactory<TAgents, TResult>**: Returned by `defineHarness()`. Has `.create()` → `HarnessInstance`.
- **ExecuteContext<TAgents>**: Passed to `run()` - `agents`, `emit`, `session`.
- **WrappedAgent<TInput, TOutput>**: Returned by `wrapAgent()`. Has `.run()`, `.attach()`, `.configure()`.

## Agent Requirements

Agents must implement `IAgent<TInput, TOutput>` from `@openharness/core`:
- `execute(input, callbacks?): Promise<TOutput>`
