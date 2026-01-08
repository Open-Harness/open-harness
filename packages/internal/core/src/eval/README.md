---
lastUpdated: "2026-01-08T10:44:23.678Z"
lastCommit: "f62772a7a1f0406b02eb6646ab2531014102675f"
lastCommitDate: "2026-01-08T10:03:32Z"
---
# Eval System (v0.2.0)

The eval system provides types and utilities for evaluating workflows against datasets.

## Quick Start

### 1. Create a Dataset

Create a JSON file in `tests/fixtures/evals/datasets/`:

```json
{
  "id": "my-workflow.v1",
  "workflowName": "my-workflow",
  "version": "1.0.0",
  "cases": [
    {
      "id": "basic-test",
      "name": "Basic functionality test",
      "input": { "task": "Say hello" },
      "assertions": [
        { "type": "behavior.no_errors" },
        { "type": "output.contains", "path": "outputs.main.text", "value": "hello" },
        { "type": "metric.latency_ms.max", "value": 30000 }
      ],
      "tags": ["smoke"]
    }
  ]
}
```

### 2. Load and Validate

```typescript
import { loadDataset, validateDataset } from "@internal/core";

// Load from JSON (throws on invalid)
const dataset = loadDataset(jsonData);

// Or validate without throwing
const result = validateDataset(dataset);
if (!result.valid) {
  console.error("Errors:", result.errors);
}
if (result.warnings.length > 0) {
  console.warn("Warnings:", result.warnings);
}
```

### 3. Evaluate Assertions

```typescript
import { evaluateAssertions, createArtifactView } from "@internal/core";

// Given an artifact from a workflow run
const artifact = {
  runId: "run-123",
  snapshot: { /* RunSnapshot */ },
  events: [ /* RuntimeEvent[] */ ],
};

// Evaluate assertions
const results = evaluateAssertions(artifact, dataset.cases[0].assertions);

for (const result of results) {
  console.log(result.assertion.type, result.passed ? "PASS" : "FAIL");
  if (!result.passed) {
    console.log("  Actual:", result.actual);
    console.log("  Message:", result.message);
  }
}
```

### 4. Score Results

```typescript
import {
  createLatencyScorer,
  createCostScorer,
  createTokensScorer,
} from "@internal/core";

const scorers = [
  createLatencyScorer({ maxMs: 30000 }),
  createCostScorer({ maxUsd: 1.0 }),
  createTokensScorer({ maxTokens: 50000 }),
];

const scores = scorers.map(scorer => scorer.score(artifact));

// Calculate overall score
const overall = scores.reduce((sum, s) => sum + s.value, 0) / scores.length;
console.log("Overall score:", overall);
```

## Assertion Types

### Output Assertions

| Type | Description | Example |
|------|-------------|---------|
| `output.contains` | Check if output contains a substring | `{ "type": "output.contains", "path": "outputs.main.text", "value": "hello" }` |
| `output.equals` | Check if output equals a value | `{ "type": "output.equals", "path": "outputs.main.status", "value": "success" }` |

### Metric Assertions

| Type | Description | Example |
|------|-------------|---------|
| `metric.latency_ms.max` | Maximum total latency in ms | `{ "type": "metric.latency_ms.max", "value": 30000 }` |
| `metric.total_cost_usd.max` | Maximum total cost in USD | `{ "type": "metric.total_cost_usd.max", "value": 0.50 }` |
| `metric.tokens.input.max` | Maximum input tokens | `{ "type": "metric.tokens.input.max", "value": 10000 }` |
| `metric.tokens.output.max` | Maximum output tokens | `{ "type": "metric.tokens.output.max", "value": 5000 }` |

### Behavior Assertions

| Type | Description | Example |
|------|-------------|---------|
| `behavior.no_errors` | Run had no errors | `{ "type": "behavior.no_errors" }` |
| `behavior.node_executed` | A specific node was executed | `{ "type": "behavior.node_executed", "nodeId": "coder" }` |
| `behavior.node_invocations.max` | Max invocations of a node | `{ "type": "behavior.node_invocations.max", "nodeId": "coder", "value": 3 }` |

