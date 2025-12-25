---
stepsCompleted: [1, 2]
inputDocuments:
  - path: "_bmad-output/prd.md"
    type: "prd"
  - path: "_bmad-output/prd-harness.md"
    type: "prd"
  - path: "_bmad-output/prd-infrastructure.md"
    type: "prd"
  - path: "_bmad-output/epics-harness.md"
    type: "epics"
  - path: "docs/index.md"
    type: "project-docs"
  - path: "docs/architecture-sdk.md"
    type: "project-docs"
  - path: "docs/architecture-cli.md"
    type: "project-docs"
workflowType: 'architecture'
project_name: 'Open Harness'
user_name: 'Abdullah'
date: '2024-12-24'
hasProjectContext: false
rescueOperation: true
---

# Architecture Decision Document - Open Harness SDK

**Project:** Open Harness
**Author:** Abdullah + BMad Master
**Date:** December 24, 2024
**Status:** Rescue Operation - Restoring Correct Architecture

---

## Executive Summary

This document defines the **correct layered architecture** for the Open Harness SDK. It serves as both a rescue plan (restoring deleted working code) and an architectural guide for the new Harness layer.

**Core Principle:** The Harness layer WRAPS the existing internal layer. It does NOT replace it.

---

## Problem Statement

### What Happened

An agent implementing the Harness SDK made an architectural error: instead of wrapping the existing internal implementation, it **deleted all internal code** and created a disconnected shell.

**Deleted (Working Code):**
- `runner/base-agent.ts` - Foundation with DI, StreamCallbacks, EventBus
- `core/container.ts` - NeedleDI composition root
- `core/tokens.ts` - Injection tokens
- `core/live-runner.ts` - Anthropic SDK integration
- `factory/agent-factory.ts` - createAgent() public API
- `monologue/wrapper.ts` - withMonologue() narrative generation
- `workflow/orchestrator.ts` - Workflow execution
- `workflow/task-list.ts` - Task management
- All built-in agents and examples

**Created (Disconnected Code):**
- `harness/base-harness.ts` - AsyncGenerator pattern (correct concept)
- `harness/agent.ts` - Stub with no LLM connection (broken)
- `harness/state.ts` - PersistentState (correct)
- `harness/types.ts` - Types (correct)

### The Critical Flaw

The new `Agent` class has no connection to actual LLM execution:

```typescript
// BROKEN: Current implementation
class Agent {
  async run(params) {
    return this.runFn(params);  // Just calls user function - no LLM!
  }
}
```

The original `BaseAgent` actually executed LLM calls:

```typescript
// WORKING: What was deleted
@injectable()
class BaseAgent {
  constructor(
    runner: IAgentRunner = inject(IAgentRunnerToken),
    eventBus: IEventBus = inject(IEventBusToken),
  ) {}

  async run(prompt, sessionId, options) {
    const result = await this.runner.run({...});  // Calls Anthropic SDK
    // Fires callbacks, publishes events...
  }
}
```

---

## Architectural Decision: Two-Layer SDK

### ADR-001: Layered Architecture

**Decision:** The SDK has two distinct layers that work together.

```
┌─────────────────────────────────────────────────────────┐
│ LAYER 1: HARNESS (Public API for Step-Aware Agents)     │
├─────────────────────────────────────────────────────────┤
│  BaseHarness    - Abstract class users extend           │
│  HarnessAgent   - Step-aware wrapper around BaseAgent   │
│  PersistentState - State + bounded context              │
│  Types          - Step, StepYield, Constraints, etc.    │
│                                                         │
│  Users own: step() implementation, orchestration logic  │
│  Framework owns: step counting, history, state mgmt     │
└─────────────────────────────────────────────────────────┘
                        │ wraps
                        ▼
┌─────────────────────────────────────────────────────────┐
│ LAYER 2: INTERNAL (LLM Execution Infrastructure)        │
├─────────────────────────────────────────────────────────┤
│  BaseAgent      - DI, StreamCallbacks, runs LLM         │
│  Container      - NeedleDI composition root             │
│  Tokens         - IAgentRunner, IEventBus, IVault       │
│  LiveRunner     - Anthropic SDK integration             │
│  AgentFactory   - createAgent() function                │
│  Monologue      - withMonologue() narrative wrapper     │
│  TaskList       - Workflow task management              │
│                                                         │
│  Handles: DI, callbacks, events, recording/replay       │
└─────────────────────────────────────────────────────────┘
                        │ uses
                        ▼
┌─────────────────────────────────────────────────────────┐
│ EXTERNAL DEPENDENCIES                                   │
├─────────────────────────────────────────────────────────┤
│  @anthropic-ai/claude-agent-sdk                         │
│  @needle-di/core                                        │
└─────────────────────────────────────────────────────────┘
```

