# Implementation Plan: Open Harness SDK Core

**Branch**: `spec-kit/fix-1` | **Date**: 2025-12-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification + architectural audit findings

## Summary

Fix the broken SDK by implementing missing components (BaseAnthropicAgent), integrating the recording system properly, adding the monologue decorator, and consolidating the callback system. This plan addresses all P1/P2 user stories from the spec.

---

## Technical Context

**Language/Version**: TypeScript 5.x with strict mode
**Runtime**: Bun 1.x
**Primary Dependencies**:
- `@anthropic-ai/claude-agent-sdk` ^0.1.76 (LLM execution)
- `@needle-di/core` ^1.1.0 (Dependency injection)
- `zod` ^4.2.1 (Schema validation)
- `handlebars` (Prompt templating)

**Storage**: JSONL files for recordings (`recordings/`)
**Testing**: `bun:test` with recording/replay pattern
**Target Platform**: Node.js/Bun library (not web)

**Performance Goals**: N/A (library, not service)
**Constraints**: Must work with Anthropic SDK's async generator pattern
**Scale/Scope**: SDK for building agent workflows

---

## Constitution Check

*GATE: Verify against constitution principles before implementation.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Type Safety First** | ✅ Will comply | All new code uses strict TS, Zod schemas, typed tokens |
| **II. Verified by Reality** | ✅ Will comply | Recording at agent level, golden fixtures, live integration tests |
| **III. DI Discipline** | ✅ Will comply | Decorators are injectable, factories hide complexity |

**No violations anticipated.** Architecture follows all constitutional principles.

---

## Project Structure

### Documentation (this feature)

```
specs/001-sdk-core/
├── spec.md              # Feature specification (done)
├── plan.md              # This file
├── research.md          # N/A (existing codebase)
├── data-model.md        # Entity relationships (below)
└── tasks.md             # Generated from /speckit.tasks
```

### Source Code (SDK)

```
packages/sdk/src/
├── index.ts                    # Public API exports
├── core/
│   ├── container.ts            # DI composition root
│   ├── tokens.ts               # Injection tokens
│   └── decorators.ts           # @Record decorator (to refactor)
├── agents/
│   ├── index.ts                # Agent exports
│   ├── types.ts                # IAgent, AgentDefinition, etc.
│   ├── base-anthropic-agent.ts # [CREATE] Base class for Anthropic agents
│   ├── coding-agent.ts         # [UPDATE] Extend BaseAnthropicAgent
│   ├── review-agent.ts         # [UPDATE] Extend BaseAnthropicAgent
│   └── planner-agent.ts        # [UPDATE] Extend BaseAnthropicAgent
├── runner/
│   ├── anthropic-runner.ts     # Anthropic SDK wrapper
│   ├── base-agent.ts           # [DELETE] Deprecated, replaced by agents/
│   └── models.ts               # AgentEvent types
├── recording/                  # [CREATE] Recording subsystem
│   ├── index.ts                # Exports
│   ├── types.ts                # IRecorder, RecordedSession
│   ├── recorder.ts             # Records agent execution
│   ├── replayer.ts             # Replays recorded sessions
│   └── decorator.ts            # Injectable recording decorator
├── monologue/                  # [CREATE] Monologue subsystem
│   ├── index.ts                # Exports
│   ├── types.ts                # IMonologue, MonologueConfig
│   ├── monologue.ts            # Core monologue logic
│   └── decorator.ts            # Injectable monologue decorator
├── prompts/                    # [CREATE] Prompt system
│   ├── index.ts                # PromptRegistry
│   ├── types.ts                # Prompt parameter types
│   └── registry.ts             # Type-safe prompt loading
├── callbacks/
│   ├── types.ts                # [UPDATE] IAgentCallbacks only
│   └── index.ts
├── harness/
│   ├── base-harness.ts         # Existing, works
│   ├── state.ts                # PersistentState
│   └── types.ts
├── workflow/
│   ├── orchestrator.ts         # Multi-agent workflows
│   └── types.ts
└── factory/
    ├── agent-factory.ts        # [UPDATE] Integrate decorators
    └── workflow-builder.ts

packages/sdk/prompts/           # [CREATE] Prompt templates
├── coding.md                   # CodingAgent prompt
├── review.md                   # ReviewAgent prompt
├── planner.md                  # PlannerAgent prompt
└── monologue.md                # Monologue narrator prompt

packages/sdk/tests/
├── unit/
│   ├── container.test.ts       # [UPDATE] Fix imports
│   ├── recording.test.ts       # [CREATE]
│   └── monologue.test.ts       # [CREATE]
└── integration/
    ├── live-agent.test.ts      # [CREATE] Real API test
    └── recorded-agent.test.ts  # [CREATE] Replay test

recordings/
├── golden/                     # Committed fixtures
│   ├── coding-simple.jsonl     # [CREATE]
│   └── workflow-basic.jsonl    # [CREATE]
└── scratch/                    # Local experiments (gitignored)
```

