# Feature Specification: SDK Validation via Speckit Dogfooding

**Feature Branch**: `002-sdk-validation`
**Created**: 2025-12-25
**Status**: Draft
**Input**: Retrospective from 001-sdk-core + dogfooding approach using SDK to run Speckit tasks

## Overview

The best way to validate the SDK is to use it for real work. This spec defines a harness that executes Speckit's own `tasks.md` file using SDK agents - proving the SDK works by having it run the Speckit process.

**The Loop**:
```
tasks.md → ParserAgent → [{task, validation}] → Harness → CodingAgent → ReviewAgent
               ↓                                    ↓              ↓
           narrates                             narrates       narrates
```

All three agents are wrapped with monologue, creating a unified narrative stream.

This validates:
- Structured outputs (Parser Agent → JSON)
- Harness state management (task tracking)
- Agent execution (Coding Agent)
- Review/validation (Review Agent)
- Monologue system (narrative of the whole process)

---

## User Scenarios & Testing

### User Story 1 - Task Parser Agent (Priority: P1)

As a developer, I want an agent that converts `tasks.md` into a structured task list with inferred validation criteria, so that the harness can iterate through tasks programmatically.

**Why this priority**: Without structured task data, the harness cannot operate. This is the entry point.

**Independent Test**: Given a tasks.md file, Parser Agent returns a JSON array of tasks with validation criteria derived from task content.

**Acceptance Scenarios**:

1. **Given** a valid tasks.md file, **When** Parser Agent executes, **Then** it returns a structured array of task objects
2. **Given** a task with an "Independent Test" section, **When** parsing, **Then** that text becomes the task's validation criteria
3. **Given** a task without explicit validation, **When** parsing, **Then** validation criteria is inferred from task purpose and description
4. **Given** task dependencies (e.g., `depends: T006,T007`), **When** parsing, **Then** dependency relationships are preserved
5. **Given** task status markers (`[X]` or `[ ]`), **When** parsing, **Then** status is captured (allows resuming partial runs)

**Structured Output Schema** (conceptual):
```
{
  tasks: [{
    id: "T001",
    phase: "Phase 1: Setup",
    description: "Remove web build configuration...",
    filePaths: ["packages/sdk/package.json"],
    userStory: null | "US1",
    dependencies: [],
    status: "complete" | "pending",
    validationCriteria: "Build succeeds after removing web config"
  }]
}
```

---

### User Story 2 - Task Execution Harness (Priority: P1)

As a developer, I want a harness that iterates through parsed tasks, feeding each to a Coding Agent, so that tasks are executed in order with state tracking.

**Why this priority**: The harness is the orchestration layer - without it, agents can't execute tasks systematically.

**Independent Test**: Given a parsed task list, harness executes each pending task via Coding Agent and tracks completion state.

**Acceptance Scenarios**:

1. **Given** a list of parsed tasks, **When** harness.run() is called, **Then** tasks execute in dependency order
2. **Given** a task with dependencies, **When** dependencies are incomplete, **Then** task is skipped until dependencies complete
3. **Given** a task marked complete (`[X]`), **When** running in resume mode, **Then** task is skipped
4. **Given** a checkpoint file exists, **When** resumeFromCheckpoint is enabled, **Then** harness loads state from checkpoint and resumes from last incomplete task
5. **Given** harness execution, **When** a task completes, **Then** harness state updates with result
6. **Given** harness execution, **When** a task fails, **Then** failure is recorded and harness stops (fail-fast default; opt-in continue mode available)

---

### User Story 3 - Task Validation via Review Agent (Priority: P1)

As a developer, I want each completed task to be validated by a Review Agent using the parsed validation criteria, so that tasks are truly "done" not just "code written".

**Why this priority**: Directly addresses the retro's core issue - tasks were marked done when code existed, not when validated.

**Independent Test**: After Coding Agent completes a task, Review Agent checks the work against validation criteria and returns pass/fail.

**Acceptance Scenarios**:

1. **Given** a completed task with validation criteria, **When** Review Agent evaluates, **Then** it returns pass/fail with reasoning
2. **Given** Review Agent passes, **When** harness updates state, **Then** task is marked `[V]`alidated (not just `[C]`omplete)
3. **Given** Review Agent fails, **When** harness records failure, **Then** failure reason and suggested fix are captured
4. **Given** a task with no explicit criteria, **When** Review Agent evaluates, **Then** it infers reasonable completion criteria from context
5. **Given** retry mode enabled, **When** Review Agent fails a task, **Then** Coding Agent retries with failure feedback

---

### User Story 4 - Monologue Integration (Priority: P2)

As a developer, I want all agents (Parser, Coding, Review) to narrate their work in first-person, so that I can watch the Speckit process unfold as a coherent story.

**Why this priority**: Validates the monologue system with real multi-agent usage. Lower priority because core loop works without it.

**Independent Test**: During harness execution, each agent emits onNarrative callbacks describing its actions in plain English.

**All agents wrapped with monologue**:
- **Parser Agent**: "I'm reading through the tasks file... I found 68 tasks across 10 phases..."
- **Coding Agent**: "Working on T030 now. I need to create the monologue prompt template..."
- **Review Agent**: "Checking if T030 is complete... The file exists but the template is missing required sections..."

**Acceptance Scenarios**:

1. **Given** Parser Agent with monologue, **When** parsing tasks.md, **Then** it narrates discovery of phases, tasks, and validation criteria
2. **Given** Coding Agent with monologue, **When** executing a task, **Then** it narrates file operations, decisions, and completion
3. **Given** Review Agent with monologue, **When** validating a task, **Then** it narrates what it's checking and its pass/fail reasoning
4. **Given** all three agents narrating, **When** harness orchestrates them, **Then** narratives form a coherent story with clear handoffs
5. **Given** a task retry (Coding → Review fail → Coding), **When** retry occurs, **Then** narrative explains the feedback loop

---

### User Story 5 - Recording/Replay for Harness (Priority: P2)

As a developer, I want to record a full harness run and replay it deterministically, so that I can iterate on harness behavior without expensive API calls.

**Why this priority**: Validates recording/replay with a real multi-agent workflow. Enables TDD for harness development.

**Independent Test**: Record a harness run to files, then replay it with identical task progression and validation results.

**Acceptance Scenarios**:

1. **Given** harness in recording mode, **When** full run completes, **Then** all agent sessions are captured to recordings/
2. **Given** recorded harness run, **When** replayed, **Then** same tasks complete in same order with same results
3. **Given** replay mode, **When** agent would make API call, **Then** recorded response is used instead
4. **Given** recorded run with monologue, **When** replayed, **Then** identical narratives are emitted

---

### Edge Cases

- What happens when tasks.md has malformed markdown? → Parser Agent returns error with line number and suggestion
- What happens when Coding Agent cannot find referenced file? → Task fails with clear error, harness continues
- What happens when Review Agent disagrees with Coding Agent? → Failure recorded with both perspectives
- What happens when a dependency cycle exists? → Parser Agent detects and reports cycle before execution
- What happens when harness is interrupted mid-run? → State persists, can resume from last checkpoint
- What happens when validation criteria is ambiguous? → Review Agent makes best effort, flags uncertainty in result
- What happens when a task times out? → Task marked as failed with timeout reason (default: 5 minutes per task), harness stops (fail-fast) or continues based on mode
- What happens when API rate limits are hit? → Automatic exponential backoff (base: 1000ms, max: 60000ms, jitter: 0-500ms, max 10 attempts) and retry until success or timeout

---

## Requirements

### Functional Requirements

**Parser Agent**
- **FR-001**: Parser Agent MUST accept markdown file path and return structured JSON
- **FR-002**: Parser Agent MUST use structured output with Zod schema for type safety
- **FR-003**: Parser Agent MUST extract: id, phase, description, filePaths, userStory, dependencies, status
- **FR-004**: Parser Agent MUST infer validation criteria from "Independent Test" sections or task context
- **FR-005**: Parser Agent MUST preserve task order and phase grouping