**Rationale:**
- Internal layer is stable, tested, working
- Harness layer adds time-dimensionality without breaking internals
- Users can use either layer depending on needs
- Clean separation of concerns

---

### ADR-002: HarnessAgent Wraps BaseAgent

**Decision:** The harness `Agent` (renamed to `HarnessAgent`) wraps the internal `BaseAgent`.

```typescript
// CORRECT IMPLEMENTATION
import { BaseAgent } from "../runner/base-agent.js";
import { createContainer } from "../core/container.js";

export class HarnessAgent<TState, TInput, TOutput> {
  private baseAgent: BaseAgent;
  readonly name: string;

  constructor(config: HarnessAgentConfig<TState, TInput, TOutput>) {
    this.name = config.name ?? "Agent";

    // Get BaseAgent from DI container
    const container = createContainer({ mode: "live" });
    this.baseAgent = new BaseAgent(
      this.name,
      container.get(IAgentRunnerToken),
      container.get(IEventBusToken),
    );
  }

  async run(params: AgentRunParams<TState, TInput, TOutput>): Promise<TOutput> {
    // Add step context to prompt
    const contextualPrompt = this.buildPromptWithContext(params);

    // Use BaseAgent's actual LLM execution
    const result = await this.baseAgent.run(
      contextualPrompt,
      `step-${params.stepNumber}`,
      { callbacks: params.callbacks }
    );

    // Transform result as needed
    return this.transformResult(result, params);
  }
}
```

**Rationale:**
- HarnessAgent adds step awareness (stepNumber, stepHistory, constraints)
- BaseAgent handles actual LLM execution with DI and callbacks
- Clean composition, no duplication

---

### ADR-003: Dual Export Strategy

**Decision:** The SDK exports both layers for different use cases.

```typescript
// packages/sdk/src/index.ts

// ============================================
// HARNESS LAYER (Primary API for Step-Aware Agents)
// ============================================

export { BaseHarness, HarnessAgent, PersistentState } from "./harness/index.js";
export type { Step, StepYield, Constraints, LoadedContext, HarnessConfig } from "./harness/index.js";

// ============================================
// INTERNAL LAYER (Direct Access for Simple Use Cases)
// ============================================

export { createAgent } from "./factory/agent-factory.js";
export { createWorkflow } from "./factory/workflow-builder.js";
export { withMonologue } from "./monologue/wrapper.js";
export { TaskList } from "./workflow/task-list.js";
export { BaseAgent, type StreamCallbacks } from "./runner/base-agent.js";

// ============================================
// BUILT-IN AGENTS
// ============================================

export { CodingAgent } from "./agents/coding-agent.js";
export { ReviewAgent } from "./agents/review-agent.js";

// ============================================
// TYPES
// ============================================

export type { AgentEvent, SessionResult, CompactData, StatusData } from "./runner/models.js";
export type { Task, TaskStatus } from "./workflow/task-list.js";
export type { ContainerOptions } from "./core/container.js";

// ============================================
// ADVANCED (Container Access)
// ============================================

export { createContainer } from "./core/container.js";
```

**Rationale:**
- Harness users get step-aware primitives
- Simple use cases can use createAgent() directly
- Power users can access container for custom DI

---

## File Structure

```
packages/sdk/src/
├── index.ts                    # Main exports (both layers)
│
├── harness/                    # LAYER 1: Harness (Step-Aware)
│   ├── index.ts               # Harness exports
│   ├── base-harness.ts        # Abstract class for user extension
│   ├── harness-agent.ts       # Step-aware agent (wraps BaseAgent)
│   ├── state.ts               # PersistentState
│   └── types.ts               # Harness types
│
├── runner/                     # LAYER 2: Internal (LLM Execution)
│   ├── base-agent.ts          # Foundation agent with DI
│   ├── models.ts              # AgentEvent, SessionResult, etc.
│   └── prompts.ts             # Prompt utilities
│
├── core/                       # DI Infrastructure
│   ├── container.ts           # NeedleDI composition root
│   ├── tokens.ts              # Injection tokens
│   ├── decorators.ts          # DI decorators
│   ├── live-runner.ts         # Anthropic SDK runner
│   ├── replay-runner.ts       # Replay runner for testing
│   └── vault.ts               # Recording storage
│
├── factory/                    # Public Factories
│   ├── agent-factory.ts       # createAgent()
│   └── workflow-builder.ts    # createWorkflow()
│
├── monologue/                  # Narrative Generation
│   └── wrapper.ts             # withMonologue()
│
├── workflow/                   # Workflow Orchestration
│   ├── orchestrator.ts        # Workflow execution
│   └── task-list.ts           # TaskList class
│
├── agents/                     # Built-in Agents
│   ├── coding-agent.ts        # CodingAgent
│   ├── review-agent.ts        # ReviewAgent
│   └── monologue.ts           # AgentMonologue (for narrative)
│
└── examples/                   # Reference Examples
    ├── harness/
    │   ├── trading-harness.ts # Time-based harness example
    │   └── coding-harness.ts  # Task-completion harness example
    └── basic/
        ├── basic-agent.ts     # Simple createAgent() usage
        └── workflow-demo.ts   # Workflow example
```

