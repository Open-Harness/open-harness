# P0-6: Signal-Native Eval System

**Status:** Specification Complete
**Created:** 2026-01-10
**Author:** Claude Opus 4.5

---

## Executive Summary

Build a declarative eval system that leverages Open Harness's signal architecture to enable assertions on execution trajectories, intermediate state, agent causality, and metrics — capabilities that traditional eval systems (which only see inputs/outputs) cannot provide.

**Core Principle:** Assertions are data, not code.

---

## Why Signals Change Everything

Traditional eval systems see this:
```
Input → [black box] → Output
```

Open Harness sees this:
```
Input → harness:start → agent:activated → provider:start → text:delta →
        provider:end → state:changed → agent:activated → ... → harness:end
```

This enables assertions that competitors **cannot do**:
- **Trajectory assertions** — Did agents execute in the right order?
- **Snapshot assertions** — What was the state mid-execution?
- **Causality assertions** — Which agent triggered which action?
- **Intermediate assertions** — Did the right signals fire along the way?

---

## Architecture

### The Eval Pyramid

```
Level 5: Comparison/Regression
         ├─ baseline vs candidate
         └─ detect regressions, block PRs
                    │
Level 4: Matrix (variants × cases)
         ├─ cross-product testing
         └─ find optimal prompt/model/provider
                    │
Level 3: Dataset (many cases)
         ├─ aggregate pass rate
         └─ percentile metrics (p50, p95)
                    │
Level 2: Case (single input)
         ├─ multiple assertions
         └─ full signal capture
                    │
Level 1: Assertion (single check)
         └─ signal.contains, metric.latency, etc.
```

### Package Structure

```
packages/
├── eval/                         # @open-harness/eval
│   ├── src/
│   │   ├── assertions/
│   │   │   ├── types.ts         # SignalAssertion union type
│   │   │   ├── signal.ts        # contains, not, count, trajectory
│   │   │   ├── snapshot.ts      # at, final
│   │   │   ├── agent.ts         # activated, completed, causedBy
│   │   │   ├── metric.ts        # latency, cost, tokens
│   │   │   ├── output.ts        # contains, matches, json
│   │   │   ├── llm.ts           # judge (LLM-as-Judge)
│   │   │   ├── compose.ts       # all, any, not
│   │   │   └── evaluate.ts      # evaluateAssertion()
│   │   ├── runners/
│   │   │   ├── case.ts          # runCase()
│   │   │   ├── dataset.ts       # runDataset()
│   │   │   └── matrix.ts        # runMatrix()
│   │   ├── comparison/
│   │   │   ├── compare.ts       # compare()
│   │   │   └── types.ts         # Regression, Improvement
│   │   ├── reports/
│   │   │   ├── markdown.ts
│   │   │   └── json.ts
│   │   ├── loader/
│   │   │   ├── yaml.ts          # loadDataset()
│   │   │   └── schema.ts        # YAML validation with Zod
│   │   ├── types.ts             # EvalCase, DatasetResult, etc.
│   │   └── index.ts
│   ├── tests/
│   └── package.json
```

---

## Type Definitions

### SignalAssertion Union Type

