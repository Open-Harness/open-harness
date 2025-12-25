# Research: Harness Renderer Integration

**Date**: 2025-12-26
**Feature**: 003-harness-renderer
**Status**: Complete

## Executive Summary

This research resolves the architectural questions for integrating the harness-renderer system with the SDK. The key decisions address where renderer responsibility lives, package structure, and the integration pattern between monologue generation and renderer visualization.

---

## 1. Current State Analysis

### SDK Architecture (Three Layers)

```text
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1 - HARNESS (Step-Aware Orchestration)               │
│  - BaseHarness: Abstract step-aware execution               │
│  - TaskHarness: Concrete task execution with agents         │
│  - PersistentState: State management with bounded context   │
├─────────────────────────────────────────────────────────────┤
│  LAYER 2 - AGENTS (Provider-Agnostic Agent System)          │
│  - BaseAnthropicAgent: Foundation for Claude agents         │
│  - IAgentCallbacks: Unified callback interface              │
│  - Concrete agents: CodingAgent, ReviewAgent, ParserAgent   │
├─────────────────────────────────────────────────────────────┤
│  LAYER 3 - RUNNERS (LLM Execution Infrastructure)           │
│  - AnthropicRunner: Production Claude API runner            │
│  - ReplayRunner: Testing runner with recorded responses     │
│  - DI Container: Dependency injection for all components    │
└─────────────────────────────────────────────────────────────┘
```

### Identified Gaps

| Gap | Description | Impact |
|-----|-------------|--------|
| Orphaned `withMonologue` export | `src/monologue/wrapper.js` doesn't exist | Build fails if import attempted |
| No monologue directory | MONOLOGUE-ARCHITECTURE.md not implemented | Narratives not generated |
| Renderer not in SDK | Spike code in separate repo (`listr2/examples/`) | Not usable as toolkit |
| TaskHarness lacks renderer | Only emits via `ITaskHarnessCallbacks` | No pluggable visualization |
| No documentation | Previous attempts didn't document | Users can't understand architecture |

### Harness-Renderer Spike (listr2/examples/)

The spike implements a working renderer architecture:

- **IHarnessRenderer**: 3-method interface (`initialize`, `handleEvent`, `finalize`)
- **BaseHarnessRenderer**: Abstract class with state tracking and event routing
- **Two implementations**: SimpleConsoleRenderer, Listr2HarnessRenderer
- **Event protocol**: `HarnessEvent` discriminated union with 13 event types
- **NarrativeEntry**: Matches SDK's expected narrative structure

---

## 2. Architectural Decisions

### Decision 1: Renderer Location

**Question**: Should renderer be in BaseHarness or TaskHarness?

**Options Evaluated**:

| Option | Pros | Cons |
|--------|------|------|
| A. BaseHarness | All harness types get rendering | Forces renderer on simple harnesses |
| B. TaskHarness only | Focused, task-specific | Other harness types need separate impl |
| C. Renderer middleware | Maximum flexibility, composable | Extra abstraction layer |

**Decision**: **Option B - TaskHarness accepts renderer via config**

**Rationale**:
1. BaseHarness is meant to be minimal (just step tracking)
2. TaskHarness is the only harness users interact with currently
3. Renderer is a cross-cutting concern that TaskHarness can own
4. Future harness types can add their own renderer patterns if needed
5. Keeps base class thin per constitution principle

**Implementation**:
```typescript
interface TaskHarnessConfig {
  // existing config...

  /** Optional renderer for visualization. If not provided, uses silent mode. */
  renderer?: IHarnessRenderer;
}
```

---

### Decision 2: Package Structure

**Question**: Where does harness-renderer code live? How do we organize for multiple LLM providers?

**Options Evaluated**:

| Option | Pros | Cons |
|--------|------|------|
| A. Feature-first | Easy to find by feature | Provider code mixed together |
| B. Provider-first (top-level) | Clear provider boundaries | Structure duplication |
| C. Hybrid (provider subdirs) | Balance of both | Deeper nesting |
| D. Separate packages | Independent versioning | Multi-package complexity |
| E. Provider namespaces | Single package, scales well | More subpaths |

