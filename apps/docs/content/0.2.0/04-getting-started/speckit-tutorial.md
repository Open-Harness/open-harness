# SpecKit Tutorial

**Status:** Complete
**Purpose:** Progressive 7-level tutorial building a PRD-to-code workflow

---

## Overview

Learn Open Harness by building SpecKit: a PRD-to-code workflow that transforms product requirements into working implementations.

This tutorial progresses through 7 levels, each introducing new concepts:

| Level | Concept | What You Learn |
|-------|---------|----------------|
| 1 | Basic Agent | Create and run a single agent |
| 2 | Agent State | Track progress with typed state |
| 3 | Self-Validation | Agents that check their own work |
| 4 | Multi-Agent | Compose agents into workflows |
| 5 | Full Workflow | Spec → Code → Review pipeline |
| 6 | Fixtures | Record and replay for testing |
| 7 | CI Gates | Production-ready quality gates |

---

## Prerequisites

```bash
# Clone the repository
git clone https://github.com/open-harness/open-harness.git
cd open-harness

# Install dependencies
bun install

# Navigate to examples
cd examples/speckit
```

---

## Level 1: Basic Agent

**Goal:** Create and run a single agent with `agent()` and `run()`.

```typescript
import { agent, run, setDefaultProvider } from "@open-harness/core";
import { createClaudeNode } from "@open-harness/server";

// Configure the default provider
setDefaultProvider(createClaudeNode());

// Create a task executor agent
const taskExecutor = agent({
  prompt: `You are a task executor. Given a task, create a step-by-step
implementation plan. Be specific and actionable.`
});

// Run the agent
const result = await run(taskExecutor, {
  prompt: "Implement a function that validates email addresses"
});

console.log(result.output);
console.log(`Latency: ${result.metrics.latencyMs}ms`);
```

**Key concepts:**
- `agent()` creates an agent from configuration
- `run()` executes an agent with input
- Results include output and metrics (latency, cost, tokens)

