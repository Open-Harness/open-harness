# Research: ElevenLabs Voice Channel Integration

**Date**: 2025-12-29
**Researchers**: Codebase exploration agents + Web research
**Scope**: Provider architecture, SDK patterns, ElevenLabs API capabilities

## Executive Summary

This research validates that **ElevenLabs should be implemented as a bidirectional channel, not a provider**. The architecture discovery revealed that the current channel pattern needs minor enhancements to support bidirectional I/O, after which ElevenLabs integration becomes straightforward.

### Key Findings

1. **Architectural Clarity**: ElevenLabs is an **interface** (I/O layer), not an **agent** (task executor)
2. **Channel Pattern Works**: Existing attachment system supports the use case with minimal changes
3. **SDK Already Has Building Blocks**: Session mode, transport interface, and event bus are already implemented
4. **ElevenLabs API is Mature**: Well-documented SDKs with stable WebSocket/WebRTC connections

---

## Part 1: Codebase Architecture Analysis

### 1.1 Provider Architecture (packages/anthropic)

**Exploration Agent**: Provider architecture patterns

**Key Files Analyzed**:
- `/packages/anthropic/src/provider/factory.ts` - `defineAnthropicAgent()` factory
- `/packages/anthropic/src/provider/internal-agent.ts` - Execution engine with DI
- `/packages/anthropic/src/provider/anthropic-event-mapper.ts` - Provider-specific event mapping
- `/packages/anthropic/src/infra/runner/anthropic-runner.ts` - SDK wrapper implementing `IAgentRunner`

**Architecture Summary**:

```
┌─────────────────────────────────────────────┐
│  Application Code                           │
│  const result = await CodingAgent.execute() │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  PRESETS LAYER (src/presets/)               │
│  - CodingAgent, PlannerAgent, ReviewAgent   │
│  - Pre-configured with prompts + schemas    │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  PROVIDER LAYER (src/provider/)             │
│  - defineAnthropicAgent() factory           │
│  - InternalAnthropicAgent (execution)       │
│  - AnthropicEventMapper (provider-specific) │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  INFRA LAYER (src/infra/)                   │
│  - AnthropicRunner (IAgentRunner impl)      │
│  - Recording/Replay system                  │
│  - Monologue (narrative generation)         │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  @anthropic-ai/claude-agent-sdk             │
│  query() async generator                    │
└─────────────────────────────────────────────┘
```

**Provider Contract**: Implements `IAgentRunner.run()` which returns `Promise<GenericMessage>`

**Why ElevenLabs Doesn't Fit**:
- **Anthropic**: Prompt → Response cycle (async generator)
- **ElevenLabs**: Persistent WebSocket with bidirectional streaming
- **Mismatch**: `IAgentRunner.run()` expects a promise that resolves, but voice conversations are ongoing

**Conclusion**: ElevenLabs is NOT a provider. It doesn't execute tasks, it's an I/O interface.

### 1.2 SDK Core Architecture (packages/sdk)

**Exploration Agent**: SDK core interfaces and DI patterns

**Key Files Analyzed**:
- `/packages/sdk/src/infra/tokens.ts` - DI token definitions
- `/packages/sdk/src/infra/container.ts` - Container setup
- `/packages/sdk/src/infra/unified-event-bus.ts` - Event system with AsyncLocalStorage
- `/packages/sdk/src/callbacks/types.ts` - Unified callback interface

**Core Abstractions**:

**1. IAgentRunner (Provider Contract)**:
```typescript
export interface IAgentRunner {
  run(args: {
    prompt: string;
    options: GenericRunnerOptions;
    callbacks?: RunnerCallbacks;
  }): Promise<GenericMessage | undefined>;
}
```
- **Purpose**: Execute LLM requests
- **Used by**: InternalAnthropicAgent, future providers
- **Token**: `IAgentRunnerToken`

**2. IUnifiedEventBus (Event System)**:
```typescript
export interface IUnifiedEventBus {
  scoped<T>(context: Partial<EventContext>, fn: () => T | Promise<T>): T | Promise<T>;
  current(): EventContext;
  emit(event: BaseEvent, override?: Partial<EventContext>): void;
  subscribe(listener: UnifiedEventListener): Unsubscribe;
  subscribe(filter: EventFilter, listener: UnifiedEventListener): Unsubscribe;
}
```
- **Purpose**: Context-aware event emission with AsyncLocalStorage
- **Features**: Nested scoping, filter patterns (wildcard, prefix, exact), enriched events
- **Usage**: Phase/task/agent context automatically propagates

**3. IAgentCallbacks (Standardized Callbacks)**:
```typescript
export interface IAgentCallbacks<TOutput> {
  onStart?(metadata: AgentStartMetadata): void;
  onText?(text: string, isPartial: boolean): void;
  onThinking?(thinking: string): void;
  onToolCall?(event: ToolCallEvent): void;
  onToolResult?(event: ToolResultEvent): void;
  onProgress?(event: ProgressEvent): void;
  onComplete?(result: AgentResult<TOutput>): void;
  onError?(error: AgentError): void;
}
```
- **Purpose**: Consistent progress tracking across providers
- **Re-exported from**: `@openharness/core`

**Dependency Injection Pattern**:

