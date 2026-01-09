# DX Implementation Research

**Date:** 2026-01-08
**Status:** Complete
**Prerequisites:** SDK_DX_DECISIONS.md (locked decisions)

---

## Executive Summary

- **Entry points exist but need simplification**: `runFlow()`, `createHarness()`, `createRuntime()` form a layered API. New DX needs single `run()` unified entry point.
- **Recording system is solid**: `withRecording()` provider wrapper works well at the right abstraction level (provider, not harness). Keep as-is.
- **State management is mature**: `StateStore` with dot-path access, `RunStore` for persistence. Minor API changes needed for `agent()` definition.
- **Eval DX layer should be deprecated**: Phase 7 engine (runner, assertions, comparison) is solid. Phase 8 DX (`defineSuite`, `runSuite`, `gates`) should be replaced by vitest.
- **Vitest integration is straightforward**: Custom matchers via `expect.extend()`, custom reporters via interface, but `bench()` is for microbenchmarks only (use `test()` for latency/cost).

---

## Codebase Analysis

### Entry Points

| Function | Location | Purpose |
|----------|----------|---------|
| `runFlow()` | `@internal/server/harness/harness.ts:133-141` | Simplest API - creates harness, executes, cleans up |
| `createHarness()` | `@internal/server/harness/harness.ts:69-107` | Mid-level - manages runtime, transport, events |
| `createRuntime()` | `@internal/core/runtime/execution/runtime.ts:1036-1038` | Low-level - pure runtime execution |

**Hierarchy:**
```
runFlow()
  └─> createHarness()
        └─> createRuntime()
```

**Current Public Exports from `@open-harness/core`:**
- `Runtime`, `RuntimeOptions`, `createRuntime()`, `EventBus`
- `FlowDefinition`, `NodeDefinition`, `EdgeDefinition`
- `RunSnapshot`, `RuntimeStatus`, `RuntimeEvent`
- `NodeRegistry`, `DefaultNodeRegistry`, `NodeTypeDefinition`
- `RunStore`, `MemoryRunStore`
- Recording types and stores
- `ProviderTrait`, provider events

**Current Public Exports from `@open-harness/server`:**
- `createHarness()`, `runFlow()`, `Harness`, `HarnessOptions`
- `createDefaultRegistry()`, `registerStandardNodes()`
- `createClaudeNode()` and provider utilities
- Transport implementations (WebSocket, HTTP/SSE, Local)

---

### Recording System

**Core Pattern:** `withRecording()` wraps a `ProviderTrait` to add record/replay.

```typescript
// Location: @internal/core/recording/with-recording.ts
withRecording(trait, { mode, store, recordingId?, getInputHash? })
```

**Modes:**
- `"live"` - Execute without recording
- `"record"` - Execute and capture events/output
- `"replay"` - Replay from stored recording

**Recording Structure:**
```typescript
type Recording<T> = {
  id: string;
  metadata: { providerType, createdAt, inputHash, model?, tags? };
  events: RecordedEvent[];  // { seq, timestamp, event: StreamEvent }
  output?: T;
  error?: { code, message };
}
```

**Stores:**
- `InMemoryRecordingStore` - Testing
- `FileRecordingStore` - JSON + JSONL files
- `SqliteRecordingStore` - Database storage

**Key Insight:** Recording operates at the RIGHT level (provider/agent), not harness. This aligns with the locked decision: "Harness coordinates recordings, doesn't record itself."

---

### State Management

**Flow State Definition:**
```typescript
// In FlowDefinition
state?: {
  initial: Record<string, unknown>;
  schema?: Record<string, unknown>;
}
```

**StateStore Interface:**
```typescript
interface StateStore {
  get(path: string): unknown;       // Dot-path read: "user.name"
  set(path: string, value: unknown): void;
  patch(patch: StatePatch): void;   // { set?, merge? }
  snapshot(): Record<string, unknown>;
}
```

