# Eval Architecture Options

## 🎯 The Challenge

We need evals at **TWO levels**:
1. **Provider-level** - "How good is this AI response?"
2. **Workflow-level** - "How good is this entire workflow execution?"

And the architecture must support:
- Recording (already designed)
- Replay (already designed)
- **Comparison** - Same input, different configs
- **Scoring** - Quality metrics (automated + human)
- **Regression testing** - Did we break something?
- **Optimization** - Cost vs quality tradeoffs

---

## 📊 Recording Structure (Foundation - Already Agreed)

We've locked in the recording infrastructure. Now we need to define how evals layer on top:

```
┌─────────────────────────────────────────────────────────────┐
│                    Workflow Recording                        │
│  id: "wf-123"                                               │
│  workflowId: "coder-reviewer"                               │
│  input: { task: "Build a REST API" }                        │
│  output: { code: "...", tests: "..." }                      │
│                                                              │
│  nodeRecordings: [                                          │
│    { nodeId: "coder", providerRecording: {...} },           │
│    { nodeId: "reviewer", providerRecording: {...} },        │
│    { nodeId: "coder", providerRecording: {...} },  // retry │
│  ]                                                          │
│                                                              │
│  stateSnapshots: [                                          │
│    { after: "coder", state: { code: "v1..." } },            │
│    { after: "reviewer", state: { feedback: "..." } },       │
│    { after: "coder", state: { code: "v2..." } },            │
│  ]                                                          │
│                                                              │
│  metrics: {                                                 │
│    totalDurationMs: 45000,                                  │
│    totalTokens: 15000,                                      │
│    totalCost: 0.15,                                         │
│    nodeCount: 3,                                            │
│    loopIterations: 2,                                       │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Five Eval Architecture Options

### **Option A: Eval as Post-Processing Pipeline**

**Concept:** Evals are completely separate from recording. You record first, then run evals later as a batch process.

```
Recording Phase:          Eval Phase:
┌──────────┐             ┌──────────┐     ┌──────────┐
│ Workflow │──record───▶ │ Recording│────▶│ Eval     │────▶ Scores
│   Run    │             │  Store   │     │ Pipeline │
└──────────┘             └──────────┘     └──────────┘
                                                │
                              ┌─────────────────┼─────────────────┐
                              ▼                 ▼                 ▼
                         ┌─────────┐      ┌─────────┐      ┌─────────┐
                         │ Latency │      │ Quality │      │ Cost    │
                         │ Scorer  │      │ Scorer  │      │ Scorer  │
                         └─────────┘      └─────────┘      └─────────┘
```

**API:**

```typescript
// Eval is a separate concern from recording
interface EvalPipeline {
  // Run a single eval
  evaluate(recording: WorkflowRecording, rubric: EvalRubric): Promise<EvalResult>;
  
  // Batch eval
  evaluateMany(recordings: WorkflowRecording[], rubric: EvalRubric): Promise<EvalResult[]>;
  
  // Compare two recordings
  compare(a: WorkflowRecording, b: WorkflowRecording, rubric: EvalRubric): Promise<ComparisonResult>;
}

// Rubric defines what to measure
interface EvalRubric {
  name: string;
  scorers: Scorer[];
  aggregation: "average" | "weighted" | "min" | "custom";
}

// Scorer is a function that produces a score
type Scorer = {
  name: string;
  level: "provider" | "node" | "workflow";
  score: (recording: WorkflowRecording | ProviderRecording) => Promise<Score>;
};

// Built-in scorers
const latencyScorer: Scorer = { name: "latency", level: "workflow", score: (r) => ... };
const costScorer: Scorer = { name: "cost", level: "workflow", score: (r) => ... };
const tokenScorer: Scorer = { name: "tokens", level: "provider", score: (r) => ... };

// LLM-as-judge scorer
function llmJudgeScorer(criteria: string, model?: string): Scorer;

// Human annotation scorer (async, requires human input)
function humanAnnotationScorer(prompt: string): Scorer;
```

**Usage:**

```typescript
// Define rubric
const codeQualityRubric: EvalRubric = {
  name: "Code Quality",
  scorers: [
    latencyScorer,
    costScorer,
    llmJudgeScorer("Rate the code quality from 1-10"),
    llmJudgeScorer("Does the code handle edge cases?"),
  ],
  aggregation: "weighted",
};

