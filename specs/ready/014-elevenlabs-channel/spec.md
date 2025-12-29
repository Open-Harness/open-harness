# Feature Specification: ElevenLabs Voice Channel

**Feature Branch**: `014-elevenlabs-channel`
**Created**: 2025-12-29
**Status**: Ready (Backlog)
**Input**: Bidirectional voice interface for harness workflows
**Builds On**: 010-transport-architecture (attachment system)
**Package**: `@openharness/elevenlabs`

## Summary

Create a bidirectional voice interface channel for harness workflows using ElevenLabs Conversational AI. The channel enables users to interact with running workflows through natural voice conversation - hearing workflow progress narrated and issuing voice commands to control execution (pause, resume, status checks, inject input).

**Key Insight**: ElevenLabs is NOT a provider (like Anthropic) - it's a **bidirectional interface** to the harness. Voice is an I/O channel alongside console, web, and file channels.

## Problem Statement

Current harness communication is primarily text-based (console logging, web dashboards). Voice interfaces offer unique advantages:

1. **Hands-free operation** - Monitor and control workflows while doing other tasks
2. **Real-time feedback** - Immediate voice narration of workflow events
3. **Natural interaction** - Voice commands feel more intuitive than typing
4. **Accessibility** - Better experience for users with visual impairments
5. **Multimodal workflows** - Combine visual + voice for richer UX

### Current Gaps

- No support for voice I/O in harness system
- Channels are implicitly unidirectional (output only)
- No clear pattern for user input during workflow execution
- Persistent connections (WebSocket/WebRTC) not accommodated in channel pattern

### Why This Matters

Voice-first workflows enable new use cases:
- **Conversational coding assistant** - "Build a TODO app" → hear progress, ask "what's the status?", say "pause for now"
- **DevOps monitoring** - "Run deployment pipeline" → hear each step, interrupt if issues detected
- **HITL workflows** - Voice approval for critical decisions during execution
- **Accessibility** - Screen-reader-friendly workflow monitoring

## Architecture Discovery

### What We Learned

During research, we discovered a **fundamental architectural clarification**:

```
┌─────────────────────────────────────────┐
│  Abstraction Hierarchy                  │
├─────────────────────────────────────────┤
│  Providers   = Task executors (agents)  │
│              Anthropic, Gemini, OpenAI  │
│                                         │
│  Channels    = I/O interfaces           │
│              Console, Voice, Web, File  │
│                                         │
│  Harness     = Workflow orchestrator    │
│              The "brain"                │
└─────────────────────────────────────────┘
```

**ElevenLabs is a channel, not a provider.** It's an interface to the harness, similar to how ConsoleChannel renders to stdout.

### Channel Bidirectionality

Current channels are **implicitly unidirectional**:
```typescript
// ConsoleChannel - OUTPUT ONLY
on: {
  "phase:start": ({ event, output }) => {
    output.line(`Starting ${event.name}`);  // ← Render only
  }
}
```

But channels **should support bidirectional communication**:
```typescript
// ElevenLabsChannel - BIDIRECTIONAL
on: {
  "phase:start": ({ event, state }) => {
    state.conversation.speak(`Starting ${event.name}`);  // ← Output
  },

  // Handle user voice input
  onUserSpeech: ({ text, bus, control }) => {
    if (text.includes("pause")) {
      control.pause();  // ← Input affects harness
    }
  }
}
```

**Problem**: Current `ChannelContext` doesn't expose `bus` or `control` - channels can't emit events or control the harness.

## User Scenarios & Testing

### User Story 1 - Voice-Narrated Workflow (Priority: P1)

A developer runs a coding workflow and wants to hear progress via voice while working on other tasks. They attach the ElevenLabs channel and the workflow is narrated in real-time.

**Acceptance Scenarios**:

1. **Given** a coding workflow with ElevenLabsChannel attached, **When** the workflow starts, **Then** the channel speaks "Starting phase: Planning" for each phase
2. **Given** a task completes successfully, **When** the event is emitted, **Then** the channel speaks "Task completed: ${taskId}"
3. **Given** a narrative event from the agent's internal monologue, **When** emitted, **Then** the channel speaks the narrative text
4. **Given** the workflow completes, **When** the final result is available, **Then** the channel speaks "Workflow complete! X tasks processed"

