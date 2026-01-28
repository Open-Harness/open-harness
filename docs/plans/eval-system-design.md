# Eval System Design

> Design document for OpenScaffold's evaluation and benchmarking system.
> Date: 2026-01-28
> Updated: 2026-01-28 (Agent-owns-provider DX, Session Operations)

---

## Terminology

Precise language for implementation clarity:

| Term | Definition |
|------|------------|
| **Session** | A complete workflow execution. Has a `sessionId`. All events persisted in EventStore. |
| **Tape** | Metaphor for session — the sequence of events over time. |
| **Seek** | Find a specific point in a session's event history. |
| **Fork** | Create a new session that starts from a specific point in another session. The child session stores copied state and records its lineage. |
| **Score** | Apply scorer functions to a session's final state/events. No execution — read-only. |
| **Replay** | Re-execute a session using recorded LLM responses from ProviderRecorder. Deterministic output. |
| **Variant** | A workflow definition with specific agents. Created via `workflow.with()`. |
| **Scorer** | A function that grades a session and returns a Score. Fundamental primitive. |
| **Eval** | Orchestration layer that runs/forks multiple variants, scores them, and reports results. |

---

## Problem

You build a workflow. You want to know: **which model, prompt strategy, or configuration produces the best results?** Today, the only way to answer that is to run the workflow manually, eyeball the output, and guess. There's no systematic way to compare models, measure quality, or detect regressions.

## Goal

A CLI command (`scaffold eval`) that:

1. Runs workflow **variants** N times across a matrix of inputs
2. Scores each run using pluggable scorers (programmatic checks, LLM-as-judge)
3. Reports results as a terminal table, JSON, and/or Markdown

Built entirely on existing infrastructure. No new runtime primitives.

---

## Design Decision: Agent Owns Provider

**Agents embed their provider directly.** No string-based model resolution. No separate `providers` mapping at runtime.

```typescript
// Provider is part of the agent definition
const planner = agent({
  name: "planner",
  provider: Anthropic({ model: "claude-sonnet-4-5" }),  // ← Direct ownership
  output: PlanSchema,
  prompt: (state) => `Decompose: ${state.goal}`,
  update: (output, draft) => { draft.tasks = output.tasks },
})
```

**For evals, create variants via `workflow.with()`:**

```typescript
// Base workflow uses Sonnet
const myWorkflow = workflow({ ... })

// Variant with Opus planner
const withOpus = myWorkflow.with({
  agents: { planner: { ...planner, provider: Anthropic({ model: "claude-opus-4-5" }) } }
})

// Variant with different prompt
const withPromptV2 = myWorkflow.with({
  agents: { planner: { ...planner, prompt: (s) => `You are an expert. ${s.goal}` } }
})
```

This keeps agent definitions self-contained while enabling easy variation for evaluation.

---

## The `workflow.with()` API

`workflow.with()` creates a new workflow definition with agent overrides. The original workflow is unchanged.

```typescript
// Base workflow
const myWorkflow = workflow({
  name: "api-builder",
  initialState: { goal: "", tasks: [], code: "" },
  start: (input, draft) => { draft.goal = input },
  phases: {
    planning: { run: planner, next: "coding" },
    coding: { run: coder, next: "done" },
    done: phase.terminal()
  }
})

// Create variant — overrides agents by name
const variant = myWorkflow.with({
  agents: {
    // Override planner agent entirely
    planner: { ...planner, provider: opus },

    // Override just the prompt (keeps other properties)
    coder: { ...coder, prompt: (s) => `Write clean code for: ${s.tasks.join(", ")}` }
  }
})

// Can chain .with() calls for incremental changes
const variantV2 = variant.with({
  agents: {
    planner: { ...planner, provider: opus }
  }
})
```

**What you can vary:**

| Property | Example |
|----------|---------|
| Provider (model) | `{ ...agent, provider: Anthropic({ model: "claude-opus-4-5" }) }` |
| Prompt | `{ ...agent, prompt: (s) => "New prompt..." }` |
| Output schema | `{ ...agent, output: z.object({ ... }) }` |
| Update function | `{ ...agent, update: (o, d) => { ... } }` |
| Provider options | `{ ...agent, options: { temperature: 0.5, tools: [...] } }` |

**Why spread (`...agent`) is required:**

Agent definitions are immutable objects. To override one property, you spread the original and override the specific field. This makes the change explicit and type-safe.

```typescript
// Good: explicit about what changes
const plannerV2 = { ...planner, provider: opus }

// Also good: multiple overrides
const plannerV3 = { ...planner, provider: opus, prompt: newPrompt }
```

---

## Core Concept: The Eval Matrix

