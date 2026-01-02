# Feature: ElevenLabs Voice Channel

**Status**: Ready (Backlog)
**Priority**: P2 (Nice-to-have enhancement)
**Estimated Effort**: 16-27 hours (2-3 days)
**Package**: `@openharness/elevenlabs` (new)
**Dependencies**: `010-transport-architecture` (attachment system)

---

## Quick Summary

Add bidirectional voice interface to harness workflows using ElevenLabs Conversational AI. Users can:
- **Hear** workflow progress narrated in real-time via voice
- **Control** workflow execution with voice commands ("pause", "resume", "status")
- **Interact** with prompts using natural speech

**Key Architectural Insight**: ElevenLabs is a **channel** (I/O interface), not a provider (task executor). This discovery clarifies the abstraction hierarchy and requires only minor SDK enhancements.

---

## Contents

- **`spec.md`** - Full feature specification with requirements, user stories, technical details
- **`research.md`** - Comprehensive research findings (120+ pages) covering:
  - Provider architecture analysis
  - SDK core patterns
  - Harness attachment system
  - ElevenLabs API capabilities
  - Implementation recommendations
- **`reference-implementation.ts`** - Working code example showing minimal ElevenLabs channel
- **`README.md`** - This file (overview and navigation)

---

## Why This Feature Matters

### Problem

