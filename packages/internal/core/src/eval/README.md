---
lastUpdated: "2026-01-08T09:04:06.145Z"
lastCommit: "10d2ada2acd034ba27038d3f1de354460fe5f685"
lastCommitDate: "2026-01-08T08:43:52Z"
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
├── types.ts        # Core types (EvalDataset, Assertion, etc.)
├── dataset.ts      # Dataset loading and validation
├── assertions.ts   # Assertion evaluation
├── cache.ts        # Judge cache interface
├── README.md       # This file
└── scorers/
    ├── index.ts    # Re-exports all scorers
    ├── latency.ts  # Latency scorer
    ├── cost.ts     # Cost scorer
    ├── tokens.ts   # Token usage scorer
    ├── similarity.ts # Output similarity scorer (partial)
    └── llm-judge.ts  # LLM-as-judge scorer (stub)
```

## Limitations (v0.2.0)

- **Similarity scorer**: Only `exact` and `contains` algorithms implemented. `levenshtein` and `semantic` return stub values.
- **LLM judge**: Disabled by default and returns stub values when enabled. Full implementation planned for future versions.
- **No engine**: Phase 7 will add the runner, comparison, and reporting capabilities.
