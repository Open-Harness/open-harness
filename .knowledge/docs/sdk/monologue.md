# monologue/ - Narrative Generation System

Generates human-readable narratives from agent events. The monologue system uses an LLM to translate technical agent activity into natural language summaries.

## Files

| File | Purpose |
|------|---------|
| `monologue-service.ts` | `Monologue` - main narrative generation service |
| `monologue-decorator.ts` | Decorator for agent runners to emit narratives |
| `types.ts` | Configuration and entry types |
| `prompts.ts` | Default system prompts for narrative generation |
| `tokens.ts` | DI tokens for monologue components |
| `index.ts` | Barrel export |

## How It Works

1. Agent events (tool calls, text, thinking) are buffered
2. When buffer thresholds are met, an LLM generates a narrative
3. Narratives are emitted as `narrative:update` events
4. Channels can display these as human-readable progress

```
Agent Events          Monologue LLM           Channel
     │                     │                     │
     │ tool:call ───────►  │                     │
     │ agent:text ───────► │ Buffer events       │
     │ tool:result ─────►  │                     │
     │                     │ Generate narrative  │
     │                     │ ──────────────────► │ "Looking up X..."
```

## Usage

### Monologue Service

```typescript
import { Monologue, setMonologueContainer } from "@openharness/sdk";

setMonologueContainer(container);

const monologue = new Monologue({
  model: "haiku",
  minBufferSize: 1,
  maxBufferSize: 10,
  historySize: 5,
});

monologue.push({
  type: "tool:call",
  agentName: "Coder",
  toolName: "read_file",
  input: { path: "src/index.ts" },
});

const narrative = await monologue.flush();
// → "I'm reading the main entry point to understand the code structure."
```

### MonologueConfig

```typescript
interface MonologueConfig {
  minBufferSize: number;  // Events before LLM is called (default: 1)
  maxBufferSize: number;  // Force flush threshold (default: 10)
  historySize: number;    // Previous narratives for context (default: 5)
  model: "haiku" | "sonnet" | "opus";
  systemPrompt?: string;
}
```

### Built-in Prompts

Three prompt styles available:

```typescript
import {
  DEFAULT_MONOLOGUE_PROMPT,  // Balanced style
  TERSE_PROMPT,              // Minimal output
  VERBOSE_PROMPT,            // Detailed explanations
} from "@openharness/sdk";
```

## Decorator Pattern

The `MonologueDecorator` wraps agent runners to automatically generate narratives:

```typescript
const decoratedRunner = new MonologueDecorator(
  baseRunner,
  monologueConfig,
  eventBus
);

await decoratedRunner.run(agent, input);
```

## Usage in Channels

```typescript
const channel = defineChannel({
  name: "NarrativeConsole",
  on: {
    "narrative:update": ({ event, output }) => {
      const narrative = event.event as { text: string; agentName: string };
      output.dim(`[${narrative.agentName}] ${narrative.text}`);
    },
  },
});
```
