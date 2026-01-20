<!--
SYNC IMPACT REPORT
==================
Version change: N/A → 1.0.0 (initial ratification)
Modified principles: N/A (initial)
Added sections:
  - Core Principles (8 principles)
  - Technical Constraints
  - Development Workflow
  - Governance
Removed sections: N/A (initial)
Templates requiring updates:
  - ✅ .specify/templates/plan-template.md (Constitution Check section compatible)
  - ✅ .specify/templates/spec-template.md (Requirements format compatible)
  - ✅ .specify/templates/tasks-template.md (Phase structure compatible)
Follow-up TODOs: None
-->

# Open Harness Constitution

## Core Principles

### I. Event-Based Architecture

Everything is an immutable event. Events are typed facts about what happened—they carry
meaning, not behavior. The event log is the single source of truth for execution,
debugging, and replay.

**MUST**:
- All agent interactions produce events, never direct state mutations
- Events are immutable after creation
- Events include: `id`, `name`, `payload`, `timestamp`, and optional `causedBy` for tracing
- Event names follow convention: past tense for facts (`task:completed`), present for streaming (`text:delta`)

**MUST NOT**:
- Modify events after emission
- Store state outside the event-derived model

### II. Pure Handlers

Handlers are pure functions: `(Event, State) → { state: State, events: Event[] }`.
They react to events and update state. They do not perform side effects.

**MUST**:
- Return new state and zero or more new events
- Be deterministic given the same inputs
- Keep one handler per event type

**MUST NOT**:
- Call APIs or perform I/O
- Access anything outside their inputs (event, state)
- Know about other handlers

### III. Effect Under the Hood

The internal implementation uses the Effect TypeScript library for managing side effects,
concurrency, and error handling. This complexity is hidden from consumers.

**MUST**:
- Use Effect for all internal async operations, error channels, and resource management
- Expose a clean, Effect-free public API surface
- Handle errors through Effect's typed error channel internally

**MUST NOT**:
- Leak Effect types into the public API
- Require consumers to understand Effect to use the library

### IV. Vercel AI SDK-Compatible DX

The developer experience must feel familiar to Vercel AI SDK users. Same patterns,
similar hooks, predictable behavior.

**MUST**:
- Provide `useWorkflow` hook with `messages`, `input`, `setInput`, `handleSubmit`, `isLoading`
- Project events into AI SDK-compatible `Message[]` format
- Support streaming text via accumulated deltas
- Provide `WorkflowProvider` for React context

**SHOULD**:
- Match AI SDK naming conventions where applicable
- Provide escape hatches (`events`, `state`) for power users

### V. Recording & Replay First

The Tape API is a first-class citizen. Every workflow must be recordable and replayable
without code changes. Recording is not an afterthought—it's the foundation.

**MUST**:
- Record all events to persistent storage (SQLite default)
- Support replay without API calls (events come from recording)
- Provide VCR-style controls: `rewind`, `step`, `stepBack`, `stepTo`, `play`, `pause`
- Enable time-travel debugging: jump to any event, inspect state at that point

**MUST NOT**:
- Lose events during recording
- Require different code paths for live vs. replay mode

### VI. Structured Output (No Raw Console)

No raw `console.log`, `console.error`, or `console.warn` anywhere in the codebase.
All output flows through structured, centralized functions.

**MUST**:
- Use effect logger for operational logging (`logger.info`, `logger.error`, etc.)
- Create dedicated presenter/output functions for CLI/script display
- Centralize all output functions in dedicated files (e.g., `src/cli/output.ts`)
- Scripts must import output functions, never inline console calls

**MUST NOT**:
- Use `console.log`, `console.error`, `console.warn`, or `console.debug` directly
- Scatter output logic across implementation files
- Mix logging concerns with business logic

**Rationale**: Structured output is queryable, testable, and maintainable. Raw console
calls create noise, are impossible to filter, and indicate sloppy design.

### VII. Integration Testing Mandate

Unit tests that mock everything prove nothing about real behavior. Integration tests
that run against real systems are mandatory for any SDK or external system interaction.

**MUST**:
- Record fixtures from REAL SDK/API interactions, never fabricate them
- Run integration tests against live systems before claiming "done"
- Use `packages/sdk/scripts/record-fixtures.ts` or equivalent for fixture capture
- Visually validate TUI changes using the `tttd` skill

**MUST NOT**:
- Manually create fixtures with made-up data
- Ship code that only passes mocked unit tests
- Claim completion without integration test evidence

### VIII. Observability First

Every operation must be traceable. Structured logging and event causality enable
debugging without guesswork.

**MUST**:
- Use structured logging with correlation IDs (`runId`, `nodeId`)
- Write logs to `.open-harness/logs/harness.log` in JSONL format
- Track event causality via `causedBy` field
- Make logs queryable with `jq`

**SHOULD**:
- Emit events for significant lifecycle transitions
- Include enough context in log entries for standalone debugging


## Technical Constraints

These constraints ensure consistency across the codebase and prevent common pitfalls.

**Runtime & Language**:
- TypeScript 5.x with strict mode enabled
- Bun runtime for package management and script execution
- Use `bun x` (not `bunx`) for executables, `bun run <script>` for package.json scripts

**Authentication**:
- Use Claude Code subscription authentication via `@anthropic-ai/claude-agent-sdk`
- NEVER set or look for `ANTHROPIC_API_KEY`—subscription auth handles it automatically

**Dependencies**:
- Core: `@anthropic-ai/claude-agent-sdk`, `effect`, `zod`
- Testing: `bun:test`, real fixtures
- Storage: SQLite (default), memory (tests)


## Development Workflow

**Git Branching** (feature → dev → master):
- ALWAYS branch from `dev`, never from `master`
- PRs target `dev` for integration
- `dev` merges to `master` for releases
- Branching from `master` causes severe merge conflicts

**Issue Tracking**:
- Use Beads for git-native issue tracking
- ALWAYS run `bd sync` before ending any session
- Link commits to issues with `(bd-<issue-id>)` in commit messages

**Quality Gates**:
- `bun run typecheck` must pass
- `bun run lint` must pass
- `bun run test` must pass
- Integration tests must validate real behavior


## Governance

This constitution supersedes all other practices and documentation when conflicts arise.
All PRs and code reviews must verify compliance with these principles.

**Amendment Process**:
1. Document the proposed change with rationale
2. Obtain approval from maintainers
3. Update constitution with version bump
4. Propagate changes to dependent templates

**Versioning**:
- MAJOR: Backward-incompatible principle changes or removals
- MINOR: New principles or materially expanded guidance
- PATCH: Clarifications, wording, non-semantic refinements

**Compliance Review**:
- Every PR must pass Constitution Check in plan-template.md
- Violations require documented justification in Complexity Tracking table
- Unjustified violations block merge

**Version**: 1.0.0 | **Ratified**: 2026-01-21 | **Last Amended**: 2026-01-21