An eval is a **matrix of runs**. You define:

- **Variants**: workflow variants created via `workflow.with()` (different models, prompts, parameters)
- **Input dataset**: one or more inputs to test against
- **Trials**: how many times to repeat each combination (for variance measurement)
- **Scorers**: functions that grade each run's output

```
                    ┌─────────────┐
                    │  Eval Suite  │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         Input "A"    Input "B"    Input "C"
              │            │            │
        ┌─────┴─────┐     ...         ...
        ▼           ▼
   sonnet-v1    opus-v2      ← workflow variants
        │           │
    ┌───┴───┐   ┌───┴───┐
    ▼       ▼   ▼       ▼
  trial 1  t2  trial 1  t2
    │       │   │       │
    ▼       ▼   ▼       ▼
  score   score score  score
```

Each leaf node is one `run()` call. The eval runner collects all results and compares.

---

## Two Comparison Modes

### Mode 1: Full Run (default)

Run the entire workflow from scratch with different variants.

```typescript
// ─────────────────────────────────────────────────────────────────
// Base workflow with production agents
// ─────────────────────────────────────────────────────────────────

const sonnet = Anthropic({ model: "claude-sonnet-4-5" })
const opus = Anthropic({ model: "claude-opus-4-5" })
const gpt4o = OpenAI({ model: "gpt-4o" })

const planner = agent({
  name: "planner",
  provider: sonnet,
  output: PlanSchema,
  prompt: (state) => `Decompose: ${state.goal}`,
  update: (output, draft) => { draft.tasks = output.tasks },
})

const myWorkflow = workflow({
  name: "api-builder",
  initialState: { goal: "", tasks: [], code: "" },
  start: (input, draft) => { draft.goal = input },
  phases: {
    planning: { run: planner, next: "coding" },
    coding: { run: coder, next: "done" },
    done: phase.terminal()
  }
})

// ─────────────────────────────────────────────────────────────────
// Create variants for evaluation
// ─────────────────────────────────────────────────────────────────

// Variant: Opus planner
const withOpusPlanner = myWorkflow.with({
  agents: { planner: { ...planner, provider: opus } }
})

// Variant: GPT-4o planner
const withGPTPlanner = myWorkflow.with({
  agents: { planner: { ...planner, provider: gpt4o } }
})

// Each run is independent — Model A's planner might output a different
// plan than Model B's, so downstream agents get different prompts.
await run(myWorkflow, { input: "Build a REST API" })
await run(withOpusPlanner, { input: "Build a REST API" })
await run(withGPTPlanner, { input: "Build a REST API" })
```

**Answers**: "If I swap Sonnet for Opus in production, will my workflow produce better end-to-end results?"

### Mode 2: Fork from Existing Session

Load state from an existing session at a specific point, then continue with different variants.

```typescript
// Step 1: Run base workflow — session saved to EventStore
const baseline = await run(myWorkflow, { input: "Build a REST API" })
// baseline.sessionId = "abc-123"
// All events persisted, state computable at any point

// Step 2: Fork from that session with different coder variants
const opusCoderVariant = myWorkflow.with({
  agents: { coder: { ...coder, provider: opus } }
})
const gptCoderVariant = myWorkflow.with({
  agents: { coder: { ...coder, provider: gpt4o } }
})

const resultA = await fork({
  from: baseline.sessionId,
  at: { phase: "coding", occurrence: "first" },  // Explicit: first entry to coding
  workflow: opusCoderVariant,
  input: "Build a REST API",
})

const resultB = await fork({
  from: baseline.sessionId,
  at: { phase: "coding", occurrence: "first" },
  workflow: gptCoderVariant,
  input: "Build a REST API",
})
```

Both forks see the **exact same state** at the start of the "coding" phase. The state is loaded from EventStore (not passed as a raw object). Each fork creates a new session that records its parent lineage.

**Answers**: "Given the same plan, does Opus write better code than Sonnet?"

### Why Two Modes

| | Full Run | Fork |
|---|---|---|
| What varies | Everything downstream of agent changes | Only output from the fork point onward |
| Realism | High — production conditions | Controlled — isolates one phase |
| Use case | "Best overall model for my workflow" | "Best model for this specific task" |
| Infrastructure | `run(variant, { input })` | `fork({ from, at, workflow })` |
| Session lineage | Independent sessions | Child sessions reference parent |

Both modes create sessions in EventStore. Fork builds on top of run — it loads state, then calls run internally.

---

## Eval Config Format

The eval is defined as a TypeScript file (not YAML — keeps type safety and allows importing the workflow directly).

