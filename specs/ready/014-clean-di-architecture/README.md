# 014: Clean DI Architecture with Agent Builder Pattern

**Status**: Ready for Implementation
**Branch**: `014-clean-di-architecture`
**Created**: 2025-12-29
**DI Compliance Score**: Target 95%

## Overview

Refactor `@openharness/anthropic` to eliminate DI anti-patterns while maintaining clean developer experience. Agents become pure configuration, with injectable builder service constructing executables.

## The Problem

Current factory-based agents violate NeedleDI best practices:
- ❌ Service Locator: `getGlobalContainer()` pulls dependencies
- ❌ Global State: Module-level container singleton
- ❌ Scattered Composition: Factory + Harness both create containers
- ❌ Ambient Context: Hidden container creation in factory
- ❌ Mixed Responsibilities: Factory does both config + execution

**Result**: Can't test with mocks, shared global state, unclear dependency graph

## The Solution

**Pure Configuration + Builder Pattern (95% DI Compliance)**

```typescript
// BEFORE (Factory API - 82% compliance):
const PlannerAgent = defineAnthropicAgent({ ... });
await PlannerAgent.execute({ prd: "..." }); // Hidden global container

// AFTER (Builder Pattern - 95% compliance):
const PlannerAgent = defineAnthropicAgent({ ... }); // Returns plain config
await executeAgent(PlannerAgent, { prd: "..." }); // Helper creates container

// OR in harness (same config, explicit container):
const Harness = defineHarness({
  agents: { planner: PlannerAgent }, // Config passed to harness
  run: async ({ agents }) => {
    await agents.planner.execute({ ... }); // Built by harness container
  },
});
```

## Key Changes

| Component | Before | After |
|-----------|--------|-------|
| **defineAnthropicAgent()** | Returns object with `.execute()` | Returns plain config object |
| **Standalone execution** | `agent.execute()` | `executeAgent(agent, input)` |
| **Harness execution** | Passes agent objects | Passes agent configs, builds internally |
| **Container creation** | Global singleton | Explicit per-harness, temporary for standalone |
| **Testing** | Hard (global container) | Easy (inject mock container) |

## Documentation

- **[spec.md](./spec.md)** - User scenarios, requirements, success criteria
- **[plan.md](./plan.md)** - Technical context, phases, verification gates
- **[data-model.md](./data-model.md)** - Entity definitions, type relationships
- **[contracts/](./contracts/)** - API contracts (TypeScript interfaces)

## Implementation Phases

1. **Phase 0**: Research & Validation
2. **Phase 1**: Core Infrastructure (Builder + Helpers)
3. **Phase 2**: Harness Integration
4. **Phase 3**: Preset Agents Migration
5. **Phase 4**: Example Workflows Validation
6. **Phase 5**: Testing & Documentation

## Success Criteria

- ✅ DI audit score ≥ 95%
- ✅ No global containers (verified with grep)
- ✅ All tests pass (harness + presets)
- ✅ Both example workflows run end-to-end
- ✅ Zero DI concepts in user-facing API
- ✅ Agent definitions are serializable

## Quick Start (After Implementation)

```typescript
// 1. Standalone execution
import { PlannerAgent, executeAgent } from "@openharness/anthropic/presets";

const result = await executeAgent(PlannerAgent, {
  prd: "Build a TODO app with add, complete, delete"
});

// 2. With channel (progress updates)
import { ConsoleChannel } from "@openharness/sdk";

const channel = new ConsoleChannel();
const result = await executeAgent(
  PlannerAgent,
  { prd: "..." },
  { channel }
);

// 3. In harness (multi-agent workflow)
import { defineHarness } from "@openharness/sdk";
import { PlannerAgent, CodingAgent } from "@openharness/anthropic/presets";

const Workflow = defineHarness({
  agents: {
    planner: PlannerAgent, // Just pass config
    coder: CodingAgent,
  },
  run: async ({ agents, state }) => {
    const plan = await agents.planner.execute({ prd: state.task });
    const code = await agents.coder.execute({ plan });
    return { plan, code };
  },
});

const result = await Workflow.create({ task: "..." }).run();

// 4. Testing with mocks
import { createContainer } from "@openharness/sdk";

const testContainer = createContainer();
testContainer.bind({ provide: IAgentRunnerToken, useValue: mockRunner });

const result = await executeAgent(
  PlannerAgent,
  { prd: "..." },
  { container: testContainer } // Use mocks
);
```

## Architecture

```
User Code (sees only config)
    ↓ uses
AnthropicAgentDefinition (plain object)
    ↓ passed to
executeAgent() or defineHarness()
    ↓ creates
Container (with infrastructure)
    ↓ resolves
AgentBuilder (injectable service)
    ↓ builds
ExecutableAgent (with execute/stream)
    ↓ depends on
IAgentRunner, IUnifiedEventBus
```

## Verification

### Pre-Commit Gates
```bash
bun test                    # All tests pass
bun run typecheck           # No type errors
bun run lint               # No lint errors
grep -r "getGlobalContainer" packages/anthropic/src/  # Should find nothing
```

### End-to-End Validation
```bash
cd examples/coding
bun src/validate.ts        # Validation workflow
bun src/index.ts           # Coding workflow
```

### DI Compliance Audit
```bash
# Run manual checklist from .claude/skills/needle-di/references/rubrics.md
# Target score: ≥ 95%
```

## Migration Impact

**User-Facing Changes**: Minimal
- Standalone: Add `executeAgent()` wrapper (1 function call)
- Harness: Zero changes (agents still passed to `agents` config)
- Testing: Improved (can inject mocks via `options.container`)

**Breaking Changes**: None
- Existing harness API unchanged
- Preset agents still importable
- Tests pass without modification

## Related Work

- **013-anthropic-refactor**: Created factory API (foundation for this work)
- **003-harness-renderer retrospective**: Identified RC001-RC005 (context loading, verification gates)
- **NeedleDI skill**: Best practices reference (`.claude/skills/needle-di/`)

## Next Steps

1. Run `/oharnes.tasks` to generate dependency-ordered tasks from this plan
2. Implement Phase 1 (Core Infrastructure)
3. Validate with harness tests after each phase
4. Run end-to-end workflows after Phase 4
5. Final DI audit in Phase 5