// Run evals on batch of recordings
const recordings = await store.list({ workflowId: "coder-reviewer" });
const results = await pipeline.evaluateMany(recordings, codeQualityRubric);

// Compare two configurations
const claudeRuns = await store.list({ workflowId: "coder-reviewer", providerType: "claude" });
const openCodeRuns = await store.list({ workflowId: "coder-reviewer", providerType: "opencode" });
const comparison = await pipeline.compare(claudeRuns[0], openCodeRuns[0], codeQualityRubric);
```

**Pros:**
- ✅ Simple mental model: record → eval (separate steps)
- ✅ Can run evals on historical data
- ✅ Scorers are composable
- ✅ Easy to add new scorers

**Cons:**
- ❌ No real-time scoring
- ❌ LLM-as-judge adds cost/latency
- ❌ Workflow-level scoring may miss context

**Score: 82/100**

---

### **Option B: Eval Hooks in Recording**

**Concept:** Evals are hooks that fire during recording. You can score in real-time as the workflow executes.

```
┌─────────────────────────────────────────────────────────────┐
│                    Recording + Eval                          │
│                                                              │
│  workflow.execute()                                         │
│       │                                                      │
│       ▼                                                      │
│  ┌─────────┐  onNodeComplete  ┌─────────┐                   │
│  │  Node   │─────────────────▶│ Eval    │──▶ Real-time     │
│  │  Runs   │                  │ Hooks   │    Scores        │
│  └─────────┘                  └─────────┘                   │
│       │                                                      │
│       ▼                                                      │
│  ┌─────────┐  onWorkflowComplete  ┌─────────┐              │
│  │ Workflow│──────────────────────▶│ Final   │──▶ Report   │
│  │ Done    │                       │ Eval    │              │
│  └─────────┘                       └─────────┘              │
└─────────────────────────────────────────────────────────────┘
```

**API:**

```typescript
interface EvalHooks {
  // Fire after each provider call
  onProviderComplete?: (recording: ProviderRecording) => Promise<Score | void>;
  
  // Fire after each node completes
  onNodeComplete?: (recording: NodeRecording, state: RunSnapshot) => Promise<Score | void>;
  
  // Fire when workflow completes
  onWorkflowComplete?: (recording: WorkflowRecording) => Promise<EvalResult>;
}

// Recording with hooks
const recordingProvider = withRecording(claudeTrait, {
  mode: "record",
  store,
  evalHooks: {
    onProviderComplete: async (rec) => {
      // Real-time quality check
      return await quickQualityScore(rec);
    },
    onWorkflowComplete: async (rec) => {
      // Full eval at end
      return await fullEval(rec);
    },
  },
});
```

**Pros:**
- ✅ Real-time feedback
- ✅ Can abort early on low scores
- ✅ Scores are attached to recordings
- ✅ Context available during eval

**Cons:**
- ❌ Eval logic coupled to recording
- ❌ Can't easily re-run evals on old data
- ❌ Hooks add latency to workflow

**Score: 78/100**

---

### **Option C: Eval Datasets + Test Suites**

**Concept:** Focus on creating and managing eval datasets. Recordings become test cases. Test suites define expected behavior.

```
┌─────────────────────────────────────────────────────────────┐
│                    Eval Dataset                              │
│                                                              │
│  name: "coder-reviewer-golden"                              │
│  version: "1.0"                                             │
│                                                              │
│  testCases: [                                               │
│    {                                                        │
│      id: "simple-api",                                      │
│      input: { task: "Build a hello world API" },            │
│      goldenRecording: {...},  // The "correct" answer       │
│      assertions: [                                          │
│        { type: "output_contains", value: "app.get" },       │
│        { type: "latency_under", value: 30000 },             │
│        { type: "cost_under", value: 0.10 },                 │
│      ],                                                     │
│    },                                                       │
│    {                                                        │
│      id: "complex-crud",                                    │
│      input: { task: "Build CRUD API with auth" },           │
│      goldenRecording: {...},                                │
│      assertions: [...],                                     │
│    },                                                       │
│  ]                                                          │
└─────────────────────────────────────────────────────────────┘
```

**API:**

```typescript
// Dataset management
interface EvalDataset {
  id: string;
  name: string;
  version: string;
  workflowId: string;
  testCases: TestCase[];
}

interface TestCase {
  id: string;
  input: unknown;
  goldenRecording?: WorkflowRecording;  // Optional "correct" answer
  assertions: Assertion[];
}