```typescript
// evals/api-builder.eval.ts
import { defineEval } from "@open-scaffold/eval"
import { Anthropic, OpenAI } from "@open-scaffold/core"
import { apiBuilderWorkflow, planner, coder } from "../workflows/api-builder"

// ─────────────────────────────────────────────────────────────────
// Create providers
// ─────────────────────────────────────────────────────────────────

const sonnet = Anthropic({ model: "claude-sonnet-4-5" })
const opus = Anthropic({ model: "claude-opus-4-5" })
const gpt4o = OpenAI({ model: "gpt-4o" })

// ─────────────────────────────────────────────────────────────────
// Create workflow variants
// ─────────────────────────────────────────────────────────────────

const variants = {
  // Model variants for planner
  "sonnet-planner": apiBuilderWorkflow,  // baseline uses sonnet
  "opus-planner": apiBuilderWorkflow.with({
    agents: { planner: { ...planner, provider: opus } }
  }),
  "gpt4o-planner": apiBuilderWorkflow.with({
    agents: { planner: { ...planner, provider: gpt4o } }
  }),

  // Prompt variant
  "sonnet-planner-v2": apiBuilderWorkflow.with({
    agents: {
      planner: {
        ...planner,
        prompt: (state) => `You are an expert API architect. Goal: ${state.goal}. Be thorough.`
      }
    }
  }),

  // Combined: different model + different prompt
  "opus-planner-v2": apiBuilderWorkflow.with({
    agents: {
      planner: {
        ...planner,
        provider: opus,
        prompt: (state) => `You are an expert API architect. Goal: ${state.goal}. Be thorough.`
      }
    }
  }),
}

// ─────────────────────────────────────────────────────────────────
// Define eval
// ─────────────────────────────────────────────────────────────────

export default defineEval({
  name: "api-builder-planner-comparison",

  // Variants to compare
  variants,

  // Dataset: one or more inputs
  dataset: [
    { input: "Build a REST API for a todo app" },
    { input: "Build a GraphQL API for a blog" },
    { input: "Build a WebSocket chat server" },
  ],

  // How many times to run each (variant, input) combination
  trials: 3,

  // Scoring functions
  scorers: [
    outputValid(),       // Did workflow complete without error?
    latencyUnder(5000),  // Did it finish in under 5 seconds?
    costUnder(0.10),     // Did it cost less than $0.10?
    custom("plan-quality", (result) => {
      // Grade plan completeness: 0.0 to 1.0
      const tasks = result.state.tasks
      const hasCRUD = tasks.some(t => t.includes("CRUD")) ? 0.3 : 0
      const hasAuth = tasks.some(t => t.includes("auth")) ? 0.3 : 0
      const hasTests = tasks.some(t => t.includes("test")) ? 0.4 : 0
      return hasCRUD + hasAuth + hasTests
    }),
  ],
})
```

### Fork-Based Eval

For isolating a specific agent's performance, fork from an existing session:

```typescript
// evals/coder-comparison.eval.ts
import { defineEval } from "@open-scaffold/eval"
import { Anthropic, OpenAI } from "@open-scaffold/core"
import { apiBuilderWorkflow, coder } from "../workflows/api-builder"

// Variants: different models for the coder agent only
const variants = {
  "sonnet-coder": apiBuilderWorkflow,
  "opus-coder": apiBuilderWorkflow.with({
    agents: { coder: { ...coder, provider: Anthropic({ model: "claude-opus-4-5" }) } }
  }),
  "gpt4o-coder": apiBuilderWorkflow.with({
    agents: { coder: { ...coder, provider: OpenAI({ model: "gpt-4o" }) } }
  }),
}

export default defineEval({
  name: "coder-comparison",
  variants,

  // Fork from an existing session — all variants see identical state
  forkFrom: {
    session: "abc-123",                              // Parent session ID
    at: { phase: "coding", occurrence: "first" },   // Must be explicit
  },

  // Original input (must match parent session's input)
  dataset: [
    { input: "Build a REST API for a todo app" },
  ],

  trials: 3,
  scorers: [
    outputValid(),
    custom("code-quality", (result) => {
      const code = result.state.code
      const hasErrorHandling = code.includes("try") ? 0.3 : 0
      const hasTypes = code.includes("interface") || code.includes("type") ? 0.3 : 0
      const hasTests = code.includes("test") || code.includes("describe") ? 0.4 : 0
      return hasErrorHandling + hasTypes + hasTests
    }),
  ],
})
```

**Key difference from full run:** All variants fork from the same parent session at the same point. They all see identical state. This isolates the coder agent's performance from variation in the planner.

---

## CLI Interface

