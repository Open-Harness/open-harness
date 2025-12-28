# SDK Consolidation Handoff

## Goal

Make `@openharness/sdk` **provider-agnostic**. All Anthropic-specific code moves to `@openharness/anthropic`.

**Why?** The SDK should be a reusable workflow orchestration layer that can work with any LLM provider, not just Anthropic.

---

## Current State (Commit: 5035423)

### What's Complete ✅

**Phase 1: Create @openharness/anthropic**
- Package structure created at `packages/anthropic/`
- All agents moved: `CodingAgent`, `ReviewAgent`, `ParserAgent`, `PlannerAgent`, `ValidationReviewAgent`
- Runner moved: `AnthropicRunner`, `event-mapper`, `models`
- Recording system moved: `Vault`, `ReplayRunner`, `RecordingFactory`, `@Record` decorator
- `AnthropicMonologueLLM` moved
- **Package builds and tests pass** (2/2 replay tests)

**Phase 2: SDK Cleanup (Partial)**
- Deleted `providers/anthropic/` directory
- Deleted duplicate recording files from `core/`
- Updated `container.ts` to be provider-agnostic (no agent bindings)
- Updated `tokens.ts` with generic types (`AgentEvent`, `GenericMessage`, `GenericRunnerOptions`)
- Updated `event-bus.ts` and `callbacks/types.ts` to use generic types
- Simplified `agent-factory.ts` (deprecated `createAgent()`)
- Deleted `workflow-builder.ts` and `orchestrator.ts`

### What's Broken ❌

**SDK does NOT typecheck.** The following files have broken imports:

| File | Broken Imports | Purpose |
|------|----------------|---------|
| `factory/harness-factory.ts` | `ParserAgent`, `ValidationReviewAgent` | Creates TaskHarness with DI |
| `harness/task-harness.ts` | `ParserAgent`, `ValidationReviewAgent` | Main task execution orchestrator |
| `harness/types.ts` | `StreamCallbacks` from deleted path | Type definitions for harness |

**Test files with broken imports** (many):
- `tests/helpers/recording-wrapper.ts`
- `tests/helpers/replay-runner.ts`
- `tests/replay/*.test.ts`
- `tests/integration/*.test.ts`
- `tests/unit/agent-factory.test.ts`

---

## The Architectural Tension

### The Problem

The **TaskHarness** system is a significant feature that orchestrates multi-step task execution. It depends on:

1. **ParserAgent** - Parses `tasks.md` into structured tasks
2. **ValidationReviewAgent** - Reviews/validates completed tasks
3. **CodingAgent** (indirectly) - Executes code tasks

These are all Anthropic-specific implementations.

### The Question

**How do we preserve TaskHarness functionality while making SDK provider-agnostic?**

---

## Dependency Map (To Be Researched)

### SDK → Anthropic Dependencies

We need to understand what SDK code depends on Anthropic implementations:

```
packages/sdk/src/
├── factory/
│   └── harness-factory.ts → ParserAgent, ValidationReviewAgent (BROKEN)
├── harness/
│   ├── task-harness.ts → ParserAgent, ValidationReviewAgent (BROKEN)
│   └── types.ts → StreamCallbacks (BROKEN)
├── callbacks/
│   └── types.ts → AgentEvent (FIXED - now uses tokens.ts)
├── core/
│   ├── container.ts → (FIXED - no agent bindings)
│   ├── event-bus.ts → AgentEvent (FIXED - now uses tokens.ts)
│   └── tokens.ts → (FIXED - generic types)
└── monologue/
    └── monologue-decorator.ts → AgentEvent (FIXED - now uses tokens.ts)
```

### Anthropic → SDK Dependencies

The anthropic package imports from SDK:

```
packages/anthropic/src/
├── agents/*.ts → IAgentCallbacks, EventBus, tokens from @openharness/sdk
├── runner/*.ts → tokens, callbacks from @openharness/sdk
├── recording/*.ts → IConfig, RunnerCallbacks from @openharness/sdk
└── monologue/*.ts → IMonologueLLM, MonologueConfig from @openharness/sdk
```

### Interface Inventory

SDK already defines these interfaces in `tokens.ts`:

```typescript
// Already defined and NOT coupled to Anthropic:
interface IParserAgent { parse(input: IParserAgentInput): Promise<IParserAgentOutput> }
interface IParserAgentInput { tasksFilePath: string; tasksContent: string; specFilePath?: string }
interface IParserAgentOutput { tasks: IParsedTask[]; phases: IPhaseInfo[]; warnings: string[]; metadata: IParserMetadata }
interface IParsedTask { id: string; phase: string; description: string; ... }

// Also defined:
interface ITaskHarness { run(callbacks?): Promise<IHarnessSummary>; getState(); ... }
interface IValidationResult { taskId: string; passed: boolean; reasoning: string; ... }
```

**Key Insight:** The *interfaces* for TaskHarness already exist in SDK. The problem is the *factory* and *harness implementation* import concrete agent classes instead of using these interfaces.