**Source:** [`examples/speckit/level-1/`](https://github.com/open-harness/open-harness/tree/master/examples/speckit/level-1)

---

## Level 2: Agent State

**Goal:** Add typed state to track agent progress across interactions.

```typescript
interface TaskExecutorState {
  tasksProcessed: number;
  totalTokensUsed: number;
  [key: string]: unknown;
}

const taskExecutor = agent({
  prompt: `You are a task executor...`,
  state: {
    tasksProcessed: 0,
    totalTokensUsed: 0,
  } as TaskExecutorState,
});

const result = await run(taskExecutor, { prompt: "Build a login form" });

// State is returned with the result
console.log(`Tasks processed: ${result.state?.tasksProcessed}`);
```

**Key concepts:**
- Agents can maintain typed state
- State persists across agent lifecycle
- Results include final state snapshot

**Source:** [`examples/speckit/level-2/`](https://github.com/open-harness/open-harness/tree/master/examples/speckit/level-2)

---

## Level 3: Self-Validation

**Goal:** Create agents that validate their own output.

```typescript
const codingAgent = agent({
  prompt: `You write code. After writing code, validate it:

1. Write the implementation
2. Self-validate against acceptance criteria
3. Report validation status

Output format:
## IMPLEMENTATION
[Your code here]

## SELF_VALIDATION
- Criterion 1: PASS/FAIL
- Criterion 2: PASS/FAIL

## STATUS
VALIDATED or NEEDS_REVISION`,
});

// Parse and check validation status
const parsed = parseCodingOutput(result.output);
if (parsed.status === "validated") {
  console.log("Code passes self-validation!");
}
```

**Key concepts:**
- Structured output formats enable parsing
- Self-validation catches issues early
- Agent prompts can include validation rules

**Source:** [`examples/speckit/level-3/`](https://github.com/open-harness/open-harness/tree/master/examples/speckit/level-3)

---

## Level 4: Multi-Agent Workflows

**Goal:** Compose multiple agents into a workflow with `harness()`.

```typescript
import { harness } from "@open-harness/core";
import { specAgent } from "./spec-agent";
import { codingAgent } from "./coding-agent";

const specKit = harness({
  agents: {
    spec: specAgent,
    coder: codingAgent,
  },
  edges: [
    { from: "START", to: "spec" },
    { from: "spec", to: "coder" },
    { from: "coder", to: "END" },
  ],
});

// Run the workflow
const result = await run(specKit, {
  prompt: "PRD: Create an email validator function"
});
```

**Key concepts:**
- `harness()` composes agents into workflows
- Edges define execution order
- START and END are special nodes
- Output flows through the pipeline

**Source:** [`examples/speckit/level-4/`](https://github.com/open-harness/open-harness/tree/master/examples/speckit/level-4)

---

## Level 5: Full Workflow

**Goal:** Build a complete Spec → Code → Review pipeline.

```typescript
const specKit = harness({
  agents: {
    spec: specAgent,      // Analyzes PRD, creates tasks
    coder: codingAgent,   // Implements tasks
    reviewer: reviewerAgent, // Reviews and approves
  },
  edges: [
    { from: "START", to: "spec" },
    { from: "spec", to: "coder" },
    { from: "coder", to: "reviewer" },
    { from: "reviewer", to: "END" },
  ],
});

const result = await run(specKit, {
  prompt: `PRD: User Authentication System

Requirements:
- Validate email format
- Check password strength
- Return validation result`
});

// Parse reviewer output
const review = parseReviewerOutput(result.output);
console.log(`Approved: ${review.approved}`);
console.log(`Confidence: ${review.confidence}%`);
```

**Key concepts:**
- Three-agent pipeline: Spec → Code → Review
- Each agent has specialized responsibilities
- Final output includes review decision

**Source:** [`examples/speckit/level-5/`](https://github.com/open-harness/open-harness/tree/master/examples/speckit/level-5)

---

## Level 6: Fixtures

**Goal:** Record and replay agent responses for testing.

```typescript
import { FileRecordingStore } from "@open-harness/stores";

// Create a fixture store
const store = new FileRecordingStore({ directory: "./fixtures" });

// RECORD mode: Execute live, save responses
// Run with: FIXTURE_MODE=record bun test
const result = await run(specKit, { prompt: "..." }, {
  fixture: "my-test",
  store,
  // mode determined by FIXTURE_MODE env var
});

// REPLAY mode: Load saved responses (no API calls)
// Run with: FIXTURE_MODE=replay bun test
```

**Key concepts:**
- Fixtures enable deterministic testing
- Record once, replay in CI
- No API calls during replay (fast, free)
- Commit fixtures to git for reproducibility

**Fixture modes:**
- `live` (default): Execute normally, no recording
- `record`: Execute and save responses
- `replay`: Load from saved responses

**Source:** [`examples/speckit/level-6/`](https://github.com/open-harness/open-harness/tree/master/examples/speckit/level-6)

---

## Level 7: CI Gates

**Goal:** Add production-ready quality gates.

```typescript
describe("SpecKit CI", () => {
  it("meets quality gates", async () => {
    const result = await run(specKit, { prompt: "..." });

    // Parse review output
    const review = parseReviewerOutput(result.output);

    // Quality gates
    expect(review.approved).toBe(true);
    expect(review.confidence).toBeGreaterThanOrEqual(80);

    // Performance gates
    expect(result.metrics.latencyMs).toBeLessThan(120000);
    expect(result.metrics.cost).toBeLessThan(1.0);
  });
});
```

**Key concepts:**
- CI tests validate agent quality
- Gates ensure minimum confidence levels
- Performance budgets prevent regression
- Combine with fixtures for fast CI

**Source:** [`examples/speckit/level-7/`](https://github.com/open-harness/open-harness/tree/master/examples/speckit/level-7)

---

## Running the Examples

```bash
# Run all levels (live API calls)
cd examples/speckit
bun run test:live

# Run specific level
bun run test:live -- level-1/

# Record fixtures (run once)
bun run test:record -- level-6/

# Replay fixtures (CI mode)
bun run test:replay -- level-6/
```

---

## Next Steps

After completing this tutorial:

1. **Explore patterns:** Read [Evals Pattern](../03-patterns/evals-pattern.md) for testing strategies
2. **Understand architecture:** Read [Architecture](../02-architecture/architecture.md) for internals
3. **Build your own:** Create a custom workflow for your use case
4. **Contribute:** Read [Contributing](../05-reference/contributing.md) to help improve Open Harness

---

## Summary

You've learned:

- **Level 1:** Create agents with `agent()` and `run()`
- **Level 2:** Track state with typed interfaces
- **Level 3:** Self-validation patterns
- **Level 4:** Compose with `harness()`
- **Level 5:** Full multi-agent pipelines
- **Level 6:** Record/replay fixtures
- **Level 7:** CI quality gates

These concepts form the foundation for building production-grade agentic workflows with Open Harness.