type Assertion =
  | { type: "output_contains"; path: string; value: unknown }
  | { type: "output_equals"; path: string; value: unknown }
  | { type: "latency_under"; value: number }
  | { type: "cost_under"; value: number }
  | { type: "tokens_under"; value: number }
  | { type: "no_errors" }
  | { type: "node_count"; min?: number; max?: number }
  | { type: "llm_judge"; criteria: string; minScore: number }
  | { type: "similarity_to_golden"; minScore: number };

// Test runner
interface EvalRunner {
  // Run a single test case
  runTest(workflow: WorkflowDefinition, testCase: TestCase): Promise<TestResult>;
  
  // Run all tests in dataset
  runDataset(workflow: WorkflowDefinition, dataset: EvalDataset): Promise<DatasetResult>;
  
  // Compare two versions against same dataset
  compareVersions(
    v1: WorkflowDefinition,
    v2: WorkflowDefinition,
    dataset: EvalDataset,
  ): Promise<VersionComparison>;
}

interface TestResult {
  testCaseId: string;
  passed: boolean;
  recording: WorkflowRecording;
  assertionResults: AssertionResult[];
  scores: Record<string, number>;
}

interface DatasetResult {
  datasetId: string;
  passRate: number;
  testResults: TestResult[];
  summary: {
    avgLatency: number;
    avgCost: number;
    avgTokens: number;
  };
}
```

**Usage:**

```typescript
// Define a test suite
const goldenDataset: EvalDataset = {
  id: "coder-reviewer-v1",
  name: "Coder-Reviewer Golden Tests",
  version: "1.0",
  workflowId: "coder-reviewer",
  testCases: [
    {
      id: "hello-world",
      input: { task: "Build a hello world Express API" },
      assertions: [
        { type: "output_contains", path: "code", value: "app.get" },
        { type: "output_contains", path: "code", value: "hello" },
        { type: "latency_under", value: 30000 },
        { type: "no_errors" },
      ],
    },
    {
      id: "with-middleware",
      input: { task: "Build an API with auth middleware" },
      assertions: [
        { type: "output_contains", path: "code", value: "middleware" },
        { type: "llm_judge", criteria: "Does the code properly validate JWT tokens?", minScore: 7 },
      ],
    },
  ],
};

// Run tests
const results = await runner.runDataset(coderReviewerWorkflow, goldenDataset);
console.log(`Pass rate: ${results.passRate * 100}%`);

// Compare versions
const comparison = await runner.compareVersions(workflowV1, workflowV2, goldenDataset);
console.log(`V1 pass rate: ${comparison.v1.passRate}`);
console.log(`V2 pass rate: ${comparison.v2.passRate}`);
```

**Pros:**
- ✅ Clear test/eval mental model
- ✅ Versioned datasets
- ✅ Regression testing built-in
- ✅ Golden tests for determinism
- ✅ Great for CI/CD

**Cons:**
- ❌ Need to create/maintain datasets
- ❌ Less flexible than ad-hoc scoring
- ❌ May not capture all quality dimensions

**Score: 88/100**

---

### **Option D: Multi-Level Eval Engine**

**Concept:** Layered eval system that naturally handles provider, node, and workflow levels. Each layer builds on the previous.

```
┌─────────────────────────────────────────────────────────────┐
│                    Workflow Eval                             │
│  - Aggregates node evals                                    │
│  - Cross-node consistency                                   │
│  - End-to-end quality                                       │
│  - Total cost/time/tokens                                   │
└───────────────────────────┬─────────────────────────────────┘
                            │ composed of
┌───────────────────────────▼─────────────────────────────────┐
│                    Node Eval                                 │
│  - State transformation quality                             │
│  - Input/output consistency                                 │
│  - Retries and error handling                               │
│  - Individual node metrics                                  │
└───────────────────────────┬─────────────────────────────────┘
                            │ composed of
┌───────────────────────────▼─────────────────────────────────┐
│                    Provider Eval                             │
│  - Response quality                                         │
│  - Latency                                                  │
│  - Token usage                                              │
│  - Cost                                                     │
│  - Tool usage patterns                                      │
└─────────────────────────────────────────────────────────────┘
```

**API:**

```typescript
// Multi-level eval engine
interface EvalEngine {
  // Provider level
  evaluateProvider(recording: ProviderRecording, config: ProviderEvalConfig): Promise<ProviderScore>;
  
