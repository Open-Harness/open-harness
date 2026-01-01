# Feature Specification: Anthropic Package Architecture Refactor

**Feature Branch**: `013-anthropic-refactor`
**Created**: 2025-12-28
**Status**: Draft
**Input**: Technical debt analysis + canonical documentation review
**Supersedes**: specs/012-define-anthropic-agent
**Depends On**: None

---

## Overview

The current `@openharness/anthropic` package suffers from architectural debt: flat folder structure, class-based boilerplate, framework/application boundary violations, and documentation drift from the canonical vision. This specification proposes a comprehensive refactoring to establish a three-layer architecture (infrastructure/provider/presets) with functional agent factories and TypeScript-based prompt templates.

**Current State**: Flat `src/` folder mixing concerns, 330-line `BaseAnthropicAgent` class hierarchy, Bun-specific file I/O for prompts, concrete agents exported from main package index.

**Proposed State**: Clean layer separation (`infra/` → `provider/` → `presets/`), functional `defineAnthropicAgent()` factory, type-safe TypeScript prompt templates, explicit preset imports from `@openharness/anthropic/presets`.

**Value Proposition**: Type safety, maintainability, clear separation of concerns, runtime portability (Node.js + Bun), alignment with "Simplicity scales" philosophy.

---

## Problem Statement

The current implementation contradicts the project's vision of readable, simple, composable code:

1. **Flat Folder Structure Mixing Concerns** - No clear separation of framework vs application code
2. **Class Hierarchy Boilerplate** - 330-line base class with DI decorators leaking into agent code
3. **PromptRegistry in Wrong Layer** - Runtime file I/O with Bun-specific APIs
4. **Framework/Application Boundary Violation** - Example implementations exported as framework primitives
5. **Documentation Drift** - Vision promises "One file. Forty lines. Actually readable." but examples are 267+ lines
6. **Dual Event Bus System** - Maintains two event systems for backward compatibility

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Custom Agent Creation (Priority: P1)

**As a** developer building a custom agent
**I want to** define an agent with minimal boilerplate
**So that** I can focus on prompt logic, not infrastructure

**Why P1**: Core framework capability. If creating custom agents requires deep DI knowledge, the framework fails its purpose.

**Independent Test**:
1. Create new TypeScript file
2. Define prompt template with typed data
3. Call `defineAnthropicAgent()` with schema
4. Execute agent and receive typed output

**Acceptance Scenarios**:

1. **Given** developer has `@openharness/anthropic` installed, **When** they define an agent with name, prompt template, and schemas, **Then** agent executes with type-safe input/output in less than 20 lines total
2. **Given** developer creates a custom agent, **When** they call `.execute()`, **Then** TypeScript infers output types correctly without explicit casting

---

### User Story 2 - Quick Start with Presets (Priority: P1)

**As a** developer evaluating Open Harness
**I want to** use a pre-built coding agent immediately
**So that** I can prototype workflows without writing custom agents

**Why P1**: Critical for adoption. Developers need instant success before investing in customization.

**Independent Test**:
1. Install package
2. Import preset agent
3. Call `.execute()`
4. Observe output

**Acceptance Scenarios**:

1. **Given** developer imports `CodingAgent` from `@openharness/anthropic/presets`, **When** they call `.execute()` with a task, **Then** agent executes with default prompt returning typed output
2. **Given** developer uses a preset agent, **When** they check setup code before `.execute()`, **Then** setup code count is zero lines (just import + execute)

---

### User Story 3 - Override Preset Prompts (Priority: P2)

**As a** developer using preset agents
**I want to** customize the prompt while keeping type safety
**So that** I can adapt agents to my domain without forking

**Why P2**: Important for flexibility. Presets should be starting points, not locked boxes.

**Independent Test**:
1. Import preset agent
2. Define custom prompt template
3. Pass custom prompt via options
4. Verify agent uses custom prompt

**Acceptance Scenarios**:

1. **Given** developer has custom `PromptTemplate` matching the agent's input schema, **When** they pass it via execute options, **Then** agent uses custom prompt with type safety enforced
2. **Given** developer provides incompatible template data type, **When** they compile, **Then** TypeScript shows error before runtime

---

### User Story 4 - Portable Runtime (Priority: P2)

**As a** developer in a Node.js environment
**I want to** run Open Harness without Bun
**So that** I can use the framework in existing infrastructure

**Why P2**: Framework should be runtime-agnostic. Bun-only is a barrier to adoption.

