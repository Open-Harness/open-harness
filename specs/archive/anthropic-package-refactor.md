# Feature Specification: Anthropic Package Architecture Refactor

**Feature Branch**: `013-anthropic-package-refactor` (anticipated)
**Created**: 2025-12-28
**Status**: Draft
**Input**: Technical debt analysis + canonical documentation review
**Supersedes**: [specs/012-define-anthropic-agent](../012-define-anthropic-agent/spec.md)
**Depends On**: None

---

## Overview

The current `@openharness/anthropic` package suffers from architectural debt: flat folder structure, class-based boilerplate, framework/application boundary violations, and documentation drift from the canonical vision. This specification proposes a comprehensive refactoring to establish a three-layer architecture (infrastructure/provider/presets) with functional agent factories and TypeScript-based prompt templates.

**Current State**: Flat `src/` folder mixing concerns, 330-line `BaseAnthropicAgent` class hierarchy, Bun-specific file I/O for prompts, concrete agents exported from main package index.

**Proposed State**: Clean layer separation (`infra/` → `provider/` → `presets/`), functional `defineAnthropicAgent()` factory, type-safe TypeScript prompt templates, explicit preset imports from `@openharness/anthropic/presets`.

**Value Proposition**: Type safety, maintainability, clear separation of concerns, runtime portability (Node.js + Bun), alignment with "Simplicity scales" philosophy from [.knowledge/docs/why.md](../../.knowledge/docs/why.md).

---

## Problem Statement

The current implementation contradicts the project's vision of readable, simple, composable code. Analysis reveals multiple architectural issues:

### 1. Flat Folder Structure Mixing Concerns

**Current Structure**:
```
src/
├── agents/          # MIXES base class + concrete implementations
├── runner/          # MIXES execution engine + prompt registry
├── recording/       # Infrastructure (correct layer)
└── monologue/       # Infrastructure (correct layer)
```

**Issues**:
- No clear separation of framework vs application code
- `agents/` contains both `BaseAnthropicAgent` (framework) and `CodingAgent` (application)
- `runner/prompts.ts` (infrastructure concern) lives in execution layer
- Cannot distinguish reusable infrastructure from example code

**Evidence**: [packages/anthropic/src/index.ts](../../packages/anthropic/src/index.ts) exports `CodingAgent`, `ReviewAgent`, `PlannerAgent` from main package, making them appear to be framework primitives when they're actually example implementations.

### 2. Class Hierarchy Boilerplate

**Current Implementation**: [packages/anthropic/src/agents/base-anthropic-agent.ts](../../packages/anthropic/src/agents/base-anthropic-agent.ts) (330 lines)

- Every agent extends `BaseAnthropicAgent` with `@injectable()` decorator
- Repeats: constructor injection, DI tokens, callback wiring, timeout handling
- Concrete agents like `CodingAgent` add minimal value (60 lines) over base class
- DI abstractions leak into agent code (`inject()`, `@injectable()`)

**Example** - Current pattern:
```typescript
@injectable()
export class CodingAgent extends BaseAnthropicAgent {
  constructor(
    runner = inject(IAnthropicRunnerToken),
    eventBus = inject(IEventBusToken, { optional: true }) ?? null,
  ) {
    super("Coder", runner, eventBus);
  }

  @Monologue("Coder", { sessionIdProvider: (args) => args[1] as string })
  async execute(task: string, sessionId: string, options?: CodingAgentOptions): Promise<CodingResult> {
    const prompt = await PromptRegistry.formatCoding({ task });
    return this.run<CodingResult>(prompt, sessionId, {
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      outputFormat: CodingResultSdkSchema,
      callbacks: options?.callbacks,
      timeoutMs: options?.timeoutMs,
    });
  }
}
```

**Problem**: Too much ceremony for what should be a simple agent definition.

### 3. PromptRegistry in Wrong Layer

**Current Implementation**: [packages/anthropic/src/runner/prompts.ts](../../packages/anthropic/src/runner/prompts.ts)

- Lives in `runner/` layer (execution engine) but is an infrastructure concern
- Centralized registry pattern doesn't scale (agents should own their prompts)
- Uses Bun-specific `Bun.file()` API → not portable to Node.js
- Hardcoded file paths relative to `import.meta.url`

**Evidence**:
```typescript
// From prompts.ts
const agentsDir = new URL("../agents", import.meta.url).pathname;

export const PromptRegistry = {
  async formatCoding(data: CodingData): Promise<string> {
    const template = await Bun.file(`${agentsDir}/coder.prompt.md`).text();
    return template.replace("{{task}}", data.task);
  },
  // ...
};
```

**Problems**:
- Runtime file I/O (slow, error-prone)
- Bun-only API breaks Node.js compatibility
- Manual template interpolation (not type-safe)
- Agents coupled to centralized registry

### 4. Framework/Application Boundary Violation

**Current Exports**: [packages/anthropic/src/index.ts](../../packages/anthropic/src/index.ts)

The main package index exports:
```typescript
export { CodingAgent, PlannerAgent, ReviewAgent, ValidationReviewAgent }
```

**Problem**: These are **example implementations**, not framework primitives. Users importing `@openharness/anthropic` get application code bundled with infrastructure.

**Correct Separation**:
- **Framework**: `defineAnthropicAgent()`, `PromptTemplate`, types (factory pattern)
- **Application**: Preset agents like `CodingAgent` (should be optional imports from `/presets`)

### 5. Documentation Drift

