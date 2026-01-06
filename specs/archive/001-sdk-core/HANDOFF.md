# Handoff: SDK Core Implementation

**Last Updated**: 2025-12-25
**Status**: Spec & Plan complete, ready for task generation

## Resume Command

In a fresh Claude Code session, run:

```
/speckit.tasks
```

Or paste this prompt:

```
Read the spec and plan at specs/001-sdk-core/, then generate tasks.md following the spec-kit tasks template. The plan has 6 phases - generate ordered tasks for each phase.
```

## What's Done

1. **Constitution** - `.specify/memory/constitution.md` (v3.0.0)
2. **Spec** - `specs/001-sdk-core/spec.md` (84 requirements, 6 user stories)
3. **Plan** - `specs/001-sdk-core/plan.md` (6 phases, 8 architectural decisions)

## Key Architectural Decisions

| ID | Decision |
|----|----------|
| AD-001 | Monologue as DI-aware decorator |
| AD-002 | Recording as DI-aware decorator (agent level) |
| AD-003 | Single callback interface (IAgentCallbacks) |
| AD-004 | Thin BaseAnthropicAgent |
| AD-005 | **Context schema pattern** - agents define contextSchema, harness transforms state |
| AD-006 | Recording at agent level |
| AD-007 | Monologue buffers events, cheap model emits |
| AD-008 | Prompts as Handlebars markdown |

## Implementation Phases (from plan.md)

1. **Foundation** - Fix build, create BaseAnthropicAgent, migrate agents
2. **Recording** - RecordingDecorator, golden fixtures
3. **Prompts** - PromptRegistry, Handlebars templates
4. **Monologue** - MonologueDecorator, narrative generation
5. **Consolidation** - Callbacks, context system
6. **Validation** - Tests, success criteria

## Files to Read First

```
specs/001-sdk-core/spec.md    # Requirements
specs/001-sdk-core/plan.md    # Architecture
.specify/memory/constitution.md  # Principles
```

## What's Next

1. Generate `specs/001-sdk-core/tasks.md` from the plan
2. Execute tasks phase by phase
3. Validate against success criteria (SC-001 to SC-010)
