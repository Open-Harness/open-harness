# Evals Pattern

**Status:** Draft  
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
  // Your workflow to test
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
    gates.latencyUnder(30000),       // Average latency under 30s
    gates.costUnder(1.0),            // Total cost under $1
  ],
});

// Run the suite and get results
const report = await runSuite(suite);

// Check if all gates passed
if (report.gatesPassed) {
  console.log("All gates passed!");
  console.log(report.markdown);
} else {
  console.error("Gates failed:", report.failedGates);
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

## See Also (Internal)

- `.factory/docs/2026-01-07-eval-architecture-options-provider-workflow-level.md` (provider + workflow eval options, grounded in current code)

---

## Purpose

Explain the evals pattern and how to use it.