```bash
# Run an eval suite
scaffold eval ./evals/api-builder.eval.ts

# Options
scaffold eval ./evals/api-builder.eval.ts \
  --trials 5 \                    # Override trial count
  --format table,json,markdown \  # Output formats (default: table)
  --output ./eval-results/ \      # Directory for JSON/Markdown output
  --parallel 2 \                  # Max concurrent runs (default: 1)
  --filter "opus-*" \             # Only run matching variant names
  --database :memory:             # Use in-memory DB (default)
```

### Terminal Table Output

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Eval: api-builder-planner-comparison      3 inputs × 5 variants × 3t    │
├────────────────────┬────────────┬──────────┬──────────┬──────────────────┤
│ Variant            │ output-ok  │ latency  │ cost     │ plan-quality     │
├────────────────────┼────────────┼──────────┼──────────┼──────────────────┤
│ sonnet-planner     │ 9/9 (100%) │ 2.1s avg │ $0.04    │ 0.63 ± 0.12     │
│ opus-planner       │ 9/9 (100%) │ 4.7s avg │ $0.12    │ 0.89 ± 0.05     │
│ gpt4o-planner      │ 7/9 (78%)  │ 3.2s avg │ $0.07    │ 0.71 ± 0.18     │
│ sonnet-planner-v2  │ 9/9 (100%) │ 2.3s avg │ $0.05    │ 0.78 ± 0.08     │
│ opus-planner-v2    │ 9/9 (100%) │ 5.1s avg │ $0.14    │ 0.94 ± 0.03     │
└────────────────────┴────────────┴──────────┴──────────┴──────────────────┘
  Best: opus-planner-v2 (highest plan-quality 0.94, lowest variance ±0.03)
  Cheapest: sonnet-planner ($0.04 avg)
  Fastest: sonnet-planner (2.1s avg)