  // Node level (includes provider eval + state eval)
  evaluateNode(recording: NodeRecording, config: NodeEvalConfig): Promise<NodeScore>;
  
  // Workflow level (includes all node evals + workflow-specific)
  evaluateWorkflow(recording: WorkflowRecording, config: WorkflowEvalConfig): Promise<WorkflowScore>;
}

// Config at each level
interface ProviderEvalConfig {
  latencyWeight: number;
  costWeight: number;
  qualityCriteria?: string[];  // For LLM-as-judge
}

interface NodeEvalConfig extends ProviderEvalConfig {
  stateValidation?: (before: unknown, after: unknown) => boolean;
  expectedOutputSchema?: ZodSchema;
}

interface WorkflowEvalConfig extends NodeEvalConfig {
  // Cross-node checks
  consistencyChecks?: ConsistencyCheck[];
  // End-to-end quality
  endToEndCriteria?: string[];
  // Expected behavior
  expectedNodeSequence?: string[];
  maxLoopIterations?: number;
}

// Scores at each level
interface ProviderScore {
  overall: number;  // 0-100
  breakdown: {
    latency: number;
    cost: number;
    quality: number;
    toolUsage: number;
  };
  metadata: { tokens: number; durationMs: number; cost: number };
}

interface NodeScore extends ProviderScore {
  stateTransformationScore: number;
  retryCount: number;
  errorHandlingScore: number;
}

interface WorkflowScore {
  overall: number;
  nodeScores: Record<string, NodeScore>;
  aggregateMetrics: {
    totalLatency: number;
    totalCost: number;
    totalTokens: number;
  };
  workflowSpecific: {
    consistencyScore: number;
    completionScore: number;
    efficiencyScore: number;  // Did it take optimal path?
  };
}
```

**Usage:**

```typescript
const engine = createEvalEngine();

// Provider-level eval (just the AI call)
const providerScore = await engine.evaluateProvider(
  recording.nodeRecordings[0].providerRecording,
  { latencyWeight: 0.3, costWeight: 0.3, qualityCriteria: ["code_quality"] }
);

// Node-level eval (AI call + state transformation)
const nodeScore = await engine.evaluateNode(
  recording.nodeRecordings[0],
  {
    latencyWeight: 0.3,
    costWeight: 0.3,
    stateValidation: (before, after) => after.code !== before.code,
  }
);

// Workflow-level eval (entire execution)
const workflowScore = await engine.evaluateWorkflow(recording, {
  latencyWeight: 0.2,
  costWeight: 0.2,
  endToEndCriteria: ["Does the final code work?", "Are all tests passing?"],
  expectedNodeSequence: ["coder", "reviewer", "coder"],  // Expected retry once
  maxLoopIterations: 3,
});

console.log(`Workflow score: ${workflowScore.overall}/100`);
console.log(`Coder node score: ${workflowScore.nodeScores["coder"].overall}/100`);
```

**Pros:**
- ✅ Natural hierarchy (provider → node → workflow)
- ✅ Can eval at any level independently
- ✅ Workflow eval includes context
- ✅ Good for debugging (drill down to problematic node)

**Cons:**
- ❌ More complex API
- ❌ Need to configure at multiple levels
- ❌ May over-engineer for simple use cases

**Score: 85/100**

---

### **Option E: Hybrid Eval System (Recommended ⭐)**

**Concept:** Combine the best of all approaches:
- **Dataset-driven testing** (from Option C) for CI/CD and regression
- **Multi-level scoring** (from Option D) for analysis
- **Post-processing pipeline** (from Option A) for batch evals
- **Optional hooks** (from Option B) for real-time monitoring

```
┌─────────────────────────────────────────────────────────────┐
│                    Eval System                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. DATASETS (for testing)                                  │
│     ├── Test suites with assertions                         │
│     ├── Golden recordings                                   │
│     └── Regression detection                                │
│                                                              │
│  2. SCORERS (for quality)                                   │
│     ├── Built-in: latency, cost, tokens                    │
│     ├── LLM-as-judge: quality criteria                     │
│     └── Custom: user-defined functions                      │
│                                                              │
│  3. COMPARISONS (for analysis)                              │
│     ├── Same workflow, different providers                  │
│     ├── Same workflow, different versions                   │
│     └── A/B testing support                                 │
│                                                              │
│  4. HOOKS (for real-time)                                   │
│     ├── Optional monitoring                                 │
│     └── Alert on low scores                                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Complete API:**