**Canonical Vision**: [.knowledge/docs/why.md](../../.knowledge/docs/why.md) promises:
> "One file. Forty lines. Actually readable."

**Reality**: [examples/coding/src/index.ts](../../examples/coding/src/index.ts) is 267 lines with:
- DI container setup
- Event bus subscriptions
- Manual agent instantiation
- Class-based harness extending `BaseHarness`

**Gap**: No "How It Actually Works" guide bridging vision → implementation. Root [CLAUDE.md](../../CLAUDE.md) is auto-generated from feature plans, doesn't reflect architectural vision.

### 6. Dual Event Bus System

**Current Implementation**: [packages/anthropic/src/agents/base-anthropic-agent.ts:82-83](../../packages/anthropic/src/agents/base-anthropic-agent.ts#L82-L83)

```typescript
protected eventBus: IEventBus | null = inject(IEventBusToken, { optional: true }) ?? null,
protected unifiedBus: IUnifiedEventBus | null = inject(IUnifiedEventBusToken, { optional: true }) ?? null,
```

**Problem**: Maintains TWO event systems for backward compatibility:
- `IEventBus` - Legacy event system
- `IUnifiedEventBus` - Modern event system (from spec 008)

**Issues**:
- Redundant event emission (same event sent to both buses)
- Maintenance burden (parallel implementations)
- Confusion for developers (which bus to use?)

**Solution**: Factory uses ONLY `IUnifiedEventBus`, removing legacy support.

---

## User Scenarios & Testing
*(mandatory)*

### User Story 1: Custom Agent Creation (P1)

**As a** developer building a custom agent
**I want to** define an agent with minimal boilerplate
**So that** I can focus on prompt logic, not infrastructure

**Why P1**: Core framework capability. If creating custom agents requires deep DI knowledge, the framework fails its purpose.

**Independent Test**:
1. Create new TypeScript file
2. Define prompt template with typed data
3. Call `defineAnthropicAgent()` with schema
4. Execute agent and receive typed output

**Acceptance Criteria**:
- **Given**: Developer has `@openharness/anthropic` installed
- **When**: They write:
  ```typescript
  const MyAgent = defineAnthropicAgent({
    name: 'MyAgent',
    prompt: myPromptTemplate,
    inputSchema: z.object({ task: z.string() }),
    outputSchema: z.object({ result: z.string() }),
  });
  const output = await MyAgent.execute({ task: 'Do this' }, 'session-1');
  ```
- **Then**:
  - Agent executes with type-safe input/output
  - No DI imports required (`@injectable`, `inject()`)
  - TypeScript infers `output.result: string`
  - Less than 20 lines total

### User Story 2: Quick Start with Presets (P1)

**As a** developer evaluating Open Harness
**I want to** use a pre-built coding agent immediately
**So that** I can prototype workflows without writing custom agents

**Why P1**: Critical for adoption. Developers need instant success before investing in customization.

**Independent Test**:
1. Install package
2. Import preset agent
3. Call `.execute()`
4. Observe output

**Acceptance Criteria**:
- **Given**: Developer imports `import { CodingAgent } from '@openharness/anthropic/presets'`
- **When**: They call `await CodingAgent.execute({ task: 'Build a function' }, 'session-1')`
- **Then**:
  - Agent executes with default prompt
  - Returns typed `CodingResult` with `summary`, `stopReason`, `handoff`
  - No configuration required
  - Zero-line setup

### User Story 3: Override Preset Prompts (P2)

**As a** developer using preset agents
**I want to** customize the prompt while keeping type safety
**So that** I can adapt agents to my domain without forking

**Why P2**: Important for flexibility. Presets should be starting points, not locked boxes.

**Independent Test**:
1. Import preset agent
2. Define custom prompt template
3. Pass custom prompt via options
4. Verify agent uses custom prompt

**Acceptance Criteria**:
- **Given**: Developer has custom `PromptTemplate<CodingPromptData>`
- **When**: They call:
  ```typescript
  await CodingAgent.execute(
    { task: 'Build API' },
    'session-1',
    { prompt: customPrompt }
  )
  ```
- **Then**:
  - Agent uses `customPrompt.render()` instead of default
  - Type safety maintained (compiler enforces `CodingPromptData` shape)
  - Original preset unchanged (no mutation)

### User Story 4: Portable Runtime (P2)

**As a** developer in a Node.js environment
**I want to** run Open Harness without Bun
**So that** I can use the framework in existing infrastructure

**Why P2**: Framework should be runtime-agnostic. Bun-only is a barrier to adoption.

**Independent Test**:
1. Create Node.js project (not Bun)
2. Install `@openharness/anthropic`
3. Run test suite with `node --test`
4. Verify all tests pass

**Acceptance Criteria**:
- **Given**: TypeScript prompts (no `Bun.file()` calls)
- **When**: Developer runs `node --experimental-strip-types test.ts`
- **Then**:
  - All tests pass
  - No runtime errors
  - No Bun-specific APIs invoked
  - Prompts load via ESM imports (build-time)

### User Story 5: Documentation Navigation (P3)

**As a** developer learning Open Harness
**I want to** understand the architecture quickly
**So that** I can make informed design decisions

**Why P3**: Developer experience enhancement. Good docs reduce support burden and increase confidence.

**Independent Test**:
1. Open root `CLAUDE.md`
2. Follow link to canonical docs
3. Find "How It Works" guide
4. Understand: DI → prompt loading → agent execution → events

**Acceptance Criteria**:
- **Given**: Developer opens [CLAUDE.md](../../CLAUDE.md)
- **When**: They click link to `.knowledge/docs/how-it-works.md`
- **Then**:
  - Document exists and renders
  - Contains: layer diagram, code examples, event flow
  - Total navigation: ≤ 2 clicks from root
  - Answers "how does prompt injection work?" question

### Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Prompt template missing required variable | `validate()` throws error before LLM call |
| Custom prompt returns wrong output type | TypeScript compiler error (build time) |
| Import from old path (`@openharness/sdk`) | Console deprecation warning (runtime) |
| Override prompt with incompatible template data | TypeScript error: `Type X is not assignable to PromptTemplate<Y>` |
| Agent execution timeout | Promise rejects with `TimeoutError` |
| Invalid Zod schema in definition | Throws error at agent creation time |

---

## Requirements
*(mandatory)*

### Functional Requirements - Package Structure

**FR-001**: System MUST organize `packages/anthropic/src/` into three layers:
- (a) `infra/` - Runtime execution infrastructure
  - `infra/runner/`: AnthropicRunner, event mapping, SDK integration
  - `infra/recording/`: Replay, decorators, vault
  - `infra/monologue/`: AnthropicMonologueLLM
- (b) `provider/` - Anthropic/Claude provider implementation
  - `provider/base-anthropic-agent.ts`: Base class
  - `provider/prompts.ts`: PromptTemplate interface
  - `provider/factory.ts`: defineAnthropicAgent()
- (c) `presets/` - Optional concrete agent implementations
  - `presets/coding/`: CodingAgent + codingPrompt
  - `presets/review/`: ReviewAgent + reviewPrompt
  - `presets/planner/`: PlannerAgent + plannerPrompt

**FR-002**: System MUST export framework-only from main index:
- (a) Main export: `import { defineAnthropicAgent, createPromptTemplate } from '@openharness/anthropic'`
- (b) Preset export: `import { CodingAgent } from '@openharness/anthropic/presets'`
- (c) No concrete agents in main index ([packages/anthropic/src/index.ts](../../packages/anthropic/src/index.ts))
- (d) No class-based exports (BaseAnthropicAgent is internal implementation detail)

**FR-003**: Package.json exports MUST include:
- (a) `"."` → `./dist/index.js` (framework: defineAnthropicAgent, types, prompt utilities)
- (b) `"./presets"` → `./dist/presets/index.js` (CodingAgent, ReviewAgent, etc.)
- (c) No class-based base agent exports (simplicity: one way to create agents)

### Functional Requirements - Agent Factory

**FR-004**: System MUST provide `defineAnthropicAgent<TInput, TOutput>()` factory that:
- (a) Accepts `AnthropicAgentDefinition<TInput, TOutput>` configuration
- (b) Returns object with:
  - `.execute(input: TInput, sessionId: string, opts?: ExecuteOptions<TOutput>): Promise<TOutput>`
  - `.stream(input: TInput, sessionId: string, opts?: StreamOptions<TOutput>): AgentHandle<TOutput>`
- (c) Handles DI container creation internally (hidden from users, no decorators exposed)
- (d) Uses `IUnifiedEventBus` ONLY (removes dual event bus support)
- (e) Wires event callbacks automatically (onText, onThinking, onToolCall, etc.)

**FR-005**: Agent definition (`AnthropicAgentDefinition`) MUST include:
- (a) `name: string` - Unique agent identifier (used for events, monologue)
- (b) `prompt: PromptTemplate<TInput> | string` - Template or static string
- (c) `inputSchema: ZodType<TInput>` - Validates input, provides template variables
- (d) `outputSchema: ZodType<TOutput>` - Validates structured output
- (e) `options?: Partial<Options>` - SDK options passthrough (permissionMode, model, etc.)

**FR-006**: Factory MUST support async iterable input (from spec 012):
- (a) `.stream()` method accepts `prompt: string | AsyncIterable<SDKUserMessage>`
- (b) Returns `AgentHandle` with `interrupt()`, `streamInput()`, `setModel()` methods
- (c) Enables multi-turn conversations and message injection

### Functional Requirements - Prompt System

**FR-007**: System MUST provide `PromptTemplate<TData>` interface:
```typescript
interface PromptTemplate<TData = unknown> {
  render: (data: TData) => string;
  validate?: (data: TData) => void;
}
```
- (a) `.render()` accepts typed data, returns interpolated prompt
- (b) Optional `.validate()` throws error for invalid data (called before LLM)
- (c) Co-located with agent definitions in same file/folder

**FR-008**: Prompt templates MUST be TypeScript exports (no file I/O):
- (a) Templates imported at build time: `import { codingPrompt } from './prompt.js'`
- (b) No runtime file reading (`Bun.file()`, `fs.readFile()`)
- (c) Works in both Node.js and Bun environments

**FR-009**: Prompt templates MUST be overridable at runtime:
- (a) Via agent definition: `defineAnthropicAgent({ prompt: customTemplate })`
- (b) Via execute options: `.execute(input, sessionId, { prompt: overrideTemplate })`
- (c) Type safety enforced: `customTemplate: PromptTemplate<TInput>`

**FR-010**: System SHOULD provide `createPromptTemplate<TData>()` helper:
- (a) Wraps template with validation logic
- (b) Returns `PromptTemplate<TData>` with automatic `.validate()` call
- (c) Example:
  ```typescript
  const myPrompt = createPromptTemplate({
    render: ({ task }) => `Do: ${task}`,
    validate: ({ task }) => { if (!task) throw new Error('Task required'); }
  });
  ```

### Functional Requirements - Documentation

**FR-011**: Root CLAUDE.md MUST serve as navigation hub:
- (a) Contains links to `.knowledge/docs/` (canonical source)
- (b) Does NOT duplicate content from canonical docs
- (c) Includes link to "How It Works" architecture guide
- (d) Lists development commands, project structure, auth notes

**FR-012**: System MUST include `.knowledge/docs/how-it-works.md`:
- (a) Explains architecture layers (infra → provider → presets)
- (b) Shows request flow: DI setup → prompt loading → agent execution → events
- (c) Contains code examples for each layer
- (d) Bridges gap between [.knowledge/docs/why.md](../../.knowledge/docs/why.md) vision and implementation

**FR-013**: Canonical docs MUST sync to `packages/sdk/docs/`:
- (a) Via script (`.knowledge/scripts/sync-docs.sh`) or CI automation
- (b) Ensures published package includes canonical documentation
- (c) Sync runs before `npm publish` or on version tag

### Key Entities

| Entity | Type | Purpose |
|--------|------|---------|
| `defineAnthropicAgent<TInput, TOutput>()` | Factory function | Create agents with minimal boilerplate (ONLY way to create agents) |
| `AnthropicAgentDefinition<TInput, TOutput>` | Interface | Agent configuration (name, prompt, schemas) |
| `PromptTemplate<TData>` | Interface | Type-safe prompt template with render/validate |
| `InternalAnthropicAgent` | Class (internal) | Internal implementation (NOT exported, used by factory) |
| `CodingAgent` | Preset | Pre-configured agent for coding tasks |
| `ReviewAgent` | Preset | Pre-configured agent for code review |
| `PlannerAgent` | Preset | Pre-configured agent for project planning |

---

## Success Criteria
*(mandatory)*

**SC-001**: Developer can create custom agent in < 20 lines
- **Measurement**: Count lines in `examples/custom-agent.ts`
- **Verification**: T001 - Custom agent creation example
- **Acceptance**: Import, define template, call factory, execute = 15-18 LOC

**SC-002**: Preset agents work with zero configuration
- **Measurement**: Count lines of setup code before `.execute()` call
- **Verification**: T002 - Preset agent usage example
- **Acceptance**: Setup code = 0 lines (just import + execute)

**SC-003**: TypeScript catches prompt template errors at compile time
- **Measurement**: Compile test suite with invalid template data
- **Verification**: T003 - Type safety test cases
- **Acceptance**: `tsc --noEmit` fails with type error for wrong data shape

**SC-004**: Tests pass in both Node.js and Bun
- **Measurement**: CI runs test suite in both runtimes
- **Verification**: T004 - Runtime compatibility tests
- **Acceptance**: Exit code 0 for both `bun test` and `node --test`

**SC-005**: Documentation navigation ≤ 2 clicks from root to architecture guide
- **Measurement**: User test: [CLAUDE.md](../../CLAUDE.md) → `.knowledge/` → `how-it-works.md`
- **Verification**: T005 - Documentation structure review
- **Acceptance**: Total clicks = 2, guide exists and explains layer architecture

---

## Architecture Design

### Data Flow: How Everything Connects

This diagram shows the **complete flow** from user code → preset agent → prompt rendering → LLM execution → events → harness channels:

```
┌─────────────────────────────────────────────────────────┐
│ 1. USER CODE (Harness)                                  │
│                                                           │
│   const myHarness = defineHarness({                      │
│     agents: { coder: CodingAgent },  // ← Preset agent   │
│     run: async ({ agents }) => {                         │
│       const result = await agents.coder.execute({        │
│         task: "Build API"  // ← Input data               │
│       }, 'session-123');                                 │
│       return result;                                     │
│     }                                                     │
│   });                                                     │
│                                                           │
│   await myHarness.create().run();                        │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│ 2. PRESET AGENT (presets/coding/agent.ts)               │
│                                                           │
│   export const CodingAgent = defineAnthropicAgent({      │
│     name: 'Coder',                                       │
│     prompt: codingPrompt,  // ← TypeScript template      │
│     inputSchema: z.object({ task: z.string() }),         │
│     outputSchema: CodingOutputSchema,                    │
│   });                                                     │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│ 3. PROMPT TEMPLATE (presets/coding/prompt.ts)           │
│                                                           │
│   export const codingPrompt: PromptTemplate<{           │
│     task: string                                         │
│   }> = {                                                 │
│     render: ({ task }) => `                              │
│       # Coding Agent                                     │
│       Task: ${task}  // ← Variable interpolation        │
│       ...                                                │
│     `                                                     │
│   };                                                      │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│ 4. FACTORY (provider/factory.ts)                         │
│                                                           │
│   CodingAgent.execute({ task: "Build API" })            │
│   ↓                                                       │
│   inputSchema.parse({ task: "Build API" }) ✓            │
│   ↓                                                       │
│   promptStr = codingPrompt.render({                      │
│     task: "Build API"                                    │
│   })                                                      │
│   ↓                                                       │
│   // Result: "# Coding Agent\nTask: Build API\n..."     │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│ 5. ANTHROPIC RUNNER (infra/runner/)                      │
│                                                           │
│   runner.run({                                           │
│     prompt: "# Coding Agent\nTask: Build API...",       │
│     options: { outputFormat: CodingOutputSchema }        │
│   })                                                      │
│   ↓                                                       │
│   Calls Claude Agent SDK query()                         │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│ 6. CLAUDE SDK (@anthropic-ai/claude-agent-sdk)          │
│                                                           │
│   for await (const message of query({ prompt })) {      │
│     // Streams back: text, thinking, tool calls, etc.   │
│   }                                                       │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│ 7. EVENT MAPPER (infra/runner/event-mapper.ts)          │
│                                                           │
│   SDK messages → Unified events                          │
│   ↓                                                       │
│   { type: 'agent:text', content: '...' }                │
│   { type: 'agent:thinking', content: '...' }            │
│   { type: 'agent:complete', output: {...} }             │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│ 8. UNIFIED EVENT BUS (SDK infra/)                        │
│                                                           │
│   unifiedBus.emit(event, { agent: { name: 'Coder' } })  │
│                                                           │
│   Note: ONLY IUnifiedEventBus (no legacy IEventBus)     │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│ 9. HARNESS CHANNELS (SDK harness/)                       │
│                                                           │
│   consoleChannel receives events:                        │
│   on: {                                                   │
│     'agent:text': ({ event, output }) => {               │
│       output.line(event.content);  // Print to terminal  │
│     }                                                     │
│   }                                                       │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│ 10. BACK TO USER                                         │
│                                                           │
│   const result = await agents.coder.execute(...);        │
│   // result = { summary: '...', stopReason: '...' }     │
└─────────────────────────────────────────────────────────┘
```

**Key Insights**:

1. **Harnesses don't inject prompts into agents**
   - Agents own their prompts (defined at creation time)
   - Harnesses just call `agent.execute(input)`
   - Input data flows TO agent → agent renders prompt internally

2. **Context passing happens via input data, not prompt injection**
   ```typescript
   // Harness passes context as part of input schema
   await agents.coder.execute({
     task: 'Build API',
     context: previousResult.handoff,  // ← From previous step
     constraints: ['Use Express', 'Add auth']
   });
   ```

3. **Prompt templates are agent-local**
   - Each agent definition includes its prompt template
   - Templates can be overridden at runtime via execute options
   - Type safety enforced: `PromptTemplate<TInput>` matches agent's input schema

4. **Events flow one direction: Agent → UnifiedEventBus → Channels**
   - No legacy event bus support (simplified)
   - Channels subscribe to event patterns (`agent:*`, `task:complete`)
   - Multiple channels can listen to same events (console, metrics, WebSocket)

### Layer Breakdown

```
packages/anthropic/src/
│
├── infra/                          # Layer 1: Infrastructure
│   ├── runner/
│   │   ├── anthropic-runner.ts    # Executes prompts via Claude Agent SDK
│   │   ├── event-mapper.ts        # Maps SDK messages → unified events
│   │   └── models.ts              # Event types, schemas
│   ├── recording/
│   │   ├── decorators.ts          # @Record, @Monologue
│   │   ├── vault.ts               # Recording storage
│   │   └── replay-runner.ts       # Test replay system
│   ├── monologue/
│   │   └── anthropic-llm.ts       # LLM adapter for monologue system
│   └── index.ts
│
├── provider/                       # Layer 2: Provider Implementation
│   ├── internal-agent.ts          # Internal agent class (NOT exported)
│   ├── prompts.ts                 # PromptTemplate interface + utilities
│   ├── factory.ts                 # defineAnthropicAgent() (ONLY export)
│   └── index.ts
│
├── presets/                        # Layer 3: Concrete Agents
│   ├── coding/
│   │   ├── agent.ts               # CodingAgent definition
│   │   ├── prompt.ts              # codingPrompt template (TypeScript)
│   │   └── index.ts
│   ├── review/
│   │   ├── agent.ts               # ReviewAgent definition
│   │   ├── prompt.ts              # reviewPrompt template
│   │   └── index.ts
│   ├── planner/
│   │   ├── agent.ts               # PlannerAgent definition
│   │   ├── prompt.ts              # plannerPrompt template
│   │   └── index.ts
│   └── index.ts                   # Barrel export for all presets
│
├── index.ts                        # Main export (framework only)
└── presets.ts                      # Re-export presets/index.ts
```

### Prompt Template Pattern

**TypeScript Template** (replaces `.prompt.md` files):

```typescript
// presets/coding/prompt.ts
import type { PromptTemplate } from '../../provider/prompts.js';

export interface CodingPromptData {
  task: string;
}

export const codingPrompt: PromptTemplate<CodingPromptData> = {
  render: ({ task }) => `# Coding Agent

You are a skilled software engineer working in a collaborative development workflow.

## Task
${task}

## Instructions
1. Implement the task with clean, maintainable code
2. Write tests if appropriate
3. Commit changes with descriptive message

## Output Format
Return structured output with:
- \`summary\`: One-sentence description of what was accomplished
- \`stopReason\`: "finished" | "compacted" | "failed"
- \`handoff\`: Optional context for next step
`,

  validate: (data) => {
    if (!data.task?.trim()) {
      throw new Error('CodingPromptData: task is required and cannot be empty');
    }
  },
};
```

**Rationale for TypeScript over Markdown**:
1. **Type Safety**: Compiler enforces `CodingPromptData` shape at build time
2. **No I/O**: Import is build-time (bundled), not runtime (file read)
3. **Portability**: Works in Node.js and Bun without adapter code
4. **Testability**: Import prompt and call `.render()` directly in tests
5. **Co-location**: Prompt lives next to agent definition (clear ownership)

**Trade-off**: Loses markdown's readability for non-developers, but since these are developer-facing agents in a TypeScript SDK, type safety is more valuable.

### Factory Implementation Pattern

**Agent Definition** (using factory):

```typescript
// presets/coding/agent.ts
import { defineAnthropicAgent } from '../../provider/factory.js';
import { codingPrompt } from './prompt.js';
import { z } from 'zod';

