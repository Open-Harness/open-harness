---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - path: "_bmad-output/prd.md"
    type: "prd"
  - path: "_bmad-output/prd-harness.md"
    type: "prd"
  - path: "_bmad-output/prd-infrastructure.md"
    type: "prd"
  - path: "_bmad-output/epics-harness.md"
    type: "epics"
workflowType: 'architecture'
project_name: 'Open Harness'
user_name: 'Abdullah'
date: '2024-12-25'
version: '3.0'
---

# Architecture Decision Document - Open Harness SDK

**Project:** Open Harness
**Author:** Abdullah + BMad Master
**Date:** December 25, 2024
**Status:** v3.0 - Complete Refactored Architecture

---

## Executive Summary

This document defines the **complete layered architecture** for the Open Harness SDK. It establishes a provider-agnostic, type-safe framework for building step-aware autonomous agents.

**Core Principles:**
1. **Provider-Agnostic:** Harness doesn't care which LLM provider powers agents
2. **Typed I/O:** Agents have typed inputs and outputs for safe chaining
3. **Unified Callbacks:** Same callback interface across all providers
4. **DI for Infrastructure:** Dependency injection for runners, EventBus, Vault
5. **User Owns Orchestration:** Framework provides infrastructure, users control flow

---

## Layer Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER CODE                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  class MyHarness extends BaseHarness<State, Input, Output> {                │
│    constructor(agents: IAgent<any, any>[]) { ... }                          │
│    protected async *execute() { ... }                                       │
│  }                                                                          │
│                                                                             │
│  const harness = new MyHarness([analyzer, coder, reviewer]);                │
│  await harness.run();                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HARNESS LAYER                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  BaseHarness<TState, TInput, TOutput>                                       │
│    - constructor(agents: IAgent[], config: HarnessConfig<TState>)           │
│    - protected agents: IAgent[]                                             │
│    - protected state: PersistentState<TState>                               │
│    - protected currentStep: number                                          │
│    - abstract execute(): AsyncGenerator<StepYield<TInput, TOutput>>         │
│    - run(): Promise<void>                                                   │
│    - loadContext(): LoadedContext<TState>                                   │
│    - isComplete(): boolean                                                  │
│                                                                             │
│  PersistentState<TState>                                                    │
│    - getState(): TState                                                     │
│    - updateState(fn: (s: TState) => TState): void                           │
│    - loadContext(): LoadedContext<TState>                                   │
│    - record(stepNumber, input, output, stateDelta): void                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │ uses
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AGENT INTERFACE                                     │
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
│    onThinking?: (thought: string) => void;                                  │
│    onToolCall?: (event: ToolCallEvent) => void;                             │
│    onToolResult?: (event: ToolResultEvent) => void;                         │
│    onProgress?: (event: ProgressEvent) => void;                             │
│    onComplete?: (result: AgentResult<TOutput>) => void;                     │
│    onError?: (error: AgentError) => void;                                   │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │ implemented by
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PROVIDER-SPECIFIC BASE AGENTS                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  abstract class BaseAnthropicAgent<TInput, TOutput>                         │
│      implements IAgent<TInput, TOutput> {                                   │
│                                                                             │
│    constructor(                                                             │
│      runner: IAgentRunner = inject(IAnthropicRunnerToken),                  │
│      eventBus: IEventBus = inject(IEventBusToken),                          │
│    ) {}                                                                     │
│                                                                             │
│    async execute(input, sessionId, callbacks?): Promise<TOutput> {          │
│      const prompt = this.buildPrompt(input);                                │
│      const result = await this.runner.run({                                 │
│        prompt,                                                              │
│        options: this.getOptions(),                                          │
│        callbacks: { onEvent: (e) => this.handleEvent(e, callbacks) }        │
│      });                                                                    │
│      return this.extractOutput(result);                                     │
│    }                                                                        │
│                                                                             │
│    protected abstract buildPrompt(input: TInput): string;                   │
│    protected abstract extractOutput(result: AgentResult): TOutput;          │
│    protected abstract getOptions(): RunnerOptions;                          │
│  }                                                                          │
│                                                                             │
│  abstract class BaseOpenCodeAgent<TInput, TOutput>                          │
│      implements IAgent<TInput, TOutput> { ... }  // Future                  │
│                                                                             │
│  abstract class BaseGeminiAgent<TInput, TOutput>                            │
│      implements IAgent<TInput, TOutput> { ... }  // Future                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │ extended by
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CONCRETE AGENTS                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  // Typed Input                                                             │
│  interface CodingInput {                                                    │
│    task: string;                                                            │
│    constraints?: string[];                                                  │
│    feedback?: string;  // For revision loops                                │
│  }                                                                          │
│                                                                             │
│  // Typed Output (Zod schema)                                               │
│  const CodingOutputSchema = z.object({                                      │
│    success: z.boolean(),                                                    │
│    summary: z.string(),                                                     │
│    filesChanged: z.array(z.string()),                                       │
│  });                                                                        │
│  type CodingOutput = z.infer<typeof CodingOutputSchema>;                    │
│                                                                             │
│  @injectable()                                                              │
│  class CodingAgent extends BaseAnthropicAgent<CodingInput, CodingOutput> {  │
│    readonly name = 'CodingAgent';                                           │
│                                                                             │
│    protected buildPrompt(input: CodingInput): string {                      │
│      return PromptRegistry.formatCoding(input);                             │
│    }                                                                        │
│                                                                             │
│    protected getOptions(): RunnerOptions {                                  │
│      return { outputSchema: CodingOutputSchema, model: 'sonnet' };          │
│    }                                                                        │
│                                                                             │
│    protected extractOutput(result: AgentResult): CodingOutput {             │
│      return result.structuredOutput as CodingOutput;                        │
│    }                                                                        │
│  }                                                                          │
│                                                                             │
│  @injectable()                                                              │
│  class ReviewAgent extends BaseAnthropicAgent<ReviewInput, ReviewOutput>    │
│                                                                             │
│  @injectable()                                                              │
│  class AnalyzerAgent extends BaseAnthropicAgent<TicketInput, AnalysisOutput>│
└─────────────────────────────────────────────────────────────────────────────┘
                                    │ uses
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RUNNER LAYER                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  interface IAgentRunner {                                                   │
│    run(args: {                                                              │
│      prompt: string;                                                        │
│      options: RunnerOptions;                                                │
│      callbacks?: { onEvent?: (event: AgentEvent) => void };                 │
│    }): Promise<AgentResult>;                                                │
│  }                                                                          │
│                                                                             │
│  interface RunnerOptions {                                                  │
│    model?: 'haiku' | 'sonnet' | 'opus';                                     │
│    outputSchema?: ZodSchema;                                                │
│    allowedTools?: string[];                                                 │
│    maxTokens?: number;                                                      │
│  }                                                                          │
│                                                                             │
│  interface AgentResult {                                                    │
│    success: boolean;                                                        │
│    structuredOutput?: unknown;                                              │
│    usage?: TokenUsage;                                                      │
│    durationMs?: number;                                                     │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │ implemented by
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PROVIDER IMPLEMENTATIONS                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  @injectable()                                                              │
│  class AnthropicRunner implements IAgentRunner {                            │
│    async run(args) {                                                        │
│      for await (const msg of query({ prompt: args.prompt, ... })) {         │
│        const event = this.mapSDKMessageToAgentEvent(msg);                   │
│        args.callbacks?.onEvent?.(event);                                    │
│      }                                                                      │
│      return this.buildResult(lastMessage);                                  │
│    }                                                                        │
│                                                                             │
│    private mapSDKMessageToAgentEvent(msg: SDKMessage): AgentEvent {         │
│      // Anthropic SDK → AgentEvent                                          │
│    }                                                                        │
│  }                                                                          │
│                                                                             │
│  @injectable()                                                              │
│  class OpenCodeRunner implements IAgentRunner {                             │
│    async run(args) {                                                        │
│      const result = await opencode.run({ ... });                            │
│      // OpenCode SDK → AgentEvent                                           │
│    }                                                                        │
│  }                                                                          │
│                                                                             │
│  @injectable()                                                              │
│  class ReplayRunner implements IAgentRunner {                               │
│    // Replays from vault recordings for testing                             │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │ uses
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          COMMON TYPES                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  // AgentEvent - The common message format                                  │
│  interface AgentEvent {                                                     │
│    timestamp: Date;                                                         │
│    event_type: EventType;                                                   │
│    agent_name: string;                                                      │
│    session_id?: string;                                                     │
│    content?: string;                                                        │
│    tool_name?: string;                                                      │
│    tool_input?: Record<string, unknown>;                                    │
│    tool_result?: Record<string, unknown>;                                   │
│    is_error?: boolean;                                                      │
│    metadata?: Record<string, unknown>;                                      │
│  }                                                                          │
│                                                                             │
│  type EventType =                                                           │
│    | 'session_start' | 'session_end'                                        │
│    | 'text' | 'thinking'                                                    │
│    | 'tool_call' | 'tool_result' | 'tool_progress'                          │
│    | 'result' | 'error' | 'compact' | 'status';                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DI CONTAINER                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  // Provider Tokens                                                         │
│  const IAnthropicRunnerToken = new InjectionToken<IAgentRunner>();          │
│  const IOpenCodeRunnerToken = new InjectionToken<IAgentRunner>();           │
│  const IReplayRunnerToken = new InjectionToken<IAgentRunner>();             │
│                                                                             │
│  // Infrastructure Tokens                                                   │
│  const IEventBusToken = new InjectionToken<IEventBus>();                    │
│  const IVaultToken = new InjectionToken<IVault>();                          │
│  const IConfigToken = new InjectionToken<IConfig>();                        │
│                                                                             │
│  function createContainer(options?: ContainerOptions): Container {          │
│    const container = new Container();                                       │
│                                                                             │
│    // Bind provider runners                                                 │
│    container.bind({ provide: IAnthropicRunnerToken, useClass: AnthropicRunner });│
│    container.bind({ provide: IOpenCodeRunnerToken, useClass: OpenCodeRunner });  │
│    container.bind({ provide: IReplayRunnerToken, useClass: ReplayRunner });      │
│                                                                             │
│    // Bind infrastructure                                                   │
│    container.bind({ provide: IEventBusToken, useFactory: () => new EventBus() });│
│    container.bind({ provide: IVaultToken, useClass: Vault });               │
│                                                                             │
│    // Bind agents                                                           │
│    container.bind(CodingAgent);                                             │
│    container.bind(ReviewAgent);                                             │
│    container.bind(AnalyzerAgent);                                           │
│                                                                             │
│    return container;                                                        │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## ADR-001: Provider-Agnostic Agent Architecture

**Decision:** Use provider-specific base agent classes that implement a common `IAgent<TInput, TOutput>` interface.

**Context:** The SDK needs to support multiple LLM providers (Anthropic, OpenCode, Gemini, etc.) without requiring harness code changes.

**Options Considered:**

| Option | Description | Verdict |
|--------|-------------|---------|
| A. Provider as container mode | Single token, swap at container creation | Rejected - can't mix providers |
| B. Token per provider | Separate DI token per provider | **Chosen** - allows mixing |
| C. Explicit runner passing | Pass runner to agent constructor | Rejected - loses DI benefits |

**Consequences:**
- Each provider has its own runner token: `IAnthropicRunnerToken`, `IOpenCodeRunnerToken`
- Agents can be mixed in the same harness
- Adding a new provider requires: new runner class + new token + new base agent class

---

## ADR-002: Typed Agent Inputs and Outputs

**Decision:** Agents have typed `execute(input: TInput): Promise<TOutput>` methods with Zod schemas for outputs.

**Context:** Agents need to be chainable - output of one feeds input of another.

**Pattern:**

```typescript
// Typed chain
const analysis: AnalysisResult = await analyzer.execute({ ticket });
const code: CodingResult = await coder.execute({ task: analysis.plan });
const review: ReviewResult = await reviewer.execute({ implementation: code.summary });

// Typed loop
while (review.decision === 'reject') {
  code = await coder.execute({ task: analysis.plan, feedback: review.feedback });
  review = await reviewer.execute({ implementation: code.summary });
}
```

**Consequences:**
- Each agent defines its own `TInput` type (interface)
- Each agent defines its own `TOutput` type (Zod schema for validation)
- Prompt is built internally from typed input
- Structured output is validated via Zod schema

---

## ADR-003: Unified Callback Interface

**Decision:** Define `IAgentCallbacks` as the common callback interface across all providers.

**Context:** Different providers have different SDK event shapes, but users want one callback interface.

**Interface:**

```typescript
interface IAgentCallbacks {
  // Universal events (all providers)
  onStart?: (metadata: AgentStartMetadata) => void;
  onText?: (text: string, delta: boolean) => void;
  onComplete?: (result: AgentResult<TOutput>) => void;
  onError?: (error: AgentError) => void;

  // Tool events (most providers)
  onToolCall?: (event: ToolCallEvent) => void;
  onToolResult?: (event: ToolResultEvent) => void;

  // Extended events (provider-specific, may not fire for all)
  onThinking?: (thought: string) => void;
  onProgress?: (event: ProgressEvent) => void;
}
```

**Consequences:**
- Each provider runner maps their SDK events → `AgentEvent`
- Base agent classes translate `AgentEvent` → `IAgentCallbacks`
- Users get consistent callbacks regardless of provider
- Some callbacks may not fire for all providers (e.g., `onThinking` is Anthropic-specific)

---

## ADR-004: AgentEvent as Common Message Type

**Decision:** Use the existing `AgentEvent` type as the internal message format across all runners.

**Context:** Runners need to produce a common event format that works across providers.

**Rationale:**
- `AgentEvent` already exists and is provider-agnostic
- Already used by `IEventBus` for system-wide observability
- No need to create a new type

**Mapping Responsibility:**

| Runner | Maps From | Maps To |
|--------|-----------|---------|
| `AnthropicRunner` | `SDKMessage` | `AgentEvent` |
| `OpenCodeRunner` | OpenCode events | `AgentEvent` |
| `GeminiRunner` | Gemini events | `AgentEvent` |
| `ReplayRunner` | Recorded events | `AgentEvent` |

---

## ADR-005: Harness Accepts Agent Array

**Decision:** `BaseHarness` constructor accepts `IAgent[]` array, not a single agent.

**Context:** Multi-agent orchestration is a core use case (analyzer → coder → reviewer).

**Pattern:**

```typescript
class MyHarness extends BaseHarness<State, Input, Output> {
  constructor(
    agents: IAgent<any, any>[],
    config: HarnessConfig<State>
  ) {
    super(agents, config);
  }

  protected async *execute() {
    const [analyzer, coder, reviewer] = this.agents;

    // User controls orchestration
    const analysis = await analyzer.execute(input);
    const code = await coder.execute({ task: analysis.plan });
    const review = await reviewer.execute({ impl: code.summary });

    yield { input, output: { analysis, code, review } };
  }
}
```

**Consequences:**
- Harness stores `protected agents: IAgent[]`
- User destructures in `execute()` as needed
- Supports single-agent (array of 1) and multi-agent patterns

---

## File Structure

```
packages/sdk/src/
├── index.ts                      # Main exports
│
├── harness/                      # HARNESS LAYER
│   ├── index.ts                  # Exports
│   ├── base-harness.ts           # BaseHarness abstract class
│   ├── state.ts                  # PersistentState
│   └── types.ts                  # Step, StepYield, HarnessConfig, etc.
│
├── agents/                       # CONCRETE AGENTS
│   ├── index.ts                  # Exports
│   ├── base-anthropic-agent.ts   # BaseAnthropicAgent<TIn, TOut>
│   ├── base-opencode-agent.ts    # BaseOpenCodeAgent<TIn, TOut> (future)
│   ├── coding-agent.ts           # CodingAgent
│   ├── review-agent.ts           # ReviewAgent
│   └── analyzer-agent.ts         # AnalyzerAgent
│
├── runner/                       # RUNNER LAYER
│   ├── index.ts                  # Exports
│   ├── types.ts                  # IAgentRunner, RunnerOptions, AgentResult
│   ├── anthropic-runner.ts       # AnthropicRunner (was LiveSDKRunner)
│   ├── opencode-runner.ts        # OpenCodeRunner (future)
│   ├── replay-runner.ts          # ReplayRunner
│   └── models.ts                 # AgentEvent, EventType, TokenUsage
│
├── core/                         # DI INFRASTRUCTURE
│   ├── container.ts              # createContainer()
│   ├── tokens.ts                 # All injection tokens
│   ├── event-bus.ts              # IEventBus implementation
│   └── vault.ts                  # Recording vault
│
├── callbacks/                    # CALLBACK TYPES
│   ├── index.ts                  # Exports
│   └── types.ts                  # IAgentCallbacks, event types
│
├── factory/                      # CONVENIENCE FACTORIES
│   └── agent-factory.ts          # createAgent() helper
│
└── prompts/                      # PROMPT TEMPLATES
    ├── registry.ts               # PromptRegistry
    ├── coder.md                  # Coding prompt template
    └── reviewer.md               # Review prompt template
```

---

## Migration Guide

### What Gets Deleted/Renamed

| Current | Action | New Name |
|---------|--------|----------|
| `harness/agent.ts` | **DELETE** | Use `IAgent` interface |
| `BaseAgent` | **RENAME** | `BaseAnthropicAgent` |
| `LiveSDKRunner` | **RENAME** | `AnthropicRunner` |
| `StreamCallbacks` | **REPLACE** | `IAgentCallbacks` |
| `RunnerCallbacks` | **CHANGE** | `{ onEvent: (AgentEvent) => void }` |
| `IAgentRunnerToken` | **SPLIT** | `IAnthropicRunnerToken`, `IOpenCodeRunnerToken` |

### Migration Steps

1. **Rename `BaseAgent` → `BaseAnthropicAgent`**
   - Update all imports
   - Add `IAgent<TInput, TOutput>` interface implementation

2. **Rename `LiveSDKRunner` → `AnthropicRunner`**
   - Change callback from `onMessage(SDKMessage)` to `onEvent(AgentEvent)`
   - Move SDKMessage → AgentEvent mapping into runner

3. **Create provider tokens**
   - `IAnthropicRunnerToken`
   - Keep `IReplayRunnerToken`

4. **Update concrete agents**
   - Add typed `TInput` interface
   - Add typed `TOutput` Zod schema
   - Implement `execute(input: TInput): Promise<TOutput>`

5. **Update `BaseHarness`**
   - Constructor accepts `agents: IAgent[]`
   - Remove harness `Agent` class entirely

6. **Create `IAgentCallbacks` interface**
   - Unified callbacks for all providers

---

## Complete Usage Example

```typescript
import {
  BaseHarness,
  createContainer,
  type IAgent,
  type IAgentCallbacks,
  CodingAgent,
  ReviewAgent,
} from '@openharness/sdk';

// ============================================
// 1. TYPES
// ============================================

interface PipelineState {
  ticketsCompleted: number;
  totalTickets: number;
}

interface Ticket {
  id: string;
  title: string;
  description: string;
}

interface PipelineResult {
  ticket: Ticket;
  code: CodingOutput;
  review: ReviewOutput;
  iterations: number;
}

// ============================================
// 2. GET AGENTS FROM CONTAINER
// ============================================

const container = createContainer();
const coder = container.get(CodingAgent);      // IAgent<CodingInput, CodingOutput>
const reviewer = container.get(ReviewAgent);   // IAgent<ReviewInput, ReviewOutput>

// ============================================
// 3. DEFINE HARNESS
// ============================================

class CodingPipelineHarness extends BaseHarness<PipelineState, Ticket, PipelineResult> {

  constructor(
    private coder: IAgent<CodingInput, CodingOutput>,
    private reviewer: IAgent<ReviewInput, ReviewOutput>,
    tickets: Ticket[],
  ) {
    super(
      [coder, reviewer],  // Array of agents
      {
        initialState: {
          ticketsCompleted: 0,
          totalTickets: tickets.length
        }
      }
    );
    this.tickets = tickets;
  }

  private tickets: Ticket[];

  // ============================================
  // 4. IMPLEMENT EXECUTE - TYPED CHAINING
  // ============================================

  protected async *execute(): AsyncGenerator<StepYield<Ticket, PipelineResult>> {

    for (const ticket of this.tickets) {
      console.log(`\n[Step ${this.currentStep + 1}] Processing: ${ticket.title}`);

      // Callbacks for this step
      const callbacks: IAgentCallbacks = {
        onText: (text) => console.log(`  [Text]: ${text.slice(0, 80)}...`),
        onToolCall: (e) => console.log(`  [Tool]: ${e.toolName}`),
        onComplete: (r) => console.log(`  [Done]: ${r.success ? 'OK' : 'FAIL'}`),
      };

      // --- TYPED INPUT → AGENT → TYPED OUTPUT ---

      // First attempt
      let code: CodingOutput = await this.coder.execute(
        { task: ticket.description },  // Typed: CodingInput
        `${ticket.id}-code-1`,
        callbacks,
      );

      let review: ReviewOutput = await this.reviewer.execute(
        { task: ticket.description, implementation: code.summary },  // Typed: ReviewInput
        `${ticket.id}-review-1`,
        callbacks,
      );

      // --- TYPED LOOP BASED ON OUTPUT ---

      let iterations = 1;
      const maxIterations = 3;

      while (review.decision === 'reject' && iterations < maxIterations) {
        iterations++;
        console.log(`  [Revision ${iterations}] Addressing: ${review.feedback}`);

        // Revision with feedback
        code = await this.coder.execute(
          {
            task: ticket.description,
            feedback: review.feedback,  // Typed field from ReviewOutput
          },
          `${ticket.id}-code-${iterations}`,
          callbacks,
        );

        review = await this.reviewer.execute(
          { task: ticket.description, implementation: code.summary },
          `${ticket.id}-review-${iterations}`,
          callbacks,
        );
      }

      // Update state
      this.state.updateState(s => ({
        ...s,
        ticketsCompleted: s.ticketsCompleted + 1,
      }));

      // Yield typed result
      yield {
        input: ticket,
        output: { ticket, code, review, iterations },
      };
    }
  }

  // ============================================
  // 5. OPTIONAL: CUSTOM COMPLETION
  // ============================================

  override isComplete(): boolean {
    return this.state.getState().ticketsCompleted >= this.state.getState().totalTickets;
  }
}

// ============================================
// 6. RUN
// ============================================

const tickets: Ticket[] = [
  { id: 'TASK-1', title: 'Add login', description: 'Implement user login flow' },
  { id: 'TASK-2', title: 'Add logout', description: 'Implement user logout' },
];

const harness = new CodingPipelineHarness(coder, reviewer, tickets);

await harness.run();

// Results
console.log(`\nCompleted: ${harness.getState().ticketsCompleted} tickets`);
console.log(`Total steps: ${harness.getCurrentStep()}`);

for (const step of harness.getStepHistory()) {
  console.log(`  ${step.input.id}: ${step.output.review.decision} (${step.output.iterations} iterations)`);
}
```

---

## Key Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Harness accepts agents | `IAgent[]` array | Multi-agent orchestration |
| Agent interface | `IAgent<TInput, TOutput>` | Typed inputs/outputs, chaining |
| Provider architecture | Token per provider | Mix providers, no refactor later |
| Message format | `AgentEvent` | Already exists, provider-agnostic |
| Callbacks | `IAgentCallbacks` | Unified across providers |
| DI for runners | Yes, tokens per provider | Testable, swappable |
| DI for EventBus | Yes | System-wide observability |
| Base agent per provider | Yes | Each maps their SDK → AgentEvent |

---

## Success Criteria

| Criteria | Validation |
|----------|------------|
| Typed agent I/O | CodingAgent has `execute(CodingInput): CodingOutput` |
| Provider-agnostic harness | Same harness works with Anthropic and future providers |
| Unified callbacks | Same `IAgentCallbacks` fires for all providers |
| Multi-agent support | Harness accepts and orchestrates N agents |
| Chaining works | Output of agent A feeds input of agent B with type safety |
| Looping works | Can loop based on typed output (e.g., `review.decision`) |
| DI works | Container provides agents with injected runners |