```

### JSON Output

```json
{
  "eval": "api-builder-planner-comparison",
  "timestamp": "2026-01-28T12:00:00Z",
  "config": {
    "trials": 3,
    "inputs": 3,
    "variants": ["sonnet-planner", "opus-planner", "gpt4o-planner", "sonnet-planner-v2", "opus-planner-v2"]
  },
  "results": [
    {
      "variant": "sonnet-planner",
      "input": "Build a REST API for a todo app",
      "trial": 0,
      "scores": {
        "output-valid": { "pass": true, "value": 1.0 },
        "latency": { "pass": true, "value": 2134, "unit": "ms" },
        "cost": { "pass": true, "value": 0.038, "unit": "usd" },
        "plan-quality": { "pass": true, "value": 0.65 }
      },
      "durationMs": 2134,
      "events": 12,
      "sessionId": "abc-123"
    },
    {
      "variant": "opus-planner-v2",
      "input": "Build a REST API for a todo app",
      "trial": 0,
      "scores": {
        "output-valid": { "pass": true, "value": 1.0 },
        "latency": { "pass": true, "value": 5021, "unit": "ms" },
        "cost": { "pass": false, "value": 0.142, "unit": "usd" },
        "plan-quality": { "pass": true, "value": 0.95 }
      },
      "durationMs": 5021,
      "events": 18,
      "sessionId": "def-456"
    }
  ],
  "summary": {
    "sonnet-planner": {
      "passRate": 1.0,
      "avgLatency": 2100,
      "avgCost": 0.04,
      "scores": { "plan-quality": { "mean": 0.63, "stddev": 0.12 } }
    },
    "opus-planner-v2": {
      "passRate": 0.89,
      "avgLatency": 5100,
      "avgCost": 0.14,
      "scores": { "plan-quality": { "mean": 0.94, "stddev": 0.03 } }
    }
  }
}
```

---

## System Architecture

### The Three Layers

The eval system is built in layers. Each layer builds on the one below it. **Eval is NOT a separate execution system — it's orchestration over existing primitives.**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 3: Eval Orchestration                                            │
│  ─────────────────────────────────────────────────────────────────────  │
│  Pure syntactic sugar. Loops over variants/inputs, formats results.     │
│                                                                          │
│  scaffold eval run    → calls run() N times                             │
│  scaffold eval fork   → calls fork() then run()                         │
│  scaffold eval score  → calls score() on existing sessions              │
│  scaffold eval compare → loads sessions, formats comparison table       │
└────────────────────────────────────────────────────────┬────────────────┘
                                                         │
                                                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 2: Session Operations                                            │
│  ─────────────────────────────────────────────────────────────────────  │
│  General-purpose primitives for working with persisted sessions.        │
│  NOT eval-specific — these are useful for debugging, testing, etc.      │
│                                                                          │
│  fork(sessionId, atPoint)  → load state from DB, continue execution     │
│  score(sessionId, scorers) → apply scorers to session, no execution     │
│  replay(sessionId)         → re-execute with recorded LLM responses     │
└────────────────────────────────────────────────────────┬────────────────┘
                                                         │
                                                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 1: Core Execution (exists today)                                 │
│  ─────────────────────────────────────────────────────────────────────  │
│  The foundation. Everything builds on this.                              │
│                                                                          │
│  run(workflow, { input })  → execute workflow → save to EventStore      │
│  EventStore                → persists all events                         │
│  ProviderRecorder          → records LLM request/response streams       │
│  computeStateAt(events, N) → reconstruct state at any point             │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key principle:** There is ONE execution path (`run()`). Layer 2 and Layer 3 compose this primitive — they don't create parallel execution systems.

---

## Important: Our Events vs SDK Internal State

**Critical distinction that must be understood:**

The LLM SDKs (Anthropic, OpenAI, etc.) manage their own internal state:
- Message history
- Tool call sequences
- Conversation context
- Internal session IDs

**Our events are for OUR records.** They capture what happened from our perspective (agent started, agent completed, state updated, etc.) but they are NOT the actual state inside the SDK.

When we **fork** a session:
1. We load our state from EventStore (via `computeStateAt`)
2. We create a NEW SDK session (fresh message history)
3. The agent's `prompt(state)` function generates a fresh prompt from the loaded state
4. The SDK sees this as a new conversation

This means:
- Forking doesn't "resume" the SDK's conversation — it starts fresh with computed state
- The prompt function is the bridge between our state and the SDK
- This is correct behavior — the SDK doesn't need to know about forking

**When multiple agents are active at fork time:**
- All active agents must be paused
- Each agent has its own SDK session ID
- When resuming/forking, each agent gets a fresh SDK session
- The state captures what we need; the SDK sessions are ephemeral

---

## Session Operations (Layer 2)

These are general-purpose primitives, NOT eval-specific. They're useful for:
- Debugging (replay a failed run)
- Testing (deterministic replay)
- Experimentation (fork and try different approaches)
- Evaluation (compare multiple forks)

### Fork

Load state from an existing session at a specific point, then continue execution with a (potentially different) workflow variant.

```typescript
const forkedSession = await fork({
  from: "abc-123",           // Parent session ID
  at: { phase: "coding", occurrence: "first" },  // MUST be explicit
  workflow: opusCoderVariant,
  input: originalInput,      // Same input as parent
})
// Returns a new session with parentSessionId = "abc-123"
```

**Fork point specification (must be explicit, no magic defaults):**

| Syntax | Meaning |
|--------|---------|
| `{ phase: "coding", occurrence: "first" }` | First time workflow entered "coding" phase |
| `{ phase: "coding", occurrence: "last" }` | Last time workflow entered "coding" phase |
| `{ phase: "coding", occurrence: 2 }` | Second time workflow entered "coding" phase |
| `{ eventIndex: 47 }` | Exact event index (most precise) |
| `{ where: (state) => state.tasks.length > 5 }` | First point where predicate is true |

**Why explicit occurrence is required:**

Phases are non-linear. A workflow might go:
```
planning → review → planning → review → coding → verification → planning → coding → done
```

Saying "fork at coding" is ambiguous — which one? The API forces you to be explicit: `"first"`, `"last"`, or a specific occurrence number.

**What fork stores:**

```typescript
// The forked session stores:
{
  sessionId: "def-456",
  parentSessionId: "abc-123",     // Lineage tracking
  forkPoint: { eventIndex: 47 },  // Where we forked
  initialState: { ... },          // Copied state at fork point
  events: [ /* only events from fork point onward */ ]
}
```

The forked session is **self-contained**. Deleting the parent doesn't break the child.

### Score

Apply scorer functions to an existing session. **No execution — just load and grade.**

```typescript
const scores = await score({
  session: "abc-123",
  scorers: [outputValid(), planQuality(), costUnder(0.10)],
})
// Returns: { scores: [...], state, events }
```

This is powerful because:
- You wrote a new scorer? Apply it to all historical sessions.
- Tweak scorer logic? Re-score without re-running (saves API costs).

### Replay

Re-execute a session using recorded LLM responses from ProviderRecorder. **Deterministic output.**

```typescript
const replayed = await replay("abc-123")
// Uses ProviderModeContext: "playback"
// Should produce identical results every time
```

This is for **testing** — verify the workflow still produces the same output given the same inputs.

---

## Scorers (Fundamental Primitive)

Scorers are the core abstraction for grading workflow outputs. They receive a session's final state and events, and return a score.

### Scorer Interface

```typescript
interface ScorerContext<S> {
  readonly state: S                          // Final workflow state
  readonly events: ReadonlyArray<AnyEvent>   // All events from the session
  readonly durationMs: number                // Total execution time
  readonly sessionId: string                 // Session identifier
  readonly variantName?: string              // If run as part of eval
}