const CodingInputSchema = z.object({
  task: z.string().min(1, 'Task cannot be empty'),
});

const CodingOutputSchema = z.object({
  summary: z.string(),
  stopReason: z.enum(['finished', 'compacted', 'failed']),
  handoff: z.string().optional(),
});

export type CodingInput = z.infer<typeof CodingInputSchema>;
export type CodingOutput = z.infer<typeof CodingOutputSchema>;

export const CodingAgent = defineAnthropicAgent({
  name: 'Coder',
  prompt: codingPrompt,  // Can be overridden at runtime
  inputSchema: CodingInputSchema,
  outputSchema: CodingOutputSchema,
  options: {
    // Pass through SDK options
    permissionMode: 'bypassPermissions',
    allowDangerouslySkipPermissions: true,
  },
});
```

**Usage Examples**:

```typescript
// 1. Use preset with default prompt
import { CodingAgent } from '@openharness/anthropic/presets';

const result = await CodingAgent.execute(
  { task: 'Build a REST API for user management' },
  'session-123'
);
console.log(result.summary); // Type: string

// 2. Override preset prompt at runtime
import { createPromptTemplate } from '@openharness/anthropic/provider';

const customPrompt = createPromptTemplate<CodingInput>({
  render: ({ task }) => `CUSTOM: ${task}`,
});