---

## Data Model

### Core Entities

```
┌─────────────────────────────────────────────────────────────────┐
│                        Agent Execution                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │   Factory    │────▶│    Agent     │────▶│   Runner     │    │
│  │ createAgent()│     │ BaseAnthropic│     │ Anthropic/   │    │
│  └──────────────┘     │    Agent     │     │ Replay       │    │
│         │             └──────────────┘     └──────────────┘    │
│         │                    │                    │             │
│         ▼                    ▼                    ▼             │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │  Monologue   │     │  Recording   │     │  EventBus    │    │
│  │  Decorator   │     │  Decorator   │     │              │    │
│  └──────────────┘     └──────────────┘     └──────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Recording Data Model

```typescript
// recordings/{category}/{sessionId}.jsonl
interface RecordedSession {
  sessionId: string;
  agentName: string;
  prompt: string;
  options: RunnerOptions;
  startedAt: string; // ISO timestamp
  events: RecordedEvent[];
}

interface RecordedEvent {
  timestamp: number; // ms since start
  type: "text" | "thinking" | "tool_call" | "tool_result" | "error" | "complete";
  data: unknown; // Type depends on event type
}
```

### Monologue Data Model

```typescript
interface MonologueState {
  buffer: AgentEvent[];          // Events waiting to be narrated
  history: string[];             // Append-only narrative history
  lastEmitTime: number;          // Throttle control
}

interface MonologueConfig {
  enabled: boolean;
  model: "haiku" | "sonnet";     // Cheap model for narration
  systemPrompt?: string;          // Override default prompt
  minBufferSize?: number;         // Min events before considering emit
  maxBufferSize?: number;         // Force emit at this size
  throttleMs?: number;            // Min time between emits
}
```

---

## Architectural Decisions

### AD-005: Harness Context Sharing

**Decision**: Agents define a context schema. Harness transforms its state to match.

**Architecture**:
```
Harness.loadContext() → transform → Agent.execute(params, { context }) → PromptRegistry → LLM
```

**Agent side** - Defines what context it CAN accept:
```typescript
export class CodingAgent extends BaseAnthropicAgent {
  static contextSchema = z.object({
    previousWork: z.array(z.string()).optional(),
    constraints: z.string().optional(),
  }).optional();