```typescript
// ============================================================================
// Signal Assertions
// ============================================================================

/** Signal exists matching pattern */
export type SignalContainsAssertion = {
  type: 'signal.contains';
  pattern: string;                    // Glob pattern (e.g., "agent:*", "tool:**")
  payload?: Record<string, unknown>;  // Partial payload match
};

/** Signal does NOT exist */
export type SignalNotAssertion = {
  type: 'signal.not';
  pattern: string;
};

/** Count signals matching pattern */
export type SignalCountAssertion = {
  type: 'signal.count';
  pattern: string;
  min?: number;
  max?: number;
  exact?: number;
};

/** Signals appear in specific order (the killer feature) */
export type SignalTrajectoryAssertion = {
  type: 'signal.trajectory';
  patterns: (string | { pattern: string; payload?: Record<string, unknown> })[];
  strict?: boolean;  // true = no unmatched signals between patterns
};

/** First matching signal has expected properties */
export type SignalFirstAssertion = {
  type: 'signal.first';
  pattern: string;
  payload?: Record<string, unknown>;
};

/** Last matching signal has expected properties */
export type SignalLastAssertion = {
  type: 'signal.last';
  pattern: string;
  payload?: Record<string, unknown>;
};

// ============================================================================
// Snapshot Assertions (mid-execution state inspection)
// ============================================================================

/** State at point after specific signal fires */
export type SnapshotAtAssertion = {
  type: 'snapshot.at';
  afterSignal: string;
  path: string;  // Dot notation: "analysis.confidence" or "files[0].path"
  value?: unknown | ValueMatcher;
  exists?: boolean;
};

/** Final state check */
export type SnapshotFinalAssertion = {
  type: 'snapshot.final';
  path: string;
  value?: unknown | ValueMatcher;
  exists?: boolean;
};

/** Value matchers for numeric/string comparisons */
export type ValueMatcher =
  | { gte: number }
  | { lte: number }
  | { gt: number }
  | { lt: number }
  | { between: [number, number] }
  | { contains: string }
  | { startsWith: string }
  | { endsWith: string }
  | { matches: string };  // regex

// ============================================================================
// Agent Assertions
// ============================================================================

/** Agent activated N times */
export type AgentActivatedAssertion = {
  type: 'agent.activated';
  agentId: string;
  count?: number;  // default: >= 1
  min?: number;
  max?: number;
};

/** Agent completed successfully (no error signal) */
export type AgentCompletedAssertion = {
  type: 'agent.completed';
  agentId: string;
};

/** Agent was triggered by specific signal */
export type AgentCausedByAssertion = {
  type: 'agent.causedBy';
  agentId: string;
  triggerPattern: string;
};

/** Agent emitted specific signal */
export type AgentEmittedAssertion = {
  type: 'agent.emitted';
  agentId: string;
  signal: string;
};

/** Agent skipped (when guard returned false) */
export type AgentSkippedAssertion = {
  type: 'agent.skipped';
  agentId: string;
  reason?: string;
};

// ============================================================================
// Metric Assertions
// ============================================================================

export type MetricLatencyAssertion = {
  type: 'metric.latency.max' | 'metric.latency.min';
  value: number;  // milliseconds
};

export type MetricCostAssertion = {
  type: 'metric.cost.max' | 'metric.cost.min';
  value: number;  // USD
};

export type MetricTokensAssertion = {
  type: 'metric.tokens.max' | 'metric.tokens.min';
  value: number;
  field?: 'input' | 'output' | 'total';  // default: total
};

export type MetricActivationsAssertion = {
  type: 'metric.activations';
  min?: number;
  max?: number;
  exact?: number;
};

// ============================================================================
// Output Assertions
// ============================================================================

export type OutputContainsAssertion = {
  type: 'output.contains';
  text: string;
  caseSensitive?: boolean;  // default: true
};

export type OutputNotContainsAssertion = {
  type: 'output.notContains';
  text: string;
  caseSensitive?: boolean;
};

export type OutputMatchesAssertion = {
  type: 'output.matches';
  regex: string;
  flags?: string;
};

export type OutputJsonAssertion = {
  type: 'output.json';
  schema: ZodType;  // Runtime Zod schema
};

export type OutputLengthAssertion = {
  type: 'output.length';
  min?: number;
  max?: number;
};

// ============================================================================
// Tool Assertions (for coding agents)
// ============================================================================

export type ToolCalledAssertion = {
  type: 'tool.called';
  name: string;
  count?: number;
  min?: number;
  max?: number;
};

export type ToolNotCalledAssertion = {
  type: 'tool.notCalled';
  name: string;
};

export type ToolCalledWithAssertion = {
  type: 'tool.calledWith';
  name: string;
  args: Record<string, unknown>;  // Partial match
};

export type ToolSequenceAssertion = {
  type: 'tool.sequence';
  tools: string[];  // Tools called in this order
};

// ============================================================================
// LLM-as-Judge
// ============================================================================

export type LLMJudgeAssertion = {
  type: 'llm.judge';
  criteria: string[];           // What to evaluate
  rubric?: string;              // Detailed grading instructions
  minScore: number;             // 0-1 threshold to pass
  model?: string;               // Judge model (default: claude-sonnet-4-20250514)
  temperature?: number;         // default: 0
};

// ============================================================================
// Composition
// ============================================================================

export type AllAssertion = {
  type: 'all';
  assertions: SignalAssertion[];
};

export type AnyAssertion = {
  type: 'any';
  assertions: SignalAssertion[];
};

export type NotAssertion = {
  type: 'not';
  assertion: SignalAssertion;
};

// ============================================================================
// Union Type
// ============================================================================

export type SignalAssertion =
  // Signal
  | SignalContainsAssertion | SignalNotAssertion | SignalCountAssertion
  | SignalTrajectoryAssertion | SignalFirstAssertion | SignalLastAssertion
  // Snapshot
  | SnapshotAtAssertion | SnapshotFinalAssertion
  // Agent
  | AgentActivatedAssertion | AgentCompletedAssertion | AgentCausedByAssertion
  | AgentEmittedAssertion | AgentSkippedAssertion
  // Metric
  | MetricLatencyAssertion | MetricCostAssertion | MetricTokensAssertion | MetricActivationsAssertion
  // Output
  | OutputContainsAssertion | OutputNotContainsAssertion | OutputMatchesAssertion
  | OutputJsonAssertion | OutputLengthAssertion
  // Tool
  | ToolCalledAssertion | ToolNotCalledAssertion | ToolCalledWithAssertion | ToolSequenceAssertion
  // LLM Judge
  | LLMJudgeAssertion
  // Composition
  | AllAssertion | AnyAssertion | NotAssertion;
```

### Case & Dataset Types

```typescript
export interface EvalCase<TState = unknown> {
  /** Unique case identifier */
  id: string;
  /** Human-readable name */
  name?: string;
  /** Description of what this case tests */
  description?: string;
  /** Initial state for runReactive */
  input: TState;
  /** Assertions to evaluate */
  assertions: SignalAssertion[];
  /** Tags for filtering (e.g., ["smoke", "regression", "edge-case"]) */
  tags?: string[];
  /** Per-case timeout override */
  timeout?: number;
  /** Skip this case (keeps in file but doesn't run) */
  skip?: boolean;
  /** Only run this case (for debugging) */
  only?: boolean;
}

export interface EvalDataset<TState = unknown> {
  /** Dataset name */
  name: string;
  /** Description */
  description?: string;
  /** Assertions applied to ALL cases (combined with case-specific) */
  defaultAssertions?: SignalAssertion[];
  /** Default timeout for all cases */
  defaultTimeout?: number;
  /** The test cases */
  cases: EvalCase<TState>[];
  /** Arbitrary metadata */
  metadata?: Record<string, unknown>;
}
```

### Result Types