**Decision**: **Option E - Single Package with Provider Namespaces**

**Rationale**:
1. v0.1.0 = single `bun add @openharness/sdk`
2. Scales cleanly: Adding OpenAI = copy `providers/anthropic/` → `providers/openai/`
3. Explicit imports: `@openharness/sdk/anthropic` makes provider choice obvious
4. Tree-shakeable: Don't use OpenAI? It's not in your bundle
5. Main export can re-export Anthropic as default for backward compatibility
6. Follows patterns from major SDKs (Prisma, Auth.js, LangChain)

**Implementation**:
```json
// package.json exports
{
  "exports": {
    ".": "./dist/index.js",
    "./anthropic": "./dist/providers/anthropic/index.js",
    "./openai": "./dist/providers/openai/index.js",
    "./renderer": "./dist/renderer/index.js",
    "./renderer/listr2": "./dist/renderer/listr2.js"
  }
}
```

**Usage patterns**:
```typescript
// Provider-specific import (explicit)
import { createTaskHarness } from '@openharness/sdk';
import { CodingAgent } from '@openharness/sdk/anthropic';
import { SimpleConsoleRenderer } from '@openharness/sdk/renderer';

// All-in-one import (convenience - re-exports default provider)
import { createTaskHarness, CodingAgent } from '@openharness/sdk';
```

---

### Decision 3: Folder Structure

**Question**: How should files be organized for v0.1.0?

**Decision**: Provider namespaces with clear separation between provider-agnostic and provider-specific code.

```text
packages/sdk/src/
├── core/                            # Infrastructure (provider-agnostic)
│   ├── container.ts                # DI container
│   ├── tokens.ts                   # DI tokens
│   ├── decorators.ts               # Base decorator utilities
│   └── index.ts
│
├── harness/                         # Orchestration (provider-agnostic)
│   ├── base-harness.ts
│   ├── task-harness.ts             # + renderer config
│   ├── task-harness-types.ts       # + renderer?: IHarnessRenderer
│   ├── task-state.ts
│   ├── harness-recorder.ts
│   ├── state.ts
│   ├── dependency-resolver.ts
│   ├── types.ts
│   └── index.ts
│
├── renderer/                        # Visualization (provider-agnostic)
│   ├── protocol.ts                 # HarnessEvent types
│   ├── interface.ts                # IHarnessRenderer
│   ├── base-renderer.ts            # BaseHarnessRenderer
│   ├── simple.ts                   # SimpleConsoleRenderer
│   ├── listr2.ts                   # Listr2HarnessRenderer
│   └── index.ts
│
├── providers/                       # ALL PROVIDER-SPECIFIC CODE
│   ├── anthropic/                  # @openharness/sdk/anthropic
│   │   ├── agents/
│   │   │   ├── base-agent.ts       # BaseAnthropicAgent
│   │   │   ├── coding-agent.ts
│   │   │   ├── parser-agent.ts
│   │   │   ├── review-agent.ts
│   │   │   ├── validation-review-agent.ts
│   │   │   └── index.ts
│   │   ├── monologue/
│   │   │   ├── generator.ts        # AnthropicMonologueGenerator
│   │   │   ├── prompts.ts          # DEFAULT, TERSE, VERBOSE
│   │   │   ├── decorator.ts        # @AnthropicMonologue
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   ├── runner/
│   │   │   ├── runner.ts           # AnthropicRunner
│   │   │   ├── replay-runner.ts
│   │   │   ├── event-mapper.ts
│   │   │   └── index.ts
│   │   └── index.ts                # Re-exports all anthropic
│   │
│   └── openai/                     # @openharness/sdk/openai (future)
│       ├── agents/
│       ├── monologue/
│       ├── runner/
│       └── index.ts
│
├── callbacks/                       # Cross-cutting types
│   ├── types.ts                    # IAgentCallbacks
│   └── index.ts
│
├── factory/                         # User-facing factories
│   ├── harness-factory.ts          # createTaskHarness
│   ├── agent-factory.ts            # createAgent
│   └── index.ts
│
├── workflow/                        # Task orchestration
│   ├── task-list.ts
│   ├── orchestrator.ts
│   └── index.ts
│
└── index.ts                         # Main entry (re-exports)
```

