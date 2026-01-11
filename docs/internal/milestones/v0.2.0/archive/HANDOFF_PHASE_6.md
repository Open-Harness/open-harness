# Phase 6 Handoff: Eval Core Types

**Branch:** `v0.2.0/stabilization`
**Prerequisite:** None (this is the first phase)
**Estimated Time:** 1 week
**Quality Gate:** `bun run typecheck && bun run lint && bun run test`

---

## Your Mission

Build the eval type system: types, dataset loading, assertion evaluation, and scorers.

**When you're done:** The eval system has a solid type foundation. You can load a dataset from JSON, evaluate assertions against an artifact, and score results. Phase 7 (engine) builds on top of this.

---

## What to Build

Create `packages/internal/core/src/eval/` with these files:

### 1. `types.ts` (~200 lines)

```typescript
// Core types you must define:

export type EvalDataset = {
  id: string;                 // e.g. "coder-reviewer.v1"
  workflowName: string;       // maps to workflow factory
  version: string;            // dataset version
  cases: EvalCase[];
};

export type EvalCase = {
  id: string;                 // stable, filesystem-safe
  name?: string;
  input: unknown;             // fed to workflow
  assertions: Assertion[];
  tags?: string[];
};

export type EvalVariant = {
  id: string;                 // e.g. "claude-default"
  providerTypeByNode: Record<string, string>;
  modelByNode?: Record<string, string>;
  tags?: string[];
};

export type EvalArtifact = {
  runId: string;
  snapshot: RunSnapshot;      // from state/snapshot.ts
  events: RuntimeEvent[];     // includes recording:linked
};

export type Assertion =
  | { type: "output.contains"; path: string; value: string }
  | { type: "output.equals"; path: string; value: unknown }
  | { type: "metric.latency_ms.max"; value: number }
  | { type: "metric.total_cost_usd.max"; value: number }
  | { type: "metric.tokens.input.max"; value: number }
  | { type: "metric.tokens.output.max"; value: number }
  | { type: "behavior.no_errors" }
  | { type: "behavior.node_executed"; nodeId: string }
  | { type: "behavior.node_invocations.max"; nodeId: string; value: number };

export type AssertionResult = {
  assertion: Assertion;
  passed: boolean;
  actual?: unknown;
  message?: string;
};

export type Score = {
  name: string;
  value: number;        // 0-1 normalized
  rawValue?: unknown;   // original value before normalization
  metadata?: Record<string, unknown>;
};

export type ScoreBreakdown = {
  overall: number;      // 0-1
  scores: Score[];
};

export interface Scorer {
  name: string;
  score(artifact: EvalArtifact): Score;
}
```

### 2. `dataset.ts` (~100 lines)

```typescript
import { z } from 'zod';
import type { EvalDataset } from './types';

// Zod schema for validation
const EvalDatasetSchema = z.object({
  id: z.string(),
  workflowName: z.string(),
  version: z.string(),
  cases: z.array(/* ... */),
});

export function loadDataset(json: unknown): EvalDataset {
  // Validate and return, throw on invalid
}

export function validateDataset(dataset: EvalDataset): ValidationResult {
  // Check for issues like duplicate case IDs
}

export async function discoverDatasets(dir: string): Promise<string[]> {
  // Find all *.json files in datasets directory
}
```

### 3. `assertions.ts` (~150 lines)

```typescript
import type { Assertion, AssertionResult, EvalArtifact } from './types';

export function evaluateAssertions(
  artifact: EvalArtifact,
  assertions: Assertion[]
): AssertionResult[] {
  return assertions.map(a => evaluateAssertion(artifact, a));
}

function evaluateAssertion(
  artifact: EvalArtifact,
  assertion: Assertion
): AssertionResult {
  switch (assertion.type) {
    case 'output.contains':
      return evaluateOutputContains(artifact, assertion);
    case 'output.equals':
      return evaluateOutputEquals(artifact, assertion);
    case 'metric.latency_ms.max':
      return evaluateMetricLatency(artifact, assertion);
    // ... etc
  }
}

// Helper: resolve path like "outputs.nodeId.field" against artifact
function resolvePath(artifact: EvalArtifact, path: string): unknown {
  // Use lodash.get or similar
}

// Helper: extract metrics from agent:complete events
function extractMetrics(events: RuntimeEvent[]): Metrics {
  // Find agent:complete events, extract durationMs, totalCostUsd, usage
}
```

### 4. `scorers/` directory

```
scorers/
├── index.ts      # re-exports all scorers
├── latency.ts    # score based on durationMs
├── cost.ts       # score based on totalCostUsd
├── tokens.ts     # score based on token usage
├── similarity.ts # score based on output similarity (stub for now)
└── llm-judge.ts  # score using LLM (stub, disabled by default)
```

Each scorer is a pure function:
```typescript
export function createLatencyScorer(config?: { maxMs?: number }): Scorer {
  return {
    name: 'latency',
    score(artifact: EvalArtifact): Score {
      const latency = extractLatency(artifact.events);
      const normalized = /* 0-1 based on maxMs */;
      return { name: 'latency', value: normalized, rawValue: latency };
    }
  };
}
```

### 5. `cache.ts` (~50 lines)

```typescript
// Judge cache for LLM-as-judge (avoid re-running expensive judgments)
export interface EvalJudgeCache {
  get(key: string): Promise<Score | undefined>;
  set(key: string, score: Score): Promise<void>;
}

export function createInMemoryCache(): EvalJudgeCache {
  const cache = new Map<string, Score>();
  return {
    async get(key) { return cache.get(key); },
    async set(key, score) { cache.set(key, score); }
  };
}
```