```typescript
export interface AssertionResult {
  assertion: SignalAssertion;
  passed: boolean;
  message: string;
  expected?: unknown;
  actual?: unknown;
  /** For trajectory assertions, shows the actual sequence */
  trajectory?: string[];
  /** Duration to evaluate this assertion */
  evaluationMs?: number;
}

export interface CaseResult<TState = unknown> {
  caseId: string;
  name?: string;
  passed: boolean;
  /** Individual assertion results */
  assertions: AssertionResult[];
  /** All signals emitted during execution */
  signals: Signal[];
  /** Final state after execution */
  finalState: TState;
  /** Execution metrics */
  metrics: CaseMetrics;
  /** Error if execution failed */
  error?: Error;
  /** Recording ID for replay/debugging */
  recordingId?: string;
  /** Whether case was skipped */
  skipped?: boolean;
  /** Duration of case execution */
  durationMs: number;
}

export interface CaseMetrics {
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  activations: number;
}

export interface DatasetResult<TState = unknown> {
  name: string;
  totalCases: number;
  passedCases: number;
  failedCases: number;
  skippedCases: number;
  passRate: number;
  /** Individual case results */
  cases: CaseResult<TState>[];
  /** Aggregate metrics across all cases */
  aggregateMetrics: AggregateMetrics;
  /** Total duration of eval run */
  durationMs: number;
  /** ISO timestamp when eval started */
  startedAt: string;
  /** ISO timestamp when eval completed */
  completedAt: string;
}

export interface AggregateMetrics {
  avgLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  totalCost: number;
  avgCostPerCase: number;
  totalTokens: number;
  avgTokensPerCase: number;
  totalActivations: number;
}
```

### Comparison Types

```typescript
export interface Comparison {
  baseline: DatasetResult;
  candidate: DatasetResult;

  /** Cases that passed in baseline but failed in candidate */
  regressions: Regression[];
  /** Cases that failed in baseline but passed in candidate */
  improvements: Improvement[];
  /** Cases with same pass/fail status */
  unchanged: string[];
  /** Cases in candidate but not in baseline */
  newCases: string[];
  /** Cases in baseline but not in candidate */
  removedCases: string[];

  summary: ComparisonSummary;
}

export interface Regression {
  caseId: string;
  caseName?: string;
  type: 'pass_to_fail' | 'metric_degraded';
  description: string;
  baseline: { passed: boolean; value?: number };
  candidate: { passed: boolean; value?: number };
  delta?: number;
  /** Critical regressions block merge */
  severity: 'critical' | 'warning';
  /** Which assertions failed */
  failedAssertions?: AssertionResult[];
}

export interface Improvement {
  caseId: string;
  caseName?: string;
  type: 'fail_to_pass' | 'metric_improved';
  description: string;
  baseline: { passed: boolean; value?: number };
  candidate: { passed: boolean; value?: number };
  delta?: number;
}

export interface ComparisonSummary {
  passRateDelta: number;        // positive = better
  avgLatencyDeltaMs: number;    // negative = better
  avgLatencyDeltaPct: number;   // percentage change
  costDelta: number;            // negative = better
  costDeltaPct: number;
  verdict: 'better' | 'worse' | 'equivalent' | 'mixed';
  /** Should this block a PR merge? */
  shouldBlock: boolean;
  blockReason?: string;
}
```

### Matrix Types

```typescript
export interface HarnessVariant<TState> {
  /** Unique variant identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** The harness factory to use */
  factory: HarnessFactory<TState>;
  /** Agents to run */
  agents: Record<string, ScopedReactiveAgent<unknown, TState>>;
  /** Provider override for this variant */
  provider?: SignalProvider;
  /** Metadata (prompt version, model name, etc.) */
  metadata?: Record<string, unknown>;
}

export interface MatrixResult<TState = unknown> {
  /** Results for each variant */
  variants: VariantResult<TState>[];
  /** Cross-variant comparison */
  comparison: VariantComparison;
  /** Recommended variant (if determinable) */
  recommendation?: VariantRecommendation;
  /** Total duration */
  durationMs: number;
}

export interface VariantResult<TState = unknown> {
  variantId: string;
  variantName: string;
  result: DatasetResult<TState>;
  metadata?: Record<string, unknown>;
}

export interface VariantComparison {
  /** Variant IDs sorted by pass rate (best first) */
  byPassRate: string[];
  /** Variant IDs sorted by cost (cheapest first) */
  byCost: string[];
  /** Variant IDs sorted by latency (fastest first) */
  byLatency: string[];
  /** Variants on the efficiency frontier (best tradeoffs) */
  paretoFrontier: string[];
}

export interface VariantRecommendation {
  variantId: string;
  reason: string;
  tradeoffs?: string[];
  confidence: 'high' | 'medium' | 'low';
}
```

---

## API Reference

### Assertion Evaluation

```typescript
/**
 * Evaluate a single assertion against execution results.
 *
 * @param assertion - The assertion to evaluate
 * @param signals - Signal stream from execution
 * @param result - Full harness result (for state/metrics access)
 * @returns AssertionResult with pass/fail and details
 */
function evaluateAssertion(
  assertion: SignalAssertion,
  signals: readonly Signal[],
  result: ReactiveHarnessResult<unknown>
): AssertionResult;

/**
 * Evaluate multiple assertions, returning all results.
 */
function evaluateAssertions(
  assertions: SignalAssertion[],
  signals: readonly Signal[],
  result: ReactiveHarnessResult<unknown>
): AssertionResult[];
```

### Runners

