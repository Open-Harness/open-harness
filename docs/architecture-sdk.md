# SDK Architecture (@dao/sdk)

## Overview

The SDK provides a clean, type-safe abstraction layer over the Anthropic Agent SDK. It enables developers to build autonomous agents and multi-agent workflows without dealing with DI complexity.

## Core Design Principles

1. **Zero Leakage**: DI container is completely hidden from users
2. **Promise + Callbacks**: No async generators exposed
3. **Composable**: Mix and match agents and workflows
4. **Type-Safe**: Full TypeScript with IntelliSense
5. **Extensible**: Built-in agents are just examples

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    PUBLIC API SURFACE                        │
│  createAgent() | createWorkflow() | withMonologue() | TaskList │
├─────────────────────────────────────────────────────────────┤
│                    DOMAIN LAYER                              │
│  BaseAgent | CodingAgent | ReviewAgent | Workflow            │
├─────────────────────────────────────────────────────────────┤
│                  INFRASTRUCTURE LAYER                        │
│  Container | Tokens | LiveRunner | ReplayRunner | Vault      │
├─────────────────────────────────────────────────────────────┤
│                    EXTERNAL DEPS                             │
│  @anthropic-ai/claude-agent-sdk | @needle-di/core            │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Agent Factory (`factory/agent-factory.ts`)

Creates agents without exposing DI. Supports three patterns:

```typescript
// Built-in agent
const coder = createAgent('coder');

// Config-based agent
const myAgent = createAgent({
  name: 'MyAgent',
  prompt: 'You are a {{role}} expert. Task: {{task}}',
  model: 'haiku'
});

// Class-based agent
class CustomAgent extends BaseAgent { ... }
const custom = createAgent(CustomAgent);
```

**Internal Flow:**
1. Lazily creates global container on first use
2. Resolves agent from container (built-in) or creates directly (config/class)
3. Injects runner dependency automatically

### 2. BaseAgent (`runner/base-agent.ts`)

Foundation for all agents:

```typescript
@injectable()
export class BaseAgent {
  constructor(
    public readonly name: string,
    protected runner: IAgentRunner,
    protected eventBus: IEventBus | null
  ) {}

  async run(prompt: string, sessionId: string, options?: Options): Promise<SDKMessage | undefined>
}
```

**Key Responsibilities:**
- Runs prompts through the SDK
- Maps SDK messages to typed AgentEvents
- Fires callbacks (onText, onToolCall, onResult, etc.)
- Publishes to event bus for cross-cutting concerns

### 3. Workflow Builder (`factory/workflow-builder.ts`)

Orchestrates multiple agents with task management:

```typescript
const workflow = createWorkflow({
  name: 'Code-Review',
  tasks: [{ id: '1', description: 'Write function' }],
  agents: { coder: createAgent('coder') },
  
  async execute({ agents, state, tasks }) {
    for (const task of tasks) {
      state.markInProgress(task.id);
      await agents.coder.run(task.description, `session_${task.id}`);
      state.markComplete(task.id);
    }
  }
});
```

### 4. TaskList (`workflow/task-list.ts`)

Stateful task management primitive:

```typescript
const tasks = new TaskList([
  { id: '1', description: 'Implement login' }
]);

tasks.markInProgress('1');
tasks.markCompleted('1', { result: 'Done!' });

const progress = tasks.getProgress();
// { total: 1, completed: 1, pending: 0, percentComplete: 100 }
```

**Task Lifecycle:**
`pending → in_progress → completed | failed | skipped`

### 5. Monologue Wrapper (`monologue/wrapper.ts`)

Transforms tool noise into readable narrative:

```typescript
const narrativeAgent = withMonologue(agent, {
  bufferSize: 5,
  onNarrative: (text) => console.log(`Agent: ${text}`)
});
```

**Internal Flow:**
1. Intercepts agent events (onToolCall, onText, etc.)
2. Buffers events until threshold reached
3. Uses AgentMonologue to synthesize first-person narrative
4. Fires onNarrative callback with human-readable text

## Dependency Injection

### Composition Root (`core/container.ts`)

Single place where all bindings are configured:

