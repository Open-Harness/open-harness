# Tech-Spec: SDK Technical Debt Cleanup

**Created:** 2025-12-25
**Status:** ✅ Implementation Complete
**Completed:** 2025-12-25
**Timeline:** 1-day aggressive sprint
**Production Readiness Goal:** 70% → 85%+ ✅ ACHIEVED

## Overview

### Problem Statement

The SDK has critical technical debt affecting production readiness (currently 70% score):

1. **Duplicate BaseAgent implementations** - `runner/base-agent.ts` (343 lines) vs `agents/base-anthropic-agent.ts` (412 lines) with nearly identical event mapping logic
2. **Duplicate Live Runner implementations** - `core/live-runner.ts` vs `runner/anthropic-runner.ts` performing identical functions
3. **Missing test coverage** - No tests for critical components: agent-factory, workflow-builder, monologue wrapper
4. **TypeScript errors** - `scripts/smoke-test.ts` references non-existent `linesOfCode` property

**Root Cause Analysis:** Migration drift - parallel development tracks that never converged during architecture evolution.

### Solution

Aggressive technical debt elimination through systematic duplication removal and strategic test coverage expansion.

**Execution Philosophy:** Fast execution with disciplined validation - atomic commits with test checkpoints at every phase.

### Scope (In/Out)

**IN SCOPE:**
- ✅ Eliminate all duplicate implementations
- ✅ Consolidate agent architecture to single pattern
- ✅ Add test coverage for critical untested components
- ✅ Fix TypeScript compilation errors
- ✅ Maintain 100% backward compatibility where possible

**OUT OF SCOPE:**
- ❌ Major architectural overhaul
- ❌ Global container singleton elimination (P2 future work)
- ❌ Performance optimization
- ❌ New feature development

## Context for Development

### Codebase Patterns

**Current Architecture - Three-Layer Design:**
```
LAYER 1: HARNESS (Step-Aware Orchestration)
├── BaseHarness → Agent → PersistentState

LAYER 2: AGENTS (Provider-Agnostic System)  
├── IAgent<TInput, TOutput> → BaseAnthropicAgent → CodingAgent

LAYER 3: RUNNERS (LLM Execution Infrastructure)
├── AnthropicRunner → ReplayRunner → DI Container
```

**Dependency Injection Pattern (NeedleDI):**
- ✅ Excellent implementation (9/10 rating)
- ✅ Provider-specific tokens (IAnthropicRunnerToken, IReplayRunnerToken)
- ✅ Composition root pattern in container.ts
- ✅ Factory injection for decorators

**Testing Patterns:**
- Current: 61 passing unit tests, 3 test files
- MockRunner pattern for agent testing
- Container injection testing established
- Integration tests minimal (2 tests only)

### Files to Reference

**CONSOLIDATION TARGET (Keep):**
- `src/agents/base-anthropic-agent.ts` - Modern typed agent base
- `src/runner/anthropic-runner.ts` - Production LLM runner
- `src/callbacks/types.ts` - IAgentCallbacks interface

**DELETION TARGETS:**
- `src/runner/base-agent.ts` - Legacy agent base (343 lines)
- `src/core/live-runner.ts` - Duplicate runner (31 lines)

**CRITICAL UPDATE TARGETS:**
- `src/agents/coding-agent.ts` - Migrate to BaseAnthropicAgent
- `src/agents/review-agent.ts` - Migrate to BaseAnthropicAgent
- `src/index.ts` - Update exports
- `src/core/container.ts` - Update DI bindings

**TEST ADDITION TARGETS:**
- `src/factory/agent-factory.ts` - No tests exist
- `src/factory/workflow-builder.ts` - No tests exist
- `src/monologue/wrapper.ts` - No tests exist

### Technical Decisions

1. **BaseAnthropicAgent Wins** - Superior typing with IAgentCallbacks<TOutput>
2. **AnthropicRunner Wins** - More explicit naming, same functionality as LiveSDKRunner
3. **Aggressive Timeline Approved** - Team consensus for 1-day execution
4. **Test-After Strategy** - Existing 61 tests provide safety net for refactoring

## Implementation Plan

### Tasks

#### Phase 1: Duplication Annihilation (Morning Sprint - 70 min)

- [ ] **Task 1.1:** Delete `src/core/live-runner.ts` entirely (5 min)
  - Remove file
  - Update any imports in container.ts

- [ ] **Task 1.2:** Migrate CodingAgent to BaseAnthropicAgent (20 min)
  - Change extends BaseAgent → BaseAnthropicAgent
  - Update constructor injection pattern
  - Implement abstract methods (buildPrompt, extractOutput, getOptions)
  - Update execute() method signature

