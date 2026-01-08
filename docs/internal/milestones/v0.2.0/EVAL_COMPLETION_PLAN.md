# Eval v0.2.0 Canonical Plan (Hybrid, Evals-First)

This is the single, cohesive plan to take the repo from “recording + replay + runtime persistence exist” to “evals are default-good, easy to run, and hard to regress”.

It is intentionally **self-contained**: you should not need to read any other planning docs to implement v0.2.0 evals end-to-end.

---

## Goals (what “done” means)

1. **Default-good evals**: A minimal dataset + baseline + gates story that makes failure signals obvious.
2. **Dataset-first**: Easy to generate and maintain “cases” from workflows (not just ad hoc scoring).
3. **Variants & matrices**: Run the same cases across provider/model/prompt variants without rewriting workflows.
4. **Replayability**: Deterministic replay via provider-level recordings; avoid re-paying LLM judge costs when not needed.
5. **Provider-agnostic**: No Claude/OpenCode/Codex coupling; everything goes through `ProviderTrait` + stores.
6. **Incremental delivery**: Phase 6 types → Phase 7 engine → Phase 8 integration, without breaking existing primitives.

## Non-goals (explicitly out of scope for v0.2.0)

- Building a full UI/TUI dashboard for eval reports.
- Building a workflow-specific “golden answer” diffing system for every output type.
- Solving “production eval monitoring” end-to-end (hooks exist, but ops tooling is outside scope).
- Introducing new runtime event types unless required (event semantic changes are risky and require real fixtures).

---

## Current system inventory (what exists today)

### Core runtime & provider integration

```
packages/internal/core/src/
  providers/
    trait.ts            # ProviderTrait (pure providers: input -> events -> output)
    context.ts          # ExecutionContext (signal + emit)
    events.ts           # StreamEvent union
    adapter.ts          # toNodeDefinition(): ProviderTrait -> NodeTypeDefinition
  runtime/
    execution/runtime.ts # createRuntime(): runs FlowDefinition, emits RuntimeEvents, persists snapshots
  state/
    snapshot.ts         # RunSnapshot (outputs/state/nodeStatus/edgeStatus/loopCounters/agentSessions)
  persistence/
    run-store.ts        # RunStore interface (appendEvent/saveSnapshot/loadSnapshot/loadEvents)
```

### Recording & replay (provider-level)

```
packages/internal/core/src/recording/
  types.ts              # Recording<TOutput>, RecordingMetadata, RecordedEvent
  store.ts              # RecordingStore interface
  memory-store.ts       # InMemoryRecordingStore
  with-recording.ts     # withRecording(trait, { mode }) wrapper
```

### Durable stores (workspace packages)

```
packages/stores/
  recording-store/
    file/               # @open-harness/recording-store-file
    sqlite/             # @open-harness/recording-store-sqlite
    testing/            # @open-harness/recording-store-testing
  run-store/
    sqlite/             # @open-harness/run-store-sqlite
    testing/            # @open-harness/run-store-testing
```

### Existing fixture pattern (in-repo)

There is no `recordings/golden/` at repo root today. The current fixture pattern lives under package tests:

```
packages/open-harness/core/tests/fixtures/
  recordings/captured/  # raw captures already exist here
  schemas/              # JSON schemas for tests
packages/open-harness/server/tests/fixtures/
  runtime-events.json   # runtime event fixtures
  raw-sdk-capture.fixture.json
```

---

## Locked decisions (no options)

This plan is canonical and buildable as-is. An implementer should not need to make choices; follow the decisions below.

### Eval artifact model (Hybrid)

The system evaluates workflows using `RunSnapshot` + `RuntimeEvent[]`, and replays provider calls using `RecordingStore` recordings. For every provider node invocation, we do **both**:

1. Store a provider recording under a deterministic, per-invocation ID (flat; no `/`):

```
eval__<datasetId>__<caseId>__<variantId>__<nodeId>__inv<invocation>
```

2. Emit an indexing event into the runtime event stream (persisted via `RunStore`) so we can programmatically answer “what happened?” and attach future artifacts like file touches:

```ts
type RecordingLinkedEventPayload = {
  type: "recording:linked";
  runId: string;
  nodeId: string;
  invocation: number;
  providerType: string;
  recordingId: string;
  mode: "record" | "replay" | "live";
};
```

#### Invocation semantics (how `invocation` is defined)

- `invocation` is a **per-node counter** scoped to a single runtime run.
- Every time a provider-backed node is executed (including retries, loops, and forEach iterations), increment that node’s counter and use the resulting value.
- The `recording:linked` event is emitted **immediately before** the provider call is executed/replayed so that provenance is captured even if the call errors or aborts.

#### RecordingStore layout for committed goldens (exact filenames)

Goldens are stored using `@open-harness/recording-store-file` pointing at:

```
packages/open-harness/core/tests/fixtures/evals/goldens
```

Because `FileRecordingStore` writes:
- `recording-<id>.json` (metadata + output + error)
- `recording-<id>.jsonl` (events)

the exact on-disk paths look like:

```
packages/open-harness/core/tests/fixtures/evals/goldens/recording-eval__coder-reviewer.v1__simple-api__claude-default__coder__inv0.json
packages/open-harness/core/tests/fixtures/evals/goldens/recording-eval__coder-reviewer.v1__simple-api__claude-default__coder__inv0.jsonl
```

#### Provenance fixtures (required for the hybrid index)

In addition to provider recordings, we commit a provenance capture of runtime events for the recording run(s):

```
packages/open-harness/core/tests/fixtures/evals/provenance/<datasetId>__<variantId>.events.json
```

This file is a JSON array of `RuntimeEvent` objects and **must include** the emitted `recording:linked` events so tests can validate the run↔recording correlation.

Example (shape only):

```jsonc
[
  { "type": "flow:start", "flowName": "coder-reviewer", "timestamp": 0 },
  { "type": "node:start", "nodeId": "coder", "runId": "run-123", "timestamp": 1 },
  {
    "type": "recording:linked",
    "runId": "run-123",
    "nodeId": "coder",
    "invocation": 0,
    "providerType": "claude.agent",
    "recordingId": "eval__coder-reviewer.v1__simple-api__claude-default__coder__inv0",
    "mode": "record",
    "timestamp": 2
  }
]
```

### Code location (fixed)

All eval implementation lives under `packages/internal/core/src/eval/` and is exported by:

- `packages/internal/core/src/eval/index.ts`
- `packages/internal/core/src/index.ts`

`@open-harness/core` already re-exports `@internal/core`, so consumers use the eval API via `@open-harness/core`.

### Dataset + goldens location (fixed)

Datasets and committed goldens live in `@open-harness/core` test fixtures:

```
packages/open-harness/core/tests/fixtures/evals/
  datasets/   # JSON datasets (committed)
  goldens/    # FileRecordingStore directory (committed)
  reports/    # gitignored (local output only)
```

### Entry points (fixed)

We will add two scripts to `packages/open-harness/core/package.json` and run them via Turbo from repo root:

- `eval`: run dataset(s) and print a report (CI runs in `replay` mode).
- `record:eval-goldens`: record goldens + provenance fixtures (manual, live).

Script entry files live here:

```
packages/open-harness/core/scripts/eval.ts
packages/open-harness/core/scripts/record-eval-goldens.ts
```

Repo-root commands:

- `bun x turbo run eval --filter=@open-harness/core -- --dataset coder-reviewer.v1 --variants claude-default,opencode-default --mode replay`
- `bun x turbo run record:eval-goldens --filter=@open-harness/core -- --dataset coder-reviewer.v1 --variants claude-default --mode record`

---

## Completed DX (what it feels like to use)

This section shows the intended day-to-day developer experience once v0.2.0 evals are “done”.

### 1) Create a dataset (1 file)

Create `packages/open-harness/core/tests/fixtures/evals/datasets/coder-reviewer.v1.json`:

```jsonc
{
  "id": "coder-reviewer.v1",
  "workflowName": "coder-reviewer",
  "version": "1.0.0",
  "cases": [
    {
      "id": "simple-api",
      "name": "Simple express API",
      "input": { "task": "Build a hello world Express API" },
      "assertions": [
        { "type": "behavior.no_errors" },
        { "type": "output.contains", "path": "outputs.final.code", "value": "app.get" },
        { "type": "metric.latency_ms.max", "value": 30000 }
      ],
      "tags": ["smoke"]
    }
  ]
}
```