```typescript
export interface RunCaseOptions {
  /** Provider to use (required if agents don't specify) */
  provider?: SignalProvider;
  /** Recording options for signal capture */
  recording?: SignalRecordingOptions;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Timeout override */
  timeout?: number;
  /** Callback after each case (for progress reporting) */
  onCaseComplete?: (result: CaseResult) => void;
}

export interface RunDatasetOptions extends RunCaseOptions {
  /** Run cases in parallel (default: false) */
  parallel?: boolean;
  /** Max concurrent cases when parallel=true */
  concurrency?: number;
  /** Filter to specific tags */
  tags?: string[];
  /** Filter to specific case IDs */
  caseIds?: string[];
  /** Stop on first failure */
  failFast?: boolean;
}

export interface RunMatrixOptions extends RunDatasetOptions {
  /** Callback after each variant completes */
  onVariantComplete?: (result: VariantResult) => void;
}

/**
 * Run a single eval case.
 */
async function runCase<TState>(
  factory: HarnessFactory<TState>,
  agents: Record<string, ScopedReactiveAgent<unknown, TState>>,
  evalCase: EvalCase<TState>,
  options?: RunCaseOptions
): Promise<CaseResult<TState>>;

/**
 * Run an entire dataset.
 */
async function runDataset<TState>(
  factory: HarnessFactory<TState>,
  agents: Record<string, ScopedReactiveAgent<unknown, TState>>,
  dataset: EvalDataset<TState>,
  options?: RunDatasetOptions
): Promise<DatasetResult<TState>>;

/**
 * Run a matrix of variants × cases.
 */
async function runMatrix<TState>(
  variants: HarnessVariant<TState>[],
  dataset: EvalDataset<TState>,
  options?: RunMatrixOptions
): Promise<MatrixResult<TState>>;
```

### Comparison

```typescript
export interface CompareOptions {
  /** Minimum pass rate delta to consider "better" (default: 0.05 = 5%) */
  passRateThreshold?: number;
  /** Minimum latency delta % to consider significant (default: 0.10 = 10%) */
  latencyThreshold?: number;
  /** Minimum cost delta % to consider significant (default: 0.10 = 10%) */
  costThreshold?: number;
  /** Pass-to-fail regressions are critical (default: true) */
  criticalOnPassToFail?: boolean;
}

/**
 * Compare baseline and candidate results.
 */
function compare(
  baseline: DatasetResult,
  candidate: DatasetResult,
  options?: CompareOptions
): Comparison;
```

### Reports

```typescript
export interface ReportOptions {
  /** Include full signal traces (verbose) */
  includeSignals?: boolean;
  /** Include assertion details for passing tests */
  includePassingDetails?: boolean;
  /** Max cases to show in detail (default: 10) */
  maxCasesInDetail?: number;
}

/**
 * Generate a Markdown report.
 */
function generateMarkdownReport(
  result: DatasetResult | MatrixResult | Comparison,
  options?: ReportOptions
): string;

/**
 * Generate JSON for dashboard consumption.
 */
function generateJSONReport(
  result: DatasetResult | MatrixResult | Comparison,
  options?: ReportOptions
): object;
```

### Persistence

```typescript
/**
 * Load a dataset from YAML file.
 */
async function loadDataset<TState>(path: string): Promise<EvalDataset<TState>>;

/**
 * Save a dataset to YAML file.
 */
async function saveDataset<TState>(
  dataset: EvalDataset<TState>,
  path: string
): Promise<void>;

/**
 * Save eval results to JSON file.
 */
async function saveResult(
  result: DatasetResult | MatrixResult,
  path: string
): Promise<void>;

/**
 * Load eval results from JSON file.
 */
async function loadResult<T = DatasetResult>(path: string): Promise<T>;
```

---

## Examples

### Example 1: Code Review Agent

A two-agent workflow where a reviewer analyzes code and a fixer proposes corrections.

