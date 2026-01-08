# SDK DX Decisions

**Date:** 2026-01-08
**Status:** In Progress - Documenting decisions from DX design session
**Branch:** `v0.2.0/stabilization`

---

## Quick Summary

| Decision | Choice | Status |
|----------|--------|--------|
| Two Concerns | Running vs Evals/Benchmarks (separate) | ✅ Locked |
| Running API | `run()` - ONE way to run | ✅ Locked |
| Definition API | `agent()` + `harness()` | ✅ Locked |
| Eval Framework | Vitest (not custom) | ✅ Locked |
| Vitest Integration | Option C - Full plugin | ✅ Locked |
| State Importance | State is fundamental (Level 2) | ✅ Locked |
| Recording Level | Agent/Provider level (not harness) | ✅ Locked |
| Harness Role | Coordinator (coordinates agent recordings) | ✅ Locked |
| Naming | `agent` + `harness` (not `flow`) | ✅ Locked |

---

## Detailed Decisions

### 1. Two Separate Concerns ✅

**Decision:** Running and Evals/Benchmarks are two separate concerns.

- **Running** = Execute agent/harness → get output
- **Evals/Benchmarks** = Test quality + performance across cases/variants

They should have separate APIs. Running should work without eval framework.

---

### 2. ONE Way to Run ✅

**Decision:** Single `run()` function for all execution.

```typescript
import { run } from "@open-harness/core"

// Works with agent
const result = await run(agent, input)

// Works with harness
const result = await run(harness, input)

// With options
const result = await run(agent, input, { variant, record })
```

**Deprecates:**
- `runFlow()` → alias to `run()`
- `createHarness()` → internal only
- `createRuntime()` → internal only

---

### 3. Definition API: `agent()` + `harness()` ✅

**Decision:** Two definition functions with clear roles.

```typescript
import { agent, harness } from "@open-harness/core"

// Agent: single prompt, optionally stateful
const myAgent = agent({
  prompt: "...",
  state: { ... },  // optional
  output: { schema },  // optional
})

// Harness: coordinates agents + state + edges
const myHarness = harness({
  agents: [agent1, agent2],
  edges: [...],
  state: { ... },
})
```

**Naming rationale:**
- `agent` = the actor (has identity, makes decisions)
- `harness` = the coordinator/test rig (orchestrates agents)

**NOT `flow`** - flow is too generic and doesn't capture the orchestration role.

---

### 4. Eval Framework: Vitest ✅

**Decision:** Use vitest for all evals and benchmarks. Do NOT build custom eval runner.

**Rationale:**
- People already know vitest
- Vitest has benchmarking built in
- Consistent with TypeScript ecosystem
- No new mental model

**What we build:**
- `@open-harness/vitest` plugin
- Custom reporter for aggregation + gates
- Custom matchers (optional sugar)

**What we DON'T build:**
- Custom test runner
- `defineSuite()` / `runSuite()` (use vitest instead)

---

### 5. Vitest Integration: Option C (Full Plugin) ✅

**Decision:** Build full vitest integration from the start.

```typescript
// vitest.config.ts
import { openHarness } from "@open-harness/vitest"

export default {
  plugins: [openHarness()],
  test: {
    reporters: ["default", "@open-harness/vitest/reporter"],
  }
}
```

**Plugin provides:**
- Recording integration
- Aggregation reporter (pass rate, metrics)
- CI gates (fail if pass rate < threshold)
- Custom matchers (optional)

---

### 6. State is Fundamental ✅

**Decision:** State should be in early examples (Level 2), not late (Level 5).

**Rationale:**
- State is what makes an agent an agent
- Without state, it's just a function
- A trading agent, support agent, etc. are defined by their state
- Single agent with state > multiple stateless agents

**Example progression:**
- Level 1: Single agent (stateless) - just to show syntax
- Level 2: Agent WITH state - this is the key level
- Level 3+: Harness (multiple agents)

---

### 7. Recording Level: Agent/Provider ✅

**Decision:** Recording happens at agent/provider level, NOT harness level.

**Key insight:** The harness is a coordinator. It coordinates:
- Agent execution order
- State updates
- Edge decisions
- **Recording and playback of agents**

The harness doesn't GET recorded. It COORDINATES the recording of its agents.

```typescript
// Agent recording
run(agent, input, { record: "agent-session-1" })
// Records: that agent's LLM call(s)

// Harness coordinates agent recordings
run(harness, input, { record: "harness-session-1" })
// Coordinates recording of each agent
// Each agent's recording is separate
// Harness tracks which recordings belong together
```

---

### 8. Harness as Coordinator ✅

**Decision:** Harness role is coordination, not execution.

The harness:
- Owns shared state
- Decides which agent runs next (edges)
- Coordinates agent recordings
- Coordinates agent replays
- Does NOT "execute" - agents execute

```
Harness (coordinator)
    │
    ├── coordinates → Agent 1 (executes, records)
    │                    └── Provider (LLM call)
    │
    ├── updates state
    │
    ├── evaluates edges
    │
    └── coordinates → Agent 2 (executes, records)
                         └── Provider (LLM call)
```

---

## Open Questions

### Recording Architecture

**Question:** How exactly does the harness coordinate recordings?

Options discussed:
1. Provider records with hierarchical IDs (`harness-1/triage/0`)
2. Manifest file links separate agent recordings
3. Recording context passed through execution
4. Two systems (provider recording + execution trace)

**Status:** Not yet decided. Need to understand current implementation better.

---

### run() Return Shape

**Question:** What does `run()` return?

Proposed:
```typescript
{
  output: T,           // The result
  state: State,        // Final state (if stateful)
  latencyMs: number,   // Total latency
  cost: number,        // Total cost
  tokens: { input, output },
  recording?: string,  // Recording ID if recorded
}
```

**Status:** Not yet locked. Need to verify against implementation.

---

### Deprecation Path

**Question:** How do we deprecate existing APIs?

- `runFlow()` → alias to `run()`?
- `defineSuite()` → remove entirely?
- `withRecording()` → internal only?

**Status:** Not yet decided.

---

## What Needs Implementation

### New Packages

1. `@open-harness/vitest` - Vitest plugin
   - Reporter with aggregation + gates
   - Custom matchers
   - Recording integration

### API Changes

1. Add `run()` as unified entry point
2. Add `agent()` definition function
3. Add `harness()` definition function
4. State as first-class in agent definition

### Deprecations

1. `runFlow()` → alias or remove
2. `createHarness()` → internal
3. `createRuntime()` → internal
4. `defineSuite()` → remove (use vitest)
5. `runSuite()` → remove (use vitest)
6. `variant()` → remove (use vitest describe.each)

---

## Threaded Example Summary

| Level | What | Key Concept |
|-------|------|-------------|
| 1 | Single agent (stateless) | Basic syntax |
| 2 | Agent with state | **State is fundamental** |
| 3 | Harness with agents | Coordination |
| 4 | Conditional routing | Edge decisions |
| 5 | Iteration/loops | Refinement patterns |
| 6 | Full eval suite | Vitest integration |
| 7 | CI with gates | Production readiness |

---

*Updated 2026-01-08 - DX design session*