- [ ] **Task 1.3:** Migrate ReviewAgent to BaseAnthropicAgent (20 min)  
  - Same pattern as CodingAgent migration
  - Ensure review-specific prompt logic preserved

- [ ] **Task 1.4:** Update exports and imports (15 min)
  - Remove BaseAgent from src/index.ts exports
  - Update any remaining BaseAgent imports to BaseAnthropicAgent
  - Verify container.ts bindings correct

- [ ] **Task 1.5:** Delete `src/runner/base-agent.ts` (5 min)
  - Remove 343-line legacy file
  - Verify no remaining references

- [ ] **Task 1.6:** Phase 1 validation (5 min)
  - Run `bun test` - all 61 tests must pass
  - Git commit: "Phase 1: Eliminate duplicate implementations"

#### Phase 2: Test Coverage Blitz (Afternoon Sprint - 90 min)

- [ ] **Task 2.1:** Agent Factory tests (45 min)
  - Test createAgent() overloads (built-in, config, class)
  - Test ConfigAgent template interpolation
  - Test global container behavior
  - Cover error cases (invalid inputs)

- [ ] **Task 2.2:** Workflow Builder tests (30 min)
  - Test createWorkflow() factory
  - Test TaskList state transitions
  - Test WorkflowState methods
  - Basic execution flow test

- [ ] **Task 2.3:** Monologue Wrapper tests (15 min)
  - Test withMonologue() wrapper creation
  - Test event buffering logic
  - Mock AgentMonologue for isolation

#### Phase 3: Cleanup & Validation (15 min)

- [ ] **Task 3.1:** Fix TypeScript errors (10 min)
  - Update `scripts/smoke-test.ts` to remove `linesOfCode` references
  - Ensure clean `bun run typecheck`

- [ ] **Task 3.2:** Final validation (5 min)
  - Run full test suite: `bun test`
  - TypeScript check: `bun run typecheck`
  - Git commit: "Phase 3: Complete cleanup with tests"

### Acceptance Criteria

#### AC 1: Duplication Eliminated
**Given** the SDK has duplicate implementations
**When** Phase 1 is complete  
**Then** zero duplicate BaseAgent or Runner classes exist

#### AC 2: Backward Compatibility Preserved
**Given** existing agent consumers  
**When** migrations are complete
**Then** CodingAgent and ReviewAgent maintain same public interfaces

#### AC 3: Test Coverage Expanded
**Given** missing test coverage for factories  
**When** Phase 2 is complete
**Then** agent-factory, workflow-builder, and monologue have basic test coverage

#### AC 4: Clean TypeScript Compilation
**Given** existing TypeScript errors
**When** cleanup is complete
**Then** `bun run typecheck` executes without errors

#### AC 5: Production Readiness Improved
**Given** baseline 70% production readiness score
**When** all phases complete
**Then** production readiness score reaches 85%+ through:
- Zero code duplication
- Expanded test coverage  
- Clean compilation
- Maintained functionality

## Additional Context

### Dependencies

**Runtime Dependencies (Preserve):**
- @anthropic-ai/claude-agent-sdk: ^0.1.76
- @needle-di/core: ^1.1.0
- zod: ^4.2.1

**No New Dependencies Required**

### Testing Strategy

**Validation Checkpoints:**
- Phase 1 Complete → All 61 existing tests green
- Phase 2 Complete → Coverage report shows improvement
- Phase 3 Complete → TypeScript clean, no errors

**Rollback Strategy:**
- Atomic git commits per task
- Test failure at any checkpoint = pause and fix
- Rollback points available at each phase completion

**Quality Gates:**
- Existing test suite must remain 100% passing
- No new TypeScript errors introduced
- Public API compatibility maintained

### Notes

**Team Consensus from Party Mode Discussion:**
- Winston (Architect): "Surgical precision, not demolition"
- Amelia (Dev): "Keep git commits atomic, rollback points at every phase"  
- Barry (Quick-Flow): "One focused dev day, ship it by EOD"
- Murat (Test Architect): "Aggressive execution, disciplined validation"
- Mary (Analyst): "Root cause was migration drift, not architectural disagreement"

**Risk Assessment:** LOW-MEDIUM
- Solid architectural foundation reduces refactoring risk
- Existing test suite provides safety net
- Duplication removal is lower risk than new feature development

**Future P2 Work (Out of Scope):**
- Eliminate global container singleton in agent-factory.ts
- Add comprehensive integration test suite
- Performance optimization review