```yaml
# evals/code-review-agent.yaml
name: Code Review Agent Eval
description: Tests the code review + fix suggestion workflow

defaultAssertions:
  - type: metric.latency.max
    value: 30000
  - type: signal.not
    pattern: "error:*"
  - type: signal.trajectory
    patterns:
      - harness:start
      - agent:activated
      - harness:end

cases:
  # ============================================================================
  # Security Vulnerabilities
  # ============================================================================

  - id: sql-injection
    name: Detects SQL injection vulnerability
    description: Should identify string interpolation in SQL queries as dangerous
    tags: [security, sql, critical]
    input:
      code: |
        async function getUser(userId) {
          const query = `SELECT * FROM users WHERE id = ${userId}`;
          return db.query(query);
        }
      language: typescript
    assertions:
      # Core detection
      - type: output.contains
        text: injection
        caseSensitive: false
      - type: output.matches
        regex: "SQL|parameterized|prepared statement"
        flags: i

      # Agent workflow validation
      - type: agent.activated
        agentId: reviewer
      - type: agent.emitted
        agentId: reviewer
        signal: review:complete

      # The fixer should be triggered by the review
      - type: agent.causedBy
        agentId: fixer
        triggerPattern: review:complete

      # Trajectory: review must complete before fix is proposed
      - type: signal.trajectory
        patterns:
          - harness:start
          - { pattern: agent:activated, payload: { agent: reviewer } }
          - review:complete
          - { pattern: agent:activated, payload: { agent: fixer } }
          - fix:proposed
          - harness:end

  - id: xss-vulnerability
    name: Detects XSS vulnerability
    tags: [security, xss, critical]
    input:
      code: |
        function renderComment(comment) {
          document.getElementById('comments').innerHTML = comment.text;
        }
      language: javascript
    assertions:
      - type: output.contains
        text: XSS
        caseSensitive: false
      - type: any
        assertions:
          - type: output.contains
            text: textContent
          - type: output.contains
            text: sanitize
          - type: output.contains
            text: escape

  - id: path-traversal
    name: Detects path traversal vulnerability
    tags: [security, filesystem]
    input:
      code: |
        app.get('/files/:filename', (req, res) => {
          const filepath = path.join('/uploads', req.params.filename);
          res.sendFile(filepath);
        });
      language: javascript
    assertions:
      - type: output.matches
        regex: "path traversal|directory traversal|\\.\\."
        flags: i
      - type: output.contains
        text: "../"

  # ============================================================================
  # Bug Detection
  # ============================================================================

  - id: division-by-zero
    name: Catches potential division by zero
    tags: [bugs, math]
    input:
      code: |
        function calculateAverage(numbers) {
          const sum = numbers.reduce((a, b) => a + b, 0);
          return sum / numbers.length;
        }
      language: typescript
    assertions:
      - type: output.matches
        regex: "division by zero|empty array|length.*0"
        flags: i
      - type: agent.completed
        agentId: reviewer

  - id: null-dereference
    name: Catches null pointer dereference
    tags: [bugs, null-safety]
    input:
      code: |
        async function getUsername(userId) {
          const user = await db.findUser(userId);
          return user.name;
        }
      language: typescript
    assertions:
      - type: output.matches
        regex: "null|undefined|optional chaining|\\?"
        flags: i
      - type: any
        assertions:
          - type: output.contains
            text: "?."
          - type: output.contains
            text: "if (user)"

  - id: race-condition
    name: Detects potential race condition
    tags: [bugs, concurrency, advanced]
    input:
      code: |
        let counter = 0;

        async function incrementCounter() {
          const current = counter;
          await delay(100);
          counter = current + 1;
        }
      language: typescript
    assertions:
      - type: output.matches
        regex: "race condition|atomic|mutex|lock"
        flags: i

  # ============================================================================
  # Code Quality
  # ============================================================================

  - id: unused-variable
    name: Identifies unused variables
    tags: [quality, cleanup]
    input:
      code: |
        function processData(input) {
          const temp = input.toLowerCase();
          const unused = 42;
          return temp.trim();
        }
      language: typescript
    assertions:
      - type: output.contains
        text: unused

  - id: magic-numbers
    name: Flags magic numbers
    tags: [quality, readability]
    input:
      code: |
        function calculateDiscount(price) {
          if (price > 100) {
            return price * 0.9;
          }
          return price * 0.95;
        }
      language: typescript
    assertions:
      - type: output.matches
        regex: "magic number|constant|named"
        flags: i

  # ============================================================================
  # Negative Cases (Should NOT Flag)
  # ============================================================================

  - id: clean-code-no-issues
    name: Does not flag clean, secure code
    tags: [negative, false-positive]
    input:
      code: |
        async function getUser(userId: string): Promise<User | null> {
          const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
          return user ?? null;
        }
      language: typescript
    assertions:
      # Should NOT find security issues
      - type: output.notContains
        text: injection
        caseSensitive: false
      - type: output.notContains
        text: vulnerability
        caseSensitive: false
      # Should still complete the workflow
      - type: agent.completed
        agentId: reviewer
      # Fixer might still activate but shouldn't propose security fixes
      - type: signal.contains
        pattern: review:complete

  # ============================================================================
  # Edge Cases
  # ============================================================================

  - id: empty-function
    name: Handles empty function gracefully
    tags: [edge-case]
    input:
      code: |
        function placeholder() {
          // TODO: implement
        }
      language: typescript
    assertions:
      - type: agent.completed
        agentId: reviewer
      - type: metric.latency.max
        value: 10000

  - id: very-long-file
    name: Handles large files within timeout
    tags: [edge-case, performance]
    timeout: 60000
    input:
      code: "[200 lines of code here]"
      language: typescript
    assertions:
      - type: metric.latency.max
        value: 60000
      - type: agent.completed
        agentId: reviewer
```

### Example 2: Code Generation Agent

A multi-agent workflow: planner → coder → tester → reviewer.