```typescript
// Container creation
export function createContainer(options: ContainerOptions = {}): Container {
  const container = new Container();

  // Provider-agnostic bindings
  container.bind({ provide: IConfigToken, useValue: config });
  container.bind({ provide: IUnifiedEventBusToken, useFactory: () => new UnifiedEventBus() });

  // Providers add their bindings
  // container.bind({ provide: IAgentRunnerToken, useClass: AnthropicRunner });

  return container;
}
```

**Lazy Initialization Pattern** (from Anthropic provider):
```typescript
let _internalAgent: InternalAnthropicAgent | null = null;

function getInternalAgent(): InternalAnthropicAgent {
  if (!_internalAgent) {
    const container = getGlobalContainer();
    const runner = container.get(IAgentRunnerToken);
    const bus = container.get(IUnifiedEventBusToken);
    _internalAgent = new InternalAnthropicAgent(name, runner, bus);
  }
  return _internalAgent;
}
```
- **Benefit**: Agents can be defined at module level
- **Benefit**: Tests can override container before first use

**Conclusion**: SDK provides robust infrastructure for event-driven workflows but is designed around task-executing agents, not I/O interfaces.

### 1.3 Harness Architecture (packages/sdk/src/harness)

**Exploration Agent**: Harness patterns and examples

**Key Files Analyzed**:
- `/examples/coding/src/index.ts` - Main entry point (fluent usage)
- `/examples/coding/src/harness.ts` - Harness definition with phases/tasks
- `/examples/coding/src/console-channel.ts` - Channel implementation
- `/packages/sdk/src/harness/harness-instance.ts` - Runtime execution

**Harness Pattern**:

```typescript
const CodingHarness = defineHarness({
  name: "coding-workflow",

  // Agents are bound to DI container
  agents: {
    planner: PlannerAgent,
    coder: CodingAgent,
    reviewer: ReviewAgent
  },

  // State factory
  state: (input: { prd: string }): CodingState => ({
    prd: input.prd,
    tasks: [],
    codeResults: new Map(),
  }),

  // Workflow execution
  run: async ({ agents, state, phase, task }) => {
    await phase("Planning", async () => {
      const plan = await agents.planner.execute({ prd: state.prd });
      state.tasks = plan.tasks;
    });

    await phase("Execution", async () => {
      for (const plannerTask of state.tasks) {
        await task(plannerTask.id, async () => {
          const code = await agents.coder.execute({ task: plannerTask.description });
          state.codeResults.set(plannerTask.id, code);
        });
      }
    });

    return { tasks: state.tasks };
  },
});
```

**Usage**:
```typescript
const result = await CodingHarness
  .create({ prd: "Build a TODO app" })
  .attach(ConsoleChannel)        // ← Attachment point
  .run();
```

**Attachment System** (from `harness-instance.ts:216-224`):

```typescript
attach(attachment: Attachment): this {
  if (this._status !== "idle") {
    throw new Error("Cannot attach after run() has started");
  }
  this._attachments.push(attachment);
  return this;
}
```

**Attachment Signature**:
```typescript
export type Attachment = (transport: Transport) => void | (() => void | Promise<void>);
```

**Attachment Lifecycle** (from `harness-instance.ts:550-592`):
```typescript
async run(): Promise<HarnessResult<TState, TResult>> {
  // Call attachments on run() start
  for (const attachment of this._attachments) {
    const cleanup = attachment(this as unknown as Transport);
    if (cleanup) {
      this._cleanups.push(cleanup);
    }
  }

  try {
    // Execute workflow...
    const result = await this._runFn(context, this._input);
    return { result, state, events, duration };
  } finally {
    // Call cleanup functions in reverse order (LIFO)
    for (let i = this._cleanups.length - 1; i >= 0; i--) {
      await this._cleanups[i]?.();
    }
  }
}
```

**Transport Interface** (what attachments receive):
```typescript
interface Transport {
  status: TransportStatus;         // idle | running | complete | aborted
  sessionActive: boolean;          // Is session mode enabled?

  // Event subscription
  subscribe(listener: EventListener): Unsubscribe;
  subscribe(filter: EventFilter, listener: EventListener): Unsubscribe;

  // Session commands
  send(message: string): void;
  sendTo(agent: string, message: string): void;
  reply(promptId: string, response: UserResponse): void;
  abort(reason?: string): void;

  // Async iteration
  [Symbol.asyncIterator](): AsyncIterator<EnrichedEvent>;
}
```

**ConsoleChannel Implementation** (simplified):

```typescript
export const ConsoleChannel = defineChannel({
  name: "Console",

  state: () => ({ phaseCount: 0, taskCount: 0 }),

  on: {
    "phase:start": ({ event, output, state }) => {
      state.phaseCount++;
      output.line(`┌─ Phase ${state.phaseCount}: ${event.event.name}`);
    },

    "task:complete": ({ output }) => {
      output.success(`  ├─ Done`);
    },
  },

  onComplete: ({ output, state }) => {
    output.success(`🎉 ${state.taskCount} tasks processed`);
  },
});
```