Notes:
- `path` is evaluated against a normalized `EvalArtifact` view that wraps `RunSnapshot` + any derived summary fields.
- This is intentionally workflow-agnostic: it doesn’t hardcode provider types.

### 2) Define variants (matrix) without editing workflows

In a small TS script (or in a test), define the variant matrix:

```ts
const variants: EvalVariant[] = [
  {
    id: "claude-default",
    providerTypeByNode: { coder: "claude.agent", reviewer: "claude.agent" },
    modelByNode: { coder: "sonnet", reviewer: "sonnet" },
    tags: ["baseline"],
  },
  {
    id: "opencode-default",
    providerTypeByNode: { coder: "opencode.agent", reviewer: "opencode.agent" },
    tags: ["candidate"],
  }
];
```

### 3) Run the dataset (record or replay)

In CI, the default mode is “replay if golden exists; otherwise record once (in a controlled workflow) and then replay forever”.

Canonical command (repo root):

- `bun x turbo run eval --filter=@open-harness/core -- --dataset coder-reviewer.v1 --variants claude-default,opencode-default --mode replay`

### 4) Compare to baseline & fail fast on regression

The engine produces a machine-readable result plus a Markdown summary:

- Pass rate per variant
- Assertion failures grouped by case/node
- Budget regressions (latency/cost/tokens)
- Judge scores (disabled by default; enabled explicitly)

CI gate example:

```ts
const result = await engine.runMatrix({
  dataset,
  variants,
  mode: "replay",
  baselineVariantId: "claude-default",
});

if (result.summary.regressions.length > 0) {
  throw new Error(result.report.markdown);
}
```

---

## How evals plug into workflows (the wiring, end-to-end)

Evals don’t “own” workflow execution. They orchestrate existing primitives:

1. Build a `FlowDefinition` for a case + variant (provider type/model/prompt selection happens here).
2. Create a `NodeRegistry` containing the node types referenced by the flow.
3. Create a `RunStore` (for runtime events + snapshots) and a `RecordingStore` (for provider recordings).
4. Execute via `createRuntime({ flow, registry, store: runStore })`.
5. Wrap provider traits in `withRecording()` based on mode:
   - record: write provider recordings
   - replay: read provider recordings and emit events without calling the provider
   - live: do not read/write provider recordings
6. Convert everything into an `EvalArtifact` and evaluate assertions + scorers.

### “Workflow factory” contract (what the eval engine needs from you)

In v0.2.0 the eval engine accepts a function responsible for producing runnable flows per dataset:

```ts
export type WorkflowFactory = (args: {
  datasetId: string;
  caseId: string;
  variantId: string;
  caseInput: unknown;
}) => {
  flow: FlowDefinition;
  register(registry: NodeRegistry, mode: "record" | "replay" | "live"): void;
  primaryOutputNodeId?: string;
};
```

The intent is: datasets are “data”, while the workflow factory is “code” that knows how to wire that dataset into a FlowDefinition and registry nodes.

### Provider recording IDs (pragmatic determinism for v0.2.0)

To make replay deterministic (and keep the provider recording schema unchanged), the runner will produce stable **per-invocation** recording IDs like:

```
eval__<datasetId>__<caseId>__<variantId>__<nodeId>__inv<invocation>
```

Then, when registering providers for the run, it uses those IDs:

```ts
const recordingId = `eval__${datasetId}__${caseId}__${variantId}__${nodeId}__inv${invocation}`;

const recordedTrait = withRecording(trait, {
  mode,
  store: recordingStore,
  recordingId,
  getInputHash: () => recordingId, // satisfies the core recording contract
  getMetadata: () => ({ model, tags: [`dataset:${datasetId}`, `case:${caseId}`, `variant:${variantId}`, `node:${nodeId}`] }),
});
```

This is the “glue” that makes replay, baselines, and variant comparisons straightforward.

### Known limitation (called out early so it doesn’t surprise us)