```typescript
export function createContainer(options: ContainerOptions = {}): Container {
  const container = new Container();
  
  // Infrastructure
  container.bind({ provide: IConfigToken, useValue: config });
  container.bind({ provide: IAgentRunnerToken, useClass: LiveSDKRunner });
  container.bind({ provide: IVaultToken, useClass: Vault });
  
  // Domain
  container.bind(CodingAgent);
  container.bind(ReviewAgent);
  container.bind(Workflow);
  
  return container;
}
```

### Injection Tokens (`core/tokens.ts`)

Interfaces and tokens for DI:

```typescript
export interface IAgentRunner {
  run(args: { prompt: string; options: Options; callbacks?: RunnerCallbacks })
    : Promise<SDKMessage | undefined>;
}

export const IAgentRunnerToken = new InjectionToken<IAgentRunner>('IAgentRunner');
```

## Event System

### AgentEvent Model (`runner/models.ts`)

Normalized event type for all agent activities:

```typescript
type AgentEvent = {
  timestamp: Date;
  event_type: EventType;
  agent_name: string;
  content?: string;
  session_id?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_result?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  is_error?: boolean;
};
```

### Event Types

- `SESSION_START` - Session initialized
- `TEXT` - Text content from assistant
- `THINKING` - Extended thinking/reasoning
- `TOOL_CALL` - Tool invocation started
- `TOOL_RESULT` - Tool execution completed
- `TOOL_PROGRESS` - Tool execution progress
- `COMPACT` - Context compaction started
- `STATUS` - Status update
- `RESULT` - Final result with usage stats
- `SESSION_END` - Session ended
- `ERROR` - Error occurred

### Callback Pattern

```typescript
type StreamCallbacks = {
  onSessionStart?: (metadata, event) => void;
  onText?: (content, event) => void;
  onThinking?: (thought, event) => void;
  onToolCall?: (toolName, input, event) => void;
  onToolResult?: (result, event) => void;
  onResult?: (result, event) => void;
  onSessionEnd?: (content, isError, event) => void;
  onError?: (error, event) => void;
};
```

## Recording & Replay

### Purpose
- Test without calling Claude API
- Capture sessions for debugging
- Create deterministic test fixtures

### Components

- **Vault** (`core/vault.ts`): Storage for recordings
- **RecordingFactory** (`core/recording-factory.ts`): Creates recorders
- **LiveSDKRunner** (`core/live-runner.ts`): Real SDK execution
- **ReplayRunner** (`core/replay-runner.ts`): Replay from recordings

### Usage

```typescript
// Live mode (default)
const container = createContainer({ mode: 'live' });

// Replay mode (for testing)
const container = createContainer({ mode: 'replay' });
```

## Public API Surface

### Exports from `index.ts`

```typescript
// Factories
export { createAgent } from './factory/agent-factory.js';
export { createWorkflow } from './factory/workflow-builder.js';

// Primitives
export { withMonologue } from './monologue/wrapper.js';
export { TaskList } from './workflow/task-list.js';

// Base Classes (advanced)
export { BaseAgent } from './runner/base-agent.js';
export type { StreamCallbacks } from './runner/base-agent.js';

// Built-in Agents (examples)
export { CodingAgent } from './agents/coding-agent.js';
export { ReviewAgent } from './agents/review-agent.js';

// Types
export type { AgentEvent, CodingResult, ... } from './runner/models.js';
export type { Task, TaskStatus } from './workflow/task-list.js';

// Internal (testing/advanced)
export { createContainer } from './core/container.js';
export type { ContainerOptions } from './core/container.js';
```

## Testing Strategy

### Unit Tests
- Container creation and binding
- TaskList state management
- Event mapping

### Integration Tests
- Live SDK execution (requires API key)
- Recording and replay
- Full workflow execution

### Example Tests

```typescript
// Direct instantiation for unit tests
const mockRunner: IAgentRunner = {
  async run(args) {
    args.callbacks?.onMessage?.(mockMessage);
    return mockResult;
  }
};

const agent = new BaseAgent('TestAgent', mockRunner);
const result = await agent.run('test', 'session');
```

## Error Handling

- Callbacks are fire-and-forget (errors silently caught)
- Workflow errors propagate to caller
- Agent errors include session context
- Recording failures don't affect execution

## Performance Considerations

- Container is lazily created (first agent creation)
- Container is singleton (reused across agents)
- Events are processed synchronously
- Monologue generation is async (non-blocking)
