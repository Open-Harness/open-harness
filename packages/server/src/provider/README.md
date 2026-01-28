# Provider Anthropic Source

Anthropic provider implementation.

## Files

| File | Purpose |
|------|---------|
| index.ts | Public exports |
| Provider.ts | AnthropicProvider (stub using withFixtureSupport) |

## Architecture

```
                    ┌─────────────────┐
                    │    index.ts     │
                    │ (public exports)│
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Provider.ts    │
                    │(AnthropicProvider)
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
    @anthropic-ai/    withFixture    AgentFixture
   claude-agent-sdk   Support         Store
```

## SDK Capabilities (Required)

- Uses `query()` streaming API from `@anthropic-ai/claude-agent-sdk`
- Supports session resume via `sessionId` and SDK `resume`/`persistSession`
- Streams messages and maps SDK events to `AgentStreamEvent`

## Model IDs

- Use full IDs for stability (example: `claude-haiku-4-5-20251001`)
- Aliases like `claude-haiku-4-5` are acceptable when auto-updates are desired