const result2 = await CodingAgent.execute(
  { task: 'Build API' },
  'session-123',
  { prompt: customPrompt }  // Override
);

// 3. Create custom agent from scratch
import { defineAnthropicAgent } from '@openharness/anthropic';

const MyAgent = defineAnthropicAgent({
  name: 'DataAnalyzer',
  prompt: createPromptTemplate({
    render: ({ data }: { data: string }) => `Analyze: ${data}`,
  }),
  inputSchema: z.object({ data: z.string() }),
  outputSchema: z.object({ insights: z.array(z.string()) }),
});

const insights = await MyAgent.execute({ data: 'Sales Q4 2024.csv' }, 'session-456');
```

### Factory Implementation Sketch

**`provider/factory.ts`** (conceptual):

```typescript
import type { Options } from '@anthropic-ai/claude-agent-sdk';
import type { ZodType } from 'zod';
import { createContainer } from '@openharness/sdk';
import { InternalAnthropicAgent } from './internal-agent.js';  // Internal only
import type { PromptTemplate } from './prompts.js';

export interface AnthropicAgentDefinition<TInput, TOutput> {
  name: string;
  prompt: PromptTemplate<TInput> | string;
  inputSchema: ZodType<TInput>;
  outputSchema: ZodType<TOutput>;
  options?: Partial<Options>;
}