**Node Access:**
```typescript
interface NodeRunContext {
  state: StateStore;  // Direct state access in nodes
  emit, signal, nodeId, runId
}
```

**RunStore vs RecordingStore:**
| Aspect | RunStore | RecordingStore |
|--------|----------|----------------|
| Scope | Entire workflow | Single provider call |
| Data | Snapshots + events | Events + output |
| Purpose | Resume, audit | Replay, fixtures |
| Level | Runtime orchestration | Provider interaction |

---

### Eval System (Current)

**Architecture:**
```
Phase 6 (Foundation): types, assertions, scorers, hooks
Phase 7 (Engine): runner, engine, compare, report  ← KEEP
Phase 8 (DX): defineSuite, runSuite, gates          ← DEPRECATE
```

**Phase 7 Engine (Keep):**
- `runCase()` - Execute single test case
- `runDataset()` - Execute all cases for one variant
- `runMatrix()` - Execute all cases × all variants
- `evaluateAssertions()` - Check assertions
- `compareToBaseline()` - Detect regressions
- Scorers: latency, cost, tokens

**Phase 8 DX (Deprecate):**
- `defineSuite(config)` - Validate suite config
- `runSuite(suite, options)` - Execute suite with gates
- `gates.passRate()`, `gates.noRegressions()`, etc.
- `variant()` helper

**Why deprecate Phase 8:** It's a convenience wrapper that duplicates what vitest provides (describe, test, expect, reporters).

---

## Vitest Capabilities

### Custom Matchers

**Mechanism:** `expect.extend(matchers)`

```typescript
// vitest.setup.ts
import { expect } from 'vitest'

expect.extend({
  toHaveLatencyUnder(received, threshold) {
    const pass = received.latencyMs < threshold
    return {
      pass,
      message: () => `Expected latency ${received.latencyMs}ms to be under ${threshold}ms`,
    }
  },
})
```

**TypeScript Declaration:**
```typescript
// vitest.d.ts
interface CustomMatchers<R = unknown> {
  toHaveLatencyUnder(threshold: number): R
  toCostUnder(maxUsd: number): R
  toPassAssertion(assertion: Assertion): R
}

declare module 'vitest' {
  interface Assertion<T> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
```

**Configuration:**
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    setupFiles: ['./vitest.setup.ts'],
  }
})
```

Sources: [Extending Matchers](https://vitest.dev/guide/extending-matchers)

---

### Custom Reporters

**Approach 1: Extend DefaultReporter**
```typescript
import { DefaultReporter } from 'vitest/reporters'

export default class AggregationReporter extends DefaultReporter {
  results: Map<string, TestResult> = new Map()

  onTestModuleCollected(module) {
    // Collect test metadata
  }

  onTestRunEnd(testModules) {
    // Aggregate results, compute pass rate
    // Fail CI if gates not met
    this.printSummary()
  }
}
```

**Approach 2: Implement Reporter Interface**
```typescript
import type { Reporter } from 'vitest/node'

export default class GateReporter implements Reporter {
  onInit(ctx) { /* setup */ }
  onTestModuleCollected() { /* track */ }
  onTestRunEnd() { /* evaluate gates, output report */ }
}
```

**Configuration:**
```typescript
export default defineConfig({
  test: {
    reporters: ['default', './gate-reporter.ts'],
  }
})
```

**Key Methods:**
- `onInit(ctx)` - Initialization
- `onTestModuleCollected()` - When tests collected (no results yet)
- `onTestRunEnd(testModules)` - After all tests complete

**For Gates:** Reporter can aggregate results and call `process.exit(1)` to fail CI if pass rate below threshold.

Sources: [Extending Reporters](https://vitest.dev/advanced/reporters)

---

### Benchmarking

**Vitest `bench()` uses tinybench for microbenchmarks:**
```typescript
import { bench, describe } from 'vitest'

