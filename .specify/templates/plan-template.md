# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]  
**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]  
**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]  
**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]  
**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]
**Project Type**: [single/web/mobile - determines source structure]  
**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]  
**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]  
**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

[Gates determined based on constitution file]

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |

## Context Scope

<!--
  PURPOSE: Prevents prototype contamination during implementation.
  The implementing agent should ONLY see relevant context, not prototype/spike code
  that might influence architectural decisions away from the specification.

  This section addresses RC001 from 003-harness-renderer retrospective:
  "Prototype in context caused architectural divergence"
-->

### Include in Agent Context

> Directories and files the implementing agent SHOULD access

- `src/` - main source code
- `specs/[###-feature]/` - this feature's specification and plan
- `tests/` - existing test patterns
- [Add feature-specific paths]

### Exclude from Agent Context

> Directories and files the implementing agent should NOT access (prototype isolation)

- `examples/` - prototype/example code (may cause architectural divergence)
- `*.spike.*` - spike/exploration branches
- `**/prototype/` - prototype directories
- `node_modules/`, `dist/`, `build/` - generated/external files
- [Add project-specific exclusions, e.g., `listr2/examples/`]

**Rationale**: [Explain any non-obvious exclusions]

## Verification Gates

<!--
  PURPOSE: Define what validation must pass at each stage.
  Catches implementation drift BEFORE problems compound.

  This section addresses RC003/RC005 from 003-harness-renderer retrospective:
  "Spec-kit /implement has no verification gates"
  "Tasks.md path specifications ignored"
-->

### Pre-Commit Gates

> Must pass before ANY commit during implementation

- [ ] All tests pass: `[test command, e.g., bun test]`
- [ ] Type checking passes: `[type command, e.g., tsc --noEmit]`
- [ ] Linting passes: `[lint command, e.g., bun run lint]`
- [ ] No console.log/debug statements in production code

### Task Completion Gates

> Verified after each task is marked complete

- [ ] Task file paths match actual created/modified files
- [ ] Task marked `[X]` in tasks.md
- [ ] New code follows patterns from plan.md Project Structure

### Feature Completion Gates

> Must pass before feature is considered complete

- [ ] All tasks marked `[X]` in tasks.md
- [ ] All critical file paths exist (see below)
- [ ] Integration test passes with real dependencies
- [ ] Documentation updated if public API changed

### Critical File Paths

> These files MUST exist at feature completion (validates against tasks.md paths)

```text
[List critical paths from your feature, e.g.:]
src/[module]/index.ts           # Barrel export
src/[module]/types.ts           # Type definitions
tests/[module]/[module].test.ts # Test file
```

### Test Coverage Expectations

- **Minimum line coverage**: [e.g., 70%] for new code
- **Required test types**: [e.g., Contract tests for all API endpoints]
- **Skip flag**: `--skip-tests` available for iterative development (must pass before merge)