---

### User Story 2 - Voice Command Control (Priority: P2)

A developer wants to control a running workflow using voice commands. They can say "pause", "resume", "what's the status?", or "abort" and the harness responds accordingly.

**Acceptance Scenarios**:

1. **Given** a running workflow with voice channel in session mode, **When** user says "pause", **Then** `control.pause()` is called and execution pauses
2. **Given** a paused workflow, **When** user says "resume", **Then** execution continues
3. **Given** any workflow state, **When** user says "what's the status?", **Then** the channel responds with current phase and task
4. **Given** a running workflow, **When** user says "abort", **Then** `bus.emit({ type: "session:abort" })` triggers graceful shutdown

---

### User Story 3 - Voice-Driven User Prompts (Priority: P2)

A developer builds an interactive workflow that needs user approval. When the workflow emits `session:prompt`, the channel speaks the question and waits for voice response.

**Acceptance Scenarios**:

1. **Given** a workflow that calls `session.waitForUser("Should I proceed?")`, **When** the prompt event is emitted, **Then** the channel speaks "Should I proceed?" via ElevenLabs
2. **Given** a user prompt is active, **When** the user speaks "yes", **Then** `transport.reply(promptId, { text: "yes" })` is called
3. **Given** multiple choice prompt with choices ["approve", "reject"], **When** user speaks "approve", **Then** the matched choice is returned
4. **Given** the user response resolves the prompt, **When** `session:reply` is emitted, **Then** the channel speaks confirmation "Proceeding..."

---

### User Story 4 - Persistent Connection Management (Priority: P3)

A developer wants the ElevenLabs connection to persist across multiple workflow phases without reconnecting. The channel manages the WebSocket lifecycle automatically.

**Acceptance Scenarios**:

1. **Given** ElevenLabsChannel is attached, **When** `run()` starts, **Then** the WebSocket connection to ElevenLabs is established once
2. **Given** the workflow has 3 phases, **When** transitioning between phases, **Then** the same WebSocket connection is reused
3. **Given** the workflow completes normally, **When** cleanup runs, **Then** the ElevenLabs session is ended gracefully
4. **Given** an abort is triggered, **When** cleanup runs, **Then** the session is disconnected and resources cleaned up

---

### User Story 5 - Compose Voice + Console Channels (Priority: P3)

A developer wants both visual console output AND voice narration. They attach both channels and each receives events independently.

**Acceptance Scenarios**:

1. **Given** both ConsoleChannel and ElevenLabsChannel attached, **When** an event is emitted, **Then** both channels receive it
2. **Given** console channel renders detailed logs, **When** voice channel narrates, **Then** voice summarizes (shorter messages)
3. **Given** both channels attached, **When** the workflow completes, **Then** both cleanup functions are called in reverse order

---

## Technical Requirements

### FR-001: Upgrade Channel Context (BREAKING)

**Requirement**: Channels must have access to `IUnifiedEventBus` and `HarnessControl` for bidirectional communication.

**Current State**:
```typescript
export interface ChannelContext<TState> {
  state: TState;
  output: RenderOutput;  // Only output methods
}
```

**Required State**:
```typescript
export interface ChannelContext<TState> {
  state: TState;
  output: RenderOutput;
  bus: IUnifiedEventBus;      // ← NEW: Emit events to harness
  control: HarnessControl;    // ← NEW: Control harness execution
}

export interface HarnessControl {
  pause(): void;
  resume(): void;
  abort(reason?: string): void;
  getCurrentPhase(): string | null;
  getCurrentTask(): string | null;
}
```

**Acceptance Criteria**:
- `defineChannel` receives `AttachmentContext` with `bus` and `control`
- Existing channels continue to work (they simply ignore new properties)
- `HarnessControl` methods delegate to `HarnessInstance` internal methods

---