  async execute(
    task: string,
    sessionId: string,
    options?: { context?: CodingContext; callbacks?: IAgentCallbacks }
  ): Promise<CodingResult> {
    const prompt = await PromptRegistry.formatCoding({
      task,
      previousWork: options?.context?.previousWork?.join("\n") ?? "",
      constraints: options?.context?.constraints ?? "",
    });
    return this.run(prompt, sessionId, options);
  }
}
```

**Harness side** - Transforms its state to agent context:
```typescript
class TicketHarness extends BaseHarness<TicketState, Ticket, CodingResult> {
  protected async *execute() {
    for (const ticket of this.tickets) {
      const ctx = this.loadContext();

      // TRANSFORM: harness state → agent context
      const agentContext = {
        previousWork: ctx.recentSteps.map(s => s.output.summary),
        constraints: ctx.state.projectConstraints,
      };

      const result = await this.codingAgent.execute(
        ticket.description,
        `ticket-${ticket.id}`,
        { context: agentContext }
      );

      yield { input: ticket, output: result };
    }
  }
}
```

**Direct usage** - Works without harness (context optional):
```typescript
const agent = createAgent("coder");
const result = await agent.execute("Write hello world", "session-1");
```

**Benefits**:
- **Reusable agents** - Define what they accept, not what they require
- **Type-safe** - Zod schemas enforce context shape
- **Debuggable** - Snapshot state, replay from any point
- **Testable** - Load state fixtures, verify behavior
- **Feature-enabling** - Apps can "rewind" to previous states

---

### AD-006: Recording Integration Points

Where does recording hook in?

```
┌────────────────────────────────────────────────────────────┐
│                    Agent.execute()                         │
│                          │                                 │
│                          ▼                                 │
│  ┌─────────────────────────────────────────────────────┐  │
│  │            RecordingDecorator.wrap()                │  │◀── HOOK HERE
│  │                       │                             │  │
│  │   ┌───────────────────┴───────────────────┐        │  │
│  │   │                                       │        │  │
│  │   ▼                                       ▼        │  │
│  │ [LIVE MODE]                        [REPLAY MODE]   │  │
│  │ Call runner.run()                  Read JSONL      │  │
│  │ Capture events                     Fire callbacks  │  │
│  │ Write JSONL                        Return result   │  │
│  │   │                                       │        │  │
│  │   └───────────────────┬───────────────────┘        │  │
│  │                       │                             │  │
│  │                       ▼                             │  │
│  │              Return result                          │  │
│  └─────────────────────────────────────────────────────┘  │
│                          │                                 │
│                          ▼                                 │
│                   Callbacks fired                          │
└────────────────────────────────────────────────────────────┘
```

Recording wraps the agent's execution, not the runner. This means:
- Recording captures agent-level context (sessionId, prompt, agent name)
- Users can export recording package for their own agents
- Recording is transparent to the runner

---

### AD-007: Monologue Event Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Agent.execute()                              │
│                          │                                      │
│   ┌──────────────────────┴──────────────────────┐              │
│   │                                              │              │
│   ▼                                              ▼              │
│ [Events emitted]                          [MonologueDecorator]  │
│   │                                              │              │
│   │  onText ──────────────────────────────────▶ buffer.push()  │
│   │  onThinking ──────────────────────────────▶ buffer.push()  │
│   │  onToolCall ──────────────────────────────▶ buffer.push()  │
│   │  onToolResult ────────────────────────────▶ buffer.push()  │
│   │                                              │              │
│   │                                              ▼              │
│   │                                     [shouldEmit()?]        │
│   │                                        │         │         │
│   │                                       YES        NO        │
│   │                                        │         │         │
│   │                                        ▼         │         │
│   │                              [callCheapModel()]  │         │
│   │                                        │         │         │
│   │                                        ▼         │         │
│   │                              [history.push()]    │         │
│   │                              [buffer = []]       │         │
│   │                                        │         │         │
│   │                                        ▼         │         │
│   │                              [onMonologue(text)] │         │
│   │                                        │         │         │
│   └────────────────────────────────────────┴─────────┘         │
│                          │                                      │
│                          ▼                                      │
│                   Return result                                 │
└─────────────────────────────────────────────────────────────────┘
```

The monologue decorator:
1. Intercepts all agent events (not runner events)
2. Buffers them
3. Uses heuristics (buffer size, time, event type) to decide when to emit
4. Calls cheap model with: system prompt + history + new events
5. Emits narrative, clears buffer, appends to history

---

### AD-008: Prompt System Architecture

```
packages/sdk/prompts/
├── coding.md           # {{task}} → formatted coding prompt
├── review.md           # {{code}}, {{context}} → review prompt
├── planner.md          # {{prd}} → planning prompt
└── monologue.md        # {{events}}, {{history}} → narrative prompt

packages/sdk/src/prompts/
├── registry.ts         # PromptRegistry singleton
├── types.ts            # CodingPromptParams, ReviewPromptParams, etc.
└── schemas.ts          # Zod schemas for each prompt's params
```