**Key insight**: The `providers/` folder contains ALL provider-specific code. Everything outside `providers/` is provider-agnostic and shared.

---

### Decision 4: Monologue Integration Pattern

**Question**: How does monologue generation connect to renderer events?

**Options Evaluated**:

| Option | Pros | Cons |
|--------|------|------|
| A. @AnthropicMonologue decorator (MONOLOGUE-ARCHITECTURE.md) | Clean, opt-in per method | Decorator complexity, DI setup |
| B. Inline in TaskHarness | Simpler, co-located logic | Couples concerns, harder to test |
| C. MonologueMiddleware | Maximum composability | Extra abstraction |

**Decision**: **Option A - @AnthropicMonologue decorator** (as designed in MONOLOGUE-ARCHITECTURE.md)

**Rationale**:
1. Follows existing @Record decorator pattern in codebase
2. Keeps agents thin (they just declare they want monologue)
3. Opt-in per method, not forced on all agents
4. History management handled by decorator, not harness
5. Testable via DI (mock generator)

**Integration Flow**:
```text
┌─────────────────┐     onMonologue     ┌─────────────────┐    task:narrative   ┌──────────────┐
│ @Anthropic      │ ──────callback────► │   TaskHarness   │ ──────event───────► │ IHarness     │
│ Monologue       │                     │                 │                     │ Renderer     │
│ decorator       │                     │ (converts to    │                     │              │
│                 │                     │  HarnessEvent)  │                     │              │
└─────────────────┘                     └─────────────────┘                     └──────────────┘
```

---

### Decision 5: Event Protocol Alignment

**Question**: Should we use harness-renderer spike's event protocol as-is?

**Decision**: **Yes, adopt with minor modifications**

The spike's `HarnessEvent` protocol is well-designed:
- 13 event types covering full lifecycle
- Discriminated union for type safety
- `NarrativeEntry` structure matches our needs

**Modifications**:
1. Add `MonologueMetadata` to narrative events (eventCount, historyLength, isFinal)
2. Ensure `agentName` enum matches SDK agents ('Parser' | 'Coder' | 'Reviewer' | 'Validator' | 'Harness')
3. Add TypeScript strict mode compliance

---

### Decision 6: Documentation Requirements

**Question**: What documentation is required for v0.1.0?

**Decision**: Three documentation deliverables

| Document | Location | Purpose |
|----------|----------|---------|
| Architecture Guide | `docs/architecture.md` | System design, layer boundaries, extension points |
| Renderer Guide | `docs/renderer-guide.md` | How to use/create renderers |
| API Reference | Generated from TSDoc | Type/function documentation |

**Architecture Guide Contents**:
1. Three-layer architecture diagram
2. Component boundaries
3. Extension points (custom agents, custom renderers)
4. DI container usage
5. Factory function patterns

---

### Decision 7: Export Surface for v0.1.0

**Question**: What should the public API surface look like?

**Decision**: Provider namespaces with convenience re-exports in main entry.

```typescript
// ════════════════════════════════════════════════════════════════════
// @openharness/sdk (main entry)
// ════════════════════════════════════════════════════════════════════
export {
  // Factories (primary API)
  createTaskHarness,
  createTestTaskHarness,

  // Harness (provider-agnostic)
  TaskHarness,
  BaseHarness,

  // Types
  type TaskHarnessConfig,
  type IAgentCallbacks,

  // Re-export default provider (Anthropic) for convenience
  BaseAnthropicAgent,
  CodingAgent,
  ParserAgent,
  ReviewAgent,
  AnthropicRunner,
};

// ════════════════════════════════════════════════════════════════════
// @openharness/sdk/anthropic
// ════════════════════════════════════════════════════════════════════
export {
  // Agents
  BaseAnthropicAgent,
  CodingAgent,
  ParserAgent,
  ReviewAgent,
  ValidationReviewAgent,

  // Runner
  AnthropicRunner,
  ReplayRunner,

  // Monologue
  AnthropicMonologueGenerator,
  AnthropicMonologue,  // decorator
  DEFAULT_MONOLOGUE_PROMPT,
  TERSE_MONOLOGUE_PROMPT,
  VERBOSE_MONOLOGUE_PROMPT,

  // Types
  type MonologueConfig,
  type MonologueMetadata,
};

// ════════════════════════════════════════════════════════════════════
// @openharness/sdk/renderer
// ════════════════════════════════════════════════════════════════════
export {
  // Interface
  type IHarnessRenderer,
  BaseHarnessRenderer,

  // Built-in
  SimpleConsoleRenderer,

  // Protocol
  type HarnessEvent,
  type NarrativeEntry,
  type RendererConfig,
};

// ════════════════════════════════════════════════════════════════════
// @openharness/sdk/renderer/listr2
// ════════════════════════════════════════════════════════════════════
export { Listr2HarnessRenderer };
```