Node retries/loops mean you must treat provider recordings as **per-invocation**, not per node. The hybrid plan adopts an explicit `invocation` counter so recordings do not overwrite each other.

In addition, the hybrid plan adds a runtime indexing event (`recording:linked`) so we can always reconstruct “what happened” without relying on naming conventions alone.

---

## Implementation plan (Phases 6–8) with exact files

This section is the build plan for the locked decisions above. Implement it as written.

### Phase 6 — Eval core types (contracts + pure helpers)

**Add exactly these files**

```
packages/internal/core/src/eval/
  index.ts
  README.md
  types.ts
  dataset.ts
  assertions.ts
  scorers/
    index.ts
    latency.ts
    cost.ts
    tokens.ts
    similarity.ts
    llm-judge.ts
  cache.ts
```

**What each file contains (tight scope)**

- `types.ts`
  - `EvalDataset`, `EvalCase`, `EvalVariant`, `EvalMatrixRunOptions`
  - `EvalArtifact` (wraps `RunSnapshot`, `RuntimeEvent[]`, and the `recording:linked` index events for the run)
  - `Assertion` union types and `AssertionResult`
  - `Score`/`ScoreBreakdown` and `Scorer` interface
  - Deterministic IDs: `caseId`, `variantId`, `invocation`, and derived `recordingId` naming rules (see below)
  - Runtime index event types for eval provenance:
    - `recording:linked` payload shape (this is added to the runtime event union)
- `dataset.ts`
  - load/validate dataset from JSON (JSON is the only supported dataset format for v0.2.0)
  - dataset discovery conventions for `fixtures/evals/datasets/*.json`
- `assertions.ts`
  - `evaluateAssertions(artifact, assertions)`
  - output/path resolution helpers
  - metric extraction (`agent.durationMs`, `agent.totalCostUsd`, `agent.usage.*`) from `agent:complete` runtime events
- `scorers/*`
  - built-ins as pure functions over `EvalArtifact` or provider `Recording<TOutput>`
- `cache.ts`
  - judge cache interface + in-memory implementation (file-backed cache implemented in Phase 8)
- `README.md`
  - “how to add a dataset”, “how to run”, “how to add a scorer”

**Dataset schema (v0.2.0, JSON)**

Datasets are authored as JSON and validated by `dataset.ts`. This is the canonical shape the implementer should enforce:

```ts
export type EvalDataset = {
  id: string;                 // e.g. "coder-reviewer.v1"
  workflowName: string;       // maps to the workflow factory
  version: string;            // dataset version, not model version
  cases: EvalCase[];
};

export type EvalCase = {
  id: string;                 // stable, filesystem-safe
  name?: string;
  input: unknown;             // fed to workflowFactory
  assertions: Assertion[];
  tags?: string[];
};

export type EvalVariant = {
  id: string;                 // e.g. "claude-default"
  providerTypeByNode: Record<string, string>;
  modelByNode?: Record<string, string>;
  tags?: string[];
};
```

**Assertion types (v0.2.0)**

These are the assertion types supported by the dataset runner for v0.2.0 (string literal `type` values match the JSON you author):

```ts
export type Assertion =
  // Output assertions (paths evaluated against `EvalArtifactView`)
  | { type: "output.contains"; path: string; value: string }
  | { type: "output.equals"; path: string; value: unknown }

  // Metric budgets (derived from runtime events, primarily `agent:complete`)
  | { type: "metric.latency_ms.max"; value: number }
  | { type: "metric.total_cost_usd.max"; value: number }
  | { type: "metric.tokens.input.max"; value: number }
  | { type: "metric.tokens.output.max"; value: number }

  // Behavior assertions
  | { type: "behavior.no_errors" }
  | { type: "behavior.node_executed"; nodeId: string }
  | { type: "behavior.node_invocations.max"; nodeId: string; value: number };
```

**Metric extraction rules (v0.2.0)**

- Node metrics come from `agent:complete` events:
  - `durationMs` → latency
  - `totalCostUsd` → cost
  - `usage.inputTokens` / `usage.outputTokens` → tokens