```typescript
// ═══════════════════════════════════════════════════════════
// DATASETS (Testing & Regression)
// ═══════════════════════════════════════════════════════════

interface EvalDataset {
  id: string;
  name: string;
  version: string;
  workflowId: string;
  testCases: TestCase[];
}

interface TestCase {
  id: string;
  name: string;
  input: unknown;
  assertions: Assertion[];
  golden?: WorkflowRecording;  // Optional golden recording
  tags?: string[];
}

// Rich assertion types
type Assertion =
  // Output assertions
  | { type: "output.contains"; path: string; value: unknown }
  | { type: "output.equals"; path: string; value: unknown }
  | { type: "output.matches"; path: string; pattern: RegExp }
  | { type: "output.schema"; path: string; schema: ZodSchema }
  
  // Metric assertions
  | { type: "metric.latency"; max: number }
  | { type: "metric.cost"; max: number }
  | { type: "metric.tokens"; max: number }
  
  // Behavior assertions
  | { type: "behavior.no_errors" }
  | { type: "behavior.node_executed"; nodeId: string }
  | { type: "behavior.node_count"; min?: number; max?: number }
  | { type: "behavior.loop_count"; max: number }
  
  // Quality assertions (LLM-as-judge)
  | { type: "quality.llm_judge"; criteria: string; minScore: number }
  | { type: "quality.similarity"; to: "golden"; minScore: number }
  
  // Custom assertion
  | { type: "custom"; fn: (recording: WorkflowRecording) => boolean | Promise<boolean> };

// ═══════════════════════════════════════════════════════════
// SCORERS (Quality Measurement)
// ═══════════════════════════════════════════════════════════

interface Scorer {
  name: string;
  level: "provider" | "node" | "workflow";
  score(recording: Recording): Promise<ScorerResult>;
}

interface ScorerResult {
  name: string;
  score: number;  // 0-100
  details?: Record<string, unknown>;
}

// Built-in scorers
const builtInScorers = {
  // Metrics (automatic, no LLM needed)
  latency: createMetricScorer("latency", (r) => r.metrics.durationMs),
  cost: createMetricScorer("cost", (r) => r.metrics.cost),
  tokens: createMetricScorer("tokens", (r) => r.metrics.tokens.total),
  
  // LLM-as-judge (requires LLM call)
  llmJudge: (criteria: string, model?: string) => createLLMScorer(criteria, model),
  
  // Similarity (to golden or another recording)
  similarity: (reference: WorkflowRecording) => createSimilarityScorer(reference),
};

// Custom scorer
function createCustomScorer(
  name: string,
  level: "provider" | "node" | "workflow",
  fn: (recording: Recording) => number | Promise<number>,
): Scorer;

// ═══════════════════════════════════════════════════════════
// EVAL ENGINE (Unified Interface)
// ═══════════════════════════════════════════════════════════

interface EvalEngine {
  // === Dataset Operations ===
  
  // Run a single test case
  runTest(
    workflow: WorkflowExecutor,
    testCase: TestCase,
  ): Promise<TestResult>;
  
  // Run entire dataset
  runDataset(
    workflow: WorkflowExecutor,
    dataset: EvalDataset,
  ): Promise<DatasetResult>;
  
  // === Scoring Operations ===
  
  // Score a recording
  score(
    recording: WorkflowRecording,
    scorers: Scorer[],
  ): Promise<ScoredRecording>;
  
  // Score at specific level
  scoreProvider(recording: ProviderRecording, scorers: Scorer[]): Promise<ProviderScore>;
  scoreNode(recording: NodeRecording, scorers: Scorer[]): Promise<NodeScore>;
  scoreWorkflow(recording: WorkflowRecording, scorers: Scorer[]): Promise<WorkflowScore>;
  
  // === Comparison Operations ===
  
  // Compare two recordings
  compare(
    a: WorkflowRecording,
    b: WorkflowRecording,
    scorers?: Scorer[],
  ): Promise<ComparisonResult>;
  
  // Compare across a dimension (e.g., provider type)
  compareAcross(
    recordings: WorkflowRecording[],
    dimension: "provider" | "workflowVersion" | "custom",
    scorers?: Scorer[],
  ): Promise<DimensionComparison>;
  
  // === Reporting ===
  
  report(
    recordings: WorkflowRecording[],
    options: ReportOptions,
  ): Promise<EvalReport>;
}

// Results
interface TestResult {
  testCaseId: string;
  passed: boolean;
  recording: WorkflowRecording;
  assertions: AssertionResult[];
  duration: number;
}

interface DatasetResult {
  datasetId: string;
  version: string;
  passRate: number;
  results: TestResult[];
  summary: {
    passed: number;
    failed: number;
    avgLatency: number;
    avgCost: number;
    avgTokens: number;
  };
}

interface ComparisonResult {
  winner: "a" | "b" | "tie";
  aScores: WorkflowScore;
  bScores: WorkflowScore;
  diff: {
    latency: number;  // a - b (negative = a is faster)
    cost: number;     // a - b (negative = a is cheaper)
    quality: number;  // a - b (positive = a is better)
  };
}

// ═══════════════════════════════════════════════════════════
// HOOKS (Real-time Monitoring - Optional)
// ═══════════════════════════════════════════════════════════

interface EvalHooks {
  // Fire after each provider call
  onProviderComplete?: (
    recording: ProviderRecording,
  ) => Promise<void | { alert?: string; score?: number }>;
  
  // Fire after workflow completes
  onWorkflowComplete?: (
    recording: WorkflowRecording,
  ) => Promise<void | EvalResult>;
}

// Attach hooks to recording wrapper
const monitoredProvider = withRecording(claudeTrait, {
  mode: "passthrough",
  store: productionStore,
  evalHooks: {
    onProviderComplete: async (rec) => {
      if (rec.metrics.cost > 0.10) {
        return { alert: "High cost provider call", score: 50 };
      }
    },
  },
});
```