---

## Implementation Sequence

### Phase 1: Restore Internal Layer

1. **Restore all deleted files from git:**
   ```bash
   git checkout HEAD -- packages/sdk/src/runner/
   git checkout HEAD -- packages/sdk/src/core/
   git checkout HEAD -- packages/sdk/src/factory/
   git checkout HEAD -- packages/sdk/src/monologue/
   git checkout HEAD -- packages/sdk/src/workflow/
   git checkout HEAD -- packages/sdk/src/agents/
   ```

2. **Verify internal layer works:**
   ```bash
   bun test  # Existing tests should pass
   ```

### Phase 2: Fix Harness Layer

3. **Rename `Agent` to `HarnessAgent`:**
   - File: `harness/agent.ts` → `harness/harness-agent.ts`
   - Class: `Agent` → `HarnessAgent`

4. **Wire HarnessAgent to BaseAgent:**
   - Import BaseAgent and container
   - Create BaseAgent instance in constructor
   - Delegate run() calls to BaseAgent with step context

5. **Update harness exports:**
   - Export HarnessAgent (keep Agent as alias for backward compat)
   - Update types if needed

### Phase 3: Unify SDK Exports

6. **Update main index.ts:**
   - Export both harness and internal layers
   - Maintain backward compatibility

7. **Fix examples:**
   - Trading harness example using HarnessAgent properly
   - Coding harness example with isComplete()

### Phase 4: Verification

8. **Run all tests:**
   ```bash
   bun test
   ```

9. **Manual verification:**
   - Run an example that actually calls the LLM
   - Verify callbacks fire correctly
   - Verify step tracking works

---

## Key Type Definitions

### Harness Types (Keep)

```typescript
// Step - Record of a single execution step
interface Step<TInput, TOutput> {
  stepNumber: number;
  timestamp: number;
  input: TInput;
  output: TOutput;
  stateDelta: StateDelta;
}

// StepYield - What execute() yields
interface StepYield<TInput, TOutput> {
  input: TInput;
  output: TOutput;
}

// HarnessConfig - Configuration for BaseHarness
interface HarnessConfig<TState> {
  initialState: TState;
  maxContextSteps?: number;
}

// AgentRunParams - What HarnessAgent.run() receives
interface AgentRunParams<TState, TInput, TOutput> {
  input: TInput;
  context: TState;
  stepNumber: number;
  stepHistory: Step<TInput, TOutput>[];
  constraints: Constraints;
  callbacks?: StreamCallbacks;  // From internal layer
}
```

### Internal Types (Restore)

```typescript
// StreamCallbacks - Event handlers during agent execution
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

// AgentEvent - Event published to EventBus
interface AgentEvent {
  type: EventType;
  timestamp: number;
  data: unknown;
  agentName: string;
}
```

---

## Success Criteria

| Criteria | Validation |
|----------|------------|
| Internal layer restored | All deleted files recovered from git |
| Tests pass | `bun test` succeeds |
| HarnessAgent calls LLM | Example runs and gets Claude response |
| Callbacks fire | StreamCallbacks receive events |
| Step tracking works | stepHistory populated correctly |
| Both APIs exported | createAgent() and BaseHarness both available |

---

## Appendix: Files to Restore

```
# From git HEAD (committed, but deleted in working tree)
packages/sdk/src/runner/base-agent.ts
packages/sdk/src/runner/models.ts
packages/sdk/src/runner/prompts.ts
packages/sdk/src/core/container.ts
packages/sdk/src/core/tokens.ts
packages/sdk/src/core/decorators.ts
packages/sdk/src/core/live-runner.ts
packages/sdk/src/core/replay-runner.ts
packages/sdk/src/core/vault.ts
packages/sdk/src/factory/agent-factory.ts
packages/sdk/src/factory/workflow-builder.ts
packages/sdk/src/monologue/wrapper.ts
packages/sdk/src/workflow/orchestrator.ts
packages/sdk/src/workflow/task-list.ts
packages/sdk/src/agents/coding-agent.ts
packages/sdk/src/agents/review-agent.ts
packages/sdk/src/agents/monologue.ts
packages/sdk/src/examples/* (all)
```