- Node invocation alignment uses ordering:
  - For a given `nodeId`, the Nth `recording:linked` event corresponds to the Nth `agent:complete` event emitted by that node.
  - This is sufficient for v0.2.0 as long as provider nodes emit exactly one `agent:complete` per invocation (the adapter pattern already assumes a single completion).

**Deterministic recording ID rule (required)**

For any provider call that we want to evaluate, the eval runner sets `getInputHash`/`getRecordingId` in `withRecording()` so that recording IDs are stable and discoverable.

Example scheme (conceptual):

```
recordingId = `eval__${dataset.id}__${case.id}__${variant.id}__${nodeId}__inv${invocation}`
```

This is what makes replay stable and cheap. The runtime index event (`recording:linked`) makes the linkage queryable and future-proof.

**Modify existing files (Phase 6)**

To make the hybrid model real (and not just an eval-layer convention), extend the runtime event union to include `recording:linked`:

```
packages/internal/core/src/state/events.ts
```

This is the canonical place where runtime event payload shapes live today.

### What the “artifact view” looks like (so assertions are unambiguous)

`RunSnapshot` has `outputs` keyed by node id and `state` (workflow-level state). The eval engine provides a normalized view used by `output.*` assertions so dataset authors don’t have to memorize internal schemas.

Example (conceptual):

```ts
type EvalArtifactView = {
  runId: string;
  outputs: Record<string, unknown>;  // snapshot.outputs
  state: Record<string, unknown>;    // snapshot.state
  primaryOutput?: unknown;           // optional (configured per dataset/workflow)
  metrics: {
    workflow: { startedAt?: number; endedAt?: number; durationMs?: number };
    byNode: Record<string, { durationMs?: number; totalCostUsd?: number; inputTokens?: number; outputTokens?: number }>;
  };
  errors: { nodeErrors: Record<string, string[]> };
};
```

**Add tests**

```
packages/internal/core/tests/eval/
  assertions.test.ts
  dataset.test.ts
  scorers.test.ts
```

### Phase 7 — Eval engine (runner + comparison + reporting)

**Add exactly these files**

```
packages/internal/core/src/eval/
  engine.ts
  runner.ts
  compare.ts
  report.ts
  hooks.ts
```

**What each file does**

- `engine.ts`
  - `createEvalEngine({ recordingStore, runStore, registry, workflowFactory })`
  - wires together dataset loading, runner, scorers, comparison, report generation
- `runner.ts`
  - `runCase()` and `runDataset()`
  - `runMatrix()` to execute `cases x variants`
  - supports `mode: "record" | "replay" | "live"` (live means no replay; record means produce goldens; replay means must exist)
  - emits `recording:linked` runtime events for every provider invocation (record/replay/live), enabling RunStore indexing
- `compare.ts`
  - baseline comparisons at the assertion + metric level
  - `compareAcross()` for “dimension” comparisons (provider type / model / prompt id)
- `report.ts`
  - converts results to Markdown + JSON
  - includes “top regressions”, “top flakes”, “budget regressions”
- `hooks.ts`
  - `EvalHooks` adapters for `withRecording()` and/or runtime events (supported, not required for CI)
  - v0.2.0 scope: hooks are a thin bridge to run scorers and emit alerts; no ops system included
  - long-term: hooks and artifact extractors share the same indexing model (run → node invocation → recording + artifacts)

**Add tests**

```
packages/internal/core/tests/eval/
  runner.test.ts
  compare.test.ts
  report.test.ts
```

**Add integration tests (open-harness packages)**

The “realistic DX” should be validated where people will actually consume the public API:

```
packages/open-harness/core/tests/eval/
  eval-matrix.test.ts      # uses @open-harness/core (re-export) API
packages/open-harness/server/tests/integration/eval/
  eval-template.test.ts    # uses template provider + withRecording + RunStore/RecordingStore adapters
```

### Phase 8 — Integration, fixtures, docs, and landing the plane

Phase 8 is what makes this “real” instead of a library nobody trusts.

**8.1 Fixtures**

Add the eval fixture directory:

```
packages/open-harness/core/tests/fixtures/evals/
  datasets/
  goldens/
  reports/          # gitignored (local output only)
  provenance/       # committed (run events + index events captured during recording)
```