## Scorers

### Built-in Scorers

| Scorer | Description | Config |
|--------|-------------|--------|
| `latency` | Score based on total duration | `{ maxMs, idealMs }` |
| `cost` | Score based on total cost | `{ maxUsd, idealUsd }` |
| `tokens` | Score based on token usage | `{ maxTokens, idealTokens, inputWeight }` |
| `similarity` | Score based on output similarity | `{ outputPath, expectedValue, algorithm }` |
| `llm-judge` | Score using LLM evaluation (stub) | `{ outputPath, criteria, cache, enabled }` |

### Adding a Custom Scorer

```typescript
import type { Scorer, Score, EvalArtifact } from "@internal/core";

const myScorer: Scorer = {
  name: "my-scorer",
  score(artifact: EvalArtifact): Score {
    // Extract data from artifact
    const outputs = artifact.snapshot.outputs;

    // Calculate score (0-1)
    const value = /* your scoring logic */;

    return {
      name: "my-scorer",
      value,
      rawValue: outputs,
      metadata: { /* custom metadata */ },
    };
  },
};
```

## Recording Integration

The eval system uses `recording:linked` events to correlate runtime runs with provider recordings:

```typescript
// Recording ID format
const recordingId = `eval__${datasetId}__${caseId}__${variantId}__${nodeId}__inv${invocation}`;

// Example: eval__coder-reviewer.v1__simple-api__claude-default__coder__inv0
```

Use `generateRecordingId()` and `parseRecordingId()` utilities:

```typescript
import { generateRecordingId, parseRecordingId } from "@internal/core";

const id = generateRecordingId({
  datasetId: "coder-reviewer.v1",
  caseId: "simple-api",
  variantId: "claude-default",
  nodeId: "coder",
  invocation: 0,
});

const parsed = parseRecordingId(id);
// { datasetId: "coder-reviewer.v1", caseId: "simple-api", ... }
```

## Judge Caching

LLM-as-judge evaluations are expensive. Use caching to avoid re-running:

```typescript
import { createInMemoryCache, generateJudgeCacheKey } from "@internal/core";

const cache = createInMemoryCache();

// Generate cache key
const key = generateJudgeCacheKey(
  "outputs.main.code",
  "Is this code correct and well-formatted?",
  actualOutput,
);

// Check cache
const cached = await cache.get(key);
if (cached) {
  return cached;
}

// Run judgment and cache
const score = await runJudgment();
await cache.set(key, score);
```

## File Structure

```
eval/
├── index.ts        # Re-exports public API
├── types.ts        # Core types (EvalDataset, Assertion, WorkflowFactory, etc.)
├── dataset.ts      # Dataset loading and validation
├── assertions.ts   # Assertion evaluation
├── cache.ts        # Judge cache interface
├── engine.ts       # EvalEngine - high-level orchestration (Phase 7)
├── runner.ts       # runCase/runDataset/runMatrix (Phase 7)
├── compare.ts      # Baseline comparison and flake detection (Phase 7)
├── report.ts       # Markdown and JSON report generation (Phase 7)
├── hooks.ts        # Lifecycle hooks for observability (Phase 7)
├── dx-types.ts     # DX layer types (Phase 8)
├── dx.ts           # defineSuite, variant, gates, runSuite (Phase 8)
├── README.md       # This file
└── scorers/
    ├── index.ts    # Re-exports all scorers
    ├── latency.ts  # Latency scorer
    ├── cost.ts     # Cost scorer
    ├── tokens.ts   # Token usage scorer
    ├── similarity.ts # Output similarity scorer (partial)
    └── llm-judge.ts  # LLM-as-judge scorer (stub)
```

## DX Layer (Phase 8) - Recommended

The DX layer provides an ergonomic API for defining and running eval suites. This is the recommended way to use the eval system.

### Basic Usage