describe('performance', () => {
  bench('operation', () => {
    // Code to measure
  })
})
```

**Options:** `time`, `iterations`, `warmupTime`, `warmupIterations`

**For AI Latency/Cost:** `bench()` is designed for microbenchmarks (ops/sec). For AI eval metrics:

**Recommendation: Use `test()` with custom metrics instead:**
```typescript
import { test, expect } from 'vitest'
import { run } from '@open-harness/core'

test('agent responds under 2s', async () => {
  const start = Date.now()
  const result = await run(myAgent, 'Hello')
  const latencyMs = Date.now() - start

  expect(result.cost).toBeLessThan(0.01)
  expect(latencyMs).toBeLessThan(2000)
})
```

**Rationale:** AI calls are async, one-shot operations. `bench()` wants to run thousands of iterations. Use `test()` + custom matchers + custom reporter for aggregation.

Sources: [Vitest Features - Benchmarking](https://vitest.dev/guide/features)

---

## Implementation Mapping

| DX Concept | Current Implementation | Change Required |
|------------|----------------------|-----------------|
| `agent()` | `NodeTypeDefinition` + `ProviderTrait` | New factory function wrapping provider |
| `harness()` | `FlowDefinition` + `createHarness()` | New factory function with cleaner API |
| `run()` | `runFlow()` | Rename, unify signature |
| Recording | `withRecording()` on providers | Keep as-is, integrate with `run()` options |
| State | `StateSchemaDefinition` in flow | Move to `agent()` config |

### Detailed Mapping

**`agent()` → wraps `ProviderTrait` + `NodeTypeDefinition`:**
```typescript
// NEW
export function agent(config: AgentConfig): Agent {
  return {
    type: 'agent',
    prompt: config.prompt,
    state: config.state,        // StateSchemaDefinition
    output: config.output,      // Zod schema
    _provider: createProviderTrait(config),
    _nodeDef: createNodeDefinition(config),
  }
}
```

**`harness()` → wraps `FlowDefinition` + `createHarness()`:**
```typescript
// NEW
export function harness(config: HarnessConfig): Harness {
  return {
    type: 'harness',
    agents: config.agents,
    edges: config.edges,
    state: config.state,
    _flow: buildFlowDefinition(config),
  }
}
```

**`run()` → unifies `runFlow()` + direct agent execution:**
```typescript
// NEW
export async function run(
  target: Agent | Harness,
  input: unknown,
  options?: RunOptions
): Promise<RunResult> {
  if (target.type === 'agent') {
    return runAgent(target, input, options)
  } else {
    return runHarness(target, input, options)
  }
}
```

---

## Vitest Integration Design

```
@open-harness/vitest/
├── plugin.ts           # Vite plugin for transforms (minimal)
├── matchers.ts         # expect.extend() matchers
├── reporter.ts         # Aggregation + gates reporter
├── setup.ts            # Auto-setup file
└── index.ts            # Exports
```

### matchers.ts

```typescript
export const matchers = {
  toHaveLatencyUnder(received, threshold: number) {
    const latencyMs = received.latencyMs ?? received.metrics?.latencyMs
    return {
      pass: latencyMs < threshold,
      message: () => `Expected latency ${latencyMs}ms < ${threshold}ms`,
    }
  },

  toCostUnder(received, maxUsd: number) {
    const cost = received.cost ?? received.metrics?.totalCostUsd
    return {
      pass: cost < maxUsd,
      message: () => `Expected cost $${cost} < $${maxUsd}`,
    }
  },

  toPassAssertion(received, assertion: Assertion) {
    const result = evaluateAssertion(received, assertion)
    return {
      pass: result.passed,
      message: () => result.reason,
    }
  },
}

export function setupMatchers() {
  expect.extend(matchers)
}
```

### reporter.ts

```typescript
import type { Reporter } from 'vitest/node'

export interface GateConfig {
  passRate?: number      // 0-1, default 0.8
  maxLatencyMs?: number
  maxCostUsd?: number
}

