# Evals Pattern

**Status:** v0.2.0
**Purpose:** How evals make improvement automatic

---

## Overview

Evals are the point.

Recording, replay, telemetry, and persistence matter because they produce **evidence**. Evals turn evidence into **decisions**:

- which prompt is better
- which provider/model is better for this workflow
- whether a change is a regression
- how to trade off cost vs quality

If you don’t measure, you don’t improve—you just iterate blindly.

---

## Sections

## What Are Evals

An eval is a repeatable way to grade outcomes.

At minimum, evals produce:

- **Metrics** (numbers): latency, cost, tokens, pass rate, quality scores
- **Gates** (decisions): pass/fail rules that catch regressions
- **Reports** (context): what changed, where it got worse, what to fix

---

## Why Evals Matter

- No guesswork ("I think this is better")
- Data proves what's better
- Regression detection
- Optimization (cost vs. quality tradeoffs)

---

## Eval Types

- Assertions (output contains, latency under, cost under)
- Scorers (built-in: latency, cost, tokens)
- LLM-as-Judge (quality criteria, minScore)
- Human annotation (async, requires human input)
- Custom (user-defined functions)

---

## Benchmarks: Cases × Variants

The core pattern for evals is:

```
cases × variants → results → compare → decide
```

### Cases (your benchmark)

A **case** is an input you care about.

- For a developer: “generate a REST route”, “refactor this function”, “write tests”
- For a business: “refund request”, “fraud review”, “invoice dispute”, “support escalation”

Cases are the portable asset that makes evals meaningful for *your* domain.

### Variants (what you’re comparing)

A **variant** is the same workflow, run under different configuration:

- different provider (`claude.agent` vs `opencode.agent`)
- different model (Sonnet vs Opus)
- different prompt (prompt A vs prompt B)
- different skill set / rules (later)

In the target architecture, variants should be expressed as *small transformations* on a base workflow definition so comparison is apples-to-apples.

---

## Recording and Replay (Evidence)

Recording and replay exist so evals can be:

- **repeatable** (re-run on the same evidence)
- **comparable** (same input, different variants)
- **regression-safe** (compare against a baseline)

### Provider-level evidence (deterministic)

Provider-level recording captures streaming events + final output for a single provider call.

In the codebase today, this is the `withRecording()` wrapper around a provider trait.

### Workflow-level evidence (complete execution)

Workflow-level persistence captures runtime events + snapshots for the entire workflow run.

In the codebase today, this is the `RunStore` passed into the runtime so it can persist events and snapshots.

---

## “Default Good”: Baselines and Regression Gates

Evals become “hard to do wrong” when the default workflow is:

1. You run a suite (cases × variants)
2. A **baseline** variant is chosen (explicit)
3. Results are compared to baseline
4. Regressions fail loudly (gates)

This turns “record → compare → iterate” into an actual system.

---

## What It Looks Like (v0.2.0 API)

```ts
import { defineSuite, variant, gates, runSuite } from "@open-harness/core";

// Define your eval suite
const suite = defineSuite({
  // Suite name (required)
  name: "my-api-eval",

  // Your workflow factory to test
  flow: myWorkflow,

  // Test cases with inputs and assertions
  cases: [
    {
      id: "hello-api",
      input: { task: "Build a hello world Express API" },
      assertions: [
        { type: "behavior.no_errors" },
        { type: "output.contains", path: "outputs.main.code", value: "app.get" },
        { type: "metric.latency_ms.max", value: 30000 },
      ],
    },
    {
      id: "auth-api",
      input: { task: "Build CRUD API with JWT auth" },
      assertions: [
        { type: "behavior.no_errors" },
        { type: "metric.latency_ms.max", value: 60000 },
      ],
    },
  ],

  // Variants to compare (different models, providers, configs)
  variants: [
    variant("claude/sonnet", { model: "claude-3-5-sonnet-latest" }),
    variant("claude/opus", { model: "claude-3-opus-latest" }),
  ],

  // Which variant is the baseline for comparison
  baseline: "claude/sonnet",

  // Gates that must pass for the eval to succeed
  gates: [
    gates.noRegressions(),           // No assertion regressions vs baseline
    gates.passRate(0.9),             // At least 90% of cases pass
    gates.latencyUnder(30000),       // Max latency under 30s
    gates.costUnder(1.0),            // Max cost under $1
  ],
});

// Run the suite and get results
const report = await runSuite(suite, { mode: "live" });

// Check if all gates passed
if (report.passed) {
  console.log("All gates passed!");
  console.log(`Pass rate: ${(report.summary.passRate * 100).toFixed(0)}%`);
} else {
  const failedGates = report.gateResults.filter(g => !g.passed);
  console.error("Gates failed:", failedGates.map(g => g.name).join(", "));
  process.exit(1);
}
```