**Independent Test**:
1. Create Node.js project (not Bun)
2. Install `@openharness/anthropic`
3. Run test suite with `node --test`
4. Verify all tests pass

**Acceptance Scenarios**:

1. **Given** TypeScript prompts (no runtime file I/O), **When** developer runs in Node.js, **Then** all tests pass without Bun-specific errors
2. **Given** prompts are ESM imports, **When** package is bundled, **Then** prompts are included at build time

---

### User Story 5 - Documentation Navigation (Priority: P3)

**As a** developer learning Open Harness
**I want to** understand the architecture quickly
**So that** I can make informed design decisions

**Why P3**: Developer experience enhancement. Good docs reduce support burden and increase confidence.

**Independent Test**:
1. Open root `CLAUDE.md`
2. Follow link to canonical docs
3. Find "How It Works" guide
4. Understand: DI → prompt loading → agent execution → events

**Acceptance Scenarios**:

1. **Given** developer opens CLAUDE.md, **When** they navigate to architecture guide, **Then** total navigation is 2 clicks or fewer
2. **Given** developer reads "How It Works" guide, **When** they look for layer explanation, **Then** document contains layer diagram, code examples, and event flow

---

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

## Requirements *(mandatory)*

### Functional Requirements - Package Structure

- **FR-001**: System MUST organize `packages/anthropic/src/` into three layers:
  - (a) `infra/` - Runtime execution infrastructure (runner, recording, monologue)
  - (b) `provider/` - Anthropic/Claude provider implementation (base class, prompts, factory)
  - (c) `presets/` - Optional concrete agent implementations (coding, review, planner)

- **FR-002**: System MUST export framework-only from main index:
  - (a) Main export: `defineAnthropicAgent`, `createPromptTemplate` from root
  - (b) Preset export: `CodingAgent`, etc. from `/presets` subpath
  - (c) No concrete agents in main index
  - (d) No class-based exports (BaseAnthropicAgent is internal)

- **FR-003**: Package.json exports MUST include:
  - (a) `"."` → framework primitives (defineAnthropicAgent, types, prompt utilities)
  - (b) `"./presets"` → preset agents (CodingAgent, ReviewAgent, etc.)
  - (c) No class-based base agent exports

### Functional Requirements - Agent Factory

- **FR-004**: System MUST provide `defineAnthropicAgent<TInput, TOutput>()` factory that:
  - (a) Accepts configuration with name, prompt, input/output schemas
  - (b) Returns object with `.execute()` and `.stream()` methods
  - (c) Handles DI container creation internally (hidden from users)
  - (d) Uses `IUnifiedEventBus` ONLY (removes dual event bus support)
  - (e) Wires event callbacks automatically

- **FR-005**: Agent definition MUST include:
  - (a) `name: string` - Unique agent identifier
  - (b) `prompt: PromptTemplate<TInput> | string` - Template or static string
  - (c) `inputSchema: ZodType<TInput>` - Validates input, provides template variables
  - (d) `outputSchema: ZodType<TOutput>` - Validates structured output
  - (e) `options?: Partial<Options>` - SDK options passthrough

- **FR-006**: Factory MUST support async iterable input:
  - (a) `.stream()` method accepts string or async iterable prompt
  - (b) Returns `AgentHandle` with `interrupt()`, `streamInput()`, `setModel()` methods
  - (c) Enables multi-turn conversations and message injection

### Functional Requirements - Prompt System

- **FR-007**: System MUST provide `PromptTemplate<TData>` interface:
  - (a) `.render()` accepts typed data, returns interpolated prompt
  - (b) Optional `.validate()` throws error for invalid data
  - (c) Co-located with agent definitions in same file/folder

- **FR-008**: Prompt templates MUST be TypeScript exports (no file I/O):
  - (a) Templates imported at build time
  - (b) No runtime file reading
  - (c) Works in both Node.js and Bun environments

- **FR-009**: Prompt templates MUST be overridable at runtime:
  - (a) Via agent definition
  - (b) Via execute options
  - (c) Type safety enforced

- **FR-010**: System SHOULD provide `createPromptTemplate<TData>()` helper:
  - (a) Wraps template with validation logic
  - (b) Returns `PromptTemplate<TData>` with automatic `.validate()` call

### Functional Requirements - Documentation

- **FR-011**: Root CLAUDE.md MUST serve as navigation hub:
  - (a) Contains links to `.knowledge/docs/` (canonical source)
  - (b) Does NOT duplicate content from canonical docs
  - (c) Includes link to "How It Works" architecture guide