interface Score {
  readonly name: string          // Scorer name (e.g., "plan-quality")
  readonly pass: boolean         // Did it pass the threshold?
  readonly value: number         // Numeric score (0.0 to 1.0, or raw metric)
  readonly unit?: string         // Optional unit (e.g., "ms", "usd")
  readonly detail?: string       // Optional explanation
}

type Scorer<S> = {
  readonly name: string
  readonly score: (ctx: ScorerContext<S>) => Score | Promise<Score>
}
```

### Why Scorers Are Fundamental

Scorers are not eval-specific. They're useful whenever you need to grade a session:
- Eval: Compare variants using scorers
- Testing: Assert scorer passes in CI
- Monitoring: Track scorer values over time in production
- Debugging: Quickly check if a session meets quality criteria

---

## Eval Orchestration (Layer 3)

The eval CLI commands are **pure orchestration**. They don't add new capabilities — they compose Layer 1 and Layer 2 primitives.

### `scaffold eval run`

```bash
scaffold eval run ./evals/planner.eval.ts
```

Equivalent to:
```typescript
for (const [variantName, variant] of Object.entries(config.variants)) {
  for (const input of config.dataset) {
    for (let trial = 0; trial < config.trials; trial++) {
      const session = await run(variant, {
        input: input.input,
        tags: { variant: variantName, trial, evalName: config.name }
      })
      const scores = await score({ session: session.id, scorers: config.scorers })
      results.push({ variantName, input, trial, scores, session })
    }
  }
}
formatResults(results)
```

### `scaffold eval fork`

```bash
scaffold eval fork ./evals/coder.eval.ts --from abc-123 --at-phase coding --occurrence first
```

Equivalent to:
```typescript
for (const [variantName, variant] of Object.entries(config.variants)) {
  const session = await fork({
    from: "abc-123",
    at: { phase: "coding", occurrence: "first" },
    workflow: variant,
    input: originalInput,
  })
  const scores = await score({ session: session.id, scorers: config.scorers })
  results.push({ variantName, scores, session })
}
formatResults(results)
```

### `scaffold eval score`

```bash
scaffold eval score --sessions abc-123,def-456,ghi-789 --scorers ./scorers/quality.ts
```

Equivalent to:
```typescript
for (const sessionId of sessionIds) {
  const scores = await score({ session: sessionId, scorers })
  results.push({ sessionId, scores })
}
formatResults(results)
```

**No execution. Just load sessions from DB and apply scorers.**

---

## Package Structure

```
packages/eval/
  src/
    index.ts              # Public API exports
    define.ts             # defineEval() config builder
    runner.ts             # EvalRunner: orchestrates matrix execution
    scorers/
      index.ts            # Built-in scorer exports
      output-valid.ts     # Schema validation scorer
      latency.ts          # Latency threshold scorer
      cost.ts             # Cost threshold scorer
      llm-judge.ts        # LLM-as-judge scorer (future)
    reporters/
      index.ts            # Reporter exports
      table.ts            # Terminal table output
      json.ts             # JSON file output
      markdown.ts         # Markdown file output
    types.ts              # EvalConfig, EvalResult, Score types
  test/
    runner.test.ts
    scorers.test.ts
```

Note: `fork()`, `score()`, `replay()` live in `packages/core` — they're general session operations, not eval-specific.

### Key Types

```typescript
// ── Eval Config ─────────────────────────────────────────

interface EvalConfig<S, Input> {
  /** Human-readable name for this eval */
  readonly name: string

  /** Workflow variants to compare (created via workflow.with()) */
  readonly variants: Record<string, WorkflowDef<S, Input>>

  /** Inputs to test each variant against */
  readonly dataset: ReadonlyArray<EvalInput<Input>>

  /** Number of trials per (variant, input) combination */
  readonly trials: number

  /** Scoring functions to grade each run */
  readonly scorers: ReadonlyArray<Scorer<S>>

  /** Optional: fork from existing session instead of running fresh */
  readonly forkFrom?: ForkPoint
}

interface EvalInput<Input> {
  readonly input: Input
  readonly label?: string              // Human-readable label for reports
}

// ── Fork Point Specification ────────────────────────────

type ForkPoint = {
  readonly session: string             // Parent session ID
  readonly at: ForkAt                  // Where to fork (must be explicit)
}

type ForkAt =
  | { phase: string; occurrence: "first" | "last" | number }
  | { eventIndex: number }
  | { where: (state: unknown) => boolean }

// ── Session Operations (Layer 2) ────────────────────────