export class OpenHarnessReporter implements Reporter {
  private results: TestResult[] = []
  private config: GateConfig

  constructor(config: GateConfig = {}) {
    this.config = { passRate: 0.8, ...config }
  }

  onTestRunEnd(testModules) {
    const passed = this.results.filter(r => r.passed).length
    const total = this.results.length
    const passRate = passed / total

    // Output summary
    console.log(`\nOpen Harness Results: ${passed}/${total} (${(passRate * 100).toFixed(1)}%)`)

    // Evaluate gates
    if (this.config.passRate && passRate < this.config.passRate) {
      console.error(`❌ Gate failed: pass rate ${passRate} < ${this.config.passRate}`)
      process.exit(1)
    }

    console.log('✅ All gates passed')
  }
}
```

### index.ts

```typescript
export { matchers, setupMatchers } from './matchers'
export { OpenHarnessReporter } from './reporter'
export type { GateConfig } from './reporter'

// Convenience re-exports
export { run, agent, harness } from '@open-harness/core'
```

### Usage

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import { OpenHarnessReporter } from '@open-harness/vitest'

export default defineConfig({
  test: {
    setupFiles: ['@open-harness/vitest/setup'],
    reporters: [
      'default',
      new OpenHarnessReporter({ passRate: 0.8 }),
    ],
  },
})
```

```typescript
// tests/agent.eval.ts
import { test, expect, describe } from 'vitest'
import { run, agent } from '@open-harness/vitest'

const myAgent = agent({
  prompt: 'You are a helpful assistant.',
})

describe('my agent', () => {
  test.each([
    { input: 'Hello', expected: /hello/i },
    { input: 'Help me', expected: /help/i },
  ])('responds appropriately to: $input', async ({ input, expected }) => {
    const result = await run(myAgent, input, { record: true })

    expect(result.output).toMatch(expected)
    expect(result).toHaveLatencyUnder(5000)
    expect(result).toCostUnder(0.01)
  })
})
```

---

## Migration Path

### Keep (Reuse As-Is)

1. **Recording System**
   - `withRecording()`, `RecordingStore`, all store implementations
   - Recording types and ID generation
   - Location: `@internal/core/recording/`

2. **State Management**
   - `StateStore`, `InMemoryStateStore`
   - `RunStore` and implementations
   - Location: `@internal/core/state/`, `@internal/core/persistence/`

3. **Runtime Core**
   - `createRuntime()`, `InMemoryRuntime`
   - Event bus, snapshot management
   - Location: `@internal/core/runtime/`

4. **Provider System**
   - `ProviderTrait`, `NodeRunContext`
   - Provider adapters
   - Location: `@internal/core/providers/`

5. **Phase 7 Eval Engine**
   - `runCase()`, `runDataset()`, `runMatrix()`
   - `evaluateAssertions()`, `compareToBaseline()`
   - Scorers: latency, cost, tokens
   - Location: `@internal/core/eval/` (runner, engine, compare, assertions)

### Adapt (Modify for New API)

1. **`runFlow()` → `run()`**
   - Rename function
   - Accept `Agent | Harness` instead of `FlowDefinition`
   - Add unified `RunOptions` with `record`, `variant` options

2. **`FlowDefinition` → internal**
   - Keep type but make internal
   - Build from `harness()` config

3. **`NodeTypeDefinition` → internal**
   - Keep type but make internal
   - Build from `agent()` config

4. **Eval Assertions → Custom Matchers**
   - Port `evaluateAssertions()` logic to vitest matchers
   - Keep underlying assertion types

### Deprecate (Keep for Backward Compat)

1. **`createHarness()`, `createRuntime()`**
   - Add deprecation warning
   - Alias to internal implementations
   - Remove in v0.3.0

2. **`HarnessOptions`, `RuntimeOptions`**
   - Mark as `@deprecated`
   - Keep for existing users

### Remove (Delete Entirely)