**Import patterns**:
```typescript
// Pattern 1: Provider-specific (explicit, recommended)
import { createTaskHarness } from '@openharness/sdk';
import { CodingAgent } from '@openharness/sdk/anthropic';
import { SimpleConsoleRenderer } from '@openharness/sdk/renderer';

// Pattern 2: Convenience (re-exports default provider)
import { createTaskHarness, CodingAgent } from '@openharness/sdk';

// Pattern 3: Multi-provider (future)
import { CodingAgent as AnthropicCoder } from '@openharness/sdk/anthropic';
import { CodingAgent as OpenAICoder } from '@openharness/sdk/openai';
```

---

## 3. Risk Assessment

| Risk | Mitigation |
|------|------------|
| Breaking existing code | Run full test suite, ensure backward compat |
| listr2 as peer dependency | Optional subpath, tree-shakeable |
| Monologue decorator complexity | Follow existing @Record pattern exactly |
| Missing documentation | Explicit tasks for each doc |
| Orphaned exports | Audit and fix all broken exports |

---

## 4. Implementation Sequence

Based on dependency analysis and provider namespaces structure:

```text
Phase 0: Restructure (move existing code to providers/)
  ├── Create src/providers/anthropic/ structure
  ├── Move src/agents/ → src/providers/anthropic/agents/
  ├── Move src/runner/ → src/providers/anthropic/runner/
  ├── Update all imports
  └── Fix orphaned exports in src/index.ts

Phase 1: Foundation (no dependencies)
  ├── Create src/renderer/ with protocol, interface, base-renderer
  └── Create src/providers/anthropic/monologue/ with types, prompts

Phase 2: Core Implementation
  ├── Implement AnthropicMonologueGenerator in providers/anthropic/monologue/
  ├── Implement @AnthropicMonologue decorator
  ├── Add renderer config to TaskHarness
  └── Implement callback → event translation

Phase 3: Renderers
  ├── Port SimpleConsoleRenderer to src/renderer/
  ├── Port Listr2HarnessRenderer with peer dep
  └── Setup package.json subpath exports

Phase 4: Documentation & Cleanup
  ├── Write docs/architecture.md
  ├── Write docs/renderer-guide.md
  ├── Update README.md
  └── Golden recordings for monologue
```

---

## 5. Decisions Summary

| # | Decision | Choice |
|---|----------|--------|
| 1 | Renderer location | TaskHarness config (not BaseHarness) |
| 2 | Package structure | Single package with provider namespaces (`providers/anthropic/`, `providers/openai/`) |
| 3 | Folder structure | Provider-agnostic core + provider-specific in `providers/` |
| 4 | Monologue pattern | @AnthropicMonologue decorator in `providers/anthropic/monologue/` |
| 5 | Event protocol | Adopt spike's protocol with minor mods |
| 6 | Documentation | Architecture guide + Renderer guide + API ref |
| 7 | Export surface | Subpaths: `./anthropic`, `./renderer`, `./renderer/listr2` |

---

## 6. Next Steps

1. Create `src/renderer/` with ported protocol and interfaces
2. Create `src/monologue/` with generator and prompts
3. Update TaskHarness to accept renderer config
4. Implement monologue → narrative event bridge
5. Write architecture documentation
