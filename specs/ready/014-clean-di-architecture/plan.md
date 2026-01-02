# Implementation Plan: Clean DI Architecture with Agent Builder Pattern

**Branch**: `014-clean-di-architecture` | **Date**: 2025-12-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/ready/014-clean-di-architecture/spec.md`

## Summary

Refactor `@openharness/anthropic` factory-based agents to eliminate DI anti-patterns (service locator, global container, scattered composition) while maintaining clean developer experience. Agent definitions become pure configuration objects, with an injectable `AgentBuilder` service constructing executable agents. Harness becomes the single composition root, using explicit container to build agents.

**Technical Approach**: Pure config + builder pattern (Solution 1 from architecture analysis, scored 95% DI compliance).

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: `@anthropic-ai/claude-agent-sdk`, `@needle-di/core`, `zod`
**Storage**: N/A (agent definitions are plain objects in memory)
**Testing**: `bun:test` for unit/integration tests
**Target Platform**: Node.js 18+ and Bun 1.0+ (runtime agnostic)
**Project Type**: Monorepo with packages (`@openharness/sdk`, `@openharness/anthropic`)
**Performance Goals**: Container creation overhead <5ms (p95, measured on GitHub Actions standard runners, cold start), agent resolution <10ms (p95, warm container)
**Constraints**: Zero breaking changes to harness API, backward compatible with existing tests
**Scale/Scope**: Affects ~8 files in anthropic package, ~3 files in SDK, 3 preset agents, 2 example workflows

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### MUST Principles

- ✅ **Simplicity Scales**: Solution uses plain objects (simplest possible) + standard builder pattern
- ✅ **Explicit Over Implicit**: Container passed explicitly in harness, no hidden globals
- ✅ **Test Without Mocks**: Can test agent definitions without infrastructure (they're just data)
- ✅ **One Reason to Change**: AgentBuilder has single responsibility (construct from config)

### SHOULD Principles

- ✅ **Composition Over Inheritance**: No class hierarchies, using composition (builder + definition)
- ✅ **Data Over Code**: Agent definitions are pure data (serializable, validatable)
- ✅ **Progressive Disclosure**: Users see simple API, complexity hidden in builder
- ✅ **Convention Over Configuration**: Follows NeedleDI constructor injection conventions

**Result**: No violations. All principles followed.

## Verification Methods

*Defines objective measurement criteria for quality attributes and success criteria.*

### DI Compliance Audit (SC-003: 95%+ score)

**Rubric**: `.claude/skills/needle-di/references/rubrics.md`

**Scoring Method**:
- Service Locator Anti-Pattern: -20 points per occurrence (grep for `getGlobalContainer`, `Container.get`)
- Global State: -15 points per module-level container (grep for `let.*Container.*=` at module scope)
- Ambient Context: -10 points per usage (grep for `AsyncLocalStorage` outside infra layer)
- Pure Constructor Injection: +5 points per `@injectable()` class following pattern

**Target**: 95+ points (maximum 1 service locator OR 1 global state allowed)

**Verification Tasks**: T012 (grep), T037-T038 (unit tests), T044-T046 (audit)

### Test Coverage (SC-007, T040)

**Tool**: `bun test --coverage`

**Measurement**: 80%+ line coverage for new code (builder.ts, helpers.ts, factory.ts)

**Verification**: T040 runs coverage and asserts threshold

### Performance Benchmarks (Technical Context)

**Conditions**:
- **Runner**: GitHub Actions standard runner (2-core, 7GB RAM)
- **Measurement**: p95 latency (95th percentile)
- **Container Creation**: <5ms (cold start, no cached dependencies)
- **Agent Resolution**: <10ms (warm container, builder already resolved)

**Method**: Benchmark test with 100 iterations, report p95 using `console.time/timeEnd`

### Error Message Clarity (FR-010, T041)

**Definition**: "Clear Zod validation error" contains:
1. Field name (e.g., `prd`)
2. Expected type (e.g., `string`)
3. Actual value or type mismatch (e.g., `received undefined`)

**Example**:
```
Validation error: Field 'prd' expected string, received undefined
```

**Verification**: T041 tests executeAgent() with invalid input, asserts error message format

### API Surface Encapsulation (FR-016, SC-002)

**Definition**: "No DI concepts visible" means public TypeScript declarations contain zero references to:
- `Container` type
- `injectable` decorator
- Token types (`IAgentRunnerToken`, `IUnifiedEventBusToken`)

**Verification Method**:
1. Run `tsc --declaration` on `packages/anthropic/src/index.ts`
2. Grep output `.d.ts` files for `Container|injectable|Token`
3. Assert zero matches

**Task**: Add to Phase 7 as new verification task

### Architecture Clarity (SYN007)

**"Clear separation" verification**:
- Agent definition types (`AnthropicAgentDefinition`) contain zero methods (only data properties)
- Execution logic exists ONLY in `AgentBuilder` and `ExecutableAgent` classes
- Agent definitions are JSON-serializable (no functions, no closures)

**"Simplest possible" verification**:
- Agent definitions require zero runtime dependencies beyond Zod schemas
- Plain objects can be created without imports beyond type definitions

**Verification**: T037 (serialization test), code review during implementation

### Type Safety Enforcement (FR-001, SYN004)

**Enforcement Mechanism**:
TypeScript's structural typing system enforces type safety between prompt template variables and input schemas at **compile-time** via mapped types. When `defineAnthropicAgent()` is called, TypeScript infers template variable types from the input schema definition. Mismatched variable names or types between the template string and schema produce TypeScript compiler errors before runtime.

**Example**:
```typescript
// Template expects { prd: string }
const agent = defineAnthropicAgent({
  name: "planner",
  prompt: "Plan: {{prd}}",
  inputSchema: z.object({ task: z.string() })  // ❌ Type error: 'prd' missing
});
```

**Verification Method**:
- Create negative test file with intentional template/schema mismatch
- Verify `tsc --noEmit` fails with type error identifying the mismatch
- Use in CI to catch violations before deployment

**Verification Task**: T052 negative test cases in `packages/anthropic/tests/unit/type-safety.test.ts`

### Global State Isolation (FR-020, T040)

**"No global state leaks between tests" verification**:
1. Run test suite with `--random-seed` to randomize execution order
2. Each test creates isolated container via `new Container()`
3. Grep shows zero module-level containers (`let _container` at file scope)
4. Tests pass regardless of execution order

**Verification**: T040 explicitly tests isolation, T012 grep verification

### Real-Time Event Delivery (User Story 1)

**"Real-time agent progress events" definition**:
- **Delivery Model**: Asynchronous, non-blocking event emission to attached channels
- **Latency Target**: <100ms p95 from event occurrence to channel delivery (measured in integration tests)
- **Guarantee**: Events delivered in order, no events dropped during normal execution
- **Failure Mode**: Event delivery errors logged but don't block agent execution

**Note**: "Real-time" refers to asynchronous streaming without blocking the agent execution thread, not hard real-time guarantees.

### Error Event Context (User Story 2)

**"Error event with context" structure**:

```typescript
interface ErrorEventContext {
  phase: string;           // Phase name where error occurred
  agent: string;           // Agent name/identifier
  errorType: string;       // Error classification (ValidationError, ExecutionError, etc.)
  message: string;         // Human-readable error message
  stack?: string;          // Stack trace (optional, for debugging)
  timestamp: string;       // ISO-8601 timestamp
}
```

**Verification**: Match existing event patterns from 008-unified-event-system

### Documentation Clarity (SC-010)

**"Documentation clearly explains framework/user boundary" checklist**:

1. **API Boundary Diagram**: Visual diagram showing public API (user-facing) vs internal implementation (framework)
2. **Exported Types Documentation**: All exported types documented with usage examples
   - `AnthropicAgentDefinition` - what users create
   - `executeAgent()` / `streamAgent()` - what users call
   - Internal types (`AgentBuilder`, tokens) - what users don't see
3. **Before/After Code Samples**: Examples showing what users write vs what happens internally
   - User code: `executeAgent(PlannerAgent, input)`
   - Internal: Container → AgentBuilder → InternalAnthropicAgent → execution
4. **Decision Guide**: When to use `executeAgent()` vs harness
   - Single agent, quick experimentation → `executeAgent()`
   - Multi-agent workflow, state management → Harness
5. **Migration Examples**: For users moving from old factory pattern

**Verification**: T044 documentation task includes checklist review

### Clean Developer Experience (Plan Summary, SC-002)

**Measurable "clean DX" attributes**:

1. **API Encapsulation** (verified by T051):
   - No DI concepts in public API (`Container`, `injectable`, `Token` types hidden)
   - TypeScript declarations contain zero DI type references

2. **Import Simplicity**:
   - Basic usage requires <3 imports
   - Example: `import { PlannerAgent, executeAgent } from '@openharness/anthropic'`

3. **IntelliSense Surface**:
   - Main API objects expose <10 methods to users
   - IDE autocomplete shows only relevant user-facing methods

4. **Operation Complexity**:
   - Common tasks achievable in <2 function calls
   - Example: `await executeAgent(agent, input)` = 1 call

5. **Type Safety Without Ceremony**:
   - Users get full TypeScript safety without writing DI decorators or tokens

**Verification**: Checklist included in T044 documentation review

### Pattern Index (Architecture Documentation)

**Near-Duplicate Requirements Explained**:

The specification contains intentional near-duplicates representing the **same DI patterns applied to different execution contexts**:

| Pattern | Standalone Context | Harness Context | Principle |
|---------|-------------------|-----------------|-----------|
| **Container Creation** | FR-007: executeAgent creates temporary container | FR-008: Harness creates own container | Composition Root - container created at entry point |
| **Agent Building** | FR-002/FR-003: executeAgent/streamAgent call builder | FR-004: Harness uses builder to resolve agents | Builder Pattern - config → executable via injectable service |
| **DI Testing** | FR-015: Pass custom container to executeAgent | FR-004: Harness has injectable AgentBuilder | Dependency Injection - infrastructure mockable via constructor injection |

**Note**: These are NOT duplicates but parallel applications of DI principles. Each execution mode (standalone vs harness) requires its own composition root while following the same architectural patterns.

**Documentation**: T044 should add this pattern index to `.knowledge/docs/how-it-works.md`

## Project Structure

### Documentation (this feature)

```text
specs/ready/014-clean-di-architecture/
├── spec.md              # This feature's specification
├── plan.md              # This file (implementation plan)
├── data-model.md        # Entity definitions and types
├── contracts/           # API contracts
│   ├── agent-definition.ts  # AnthropicAgentDefinition interface
│   ├── builder.ts           # AgentBuilder interface
│   └── helpers.ts           # executeAgent/streamAgent signatures
└── tasks.md             # Dependency-ordered implementation tasks (oharnes.tasks output)
```

### Source Code (packages/anthropic)

```text
packages/anthropic/src/
├── provider/
│   ├── types.ts                    # AnthropicAgentDefinition, ExecuteOptions, etc.
│   ├── prompt-template.ts          # PromptTemplate (unchanged)
│   ├── internal-agent.ts           # InternalAnthropicAgent (unchanged)
│   ├── factory.ts                  # NEW: Returns plain config objects
│   ├── builder.ts                  # NEW: Injectable AgentBuilder service
│   ├── helpers.ts                  # NEW: executeAgent/streamAgent functions
│   └── index.ts                    # Exports
├── presets/
│   ├── planner-agent.ts            # MODIFIED: Returns config object
│   ├── coding-agent.ts             # MODIFIED: Returns config object
│   ├── review-agent.ts             # MODIFIED: Returns config object
│   └── index.ts                    # Exports
└── index.ts                        # Package barrel export
```

### Source Code (packages/sdk)

```text
packages/sdk/src/
├── factory/
│   └── define-harness.ts           # MODIFIED: Uses AgentBuilder to resolve agents
├── infra/
│   └── container.ts                # MODIFIED: Remove global container logic
└── index.ts                        # Exports
```

### Examples (validation)

```text
examples/coding/
├── src/
│   ├── validate-harness.ts         # UNCHANGED: Should work with new architecture
│   ├── harness.ts                  # UNCHANGED: Should work with new architecture
│   ├── validation-coding-agent.ts  # MODIFIED: Returns config object
│   └── validation-agent.ts         # MODIFIED: Returns config object
└── index.ts
```

**Structure Decision**: Monorepo structure with separate packages for SDK (framework) and Anthropic (provider). Agent definitions live in provider package, builder pattern applies to all agents (preset and custom). No new directories needed—refactoring existing files.

## Complexity Tracking

> No constitution violations requiring justification.

## Context Scope

### Include in Agent Context

- `packages/anthropic/src/` - anthropic provider implementation
- `packages/sdk/src/factory/` - harness factory logic
- `packages/sdk/src/infra/` - container and DI infrastructure
- `specs/ready/014-clean-di-architecture/` - this feature's spec and plan
- `examples/coding/` - validation workflows to ensure compatibility
- `.claude/skills/needle-di/` - DI best practices reference

### Exclude from Agent Context

- `specs/013-anthropic-refactor/` - previous refactor (different scope, may cause confusion)
- `specs/backlog/` - unrelated features
- `.knowledge/private/` - investor materials (not relevant)
- `node_modules/`, `dist/`, `build/` - generated/external files

**Rationale**: Focus on DI refactoring within existing factory architecture. Exclude previous refactor spec to avoid confusion between factory API creation (013) and DI cleanup (014).

## Verification Gates

### Pre-Commit Gates

- [ ] All tests pass: `bun test`
- [ ] Type checking passes: `bun run typecheck`
- [ ] Linting passes: `bun run lint`
- [ ] No `console.log` in production code
- [ ] No `getGlobalContainer()` calls remain (grep verification)
- [ ] No module-level container singletons (grep for `let.*Container.*=`)

### Task Completion Gates

- [ ] Task file paths match actual created/modified files
- [ ] Task marked `[X]` in tasks.md
- [ ] New code follows NeedleDI patterns (constructor injection, no service locator)
- [ ] Agent definitions are serializable (`JSON.stringify` works)

### Feature Completion Gates

- [ ] All tasks marked `[X]` in tasks.md
- [ ] Validation workflow runs end-to-end (`bun examples/coding/src/validate.ts`)
- [ ] Coding workflow runs end-to-end (`bun examples/coding/src/index.ts`)
- [ ] All harness control-flow tests pass (17/17 in control-flow.test.ts)
- [ ] Preset integration tests pass (17/17 in presets.test.ts)
- [ ] DI compliance audit shows 95%+ score (run NeedleDI rubric)
- [ ] Documentation updated (architecture docs, migration guide if needed)

### Critical File Paths

```text
packages/anthropic/src/provider/factory.ts           # defineAnthropicAgent returns config
packages/anthropic/src/provider/builder.ts           # Injectable AgentBuilder service
packages/anthropic/src/provider/helpers.ts           # executeAgent/streamAgent functions
packages/anthropic/src/presets/planner-agent.ts      # Returns config object
packages/anthropic/src/presets/coding-agent.ts       # Returns config object
packages/anthropic/src/presets/review-agent.ts       # Returns config object
packages/sdk/src/factory/define-harness.ts           # Uses AgentBuilder pattern
examples/coding/src/validate-harness.ts              # Works with new architecture
examples/coding/src/harness.ts                       # Works with new architecture
```

### Test Coverage Expectations

- **Minimum line coverage**: 80% for new code (builder.ts, helpers.ts)
- **Required test types**:
  - Unit tests for `AgentBuilder.build()` with mock dependencies
  - Unit tests for `executeAgent()` with custom container
  - Integration tests for preset agents with new pattern
  - End-to-end tests for both validation and coding workflows
- **DI Compliance Tests**:
  - Test that agent definitions are serializable
  - Test that no global state exists between test runs
  - Test that harness creates isolated containers
  - Test that custom containers work in `executeAgent()`

## Implementation Phases

### Phase 0: Research & Validation (Prerequisites)

**Purpose**: Validate NeedleDI patterns and ensure understanding of builder pattern implementation.

**Tasks**:
1. Review NeedleDI anti-patterns document (already complete per audit)
2. Review existing `InternalAnthropicAgent` to understand what builder must construct
3. Validate that agent definitions can be serialized (test with JSON.stringify)
4. Prototype AgentBuilder interface to confirm dependency injection works

**Outputs**:
- research.md documenting builder pattern decisions
- Prototype validation confirming approach

**Gate**: All research questions resolved, no NEEDS CLARIFICATION markers remain

---

### Phase 1: Core Infrastructure (Agent Builder)

**Purpose**: Create injectable `AgentBuilder` service and refactor `defineAnthropicAgent()` to return plain config.

**Tasks**:
1. Create `packages/anthropic/src/provider/builder.ts` with `@injectable() AgentBuilder` class
   - Constructor injects `IAgentRunnerToken` and `IUnifiedEventBusToken`
   - `build<TIn, TOut>(definition: AnthropicAgentDefinition<TIn, TOut>)` method returns `ExecutableAgent`
2. Refactor `packages/anthropic/src/provider/factory.ts`:
   - `defineAnthropicAgent()` returns plain `AnthropicAgentDefinition` object (no methods)
   - Remove `getGlobalContainer()` function
   - Remove `_globalContainer` module-level variable
3. Create `packages/anthropic/src/provider/helpers.ts`:
   - `executeAgent<TIn, TOut>(definition, input, options?)` function
   - `streamAgent<TIn, TOut>(definition, input, options?)` function
   - Both create temporary container if none provided in options
4. Update `packages/anthropic/src/provider/types.ts`:
   - Add `ExecutableAgent<TIn, TOut>` interface with execute/stream methods
   - Ensure `AnthropicAgentDefinition` is plain serializable object
5. Update `packages/anthropic/src/provider/index.ts` to export new helpers

**Outputs**:
- `builder.ts` with injectable service
- `factory.ts` returning config objects
- `helpers.ts` with standalone execution functions
- Updated types

**Gate**: All exports compile, no global containers remain (verified with grep)

---

### Phase 2: Harness Integration

**Purpose**: Update `defineHarness()` to use `AgentBuilder` instead of direct container.get().

**Tasks**:
1. Modify `packages/sdk/src/factory/define-harness.ts`:
   - Bind `AgentBuilder` to container after creating it
   - Change agent resolution logic to use builder pattern
   - Detect agent definition type (check for `name` + `prompt` fields)
   - Build agents using `builder.build(agentDefinition)`
2. Register `AgentBuilder` in anthropic provider bindings:
   - Update `registerAnthropicProvider()` to bind `AgentBuilder`
3. Ensure harness creates isolated container per instance (no shared state)

**Outputs**:
- Updated `define-harness.ts` using builder pattern
- Updated `registerAnthropicProvider()` with builder binding

**Gate**: Harness control-flow tests pass (17/17)

---

### Phase 3: Preset Agents Migration

**Purpose**: Refactor all preset agents to return plain configuration objects.

**Tasks**:
1. Refactor `packages/anthropic/src/presets/planner-agent.ts`:
   - Change `defineAnthropicAgent()` call to return config object
   - Verify exports are plain objects
2. Refactor `packages/anthropic/src/presets/coding-agent.ts`:
   - Same pattern as planner
3. Refactor `packages/anthropic/src/presets/review-agent.ts`:
   - Same pattern as planner
4. Update preset integration tests:
   - Use `executeAgent()` helper for standalone tests
   - Verify agents still work in harness context

**Outputs**:
- All three preset agents returning config objects
- Integration tests passing with new pattern

**Gate**: Preset integration tests pass (17/17 in presets.test.ts)

---

### Phase 4: Example Workflows Migration

**Purpose**: Update example workflows to use new pattern and validate end-to-end functionality.

**Tasks**:
1. Update `examples/coding/src/validation-coding-agent.ts`:
   - Return config object from `defineAnthropicAgent()`
2. Update `examples/coding/src/validation-agent.ts`:
   - Return config object from `defineAnthropicAgent()`
3. Verify `examples/coding/src/validate-harness.ts` works without changes
4. Verify `examples/coding/src/harness.ts` works without changes
5. Run both workflows end-to-end:
   - `bun examples/coding/src/validate.ts`
   - `bun examples/coding/src/index.ts`

**Outputs**:
- Updated custom agents in examples
- Both workflows running successfully
- End-to-end validation complete

**Gate**: Both workflows complete successfully, all events emitted correctly

---

### Phase 5: Testing & Documentation

**Purpose**: Ensure comprehensive test coverage and update documentation.

**Tasks**:
1. Add unit tests for `AgentBuilder`:
   - Test with mock `IAgentRunner` and `IUnifiedEventBus`
   - Verify builder constructs executable agents correctly
   - Test that built agents have execute/stream methods
2. Add unit tests for `executeAgent()` and `streamAgent()`:
   - Test with custom container option
   - Test with default temporary container
   - Verify channel attachment works
3. Add DI compliance tests:
   - Test agent definition serialization
   - Test no global state between tests
   - Test container isolation
4. Update architecture documentation:
   - Document builder pattern in `.knowledge/docs/how-it-works.md`
   - Add migration guide if needed (likely not, since no user-facing API breaks)
5. Run full DI audit using NeedleDI rubric

**Outputs**:
- Comprehensive test suite (80%+ coverage)
- Updated architecture documentation
- DI audit showing 95%+ compliance

**Gate**: All tests pass, documentation complete, DI audit score ≥ 95%

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 0 (Research)**: No dependencies - can start immediately
- **Phase 1 (Core Infrastructure)**: Depends on Phase 0 - BLOCKS all other phases
- **Phase 2 (Harness)**: Depends on Phase 1 (needs builder)
- **Phase 3 (Presets)**: Depends on Phase 1 (needs helpers), can run parallel with Phase 2
- **Phase 4 (Examples)**: Depends on Phases 2 + 3 (needs both harness and presets working)
- **Phase 5 (Testing/Docs)**: Depends on all previous phases

### Critical Path

1. Phase 0 → Phase 1 → Phase 2 → Phase 4 → Phase 5
2. Phase 3 can overlap with Phase 2 (different files)

### Parallel Opportunities

- Phase 2 and Phase 3 can run in parallel after Phase 1 completes
- All three preset agent refactors (Phase 3) can run in parallel
- Test writing (Phase 5) can start before documentation updates

---

## Risk Mitigation

### Risk 1: Breaking Existing Harness Tests

**Likelihood**: Medium
**Impact**: High
**Mitigation**:
- Run harness tests after every change to Phase 2
- Keep backward compatibility as hard requirement
- If tests break, adjust builder resolution logic, not test code

### Risk 2: Performance Regression from Container Creation

**Likelihood**: Low
**Impact**: Medium
**Mitigation**:
- Measure container creation time in benchmarks
- Reuse containers where possible (harness instance level)
- Gate on <5ms container creation overhead

### Risk 3: Confusion Between Agent Definition and Executable Agent

**Likelihood**: Medium
**Impact**: Low
**Mitigation**:
- Clear type names: `AnthropicAgentDefinition` vs `ExecutableAgent`
- Documentation explicitly shows difference
- TypeScript types prevent misuse at compile time

---

## Success Metrics

1. **DI Compliance**: NeedleDI audit score ≥ 95%
2. **Test Pass Rate**: 100% (all existing + new tests)
3. **Workflow Success**: Both example workflows run end-to-end
4. **Developer Experience**: Standalone execution remains 1 line of code
5. **Architecture Clarity**: Zero DI concepts leak into user-facing API

---

## Post-Implementation Validation

After all phases complete:

1. Run DI audit checklist from `.claude/skills/needle-di/references/rubrics.md`
2. Verify all anti-patterns eliminated (service locator, global state, scattered composition)
3. Run both example workflows and capture success/failure
4. Measure container creation overhead in benchmarks
5. Review code against constitution principles
6. Update CLAUDE.md with new patterns if needed