export interface ExecuteOptions<TOutput> {
  callbacks?: IAgentCallbacks<TOutput>;
  timeoutMs?: number;
  prompt?: PromptTemplate<TInput>;  // Override
}

export function defineAnthropicAgent<TInput, TOutput>(
  definition: AnthropicAgentDefinition<TInput, TOutput>
) {
  // Create container internally (hidden from users)
  const container = createContainer({ mode: 'live' });

  // Instantiate internal agent (NOT exposed to users)
  const internalAgent = new InternalAnthropicAgent(
    definition.name,
    container.get(IAnthropicRunnerToken),
    container.get(IUnifiedEventBusToken)  // ONLY unified bus
  );

  return {
    async execute(
      input: TInput,
      sessionId: string,
      opts?: ExecuteOptions<TOutput>
    ): Promise<TOutput> {
      // Validate input
      definition.inputSchema.parse(input);

      // Render prompt
      const promptTemplate = opts?.prompt ?? definition.prompt;
      const promptStr = typeof promptTemplate === 'string'
        ? promptTemplate
        : promptTemplate.render(input);

      // Execute via internal agent
      return internalAgent.run<TOutput>(promptStr, sessionId, {
        outputFormat: zodToSdkSchema(definition.outputSchema),
        callbacks: opts?.callbacks,
        timeoutMs: opts?.timeoutMs,
        ...definition.options,
      });
    },

    // TODO: Implement .stream() for async iterable input (FR-006)
    stream() { throw new Error('Not implemented'); },
  };
}
```

**Note**: `InternalAnthropicAgent` class contains the 330 lines of logic from current `BaseAnthropicAgent`, but is:
- **NOT exported** from package
- **NOT extensible** by users
- **ONLY** used internally by factory
- Uses **ONLY** `IUnifiedEventBus` (no dual bus support)

### Package Exports Configuration

**`packages/anthropic/package.json`**:

```json
{
  "name": "@openharness/anthropic",
  "version": "2.0.0",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./presets": {
      "import": "./dist/presets/index.js",
      "types": "./dist/presets/index.d.ts"
    },
    "./provider": {
      "import": "./dist/provider/index.js",
      "types": "./dist/provider/index.d.ts"
    }
  }
}
```

**Import Paths After Refactor**:

```typescript
// Framework primitives (ONLY way to create agents)
import {
  defineAnthropicAgent,
  createPromptTemplate,
  type PromptTemplate,
  type AnthropicAgentDefinition,
} from '@openharness/anthropic';