- Add a recording/fixture capture script (the repo currently references a pattern but does not have it implemented under `packages/sdk/scripts/`):

```
packages/open-harness/core/scripts/
  record-eval-goldens.ts
```

This script should:
- run a dataset in `mode: "record"` for specific variants,
- use `FileRecordingStore` pointing at `packages/open-harness/core/tests/fixtures/evals/goldens`,
- write a deterministic manifest for what got recorded (case/variant/node/invocation → recordingId).

Additionally, because we are adopting the hybrid plan:
- capture and assert the new `recording:linked` events in committed provenance fixtures so replay tests validate the correlation index.

**8.2 Docs consolidation (“one canonical doc”)**

- Update `specs/portable/03-patterns/evals-pattern.md` to match this plan’s DX and type names.
- Ensure any other eval-related plan doc is clearly marked as historical context, not canonical.

**8.3 Validation**

From repo root:
- `bun run typecheck`
- `bun run lint`
- `bun run test`

**8.4 Landing checklist (0.2.0 release readiness)**

- [ ] Phase 6: core types + unit tests merged and stable.
- [ ] Phase 7: engine runs `cases x variants` and produces a report.
- [ ] Deterministic replay proven by running the same dataset twice in replay mode with identical results.
- [ ] At least one real dataset exists in-repo (not fabricated) and passes in CI replay mode.
- [ ] LLM-as-judge scorer exists but is disabled by default and not required for CI; when enabled it uses an explicit flag and a cache.
- [ ] Docs updated so new users can: add dataset → run matrix → read report.

---

## Final “where everything fits” tree (end state)

This is the concrete “shape” of the repo once v0.2.0 evals are implemented, showing the relevant slices together.

```
packages/internal/core/
  src/
    recording/                 # existing
    persistence/               # existing
    runtime/                   # existing
    providers/                 # existing
    eval/                      # NEW (Phase 6/7)
      README.md
      index.ts
      types.ts
      dataset.ts
      assertions.ts
      cache.ts
      engine.ts
      runner.ts
      compare.ts
      report.ts
      hooks.ts
      scorers/
        index.ts
        latency.ts
        cost.ts
        tokens.ts
        similarity.ts
        llm-judge.ts
  tests/
    recording.test.ts          # existing
    eval/                      # NEW
      assertions.test.ts
      dataset.test.ts
      scorers.test.ts
      runner.test.ts
      compare.test.ts
      report.test.ts

packages/open-harness/core/
  tests/
    fixtures/
      evals/                   # NEW (Phase 8)
        datasets/
          coder-reviewer.v1.json
        goldens/
          recording-eval__coder-reviewer.v1__simple-api__claude-default__coder__inv0.json
          recording-eval__coder-reviewer.v1__simple-api__claude-default__coder__inv0.jsonl
        provenance/
          coder-reviewer.v1__claude-default.events.json
    eval/
      eval-matrix.test.ts      # NEW integration-ish DX test
  scripts/
    eval.ts                    # NEW (canonical entrypoint)
    record-eval-goldens.ts     # NEW (Phase 8)

packages/stores/
  recording-store/*            # existing (file/sqlite/testing)
  run-store/*                  # existing (sqlite/testing)
```

---

## Extensibility (post-v0.2.0, built on the same spine)

The hybrid model is deliberately designed so future “what did the agent do?” questions can be answered without provider-specific hacks. The spine is:

```
runId -> (nodeId, invocation) -> recordingId -> provider recording events/output
```

### File touch artifacts (planned post-v0.2.0)

Files touched are not provider-level; they are run-level artifacts emitted by host tools. The planned direction is:

1. Keep using `agent:tool` for raw tool calls (already exists).
2. Add one canonical artifact event type that is provider-agnostic:

```ts
type ArtifactFileEventPayload = {
  type: "artifact:file";
  runId: string;
  nodeId: string;
  invocation?: number;
  op: "read" | "write" | "delete";
  path: string;
  bytes?: number;
};
```

3. Use provenance capture to validate that file-touch artifacts are emitted correctly (same fixture approach as `recording:linked`).