Current harness workflows are text-based (console logs, web dashboards). Users must actively monitor terminal output or dashboards, which:
- Requires visual attention (can't multitask)
- Is less accessible for users with visual impairments
- Feels mechanical and impersonal
- Limits hands-free operation

### Solution

Voice interface enables:
- **Hands-free monitoring** - Listen to workflow progress while doing other tasks
- **Natural interaction** - Speak commands instead of typing
- **Accessibility** - Screen-reader-friendly workflow control
- **Multimodal UX** - Combine visual + voice for richer experience

### Use Cases

1. **Conversational Coding Assistant**
   - "Build a TODO app" → Hear planning, coding, review phases
   - Say "pause" to interrupt, "what's the status?" for updates
   - Voice approval for code reviews

2. **DevOps Monitoring**
   - Run deployment pipeline → Hear each step narrated
   - Say "abort" if issues detected during deploy
   - Voice alerts for critical failures

3. **HITL Workflows**
   - Workflow asks "Should I proceed with migration?" via voice
   - User responds "yes" or "no" naturally
   - Workflow continues based on voice response

---

## Architecture Overview

### What We Discovered

During research, we clarified the **abstraction hierarchy**:

```
┌─────────────────────────────────────────┐
│  Providers   = Task executors (agents)  │
│              Anthropic, Gemini, OpenAI  │
│              Implement IAgentRunner     │
├─────────────────────────────────────────┤
│  Channels    = I/O interfaces           │
│              Console, Voice, Web, File  │
│              Use Attachment API         │
├─────────────────────────────────────────┤
│  Harness     = Workflow orchestrator    │
│              The "brain"                │
└─────────────────────────────────────────┘
```

**ElevenLabs is a channel**, not a provider. It doesn't execute tasks—it's an interface for voice I/O.

### Current Channel Pattern (Unidirectional)

```typescript
// ConsoleChannel - OUTPUT ONLY
on: {
  "phase:start": ({ event, output }) => {
    output.line(`Starting ${event.name}`);  // ← Render only
  }
}
```

**Problem**: No way to emit events back to harness or control execution.

### Enhanced Channel Pattern (Bidirectional)

```typescript
// ElevenLabsChannel - BIDIRECTIONAL
on: {
  "phase:start": ({ event, state }) => {
    state.conversation.speak(`Starting ${event.name}`);  // ← Output
  },

  onUserSpeech: ({ text, bus, control }) => {
    if (text.includes("pause")) {
      control.pause();  // ← Input affects harness
    }
  }
}
```

**Solution**: Upgrade `ChannelContext` to include `bus` and `control`.

---

## Implementation Plan

### Phase 1: SDK Enhancements (4-6 hours)

**Goal**: Make channels bidirectional-capable

**Changes**:
1. Add `HarnessControl` interface with `pause/resume/abort/getCurrentPhase/getCurrentTask`
2. Implement `pause/resume` in `HarnessInstance`
3. Upgrade `AttachmentContext` to include `{ transport, bus, control }`
4. Update `defineChannel` to pass new context to channels
5. Update `ConsoleChannel` to accept (but ignore) new params (backward compatible)

**Files Modified**:
- `packages/sdk/src/infra/unified-events/types.ts`
- `packages/sdk/src/harness/harness-instance.ts`
- `packages/sdk/src/harness/define-channel.ts`
- `examples/coding/src/console-channel.ts`

**Result**: All channels become bidirectional-capable without breaking changes.

---

### Phase 2: ElevenLabs Package (8-12 hours)

**Goal**: Standalone package for voice integration

**Package Structure**:
```
packages/elevenlabs/
├── src/
│   ├── index.ts                 # Public exports
│   ├── channel.ts               # ElevenLabsChannel definition
│   ├── connection.ts            # WebSocket wrapper
│   ├── parser.ts                # Voice command parser
│   └── types.ts                 # TypeScript interfaces
├── tests/
│   ├── channel.test.ts          # Channel tests (mocked)
│   ├── connection.test.ts       # Connection wrapper tests
│   └── parser.test.ts           # Command parser tests
├── package.json
├── tsconfig.json
└── README.md
```

**Key Components**:

**1. Connection Wrapper** (`connection.ts`):
- Wraps `@11labs/client` SDK
- Handles connection lifecycle (connect, disconnect, auto-reconnect)
- Type-safe event handlers
- Exponential backoff on transient failures

**2. Voice Command Parser** (`parser.ts`):
- Intent extraction from natural language
- Supported commands: pause, resume, status, abort, yes/no
- Confidence scoring
- Fuzzy matching for variations

**3. Channel Implementation** (`channel.ts`):
- Listens to harness events → speaks via ElevenLabs (output)
- Listens to user speech → emits events to harness (input)
- Lifecycle management (connect on start, disconnect on complete)
- Transcript tracking

**Dependencies**:
```json
{
  "dependencies": {
    "@11labs/client": "^3.0.0",
    "@openharness/sdk": "workspace:*"
  }
}
```

---

### Phase 3: Example & Documentation (2-4 hours)

**Example**:
```typescript
// examples/voice-coding/src/index.ts
import { CodingWorkflow } from "./harness";
import { ConsoleChannel } from "./console-channel";
import { ElevenLabsChannel } from "@openharness/elevenlabs";

async function main() {
  console.log("🎤 Starting voice-controlled coding workflow...");
  console.log("   Say 'pause' to pause, 'resume' to continue");

  const result = await CodingWorkflow
    .create({ prd: "Build a TODO app" })
    .attach(ConsoleChannel)           // Visual feedback
    .attach(ElevenLabsChannel({       // Voice interface
      agentId: process.env.ELEVENLABS_AGENT_ID!,
      verbosity: "normal",
    }))
    .startSession()                   // Enable voice commands
    .complete();

  console.log(`✅ Complete! ${result.result.tasks.length} tasks`);
}

main();
```

**Documentation**:
- Package README with quickstart
- Guide: "Building Voice-Enabled Workflows"
- API reference for `ElevenLabsChannel`
- Troubleshooting common issues

---

## Usage Example (Full)

```typescript
import { defineHarness } from "@openharness/sdk";
import { ElevenLabsChannel } from "@openharness/elevenlabs";
import { CodingAgent, PlannerAgent } from "@openharness/anthropic/presets";

// Define workflow
const CodingWorkflow = defineHarness({
  name: "voice-coding",
  agents: { planner: PlannerAgent, coder: CodingAgent },
  state: (input: { prd: string }) => ({
    prd: input.prd,
    tasks: [],
  }),
  run: async ({ agents, state, phase, task }) => {
    await phase("Planning", async () => {
      const plan = await agents.planner.execute({ prd: state.prd });
      state.tasks = plan.tasks;
    });

    await phase("Coding", async () => {
      for (const planTask of state.tasks) {
        await task(planTask.id, async () => {
          const code = await agents.coder.execute({ task: planTask.description });
          // ... store result ...
        });
      }
    });

    return { tasks: state.tasks };
  },
});

// Run with voice interface
const result = await CodingWorkflow
  .create({ prd: "Build a TODO app" })
  .attach(ElevenLabsChannel({
    agentId: process.env.ELEVENLABS_AGENT_ID!,
  }))
  .startSession()  // ← Enables voice commands
  .complete();

// User experience:
// 🔊 "Starting phase: Planning"
// 🔊 "Working on task 1"
// 🗣️ User: "pause"
// 🔊 "Pausing workflow"
// 🗣️ User: "resume"
// 🔊 "Resuming workflow"
// 🔊 "Task 1 is done"
// ...
// 🔊 "Workflow complete!"
```

---

## Testing Strategy

### Unit Tests

**Connection Wrapper**:
- ✅ Connects successfully with valid config
- ✅ Retries on transient failures (429, 503, network)
- ✅ Does NOT retry on auth errors (401, 404)
- ✅ Exponential backoff works correctly
- ✅ Events are forwarded from SDK to handlers

**Voice Parser**:
- ✅ Recognizes all command patterns
- ✅ Handles variations ("pause" vs "hold on")
- ✅ Confidence scoring works
- ✅ Returns "unknown" for unrecognized input
- ✅ Extracts entities from responses

**Channel**:
- ✅ Speaks on harness events (phase:start, task:complete, etc.)
- ✅ Parses voice commands and calls control methods
- ✅ Handles prompts (session:prompt → speak question)
- ✅ Manages connection lifecycle (connect/disconnect)
- ✅ Tracks transcript correctly

### Integration Tests

**Full Workflow**:
- ✅ Run harness with mocked ElevenLabs connection
- ✅ Emit events, verify speak() calls
- ✅ Inject voice commands, verify control calls
- ✅ Test prompt/reply flow end-to-end
- ✅ Test pause/resume during execution
- ✅ Test cleanup on abort

### Manual Testing

**Prerequisites**:
- ElevenLabs account with API access
- Configured agent in dashboard
- Microphone-enabled environment

**Test Cases**:
1. Run example, verify voice narration of phases/tasks
2. Say "pause", verify execution pauses + voice confirms
3. Say "resume", verify execution continues
4. Say "status", verify current phase/task spoken
5. Say "abort", verify graceful shutdown with voice confirmation

---

## Success Criteria

**Developer Experience**:
- [ ] Voice channel attachable in < 3 lines of code
- [ ] No configuration required for default use (env vars work)
- [ ] Clear error messages for missing auth
- [ ] Works alongside other channels (composable)
- [ ] Backward compatible (existing channels unaffected)

**Functionality**:
- [ ] Voice commands recognized with > 90% accuracy
- [ ] Pause/resume works without race conditions
- [ ] Connection auto-recovers from transient failures
- [ ] Cleanup always called (no leaked connections)
- [ ] Session mode integration works seamlessly

**Performance**:
- [ ] Voice narration latency < 500ms from event emission
- [ ] Voice command processing < 200ms
- [ ] WebSocket overhead < 5% of workflow execution time

---

## Open Questions

1. **Voice Agent Configuration**: Should we require users to configure the ElevenLabs agent personality/voice, or provide defaults?
   - **Recommendation**: Sensible defaults, allow override via config

2. **Command Ambiguity**: How do we handle when a voice command could match multiple intents?
   - **Recommendation**: Use confidence thresholds, ask for clarification if < 0.7

3. **Concurrent Voice Channels**: Can multiple voice channels attach to the same harness?
   - **Recommendation**: Yes, but warn if > 1 detected (likely a mistake)

4. **Offline Mode**: What happens if ElevenLabs API is unreachable?
   - **Recommendation**: Log warning, continue workflow without voice (don't block)

---

## Next Steps

### For Product Manager

1. **Validate approach**: Is channel pattern correct? Should it be a provider?
2. **Prioritize**: When should this be built? (Backlog vs next sprint)
3. **Use cases**: What specific workflows would benefit most?

### For Engineer

1. **Review research.md**: Understand architectural decisions
2. **Review reference-implementation.ts**: See minimal working code
3. **Estimate effort**: 16-27 hours realistic? Adjust based on team velocity
4. **Plan dependencies**: Schedule Phase 1 (SDK changes) first

### For Designer

1. **UX flow**: How should voice commands be discovered?
2. **Error states**: What should happen on connection failures?
3. **Adaptive narration**: How verbose should voice output be?

---

## References

### Documentation
- **spec.md** - Full feature specification
- **research.md** - 120+ pages of research findings
- **reference-implementation.ts** - Working code example

### External Resources
- [ElevenLabs Agents Platform](https://elevenlabs.io/docs/agents-platform/overview)
- [JavaScript SDK Docs](https://elevenlabs.io/docs/agents-platform/libraries/java-script)
- [Quickstart Guide](https://elevenlabs.io/docs/agents-platform/quickstart)

### Internal Specs
- `010-transport-architecture` - Attachment system foundation
- `008-unified-event-system` - Event bus infrastructure
- `examples/coding/src/console-channel.ts` - Reference channel implementation

---

## Questions?

**Architecture**: See `research.md` Part 3 (Architecture Synthesis)
**Implementation**: See `reference-implementation.ts`
**Requirements**: See `spec.md` Technical Requirements section
**API Details**: See `research.md` Part 2 (ElevenLabs API Research)