interface ForkOptions {
  readonly from: string                // Parent session ID
  readonly at: ForkAt                  // Fork point (explicit)
  readonly workflow: WorkflowDef       // Variant to run from fork point
  readonly input: unknown              // Original input
}

interface ScoreOptions {
  readonly session: string             // Session ID to score
  readonly scorers: ReadonlyArray<Scorer<unknown>>
}

// ── Eval Results ────────────────────────────────────────

interface EvalRunResult<S> {
  readonly variant: string             // Variant name from config
  readonly input: EvalInput<unknown>
  readonly trial: number
  readonly scores: ReadonlyArray<Score>
  readonly durationMs: number
  readonly sessionId: string
  readonly parentSessionId?: string    // If forked
  readonly state: S
}

interface EvalSummary {
  readonly variant: string             // Variant name
  readonly passRate: number            // 0.0 to 1.0
  readonly avgDuration: number         // ms
  readonly scores: Record<string, {
    readonly mean: number
    readonly stddev: number
    readonly min: number
    readonly max: number
  }>
}

interface EvalReport<S> {
  readonly config: {
    readonly evalName: string
    readonly trials: number
    readonly inputCount: number
    readonly variants: ReadonlyArray<string>
    readonly forkFrom?: ForkPoint      // If fork-based eval
  }
  readonly results: ReadonlyArray<EvalRunResult<S>>
  readonly summaries: ReadonlyArray<EvalSummary>
  readonly timestamp: Date
}
```

---

## Common Variant Patterns

### Compare Models for One Agent

```typescript
const variants = {
  "sonnet": baseWorkflow,
  "opus": baseWorkflow.with({ agents: { planner: { ...planner, provider: opus } } }),
  "gpt4o": baseWorkflow.with({ agents: { planner: { ...planner, provider: gpt4o } } }),
}
```

### Compare Prompts (Same Model)

```typescript
const promptV1 = (s) => `Plan tasks for: ${s.goal}`
const promptV2 = (s) => `You are a senior architect. Break down: ${s.goal}`
const promptV3 = (s) => `${s.goal}\n\nProvide 5-10 actionable tasks.`

const variants = {
  "prompt-v1": baseWorkflow,
  "prompt-v2": baseWorkflow.with({ agents: { planner: { ...planner, prompt: promptV2 } } }),
  "prompt-v3": baseWorkflow.with({ agents: { planner: { ...planner, prompt: promptV3 } } }),
}
```

### Compare Models × Prompts (Full Matrix)

```typescript
const models = { sonnet, opus, gpt4o }
const prompts = { v1: promptV1, v2: promptV2 }