### FR-002: ElevenLabs Connection Wrapper

**Requirement**: Create a clean TypeScript wrapper around the ElevenLabs SDK's `Conversation` API.

**Interface**:
```typescript
export class ElevenLabsConnection {
  async connect(config: {
    agentId: string;
    signedUrl?: string;
    conversationToken?: string;
  }): Promise<void>;

  speak(text: string): void;
  on(event: "user_transcript" | "agent_response" | "disconnect", handler: (data: any) => void): void;
  disconnect(): void;
}
```

**Acceptance Criteria**:
- Wraps `@11labs/client` SDK's `Conversation.startSession()`
- Handles WebSocket/WebRTC connection lifecycle
- Provides type-safe event handlers
- Auto-reconnect on transient failures (3 retries with exponential backoff)

---

### FR-003: ElevenLabsChannel Implementation

**Requirement**: Implement the channel that connects ElevenLabs to harness events.

**Key Features**:
- **Output**: Listen to harness events → speak via ElevenLabs
- **Input**: Listen to user speech → emit events to harness
- **Lifecycle**: Connect on `onStart`, disconnect on `onComplete`
- **State Management**: Track conversation state, transcript history

**Acceptance Criteria**:
- Speaks on `phase:start`, `task:complete`, `narrative` events
- Parses voice commands: "pause", "resume", "status", "abort"
- Emits `session:reply` for user prompts
- Maintains transcript of full conversation
- Graceful degradation if ElevenLabs API unavailable

---

### FR-004: Voice Command Parser

**Requirement**: Extract intent from user speech and map to harness commands.

**Supported Commands**:
- "pause" / "hold on" / "wait" → `control.pause()`
- "resume" / "continue" / "go ahead" → `control.resume()`
- "status" / "what's happening" / "where are we" → Respond with current phase/task
- "abort" / "cancel" / "stop" → `bus.emit({ type: "session:abort" })`
- "yes" / "no" / "approve" / "reject" → Resolve active prompt

**Acceptance Criteria**:
- Intent detection with fuzzy matching
- Support for natural language variations
- Default to "unknown command" response for unrecognized input
- Log all parsed commands for debugging

---

### FR-005: Pause/Resume Control

**Requirement**: Implement pause/resume in `HarnessInstance` for voice control.

**Implementation**:
```typescript
class HarnessInstance {
  private _paused = false;
  private _pauseResolver: (() => void) | null = null;

  pause(): void {
    this._paused = true;
  }

  resume(): void {
    this._paused = false;
    this._pauseResolver?.();
  }

  private async _checkPause(): Promise<void> {
    if (this._paused) {
      await new Promise<void>(resolve => {
        this._pauseResolver = resolve;
      });
    }
  }
}
```

**Acceptance Criteria**:
- `pause()` sets flag, blocks at next phase/task boundary
- `resume()` clears flag, resolves waiting promise
- Pause/resume only works in session mode
- Status transitions: `running` → `paused` → `running`

---

### FR-006: Connection Configuration

**Requirement**: Support multiple ElevenLabs authentication methods.

**Config Options**:
```typescript
export interface ElevenLabsConfig {
  agentId?: string;              // Public agent (no auth)
  signedUrl?: string;            // Pre-signed URL for private agent
  conversationToken?: string;    // Token-based auth
  autoReconnect?: boolean;       // Default: true
  maxReconnectAttempts?: number; // Default: 3
  verbosity?: "silent" | "normal" | "debug"; // Default: "normal"
}
```

**Acceptance Criteria**:
- Config can be passed to `ElevenLabsChannel` or via environment variables
- Validation throws clear error if no auth method provided
- Supports all ElevenLabs auth patterns (WebSocket, WebRTC)

---

## Research Findings

### ElevenLabs Conversational AI Overview

**Product**: Conversational voice agents with WebSocket/WebRTC connections
**SDKs Available**: JavaScript, React, Python, Swift
**Connection Model**: Persistent bidirectional audio + text streaming