**defineChannel Factory** (conceptual):
```typescript
export function defineChannel<TState>(config: {
  name: string;
  state: () => TState;
  on?: Record<string, (ctx: ChannelContext<TState> & { event: EnrichedEvent }) => void>;
  onStart?: (ctx: ChannelContext<TState>) => void;
  onComplete?: (ctx: ChannelContext<TState>) => void;
}): Attachment {
  return (transport: Transport) => {
    const state = config.state();
    const ctx = {
      state,
      output: transport,  // RenderOutput methods (.line, .success, etc.)
      // MISSING: bus, control ← THIS IS THE GAP
    };

    if (config.onStart) config.onStart(ctx);

    if (config.on) {
      for (const [pattern, handler] of Object.entries(config.on)) {
        transport.subscribe(pattern, (event) => {
          handler({ ...ctx, event });
        });
      }
    }

    return () => {
      if (config.onComplete) config.onComplete(ctx);
    };
  };
}
```

**Gap Identified**: Current `ChannelContext` only has `state` and `output`. Channels cannot:
- Emit events back to harness (no `bus` access)
- Control harness execution (no `control.pause/resume/abort`)

**Solution**: Upgrade `AttachmentContext` to include `bus` and `control`.

### 1.4 Session Mode Analysis

**Key Files**:
- `/packages/sdk/src/harness/harness-instance.ts:249-289` - Session mode implementation
- `/packages/sdk/src/harness/session-context.ts` - Session utilities

**Session Mode API**:

```typescript
// Enable session mode
harness.startSession()  // ← Enables interactive features

// Execute session
const result = await harness.complete();  // ← Like run() but with session enabled
```

**Session Features Already Implemented**:

**1. Message Queue** (`harness-instance.ts:140-141`):
```typescript
private readonly _messageQueue: AsyncQueue<InjectedMessage> = new AsyncQueue();
```

**2. Prompt/Reply Flow** (`harness-instance.ts:141-143`):
```typescript
private readonly _promptResolvers: Map<string, Deferred<UserResponse>> = new Map();
private _abortController: AbortController = new AbortController();
```

**3. Session Commands**:
- `send(message)` - Inject message into queue
- `sendTo(agent, message)` - Target specific agent
- `reply(promptId, response)` - Resolve pending prompt
- `abort(reason)` - Graceful shutdown

**4. Session Events**:
- `session:prompt` - Workflow needs user input
- `session:reply` - User responded
- `session:abort` - Abort requested

**SessionContext API** (available in workflow):
```typescript
interface SessionContext {
  waitForUser(prompt: string, choices?: string[]): Promise<UserResponse>;
  readMessages(): InjectedMessage[];
  isAborted(): boolean;
}
```

**Usage in Workflow**:
```typescript
run: async ({ agents, state, session }) => {
  // ... do some work ...

  const response = await session.waitForUser("Should I proceed?", ["yes", "no"]);

  if (response.text === "yes") {
    // Continue...
  }
}
```

**Conclusion**: Session mode is **fully implemented**. ElevenLabs channel can leverage it for voice prompts.

---

## Part 2: ElevenLabs API Research

### 2.1 Product Overview