**PromptRegistry API**:
```typescript
// Type-safe prompt formatting
const prompt = await PromptRegistry.formatCoding({ task: "..." });
const prompt = await PromptRegistry.formatMonologue({
  events: [...],
  history: [...]
});

// Custom prompt override
const prompt = await PromptRegistry.format("coding", { task: "..." }, {
  templatePath: "./my-custom-coding.md"
});
```

**Prompt Template Example** (`prompts/monologue.md`):
```markdown
You are narrating what an AI coding agent is doing. Speak in first person.

## My Previous Narration
{{#each history}}
- {{this}}
{{/each}}

## What Just Happened
{{#each events}}
### {{type}}
{{#if (eq type "tool_call")}}
I'm about to use the {{name}} tool: {{json input}}
{{/if}}
{{#if (eq type "tool_result")}}
The tool returned: {{truncate output 500}}
{{/if}}
{{#if (eq type "text")}}
I said: {{content}}
{{/if}}
{{/each}}

## Your Task
Write 1-2 sentences describing what I'm doing and why. Be concise and helpful.
```

---

## Implementation Phases

### Phase 1: Foundation (Unblock Build) - P1

1. **Fix build script** - Remove web build, use library build
2. **Create BaseAnthropicAgent** - Thin orchestrator with callbacks
3. **Migrate concrete agents** - Extend BaseAnthropicAgent
4. **Remove deprecated code** - Delete StreamCallbacks, old BaseAgent
5. **Fix tests** - Update imports, ensure types pass

### Phase 2: Recording System - P1

1. **Create recording module** - Types, Recorder, Replayer
2. **Implement RecordingDecorator** - Injectable, wraps agents
3. **Integrate with factory** - `createAgent()` supports recording config
4. **Capture golden recordings** - Real API calls → fixtures
5. **Add replay tests** - Prove deterministic playback

### Phase 3: Prompt System - P1

1. **Create prompt module** - Registry, schemas, loader
2. **Add Handlebars dependency** - Template rendering
3. **Create prompt templates** - coding.md, review.md, planner.md
4. **Integrate with agents** - Agents use PromptRegistry

### Phase 4: Monologue System - P2

1. **Create monologue module** - Types, core logic, decorator
2. **Create monologue prompt** - monologue.md template
3. **Implement MonologueDecorator** - Buffer, emit, history
4. **Integrate with factory** - `createAgent()` supports monologue config
5. **Add monologue tests** - Verify narrative generation

### Phase 5: Consolidation - P2

1. **Consolidate callbacks** - IAgentCallbacks only
2. **Update all agents** - Use new callback interface
3. **Update harness integration** - Context passing (Option A)
4. **Documentation** - README, API docs

### Phase 6: Validation - P1/P2

1. **Run all tests** - Unit + integration
2. **Live integration test** - Real Anthropic API
3. **Verify success criteria** - SC-001 through SC-010

---

## Complexity Tracking

> No violations anticipated. All decisions align with constitution.

| Decision | Justification |
|----------|---------------|
| Recording at agent level | Enables ecosystem sharing, standardized TDD |
| Monologue as decorator | Composition over inheritance, opt-in |
| Explicit context passing | Simplest solution, type-safe |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Anthropic SDK API changes | Medium | High | Pin version, abstract behind runner |
| Recording format evolution | Low | Medium | Version recordings, migration path |
| Monologue model costs | Low | Low | Use Haiku by default, throttle |
| Breaking changes for users | Medium | High | Deprecation warnings, migration guide |

---

## Success Metrics

After implementation:

- [ ] `bun run build` succeeds
- [ ] `bun run check-types` passes
- [ ] All exports resolve
- [ ] 3+ golden recordings in `recordings/golden/`
- [ ] Live test passes with real API
- [ ] Replay test proves determinism
- [ ] Monologue generates narrative
- [ ] No `any` in public API
- [ ] All agents use IAgentCallbacks
- [ ] New user can run agent in <10 lines