const variants = Object.fromEntries(
  Object.entries(models).flatMap(([modelName, provider]) =>
    Object.entries(prompts).map(([promptName, prompt]) => [
      `${modelName}-${promptName}`,
      baseWorkflow.with({
        agents: { planner: { ...planner, provider, prompt } }
      })
    ])
  )
)
// → { "sonnet-v1", "sonnet-v2", "opus-v1", "opus-v2", "gpt4o-v1", "gpt4o-v2" }
```

### Compare Multiple Agents

```typescript
const variants = {
  "baseline": baseWorkflow,
  "better-planner": baseWorkflow.with({
    agents: { planner: { ...planner, provider: opus } }
  }),
  "better-coder": baseWorkflow.with({
    agents: { coder: { ...coder, provider: opus } }
  }),
  "both-better": baseWorkflow.with({
    agents: {
      planner: { ...planner, provider: opus },
      coder: { ...coder, provider: opus }
    }
  }),
}
```

---

## Built-in Scorers

### outputValid

Checks that the workflow completed successfully (no error) and the output state matches expectations.

```typescript
export const outputValid = <S>(): Scorer<S> => ({
  name: "output-valid",
  score: (ctx) => ({
    name: "output-valid",
    pass: ctx.state !== undefined && ctx.state !== null,
    value: ctx.state !== undefined && ctx.state !== null ? 1.0 : 0.0,
  }),
})
```

### latencyUnder

Checks execution time against a threshold.

```typescript
export const latencyUnder = <S>(maxMs: number): Scorer<S> => ({
  name: "latency",
  score: (ctx) => ({
    name: "latency",
    pass: ctx.durationMs <= maxMs,
    value: ctx.durationMs,
    unit: "ms",
  }),
})
```

### costUnder

Extracts token usage from events and estimates cost.

```typescript
export const costUnder = <S>(maxUsd: number): Scorer<S> => ({
  name: "cost",
  score: (ctx) => {
    // Sum all Usage events from the run
    const usageEvents = ctx.events.filter(e => e.name === "agent:completed")
    // Cost estimation based on model pricing (lookup table)
    const totalCost = estimateCost(usageEvents)
    return {
      name: "cost",
      pass: totalCost <= maxUsd,
      value: totalCost,
      unit: "usd",
    }
  },
})
```

### custom

User-defined scorer for domain-specific quality checks.

```typescript
export const custom = <S>(
  name: string,
  fn: (ctx: ScorerContext<S>) => number | { value: number; pass?: boolean; detail?: string }
): Scorer<S> => ({
  name,
  score: (ctx) => {
    const result = fn(ctx)
    const value = typeof result === "number" ? result : result.value
    const pass = typeof result === "number" ? value >= 0.5 : (result.pass ?? value >= 0.5)
    return { name, pass, value, detail: typeof result === "object" ? result.detail : undefined }
  },
})
```

---

## Metrics Extracted from Existing Infrastructure

Everything needed for scoring is already captured by the runtime:

| Metric | Source | How |
|--------|--------|-----|
| Duration (total) | `RunResult.durationMs` | Returned by `run()` |
| Duration (per agent) | `AgentCompletedPayload.durationMs` | In event stream |
| Final state | `RunResult.state` | Returned by `run()` |
| All events | `RunResult.events` (or EventStore) | Already persisted |
| Token usage | `Usage` stream events via ProviderRecorder | In recorded stream data |
| Error info | `WorkflowError` | Thrown/returned by `run()` |
| Phase transitions | `phase:entered` / `phase:exited` events | In event stream |
| Tool calls | `tool:called` / `tool:result` events | In event stream |

No new instrumentation needed.

---

## Execution Model

### Sequential (default)

Runs are executed one at a time. Simplest, no rate limit concerns.

```
input_0 × variant_0 × trial_0 → run → score
input_0 × variant_0 × trial_1 → run → score
input_0 × variant_0 × trial_2 → run → score
input_0 × variant_1 × trial_0 → run → score
...
```

### Parallel (`--parallel N`)

Up to N runs execute concurrently. Useful when hitting different providers (no shared rate limit).

```
input_0 × variant_0 × trial_0 ──→ run → score ──┐
input_0 × variant_1 × trial_0 ──→ run → score ──┤
                                                  ├── aggregate
input_0 × variant_0 × trial_1 ──→ run → score ──┤
input_0 × variant_1 × trial_1 ──→ run → score ──┘
```

Parallelism is capped to prevent API rate limit errors. Variants using different providers can run concurrently; same-provider variants should be serialized or rate-limited.

---

## Variance and Statistical Comparison

LLM outputs are non-deterministic. Running the same configuration once tells you nothing about reliability. Multiple trials are required.

For each (variant, scorer) pair across trials, compute:

- **Mean**: average score
- **Standard deviation**: output variance (lower = more consistent)
- **Min/Max**: best and worst case
- **Pass rate**: percentage of trials where scorer passed

When comparing two variants, report whether the difference is likely meaningful:

- If standard deviations overlap significantly → "No clear winner, need more trials"
- If one variant's worst case beats another's best case → "Clear winner"

Statistical tests (Wilcoxon signed-rank for non-normal distributions, paired t-test otherwise) are a future enhancement. For v1, mean ± stddev with pass rate is sufficient.

---

## Future Extensions (Not in v1)

- **LLM-as-judge scorer**: Send outputs to a judge model for quality grading
- **Regression mode**: `scaffold eval --compare ./previous-results.json` — flag regressions
- **CI integration**: Run evals on PR, fail if pass rate drops
- **Cost model registry**: Per-model pricing tables for accurate cost estimation
- **Streaming progress**: Real-time progress bar showing completion across the matrix
- **Dataset generators**: Functions that produce eval inputs programmatically
- **Statistical tests**: Wilcoxon signed-rank / paired t-test for significance

---

## Open Questions

1. **Token usage extraction**: The `Usage` stream event captures `inputTokens` and `outputTokens`, but cost estimation requires a pricing table per model. Should we ship a built-in table or require the user to provide pricing?

2. **Error handling**: If a run fails (provider error, timeout), should it count as a 0 score, be retried, or be excluded from statistics?

3. **Session storage for forked children**: When a child session is forked, we store a copy of the state at fork point. Should we also store a reference to the parent's events up to that point, or is the computed state sufficient?

4. **State predicate performance**: The `{ where: (state) => ... }` fork point option requires scanning through events and computing state at each point until the predicate matches. For long sessions, this could be slow. Is this acceptable, or do we need an index?

5. **Variant identity**: Currently we rely on user-provided tags to identify which variant created a session. Should we hash the workflow definition for automatic identity, knowing this is fragile if functions change?