The important part is the shape: **cases are yours**, variants are configuration, and the system defaults to baseline + gates.

---

## Generating Eval Sets From Real Usage (Target Direction)

To make evals effortless for users, we want a capture path:

- As you run workflows in development or production, representative inputs can be captured into a dataset.
- Those captured cases become your benchmark over time.

This is how a business ends up with “its own benchmark” without hand-curating from scratch.

---

## Regression Detection

- Compare new runs to golden recordings
- Detect breaking changes automatically
- CI/CD integration (block bad deployments)
- Pass rates, avg latency, avg cost

---

## FAQ

### What is a "workflow factory"?

A workflow factory is a function that creates a workflow for a given test case and variant. It receives the case input and variant configuration, and returns a flow definition that the eval engine can execute.

```ts
const myWorkflow: SuiteWorkflowFactory = ({ caseInput, variant }) => ({
  flow: {
    name: "my-workflow",
    nodes: [{ id: "main", type: "claude.agent", input: caseInput }],
    edges: [],
  },
  register(registry, mode) {
    registry.register(createClaudeNode({ model: variant.model }));
  },
  primaryOutputNodeId: "main",
});
```

The factory pattern allows the same workflow structure to be parameterized by variant (different models, prompts, etc.) while keeping cases consistent.

### What's the difference between assertions and gates?

**Assertions** are per-case checks that validate individual outputs:
- "Output contains 'function'"
- "Latency under 30s"
- "No runtime errors"

**Gates** are suite-level decisions that determine overall pass/fail:
- "90% of cases must pass"
- "No regressions vs baseline"
- "Max cost under $1 across all cases"

Think of assertions as unit tests, gates as acceptance criteria.

### How do I debug a failing eval?

1. **Run with `--verbose`** to see per-case results:
   ```bash
   bun run eval --mode live --verbose
   ```

2. **Run a single case** to isolate the issue:
   ```bash
   bun run eval --cases failing-case-id --verbose
   ```

3. **Check the assertion results** in the report - each assertion shows actual vs expected values

4. **Review the artifact** - the `caseResult.artifact` contains the full workflow output and events

### What run modes are available?

| Mode | Description | Use Case |
|------|-------------|----------|
| `live` | Real API calls | Development, initial recording |
| `replay` | Use recorded fixtures | CI, fast iteration |
| `record` | Live calls, save fixtures | Creating test fixtures |

### How do I compare different prompts?

Use variants with different `config` values:

```ts
variants: [
  variant("prompt-a", {
    model: "claude-sonnet-4-20250514",
    config: { systemPrompt: "You are a helpful assistant." },
  }),
  variant("prompt-b", {
    model: "claude-sonnet-4-20250514",
    config: { systemPrompt: "You are a concise expert." },
  }),
],
baseline: "prompt-a",
```

The `config` object is passed to your workflow factory, where you can use it to configure the prompt.

### Why is LLM-as-judge disabled?

In v0.2.0, the LLM-as-judge scorer is stubbed and disabled by default. It returns placeholder values when enabled. Full implementation is planned for a future release.

For now, use:
- Output assertions (`output.contains`, `output.equals`)
- Metric assertions (`metric.latency_ms.max`, `metric.total_cost_usd.max`)
- Behavior assertions (`behavior.no_errors`)

### Can I use custom scorers?

Yes. Implement the `Scorer` interface:

```ts
const myScorer: Scorer = {
  name: "my-scorer",
  score(artifact: EvalArtifact): Score {
    const value = /* your scoring logic */;
    return { name: "my-scorer", value, rawValue: artifact };
  },
};

const suite = defineSuite({
  // ...
  scorers: [myScorer],
});
```

### How do I run evals in CI?

```bash
# Run in replay mode (no API calls)
bun run eval --mode replay

# Exit code is 0 if all gates pass, 1 otherwise
```

For CI, you'll want pre-recorded fixtures. Record them locally first:
```bash
bun run record
```

Then commit the fixtures and run in replay mode in CI.

---

## See Also

- [Eval System README](../../../../packages/internal/core/src/eval/README.md) - Full API reference
- [Starter Kit](../../../../apps/starter-kit/) - Working example with CLI

---

## Purpose

Explain the evals pattern and how to use it.