```typescript
import { defineSuite, variant, gates, runSuite } from "@internal/core";

// Define a suite
const suite = defineSuite({
  name: "my-workflow-eval",
  flow: myWorkflowFactory,
  cases: [
    { id: "test-1", input: { task: "Build hello API" } },
    { id: "test-2", input: { task: "Fix bug in auth" } },
  ],
  variants: [
    variant("claude/sonnet", { model: "claude-3-5-sonnet-latest" }),
    variant("claude/opus", { model: "claude-3-opus-latest" }),
  ],
  baseline: "claude/sonnet",
  gates: [
    gates.noRegressions(),
    gates.passRate(0.9),
    gates.latencyUnder(30000),
    gates.costUnder(1.0),
  ],
  defaultAssertions: [
    { type: "behavior.no_errors" },
    { type: "metric.latency_ms.max", value: 60000 },
  ],
});

// Run the suite
const report = await runSuite(suite, { mode: "live" });

// Check results
if (!report.passed) {
  console.log("Suite failed!");
  for (const gate of report.gateResults) {
    if (!gate.passed) {
      console.log(`Gate "${gate.name}" failed: ${gate.message}`);
    }
  }
}
```

### Workflow Factory

Define how to create workflows for each case:

```typescript
import type { SuiteWorkflowFactory } from "@internal/core";

const myWorkflowFactory: SuiteWorkflowFactory = ({ caseId, caseInput, variant }) => ({
  flow: {
    name: "my-workflow",
    nodes: [
      { id: "main", type: "claude", input: caseInput },
    ],
    edges: [],
  },
  register(registry, mode) {
    registry.register(createClaudeNode(variant.model));
  },
  primaryOutputNodeId: "main",
});
```

### Variant Helper

Create variant definitions easily:

```typescript
// Simple variant with model
variant("claude/sonnet", { model: "claude-3-5-sonnet-latest" })

// Variant with per-node model overrides
variant("mixed", {
  modelByNode: {
    coder: "claude-3-5-sonnet-latest",
    reviewer: "claude-3-opus-latest",
  }
})

// Variant with tags and custom config
variant("experimental", {
  model: "claude-3-opus-latest",
  tags: ["candidate", "expensive"],
  config: { temperature: 0.7 },
})
```

### Built-in Gates

| Gate | Description |
|------|-------------|
| `gates.noRegressions()` | Fails if any cases regressed vs baseline |
| `gates.passRate(threshold)` | Fails if pass rate is below threshold (0-1) |
| `gates.latencyUnder(ms)` | Fails if any case exceeds max latency |
| `gates.costUnder(usd)` | Fails if any case exceeds max cost |
| `gates.requiredCases([...])` | Fails if specified cases don't pass |
| `gates.custom(name, desc, fn)` | Custom gate with your own logic |

### Run Options

```typescript
await runSuite(suite, {
  mode: "live",              // "live", "record", or "replay"
  filterCases: ["test-1"],   // Run only specific cases
  filterTags: ["smoke"],     // Run only cases with these tags
  baseline: "variant-b",     // Override baseline for this run
});
```

### Suite Report

The report includes:

```typescript
type SuiteReport = {
  suiteName: string;
  matrixResult: MatrixResult;  // Full matrix results
  gateResults: GateResult[];   // Gate pass/fail
  passed: boolean;             // Overall suite pass/fail
  summary: {
    totalCases: number;
    passedCases: number;
    failedCases: number;
    passRate: number;
    gatesPassed: number;
    totalGates: number;
    regressions: number;
  };
};
```

## Engine Usage (Phase 7)

The eval engine provides a lower-level API for running evaluations. Use this when you need more control than the DX layer provides.

### Basic Usage

```typescript
import {
  createEvalEngine,
  createConsoleHooks,
} from "@internal/core";
import { InMemoryRecordingStore } from "@internal/core/recording";

// Create the engine
const engine = createEvalEngine({
  recordingStore: new InMemoryRecordingStore(),
  workflowFactory: ({ caseInput }) => ({
    flow: createMyWorkflow(caseInput),
    register(registry, mode) {
      registry.register(createMyNodeTypes(mode));
    },
    primaryOutputNodeId: "main",
  }),
  hooks: createConsoleHooks(),
});

// Run a matrix evaluation
const result = await engine.runMatrix({
  dataset: myDataset,
  variants: [baselineVariant, candidateVariant],
  mode: "live",
  baselineVariantId: "baseline",
});

// Generate a report
const report = engine.report(result, { format: "markdown" });
console.log(report);
```

