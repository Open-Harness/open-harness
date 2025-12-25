<!--
================================================================================
SYNC IMPACT REPORT
================================================================================
Version change: 2.0.1 → 3.0.0
Bump rationale: MAJOR - Restructured for clarity; moved implementation details
                to supporting docs

Changes:
- Condensed all principles to 4-5 bullets each (no code blocks)
- Removed Development Workflow section → moved to CONTRIBUTING.md
- Removed Quality Gates table → moved to CONTRIBUTING.md
- Removed code examples → moved to docs/patterns/

Templates: All compatible (no principle changes, only structural)

Follow-up:
- Create CONTRIBUTING.md with workflow + quality gates
- Create docs/patterns/testing.md with recorder examples
- Create docs/patterns/di.md with DI examples
================================================================================
-->

# Open Harness Constitution

This constitution defines the non-negotiable principles for Open Harness development.
For workflow details, see [CONTRIBUTING.md](../../CONTRIBUTING.md).
For implementation patterns, see [docs/patterns/](../../docs/patterns/).

## Core Principles

### I. Type Safety First

The type system is the primary defense against runtime errors.

- `strict: true` in all tsconfig.json files—no exceptions
- `any` is FORBIDDEN; use `unknown` with type guards
- All function signatures MUST be explicitly typed
- API boundaries MUST have validated schemas (Zod or equivalent)
- Discriminated unions over optional properties; exhaustive switches with `never`

### II. Verified by Reality

Every completed feature MUST be proven to work with real LLM calls.

- Unit tests are for pure logic only (parsers, transformers, state machines)
- Agent/SDK code MUST use the recorder pattern—capture real LLM responses, replay for TDD
- Fixtures MUST be captured from actual LLM calls, never hand-crafted
- Completed work MUST have a live integration test proving it works in production
- Golden recordings are committed to the repo in `recordings/golden/`

### III. Dependency Injection Discipline

Internals use Needle DI properly. Externals hide DI behind factories.

- All internal services MUST use `@injectable()` with `inject(Token)` pattern
- Composition root (`container.ts`) is the ONLY place implementations are bound
- Circular dependencies are FORBIDDEN
- Factory functions (`createAgent()`, `createWorkflow()`) MUST hide container complexity
- Users MUST NOT need to understand DI to use the SDK

## Governance

This constitution supersedes informal practices. Amendments require:

1. Documented rationale
2. Review of downstream impact (specs, plans, tasks)
3. Semantic version bump (MAJOR: principle change, MINOR: addition, PATCH: clarification)

Violations require documented justification. Repeated violations signal the constitution needs amendment—discuss rather than ignore.

**Version**: 3.0.0 | **Ratified**: 2025-12-25 | **Last Amended**: 2025-12-25