**Key Features**:
- **Real-time voice synthesis** - Low-latency speech generation
- **Speech-to-text** - Automatic transcript generation
- **Conversation state** - Agent remembers context across turns
- **Multimodal** - Text + audio streams simultaneously
- **WebRTC/WebSocket** - Choose protocol based on use case

### JavaScript SDK Integration

**Package**: `@11labs/client`

**Core API**:
```typescript
import { Conversation } from "@11labs/client";

const conversation = await Conversation.startSession({
  agentId: "your-agent-id",
  // OR for authenticated agents:
  signedUrl: "...",
  conversationToken: "...",
});

// Listen to events
conversation.on("user_transcript", (text: string) => {
  console.log("User said:", text);
});

conversation.on("agent_response", (response) => {
  console.log("Agent responded:", response);
});

// Send messages
conversation.speak("Hello! How can I help you?");

// Cleanup
conversation.endSession();
```

**Event Types**:
- `connected` - WebSocket connection established
- `user_transcript` - User's speech transcribed to text
- `agent_response` - Agent's spoken response (text + audio)
- `thinking` - Agent is processing (no audio yet)
- `disconnect` - Connection closed

### Authentication Patterns

**1. Public Agent (No Auth)**:
```typescript
{ agentId: "public-agent-id" }
```

**2. Signed URL (Private Agent)**:
```typescript
// Generate via REST API first
const { signedUrl } = await fetch("/v1/convai/agents/auth").then(r => r.json());
{ signedUrl }
```

**3. Conversation Token (WebRTC)**:
```typescript
const { conversationToken } = await fetch("/v1/convai/agents/token").then(r => r.json());
{ conversationToken }
```

### WebSocket vs WebRTC

**WebSocket**:
- Simpler setup
- Lower browser compatibility requirements
- Good for server-side applications
- Use `signedUrl` or `agentId`

**WebRTC**:
- Lower latency (peer-to-peer)
- Better for browser-based UIs
- Requires `conversationToken`
- More complex NAT traversal

**Recommendation**: Start with WebSocket for CLI/server use cases.

### Error Handling

**Common Failures**:
- `401 Unauthorized` - Invalid agent ID or auth token
- `404 Not Found` - Agent doesn't exist
- `429 Rate Limited` - Too many concurrent connections
- `503 Service Unavailable` - ElevenLabs API down

**Retry Strategy**:
```typescript
let attempts = 0;
while (attempts < MAX_RETRIES) {
  try {
    await conversation.startSession(config);
    break;
  } catch (error) {
    if (error.status === 401 || error.status === 404) {
      throw error; // Don't retry auth errors
    }
    attempts++;
    await sleep(2 ** attempts * 1000); // Exponential backoff
  }
}
```

## Implementation Approach

### Phase 1: Upgrade Channel Context (SDK Core)

**Goal**: Make channels bidirectional-capable

**Tasks**:
1. Add `HarnessControl` interface to `packages/sdk/src/infra/unified-events/types.ts`
2. Implement `pause/resume` in `HarnessInstance`
3. Update `AttachmentContext` to include `bus` and `control`
4. Update `defineChannel` to pass new context to channels
5. Update existing channels (ConsoleChannel) to accept new params (backward compatible)
6. Add tests for pause/resume functionality

**Estimated Effort**: 4-6 hours

---

### Phase 2: Create ElevenLabs Package (New Package)

**Goal**: Standalone package for ElevenLabs integration

**Structure**:
```
packages/elevenlabs/
├── src/
│   ├── index.ts                 # Public exports
│   ├── channel.ts               # ElevenLabsChannel definition
│   ├── connection.ts            # WebSocket wrapper
│   ├── parser.ts                # Voice command parser
│   └── types.ts                 # TypeScript interfaces
├── tests/
│   ├── channel.test.ts          # Channel tests (mocked connection)
│   ├── connection.test.ts       # Connection wrapper tests
│   └── parser.test.ts           # Command parser tests
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

**Estimated Effort**: 8-12 hours

---

### Phase 3: Voice Command Parser (Feature)

**Goal**: Intent extraction from natural language

**Implementation**:
```typescript
export interface ParsedCommand {
  intent: "pause" | "resume" | "status" | "abort" | "response" | "unknown";
  confidence: number;
  originalText: string;
  entities?: Record<string, string>;
}