- **FR-012**: System MUST include `.knowledge/docs/how-it-works.md`:
  - (a) Explains architecture layers
  - (b) Shows request flow
  - (c) Contains code examples for each layer
  - (d) Bridges vision and implementation

- **FR-013**: Canonical docs MUST sync to `packages/sdk/docs/`:
  - (a) Via script or CI automation
  - (b) Ensures published package includes canonical documentation

### Key Entities

| Entity | Type | Purpose |
|--------|------|---------|
| `defineAnthropicAgent<TInput, TOutput>()` | Factory function | Create agents with minimal boilerplate (ONLY way to create agents) |
| `AnthropicAgentDefinition<TInput, TOutput>` | Interface | Agent configuration (name, prompt, schemas) |
| `PromptTemplate<TData>` | Interface | Type-safe prompt template with render/validate |
| `InternalAnthropicAgent` | Class (internal) | Internal implementation (NOT exported) |
| `CodingAgent` | Preset | Pre-configured agent for coding tasks |
| `ReviewAgent` | Preset | Pre-configured agent for code review |
| `PlannerAgent` | Preset | Pre-configured agent for project planning |

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Developer can create custom agent in less than 20 lines
  - **Measurement**: Count lines in `examples/custom-agent.ts`
  - **Verification**: Custom agent creation example
  - **Acceptance**: Import, define template, call factory, execute = 15-18 LOC

- **SC-002**: Preset agents work with zero configuration
  - **Measurement**: Count lines of setup code before `.execute()` call
  - **Verification**: Preset agent usage example
  - **Acceptance**: Setup code = 0 lines (just import + execute)

- **SC-003**: TypeScript catches prompt template errors at compile time
  - **Measurement**: Compile test suite with invalid template data
  - **Verification**: Type safety test cases
  - **Acceptance**: `tsc --noEmit` fails with type error for wrong data shape

- **SC-004**: Tests pass in both Node.js and Bun
  - **Measurement**: CI runs test suite in both runtimes
  - **Verification**: Runtime compatibility tests
  - **Acceptance**: Exit code 0 for both `bun test` and `node --test`

- **SC-005**: Documentation navigation requires 2 clicks or fewer from root to architecture guide
  - **Measurement**: User test: CLAUDE.md → `.knowledge/` → `how-it-works.md`
  - **Verification**: Documentation structure review
  - **Acceptance**: Total clicks = 2, guide exists and explains layer architecture

---

## Assumptions

1. **TypeScript Projects**: Developers have TypeScript build toolchain
2. **ESM Support**: Package.json `exports` field supported (Node.js 12.7+, Bun 0.1+)
3. **Template Literals Acceptable**: Developers prefer type safety over markdown readability for prompts
4. **DI Container Hidden**: End users don't need to interact with `@needle-di` directly
5. **Zod Schemas**: Developers comfortable with Zod for runtime validation

---

## Non-Goals

This specification explicitly does NOT include:

1. **Runtime Prompt Template Compilation** - No Handlebars/Mustache/Liquid engines
2. **Visual Prompt Editor** - Prompts are code (edited in IDE)
3. **CommonJS Support** - ESM-only (modern Node.js, Bun)
4. **Non-TypeScript Projects** - Framework requires TypeScript for type safety
5. **Prompt Versioning System** - Use git for prompt history
6. **Multi-Provider Factory** - Factory is Anthropic-specific

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Developers prefer markdown prompts | Low adoption of TypeScript templates | Provide migration guide with examples showing benefits |
| Breaking changes alienate users | Migration friction | Keep backward compat warnings for 1 major version |
| Factory pattern too abstract | Confusion for new users | Document both patterns with clear examples |
| Phase 3 takes longer than expected | Delayed release | Phase 1-2 are non-breaking, can ship incrementally |
| Examples become outdated | User confusion | Automate example testing in CI |

---

## Open Questions

1. **Monologue Decorator Compatibility**: How does `@Monologue` decorator work with factory-based agents?
   - **Tentative Answer**: Factory wraps agent, decorator attaches to execute method
   - **Action**: Test monologue integration during implementation

2. **Recording System with Factory**: Does `@Record` decorator still work?
   - **Tentative Answer**: Recording attaches to runner, not agent class
   - **Action**: Verify recording tests pass during implementation

3. **Multi-Turn Conversations**: How does `.stream()` method support async iterable input?
   - **Tentative Answer**: Deferred to follow-up spec (complex API design)
   - **Action**: Document as extension point

---

**Last Updated**: 2025-12-28
**Next Steps**: Validation → `/oharnes.plan` → Implementation cycle
