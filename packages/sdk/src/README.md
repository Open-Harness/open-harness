# Open Harness SDK - Source Reference

Provider-agnostic workflow orchestration SDK for AI agent systems.

## Directory Manifest

| Directory | Layer | Purpose |
|-----------|-------|---------|
| `infra/` | L3 - Infrastructure | DI container, event bus, tokens |
| `factory/` | L2 - Agents | Entry factories (`defineHarness`, `wrapAgent`, `createAgent`) |
| `callbacks/` | L2 - Agents | Agent callback type definitions |
| `harness/` | L1 - Orchestration | Runtime instance, channels, control flow |
| `workflow/` | Support | Task list management |
| `monologue/` | Support | Narrative generation from events |
| `utils/` | Support | Generic utilities (backoff, async queue, dependency resolver) |

## Key Exports

- `defineHarness()` - Multi-agent workflow factory
- `wrapAgent()` - Single-agent quick wrapper
- `defineChannel()` - Event consumer factory
- `createContainer()` - DI container factory
- `UnifiedEventBus` - Central event hub
- `TaskList` - Workflow progress tracker

## Related Packages

- `@openharness/core` - Core `IAgent` interface
- `@openharness/anthropic` - Claude provider implementation

See `.knowledge/docs/sdk/` for detailed documentation.
