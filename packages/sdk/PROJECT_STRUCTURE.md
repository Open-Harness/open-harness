# Project Structure

Clean, organized codebase using NeedleDI for dependency injection.

**API Pattern: Promise + Callbacks (no async generators)**

## Directory Layout

```
bun-vi/
├── src/                      # Production code
│   ├── core/                 # DI infrastructure
│   │   ├── container.ts      # Composition root
│   │   ├── tokens.ts         # Interfaces & InjectionTokens
│   │   ├── vault.ts          # Recording storage
│   │   ├── recording-factory.ts  # Factory for @Record decorator
│   │   ├── decorators.ts     # @Record decorator
│   │   ├── live-runner.ts    # Real Claude SDK runner
│   │   └── replay-runner.ts  # Replay from recordings
│   │
│   ├── runner/               # Base agent runtime
│   │   ├── base-agent.ts     # BaseAgent class
│   │   ├── models.ts         # Event types & data models
│   │   └── prompts.ts        # Prompt registry
│   │
│   ├── agents/               # Specialized agents
│   │   ├── coding-agent.ts   # Code generation agent
│   │   ├── review-agent.ts   # Code review agent
│   │   └── monologue.ts      # Internal monologue agent
│   │
│   ├── workflow/             # Orchestration
│   │   └── orchestrator.ts   # Multi-agent workflows
├── scripts/                  # Utility and testing scripts
│   ├── e2e-capture.ts        # Comprehensive event capture
│   └── harvest.ts            # Golden recording capture
│
├── tests/
│   ├── unit/                 # Unit tests
│   ├── integration/          # Integration tests
│   └── fixtures/             # JSON fixtures for tests
│
└── recordings/               # Runtime recordings
```

## Quick Start

### Run Scripts
```bash
bun run capture               # Capture a full E2E session
bun run harvest               # Capture golden recordings
```

### Run Examples
```bash
bun src/examples/basic-agent.ts
bun src/examples/callbacks.ts
bun src/examples/workflow-demo.ts
bun src/examples/recording-demo.ts
```

### Run Tests
```bash
bun test                    # All tests
bun test tests/unit         # Unit tests only
bun test tests/integration  # Integration tests
```

## Usage Patterns

### Pattern 1: Simple - Just Await

```typescript
const result = await agent.run("Write a haiku", "session_id", {
  model: "haiku",
  maxTurns: 1,
});

if (result?.type === "result") {
  console.log("Done");
}
```

### Pattern 2: With Callbacks

```typescript
await agent.run("Write a haiku", "session_id", {
  model: "haiku",
  callbacks: {
    onSessionStart: (metadata) => console.log(`Started: ${metadata.model}`),
    onText: (content) => console.log(`Text: ${content}`),
    onToolCall: (tool, input) => console.log(`Tool: ${tool}`),
    onSessionEnd: (message, isError) => console.log(`Done: ${message}`),
  },
});
```

### Pattern 3: Specialized Agents

```typescript
const coder = container.get(CodingAgent);

const result = await coder.execute(task, sessionId, {
  onText: (text) => updateUI(text),
});

console.log(result.stopReason); // "finished" | "failed" | "compact"
```

## Architecture

### Dependency Injection

```typescript
@injectable()
export class MyService {
  constructor(
    private runner = inject(IAgentRunnerToken),
  ) {}
}
```

### Composition Root

All wiring in `src/core/container.ts`:

```typescript
const container = createContainer({ mode: "live" });
const agent = container.get(CodingAgent);
```

### Recording & Replay

```typescript
// Live: record
const container = createContainer({ mode: "live" });

// Test: replay
const container = createContainer({ mode: "replay" });
```

## Key Interfaces

```typescript
// Runner: Promise + callbacks
interface IAgentRunner {
  run(args: {
    prompt: string;
    options: Options;
    callbacks?: RunnerCallbacks;
  }): Promise<SDKMessage | undefined>;
}

// Callbacks
type RunnerCallbacks = {
  onMessage?: (message: SDKMessage) => void;
};

// Agent callbacks (higher level)
type StreamCallbacks = {
  onText?: (content: string, event: AgentEvent) => void;
  onToolCall?: (toolName: string, input: object, event: AgentEvent) => void;
  onToolResult?: (result: object, event: AgentEvent) => void;
  onThinking?: (thought: string, event: AgentEvent) => void;
  onSessionStart?: (metadata: object, event: AgentEvent) => void;
  onSessionEnd?: (content: string, isError: boolean, event: AgentEvent) => void;
};
```

## Testing

```typescript
// Mock runner for tests
const mockRunner: IAgentRunner = {
  async run(args) {
    args.callbacks?.onMessage?.(mockMessage);
    return mockResult;
  }
};

// Direct instantiation (no container needed)
const agent = new BaseAgent("TestAgent", mockRunner);
const result = await agent.run("test", "session");
```

---

**Philosophy:** Promises + callbacks. No async generators. Explicit dependencies.