```yaml
# evals/code-gen-agent.yaml
name: Code Generation Agent Eval
description: Tests the plan → code → test → review pipeline

defaultAssertions:
  - type: metric.cost.max
    value: 0.50
  - type: signal.not
    pattern: "error:*"

cases:
  # ============================================================================
  # Function Generation
  # ============================================================================

  - id: fibonacci-function
    name: Generates correct fibonacci function
    tags: [algorithms, functions]
    input:
      task: "Write a function that returns the nth fibonacci number"
      language: typescript
      requirements:
        - Must handle n=0 and n=1 as base cases
        - Must be efficient (no exponential recursion)
    assertions:
      # Trajectory: all 4 agents should activate in order
      - type: signal.trajectory
        patterns:
          - harness:start
          - { pattern: agent:activated, payload: { agent: planner } }
          - plan:complete
          - { pattern: agent:activated, payload: { agent: coder } }
          - code:complete
          - { pattern: agent:activated, payload: { agent: tester } }
          - tests:complete
          - { pattern: agent:activated, payload: { agent: reviewer } }
          - review:complete
          - harness:end

      # Output should contain working code
      - type: output.contains
        text: "function"
      - type: output.matches
        regex: "fibonacci|fib"
        flags: i

      # Snapshot: after planning, should have a plan in state
      - type: snapshot.at
        afterSignal: plan:complete
        path: plan.steps
        exists: true

      # Snapshot: after coding, should have code in state
      - type: snapshot.at
        afterSignal: code:complete
        path: code.content
        value:
          contains: "function"

      # Final state should have passing tests
      - type: snapshot.final
        path: tests.passed
        value: true

      # Metrics
      - type: metric.activations
        exact: 4
      - type: metric.latency.max
        value: 45000

  - id: binary-search
    name: Generates correct binary search
    tags: [algorithms, search]
    input:
      task: "Write a binary search function for a sorted array"
      language: typescript
    assertions:
      - type: signal.trajectory
        patterns:
          - plan:complete
          - code:complete
          - tests:complete
      - type: output.matches
        regex: "binary.*search|binarySearch"
        flags: i
      - type: snapshot.final
        path: tests.passed
        value: true

  # ============================================================================
  # API Generation
  # ============================================================================

  - id: rest-endpoint
    name: Generates REST API endpoint
    tags: [api, backend]
    input:
      task: "Create a REST endpoint for user registration with validation"
      language: typescript
      framework: express
    assertions:
      - type: output.contains
        text: "router"
      - type: output.matches
        regex: "post|POST"
      - type: output.matches
        regex: "validate|validation|zod|joi"
        flags: i
      # Should generate tests
      - type: snapshot.at
        afterSignal: tests:complete
        path: tests.count
        value:
          gte: 2

  # ============================================================================
  # Error Handling
  # ============================================================================

  - id: impossible-task
    name: Handles impossible task gracefully
    tags: [error-handling, edge-case]
    input:
      task: "Write a function that solves P=NP"
      language: typescript
    assertions:
      # Planner should recognize impossibility
      - type: agent.completed
        agentId: planner
      # Should NOT proceed to coding
      - type: agent.skipped
        agentId: coder
      # Should explain why
      - type: output.matches
        regex: "impossible|cannot|infeasible|NP-hard"
        flags: i

  - id: ambiguous-task
    name: Asks for clarification on ambiguous task
    tags: [error-handling]
    input:
      task: "Make it better"
      language: typescript
    assertions:
      # Should emit clarification request
      - type: signal.contains
        pattern: clarification:needed
      - type: output.matches
        regex: "clarif|specific|what|which"
        flags: i

  # ============================================================================
  # Tool Usage Validation (for coding agents with tools)
  # ============================================================================

  - id: file-creation-tools
    name: Uses correct file tools
    tags: [tools, filesystem]
    input:
      task: "Create a new file called utils.ts with a helper function"
      language: typescript
    assertions:
      # Should call Write tool, not Bash echo
      - type: tool.called
        name: Write
      - type: tool.notCalled
        name: Bash
      # Tool called with correct path
      - type: tool.calledWith
        name: Write
        args:
          file_path:
            endsWith: "utils.ts"
      - type: snapshot.final
        path: files
        value:
          contains: "utils.ts"

  - id: test-execution-tools
    name: Runs tests using correct tools
    tags: [tools, testing]
    input:
      task: "Write and run tests for the math module"
      language: typescript
    assertions:
      # Should write tests first
      - type: tool.sequence
        tools:
          - Write
          - Bash
      # Bash should run test command
      - type: tool.calledWith
        name: Bash
        args:
          command:
            matches: "test|vitest|jest|bun test"
```

### Example 3: Multi-File Refactoring Agent

Testing complex refactoring operations across multiple files.

```yaml
# evals/refactoring-agent.yaml
name: Refactoring Agent Eval
description: Tests multi-file refactoring operations

defaultAssertions:
  - type: signal.not
    pattern: "error:*"
  - type: metric.latency.max
    value: 120000

cases:
  - id: rename-function-across-files
    name: Renames function across multiple files
    tags: [refactoring, rename]
    input:
      task: "Rename function 'getData' to 'fetchData' across the codebase"
      files:
        - path: src/api.ts
          content: "export function getData() { ... }"
        - path: src/handler.ts
          content: "import { getData } from './api'; getData();"
        - path: tests/api.test.ts
          content: "import { getData } from '../src/api';"
    assertions:
      # Should identify all files
      - type: snapshot.at
        afterSignal: analysis:complete
        path: analysis.affectedFiles
        value:
          gte: 3  # At least 3 files identified

      # Should use Edit tool for each file
      - type: tool.called
        name: Edit
        min: 3

      # Trajectory: analyze → plan → execute → verify
      - type: signal.trajectory
        patterns:
          - analysis:complete
          - plan:complete
          - refactor:complete
          - verification:complete

      # Final verification should pass
      - type: snapshot.final
        path: verification.passed
        value: true

      # Output should mention all affected files
      - type: output.contains
        text: api.ts
      - type: output.contains
        text: handler.ts
      - type: output.contains
        text: api.test.ts

  - id: extract-interface
    name: Extracts interface from class
    tags: [refactoring, typescript]
    input:
      task: "Extract an interface from the UserService class"
      files:
        - path: src/user-service.ts
          content: |
            class UserService {
              async getUser(id: string): Promise<User> { ... }
              async updateUser(id: string, data: UserUpdate): Promise<User> { ... }
            }
    assertions:
      - type: output.contains
        text: interface
      - type: output.matches
        regex: "IUserService|UserServiceInterface"
      - type: tool.called
        name: Write
        min: 1

  - id: move-to-separate-file
    name: Moves code to separate file
    tags: [refactoring, organization]
    input:
      task: "Move the 'validateEmail' function to a new file called validators.ts"
      files:
        - path: src/utils.ts
          content: |
            export function validateEmail(email: string) { ... }
            export function formatDate(date: Date) { ... }
    assertions:
      # Should create new file
      - type: tool.called
        name: Write
      - type: tool.calledWith
        name: Write
        args:
          file_path:
            endsWith: validators.ts
      # Should update original file
      - type: tool.called
        name: Edit
      # Should update imports
      - type: snapshot.final
        path: filesModified
        value:
          gte: 2
```