### 6. `index.ts` (~20 lines)

```typescript
// Re-export public API
export * from './types';
export { loadDataset, validateDataset, discoverDatasets } from './dataset';
export { evaluateAssertions } from './assertions';
export * from './scorers';
export { createInMemoryCache } from './cache';
export type { EvalJudgeCache } from './cache';
```

### 7. Add `recording:linked` event to `state/events.ts`

Find the existing event union in `packages/internal/core/src/state/events.ts` and add:

```typescript
export type RecordingLinkedEvent = {
  type: 'recording:linked';
  runId: string;
  nodeId: string;
  invocation: number;
  providerType: string;
  recordingId: string;
  mode: 'record' | 'replay' | 'live';
  timestamp: number;
};

// Add to the RuntimeEvent union
export type RuntimeEvent =
  | /* existing events */
  | RecordingLinkedEvent;
```

---

## Tests to Write

Create `packages/internal/core/tests/eval/`:

### `dataset.test.ts`
- ✅ Load valid dataset JSON → returns EvalDataset
- ✅ Load invalid JSON (missing required field) → throws ValidationError
- ✅ Load invalid JSON (duplicate case IDs) → returns validation warning
- ✅ Discover datasets in directory → returns file paths

### `assertions.test.ts`
- ✅ output.contains with matching value → passed: true
- ✅ output.contains with missing value → passed: false, shows actual
- ✅ output.equals with exact match → passed: true
- ✅ output.equals with nested path → resolves correctly
- ✅ metric.latency_ms.max under budget → passed: true
- ✅ metric.latency_ms.max over budget → passed: false, shows actual
- ✅ behavior.no_errors with clean run → passed: true
- ✅ behavior.no_errors with errors → passed: false, lists errors
- ✅ behavior.node_executed with executed node → passed: true
- ✅ behavior.node_executed with missing node → passed: false

### `scorers.test.ts`
- ✅ Latency scorer extracts durationMs from events
- ✅ Latency scorer normalizes to 0-1 range
- ✅ Cost scorer extracts totalCostUsd
- ✅ Tokens scorer extracts input/output tokens
- ✅ All scorers return valid Score shape

### `types.test.ts`
- ✅ EvalDataset type validates correctly
- ✅ Assertion union covers all types
- ✅ recording:linked event can be created and typed

---

## Test Fixtures Needed

Create `packages/internal/core/tests/eval/fixtures/`:

### `test-dataset.json`
```json
{
  "id": "test-dataset",
  "workflowName": "test-workflow",
  "version": "1.0.0",
  "cases": [
    {
      "id": "case-1",
      "name": "Simple test case",
      "input": { "prompt": "Hello" },
      "assertions": [
        { "type": "behavior.no_errors" },
        { "type": "output.contains", "path": "outputs.main.text", "value": "hello" }
      ]
    }
  ]
}
```

### `mock-artifact.ts`
```typescript
// Helper to create mock EvalArtifact for testing
export function createMockArtifact(overrides?: Partial<EvalArtifact>): EvalArtifact {
  return {
    runId: 'test-run',
    snapshot: {
      outputs: { main: { text: 'Hello world' } },
      state: {},
      nodeStatus: {},
      // ...
    },
    events: [
      { type: 'agent:complete', durationMs: 1500, totalCostUsd: 0.01, /* ... */ }
    ],
    ...overrides
  };
}
```

---

## Quality Gate (Must Pass Before Phase 7)

```bash
bun run typecheck && bun run lint && bun run test
```

### Exit Criteria Checklist

- [ ] `bun run typecheck` — 0 errors
- [ ] `bun run lint` — 0 errors
- [ ] `bun run test` — 0 failures, no regressions
- [ ] At least 20 tests in `tests/eval/`
- [ ] Test dataset fixture committed
- [ ] Can load dataset from JSON without errors
- [ ] Can evaluate all assertion types against mock artifact
- [ ] `recording:linked` event type exists in `state/events.ts`
- [ ] All scorers return valid Score shape
- [ ] `README.md` explains how to add a dataset and scorer

---

## Commit When Done

```bash
git add -A && git commit -m "$(cat <<'EOF'
feat(eval): phase 6 complete - types, dataset, assertions, scorers

Quality gate: typecheck ✓ lint ✓ tests ✓ (X tests, 0 failures)

- EvalDataset, EvalCase, EvalVariant, EvalArtifact types
- loadDataset() with Zod validation
- evaluateAssertions() with path resolution
- Scorers: latency, cost, tokens, similarity (stub), llm-judge (stub)
- recording:linked event type added to state/events.ts
- Test fixtures: test-dataset.json, mock artifact helper

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## References

- **Detailed spec:** `docs/internal/milestones/v0.2.0/EVAL_COMPLETION_PLAN.md` (Phase 6 section)
- **Type definitions:** See "Locked decisions" section for exact shapes
- **Assertion types:** See "Assertion types (v0.2.0)" section
- **Metric extraction:** See "Metric extraction rules" section

---

## What NOT To Do

- ❌ Don't implement the engine (runner, compare, report) — that's Phase 7
- ❌ Don't create real fixtures from SDK — that's Phase 8
- ❌ Don't implement the full LLM judge — stub it with a TODO
- ❌ Don't skip tests — the gate won't pass without 20+ meaningful tests