// Preset agents (optional, for quick start)
import {
  CodingAgent,
  ReviewAgent,
  PlannerAgent,
} from '@openharness/anthropic/presets';

// NO BaseAnthropicAgent export (internal implementation)
// NO AnthropicRunner export (infrastructure detail)
```

---

## Implementation Phases

### Phase 1: Restructure Folders (No Breaking Changes)

**Goal**: Organize files into layers without changing exports

**Actions**:
1. Create `src/infra/`, `src/provider/`, `src/presets/` directories
2. Move files:
   - `runner/`, `recording/`, `monologue/` → `infra/`
   - `agents/base-anthropic-agent.ts` → `provider/`
   - `agents/{coding,review,planner}-agent.ts` → `presets/*/agent.ts`
3. Update internal imports (all paths change)
4. Keep `src/index.ts` exports unchanged (re-export from new locations)

**Verification**: All tests pass, external imports still work

### Phase 2: Implement Factory (New API)

**Goal**: Provide `defineAnthropicAgent()` as alternative to class hierarchy

**Actions**:
1. Create `provider/prompts.ts`:
   - Define `PromptTemplate<TData>` interface
   - Implement `createPromptTemplate()` helper
2. Create `provider/factory.ts`:
   - Implement `defineAnthropicAgent<TInput, TOutput>()`
   - Handle DI container creation internally
   - Wire up callbacks, event mapping, monologue
3. Write tests:
   - Custom agent creation
   - Type safety checks
   - Prompt override scenarios

**Verification**: Can create custom agent in < 20 lines (SC-001)

### Phase 3: Convert Presets (Breaking Change for Preset Imports)

**Goal**: Refactor concrete agents to use factory + TypeScript prompts

**Actions**:
1. For each preset (coding, review, planner):
   - Convert `.prompt.md` → `prompt.ts` (TypeScript template)
   - Refactor `*Agent.ts` to use `defineAnthropicAgent()`
   - Create barrel export `presets/*/index.ts`
2. Update `src/presets.ts` to re-export all presets
3. Update package.json exports (add `"./presets"` entry)
4. Add deprecation warnings to old export paths in `src/index.ts`

**Verification**:
- Preset agents work with zero config (SC-002)
- Old imports show deprecation warning but still work

### Phase 4: Documentation (Non-Code)

**Goal**: Align documentation with new architecture

**Actions**:
1. Rewrite [CLAUDE.md](../../CLAUDE.md):
   - Remove auto-generated content
   - Add navigation links to `.knowledge/docs/`
   - Keep: commands, auth notes, project structure
2. Create `.knowledge/docs/how-it-works.md`:
   - Layer architecture diagram
   - Request flow: DI → prompt → execution → events
   - Code examples for each layer
3. Create `.knowledge/scripts/sync-docs.sh`:
   - Script to copy `.knowledge/docs/` → `packages/sdk/docs/`
4. Update [examples/](../../examples/) to show both approaches:
   - Using presets (quick start)
   - Creating custom agents (advanced)

**Verification**: Documentation navigation ≤ 2 clicks (SC-005)

### Phase 5: Migration & Deprecation

**Goal**: Smooth migration path, eventual removal of old patterns

**Actions**:
1. Add console warnings to old export paths:
   ```typescript
   // src/index.ts (backward compat)
   export { CodingAgent } from './presets/coding/index.js';
   console.warn(
     'Importing CodingAgent from @openharness/sdk is deprecated.\n' +
     'Use: import { CodingAgent } from "@openharness/anthropic/presets"'
   );
   ```
2. Update all examples to use new import paths
3. Create migration guide in `.knowledge/docs/migration-v2.md`:
   - Old → new import table
   - Class-based → factory conversion examples
   - Markdown prompts → TypeScript templates
4. Tag release as `v2.0.0` (semver major for breaking changes)

**Verification**: All examples run without errors, deprecation warnings visible

---

## Migration Path

### Backward Compatibility Strategy

**Old Imports** (v1.x - deprecated but functional):
```typescript
import { CodingAgent, ReviewAgent } from '@openharness/sdk';
// or
import { CodingAgent } from '@openharness/anthropic';
```

**New Imports** (v2.x - recommended):
```typescript
import { CodingAgent, ReviewAgent } from '@openharness/anthropic/presets';
```

**Deprecation Warning** (console output):
```
⚠️  DEPRECATION WARNING
Importing CodingAgent from '@openharness/anthropic' is deprecated.
Update to: import { CodingAgent } from '@openharness/anthropic/presets'
This path will be removed in v3.0.0
```

### Breaking Changes (v2.0.0)

1. **Preset imports require explicit `/presets` path**
   - Before: `import { CodingAgent } from '@openharness/anthropic'`
   - After: `import { CodingAgent } from '@openharness/anthropic/presets'`

2. **Prompts no longer loaded from `.md` files**
   - Before: `PromptRegistry.formatCoding({ task })`
   - After: `codingPrompt.render({ task })`

3. **Custom agents use factory instead of class extension**
   - Before: `class MyAgent extends BaseAnthropicAgent { ... }`
   - After: `const MyAgent = defineAnthropicAgent({ ... })`

### Migration Examples

**Example 1: Update Preset Imports**

```diff
- import { CodingAgent, ReviewAgent } from '@openharness/sdk';
+ import { CodingAgent, ReviewAgent } from '@openharness/anthropic/presets';

  const result = await CodingAgent.execute({ task: 'Build API' }, 'session-1');
  // No other changes needed
