# Handoff: SDK DX Implementation Research

**Purpose:** Bridge the DX decisions with actual implementation by researching codebase + vitest capabilities.

---

## Context

We've designed a new DX for Open Harness. Before implementing, we need to understand:
1. What exists in the codebase today
2. What vitest provides (plugins, reporters, benchmarks)
3. How to bridge design → implementation

**Read first:** `docs/internal/milestones/v0.2.0/SDK_DX_DECISIONS.md`

---

## Locked DX Decisions

| Concept | API | Description |
|---------|-----|-------------|
| **Agent** | `agent({ prompt, state?, output? })` | Single model call, optionally stateful |
| **Harness** | `harness({ agents, edges, state })` | Coordinates agents, owns shared state |
| **Run** | `run(agentOrHarness, input, opts?)` | ONE way to execute |
| **Eval** | vitest + `@open-harness/vitest` plugin | Vitest-native, not custom runner |
| **Recording** | Agent/provider level | Harness coordinates, doesn't record itself |

---

## Research Tasks (Fan-Out)

Execute these research tasks in parallel using sub-agents.

### Task 1: Codebase - Current Entry Points

**Objective:** Map current entry points to understand what needs to change.

**Search targets:**
- `packages/internal/core/src/` - Core runtime
- `packages/internal/server/src/` - Server/harness creation
- `packages/open-harness/*/src/index.ts` - Public exports

**Questions to answer:**
1. Where is `runFlow()` defined? What does it do?
2. Where is `createHarness()` defined? What does it return?
3. Where is `createRuntime()` defined? When is it used?
4. What types exist for flow/node definitions?
5. What is currently exported from `@open-harness/core`?

**Output:** List of files + functions with brief descriptions.

---

### Task 2: Codebase - Recording System

**Objective:** Understand current recording implementation.

**Search targets:**
- `packages/internal/core/src/recording/`
- `packages/stores/recording-store/`

**Questions to answer:**
1. How does `withRecording()` work?
2. What is `RecordingStore` interface?
3. What does a recording contain? (types)
4. How is `recordingId` generated/used?
5. How does replay work?

**Output:** Recording system architecture summary.

---

### Task 3: Codebase - State Management

**Objective:** Understand how state works currently.

**Search targets:**
- `packages/internal/core/src/` - Look for state, RunStore
- `packages/stores/run-store/`

**Questions to answer:**
1. How is flow state managed currently?
2. What is `RunStore` vs `RecordingStore`?
3. How does state persist across runs?
4. How does state update during execution?

**Output:** State management architecture summary.

---

### Task 4: Codebase - Eval System

**Objective:** Understand current eval implementation (to deprecate/migrate).

**Search targets:**
- `packages/internal/core/src/eval/`
- Look for: `defineSuite`, `runSuite`, `variant`, `gates`

**Questions to answer:**
1. What does `defineSuite()` do?
2. What does `runSuite()` do?
3. How do gates work?
4. How do variants work?
5. What can be reused vs needs removal?

**Output:** Eval system inventory with deprecation recommendations.

---

### Task 5: Vitest - Plugin System

**Objective:** Understand how to build vitest plugins.

**Research sources:**
- https://vitest.dev/guide/extending-matchers.html
- https://vitest.dev/advanced/api.html
- https://vitest.dev/config/#plugins

**Questions to answer:**
1. How do vitest plugins work?
2. How to add custom matchers (expect extensions)?
3. How to access test results programmatically?
4. How to integrate with vitest lifecycle?

**Output:** Vitest plugin architecture summary with code examples.

---

### Task 6: Vitest - Custom Reporters

**Objective:** Understand how to build custom reporters for aggregation + gates.

**Research sources:**
- https://vitest.dev/advanced/reporters.html
- https://vitest.dev/config/#reporters

**Questions to answer:**
1. How do custom reporters work?
2. What data is available to reporters?
3. How to fail CI based on aggregated results?
4. How to output custom formats (JSON, markdown)?
5. Can reporters access test metadata/tags?

**Output:** Reporter architecture with code examples for gates.

---

### Task 7: Vitest - Benchmarking

**Objective:** Understand vitest's built-in benchmarking.

**Research sources:**
- https://vitest.dev/guide/features.html#benchmarking
- https://vitest.dev/api/#bench

**Questions to answer:**
1. How does `bench()` work?
2. Is it suitable for AI latency/cost benchmarks? (or only microbenchmarks?)
3. Can we use `test()` with custom metrics instead?
4. How to report benchmark results?

**Output:** Recommendation on whether to use `bench()` or custom approach.

---

## Synthesis (Fan-In)

After all research tasks complete, synthesize findings into:

### 1. Implementation Mapping

| DX Concept | Current Implementation | Change Required |
|------------|----------------------|-----------------|
| `agent()` | ? | ? |
| `harness()` | ? | ? |
| `run()` | ? | ? |
| Recording | ? | ? |
| State | ? | ? |

### 2. Vitest Integration Plan

```
@open-harness/vitest
├── plugin.ts        - How to implement
├── reporter.ts      - How to implement
├── matchers.ts      - How to implement
└── index.ts         - Exports
```

### 3. Migration Path

What to:
- **Keep** (reuse as-is)
- **Adapt** (modify for new API)
- **Deprecate** (keep for backward compat)
- **Remove** (delete entirely)

### 4. Open Questions

Any blockers or decisions needed before implementation.

---

## Output Format

Create: `docs/internal/milestones/v0.2.0/DX_IMPLEMENTATION_RESEARCH.md`

Structure:
```markdown
# DX Implementation Research

## Executive Summary
[Key findings in 3-5 bullets]

## Codebase Analysis
### Entry Points
### Recording System
### State Management
### Eval System (Current)

## Vitest Capabilities
### Plugin System
### Custom Reporters
### Benchmarking

## Implementation Mapping
[Table mapping DX → implementation]

## Vitest Integration Design
[Concrete plan for @open-harness/vitest]

## Migration Path
[Keep/Adapt/Deprecate/Remove lists]

## Recommendations
[Prioritized next steps]

## Open Questions
[Blockers needing decisions]
```

---

## Constraints

- Do NOT implement anything yet - research only
- Do NOT change any code
- Focus on understanding, not solving
- Flag any conflicts between DX design and current implementation
- Be specific about file paths and function names