1. **Phase 8 Eval DX**
   - `defineSuite()`, `runSuite()`
   - `variant()` helper
   - `gates.*` factories
   - Files: `dx.ts`, `dx-types.ts`

2. **Dataset Loading**
   - `loadDataset()`, `loadDatasetFromFile()`
   - Files: `dataset.ts`

3. **Judge Cache**
   - `EvalJudgeCache`, `createInMemoryCache()`
   - Files: `cache.ts`

---

## Recommendations

### Priority 1: Core API Surface

1. **Create `agent()` factory**
   - Wraps `ProviderTrait` creation
   - Takes prompt, state, output schema
   - Returns opaque `Agent` type

2. **Create `harness()` factory**
   - Wraps `FlowDefinition` creation
   - Takes agents, edges, state
   - Returns opaque `Harness` type

3. **Create unified `run()`**
   - Accepts `Agent | Harness`
   - Unified `RunOptions` with record, variant
   - Returns `RunResult` with output, state, metrics

### Priority 2: Vitest Package

1. **Create `@open-harness/vitest`**
   - Custom matchers: `toHaveLatencyUnder`, `toCostUnder`, `toPassAssertion`
   - Aggregation reporter with gate evaluation
   - Setup file for auto-registration

2. **Document vitest patterns**
   - `describe.each()` for variants
   - `test.each()` for cases
   - Custom reporter for CI gates

### Priority 3: Deprecation

1. **Add deprecation warnings**
   - `createHarness()`, `createRuntime()`
   - `defineSuite()`, `runSuite()`
   - Phase 8 eval functions

2. **Update examples**
   - Convert starter-kit to vitest
   - Update documentation

---

## Locked Decisions

### 1. Fixtures as `run()` Option (Option B)

**Decision:** Fixtures are a first-class option of `run()`, not a separate vitest concept.

**Rationale:**
- Recording exists FOR replay. Replay exists FOR testing. They're the same thing.
- Makes it easy to do the right thing - if you're recording, you're implicitly setting up for eval
- Works with any test framework (vitest, jest, etc.), not just vitest
- Single unified API surface

**API:**
```typescript
interface RunOptions {
  fixture?: string;                    // Fixture ID for record/replay
  mode?: 'live' | 'record' | 'replay'; // Default: from FIXTURE_MODE env or 'live'
  store?: FixtureStore;                // Where fixtures live
  variant?: Record<string, unknown>;   // Config overrides (model, temperature, etc.)
}

interface RunResult<T = unknown> {
  output: T;
  state?: Record<string, unknown>;
  metrics: {
    latencyMs: number;
    cost: number;
    tokens: { input: number; output: number };
  };
  fixtures?: string[];  // IDs of fixtures created (when recording)
}
```

**Mode Control:**
```bash
# Record new fixtures (hits real API)
FIXTURE_MODE=record bun test

# Replay fixtures (no API calls, fast, deterministic)
FIXTURE_MODE=replay bun test

# Live mode (hits API, no fixtures) - default
bun test
```

---

### 2. Hierarchical Fixture IDs for Multi-Agent

**Decision:** Use hierarchical IDs: `<fixture-name>/<nodeId>/inv<N>`

**Example:**
```
fixtures/
└── code-review/
    └── hello-world/
        ├── coder/
        │   └── inv0.json
        └── reviewer/
            └── inv0.json
```

**Rationale:**
- No manifest file needed
- Naturally groups fixtures by run
- Query by prefix to find all fixtures for a run
- Minimal code change from current recording system

---

### 3. State Terminology Clarification

**SDK Session State:** Managed by the agent SDK (e.g., Claude Agent SDK). Open Harness only stores `sessionId` per node. The SDK maintains full conversation history internally.

**Harness Workflow State:** The `state` in `harness()` config. Shared across agents via `StateStore`. Used for workflow orchestration, not conversation.

**Agent does NOT have "state" in the Open Harness sense.** It has a prompt and optional output schema. The SDK manages its own session.