```

**Example 2: Convert Custom Class-Based Agent to Factory**

Before (v1.x):
```typescript
@injectable()
class MyAnalyzer extends BaseAnthropicAgent {
  constructor(
    runner = inject(IAnthropicRunnerToken),
    eventBus = inject(IEventBusToken, { optional: true }) ?? null,
  ) {
    super("Analyzer", runner, eventBus);
  }

  async analyze(data: string, sessionId: string): Promise<Analysis> {
    const prompt = `Analyze this data: ${data}`;
    return this.run<Analysis>(prompt, sessionId, {
      outputFormat: AnalysisSchema,
    });
  }
}

// Usage (old):
const container = createContainer({ mode: 'live' });
const analyzer = container.get(MyAnalyzer);
const result = await analyzer.analyze('Q4 sales', 'session-1');
```

After (v2.x - ~15 lines instead of ~20):
```typescript
const myPrompt = createPromptTemplate<{ data: string }>({
  render: ({ data }) => `Analyze this data: ${data}`,
});

const MyAnalyzer = defineAnthropicAgent({
  name: 'Analyzer',
  prompt: myPrompt,
  inputSchema: z.object({ data: z.string() }),
  outputSchema: AnalysisSchema,
});

// Usage (new - simpler, no container):
const result = await MyAnalyzer.execute({ data: 'Q4 sales' }, 'session-1');
```

**Benefits**:
- ❌ Remove: 12 lines of boilerplate (decorators, constructor, DI)
- ❌ Remove: Container management in user code
- ✅ Add: Type-safe prompt template
- ✅ Gain: Simpler usage (no container.get())

**Example 3: Override Preset Prompt**

```typescript
import { CodingAgent } from '@openharness/anthropic/presets';
import { createPromptTemplate } from '@openharness/anthropic/provider';