**Usage Examples:**

```typescript
// ═══════════════════════════════════════════════════════════
// USE CASE 1: CI/CD Testing
// ═══════════════════════════════════════════════════════════

// Define test dataset
const regressionTests: EvalDataset = {
  id: "coder-reviewer-regression",
  name: "Coder-Reviewer Regression Tests",
  version: "1.0",
  workflowId: "coder-reviewer",
  testCases: [
    {
      id: "simple-api",
      name: "Simple Express API",
      input: { task: "Build a hello world Express API" },
      assertions: [
        { type: "output.contains", path: "code", value: "express" },
        { type: "output.contains", path: "code", value: "app.get" },
        { type: "metric.latency", max: 30000 },
        { type: "metric.cost", max: 0.10 },
        { type: "behavior.no_errors" },
      ],
    },
    {
      id: "with-tests",
      name: "API with unit tests",
      input: { task: "Build a REST API with Jest tests" },
      assertions: [
        { type: "output.contains", path: "code", value: "describe(" },
        { type: "quality.llm_judge", criteria: "Are the tests comprehensive?", minScore: 7 },
      ],
    },
  ],
};

// Run in CI
const results = await evalEngine.runDataset(coderReviewerWorkflow, regressionTests);

if (results.passRate < 1.0) {
  console.error("Regression tests failed!");
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════
// USE CASE 2: Provider Comparison (Claude vs OpenCode)
// ═══════════════════════════════════════════════════════════

// Record runs with both providers
const claudeRecordings = await runWithProvider(workflow, "claude.agent", testInputs);
const openCodeRecordings = await runWithProvider(workflow, "opencode.agent", testInputs);

// Compare
const comparison = await evalEngine.compareAcross(
  [...claudeRecordings, ...openCodeRecordings],
  "provider",
  [builtInScorers.latency, builtInScorers.cost, builtInScorers.llmJudge("code quality")],
);

console.log(`
Provider Comparison:
- Claude: avg latency ${comparison.byDimension["claude.agent"].avgLatency}ms, cost $${comparison.byDimension["claude.agent"].avgCost}
- OpenCode: avg latency ${comparison.byDimension["opencode.agent"].avgLatency}ms, cost $${comparison.byDimension["opencode.agent"].avgCost}
- Quality winner: ${comparison.qualityWinner}
`);

// ═══════════════════════════════════════════════════════════
// USE CASE 3: Workflow Version A/B Testing
// ═══════════════════════════════════════════════════════════

const v1Recordings = await store.list({ workflowVersion: "1.0" });
const v2Recordings = await store.list({ workflowVersion: "2.0" });

const abTest = await evalEngine.compare(
  v1Recordings[0],
  v2Recordings[0],
  [
    builtInScorers.latency,
    builtInScorers.cost,
    builtInScorers.llmJudge("overall quality"),
  ],
);

console.log(`A/B Test: ${abTest.winner === "b" ? "V2 wins!" : "V1 wins or tie"}`);

// ═══════════════════════════════════════════════════════════
// USE CASE 4: Quality Monitoring in Production
// ═══════════════════════════════════════════════════════════

const productionProvider = withRecording(claudeTrait, {
  mode: "passthrough",
  store: sqliteStore,
  evalHooks: {
    onWorkflowComplete: async (recording) => {
      // Quick quality check
      const score = await evalEngine.score(recording, [
        builtInScorers.cost,
        builtInScorers.llmJudge("user satisfaction"),
      ]);
      
      // Alert if low quality
      if (score.overall < 70) {
        await alertOps("Low quality workflow detected", { recordingId: recording.id });
      }
      
      // Store score for trending
      await metricsDB.insert({
        timestamp: Date.now(),
        recordingId: recording.id,
        score: score.overall,
      });
    },
  },
});

// ═══════════════════════════════════════════════════════════
// USE CASE 5: Generate Report
// ═══════════════════════════════════════════════════════════

const lastWeekRecordings = await store.list({
  startedAfter: Date.now() - 7 * 24 * 60 * 60 * 1000,
});

const report = await evalEngine.report(lastWeekRecordings, {
  groupBy: ["workflowId", "providerType"],
  metrics: ["latency", "cost", "tokens"],
  includeScores: true,
  scorers: [builtInScorers.llmJudge("output quality")],
});

console.log(report.markdown());  // Generate markdown report
```

