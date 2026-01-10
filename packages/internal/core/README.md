---
lastUpdated: "2026-01-10T10:11:36.649Z"
lastCommit: "150d2ad147832f2553c0dbfb779f1a466c0a001b"
lastCommitDate: "2026-01-10T09:55:26Z"
---
# @internal/core

Internal implementation of the Open Harness v0.3.0 reactive API.

**Note:** This is a private package. Use `@open-harness/core` for the public API.

## Structure

```
src/
├── api/              # Public API (createHarness, runReactive, etc.)
├── lib/              # Internal utilities (logger, etc.)
├── persistence/      # Fixture storage interfaces
├── state/            # Shared state types
└── transports/       # Transport type definitions
```

## API Module (`src/api/`)

The primary user-facing API for v0.3.0:

### Core Functions

| Export | Description |
|--------|-------------|
| `createHarness<TState>()` | Factory for type-safe harness with scoped `agent()` and `runReactive()` |
| `agent()` | Create an agent definition |
| `harness()` | Create a multi-agent harness (legacy, prefer `createHarness`) |
| `runReactive()` | Execute a signal-based workflow |

### Reactive Agent Config

```typescript
interface ReactiveAgentConfig<TState> {
  prompt: string;                    // Template with {{ state.x }} syntax
  activateOn: string[];              // Signal patterns that trigger activation
  emits?: string[];                  // Signals this agent emits
  when?: (ctx: ActivationContext<TState>) => boolean;  // Guard condition
  updates?: keyof TState;            // State field to update with output
  provider?: Provider;               // Per-agent provider override
}
```

### Harness Factory

```typescript
const { agent, runReactive } = createHarness<MyState>();

const myAgent = agent({
  prompt: "...",
  activateOn: ["harness:start"],
});

const result = await runReactive({
  agents: { myAgent },
  state: initialState,
  provider,
});
```

### Template Engine (`template.ts`)

Expands `{{ state.x }}` and `{{ signal.payload }}` in prompts:

```typescript
import { expandTemplate, hasTemplateExpressions } from "@internal/core";

expandTemplate("Hello {{ state.name }}", { state: { name: "World" } });
// "Hello World"

hasTemplateExpressions("No templates here");  // false
hasTemplateExpressions("Has {{ one }}");      // true
```

### Debug Utilities (`debug.ts`)

Signal inspection and causality tracking:

```typescript
import {
  getCausalityChain,
  buildSignalTree,
  formatSignalTree,
  getAgentSignals,
} from "@internal/core";

// Get signals caused by a parent signal
const chain = getCausalityChain(signals, "sig_parent123");

// Build tree structure
const tree = buildSignalTree(signals);

// Pretty print
console.log(formatSignalTree(signals));
```

### Reactive Store (`reactive-store.ts`)

State changes emit signals automatically:

```typescript
import { createReactiveStore, connectStoreToBus } from "@internal/core";

const store = createReactiveStore({ count: 0 });
const unsubscribe = connectStoreToBus(store, bus);

store.state.count = 1;
// Emits: state:count:changed { key: "count", oldValue: 0, newValue: 1 }
```

### Telemetry (`telemetry.ts`)

Wide events for observability:

```typescript
import { createTelemetrySubscriber, createWideEvent } from "@internal/core";

const subscriber = createTelemetrySubscriber({
  logger: pinoLogger,
  sampling: { rate: 0.1 },
});

subscriber.onHarnessEnd(result.signals);
// Logs: HarnessWideEvent with duration, tokens, cost, outcome
```

## Lib Module (`src/lib/`)

Internal utilities:

- **Logger** - Pino-based structured logging with signal context

## Persistence Module (`src/persistence/`)

Fixture store interface for recording/replay:

```typescript
interface FixtureStore {
  save(id: string, data: unknown): Promise<void>;
  load(id: string): Promise<unknown | undefined>;
  exists(id: string): Promise<boolean>;
  delete(id: string): Promise<void>;
}
```

## Deleted Modules (v0.3.0)

The following were removed during the v0.3.0 migration:

- `builtins/` - Old echo/constant nodes (use signal patterns instead)
- `eval/` - Old eval system (signal-native eval planned for P0-6)
- `nodes/` - Node registry (use `Provider` interface from @signals/core)
- `providers/` - Provider traits (use `ClaudeProvider`/`CodexProvider`)
- `recording/` - Old recording (use `@signals/bus` for signal recording)
- `runtime/` - Graph executor (use `runReactive()` for signal-based execution)

## Testing

```bash
bun run test          # Run tests
bun run typecheck     # Type check
```

## See Also

- [@open-harness/core](../../open-harness/core/README.md) - Public API
- [api/README.md](src/api/README.md) - Detailed API documentation
