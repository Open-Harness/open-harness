# monologue/ - Narrative Generation System

LLM-powered narrative generation from agent events.

## Files

| File | Purpose |
|------|---------|
| `monologue-service.ts` | `Monologue` - Main narrative generation service |
| `monologue-decorator.ts` | Decorator for agent runners to emit narratives |
| `types.ts` | Configuration and entry types |
| `prompts.ts` | Default system prompts (terse, balanced, verbose) |
| `tokens.ts` | DI tokens for monologue components |

## Key Abstractions

- **Monologue**: Buffers agent events, calls LLM to generate human-readable narratives.
- **MonologueDecorator**: Wraps agent runners, emits `narrative:update` events automatically.
- **NarrativeEntry**: Output with `text`, `agentName`, `importance`, `timestamp`.

## Config

```typescript
MonologueConfig {
  minBufferSize: number;  // Events before LLM called
  maxBufferSize: number;  // Force flush threshold
  historySize: number;    // Previous narratives for context
  model: "haiku" | "sonnet" | "opus";
  systemPrompt?: string;
}
```

## Flow

Agent events → Buffer → LLM → `narrative:update` event → Channels display