---

### 4. Recording = Fixtures (Rename)

**Decision:** Rename "recording" to "fixture" in the public API.

**Internal:** Keep `withRecording()`, `RecordingStore` etc. as implementation details.

**Public:** `fixture`, `FixtureStore`, `FIXTURE_MODE`

**Rationale:** "Fixture" is standard test terminology. "Recording" sounds like audio/video.

---

## Concrete DX Examples

### Production Backend (No Fixtures)

```typescript
// src/api/chat.ts
import { agent, run } from '@open-harness/core'

const supportAgent = agent({
  prompt: `You are a customer support agent for Acme Corp.`,
})

export async function handleChat(userId: string, message: string) {
  const result = await run(supportAgent, {
    prompt: message,
    sessionId: `user-${userId}`,  // SDK manages conversation
  })

  return {
    reply: result.output.text,
    cost: result.metrics.cost,
  }
}
```

### Tests with Fixtures

```typescript
// tests/support-agent.test.ts
import { test, expect } from 'vitest'
import { agent, run } from '@open-harness/core'
import { FileFixtureStore } from '@open-harness/stores'

const store = new FileFixtureStore('./fixtures')

const supportAgent = agent({
  prompt: `You are a customer support agent for Acme Corp.`,
})

test('greets user appropriately', async () => {
  const result = await run(supportAgent, { prompt: 'Hi there!' }, {
    fixture: 'support/greeting',
    store,
  })

  expect(result.output.text).toMatch(/hello|hi|welcome/i)
  expect(result.metrics.latencyMs).toBeLessThan(5000)
})
```

### Multi-Agent Harness

```typescript
// tests/code-review.test.ts
import { test, expect } from 'vitest'
import { agent, harness, run } from '@open-harness/core'
import { FileFixtureStore } from '@open-harness/stores'

const store = new FileFixtureStore('./fixtures')

const coder = agent({ prompt: `Write code based on the requirement.` })
const reviewer = agent({ prompt: `Review the code. Output: { approved, feedback }` })

const codeReviewFlow = harness({
  agents: { coder, reviewer },
  edges: [{ from: 'coder', to: 'reviewer' }],
})

test('code gets reviewed', async () => {
  const result = await run(codeReviewFlow, { prompt: 'Write a hello world' }, {
    fixture: 'code-review/hello-world',
    store,
  })

  // result.fixtures = ['code-review/hello-world/coder/inv0', 'code-review/hello-world/reviewer/inv0']
  expect(result.output.approved).toBe(true)
})
```

### SQLite Store (CI/Shared Fixtures)

```typescript
// tests/setup.ts
import { setDefaultStore, setDefaultMode } from '@open-harness/core'
import { SqliteFixtureStore } from '@open-harness/stores'

setDefaultStore(new SqliteFixtureStore(process.env.FIXTURE_DB_PATH ?? './fixtures.db'))
setDefaultMode(process.env.FIXTURE_MODE as 'live' | 'record' | 'replay' ?? 'live')
```

```typescript
// tests/agent.test.ts
// No need to pass store - uses default
test('agent works', async () => {
  const result = await run(agent, input, { fixture: 'my-test' })
  expect(result.output).toBeDefined()
})
```

### vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    env: {
      FIXTURE_MODE: process.env.CI ? 'replay' : 'live',
    },
    setupFiles: ['./tests/setup.ts'],
  },
})
```

---

## Next Steps

1. [ ] Implement `agent()` factory in `@open-harness/core`
2. [ ] Implement `harness()` factory in `@open-harness/core`
3. [ ] Implement unified `run()` in `@open-harness/core`
4. [ ] Create `@open-harness/vitest` package skeleton
5. [ ] Implement custom matchers
6. [ ] Implement aggregation reporter
7. [ ] Convert starter-kit example to vitest
8. [ ] Add deprecation warnings to old APIs
9. [ ] Update public documentation