**Source**: [ElevenLabs Agents Platform](https://elevenlabs.io/docs/agents-platform/overview)

**Product Description**:
ElevenLabs Conversational AI enables voice-rich, expressive agents with:
- Real-time voice synthesis (low-latency speech generation)
- Automatic speech-to-text transcription
- Persistent conversation state across turns
- WebSocket and WebRTC connection protocols
- Multimodal (text + audio) streaming

**Target Use Cases**:
- Customer support bots with natural voices
- Voice assistants for applications
- Interactive voice response (IVR) systems
- Voice-enabled workflows and automation

**Key Differentiator**: Industry-leading voice quality with emotional expressiveness.

### 2.2 JavaScript SDK

**Source**: [JavaScript SDK Docs](https://elevenlabs.io/docs/agents-platform/libraries/java-script)

**Package**: `@11labs/client`

**Installation**:
```bash
npm install @11labs/client
# or
bun add @11labs/client
```

**Core API**:

```typescript
import { Conversation } from "@11labs/client";

// Start session
const conversation = await Conversation.startSession({
  agentId: "your-agent-id",
  // OR for private agents:
  signedUrl: "...",
  conversationToken: "...",
});

// Listen to events
conversation.on("user_transcript", (text: string) => {
  console.log("User said:", text);
});

conversation.on("agent_response", (response: {
  text: string;
  audio?: ArrayBuffer;
}) => {
  console.log("Agent responded:", response.text);
});

conversation.on("thinking", () => {
  console.log("Agent is thinking...");
});

conversation.on("disconnect", (reason: string) => {
  console.log("Disconnected:", reason);
});

// Send messages (text-to-speech)
conversation.speak("Hello! How can I help you?");

// End session
conversation.endSession();
```

**Event Types**:

| Event | Description | Payload |
|-------|-------------|---------|
| `connected` | WebSocket established | `void` |
| `user_transcript` | User speech transcribed | `string` |
| `agent_response` | Agent spoke | `{ text: string, audio?: ArrayBuffer }` |
| `thinking` | Agent processing (no audio yet) | `void` |
| `disconnect` | Connection closed | `string` (reason) |
| `error` | Error occurred | `Error` |

**Configuration Options**:
```typescript
interface ConversationConfig {
  agentId?: string;              // Public agent
  signedUrl?: string;            // Private agent (WebSocket)
  conversationToken?: string;    // Private agent (WebRTC)
  onError?: (error: Error) => void;
}
```

### 2.3 Authentication Methods

**Source**: [Agents Platform Quickstart](https://elevenlabs.io/docs/agents-platform/quickstart)

**1. Public Agent (No Auth)**:
```typescript
const conversation = await Conversation.startSession({
  agentId: "public-agent-id",
});
```
- **Use Case**: Public demos, open experiments
- **Limitation**: No access control

**2. Signed URL (Private Agent via WebSocket)**:
```typescript
// Step 1: Generate signed URL via REST API
const response = await fetch("https://api.elevenlabs.io/v1/convai/agents/auth", {
  method: "POST",
  headers: {
    "xi-api-key": process.env.ELEVENLABS_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ agent_id: "your-agent-id" }),
});
const { signedUrl } = await response.json();

// Step 2: Connect with signed URL
const conversation = await Conversation.startSession({ signedUrl });
```
- **Use Case**: Server-side applications, CLI tools
- **Benefit**: Simpler than WebRTC, good for non-browser environments

**3. Conversation Token (Private Agent via WebRTC)**:
```typescript
// Step 1: Generate conversation token via REST API
const response = await fetch("https://api.elevenlabs.io/v1/convai/conversations", {
  method: "POST",
  headers: {
    "xi-api-key": process.env.ELEVENLABS_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ agent_id: "your-agent-id" }),
});
const { conversationToken } = await response.json();

// Step 2: Connect with token
const conversation = await Conversation.startSession({ conversationToken });
```
- **Use Case**: Browser-based UIs, mobile apps
- **Benefit**: Lower latency (peer-to-peer), better for interactive apps

### 2.4 WebSocket vs WebRTC

**WebSocket**:
- **Pros**: Simpler setup, broader compatibility, works server-side
- **Cons**: Higher latency (server proxies audio)
- **Auth**: `signedUrl` or `agentId`
- **Recommended for**: CLI tools, server apps, batch processing

**WebRTC**:
- **Pros**: Lower latency (direct peer-to-peer), better quality
- **Cons**: Complex NAT traversal, browser-centric
- **Auth**: `conversationToken`
- **Recommended for**: Browser UIs, real-time apps, mobile

**Recommendation for Open Harness**: Start with **WebSocket** since workflows are typically server-side.

### 2.5 Error Handling

**Common Errors**:

| Status | Error | Retry? | Action |
|--------|-------|--------|--------|
| 401 | Unauthorized | ❌ No | Check API key, agent ID |
| 404 | Agent not found | ❌ No | Verify agent exists in dashboard |
| 429 | Rate limited | ✅ Yes | Exponential backoff |
| 503 | Service unavailable | ✅ Yes | Retry with backoff |
| Network | Connection timeout | ✅ Yes | Retry with backoff |

**Retry Strategy**:
```typescript
async function connectWithRetry(
  config: ConversationConfig,
  maxAttempts = 3
): Promise<Conversation> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const conversation = await Conversation.startSession(config);
      return conversation;
    } catch (error) {
      lastError = error;

      // Don't retry auth errors
      if (error.status === 401 || error.status === 404) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      if (attempt < maxAttempts) {
        await sleep(2 ** (attempt - 1) * 1000);
      }
    }
  }

  throw lastError;
}
```

### 2.6 React SDK (Reference)

**Source**: [React SDK Docs](https://elevenlabs.io/docs/agents-platform/libraries/react)

**Package**: `@11labs/react`

**Hook API**:
```typescript
import { useConversation } from "@11labs/react";

function VoiceInterface() {
  const conversation = useConversation({
    onConnect: () => console.log("Connected"),
    onDisconnect: () => console.log("Disconnected"),
    onMessage: (message) => console.log("Message:", message),
    onError: (error) => console.error("Error:", error),
  });

  const handleStart = async () => {
    await conversation.startSession({
      agentId: "your-agent-id",
    });
  };

  const handleEnd = () => {
    conversation.endSession();
  };

  return (
    <div>
      <button onClick={handleStart}>Start Conversation</button>
      <button onClick={handleEnd}>End Conversation</button>
      <div>Status: {conversation.status}</div>
    </div>
  );
}
```

**Not Directly Applicable** but demonstrates:
- State management patterns
- Lifecycle handling
- Error recovery

### 2.7 Python SDK (Reference)

**Source**: [Python SDK Docs](https://elevenlabs.io/docs/agents-platform/libraries/python)

**Installation**:
```bash
pip install elevenlabs
```

**API**:
```python
from elevenlabs.conversational_ai import Conversation

conversation = Conversation(
    agent_id="your-agent-id",
    requires_auth=False,
    # or for private agents:
    # signed_url="...",
)

conversation.start_session()

# Listen to events
def on_user_transcript(text):
    print(f"User: {text}")

def on_agent_response(text):
    print(f"Agent: {text}")

conversation.on("user_transcript", on_user_transcript)
conversation.on("agent_response", on_agent_response)

# Run conversation
conversation.wait_for_session_end()
```

**Insight**: Python SDK uses similar event-driven pattern.

---

## Part 3: Architecture Synthesis

### 3.1 Why ElevenLabs is a Channel, Not a Provider

**Providers (Anthropic, Gemini, OpenAI)**:
- **Purpose**: Execute tasks via LLM reasoning
- **Input**: Prompt (text)
- **Output**: Structured result (text, tool calls, thinking)
- **Lifecycle**: Request/response cycle
- **Interface**: `IAgentRunner.run()` returns `Promise<GenericMessage>`
- **Examples**: Generate code, review PR, plan tasks

**Channels (Console, Voice, Web, File)**:
- **Purpose**: Communicate workflow state to/from user
- **Input**: User commands, messages
- **Output**: Event narration, progress updates
- **Lifecycle**: Persistent connection during workflow
- **Interface**: `Attachment` receives `Transport`
- **Examples**: Display logs, speak events, stream to WebSocket

**ElevenLabs Characteristics**:
- ✅ Persistent connection (WebSocket)
- ✅ Bidirectional (listen to events, accept commands)
- ✅ I/O-focused (voice in, voice out)
- ❌ Does NOT execute tasks
- ❌ Does NOT reason or make decisions
- ❌ Does NOT fit `IAgentRunner` interface

**Conclusion**: ElevenLabs is a **channel** for voice I/O.

### 3.2 Channel Pattern Enhancement

**Current Pattern** (`defineChannel`):
```typescript
export function defineChannel<TState>(config: {
  name: string;
  state: () => TState;
  on?: Record<string, EventHandler>;
  onStart?: (ctx: ChannelContext<TState>) => void;
  onComplete?: (ctx: ChannelContext<TState>) => void;
}): Attachment
```

**Current Context**:
```typescript
interface ChannelContext<TState> {
  state: TState;
  output: RenderOutput;  // .line(), .success(), .fail(), etc.
}
```

**Problem**: Channels are **implicitly unidirectional** - they can only output, not input.

**Solution**: Upgrade context to include bidirectional capabilities.

**Proposed Context**:
```typescript
interface ChannelContext<TState> {
  state: TState;
  output: RenderOutput;
  bus: IUnifiedEventBus;      // ← NEW: Emit events to harness
  control: HarnessControl;    // ← NEW: Control harness execution
}

interface HarnessControl {
  pause(): void;
  resume(): void;
  abort(reason?: string): void;
  getCurrentPhase(): string | null;
  getCurrentTask(): string | null;
}
```

**Impact**:
- ✅ **Backward compatible** - existing channels ignore new properties
- ✅ **Minimal change** - just pass `bus` and `control` from `HarnessInstance`
- ✅ **Unlocks bidirectionality** - channels can now affect workflow

### 3.3 ElevenLabs Integration Pattern

**Connection Wrapper**:
```typescript
// packages/elevenlabs/src/connection.ts
import { Conversation } from "@11labs/client";

export class ElevenLabsConnection {
  private conversation: Conversation | null = null;
  private eventHandlers = new Map<string, Set<Function>>();

  async connect(config: ElevenLabsConfig): Promise<void> {
    this.conversation = await Conversation.startSession(config);

    // Forward SDK events to handlers
    this.conversation.on("user_transcript", (text) => {
      this.emit("user_transcript", text);
    });

    this.conversation.on("agent_response", (response) => {
      this.emit("agent_response", response);
    });

    this.conversation.on("disconnect", (reason) => {
      this.emit("disconnect", reason);
    });
  }

  speak(text: string): void {
    this.conversation?.speak(text);
  }

  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  private emit(event: string, data: any): void {
    this.eventHandlers.get(event)?.forEach(handler => handler(data));
  }

  disconnect(): void {
    this.conversation?.endSession();
    this.conversation = null;
  }
}
```

**Channel Implementation**:
```typescript
// packages/elevenlabs/src/channel.ts
import { defineChannel } from "@openharness/sdk";
import { ElevenLabsConnection } from "./connection";

export const ElevenLabsChannel = (config: ElevenLabsConfig) => defineChannel({
  name: "ElevenLabsVoice",

  state: () => ({
    connection: null as ElevenLabsConnection | null,
    transcript: [] as string[],
  }),

  onStart: async ({ state, bus, control, output }) => {
    output.line("🎤 Connecting to ElevenLabs...");

    // Connect
    state.connection = new ElevenLabsConnection();
    await state.connection.connect(config);

    output.success("✅ Voice interface ready");
    state.connection.speak("Hello! I'm monitoring the workflow.");

    // ========== INBOUND: User → Harness ==========
    state.connection.on("user_transcript", (text: string) => {
      state.transcript.push(`User: ${text}`);
      output.line(`🗣️  User: ${text}`);

      // Parse commands
      if (text.toLowerCase().includes("pause")) {
        control.pause();
        state.connection!.speak("Pausing workflow");
      } else if (text.toLowerCase().includes("resume")) {
        control.resume();
        state.connection!.speak("Resuming workflow");
      } else if (text.toLowerCase().includes("status")) {
        const phase = control.getCurrentPhase();
        state.connection!.speak(`Currently in phase: ${phase}`);
      } else if (text.toLowerCase().includes("abort")) {
        control.abort("User voice command");
        state.connection!.speak("Aborting workflow");
      }
    });

    // ========== OUTBOUND: Harness needs input ==========
    bus.subscribe("session:prompt", (event) => {
      state.connection!.speak(event.event.question);
    });
  },

  // ========== OUTBOUND: Harness → User ==========
  on: {
    "phase:start": ({ event, state }) => {
      state.connection?.speak(`Starting phase: ${event.event.name}`);
    },

    "task:complete": ({ event, state }) => {
      state.connection?.speak(`Task ${event.event.id} complete`);
    },

    "narrative": ({ event, state }) => {
      state.connection?.speak(event.event.text);
    },
  },

  onComplete: ({ state, output }) => {
    state.connection?.speak("Workflow complete!");
    state.connection?.disconnect();
    output.success("🎤 Voice interface disconnected");
  },
});
```

**Usage**:
```typescript
import { CodingWorkflow } from "./harness";
import { ConsoleChannel } from "./console-channel";
import { ElevenLabsChannel } from "@openharness/elevenlabs";

const result = await CodingWorkflow
  .create({ prd: "Build a TODO app" })
  .attach(ConsoleChannel)
  .attach(ElevenLabsChannel({
    agentId: process.env.ELEVENLABS_AGENT_ID!,
  }))
  .startSession()  // Enable voice commands
  .complete();
```

### 3.4 Missing Pieces in SDK

**1. Pause/Resume** (Not Implemented):
```typescript
// packages/sdk/src/harness/harness-instance.ts

class HarnessInstance {
  private _paused = false;
  private _pauseResolver: (() => void) | null = null;

  pause(): void {
    if (this._status !== "running") return;
    this._paused = true;
    this._status = "paused";  // New status
    this._emit({ type: "harness:paused", timestamp: new Date() });
  }

  resume(): void {
    if (this._status !== "paused") return;
    this._paused = false;
    this._status = "running";
    this._pauseResolver?.();
    this._pauseResolver = null;
    this._emit({ type: "harness:resumed", timestamp: new Date() });
  }

  private async _checkPause(): Promise<void> {
    if (this._paused) {
      await new Promise<void>(resolve => {
        this._pauseResolver = resolve;
      });
    }
  }

  // Call at phase/task boundaries
  async phase<T>(name: string, fn: () => Promise<T>): Promise<T> {
    await this._checkPause();  // ← Check if paused before starting
    // ... execute phase ...
  }
}
```

**2. HarnessControl Interface**:
```typescript
// packages/sdk/src/infra/unified-events/types.ts

export interface HarnessControl {
  pause(): void;
  resume(): void;
  abort(reason?: string): void;
  getCurrentPhase(): string | null;
  getCurrentTask(): string | null;
}
```

**3. Upgrade AttachmentContext**:
```typescript
// packages/sdk/src/infra/unified-events/types.ts

export interface AttachmentContext {
  transport: Transport;
  bus: IUnifiedEventBus;
  control: HarnessControl;
}

// Update Attachment signature
export type Attachment = (ctx: AttachmentContext) => void | (() => void | Promise<void>);
```

**4. Update defineChannel to Use New Context**:
```typescript
// packages/sdk/src/harness/define-channel.ts

export function defineChannel<TState>(config: {
  name: string;
  state: () => TState;
  onStart?: (ctx: ChannelContext<TState>) => void | Promise<void>;
  on?: Record<string, (ctx: ChannelContext<TState> & { event: EnrichedEvent }) => void>;
  onComplete?: (ctx: ChannelContext<TState>) => void | Promise<void>;
}): Attachment {
  return (attachmentCtx: AttachmentContext) => {  // ← NEW: AttachmentContext
    const state = config.state();
    const ctx: ChannelContext<TState> = {
      state,
      output: attachmentCtx.transport,  // RenderOutput methods
      bus: attachmentCtx.bus,            // ← NEW
      control: attachmentCtx.control,    // ← NEW
    };

    // Rest of implementation...
  };
}
```

---

## Part 4: Implementation Recommendations

### 4.1 Phase 1: SDK Enhancements (4-6 hours)

**Goal**: Make channels bidirectional-capable

**Tasks**:
1. Add `HarnessControl` interface to `types.ts`
2. Implement `pause/resume` in `HarnessInstance`
3. Create `AttachmentContext` interface
4. Update `attach()` to pass `{ transport, bus, control }`
5. Update `defineChannel` to receive new context
6. Update `ConsoleChannel` to accept (but ignore) new params
7. Add tests for pause/resume

**Files to Modify**:
- `packages/sdk/src/infra/unified-events/types.ts`
- `packages/sdk/src/harness/harness-instance.ts`
- `packages/sdk/src/harness/define-channel.ts`
- `examples/coding/src/console-channel.ts`

**Breaking Changes**: None (backward compatible if done carefully)

### 4.2 Phase 2: ElevenLabs Package (8-12 hours)

**Goal**: Standalone package for voice integration

**Package Structure**:
```
packages/elevenlabs/
├── src/
│   ├── index.ts                 # Exports
│   ├── channel.ts               # ElevenLabsChannel factory
│   ├── connection.ts            # SDK wrapper
│   ├── parser.ts                # Voice command parser
│   └── types.ts                 # TypeScript interfaces
├── tests/
│   ├── channel.test.ts
│   ├── connection.test.ts
│   └── parser.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

**Dependencies**:
```json
{
  "dependencies": {
    "@11labs/client": "^3.0.0",
    "@openharness/sdk": "workspace:*"
  },
  "peerDependencies": {
    "@openharness/sdk": ">=0.10.0"
  }
}
```

### 4.3 Phase 3: Example & Docs (2-4 hours)

**Example**:
```typescript
// examples/voice-coding/src/index.ts
import { CodingWorkflow } from "./harness";
import { ConsoleChannel } from "./console-channel";
import { ElevenLabsChannel } from "@openharness/elevenlabs";

async function main() {
  console.log("🎤 Starting voice-controlled coding workflow...");

  const result = await CodingWorkflow
    .create({ prd: "Build a TODO app" })
    .attach(ConsoleChannel)
    .attach(ElevenLabsChannel({
      agentId: process.env.ELEVENLABS_AGENT_ID!,
    }))
    .startSession()
    .complete();

  console.log(`✅ Complete! ${result.result.tasks.length} tasks processed.`);
}

main();
```

**Documentation Additions**:
- README for `@openharness/elevenlabs` package
- Guide: "Building Voice-Enabled Workflows"
- API reference for `ElevenLabsChannel`
- Troubleshooting guide for common issues

### 4.4 Testing Strategy

**Unit Tests**:
```typescript
// packages/elevenlabs/tests/connection.test.ts
describe("ElevenLabsConnection", () => {
  it("should connect successfully", async () => {
    const conn = new ElevenLabsConnection();
    await conn.connect({ agentId: "test-agent" });
    expect(conn.isConnected()).toBe(true);
  });

  it("should retry on transient failures", async () => {
    // Mock SDK to fail twice, succeed third time
    const conn = new ElevenLabsConnection();
    await conn.connect({ agentId: "test-agent" });
    expect(mockSDK.startSession).toHaveBeenCalledTimes(3);
  });

  it("should not retry on auth errors", async () => {
    // Mock 401 error
    await expect(conn.connect({ agentId: "invalid" })).rejects.toThrow();
    expect(mockSDK.startSession).toHaveBeenCalledTimes(1);
  });
});

// packages/elevenlabs/tests/parser.test.ts
describe("Voice Command Parser", () => {
  it("should parse pause commands", () => {
    expect(parseVoiceCommand("pause")).toEqual({
      intent: "pause",
      confidence: 0.9,
      originalText: "pause",
    });

    expect(parseVoiceCommand("hold on a second")).toEqual({
      intent: "pause",
      confidence: 0.9,
      originalText: "hold on a second",
    });
  });

  it("should handle unknown commands", () => {
    expect(parseVoiceCommand("foo bar baz")).toEqual({
      intent: "unknown",
      confidence: 0,
      originalText: "foo bar baz",
    });
  });
});
```

**Integration Tests**:
```typescript
// packages/elevenlabs/tests/channel.test.ts
describe("ElevenLabsChannel", () => {
  it("should speak on phase start", async () => {
    const mockConnection = createMockConnection();
    const channel = ElebenLabsChannel({ agentId: "test" });

    const harness = TestHarness.create()
      .attach(channel)
      .run();

    await harness.phase("Test Phase", async () => {
      // Phase work...
    });

    expect(mockConnection.speak).toHaveBeenCalledWith("Starting phase: Test Phase");
  });

  it("should pause on voice command", async () => {
    const mockConnection = createMockConnection();
    const channel = ElevenLabsChannel({ agentId: "test" });

    const harness = TestHarness.create()
      .attach(channel)
      .startSession()
      .complete();

    // Simulate user saying "pause"
    mockConnection.emit("user_transcript", "pause");

    expect(harness.status).toBe("paused");
  });
});
```

---

## Part 5: Risk Analysis

### 5.1 Technical Risks

**Risk 1: ElevenLabs API Changes**
- **Impact**: Breaking changes in SDK
- **Likelihood**: Low (stable API)
- **Mitigation**: Pin SDK version, monitor changelog, abstract connection layer

**Risk 2: WebSocket Reliability**
- **Impact**: Dropped connections during workflows
- **Likelihood**: Medium (network issues)
- **Mitigation**: Auto-reconnect with exponential backoff, queue events during disconnect

**Risk 3: Voice Command Ambiguity**
- **Impact**: Incorrect intent parsing
- **Likelihood**: Medium (natural language is fuzzy)
- **Mitigation**: Confidence thresholds, ask for clarification if < 0.7

**Risk 4: Latency**
- **Impact**: Slow voice feedback feels unresponsive
- **Likelihood**: Low (ElevenLabs optimized for low latency)
- **Mitigation**: Use WebSocket (not WebRTC) for simplicity, monitor latency metrics

### 5.2 UX Risks

**Risk 1: User Confusion**
- **Impact**: Don't understand how to control via voice
- **Likelihood**: Medium
- **Mitigation**: Clear onboarding ("Say 'pause' to pause, 'status' for updates"), examples

**Risk 2: Audio Pollution**
- **Impact**: Too much narration becomes annoying
- **Likelihood**: High (events are frequent)
- **Mitigation**: Adaptive narration (summarize, skip redundant events), user config

**Risk 3: Microphone Access**
- **Impact**: User denies permission or no mic available
- **Likelihood**: Medium (especially in server environments)
- **Mitigation**: Graceful degradation, fallback to text-only mode

### 5.3 Dependency Risks

**Risk 1: SDK Bloat**
- **Impact**: Channels become bidirectional-capable, increasing complexity
- **Likelihood**: Low
- **Mitigation**: Keep changes minimal (just `bus` and `control` params)

**Risk 2: Breaking Changes**
- **Impact**: Existing channels break if context changes
- **Likelihood**: Low (can be backward compatible)
- **Mitigation**: Make new params optional, existing channels ignore them

---

## Part 6: Open Questions

### 6.1 Architecture Questions

**Q1: Should pause/resume be session-mode-only or available in all modes?**
- **Option A**: Session mode only (voice commands imply interactivity)
- **Option B**: Available always (allows programmatic pause/resume)
- **Recommendation**: **Option B** - pause/resume is useful beyond voice (e.g., rate limiting, wait for external event)

**Q2: How do we handle concurrent voice channels?**
- **Scenario**: User attaches two ElevenLabs channels
- **Problem**: Both would speak simultaneously (audio conflict)
- **Recommendation**: Warn if > 1 ElevenLabs channel detected, proceed but likely a mistake

**Q3: Should voice commands be case-sensitive?**
- **Recommendation**: No, normalize to lowercase for matching

### 6.2 UX Questions

**Q1: Should we record conversation audio?**
- **Privacy Concern**: Recording raises privacy issues
- **Debugging Benefit**: Helpful for troubleshooting
- **Recommendation**: Not in MVP, add as optional feature later with explicit consent

**Q2: How verbose should voice narration be?**
- **Problem**: Too much = annoying, too little = not helpful
- **Recommendation**: Adaptive narration (Phase 1: all events, Phase 2: summaries only)

**Q3: What happens if ElevenLabs API is down?**
- **Option A**: Fail the workflow
- **Option B**: Log warning, continue without voice
- **Recommendation**: **Option B** - voice is enhancement, not requirement

### 6.3 Implementation Questions

**Q1: Should ElevenLabsChannel accept config or read from env?**
- **Recommendation**: Both - config overrides env vars

**Q2: Should we support multiple ElevenLabs agents?**
- **Recommendation**: Not in MVP, single agent per channel

**Q3: Should we expose raw audio streams?**
- **Recommendation**: Not in MVP, text transcripts only

---

## Conclusion

### Key Takeaways

1. **ElevenLabs is a Channel**: It's an I/O interface, not a task executor
2. **SDK is 90% Ready**: Attachment system exists, just needs `bus` and `control` params
3. **Session Mode Already Works**: Voice prompts can leverage existing session infrastructure
4. **Minimal Changes Required**: Upgrade channel context, implement pause/resume, wrap ElevenLabs SDK

### Recommended Approach

**Option 1: Upgrade Channel Pattern** ⭐ **RECOMMENDED**
- Enhance existing `defineChannel` to include `bus` and `control`
- Backward compatible (existing channels ignore new params)
- No new abstractions needed
- Clear upgrade path

**Option 2: New Interface Abstraction**
- Create separate `defineInterface` for bidirectional channels
- More conceptual clarity but adds API surface
- Potentially confusing (why two attachment methods?)

**Why Option 1**: Simpler, backward compatible, no new concepts to learn.

### Next Steps

1. **Validate with User**: Confirm architectural direction (channel vs provider)
2. **Implement Phase 1**: Upgrade SDK channel context (4-6 hours)
3. **Prototype Phase 2**: Create minimal ElevenLabs package (8-12 hours)
4. **Test Integration**: Build voice-coding example (2-4 hours)
5. **Document**: Write guides and API reference (2-3 hours)

**Total Estimated Effort**: 16-27 hours (2-3 days of focused work)

---

## Appendix: Code References

### Explored Files

**Provider Architecture**:
- `/packages/anthropic/src/provider/factory.ts:183-204` - Agent factory
- `/packages/anthropic/src/provider/internal-agent.ts` - Execution engine
- `/packages/anthropic/src/provider/anthropic-event-mapper.ts` - Event mapping

**SDK Core**:
- `/packages/sdk/src/infra/tokens.ts:95-105` - IAgentRunner interface
- `/packages/sdk/src/infra/container.ts` - DI setup
- `/packages/sdk/src/infra/unified-event-bus.ts` - Event system

**Harness System**:
- `/packages/sdk/src/harness/harness-instance.ts:216-224` - Attachment API
- `/packages/sdk/src/harness/harness-instance.ts:550-592` - Cleanup lifecycle
- `/packages/sdk/src/harness/define-channel.ts` - Channel factory
- `/examples/coding/src/console-channel.ts` - Reference implementation

**Session Mode**:
- `/packages/sdk/src/harness/harness-instance.ts:249-289` - Session API
- `/packages/sdk/src/harness/session-context.ts` - Session utilities

### External References

- [ElevenLabs Agents Platform](https://elevenlabs.io/docs/agents-platform/overview)
- [JavaScript SDK](https://elevenlabs.io/docs/agents-platform/libraries/java-script)
- [Quickstart Guide](https://elevenlabs.io/docs/agents-platform/quickstart)
- [React SDK](https://elevenlabs.io/docs/agents-platform/libraries/react)
- [Python SDK](https://elevenlabs.io/docs/agents-platform/libraries/python)