### Workflow Factory

The `workflowFactory` creates workflows for each case:

```typescript
const workflowFactory: WorkflowFactory = ({
  datasetId,
  caseId,
  variantId,
  caseInput,
}) => ({
  // The flow definition to execute
  flow: {
    name: "my-workflow",
    nodes: [
      { id: "main", type: "claude", input: caseInput },
    ],
    edges: [],
  },

  // Register node types with the registry
  register(registry, mode) {
    if (mode === "replay") {
      // Use recordings in replay mode
      registry.register(createMockClaudeNode());
    } else {
      // Use live provider
      registry.register(createClaudeNode());
    }
  },

  // Optional: primary output node for assertions
  primaryOutputNodeId: "main",
});
```

### Variants

Define variants to test different configurations:

```typescript
const variants: EvalVariant[] = [
  {
    id: "claude-3-5-sonnet",
    providerTypeByNode: {
      coder: "claude",
      reviewer: "claude",
    },
    modelByNode: {
      coder: "claude-3-5-sonnet-20241022",
      reviewer: "claude-3-5-sonnet-20241022",
    },
    tags: ["baseline"],
  },
  {
    id: "claude-opus",
    providerTypeByNode: {
      coder: "claude",
      reviewer: "claude",
    },
    modelByNode: {
      coder: "claude-opus-4-20250514",
      reviewer: "claude-opus-4-20250514",
    },
    tags: ["candidate"],
  },
];
```

### Comparison and Reports

```typescript
import {
  compareToBaseline,
  generateReport,
  DEFAULT_COMPARISON_THRESHOLDS,
} from "@internal/core";

// Compare candidate to baseline (using default thresholds)
const comparison = compareToBaseline(baselineResult, candidateResult);

// Or with custom thresholds
const strictComparison = compareToBaseline(baselineResult, candidateResult, {
  latencyIncrease: 0.1,  // 10% (default: 20%)
  costIncrease: 0.05,    // 5% (default: 10%)
  scoreDecrease: 0.05,   // 5% (default: 10%)
});

console.log("Regressions:", comparison.regressions.length);
console.log("Improvements:", comparison.improvements.length);

// Generate Markdown report
const markdown = generateReport(matrixResult, {
  format: "markdown",
  includeDetails: true,
  maxRegressions: 10,
});

// Generate JSON report
const json = generateReport(matrixResult, {
  format: "json",
  includeDetails: false,
});
```

### Lifecycle Hooks

Use hooks to observe evaluation progress:

```typescript
import { createCollectingHooks, composeHooks } from "@internal/core";

// Console logging
const consoleHooks = createConsoleHooks();

// Collecting for testing
const collectingHooks = createCollectingHooks();

// Compose multiple hooks
const hooks = composeHooks(consoleHooks, collectingHooks);

// After evaluation, access collected data
console.log("Cases started:", collectingHooks.casesStarted.length);
console.log("Regressions:", collectingHooks.regressions.length);
```

### Runner Functions

For fine-grained control, use runner functions directly:

```typescript
import { runCase, runDataset, runMatrix } from "@internal/core";

// Run a single case
const caseResult = await runCase(config, dataset, "case-1", variant, "live");

// Run all cases in a dataset
const datasetResult = await runDataset(config, dataset, variant, "live");

// Run multiple variants
const matrixResult = await runMatrix(config, dataset, variants, "live");
```

## Limitations (v0.2.0)

- **Similarity scorer**: Only `exact` and `contains` algorithms implemented. `levenshtein` and `semantic` return stub values.
- **LLM judge**: Disabled by default and returns stub values when enabled. Full implementation planned for future versions.
- **Replay mode**: Requires pre-recorded fixtures. See Phase 8 for fixture recording scripts.