---

## Research Questions

Before deciding on a solution, we need to answer:

### 1. What uses TaskHarness?
- Is it used by external consumers?
- Is it used by the listr2 harness renderer?
- What would break if the API changes?

### 2. What uses harness-factory?
- Who calls `createTaskHarness()`?
- Can callers provide their own agents?

### 3. What's the test coverage situation?
- Which tests are provider-agnostic (keep in SDK)?
- Which tests need real agents (move to anthropic)?

### 4. What about the fluent harness API (007)?
- Does `defineHarness()` depend on Anthropic?
- Is `HarnessInstance` provider-agnostic?

### 5. Cross-package dependencies
- Does anything in `@openharness/core` need updating?
- Does `@openharness/transports` have any dependencies on this?

---

## Potential Solutions

### Option A: Interface-Based Decoupling

Keep TaskHarness in SDK but make it accept agent instances via parameters:

```typescript
// Current (broken)
export function createTaskHarness(options: CreateTaskHarnessOptions): TaskHarness {
  const parser = container.get(ParserAgent);  // Hardcoded!
  const reviewer = container.get(ValidationReviewAgent);  // Hardcoded!
  return new TaskHarness(config, parser, reviewer, eventBus);
}

// Proposed
export function createTaskHarness(options: {
  config: TaskHarnessConfig;
  parserAgent: IParserAgent;    // Interface from SDK
  reviewAgent: IReviewAgent;    // Interface from SDK (needs definition)
}): TaskHarness {
  return new TaskHarness(config, options.parserAgent, options.reviewAgent, eventBus);
}
```

**Pros:** Preserves SDK API, users bring their own agents
**Cons:** Requires users to instantiate agents manually

### Option B: Move TaskHarness to Anthropic

The entire harness system is tightly coupled, so move it:

```
packages/anthropic/src/harness/
├── task-harness.ts
├── harness-factory.ts
└── types.ts
```

**Pros:** Clean separation, SDK becomes minimal
**Cons:** API breakage, feature seems misplaced in "anthropic" package

### Option C: Provider Registration Pattern

SDK defines harness infrastructure, providers register implementations:

```typescript
// In SDK
const container = createContainer();

// In user code
import { registerAnthropicProvider } from '@openharness/anthropic';
registerAnthropicProvider(container);

// Now TaskHarness can resolve agents via DI
const harness = createTaskHarness({ config });
```

**Pros:** Clean architecture, extensible
**Cons:** More ceremony for users, complex DI setup

### Option D: Hybrid (Recommended direction)

- Keep harness *infrastructure* in SDK (base classes, types, interfaces)
- Move harness *implementation* to anthropic (or make it interface-based)
- Factory accepts either interface-based agents OR uses DI

---

## Next Steps

1. **Research** - Map out all dependencies between packages
2. **Decide** - Choose architecture based on findings
3. **Implement** - Complete the refactor
4. **Test** - Ensure both packages work together
5. **Document** - Update API docs

---

## Files to Investigate

```bash
# Find all imports from providers/anthropic (now broken)
grep -r "providers/anthropic" packages/sdk/src/ --include="*.ts"

# Find all uses of TaskHarness
grep -r "TaskHarness\|createTaskHarness" packages/ --include="*.ts"

# Find all uses of ParserAgent
grep -r "ParserAgent" packages/ --include="*.ts"

# Check what the fluent API depends on
grep -r "import.*from" packages/sdk/src/factory/define-harness.ts
grep -r "import.*from" packages/sdk/src/harness/harness-instance.ts
```

---

## Package Structure Reference

### Current (Target)

```
@openharness/core          → Interfaces (IAgent, IAgentCallbacks)
@openharness/sdk           → Provider-agnostic orchestration
@openharness/anthropic     → Anthropic agents + runner + recording
@openharness/transports    → Output destinations
```

### What Should Live Where?

| Component | Current Location | Proposed Location | Reason |
|-----------|------------------|-------------------|--------|
| BaseHarness | sdk | sdk | Provider-agnostic |
| PersistentState | sdk | sdk | Provider-agnostic |
| EventBus | sdk | sdk | Provider-agnostic |
| UnifiedEventBus | sdk | sdk | Provider-agnostic |
| TaskHarness | sdk (broken) | ??? | Depends on decision |
| harness-factory | sdk (broken) | ??? | Depends on decision |
| defineHarness | sdk | sdk (check) | May be provider-agnostic |
| HarnessInstance | sdk | sdk (check) | May be provider-agnostic |
| CodingAgent | anthropic | anthropic ✅ | Provider-specific |
| ParserAgent | anthropic | anthropic ✅ | Provider-specific |
| AnthropicRunner | anthropic | anthropic ✅ | Provider-specific |
| Vault/Recording | anthropic | anthropic ✅ | Uses SDKMessage |

---

## Commit Reference

- **Last working commit:** `65b6159` (before consolidation started)
- **Current WIP commit:** `5035423` (anthropic done, SDK broken)
- **Branch:** `refactor-02`