export function parseVoiceCommand(text: string): ParsedCommand {
  const normalized = text.toLowerCase().trim();

  // Pattern matching with confidence scoring
  if (/\b(pause|hold on|wait)\b/.test(normalized)) {
    return { intent: "pause", confidence: 0.9, originalText: text };
  }

  if (/\b(resume|continue|go ahead|proceed)\b/.test(normalized)) {
    return { intent: "resume", confidence: 0.9, originalText: text };
  }

  if (/\b(status|where are we|what's happening)\b/.test(normalized)) {
    return { intent: "status", confidence: 0.85, originalText: text };
  }

  if (/\b(abort|cancel|stop)\b/.test(normalized)) {
    return { intent: "abort", confidence: 0.95, originalText: text };
  }

  // Check for yes/no responses
  if (/\b(yes|yeah|yep|sure|okay|ok)\b/.test(normalized)) {
    return { intent: "response", confidence: 0.8, originalText: text, entities: { value: "yes" } };
  }

  if (/\b(no|nope|nah)\b/.test(normalized)) {
    return { intent: "response", confidence: 0.8, originalText: text, entities: { value: "no" } };
  }

  return { intent: "unknown", confidence: 0, originalText: text };
}
```

**Estimated Effort**: 4-6 hours

---

### Phase 4: Integration Example (Documentation)

**Goal**: Working example demonstrating voice-controlled workflow

**Example**:
```typescript
// examples/voice-coding/src/index.ts
import { CodingWorkflow } from "./harness";
import { ConsoleChannel } from "./console-channel";
import { ElevenLabsChannel } from "@openharness/elevenlabs";

async function main() {
  console.log("🎤 Starting voice-controlled coding workflow...");
  console.log("   Say 'pause' to pause, 'resume' to continue, 'status' for updates");

  const result = await CodingWorkflow
    .create({ prd: "Build a TODO app with add, complete, and delete" })
    .attach(ConsoleChannel)           // Visual feedback
    .attach(ElevenLabsChannel({       // Voice interface
      agentId: process.env.ELEVENLABS_AGENT_ID!,
      verbosity: "normal",
    }))
    .startSession()                   // Enable voice commands
    .complete();

  console.log(`\n✅ Complete! ${result.result.tasks.length} tasks processed.`);
}

main();
```

**Estimated Effort**: 2-4 hours

---

## Testing Strategy

### Unit Tests

**`connection.test.ts`**:
- Mock `@11labs/client` SDK
- Test connection establishment
- Test event handlers
- Test reconnection logic
- Test cleanup

**`parser.test.ts`**:
- Test all command patterns
- Test confidence scoring
- Test entity extraction
- Test unknown input handling

**`channel.test.ts`**:
- Mock ElevenLabsConnection
- Test event listening (output)
- Test voice command handling (input)
- Test lifecycle (onStart, onComplete)
- Test transcript tracking

### Integration Tests

**`voice-workflow.test.ts`**:
- Full workflow with mocked ElevenLabs
- Emit events, verify speech calls
- Inject voice commands, verify control calls
- Test prompt/reply flow
- Test pause/resume during execution

### Manual Testing

**Prerequisites**:
- ElevenLabs account with API access
- Configured agent in ElevenLabs dashboard
- Microphone-enabled environment

**Test Cases**:
1. Run example workflow, verify voice narration
2. Say "pause", verify execution pauses and voice confirms
3. Say "resume", verify execution continues
4. Say "status", verify current phase/task spoken
5. Say "abort", verify graceful shutdown

## Success Metrics

**Developer Experience**:
- [ ] Voice channel attachable in < 3 lines of code
- [ ] No configuration required for default use case (env vars)
- [ ] Clear error messages for missing auth
- [ ] Works alongside other channels (composable)

**Functionality**:
- [ ] Voice commands recognized with > 90% accuracy
- [ ] Pause/resume works without race conditions
- [ ] Connection auto-recovers from transient failures
- [ ] Cleanup always called (no leaked connections)

**Performance**:
- [ ] Voice narration latency < 500ms from event emission
- [ ] Voice command processing < 200ms
- [ ] WebSocket overhead < 5% of workflow execution time

## Non-Goals (Out of Scope)

- ❌ Custom voice models or fine-tuning
- ❌ Speaker identification (multi-user conversations)
- ❌ Recording/playback of conversation audio
- ❌ Voice-to-code generation (ElevenLabs as an agent)
- ❌ Integration with other voice providers (Google, Azure, AWS)

## Future Enhancements (Post-MVP)

**FR-007: Adaptive Narration**:
- Short summaries vs detailed explanations based on user preference
- Skip redundant phase announcements
- Intelligent event filtering (only speak important events)

**FR-008: Multi-Language Support**:
- Detect user language from first utterance
- Switch agent voice based on locale
- Translate commands across languages

**FR-009: Voice Analytics**:
- Track command usage frequency
- Measure user sentiment (tone analysis)
- Optimize command patterns based on usage

**FR-010: Visual + Voice Hybrid**:
- Show transcript in console alongside voice
- Highlight current spoken item in visual UI
- Synchronized progress bars with voice narration

## Dependencies & Risks

### External Dependencies

**ElevenLabs API**:
- **Risk**: API changes break integration
- **Mitigation**: Pin SDK version, monitor changelog, abstract connection layer

**Network Connectivity**:
- **Risk**: WebSocket drops during long workflows
- **Mitigation**: Auto-reconnect with exponential backoff, queue events during disconnect

**Microphone Access**:
- **Risk**: User denies permission or hardware unavailable
- **Mitigation**: Graceful degradation, fallback to text-only mode

### Internal Dependencies

**010-transport-architecture**:
- **Status**: Implemented (attachment system exists)
- **Blocker**: Need to add `bus` and `control` to channel context (Phase 1)

**Session Mode**:
- **Status**: Implemented (`.startSession()` and `.complete()` exist)
- **Usage**: Required for voice commands to work

**Pause/Resume**:
- **Status**: NOT implemented
- **Blocker**: Phase 1 must implement this in `HarnessInstance`

## Open Questions

1. **Voice Agent Configuration**: Should we require users to configure the ElevenLabs agent personality/voice, or provide a default?
   - **Recommendation**: Provide sensible defaults, allow override via config

2. **Command Ambiguity**: How do we handle when a voice command could match multiple intents?
   - **Recommendation**: Use confidence thresholds, ask for clarification if < 0.7

3. **Concurrent Voice Channels**: Can multiple voice channels attach to the same harness?
   - **Recommendation**: Yes, but warn if > 1 ElevenLabs channel detected (likely a mistake)

4. **Audio Recording**: Should we save conversation audio for debugging?
   - **Recommendation**: Not in MVP, add as optional feature later (privacy concerns)

5. **Offline Mode**: What happens if ElevenLabs API is unreachable?
   - **Recommendation**: Log warning, continue workflow without voice (don't block execution)

## References

### Documentation
- [ElevenLabs Agents Platform Overview](https://elevenlabs.io/docs/agents-platform/overview)
- [ElevenLabs JavaScript SDK](https://elevenlabs.io/docs/agents-platform/libraries/java-script)
- [ElevenLabs Quickstart Guide](https://elevenlabs.io/docs/agents-platform/quickstart)
- [ElevenLabs React SDK](https://elevenlabs.io/docs/agents-platform/libraries/react)
- [ElevenLabs Python SDK](https://elevenlabs.io/docs/agents-platform/libraries/python)

### Internal Specs
- `010-transport-architecture` - Attachment system foundation
- `008-unified-event-system` - Event bus infrastructure

### Code References
- `packages/sdk/src/harness/harness-instance.ts` - Harness attachment API
- `packages/sdk/src/harness/define-channel.ts` - Channel factory pattern
- `examples/coding/src/console-channel.ts` - Reference channel implementation