**How This Architecture Supports Workflow-Level Evals:**

1. **WorkflowRecording captures everything** - All node recordings, state snapshots, cross-node interactions

2. **Assertions can check workflow behavior** - Node sequences, loop counts, state transformations

3. **Scorers work at any level** - Provider, node, or workflow

4. **Comparisons are workflow-aware** - Compare entire workflow executions, not just individual calls

5. **Golden recordings are full workflows** - Capture expected behavior for entire workflow

**Pros:**
- ✅ Unified system for all eval needs
- ✅ Dataset-driven for CI/CD
- ✅ Multi-level scoring
- ✅ Comparison built-in
- ✅ Optional real-time hooks
- ✅ Supports both provider AND workflow evals
- ✅ Extensible with custom scorers

**Cons:**
- ❌ More complex than simple approaches
- ❌ LLM-as-judge adds cost
- ❌ Need to design good test cases

**Score: 94/100**

---

## 🎯 My Recommendation: Option E (Hybrid Eval System)

**Why:**

1. **Covers all use cases** - Testing, comparison, monitoring, optimization
2. **Works at both levels** - Provider evals AND workflow evals
3. **Progressive complexity** - Start simple (assertions), add LLM-as-judge later
4. **Future-proof** - Can add new scorers, assertions, comparison dimensions
5. **Evidence of workflow support:**
   - WorkflowRecording includes full node sequence
   - Assertions can check cross-node behavior
   - Scorers aggregate across nodes
   - Golden recordings capture expected workflow behavior

---

## 📋 Updated Implementation Plan

### Recording Infrastructure (Already Agreed)
- Recording format
- RecordingStore interface
- withRecording wrapper
- Provider trait + adapter

### Eval Infrastructure (New - Option E)
**Phase 1: Core Types (2 hours)**
- Assertion types
- Scorer interface
- TestCase/EvalDataset types

**Phase 2: Built-in Scorers (2 hours)**
- Latency, cost, tokens scorers
- Similarity scorer
- Custom scorer factory

**Phase 3: Dataset Runner (3 hours)**
- runTest / runDataset
- Assertion evaluation
- TestResult / DatasetResult

**Phase 4: LLM-as-Judge Scorer (2 hours)**
- llmJudge scorer
- Configurable model
- Caching for efficiency

**Phase 5: Comparison Engine (2 hours)**
- compare two recordings
- compareAcross dimension
- Winner determination

**Phase 6: Hooks (Optional, 1 hour)**
- onProviderComplete
- onWorkflowComplete

**Total Eval Work: ~12 hours**
**Total Project: ~32-39 hours**

---

Ready to lock this in?