### Example 4: Debugging Agent

Testing an agent that debugs failing tests.

```yaml
# evals/debugging-agent.yaml
name: Debugging Agent Eval
description: Tests the debug → diagnose → fix workflow

cases:
  - id: failing-test-null-error
    name: Fixes null pointer error from test failure
    tags: [debugging, null]
    input:
      error: |
        TypeError: Cannot read property 'name' of undefined
        at getUserName (src/user.ts:15)
        at Object.<anonymous> (tests/user.test.ts:23)
      testFile: tests/user.test.ts
      sourceFile: src/user.ts
    assertions:
      # Trajectory: read error → read files → diagnose → fix
      - type: signal.trajectory
        patterns:
          - harness:start
          - { pattern: agent:activated, payload: { agent: debugger } }
          - diagnosis:complete
          - fix:proposed
          - harness:end

      # Should read both files
      - type: tool.called
        name: Read
        min: 2

      # Diagnosis should identify the root cause
      - type: snapshot.at
        afterSignal: diagnosis:complete
        path: diagnosis.rootCause
        exists: true
      - type: snapshot.at
        afterSignal: diagnosis:complete
        path: diagnosis.rootCause
        value:
          contains: "null"

      # Fix should address the issue
      - type: output.matches
        regex: "optional chaining|null check|undefined"
        flags: i

      # Should propose an Edit
      - type: tool.called
        name: Edit
      - type: tool.calledWith
        name: Edit
        args:
          file_path:
            endsWith: user.ts

  - id: test-timeout
    name: Diagnoses async test timeout
    tags: [debugging, async]
    input:
      error: "Timeout - Async callback was not invoked within 5000ms"
      testFile: tests/api.test.ts
    assertions:
      - type: snapshot.at
        afterSignal: diagnosis:complete
        path: diagnosis.category
        value: async
      - type: output.matches
        regex: "await|async|promise|callback"
        flags: i

  - id: import-error
    name: Fixes import/export mismatch
    tags: [debugging, imports]
    input:
      error: |
        SyntaxError: The requested module './utils' does not provide an export named 'helper'
    assertions:
      - type: output.matches
        regex: "export|named|default"
        flags: i
      - type: tool.called
        name: Grep
```

### Example 5: Cost & Quality Optimization (Matrix Eval)

```typescript
// evals/optimize-code-review.ts
import { createHarness, ClaudeProvider } from "@open-harness/core";
import { runMatrix, loadDataset, generateMarkdownReport } from "@open-harness/eval";

// Define our state type
interface ReviewState {
  code: string;
  language: string;
  review?: string;
  fix?: string;
}

// Load the evaluation dataset
const dataset = await loadDataset<ReviewState>("./evals/code-review-agent.yaml");

// Create variants to compare
const variants = [
  // Variant 1: Detailed prompt (higher quality, higher cost)
  {
    id: "detailed-prompt",
    name: "Detailed System Prompt",
    ...createDetailedAgents(),
    metadata: { promptVersion: "v2.1", tokens: "high" }
  },

  // Variant 2: Concise prompt (lower cost, faster)
  {
    id: "concise-prompt",
    name: "Concise System Prompt",
    ...createConciseAgents(),
    metadata: { promptVersion: "v1.0", tokens: "low" }
  },

  // Variant 3: Different model
  {
    id: "haiku-model",
    name: "Haiku Model (Cheapest)",
    ...createHaikuAgents(),
    metadata: { model: "claude-haiku" }
  },
];

// Run the matrix
const result = await runMatrix(variants, dataset, {
  parallel: true,
  concurrency: 3,
  onVariantComplete: (v) => console.log(`✓ ${v.variantName}: ${v.result.passRate * 100}%`)
});

// Generate report
const report = generateMarkdownReport(result);
console.log(report);

// Output recommendation
if (result.recommendation) {
  console.log(`\n🎯 Recommendation: ${result.recommendation.variantId}`);
  console.log(`   Reason: ${result.recommendation.reason}`);
}
```

---

## YAML Format Specification

### File Structure

```yaml
# Required
name: string                    # Dataset name

# Optional
description: string             # Description
defaultAssertions: Assertion[]  # Applied to all cases
defaultTimeout: number          # Default timeout in ms
metadata: object                # Arbitrary metadata

# Required
cases:
  - id: string                  # Required: unique identifier
    name: string                # Optional: human-readable name
    description: string         # Optional: what this tests
    input: object               # Required: state for runReactive
    assertions: Assertion[]     # Required: what to check
    tags: string[]              # Optional: for filtering
    timeout: number             # Optional: override timeout
    skip: boolean               # Optional: skip this case
    only: boolean               # Optional: only run this case
```

### Assertion Syntax