const myCustomPrompt = createPromptTemplate({
  render: ({ task }: { task: string }) => `
    # Custom Coding Prompt
    Task: ${task}
    Style: Use functional programming patterns
  `,
});

const result = await CodingAgent.execute(
  { task: 'Build user auth' },
  'session-1',
  { prompt: myCustomPrompt }  // Override default prompt
);
```

---

## Assumptions

1. **TypeScript Projects**: Developers have TypeScript build toolchain (can import `.ts` files)
2. **ESM Support**: Package.json `exports` field supported (Node.js 12.7+, Bun 0.1+)
3. **Template Literals Acceptable**: Developers prefer type safety over markdown readability for prompts
4. **DI Container Hidden**: End users don't need to interact with `@needle-di` directly
5. **Zod Schemas**: Developers comfortable with Zod for runtime validation

---

## Non-Goals

This specification explicitly does NOT include:

1. **Runtime Prompt Template Compilation**
   - No Handlebars, Mustache, or Liquid template engines
   - TypeScript template literals only

2. **Visual Prompt Editor**
   - No GUI for editing prompts
   - Prompts are code (edited in IDE)

3. **CommonJS Support**
   - ESM-only (modern Node.js, Bun)
   - No dual package hazard mitigation

4. **Non-TypeScript Projects**
   - Framework requires TypeScript for type safety
   - No JavaScript-only custom agent support

5. **Prompt Versioning System**
   - No built-in prompt version control
   - Use git for prompt history

6. **Multi-Provider Factory**
   - Factory is Anthropic-specific
   - Other providers (OpenAI, Gemini) out of scope

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Developers prefer markdown prompts** | Low adoption of TypeScript templates | Provide migration guide with examples showing benefits (type safety, testability) |
| **Breaking changes alienate users** | Migration friction | Keep backward compat warnings for 1 major version, comprehensive migration docs |
| **Factory pattern too abstract** | Confusion for new users | Document both patterns (factory for simplicity, class for advanced control) |
| **Phase 3 takes longer than expected** | Delayed release | Phase 1-2 are non-breaking, can ship incrementally |
| **Examples become outdated** | User confusion | Automate example testing in CI |

---

## Open Questions

1. **Monologue Decorator Compatibility**: How does `@Monologue` decorator work with factory-based agents?
   - **Answer**: Factory wraps agent, decorator attaches to execute method
   - **Action**: Test monologue integration in Phase 2

2. **Recording System with Factory**: Does `@Record` decorator still work?
   - **Answer**: Recording attaches to runner, not agent class
   - **Action**: Verify recording tests pass in Phase 2

3. **Multi-Turn Conversations**: How does `.stream()` method support async iterable input?
   - **Answer**: Deferred to follow-up spec (complex API design)
   - **Action**: Document as Phase 2 extension point

4. **Preset Prompt Versioning**: Should presets export multiple prompt versions?
   - **Answer**: No, use git tags for breaking prompt changes
   - **Action**: Document in migration guide

---

## References

- [Spec 012: defineAnthropicAgent Factory](../012-define-anthropic-agent/spec.md) - Original factory pattern proposal
- [.knowledge/docs/why.md](../../.knowledge/docs/why.md) - Project philosophy and vision
- [.knowledge/docs/sdk/overview.md](../../.knowledge/docs/sdk/overview.md) - SDK architecture overview
- [packages/anthropic/src/index.ts](../../packages/anthropic/src/index.ts) - Current exports (to be refactored)
- [packages/anthropic/src/agents/base-anthropic-agent.ts](../../packages/anthropic/src/agents/base-anthropic-agent.ts) - Current base class (330 lines)
- [packages/anthropic/src/runner/prompts.ts](../../packages/anthropic/src/runner/prompts.ts) - Current PromptRegistry (to be replaced)

---

**Last Updated**: 2025-12-28
**Next Steps**: User review → Delete specs/012/ → Start implementation cycle with oharnes commands
