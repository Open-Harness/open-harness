# SDK Architecture (@openharnes/sdk)

## Overview

The SDK provides a provider-agnostic, type-safe framework for building step-aware autonomous agents. It enables developers to build multi-agent workflows with typed inputs/outputs, unified callbacks, and clean separation of concerns.

## Core Design Principles

1. **Provider-Agnostic**: Harnesses don't care which LLM provider powers agents
2. **Typed I/O**: Agents have typed inputs and outputs for safe chaining
3. **Unified Callbacks**: Same callback interface (`IAgentCallbacks`) across all providers
4. **DI for Infrastructure**: Dependency injection for runners, EventBus, Vault
5. **User Owns Orchestration**: Framework provides infrastructure, users control flow

## Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LAYER 1: HARNESS                                    │
│                     (Step-Aware Orchestration)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  BaseHarness<TState, TInput, TOutput>                                       │
│    - constructor(config: HarnessConfig<TState>)                             │
│    - protected state: PersistentState<TState>                               │
│    - protected currentStep: number                                          │
│    - abstract execute(): AsyncGenerator<StepYield<TInput, TOutput>>         │
│    - run(): Promise<void>                                                   │
│    - loadContext(): LoadedContext<TState>                                   │
│    - isComplete(): boolean                                                  │
│                                                                             │
│  Agent<TState, TInput, TOutput>                                             │
│    - Lightweight wrapper for step-aware agent logic                         │
│    - Provides step context to agent execution                               │
│                                                                             │
│  PersistentState<TState>                                                    │
│    - getState(): TState                                                     │
│    - updateState(fn: (s: TState) => TState): void                           │
│    - loadContext(): LoadedContext<TState>                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │ uses
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LAYER 2: AGENTS                                     │
│                  (Provider-Agnostic Agent System)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  interface IAgent<TInput, TOutput> {                                        │
│    readonly name: string;                                                   │
│    execute(                                                                 │
│      input: TInput,                                                         │
│      sessionId: string,                                                     │
│      callbacks?: IAgentCallbacks                                            │
│    ): Promise<TOutput>;                                                     │
│  }                                                                          │
│                                                                             │
│  interface IAgentCallbacks {                                                │
│    onStart?: (metadata: AgentStartMetadata) => void;                        │
│    onText?: (text: string, delta: boolean) => void;                         │
│    onToolCall?: (event: ToolCallEvent) => void;                             │
│    onToolResult?: (event: ToolResultEvent) => void;                         │
│    onThinking?: (thought: string) => void;                                  │
│    onProgress?: (event: ProgressEvent) => void;                             │
│    onComplete?: (result: AgentResult<TOutput>) => void;                     │
│    onError?: (error: AgentError) => void;                                   │
│  }                                                                          │
│                                                                             │
│  abstract class BaseAnthropicAgent<TInput, TOutput>                         │
│      implements IAgent<TInput, TOutput> {                                   │
│    protected abstract buildPrompt(input: TInput): string;                   │
│    protected abstract extractOutput(result: AgentResult): TOutput;          │
│    protected abstract getOptions(): RunnerOptions;                          │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │ uses
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LAYER 3: RUNNERS                                    │
│                   (LLM Execution Infrastructure)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  interface IAgentRunner {                                                   │
│    run(args: {                                                              │
│      prompt: string;                                                        │
│      options: Options;                                                      │
│      callbacks?: RunnerCallbacks;                                           │
│    }): Promise<SDKMessage | undefined>;                                     │
│  }                                                                          │
│                                                                             │
│  class AnthropicRunner implements IAgentRunner { ... }                      │
│  class ReplayRunner implements IAgentRunner { ... }                         │
│                                                                             │
│  // Provider-Specific Tokens                                                │
│  IAnthropicRunnerToken                                                      │
│  IReplayRunnerToken                                                         │
│                                                                             │
│  // Infrastructure                                                          │
│  IEventBusToken, IVaultToken, IConfigToken                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Harness Layer

**BaseHarness** - Abstract base class for step-aware orchestration:

```typescript
class MyHarness extends BaseHarness<State, Input, Output> {
  protected async *execute() {
    // User implements orchestration logic
    const result = await this.agent.run({ ... });
    yield { input, output: result };
  }
}
```

**Agent** - Lightweight wrapper for step-aware agent logic:

```typescript
const agent = new Agent<State, Input, Output>({
  name: 'MyAgent',
  async run({ input, stepNumber, context }) {
    // Agent implementation
    return output;
  }
});
```

**PersistentState** - Manages state with bounded context:

```typescript
this.state.updateState(s => ({
  ...s,
  itemsProcessed: s.itemsProcessed + 1
}));
```

### 2. Agent Layer

**IAgent Interface** - Core abstraction for typed agents:

```typescript
interface IAgent<TInput, TOutput> {
  readonly name: string;
  execute(
    input: TInput,
    sessionId: string,
    callbacks?: IAgentCallbacks<TOutput>
  ): Promise<TOutput>;
}
```

**BaseAnthropicAgent** - Base class for Anthropic/Claude agents:

```typescript
class CodingAgent extends BaseAnthropicAgent<CodingInput, CodingOutput> {
  readonly name = 'CodingAgent';

  protected buildPrompt(input: CodingInput): string {
    return `Task: ${input.task}`;
  }

  protected getOptions(): RunnerOptions {
    return { model: 'sonnet' };
  }

  protected extractOutput(result: AgentResult): CodingOutput {
    return result.output as CodingOutput;
  }
}
```

### 3. Runner Layer

**AnthropicRunner** - Production runner for Claude API:

```typescript
@injectable()
class AnthropicRunner implements IAgentRunner {
  async run(args): Promise<SDKMessage | undefined> {
    for await (const message of query({ prompt, options })) {
      callbacks?.onMessage?.(message);
    }
    return lastMessage;
  }
}
```

## Typed Agent Chaining

```typescript
// Type-safe chaining
const analysis: AnalysisOutput = await analyzer.execute({ ticket }, sessionId);
const code: CodingOutput = await coder.execute({ task: analysis.plan }, sessionId);
const review: ReviewOutput = await reviewer.execute({ impl: code.summary }, sessionId);

// Loop based on typed output
while (review.decision === 'reject') {
  code = await coder.execute({ task: analysis.plan, feedback: review.feedback }, sessionId);
  review = await reviewer.execute({ impl: code.summary }, sessionId);
}
```

## DI Container

```typescript
// Create container with provider bindings
const container = createContainer({ mode: 'live' });

// Provider-specific tokens
container.bind({ provide: IAnthropicRunnerToken, useClass: AnthropicRunner });
container.bind({ provide: IReplayRunnerToken, useClass: ReplayRunner });

// Get agents from container
const coder = container.get(CodingAgent);
const reviewer = container.get(ReviewAgent);
```

## File Structure

```
packages/sdk/src/
├── index.ts                    # Main exports
│
├── harness/                    # LAYER 1: HARNESS
│   ├── index.ts
│   ├── base-harness.ts         # BaseHarness abstract class
│   ├── agent.ts                # Agent wrapper
│   ├── state.ts                # PersistentState
│   └── types.ts                # Step, StepYield, HarnessConfig
│
├── agents/                     # LAYER 2: AGENTS
│   ├── index.ts
│   ├── types.ts                # IAgent, RunnerOptions
│   ├── base-anthropic-agent.ts # BaseAnthropicAgent
│   ├── coding-agent.ts
│   └── review-agent.ts
│
├── callbacks/                  # CALLBACKS
│   ├── index.ts
│   └── types.ts                # IAgentCallbacks, events
│
├── runner/                     # LAYER 3: RUNNERS
│   ├── index.ts
│   ├── anthropic-runner.ts     # AnthropicRunner
│   ├── base-agent.ts           # Legacy BaseAgent
│   └── models.ts               # AgentEvent, EventType
│
├── core/                       # DI INFRASTRUCTURE
│   ├── container.ts            # createContainer()
│   ├── tokens.ts               # All injection tokens
│   ├── replay-runner.ts
│   └── vault.ts
│
├── factory/                    # FACTORIES
│   ├── agent-factory.ts        # createAgent()
│   └── workflow-builder.ts     # createWorkflow()
│
└── workflow/                   # WORKFLOW
    ├── task-list.ts            # TaskList
    └── orchestrator.ts         # Workflow
```

## Running Tests

```bash
# All tests
bun test

# Smoke test (no API key needed)
bun run smoke

# Unit tests
bun test:unit

# Integration tests (requires API key)
bun test:integration
```

## Example: External Harness

Harnesses should be built OUTSIDE the SDK repo. See `/harnesses/coding-workflow/` for an example.

```bash
# From harnesses/coding-workflow/
bun install
bun start
```