```yaml
# Signal assertions
- type: signal.contains
  pattern: "agent:*"
  payload:
    agent: reviewer

- type: signal.trajectory
  patterns:
    - harness:start
    - { pattern: agent:activated, payload: { agent: reviewer } }
    - review:complete
    - harness:end

# Snapshot assertions
- type: snapshot.at
  afterSignal: analysis:complete
  path: analysis.confidence
  value: { gte: 0.7 }

- type: snapshot.final
  path: result.passed
  value: true

# Metric assertions
- type: metric.latency.max
  value: 30000

- type: metric.cost.max
  value: 0.05

# Output assertions
- type: output.contains
  text: "security"
  caseSensitive: false

- type: output.matches
  regex: "SQL.*injection|XSS"
  flags: i

# Tool assertions
- type: tool.called
  name: Edit
  min: 1

- type: tool.sequence
  tools:
    - Read
    - Edit
    - Bash

# Composition
- type: all
  assertions:
    - type: output.contains
      text: vulnerability
    - type: metric.cost.max
      value: 0.10

- type: any
  assertions:
    - type: output.contains
      text: injection
    - type: output.contains
      text: XSS
```

---

## Implementation Plan

### Phase 1: Core (MVP)

**Files:**
```
packages/eval/src/
├── assertions/
│   ├── types.ts           # SignalAssertion union type
│   ├── signal.ts          # contains, not, count, trajectory, first, last
│   ├── snapshot.ts        # at, final
│   ├── agent.ts           # activated, completed, causedBy, emitted
│   ├── metric.ts          # latency, cost, tokens, activations
│   ├── output.ts          # contains, matches, json, length
│   ├── compose.ts         # all, any, not
│   └── evaluate.ts        # evaluateAssertion()
├── runners/
│   ├── case.ts            # runCase()
│   └── dataset.ts         # runDataset()
├── loader/
│   ├── yaml.ts            # loadDataset()
│   └── schema.ts          # Zod schema for YAML validation
├── types.ts               # EvalCase, DatasetResult, etc.
└── index.ts
```

**Deliverables:**
- [ ] SignalAssertion type definitions
- [ ] evaluateAssertion() for all assertion types
- [ ] runCase() function
- [ ] runDataset() function
- [ ] YAML loader with validation
- [ ] Basic markdown report
- [ ] Unit tests for all assertion types
- [ ] Integration test with real harness

### Phase 2: Advanced Features

**Files:**
```
packages/eval/src/
├── assertions/
│   ├── tool.ts            # called, notCalled, calledWith, sequence
│   └── llm.ts             # judge (LLM-as-Judge)
├── runners/
│   └── matrix.ts          # runMatrix()
├── comparison/
│   ├── compare.ts         # compare()
│   └── types.ts           # Regression, Improvement
└── reports/
    ├── markdown.ts        # Enhanced reports
    └── json.ts            # Dashboard JSON
```

**Deliverables:**
- [ ] Tool assertions
- [ ] LLM-as-Judge assertion
- [ ] runMatrix() function
- [ ] compare() function
- [ ] Regression detection
- [ ] Enhanced markdown reports
- [ ] JSON report format

### Phase 3: Polish

**Deliverables:**
- [ ] CLI tool (`bun run eval`)
- [ ] CI integration guide
- [ ] Example datasets for common use cases
- [ ] Performance optimization
- [ ] Documentation

---

## Success Criteria

- [ ] All assertion types implemented and tested
- [ ] runCase/runDataset/runMatrix working
- [ ] YAML datasets can be loaded and executed
- [ ] Comparison detects regressions correctly
- [ ] Reports are human-readable and actionable
- [ ] At least 3 example datasets (code review, code gen, refactoring)
- [ ] CI can block on regressions
- [ ] 100% type safety (no `any`)

---

## Appendix: Signal Patterns Reference

These are the signals emitted by Open Harness that can be asserted on:

| Signal | Payload | When |
|--------|---------|------|
| `harness:start` | `{ agents, state }` | Workflow starts |
| `harness:end` | `{ durationMs, activations, state }` | Workflow completes |
| `harness:terminating` | `{ reason, agent, state }` | endWhen triggered |
| `agent:activated` | `{ agent, trigger }` | Agent starts |
| `agent:skipped` | `{ agent, reason, trigger }` | Guard blocked |
| `provider:start` | `{ provider, model }` | LLM call starts |
| `provider:end` | `{ output, usage, durationMs }` | LLM call completes |
| `provider:error` | `{ error, code }` | LLM call failed |
| `text:delta` | `{ content }` | Streaming chunk |
| `text:complete` | `{ content }` | Full text |
| `tool:call` | `{ id, name, input }` | Tool invoked |
| `tool:result` | `{ id, result }` | Tool returned |
| `state:X:changed` | `{ key, oldValue, newValue, agent }` | State mutated |
| Custom | User-defined | From `emits` |

---

## Appendix: Why This Design

### Why Assertions as Data?

1. **Serializable** — Store in YAML, commit to git, diff in PRs
2. **Toolable** — IDEs can validate, visualize, autocomplete
3. **Shareable** — Non-programmers can read/write datasets
4. **Composable** — AND/OR/NOT without code nesting
5. **Reproducible** — Same dataset = same results

### Why Signal-Based?

1. **Observability** — See *everything* that happened
2. **Debugging** — Replay exact execution
3. **Trajectory** — Assert on order, not just presence
4. **Causality** — Know *why* agents activated
5. **Intermediate state** — Snapshot mid-execution

### Why Not Just Vitest?

Vitest matchers are **procedural per-test checks**. This eval system is:
- **Declarative** — Define assertions as data
- **Batch** — Run datasets, not individual tests
- **Comparative** — Baseline vs candidate
- **Aggregating** — Pass rates, percentiles, costs

They're complementary. Use Vitest for unit tests, use this for systematic evaluation.