**Task Execution Harness**
- **FR-010**: Harness MUST extend existing BaseHarness patterns from 001-sdk-core
- **FR-011**: Harness MUST track state: pending tasks, in-progress task, completed tasks, failed tasks
- **FR-012**: Harness MUST respect task dependencies (topological sort)
- **FR-013**: Harness MUST support resume from checkpoint (skip completed tasks)
- **FR-014**: All agents (Parser, Coding, Review) MUST be wrapped with monologue
- **FR-015**: Harness MUST aggregate narrative callbacks from all agents into unified stream
- **FR-016**: Harness MUST enforce per-task timeout (default: 5 minutes, configurable via TaskHarnessConfig.taskTimeoutMs); timeout triggers task failure
- **FR-017**: Harness MUST handle API rate limits with exponential backoff (base delay 1000ms, max delay 60000ms, jitter 0-500ms, max 10 attempts before failure)

**Review Validation**
- **FR-020**: Review Agent MUST receive: task description, validation criteria, coding result
- **FR-021**: Review Agent MUST return: pass/fail, reasoning, suggested fixes (if fail)
- **FR-022**: Review Agent MUST distinguish `[C]ode Complete` from `[V]alidated`
- **FR-023**: Harness MUST support retry loop: Coding → Review → (fail) → Coding with feedback; harness tracks attempts and feeds history to agent, agent can signal abort when further retries are futile

**Recording/Replay**
- **FR-030**: Harness MUST support recording mode that captures all agent sessions
- **FR-031**: Harness MUST support replay mode that uses recorded sessions
- **FR-032**: Recordings MUST be stored in `recordings/harness/{sessionId}/` with one file per agent call

---

### Key Entities

- **ParsedTask**: Structured task extracted from tasks.md with validation criteria
- **HarnessState**: Current execution state (pending, in-progress, completed, failed tasks)
- **TaskResult**: Output from Coding Agent execution for a single task
- **ValidationResult**: Review Agent's pass/fail judgment with reasoning
- **HarnessRun**: Complete execution session (can be recorded/replayed)

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Parser Agent successfully converts 001-sdk-core/tasks.md to structured JSON
- **SC-002**: Harness executes at least 3 pending tasks from tasks.md in dependency order
- **SC-003**: Review Agent validates each task and produces pass/fail with reasoning
- **SC-004**: Monologue emits readable narrative throughout harness execution
- **SC-005**: Full harness run can be recorded and replayed with identical results
- **SC-006**: Harness can resume from checkpoint after interruption
- **SC-007**: The retro's incomplete tasks (T026, T030, T065-T068) can be executed by this harness

---

## Assumptions

- tasks.md follows the format established in 001-sdk-core (phases, checkpoints, task format)
- Coding Agent has appropriate tools/permissions for file operations
- Claude Code subscription provides automatic authentication for live runs (no API key needed)
- 001-sdk-core infrastructure (BaseHarness, agents, container) is functional

---

## Dependencies

- 001-sdk-core: Provides BaseHarness, CodingAgent, ReviewAgent, container, recording infrastructure
- tasks.md format: Parser assumes current markdown structure
- Anthropic API: Required for live execution

---

## Clarifications

### Session 2025-12-25

- Q: How many retries before stopping? → A: Harness tracks attempts and feeds history to agent; agent can signal abort when retrying is futile
- Q: Default failure behavior (stop or continue)? → A: Stop on first failure (fail-fast); opt-in to continue mode
- Q: Task timeout behavior? → A: Per-task timeout enforced by harness (default configurable)
- Q: API rate limit handling? → A: Automatic exponential backoff and retry
- Q: How does resume mode determine what to skip? → A: Two mechanisms: (1) task status markers in tasks.md (`[X]` = complete), (2) checkpoint file from previous run. Checkpoint takes precedence if both exist.

---

## Out of Scope

- Full Speckit automation (spec → plan → tasks → implement) - future phase
- Automatic tasks.md updates based on harness results
- Web UI for harness monitoring
- Multi-harness parallelization
